import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  // base: '/ai-town', // Commented out to run at root path
  plugins: [react()],
  server: {
    port: 5175, // Use port 5175 to avoid conflict with AI Arena app on 5173
    allowedHosts: ['ai-town-your-app-name.fly.dev', 'localhost', '127.0.0.1'],
  },
});
