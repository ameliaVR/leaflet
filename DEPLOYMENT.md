# Leaflet — deployment on Render + Neon + Cloudinary

The React app and Express API run on **the same HTTPS origin** on Render. PostgreSQL is hosted by Neon, and book-cover images are stored in Cloudinary. The local development setup still works.

## 1. Create an external PostgreSQL database (Neon)

1. Open https://neon.tech and create a Neon project.
2. Copy the full **PostgreSQL connection string**. Use the version supplied by Neon, including SSL settings.
3. Keep it secret. Do not commit it to GitHub or paste it into public messages.
4. New online databases start empty. This deployment creates users, sessions and book_listings tables automatically when the web service starts. It **does not migrate** existing local users/books. To migrate them, use a separate controlled PostgreSQL backup/restore procedure.

## 2. Create persistent book-image storage (Cloudinary)

1. Open https://cloudinary.com and create an account.
2. Locate your **Cloud name**, **API Key**, and **API Secret** in the Cloudinary console.
3. Keep the API Secret private; it must go into Render environment variables only.
4. Uploads are authenticated server-side; the browser never receives Cloudinary credentials.
5. Already-uploaded local images are not automatically moved. They will need manual re-upload or migration for existing records.

## 3. Deploy a Render Blueprint

1. Sign in at https://dashboard.render.com and connect GitHub.
2. Choose **New > Blueprint**, select the repository `ameliaVR/leaflet` and the branch containing these deployment changes (or `main` after merging).
3. Render reads `render.yaml` and creates one Node web service.
4. Enter all requested secret values:
   - `DATABASE_URL`: the Neon PostgreSQL connection string.
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
5. Wait for build and start logs to complete. The Render URL will look like `https://leaflet-web-....onrender.com` (use the actual URL Render gives you).
6. `/api/health` should return `{"ok":true}`.
7. Test registration, logout/login, two accounts, profile privacy, add/edit/delete books and cover uploads.

`APP_ORIGIN` is inferred from Render's `RENDER_EXTERNAL_HOSTNAME` for the default Render domain. **If you later add a custom domain**, set `APP_ORIGIN=https://your-real-domain`, redeploy, and ensure the full site/API use that same domain. Use one canonical domain, since auth cookies are host-scoped. No frontend API address is needed; production requests are relative, such as `/api/books`.

The backend requires production `APP_ORIGIN` (or Render hostname), Cloudinary credentials, and `DATABASE_URL`. On Render, `NODE_ENV=production`, cookies are HttpOnly/Secure/SameSite=Lax, and mutating API requests must carry the expected same-origin `Origin` header.

## Local development

Run the old commands from separate terminals:

```powershell
cd C:\Users\User\leaflet\server
node --env-file=.env src/init.js
node --env-file=.env --watch src/index.js
```

```powershell
cd C:\Users\User\leaflet\client
npm.cmd install
npm.cmd run dev
```

Vite proxies `/api` and `/uploads` to local Express; use http://127.0.0.1:5173.

## Important before opening to the public

- Review your legal/privacy disclosures and data retention, contact visibility, moderation/reporting and abuse prevention.
- Add password reset, email confirmation, improved signup abuse controls, security headers and backup/restore testing.
- Monitor database, Cloudinary and Render usage/limits. Free plans may sleep, change limits, or require payment later.
- No production site is created automatically by committing these files; Neon, Cloudinary and Render require account setup.
- Keep all credentials in Render's environment settings. Never expose them through `VITE_` variables.
