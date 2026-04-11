import { defineConfig } from 'tsup';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pkg = require('./package.json') as { version: string };

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node22',
  dts: true,
  clean: true,
  banner: { js: '#!/usr/bin/env node' },
  define: { __PKG_VERSION__: JSON.stringify(pkg.version) },
  // GCP SDKs loaded via dynamic import() — keep external so the base bundle
  // stays small for Azure-only users. Resolved from node_modules at runtime.
  external: [
    '@google-cloud/bigquery',
    '@google-cloud/recommender',
    '@google-cloud/asset',
    '@google-cloud/billing-budgets',
    '@google-cloud/resource-manager',
    '@google-cloud/compute',
  ],
});
