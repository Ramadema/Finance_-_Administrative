import type { NextConfig } from "next";

/**
 * Export estático: la app es 100% cliente (IndexedDB), no hay ninguna función
 * de servidor. Así el hosting es archivos sueltos — gratis en Vercel y
 * portable a cualquier otro lado sin tocar código.
 */
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
