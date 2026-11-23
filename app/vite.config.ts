import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Папка со статикой именно эта: старый курсовой сайт лежит в ../public
  // и не должен попадать в сборку дипломной версии.
  publicDir: 'static',
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Вендоры меняются редко — выносим их в отдельные чанки, чтобы
        // правки приложения не инвалидировали кэш больших библиотек.
        manualChunks(id: string) {
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/react-router')
          ) {
            return 'react';
          }
          if (id.includes('node_modules/@supabase')) {
            return 'supabase';
          }
          return undefined;
        }
      }
    }
  },
  server: {
    port: 5173
  }
});
