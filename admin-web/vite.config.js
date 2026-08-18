import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Served by AmbulanceBackend (Express) at /admin — same pattern as PhleboBackend.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const devApi = env.VITE_DEV_API_ORIGIN || "http://127.0.0.1:3011";
  const devPort = Number(env.VITE_DEV_PORT) || 5176;

  return {
    plugins: [react()],
    base: "/admin/",
    build: {
      outDir: "dist",
      emptyOutDir: true,
    },
    server: {
      port: devPort,
      proxy: {
        "/v1/api": { target: devApi, changeOrigin: true },
        "/uploads": { target: devApi, changeOrigin: true },
      },
    },
  };
});
