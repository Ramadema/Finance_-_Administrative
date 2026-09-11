import type { NextConfig } from "next";

/**
 * Casi toda la app es cliente (IndexedDB en el navegador). El único código de
 * servidor es `src/app/api/modelo`, un proxy al modelo que existe para que la
 * key de Anthropic viva en una variable de entorno del servidor y no en el
 * bundle. Por eso ya no es `output: "export"` (ADR 0012): Vercel la corre como
 * app Next con una función, gratis en el plan Hobby para uso personal.
 */
const nextConfig: NextConfig = {
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
