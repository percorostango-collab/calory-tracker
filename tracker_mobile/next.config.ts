import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    // Fixa la root del workspace su QUESTO progetto: in un monorepo con
    // due package-lock.json, Turbopack altrimenti inferisce la radice del
    // repo (versione PC) e risolve moduli/config da lì.
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
