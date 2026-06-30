import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
    // 実 API キーが .env に設定されていてもテスト中は実ネットワーク呼び出しを起こさない
    env: {
      GOOGLE_MAPS_API_KEY: '',
      SHEET_NAME: '',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.js'],
      exclude: ['src/cli/**', '**/*.test.js'],
    },
  },
});
