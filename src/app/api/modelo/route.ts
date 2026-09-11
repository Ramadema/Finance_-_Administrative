import { crearManejador } from "./manejador";

/**
 * POST /api/modelo — ver `manejador.ts`.
 *
 * Una vuelta con el modelo puede tardar más que los 10 segundos que Vercel da
 * por defecto a una función; el tope del plan Hobby son 60.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const POST = crearManejador({
  entorno: {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    DUENO_EMAIL: process.env.DUENO_EMAIL,
  },
});
