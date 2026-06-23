import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Base path for GitHub Pages project site (https://<user>.github.io/ContentStudio/).
// Overridable via BASE_PATH for other hosts; defaults to "/" in dev.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/ContentStudio/',
  plugins: [react()],
});
