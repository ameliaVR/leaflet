import { pool } from './db.js';

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY,
      email text NOT NULL UNIQUE,
      password_hash text NOT NULL,
      full_name text NOT NULL,
      city text NOT NULL DEFAULT '',
      about text NOT NULL DEFAULT '',
      contact text NOT NULL DEFAULT '',
      show_contact boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash text PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at timestamptz NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions(expires_at);
    CREATE TABLE IF NOT EXISTS book_listings (
      id uuid PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title text NOT NULL,
      author text NOT NULL,
      description text NOT NULL DEFAULT '',
      book_condition text NOT NULL DEFAULT 'good'
        CHECK (book_condition IN ('new', 'good', 'fair')),
      listing_type text NOT NULL DEFAULT 'exchange'
        CHECK (listing_type IN ('exchange', 'gift')),
      status text NOT NULL DEFAULT 'available'
        CHECK (status IN ('available', 'reserved', 'completed')),
      cover_url text,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS book_listings_user_idx ON book_listings(user_id);
    CREATE INDEX IF NOT EXISTS book_listings_available_idx ON book_listings(created_at DESC)
      WHERE status = 'available';
  `);
  console.log('Leaflet database ready');
} finally {
  await pool.end();
}
