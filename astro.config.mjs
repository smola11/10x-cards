// @ts-check
/* global process */
import { defineConfig } from "astro/config";
import { loadEnv } from "vite";

import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import node from "@astrojs/node";

// Determine current mode:
// - Prefer explicit CLI flag: `astro dev --mode test`
// - Fallback to MODE / NODE_ENV
const argv = process.argv ?? [];
let cliMode;
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i] === "--mode" && i + 1 < argv.length) {
    cliMode = argv[i + 1];
    break;
  }
}

const mode = cliMode || process.env.MODE || process.env.NODE_ENV || "development";

// Load environment variables for the current mode, including .env.test when mode === "test"
const env = loadEnv(mode, process.cwd(), "");

// https://astro.build/config
export default defineConfig({
  output: "server",
  integrations: [react(), sitemap()],
  server: { port: 3001 },
  vite: {
    plugins: [tailwindcss()],
    define: {
      // Make E2E_USER_ID available to import.meta.env
      "import.meta.env.E2E_USER_ID": JSON.stringify(env.E2E_USER_ID),
    },
  },
  adapter: node({
    mode: "standalone",
  }),
});
