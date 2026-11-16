import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import '../styles/mybooks.css';

type Book = {
  id: string;
  title: string;
  author: string;
  description: string;
  condition: 'new' | 'good' | 'fair';
  listingType: 'exchange' | 'gift';
  status: string;
  createdAt: string;
  coverUrl: string | null;
};

const API = '';
const MAX_COVER_BYTES = 5 * 1024 * 1024;
const ALLOWED_COVER_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function validateCover(file: File): string | null {
  if (!ALLOWED_COVER_TYPES.includes(file.type)) {
    return 'Можна завантажити тільки JPG, PNG або WebP';
  }
  if (file.size > MAX_COVER_BYTES) {
    return 'Розмір обкладинки не повинен перевищувати 5 МБ';
  }
  return null;
}

async function sendCover(bookId: string, file: File): Promise<string> {
  const problem = validateCover(file);
  if (problem) throw new Error(problem);

  const formData = new FormData();
  formData.append('cover', file);

  const response = await fetch(`${API}/api/books/${bookId}/cover`, {
    method: 'POST',
    credentials: 'include',
    body: formData
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Не вдалося завантажити обкладинку');
  }
  return data.coverUrl as string;
}

export default function MyBooks() {
  const [books, setBooks] = useState<Book[]>([]);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [condition, setCondition] = useState<Book['condition']>('good');
  const [listingType, setListingType] = useState<Book['listingType']>('exchange');
  const [coverFile, setCoverFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadBooks() {
      try {
        const response = await fetch(`${API}/api/books/mine`, {
          credentials: 'include'
        });
        if (!response.ok) throw new Error('Не вдалося завантажити книги');
        const data: { books: Book[] } = await response.json();
        setBooks(data.books);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Помилка завантаження');
      } finally {
        setLoading(false);
      }
    }

    void loadBooks();
  }, []);

  function resetForm() {
    setEditingId(null);
    setTitle('');
    setAuthor('');
    setDescription('');
    setCondition('good');
    setListingType('exchange');
    setCoverFile(null);
    if (coverInputRef.current) coverInputRef.current.value = '';
  }

  function startEdit(book: Book) {
    setEditingId(book.id);
    setTitle(book.title);
    setAuthor(book.author);
    setDescription(book.description);
    setCondition(book.condition);
    setListingType(book.listingType);
    setCoverFile(null);
    if (coverInputRef.current) coverInputRef.current.value = '';
    setError('');
    setSuccess('');
    document.querySelector('.mybooks-panel')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }

  function cancelEdit() {
    resetForm();
    setError('');
    setSuccess('');
  }

  function selectFormCover(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0] || null;
    if (file) {
      const problem = validateCover(file);
      if (problem) {
        setError(problem);
        setCoverFile(null);
        event.currentTarget.value = '';
        return;
      }
    }
    setCoverFile(file);
    setError('');
  }

  async function saveBook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const isEditing = editingId !== null;
      const url = isEditing ? `${API}/api/books/${editingId}` : `${API}/api/books`;
      const response = await fetch(url, {
        method: isEditing ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          author: author.trim(),
          description: description.trim(),
          condition,
          listingType
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Не вдалося зберегти книгу');
      let savedBook: Book = data.book;
      let coverError = '';

      // Якщо у формі вибрана обкладинка, додаємо її до щойно збереженої книги.
      if (coverFile) {
        try {
          const coverUrl = await sendCover(savedBook.id, coverFile);
          savedBook = { ...savedBook, coverUrl };
        } catch (err) {
          coverError = err instanceof Error ? err.message : 'Помилка завантаження';
        }
      }

      if (isEditing) {
        setBooks(previous => previous.map(book => book.id === editingId ? savedBook : book));
      } else {
        setBooks(previous => [savedBook, ...previous]);
      }

      resetForm();
      if (coverError) {
        setError(`Книгу збережено, але обкладинку не додано: ${coverError}. Можеш завантажити її на картці книги.`);
      } else {
        setSuccess(isEditing ? 'Зміни збережено ✓' : 'Книгу додано ✓');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка збереження');
    } finally {
      setSaving(false);
    }
  }

  async function uploadCover(bookId: string, file: File) {
    setUploadingId(bookId);
    setError('');
    setSuccess('');

    try {
      const coverUrl = await sendCover(bookId, file);
      setBooks(previous => previous.map(book =>
        book.id === bookId ? { ...book, coverUrl } : book
      ));
      setSuccess('Обкладинку збережено ✓');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка завантаження');
    } finally {
      setUploadingId(null);
    }
  }

  async function deleteBook(id: string) {
    if (!window.confirm('Точно видалити цю книгу з бібліотеки?')) return;
    setDeletingId(id);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${API}/api/books/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Не вдалося видалити книгу');
      }

      setBooks(previous => previous.filter(book => book.id !== id));
      if (editingId === id) resetForm();
      setSuccess('Книгу видалено ✓');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка видалення');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="mybooks-page">
      <p className="mybooks-eyebrow">Особиста бібліотека</p>
      <h1>Мої книги</h1>
      <p className="mybooks-subtitle">
        Ділися історіями, обмінюйся книгами та даруй їм нове життя.
      </p>

      <section className="mybooks-panel">
        <h2>{editingId ? 'Редагувати книгу' : 'Додати книгу'}</h2>

        <form onSubmit={saveBook} className="mybooks-form">
          <label htmlFor="book-title">Назва книги</label>
          <input id="book-title" value={title} onChange={e => setTitle(e.target.value)}
            maxLength={200} required placeholder="Наприклад, Маленький принц" />

          <label htmlFor="book-author">Автор</label>
          <input id="book-author" value={author} onChange={e => setAuthor(e.target.value)}
            maxLength={150} required placeholder="Антуан де Сент-Екзюпері" />

          <label htmlFor="book-description">Опис</label>
          <textarea id="book-description" value={description}
            onChange={e => setDescription(e.target.value)} maxLength={2000}
            placeholder="Коротко розкажи про книгу..." />

          <label htmlFor="book-condition">Стан книги</label>
          <select id="book-condition" value={condition}
            onChange={e => setCondition(e.target.value as Book['condition'])}>
            <option value="new">Нова</option>
            <option value="good">Хороший стан</option>
            <option value="fair">Задовільний стан</option>
          </select>

          <label htmlFor="book-type">Тип оголошення</label>
          <select id="book-type" value={listingType}
            onChange={e => setListingType(e.target.value as Book['listingType'])}>
            <option value="exchange">Обміняти</option>
            <option value="gift">Віддати безкоштовно</option>
          </select>

          <label htmlFor="book-cover">Обкладинка книги (необов'язково)</label>
          <input id="book-cover" ref={coverInputRef} type="file"
            accept="image/jpeg,image/png,image/webp" onChange={selectFormCover} />
          <p className="mybooks-hint">
            JPG, PNG або WebP до 5 МБ. {editingId ? 'Якщо не вибрати файл, попередня обкладинка залишиться.' : 'Можна додати обкладинку пізніше.'}
          </p>

          <div className="mybooks-actions">
            <button type="submit" disabled={saving}>
              {saving ? 'Збереження...' : editingId ? 'Зберегти зміни' : '+ Додати книгу'}
            </button>
            {editingId && (
              <button type="button" className="mybooks-cancel" onClick={cancelEdit} disabled={saving}>
                Скасувати
              </button>
            )}
          </div>
        </form>
      </section>

      {error && <p className="mybooks-error" role="alert">{error}</p>}
      {success && <p className="mybooks-success" role="status">{success}</p>}

      <section className="mybooks-library">
        <h2>Моя бібліотека</h2>
        {loading ? (
          <p>Завантаження книг...</p>
        ) : books.length === 0 ? (
          <div className="mybooks-empty">
            <span aria-hidden="true">📚</span>
            <h3>Тут поки немає книг</h3>
            <p>Додай свою першу книгу для обміну або подарунка.</p>
          </div>
        ) : (
          <div className="mybooks-grid">
            {books.map(book => (
              <article className="mybooks-card" key={book.id}>
                <div className="mybooks-cover">
                  {book.coverUrl ? (
                    <img className="mybooks-cover-image"
                      src={book.coverUrl.startsWith('https://') ? book.coverUrl : `${API}${book.coverUrl}`} alt={`Обкладинка книги «${book.title}»`} />
                  ) : (
                    <span aria-hidden="true">📖</span>
                  )}
                </div>

                <div className="mybooks-card-content">
                  <h3>{book.title}</h3>
                  <p className="mybooks-author">{book.author}</p>
                  <p className="mybooks-description">{book.description}</p>

                  <div className="mybooks-tags">
                    <span className="mybooks-tag">
                      {book.listingType === 'exchange' ? 'Обмін' : 'Безкоштовно'}
                    </span>
                    <span className="mybooks-tag">
                      {book.condition === 'new' ? 'Нова'
                        : book.condition === 'good' ? 'Хороший стан' : 'Задовільний стан'}
                    </span>
                  </div>

                  <div className="mybooks-card-actions">
                    <button type="button" className="mybooks-edit"
                      onClick={() => startEdit(book)} disabled={saving || deletingId === book.id}>
                      ✎ Редагувати
                    </button>
                    <button type="button" className="mybooks-delete"
                      onClick={() => void deleteBook(book.id)} disabled={deletingId === book.id}>
                      {deletingId === book.id ? 'Видалення...' : 'Видалити'}
                    </button>
                  </div>
                </div>

                <div className="mybooks-upload">
                  <label htmlFor={`cover-${book.id}`}>
                    {book.coverUrl ? 'Замінити обкладинку' : 'Додати обкладинку'}
                  </label>
                  <input id={`cover-${book.id}`} type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={uploadingId === book.id || deletingId === book.id}
                    onChange={e => {
                      const file = e.currentTarget.files?.[0];
                      e.currentTarget.value = '';
                      if (file) void uploadCover(book.id, file);
                    }} />
                  {uploadingId === book.id && <p role="status">Завантаження...</p>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
