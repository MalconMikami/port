import { Command } from 'commander';
import { createInterface } from 'readline';
import { stdin, stdout } from 'process';
import { getConfig, saveConfig } from '../utils/config.js';

export const loginCommand = new Command('login')
  .description('Authenticate with Port using Microsoft Entra')
  .action(async () => {
    const config = getConfig();
    const authUrl = `${config.apiUrl}/api/auth/login`;

    console.log('🔐 Opening browser for login...');
    console.log(`   If browser doesn't open, visit: ${authUrl}`);

    // Try to open browser
    try {
      const { execSync } = await import('child_process');
      const platform = process.platform;
      if (platform === 'darwin') execSync(`open "${authUrl}"`);
      else if (platform === 'win32') execSync(`start "" "${authUrl}"`);
      else execSync(`xdg-open "${authUrl}" 2>/dev/null || sensible-browser "${authUrl}"`);
    } catch {
      // Browser open failed, that's ok
    }

    console.log('\n📋 After login, enter your API token:');
    const rl = createInterface({ input: stdin, output: stdout });
    const token = await new Promise<string>((resolve) => {
      rl.question('Token: ', (answer) => {
        resolve(answer.trim());
        rl.close();
      });
    });

    if (token) {
      saveConfig({ ...config, token });
      console.log('✅ Authenticated successfully!');
    }
  });
