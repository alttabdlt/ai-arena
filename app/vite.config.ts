import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      '/graphql': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        ws: true
      },
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true
      }
    }
  },
  plugins: [
    react(),
    nodePolyfills({
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      protocolImports: true,
    }),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@game": path.resolve(__dirname, "./src/modules/game"),
      "@bot": path.resolve(__dirname, "./src/modules/bot"),
      "@tournament": path.resolve(__dirname, "./src/modules/tournament"),
      "@auth": path.resolve(__dirname, "./src/modules/auth"),
      "@queue": path.resolve(__dirname, "./src/modules/queue"),
      "@admin": path.resolve(__dirname, "./src/modules/admin"),
      "@shared": path.resolve(__dirname, "./src/shared"),
      "@ui": path.resolve(__dirname, "./src/shared/components/ui"),
    },
  },
}));
