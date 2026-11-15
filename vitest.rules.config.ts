import { defineConfig } from 'vitest/config';

// Testes das Firestore Rules (rodam no emulador: `npm run test:rules`).
export default defineConfig({
  test: { include: ['firestore-tests/**/*.test.ts'], environment: 'node', testTimeout: 30000, hookTimeout: 60000 },
});
