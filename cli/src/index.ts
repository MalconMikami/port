#!/usr/bin/env node
import { Command } from 'commander';
import { deployCommand } from './commands/deploy.js';
import { loginCommand } from './commands/login.js';

const program = new Command()
  .name('port')
  .description('🚢 Port - Internal hosting platform CLI')
  .version('1.0.0');

program.addCommand(deployCommand);
program.addCommand(loginCommand);
program.parse(process.argv);
