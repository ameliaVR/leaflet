import {pool} from './db.js';
await pool.query(`CREATE TABLE IF NOT EXISTS users (
 id uuid PRIMARY KEY, email text NOT NULL UNIQUE, password_hash text NOT NULL,
 full_name text NOT NULL, city text NOT NULL DEFAULT '', about text NOT NULL DEFAULT '',
 contact text NOT NULL DEFAULT '', show_contact boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions(expires_at);`);
console.log('Leaflet database ready');await pool.end();
