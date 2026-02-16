import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://elizaos.news',
  output: 'static',
  integrations: [react()],
  vite: {
    resolve: {
      alias: {
        '@': '/src',
      },
    },
    server: {
      watch: {
        // Exclude large directories from file watching to avoid ENOSPC
        ignored: ['**/knowledge/**', '**/media/daily/**', '**/remotion/**', '**/tmp/**', '**/dist/**'],
      },
    },
  },
});
