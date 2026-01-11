import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Robust polyfill for environments where globalThis.crypto is missing or incomplete
// This fixes the "getRandomValues is not a function" error
if (typeof globalThis.crypto === 'undefined' || typeof globalThis.crypto.getRandomValues !== 'function') {
  // @ts-ignore
  globalThis.crypto = crypto.webcrypto;
}

// Custom plugin to manually copy PWA assets to the build directory
// This fixes the 404 error for sw.js and manifest.json on Vercel
const copyStaticFiles = () => {
  return {
    name: 'copy-static-files',
    closeBundle: () => {
      const dist = path.resolve(__dirname, 'dist');
      const files = ['sw.js', 'manifest.json', 'logo.png'];
      
      files.forEach(file => {
        const src = path.resolve(__dirname, file);
        const dest = path.join(dist, file);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest);
          console.log(`[PWA] Copied ${file} to root of dist`);
        }
      });
    }
  };
};

export default defineConfig({
  plugins: [react(), copyStaticFiles()],
  define: {
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY),
  },
  build: {
    outDir: 'dist',
  }
});