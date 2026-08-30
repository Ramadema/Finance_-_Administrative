import type { NextConfig } from "next";

/**
 * Export estático: la app es 100% cliente (IndexedDB), no hay ninguna función
 * de servidor. Así el hosting es archivos sueltos — gratis en Vercel y
 * portable a cualquier otro lado sin tocar código.
 */
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  /**
   * Solo afecta a `next dev`. Sin esto, Next bloquea sus propios chunks cuando
   * la página se abre desde un host distinto de "localhost" y la app queda en
   * blanco sin ningún error visible en el navegador — el aviso sale únicamente
   * en la terminal del server.
   *
   * Sirve para dos cosas: probar desde el celular contra la IP de la red, y
   * usar 127.0.0.1 como "navegador limpio" (es otro origen, así que tiene su
   * propia base y arranca vacío).
   */
  allowedDevOrigins: ["127.0.0.1", "192.168.68.109"],
};

export default nextConfig;
