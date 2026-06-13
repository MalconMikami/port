import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { siteManager } from '../services/site-manager.js';

// Host setup and Fastify loading need to avoid trigger DB calls
vi.mock('../services/database.js', () => ({
  db: {
    query: vi.fn(),
    getClient: vi.fn(),
  },
  initDatabase: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../services/site-manager.js', () => ({
  siteManager: {
    list: vi.fn(),
    deploy: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../services/function-runner.js', () => ({
  functionRunner: {
    hasFunctions: vi.fn().mockReturnValue(false),
    start: vi.fn(),
    stop: vi.fn(),
    call: vi.fn(),
    activeCount: 0,
    stopAll: vi.fn(),
  },
}));

vi.mock('../middleware/auth.js', () => ({
  authMiddleware: async (req: any, _reply: any) => {
    req.user = { id: 'test-user-id' };
  },
}));

vi.mock('../middleware/site-context.js', () => ({
  siteContextMiddleware: async (req: any, _reply: any) => {
    req.siteContext = { type: 'admin' };
  },
}));

// Load app AFTER mocks
const { app } = await import('../main.js');

describe('API Routes Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const response = await request(app.server)
        .get('/api/health')
        .expect(200);

      expect(response.body).toEqual({
        status: 'ok',
        version: '1.0.0',
      });
    });
  });

  describe('GET /api/sites', () => {
    it('should return list of sites', async () => {
      const mockSites = [
        { id: 'site-1', name: 'Site 1', created_by: 'user-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: 'site-2', name: 'Site 2', created_by: 'user-2', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      ];
      vi.mocked(siteManager.list).mockResolvedValue(mockSites);

      const response = await request(app.server)
        .get('/api/sites')
        .expect(200);

      expect(response.body).toEqual(mockSites);
      expect(siteManager.list).toHaveBeenCalled();
    });

    it('should return empty array when no sites', async () => {
      vi.mocked(siteManager.list).mockResolvedValue([]);

      const response = await request(app.server)
        .get('/api/sites')
        .expect(200);

      expect(response.body).toEqual([]);
    });
  });

  describe('POST /api/sites', () => {
    it('should deploy a new site', async () => {
      const mockResult = {
        id: 'new-site',
        url: 'http://new-site.localhost:3000',
        path: '/tmp/port-sites/new-site',
      };
      vi.mocked(siteManager.deploy).mockResolvedValue(mockResult);

      const zipBuffer = Buffer.from('fake-zip-content');
      
      const response = await request(app.server)
        .post('/api/sites')
        .attach('file', zipBuffer, 'new-site.zip')
        .expect(201);

      expect(response.body).toEqual(mockResult);
      expect(siteManager.deploy).toHaveBeenCalledWith(
        'new-site',
        expect.any(Buffer),
        'test-user-id'
      );
    });

    it('should use filename as site name when not provided', async () => {
      const mockResult = { id: 'test', url: 'http://test.localhost:3000', path: '/tmp/test' };
      vi.mocked(siteManager.deploy).mockResolvedValue(mockResult);

      const zipBuffer = Buffer.from('fake-zip-content');
      
      const response = await request(app.server)
        .post('/api/sites')
        .attach('file', zipBuffer, 'my-site.zip')
        .expect(201);

      expect(siteManager.deploy).toHaveBeenCalledWith(
        'my-site',
        expect.any(Buffer),
        'test-user-id'
      );
    });

    it('should return 400 when no file uploaded', async () => {
      const response = await request(app.server)
        .post('/api/sites')
        .expect(400);

      expect(response.body).toEqual({ error: 'the request is not multipart' });
    });

    it('should return 400 when site name is invalid', async () => {
      vi.mocked(siteManager.deploy).mockRejectedValue(new Error('Invalid site name'));

      const zipBuffer = Buffer.from('fake-zip-content');
      
      const response = await request(app.server)
        .post('/api/sites')
        .attach('file', zipBuffer, 'invalid@name.zip')
        .expect(400);

      expect(response.body).toEqual({ error: 'Invalid site name' });
    });
  });

  describe('DELETE /api/sites/:name', () => {
    it('should delete a site', async () => {
      vi.mocked(siteManager.delete).mockResolvedValue(undefined);

      const response = await request(app.server)
        .delete('/api/sites/test-site')
        .expect(200);

      expect(response.body).toEqual({ success: true });
      expect(siteManager.delete).toHaveBeenCalledWith('test-site');
    });

    it('should return 500 on error', async () => {
      vi.mocked(siteManager.delete).mockRejectedValue(new Error('Database error'));

      const response = await request(app.server)
        .delete('/api/sites/test-site')
        .expect(500);

      expect(response.body).toEqual({ error: 'Database error' });
    });
  });
});