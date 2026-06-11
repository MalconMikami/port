import { Command } from 'commander';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, basename } from 'path';
import AdmZip from 'adm-zip';
import { getConfig } from '../utils/config.js';

export const deployCommand = new Command('deploy')
  .description('Deploy a site folder or ZIP to Port')
  .argument('[path]', 'Path to folder or ZIP file', '.')
  .option('-s, --site <name>', 'Site name (overrides auto-detect)')
  .action(async (targetPath, options) => {
    const config = getConfig();
    const resolvedPath = join(process.cwd(), targetPath);

    console.log(`🚢 Deploying from: ${resolvedPath}`);

    // Determine site name
    let siteName = options.site;
    if (!siteName) {
      siteName = basename(resolvedPath);
    }
    siteName = siteName.toLowerCase().replace(/[^a-z0-9-]/g, '-');

    if (!/^[a-z0-9-]{3,30}$/.test(siteName)) {
      console.error(`❌ Invalid site name: "${siteName}". Use 3-30 chars, a-z, 0-9, hyphens.`);
      process.exit(1);
    }

    // Create ZIP from folder or use existing ZIP
    let zipBuffer: Buffer;
    if (resolvedPath.endsWith('.zip')) {
      zipBuffer = readFileSync(resolvedPath);
    } else {
      console.log('📦 Creating ZIP...');
      const zip = new AdmZip();
      addFolderToZip(zip, resolvedPath, resolvedPath);
      zipBuffer = zip.toBuffer();
    }

    // Upload
    console.log('📤 Uploading...');
    try {
      const formData = new FormData();
      formData.append('siteName', siteName);
      const blob = new Blob([zipBuffer.buffer as ArrayBuffer], { type: 'application/zip' });
  formData.append('zipFile', blob, `${siteName}.zip`);

      const res = await fetch(`${config.apiUrl}/api/sites`, {
        method: 'POST',
        body: formData,
        headers: config.token ? { 'Authorization': `Bearer ${config.token}` } : {},
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err);
      }

      const data = await res.json() as any;
      console.log(`✅ Deployed! Live at: ${data.url}`);
    } catch (err) {
      console.error(`❌ Deploy failed: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

function addFolderToZip(zip: AdmZip, basePath: string, currentPath: string): void {
  const entries = readdirSync(currentPath);
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === '.git' || entry.startsWith('.')) continue;
    const fullPath = join(currentPath, entry);
    const relPath = relative(basePath, fullPath);
    if (statSync(fullPath).isDirectory()) {
      addFolderToZip(zip, basePath, fullPath);
    } else {
      zip.addLocalFile(fullPath, relPath.replace(/\\/g, '/').replace(/\/[^/]+$/, ''));
    }
  }
}
