import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db, initDatabase } from './database.js';
import pg from 'pg';

vi.mock('pg', () => {
  const mockPoolLocal = {
    query: vi.fn(),
    connect: vi.fn(),
    on: vi.fn(),
    end: vi.fn(),
  };
  return {
    default: {
      Pool: vi.fn().mockImplementation(() => mockPoolLocal)
    },
    Pool: vi.fn().mockImplementation(() => mockPoolLocal)
  };
});

vi.mock('../config.js', () => ({
  config: {
    db: {
      host: 'localhost',
      port: 5432,
      name: 'port_test',
      user: 'test',
      password: '***',
    },
  },
}));

describe('database service', () => {
  let mockPoolInstance: any;

  beforeEach(() => {
    vi.clearAllMocks();
    // Safely fetch mocked pool
    const poolConstructor = pg.Pool as any;
    mockPoolInstance = poolConstructor.mock.results[0]?.value || poolConstructor();
  });

  describe('db.query', () => {
    it('should execute query with parameters', async () => {
      const mockResult = { rows: [{ id: '1', name: 'test' }], rowCount: 1 };
      mockPoolInstance.query.mockResolvedValue(mockResult);

      const result = await db.query('SELECT * FROM sites WHERE id = $1', ['site-1']);

      expect(mockPoolInstance.query).toHaveBeenCalledWith('SELECT * FROM sites WHERE id = $1', ['site-1']);
      expect(result).toEqual(mockResult);
    });

    it('should execute query without parameters', async () => {
      const mockResult = { rows: [], rowCount: 0 };
      mockPoolInstance.query.mockResolvedValue(mockResult);

      const result = await db.query('SELECT 1');

      expect(mockPoolInstance.query).toHaveBeenCalledWith('SELECT 1', undefined);
      expect(result).toEqual(mockResult);
    });

    it('should propagate errors', async () => {
      mockPoolInstance.query.mockRejectedValue(new Error('Connection failed'));

      await expect(db.query('SELECT 1')).rejects.toThrow('Connection failed');
    });
  });

  describe('db.getClient', () => {
    it('should return a client from pool', async () => {
      const mockClient = { query: vi.fn(), release: vi.fn() };
      mockPoolInstance.connect.mockResolvedValue(mockClient);

      const client = await db.getClient();

      expect(mockPoolInstance.connect).toHaveBeenCalled();
      expect(client).toBe(mockClient);
    });
  });

  describe('initDatabase', () => {
    it('should create port schema tables', async () => {
      mockPoolInstance.query.mockResolvedValue({ rows: [] });

      await initDatabase();

      expect(mockPoolInstance.query).toHaveBeenCalledTimes(2);
      
      const firstCall = mockPoolInstance.query.mock.calls[0][0];
      expect(firstCall).toContain('CREATE TABLE IF NOT EXISTS port.sites');
      expect(firstCall).toContain('CREATE TABLE IF NOT EXISTS port.users');
      
      const secondCall = mockPoolInstance.query.mock.calls[1][0];
      expect(secondCall).toContain('config_public');
      expect(secondCall).toContain('config_private');
    });

    it('should handle errors gracefully', async () => {
      mockPoolInstance.query.mockRejectedValue(new Error('DB error'));

      await expect(initDatabase()).rejects.toThrow('DB error');
    });
  });
});