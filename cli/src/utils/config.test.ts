import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getConfig, saveConfig } from '../utils/config.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const TEST_CONFIG_DIR = join(homedir(), '.config', 'port-test');
const TEST_CONFIG_FILE = join(TEST_CONFIG_DIR, 'config.json');

vi.mock('os', () => ({
  homedir: () => '/mock/home',
}));

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  rmSync: vi.fn(),
}));

vi.mock('../utils/config.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    CONFIG_DIR: TEST_CONFIG_DIR,
    CONFIG_FILE: TEST_CONFIG_FILE,
  };
});

describe('config utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(existsSync).mockReturnValue(false);
  });

  describe('getConfig', () => {
    it('should return default config when no file exists', () => {
      process.env.PORT_API_URL = 'http://custom:3000';
      process.env.PORT_DOMAIN = 'custom.domain';

      const config = getConfig();

      expect(config).toEqual({
        apiUrl: 'http://custom:3000',
        domain: 'custom.domain',
      });
    });

    it('should return saved config when file exists', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        apiUrl: 'http://saved:4000',
        domain: 'saved.domain',
        token: 'saved-token',
      }));

      const config = getConfig();

      expect(config).toEqual({
        apiUrl: 'http://saved:4000',
        domain: 'saved.domain',
        token: 'saved-token',
      });
    });

    it('should handle malformed config file gracefully', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('invalid json');

      const config = getConfig();

      expect(config.apiUrl).toBe('http://localhost:3000');
      expect(config.domain).toBe('xp.inc');
    });
  });

  describe('saveConfig', () => {
    it('should create config directory and write file', () => {
      vi.mocked(existsSync).mockReturnValue(false);

      saveConfig({ apiUrl: 'http://test:3000', domain: 'test.com', token: 'test-token' });

      expect(mkdirSync).toHaveBeenCalledWith(TEST_CONFIG_DIR, { recursive: true });
      expect(writeFileSync).toHaveBeenCalledWith(
        TEST_CONFIG_FILE,
        JSON.stringify({ apiUrl: 'http://test:3000', domain: 'test.com', token: 'test-token' }, null, 2)
      );
    });

    it('should not recreate directory if it exists', () => {
      vi.mocked(existsSync).mockReturnValue(true);

      saveConfig({ apiUrl: 'http://test:3000', domain: 'test.com' });

      expect(mkdirSync).not.toHaveBeenCalled();
      expect(writeFileSync).toHaveBeenCalled();
    });
  });
});