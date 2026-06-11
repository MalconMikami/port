-- Port platform init
CREATE SCHEMA IF NOT EXISTS port;

CREATE TABLE IF NOT EXISTS port.users (
  id VARCHAR(255) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS port.sites (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_by VARCHAR(255) REFERENCES port.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  config_public JSONB DEFAULT '{}',
  config_private JSONB DEFAULT '{}'
);
