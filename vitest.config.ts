import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // react() is typed against Vite's own nested copy of `vite` (npm can hoist
  // two copies), which trips up structural type-checking here even though it
  // works fine at runtime.
  plugins: [react() as any],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
