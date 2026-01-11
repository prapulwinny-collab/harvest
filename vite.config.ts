
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import crypto from 'node:crypto';

// Polyfill for environments where globalThis.crypto is missing or incomplete
if (!globalThis.crypto) {
  // @ts-ignore
  globalThis.crypto = crypto.webcrypto;
}

export default defineConfig({
  plugins: [react()],
});
