import { getConfig } from './config.js';

export async function apiRequest(path: string, options: RequestInit = {}): Promise<any> {
  const config = getConfig();
  const url = `${config.apiUrl}${path}`;
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  if (config.token) {
    headers['Authorization'] = `Bearer ${config.token}`;
  }

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }

  return res.json();
}
