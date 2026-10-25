import { defineConfig } from 'vite';

export default defineConfig({
  base: '/PhiARK/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    sourcemap: false
  }
});
