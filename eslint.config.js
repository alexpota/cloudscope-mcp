import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='console'][callee.property.name='log']",
          message: 'console.log is banned — it writes to stdout and corrupts the MCP JSON-RPC protocol. Use console.error for logging.',
        },
        {
          selector: "CallExpression[callee.object.name='console'][callee.property.name='error'] TemplateLiteral MemberExpression[property.name='message']",
          message: 'Do not log error.message — it may contain credentials or sensitive data. Log a generic event description instead.',
        },
        {
          selector: "CallExpression[callee.object.name='console'][callee.property.name='error'] CallExpression[callee.name='String']",
          message: 'Do not log String(error) — it may contain credentials or sensitive data. Log a generic event description instead.',
        },
      ],
    },
  },
  {
    ignores: ['dist/', 'node_modules/', 'tests/', '*.js'],
  },
);
