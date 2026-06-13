import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';

vi.mock('../services/database.js', () => ({
  db: {
    query: vi.fn(),
    getClient: vi.fn(),
  },
  initDatabase: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../services/function-runner.js', () => ({
  functionRunner: {
    call: vi.fn(),
    activeCount: 0,
  },
}));

vi.mock('../middleware/auth.js', () => ({
  authMiddleware: async (req: any, _reply: any) => {
    req.user = { id: 'test-user-id', email: 'user@example.com' };
  },
}));

vi.mock('../middleware/site-context.js', () => ({
  siteContextMiddleware: async (req: any, _reply: any) => {
    req.siteContext = { type: 'site', siteDir: '/tmp/site', siteId: 'test-site' };
  },
}));

// Load app AFTER mocks
const { app } = await import('../main.js');

describe('DB Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/db/:collection/create', () => {
    it('should create a document in the schema', async () => {
      const newDoc = { id: 'new-1', collection: 'todos', data: { title: 'New' }, created_by: 'user@example.com' };
      const { db } = await import('../services/database.js');
      vi.mocked(db.query).mockResolvedValue({ rows: [newDoc] } as any);

      const response = await request(app.server)
        .post('/api/db/todos/create')
        .send({ title: 'New' })
        .expect(200);

      expect(response.body).toEqual(newDoc);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO site_test_site.documents'),
        ['todos', JSON.stringify({ title: 'New' }), 'user@example.com']
      );
    });
  });

  describe('POST /api/db/:collection/list', () => {
    it('should list documents in the collection', async () => {
      const mockDocs = [
        { id: '1', collection: 'todos', data: { title: 'Test' }, created_by: 'user@example.com' },
      ];
      const { db } = await import('../services/database.js');
      vi.mocked(db.query).mockResolvedValue({ rows: mockDocs } as any);

      const response = await request(app.server)
        .post('/api/db/todos/list')
        .send({})
        .expect(200);

      expect(response.body).toEqual(mockDocs);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM site_test_site.documents'),
        ['todos']
      );
    });
  });

  describe('POST /api/db/:collection/update', () => {
    it('should update documents in the collection', async () => {
      const updatedDoc = { id: '1', collection: 'todos', data: { title: 'Updated' }, created_by: 'user@example.com' };
      const { db } = await import('../services/database.js');
      vi.mocked(db.query).mockResolvedValue({ rows: [updatedDoc] } as any);

      const response = await request(app.server)
        .post('/api/db/todos/update')
        .send({ id: '1', title: 'Updated' })
        .expect(200);

      expect(response.body).toEqual(updatedDoc);
    });

    it('should return 404 when document not found', async () => {
      const { db } = await import('../services/database.js');
      vi.mocked(db.query).mockResolvedValue({ rows: [] } as any);

      await request(app.server)
        .post('/api/db/todos/update')
        .send({ id: 'non-existent', title: 'Updated' })
        .expect(404);
    });
  });

  describe('POST /api/db/:collection/delete', () => {
    it('should delete his own document successfully', async () => {
      const { db } = await import('../services/database.js');
      vi.mocked(db.query).mockResolvedValue({ rows: [{ id: '1' }] } as any);

      const response = await request(app.server)
        .post('/api/db/todos/delete')
        .send({ id: '1' })
        .expect(200);

      expect(response.body).toEqual({ success: true, id: '1' });
    });
  });
});