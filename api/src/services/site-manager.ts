import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { config } from '../config.js';
import { db } from './database.js';
import { functionRunner } from './function-runner.js';

export const siteManager = {
  /** Create a new site from uploaded ZIP */
  async deploy(siteId: string, zipBuffer: Buffer, userId?: string) {
    // Validate site name (a-z, 0-9, hyphens, 3-30 chars)
    if (!/^[a-z0-9-]{3,30}$/.test(siteId)) {
      throw new Error('Invalid site name. Use 3-30 chars, a-z, 0-9, hyphens.');
    }

    const siteDir = path.join(config.storage.sitesDir, siteId);

    // Extract ZIP
    const zip = new AdmZip(zipBuffer);

    // Validate has index.html
    if (!zip.getEntry('index.html')) {
      throw new Error('ZIP must contain an index.html file at root.');
    }

    // Remove existing site files if any
    if (fs.existsSync(siteDir)) {
      fs.rmSync(siteDir, { recursive: true });
    }

    // Extract all files
    fs.mkdirSync(siteDir, { recursive: true });
    zip.extractAllTo(siteDir, true);

    // Create PostgreSQL schema for the site
    try {
      await db.query(`CREATE SCHEMA IF NOT EXISTS ${sanitizeSchema(siteId)}`);

      await db.query(`
        CREATE TABLE IF NOT EXISTS ${sanitizeSchema(siteId)}.documents (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          collection VARCHAR(100) NOT NULL,
          data JSONB NOT NULL DEFAULT '{}',
          created_by VARCHAR(255),
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);

      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_${sanitizeSchema(siteId)}_collection 
        ON ${sanitizeSchema(siteId)}.documents(collection)
      `);
    } catch (err) {
      console.error(`Failed to create schema for ${siteId}:`, err);
    }

    // Register site in port schema
    await db.query(`
      INSERT INTO port.sites (id, name, created_by, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (id) DO UPDATE SET 
        name = $2, updated_at = NOW()
    `, [siteId, siteId, userId]);

    // Start worker if site has functions/
    if (functionRunner.hasFunctions(siteDir)) {
      functionRunner.start(siteId, siteDir);
    }

    return {
      id: siteId,
      url: `${config.baseUrl.replace('://', `://${siteId}.`)}`,
      path: siteDir,
    };
  },

  /** List all sites */
  async list() {
    const result = await db.query(
      'SELECT id, name, created_by, created_at, updated_at FROM port.sites ORDER BY updated_at DESC'
    );
    return result.rows;
  },

  /** Delete a site */
  async delete(siteId: string) {
    const siteDir = path.join(config.storage.sitesDir, siteId);

    // Stop worker if active
    functionRunner.stop(siteId);

    // Remove files
    if (fs.existsSync(siteDir)) {
      fs.rmSync(siteDir, { recursive: true });
    }

    // Drop PostgreSQL schema
    try {
      await db.query(`DROP SCHEMA IF EXISTS ${sanitizeSchema(siteId)} CASCADE`);
    } catch (err) {
      console.error(`Failed to drop schema for ${siteId}:`, err);
    }

    // Remove from registry
    await db.query('DELETE FROM port.sites WHERE id = $1', [siteId]);
  },
};

function sanitizeSchema(name: string): string {
  // Prevent SQL injection — only allow alphanumeric + underscore
  return 'site_' + name.replace(/[^a-zA-Z0-9_]/g, '_');
}
