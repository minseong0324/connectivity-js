import noMisleadingReturnType from 'eslint-plugin-no-misleading-return-type';
import parser from '@typescript-eslint/parser';

export default [
  {
    files: ['packages/*/src/**/*.ts', 'packages/*/src/**/*.tsx'],
    ignores: ['**/node_modules/**', '**/dist/**'],
    languageOptions: {
      parser,
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.ts', '*.tsx'],
        },
      },
    },
    plugins: {
      'no-misleading-return-type': noMisleadingReturnType,
    },
    rules: {
      'no-misleading-return-type/no-misleading-return-type': 'warn',
    },
  },
];
