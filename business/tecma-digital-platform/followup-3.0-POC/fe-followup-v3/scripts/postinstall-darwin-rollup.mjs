#!/usr/bin/env node
/**
 * Su macOS installa i binari Rollup opzionali (darwin) senza modificare il lockfile.
 * Su Linux/Vercel non fa nulla, così npm ci non fallisce per EBADPLATFORM.
 */
import { spawnSync } from 'child_process';
import { platform } from 'os';

if (platform() === 'darwin') {
  spawnSync(
    'npm',
    [
      'install',
      '@rollup/rollup-darwin-arm64@4.59.0',
      '@rollup/rollup-darwin-x64@4.59.0',
      '--no-save',
      '--package-lock=false',
    ],
    { stdio: 'inherit' }
  );
}
