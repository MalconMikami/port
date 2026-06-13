import { vi } from 'vitest';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.PORT_API_URL = 'http://localhost:3000';
process.env.PORT_DOMAIN = 'localhost';

// Mock console
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

// Mock fetch globally
global.fetch = vi.fn();