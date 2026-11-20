import { defineConfig } from 'vite';

// `base: './'` makes the build work from any sub-path
// (GitHub Pages project sites, Netlify, Vercel, a USB stick…).
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1400,
  },
  server: { host: true },
});
