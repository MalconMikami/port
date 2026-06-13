import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import './port.js'; // This defines window.port

describe('Port Client SDK', () => {
  let port;

  beforeEach(() => {
    vi.restoreAllMocks();
    port = window.port;
    port.baseUrl = 'http://localhost:3000';
    port._user = null;
    port._ws = null;
    port._subscriptions.clear();

    // Mock global fetch and WebSocket
    global.fetch = vi.fn();
    
    // Mock WebSocket class
    global.WebSocket = vi.fn().mockImplementation(() => ({
      send: vi.fn(),
      close: vi.fn(),
      readyState: 1, // WebSocket.OPEN
    }));
    
    // Clean up window properties
    window.location = {
      origin: 'http://localhost:3000',
      protocol: 'http:',
      host: 'localhost:3000',
    };
  });

  describe('Initialization', () => {
    it('should initialize with correct default properties', () => {
      expect(port.baseUrl).toBe('http://localhost:3000');
      expect(port._user).toBeNull();
      expect(port.functions).toBeDefined();
    });
  });

  describe('Functions RPC Proxy', () => {
    it('should construct API endpoints nested under arbitrary namespaces', async () => {
      const mockResponse = { ok: true, json: vi.fn().mockResolvedValue({ success: true, computed: 42 }) };
      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      // Call port.functions.calculator.add({ a: 10, b: 32 })
      const result = await port.functions.calculator.add({ a: 10, b: 32 });

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/rpc/calculator/add',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ a: 10, b: 32 }),
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
      expect(result).toEqual({ success: true, computed: 42 });
    });

    it('should wrap legacy linear arguments as { _args: [] }', async () => {
      const mockResponse = { ok: true, json: vi.fn().mockResolvedValue({ done: true }) };
      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      await port.functions.logger.log('hello', 'world');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/rpc/logger/log',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ _args: ['hello', 'world'] }),
        })
      );
    });
  });

  describe('Database API Client', () => {
    it('should create document in collection', async () => {
      const mockResponse = { ok: true, json: vi.fn().mockResolvedValue({ id: 'doc-uuid-1', status: 'created' }) };
      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const itemsCollection = port.db.collection('items');
      const result = await itemsCollection.create({ name: 'Shield', defense: 15 });

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/db/items/create',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'Shield', defense: 15 }),
        })
      );
      expect(result.id).toBe('doc-uuid-1');
    });

    it('should query and list collection documents', async () => {
      const mockResponse = { ok: true, json: vi.fn().mockResolvedValue([{ id: '1', title: 'Task 1' }]) };
      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const result = await port.db.collection('todos').list({ completed: false });

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/db/todos/list',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ completed: false }),
        })
      );
      expect(result).toHaveLength(1);
    });

    it('should update existing collection document', async () => {
      const mockResponse = { ok: true, json: vi.fn().mockResolvedValue({ count: 1 }) };
      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      await port.db.collection('todos').update('task-id-1', { title: 'Updated Title' });

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/db/todos/update',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ id: 'task-id-1', title: 'Updated Title' }),
        })
      );
    });

    it('should delete collection document', async () => {
      const mockResponse = { ok: true, json: vi.fn().mockResolvedValue({ deleted: true }) };
      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      await port.db.collection('todos').delete('task-id-1');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/db/todos/delete',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ id: 'task-id-1' }),
        })
      );
    });
  });

  describe('AI API Integration', () => {
    it('should handle standard non-stream chat calls', async () => {
      const mockResponse = { ok: true, json: vi.fn().mockResolvedValue({ choices: [] }) };
      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      await port.ai.chat({ messages: [{ role: 'user', content: 'hello' }] });

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/ai/chat',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ messages: [{ role: 'user', content: 'hello' }], model: undefined, stream: undefined }),
        })
      );
    });
  });

  describe('Identity Client', () => {
    it('should fetch and cache current user context', async () => {
      const mockUser = { id: 'user-01', email: 'user@example.com' };
      const mockResponse = { ok: true, json: vi.fn().mockResolvedValue(mockUser) };
      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const user1 = await port.user.get();
      expect(user1).toEqual(mockUser);
      expect(port._user).toEqual(mockUser);

      // Subsequent call should use cached ref without fetch triggering again
      const user2 = await port.user.get();
      expect(user2).toEqual(mockUser);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should clear stored credentials on clear() invocation', async () => {
      port._user = { id: 'cached-user' };
      port.user.clear();
      expect(port._user).toBeNull();
    });
  });
});