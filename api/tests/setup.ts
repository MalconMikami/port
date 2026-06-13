import { vi } from 'vitest';

// Mock environment variables for tests
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'port_test';
process.env.DB_USER = 'test';
process.env.DB_PASSWORD = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.AI_ENDPOINT = 'http://localhost:11434';
process.env.STORAGE_SITES_DIR = '/tmp/port-sites';
process.env.STORAGE_UPLOADS_DIR = '/tmp/port-uploads';
process.env.DOMAIN = 'localhost';

// Mock console methods to reduce noise in tests
const originalConsoleError = console.error;
const originalConsoleLog = console.log;

beforeAll(() => {
  console.error = vi.fn();
  console.log = vi.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
  console.log = originalConsoleLog;
});

// Global test utilities
global.createMockRequest = (overrides = {}) => ({
  method: 'GET',
  url: '/',
  headers: {},
  query: {},
  params: {},
  body: {},
  user: { id: 'test-user-id' },
  siteContext: { type: 'admin' },
  ...overrides,
});

global.createMockReply = () => {
  const reply: any = {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    type: vi.fn().mockReturnThis(),
    header: vi.fn().mockReturnThis(),
    sendFile: vi.fn().mockReturnThis(),
  };
  return reply;
};