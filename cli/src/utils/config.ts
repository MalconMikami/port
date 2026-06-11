import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export interface Config {
  apiUrl: string;
  domain: string;
  token?: string;
}

const CONFIG_DIR = join(homedir(), '.config', 'port');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

export function getConfig(): Config {
  try {
    if (existsSync(CONFIG_FILE)) {
      return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
    }
  } catch {}

  return {
    apiUrl: process.env.PORT_API_URL || 'http://localhost:3000',
    domain: process.env.PORT_DOMAIN || 'xp.inc',
  };
}

export function saveConfig(config: Config): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}
