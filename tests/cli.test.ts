import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { version: string };

const CLI_PATH = resolve(import.meta.dirname, '../dist/index.js');

describe('CLI flags', () => {
  it('--version prints version and exits 0', () => {
    const output = execFileSync('node', [CLI_PATH, '--version'], {
      encoding: 'utf-8',
      timeout: 5000,
    });
    expect(output.trim()).toBe(`cloudscope-mcp ${pkg.version}`);
  });

  it('--validate fails with exit 1 when no Azure creds', () => {
    try {
      execFileSync('node', [CLI_PATH, '--validate'], {
        encoding: 'utf-8',
        timeout: 5000,
        env: { ...process.env, AZURE_SUBSCRIPTION_ID: '' },
      });
      // Should not reach here
      expect.unreachable('Expected process to exit with code 1');
    } catch (error: unknown) {
      const err = error as { status: number; stdout: string };
      expect(err.status).toBe(1);
      expect(err.stdout).toContain('Not configured');
    }
  });
});
