import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiRequest } from '../utils/api.js';
import { getConfig } from '../utils/config.js';

vi.mock('../utils/config.js', () => ({
  getConfig: vi.fn(),
}));

vi.mock('fetch', () => ({
  default: vi.fn(),
}));

describe('api utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getConfig).mockReturnValue({
      apiUrl: 'http://localhost:3000',
      domain: 'localhost',
      token: 'test-token',
    });
  });

  describe('apiRequest', () => {
    it('should make GET request with auth header', async () => {
      const mockResponse = { ok: true, json: vi.fn().mockResolvedValue({ data: 'test' }), text: vi.fn().mockResolvedValue('') };
      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const result = await apiRequest('/api/sites');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/sites',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );
      expect(result).toEqual({ data: 'test' });
    });

    it('should make POST request with body', async () => {
      const mockResponse = { ok: true, json: vi.fn().mockResolvedValue({ id: '1' }), text: vi.fn().mockResolvedValue('') };
      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const result = await apiRequest('/api/sites', {
        method: 'POST',
        body: JSON.stringify({ name: 'test' }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/sites',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'test' }),
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
            'Content-Type': 'application/json',
          }),
        })
      );
      expect(result).toEqual({ id: '1' });
    });

    it('should throw on non-ok response', async () => {
      const mockResponse = { ok: false, status: 404, text: vi.fn().mockResolvedValue('Not found') };
      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      await expect(apiRequest('/api/sites/nonexistent')).rejects.toThrow('API 404: Not found');
    });

    it('should work without token', async () => {
      vi.mocked(getConfig).mockReturnValue({
        apiUrl: 'http://localhost:3000',
        domain: 'localhost',
      });

      const mockResponse = { ok: true, json: vi.fn().mockResolvedValue({ public: true }), text: vi.fn().mockResolvedValue('') };
      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      await apiRequest('/api/health');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/health',
        expect.objectContaining({
          headers: expect.not.objectContaining({
            Authorization: expect.any(String),
          }),
        })
      );
    });
  });
});