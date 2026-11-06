import adapter from "@sveltejs/adapter-node";
import { sveltekit } from "@sveltejs/kit/vite";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }

  return {
    plugins: [
      sveltekit({
        adapter: adapter(),
        preprocess: vitePreprocess(),
        paths: {
          origin: process.env.SELF_ORIGIN ?? "http://localhost:3000",
        },
        csrf: {
          trustedOrigins: ["*"],
        },
      }),
    ],
    server: { port: 3001 },
  };
});
