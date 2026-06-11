import pg from 'pg';
import { config } from '../config.js';

const pool = new pg.Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.name,
  user: config.db.user,
  password: config.db.password,
  max: 20,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

export const db = {
  query: (text: string, params?: any[]) => pool.query(text, params),
  getClient: () => pool.connect(),
};

// Initialize: create port schema and global tables
export async function initDatabase() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS port.sites (
      id VARCHAR(100) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      created_by VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      config_public JSONB DEFAULT '{}',
      config_private JSONB DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS port.users (
      id VARCHAR(255) PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(255),
      avatar_url TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // Migration: add config columns if missing (existing databases)
  await db.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'port' AND table_name = 'sites' AND column_name = 'config_public'
      ) THEN
        ALTER TABLE port.sites ADD COLUMN config_public JSONB DEFAULT '{}';
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'port' AND table_name = 'sites' AND column_name = 'config_private'
      ) THEN
        ALTER TABLE port.sites ADD COLUMN config_private JSONB DEFAULT '{}';
      END IF;
    END $$;
  `);

  console.log('📦 Database initialized');
}
