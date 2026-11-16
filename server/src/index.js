import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import argon2 from 'argon2';
import multer from 'multer';
import sharp from 'sharp';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './db.js';

const app = express();
app.disable('x-powered-by');

const port = Number(process.env.PORT || 3001);
const cookieName = 'leaflet_session';
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction) app.set('trust proxy', 1);
const serverDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const coversDir = join(serverDir, 'uploads', 'book-covers');
const clientDistDir = join(serverDir, '..', 'client', 'dist');
const appOrigin = process.env.APP_ORIGIN || process.env.RENDER_EXTERNAL_URL;
const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const cloudKey = process.env.CLOUDINARY_API_KEY;
const cloudSecret = process.env.CLOUDINARY_API_SECRET;
const hasCloudinary = Boolean(cloudName && cloudKey && cloudSecret);
if (isProduction && (!hasCloudinary || !appOrigin)) {
  throw new Error('Production requires Cloudinary credentials and APP_ORIGIN or RENDER_EXTERNAL_URL.');
}

async function cloudinaryRequest(action, fields) {
  const auth = Buffer.from(`${cloudKey}:${cloudSecret}`).toString('base64');
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/${action}`,
    { method: 'POST', headers: { Authorization: `Basic ${auth}` }, body: fields }
  );
  const result = await response.json();
  if (!response.ok) {
    console.error('Cloudinary request failed:', action, result.error?.message);
    throw new Error('Не вдалося зберегти обкладинку в хмарному сховищі');
  }
  return result;
}
const bookIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const coverFilenamePattern = /^[0-9a-f-]{36}\.webp$/i;

app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://127.0.0.1:5173',
  credentials: true
}));
app.use(express.json({ limit: '64kb' }));
app.use(cookieParser());
// Since production serves React and the API on the same origin, reject cross-site writes.
app.use('/api', (req, res, next) => {
  if (!isProduction || ['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('Origin') !== appOrigin) {
    return res.status(403).json({ error: 'Недозволене джерело запиту' });
  }
  next();
});
app.use('/uploads/book-covers', express.static(coversDir));

const authLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false
});

const coverLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false
});

const coverUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1
  },
  fileFilter: (_req, file, callback) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    callback(null, allowedTypes.includes(file.mimetype));
  }
});

const hash = token => createHash('sha256').update(token).digest('hex');

const publicUser = user => ({
  id: user.id,
  email: user.email,
  fullName: user.full_name,
  city: user.city,
  about: user.about,
  contact: user.contact,
  showContact: user.show_contact
});

const bookFields = `
  id,
  title,
  author,
  description,
  book_condition AS "condition",
  listing_type AS "listingType",
  status,
  created_at AS "createdAt",
  cover_url AS "coverUrl"
`;

function setCookie(res, token) {
  res.cookie(cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

async function createSession(res, userId) {
  const token = randomBytes(32).toString('hex');

  await pool.query(
    "INSERT INTO sessions(token_hash, user_id, expires_at) VALUES($1, $2, now() + interval '7 days')",
    [hash(token), userId]
  );

  setCookie(res, token);
}

async function requireAuth(req, res, next) {
  try {
    const token = req.cookies[cookieName];
    if (!token) return res.status(401).json({ error: 'Увійдіть в акаунт' });

    const { rows } = await pool.query(
      `SELECT u.*
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > now()`,
      [hash(token)]
    );

    if (!rows.length) {
      return res.status(401).json({ error: 'Сесія завершилася. Увійдіть ще раз' });
    }

    req.user = rows[0];
    next();
  } catch (error) {
    next(error);
  }
}

function parseBook(body) {
  const { title, author, description = '', condition = 'good', listingType = 'exchange' } = body || {};

  if (
    typeof title !== 'string' ||
    title.trim().length < 1 ||
    title.trim().length > 200 ||
    typeof author !== 'string' ||
    author.trim().length < 1 ||
    author.trim().length > 150 ||
    typeof description !== 'string' ||
    description.length > 2000 ||
    !['new', 'good', 'fair'].includes(condition) ||
    !['exchange', 'gift'].includes(listingType)
  ) {
    return null;
  }

  return {
    title: title.trim(),
    author: author.trim(),
    description: description.trim(),
    condition,
    listingType
  };
}

// Реєстрація, вхід, отримання поточного користувача й вихід.
app.post('/api/auth/register', authLimit, async (req, res, next) => {
  try {
    const { fullName, email, password } = req.body || {};
    const name = String(fullName || '').trim();
    const mail = String(email || '').trim().toLowerCase();

    if (
      name.length < 2 || name.length > 100 ||
      mail.length > 254 || !/^\S+@\S+\.\S+$/.test(mail) ||
      typeof password !== 'string' || password.length < 10 || password.length > 128
    ) {
      return res.status(400).json({
        error: 'Вкажіть ім’я, коректний email і пароль від 10 символів'
      });
    }

    const passHash = await argon2.hash(password, { type: argon2.argon2id });
    const id = randomUUID();
    const { rows } = await pool.query(
      'INSERT INTO users(id, email, password_hash, full_name) VALUES($1, $2, $3, $4) RETURNING *',
      [id, mail, passHash, name]
    );

    await createSession(res, id);
    res.status(201).json({ user: publicUser(rows[0]) });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Цей email уже зареєстровано' });
    }
    next(error);
  }
});

app.post('/api/auth/login', authLimit, async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Вкажіть email і пароль' });
    }

    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email.trim().toLowerCase()]);
    if (!rows.length || !(await argon2.verify(rows[0].password_hash, password))) {
      return res.status(401).json({ error: 'Неправильний email або пароль' });
    }

    await createSession(res, rows[0].id);
    res.json({ user: publicUser(rows[0]) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.post('/api/auth/logout', async (req, res, next) => {
  try {
    if (req.cookies[cookieName]) {
      await pool.query(
        'DELETE FROM sessions WHERE token_hash = $1',
        [hash(req.cookies[cookieName])]
      );
    }

    res.clearCookie(cookieName, {
      path: '/',
      sameSite: 'lax',
      secure: isProduction
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// Особистий профіль.
app.patch('/api/profile', requireAuth, async (req, res, next) => {
  try {
    const { fullName, city, about, contact, showContact } = req.body || {};
    if (
      typeof fullName !== 'string' || fullName.trim().length < 2 || fullName.length > 100 ||
      typeof city !== 'string' || city.length > 100 ||
      typeof about !== 'string' || about.length > 1000 ||
      typeof contact !== 'string' || contact.length > 200 ||
      typeof showContact !== 'boolean'
    ) {
      return res.status(400).json({ error: 'Перевірте дані профілю' });
    }

    const { rows } = await pool.query(
      `UPDATE users
       SET full_name = $1, city = $2, about = $3, contact = $4, show_contact = $5
       WHERE id = $6 RETURNING *`,
      [fullName.trim(), city.trim(), about.trim(), contact.trim(), showContact, req.user.id]
    );

    res.json({ user: publicUser(rows[0]) });
  } catch (error) {
    next(error);
  }
});

// Перегляд власних книг.
app.get('/api/books/mine', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT ${bookFields}
       FROM book_listings
       WHERE user_id = $1
       ORDER BY created_at DESC, id DESC`,
      [req.user.id]
    );
    res.json({ books: rows });
  } catch (error) {
    next(error);
  }
});

// Публічний каталог доступних книг.
app.get('/api/books', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        b.id,
        b.title,
        b.author,
        b.description,
        b.book_condition AS "condition",
        b.listing_type AS "listingType",
        b.status,
        b.created_at AS "createdAt",
        b.cover_url AS "coverUrl",
        u.full_name AS "ownerName",
        u.city AS "ownerCity",
        CASE
          WHEN u.show_contact IS TRUE
          THEN NULLIF(u.contact, '')
          ELSE NULL
        END AS "ownerContact"
      FROM book_listings b
      JOIN users u ON u.id = b.user_id
      WHERE b.status = 'available'
      ORDER BY b.created_at DESC
      LIMIT 200
    `);
    res.json({ books: rows });
  } catch (error) {
    next(error);
  }
});
// Детальна сторінка публічної книги.
app.get('/api/books/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    // Перевіряємо ID книги
    if (!bookIdPattern.test(id)) {
      return res.status(400).json({
        error: 'Некоректний ID книги'
      });
    }
    const { rows } = await pool.query(
      `SELECT
        b.id,
        b.title,
        b.author,
        b.description,
        b.book_condition AS "condition",
        b.listing_type AS "listingType",
        b.status,
        b.created_at AS "createdAt",
        b.cover_url AS "coverUrl",
        u.full_name AS "ownerName",
        u.city AS "ownerCity",
        CASE
          WHEN u.show_contact IS TRUE
          THEN NULLIF(u.contact, '')
          ELSE NULL
        END AS "ownerContact"
      FROM book_listings b
      JOIN users u ON u.id = b.user_id
      WHERE b.id = $1
        AND b.status = 'available'`,
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({
        error: 'Книгу не знайдено'
      });
    }
    res.json({ book: rows[0] });
  } catch (error) {
    next(error);
  }
});
// Додавання книги.
app.post('/api/books', requireAuth, async (req, res, next) => {
  try {
    const book = parseBook(req.body);
    if (!book) return res.status(400).json({ error: 'Перевірте дані книги' });

    const { rows } = await pool.query(
      `INSERT INTO book_listings
       (id, user_id, title, author, description, book_condition, listing_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${bookFields}`,
      [randomUUID(), req.user.id, book.title, book.author, book.description, book.condition, book.listingType]
    );

    res.status(201).json({ book: rows[0] });
  } catch (error) {
    next(error);
  }
});

// Редагування лише власної книги.
app.patch('/api/books/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!bookIdPattern.test(id)) {
      return res.status(400).json({ error: 'Некоректний ID книги' });
    }

    const book = parseBook(req.body);
    if (!book) return res.status(400).json({ error: 'Перевірте дані книги' });

    const { rows } = await pool.query(
      `UPDATE book_listings
       SET title = $1, author = $2, description = $3,
           book_condition = $4, listing_type = $5
       WHERE id = $6 AND user_id = $7
       RETURNING ${bookFields}`,
      [book.title, book.author, book.description, book.condition, book.listingType, id, req.user.id]
    );

    if (!rows.length) return res.status(404).json({ error: 'Книгу не знайдено' });
    res.json({ book: rows[0] });
  } catch (error) {
    next(error);
  }
});

// Видалення книги та її обкладинки.
app.delete('/api/books/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!bookIdPattern.test(id)) {
      return res.status(400).json({ error: 'Некоректний ID книги' });
    }

    const { rows } = await pool.query(
      `DELETE FROM book_listings
       WHERE id = $1 AND user_id = $2
       RETURNING id, cover_url`,
      [id, req.user.id]
    );

    if (!rows.length) return res.status(404).json({ error: 'Книгу не знайдено' });

    const oldUrl = rows[0].cover_url;
    if (oldUrl?.startsWith('/uploads/book-covers/')) {
      const filename = basename(oldUrl);
      if (coverFilenamePattern.test(filename)) {
        await unlink(join(coversDir, filename)).catch(() => {});
      }
    } else if (hasCloudinary && oldUrl?.startsWith(`https://res.cloudinary.com/${cloudName}/`)) {
      const fields = new FormData();
      fields.append('public_id', `leaflet/books/${id}`);
      await cloudinaryRequest('destroy', fields).catch(error => console.error(error));
    }

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// Завантаження або заміна обкладинки книги.
app.post('/api/books/:id/cover', requireAuth, coverLimit, coverUpload.single('cover'), async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!bookIdPattern.test(id)) {
      return res.status(400).json({ error: 'Некоректний ID книги' });
    }

    const { rows } = await pool.query(
      'SELECT cover_url FROM book_listings WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Книгу не знайдено' });
    if (!req.file) return res.status(400).json({ error: 'Оберіть JPG, PNG або WebP' });

    let imageBuffer;
    try {
      const image = sharp(req.file.buffer, { limitInputPixels: 20_000_000 });
      const metadata = await image.metadata();
      if (!['jpeg', 'png', 'webp'].includes(metadata.format)) {
        return res.status(400).json({ error: 'Непідтримуваний формат зображення' });
      }

      imageBuffer = await image
        .rotate()
        .resize(900, 1300, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();
    } catch {
      return res.status(400).json({ error: 'Не вдалося прочитати зображення' });
    }

    let coverUrl;
    let localFilePath;

    if (hasCloudinary) {
      const fields = new FormData();
      fields.append('file', new Blob([imageBuffer], { type: 'image/webp' }), `${id}.webp`);
      fields.append('public_id', `leaflet/books/${id}`);
      fields.append('overwrite', 'true');
      fields.append('invalidate', 'true');
      const uploaded = await cloudinaryRequest('upload', fields);
      if (typeof uploaded.secure_url !== 'string' ||
          !uploaded.secure_url.startsWith(`https://res.cloudinary.com/${cloudName}/`)) {
        throw new Error('Cloudinary did not return a valid image URL');
      }
      coverUrl = uploaded.secure_url;
    } else {
      // Local-development fallback. Never used in production.
      await mkdir(coversDir, { recursive: true });
      const filename = `${randomUUID()}.webp`;
      localFilePath = join(coversDir, filename);
      coverUrl = `/uploads/book-covers/${filename}`;
      await writeFile(localFilePath, imageBuffer);
    }

    let updated;
    try {
      updated = await pool.query(
        'UPDATE book_listings SET cover_url = $1 WHERE id = $2 AND user_id = $3 RETURNING id',
        [coverUrl, id, req.user.id]
      );
    } catch (error) {
      if (localFilePath) await unlink(localFilePath).catch(() => {});
      throw error;
    }

    if (!updated.rows.length) {
      if (localFilePath) await unlink(localFilePath).catch(() => {});
      return res.status(404).json({ error: 'Книгу не знайдено' });
    }

    const oldUrl = rows[0].cover_url;
    if (oldUrl?.startsWith('/uploads/book-covers/')) {
      const oldFilename = basename(oldUrl);
      if (coverFilenamePattern.test(oldFilename)) {
        await unlink(join(coversDir, oldFilename)).catch(() => {});
      }
    }

    res.json({ coverUrl });
  } catch (error) {
    next(error);
  }
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// The production website and API share one domain (no cross-site session cookies).
if (isProduction) {
  app.use(express.static(clientDistDir, { index: false }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
      return res.status(404).json({ error: 'Ресурс не знайдено' });
    }
    res.sendFile(join(clientDistDir, 'index.html'), error => {
      if (error) next(error);
    });
  });
}

app.use((err, _req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({
      error: err.code === 'LIMIT_FILE_SIZE'
        ? 'Зображення має бути не більше 5 МБ'
        : 'Помилка завантаження файлу'
    });
  }
  next(err);
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Помилка сервера' });
});

app.listen(port, () => console.log(`Leaflet API: http://127.0.0.1:${port}`));
