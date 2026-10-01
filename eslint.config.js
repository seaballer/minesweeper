import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
    {
        ignores: [
            'dist/**',
            'node_modules/**',
            // Third-party agent tooling, not app source.
            '.opencode/**',
        ],
    },
    js.configs.recommended,
    {
        files: ['**/*.{js,jsx,mjs}'],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: 'module',
            parserOptions: {
                ecmaFeatures: { jsx: true },
            },
            globals: {
                ...globals.browser,
                ...globals.es2021,
            },
        },
        plugins: {
            'react-hooks': reactHooks,
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
            eqeqeq: ['error', 'smart'],
            'no-var': 'error',
            'prefer-const': 'error',
        },
    },
    {
        // The harnesses run in Node. `ui-check.mjs` drives a jsdom document;
        // `test/` is the plain model unit suite.
        files: ['ui-check.mjs', 'test/**/*.js'],
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
    },
];
