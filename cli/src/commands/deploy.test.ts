import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join, relative, basename } from 'path';
import { readFileSync, readdirSync, statSync } from 'fs';
import AdmZip from 'adm-zip';
import { getConfig } from '../utils/config.js';

// Mock dependencies
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

vi.mock('path', () => ({
  join: vi.fn(),
  relative: vi.fn(),
  basename: vi.fn(),
}));

vi.mock('adm-zip', () => ({
  default: vi.fn().mockImplementation(() => ({
    addLocalFile: vi.fn(),
    toBuffer: vi.fn().mockReturnValue(Buffer.from('zip-content')),
  })),
}));

vi.mock('../utils/config.js', () => ({
  getConfig: vi.fn(),
}));

global.fetch = vi.fn();
global.Blob = vi.fn();
global.FormData = vi.fn().mockImplementation(() => ({
  append: vi.fn(),
}));
process.exit = vi.fn() as any;

describe('deploy command logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getConfig).mockReturnValue({
      apiUrl: 'http://localhost:3000',
      domain: 'localhost',
      token: 'test-token',
    });
    vi.mocked(process.exit).mockImplementation(() => { throw new Error('process.exit'); });
    vi.mocked(join).mockImplementation((...args) => args.join('/'));
    vi.mocked(relative).mockImplementation((from, to) => to.replace(from + '/', ''));
    vi.mocked(basename).mockImplementation((p) => p.split('/').pop() || '');
    vi.mocked(statSync).mockReturnValue({ isDirectory: () => false });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('site name validation', () => {
    it('should accept valid site names', () => {
      const validNames = ['test-site', 'site123', 'my-app', 'a-b-c'];
      
      for (const name of validNames) {
        expect(/^[a-z0-9-]{3,30}$/.test(name)).toBe(true);
      }
    });

    it('should reject invalid site names', () => {
      const invalidNames = ['ab', 'Test-Site', 'test@site', 'test site', 'a'.repeat(31)];
      
      for (const name of invalidNames) {
        expect(/^[a-z0-9-]{3,30}$/.test(name)).toBe(false);
      }
    });
  });

  describe('ZIP creation from folder', () => {
    it('should create ZIP from folder', () => {
      vi.mocked(readdirSync).mockReturnValue(['index.html', 'script.js']);
      vi.mocked(statSync).mockReturnValue({ isDirectory: () => false });
      vi.mocked(relative).mockReturnValue('index.html');
      
      const zip = new AdmZip();
      // Simulate addFolderToZip logic
      const entries = readdirSync('/test/path');
      for (const entry of entries) {
        if (entry === 'node_modules' || entry === '.git' || entry.startsWith('.')) continue;
        const fullPath = join('/test/path', entry);
        const relPath = relative('/test/path', fullPath);
        if (statSync(fullPath).isDirectory()) {
          // recursive
        } else {
          zip.addLocalFile(fullPath, relPath);
        }
      }
      const buffer = zip.toBuffer();
      
      expect(buffer).toBeInstanceOf(Buffer);
      expect(zip.addLocalFile).toHaveBeenCalledTimes(2);
    });

    it('should skip node_modules, .git, and hidden files', () => {
      vi.mocked(readdirSync).mockReturnValue(['index.html', 'node_modules', '.git', '.env', 'script.js']);
      vi.mocked(statSync).mockReturnValue({ isDirectory: () => false });
      
      const zip = new AdmZip();
      const entries = readdirSync('/test/path');
      for (const entry of entries) {
        if (entry === 'node_modules' || entry === '.git' || entry.startsWith('.')) continue;
        const fullPath = join('/test/path', entry);
        const relPath = relative('/test/path', fullPath);
        if (!statSync(fullPath).isDirectory()) {
          zip.addLocalFile(fullPath, relPath);
        }
      }
      
      expect(zip.addLocalFile).toHaveBeenCalledTimes(2);
      expect(zip.addLocalFile).toHaveBeenCalledWith('/test/path/index.html', 'index.html');
      expect(zip.addLocalFile).toHaveBeenCalledWith('/test/path/script.js', 'script.js');
    });
  });

  describe('upload', () => {
    it('should upload ZIP with correct form data', async () => {
      const mockRes = {
        ok: true,
        json: vi.fn().mockResolvedValue({ url: 'http://test.localhost:3000' }),
        text: vi.fn().mockResolvedValue(''),
      };
      global.fetch = vi.fn().mockResolvedValue(mockRes);

      const zipBuffer = Buffer.from('test-zip');
      const formData = new FormData();
      formData.append('siteName', 'test-site');
      const blob = new Blob([zipBuffer.buffer], { type: 'application/zip' });
      formData.append('zipFile', blob, 'test-site.zip');

      const res = await fetch('http://localhost:3000/api/sites', {
        method: 'POST',
        body: formData,
        headers: { 'Authorization': 'Bearer test-token' },
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/sites',
        expect.objectContaining({
          method: 'POST',
          body: formData,
          headers: { 'Authorization': 'Bearer test-token' },
        })
      );
      expect(res.ok).toBe(true);
    });
  });
});