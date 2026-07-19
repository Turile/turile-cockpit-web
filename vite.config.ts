import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Dev-time CORS workaround: the edge functions only allow the
// https://redeem.turil.ca origin, so in dev we proxy /functions/v1/* to
// Supabase — requests become same-origin and CORS never triggers.
// In production the app runs on the allowed origin and calls directly.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    server: {
      proxy: {
        "/functions/v1": {
          target: env.VITE_SUPABASE_URL,
          changeOrigin: true,
        },
      },
    },
  };
});
