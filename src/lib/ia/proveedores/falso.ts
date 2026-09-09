import type { Peticion, ProveedorIA, RespuestaModelo } from "../tipos";

/**
 * Un modelo de mentira que sigue un guion.
 *
 * Es lo que permite testear el agente entero —el bucle, las herramientas, el
 * control de números— sin red, sin key y en milisegundos. Guarda cada petición
 * que recibió para poder afirmar sobre lo que el modelo "vio".
 */
export interface ProveedorFalso extends ProveedorIA {
  peticiones: Peticion[];
}

export function proveedorFalso(
  guion: readonly RespuestaModelo[] | ((peticion: Peticion, vuelta: number) => RespuestaModelo),
): ProveedorFalso {
  const peticiones: Peticion[] = [];
  return {
    nombre: "falso",
    peticiones,
    async responder(peticion) {
      peticiones.push(peticion);
      const vuelta = peticiones.length - 1;
      if (typeof guion === "function") return guion(peticion, vuelta);
      const r = guion[vuelta];
      if (!r) {
        throw new Error(`El guion tiene ${guion.length} respuestas y el agente pidió la número ${vuelta + 1}.`);
      }
      return r;
    },
  };
}

/** El modelo responde con texto y termina. */
export const dice = (texto: string): RespuestaModelo => ({ texto, llamadas: [], fin: "terminado" });

/** El modelo pide una o más herramientas. */
export const llama = (
  ...llamadas: { nombre: string; entrada?: Record<string, unknown>; id?: string }[]
): RespuestaModelo => ({
  texto: "",
  fin: "herramientas",
  llamadas: llamadas.map((l, i) => ({ id: l.id ?? `ll_${i + 1}`, nombre: l.nombre, entrada: l.entrada ?? {} })),
});
