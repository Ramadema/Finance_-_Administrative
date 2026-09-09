# Agregar una herramienta al agente

Una herramienta es una pregunta que el modelo puede hacerle a tus datos. Antes
de escribirla, la prueba de fuego: **¿qué pregunta del usuario contesta que las
que ya hay no contestan?** Si no la podés decir en una frase, no hace falta.

## 1. Primero la función del dominio

La herramienta **envuelve**, no calcula. Si el número que necesitás no lo
devuelve ninguna función de `src/lib/analisis/`, seguí
[`agregar-una-metrica.md`](agregar-una-metrica.md) primero, con su test. Después
volvé acá.

## 2. La herramienta, en `src/lib/ia/herramientas.ts`

```ts
const miHerramienta: Herramienta = {
  definicion: {
    nombre: "nombre_en_snake_case",
    descripcion: 'Qué contesta y para qué preguntas sirve: "cuánto…", "qué…".',
    parametros: {
      type: "object",
      properties: {
        periodo: PERIODO,
        limite: { type: ["integer", "null"], description: "Cuántos traer. null = 10." },
      },
      required: ["periodo", "limite"],
      additionalProperties: false,
    },
  },
  ejecutar(entrada, ctx) {
    const periodo = periodoDe(entrada, ctx);
    const limite = enteroDe(entrada, "limite", 10, 1, 50);
    return laFuncionDelDominio(ctx.movimientos, periodo, limite).map(/* compactar */);
  },
};
```

Las reglas, y por qué:

- **La descripción la lee el modelo** para decidir cuándo usarla. Decí qué
  contesta y con qué frases de usuario, no cómo está hecha.
- **Esquema estricto**: `additionalProperties: false` y **todo** parámetro en
  `required`. Lo opcional va como `["tipo", "null"]`. Así el proveedor garantiza
  que la llamada cumple el esquema, y funciona igual en todos. Un test lo
  verifica para todas las herramientas.
- **Validá con los helpers** (`periodoDe`, `categoriaDe`, `enteroDe`, …) y tirá
  `EntradaInvalida` con un mensaje **para el modelo**: "Meses disponibles: …".
  El bucle lo convierte en un resultado con `error` y el modelo se corrige solo.
- **La salida es compacta y ya calculada**: pesos redondeados (`pesos()`),
  porcentajes en % con un decimal (`pct()`), listas acotadas, y **los totales
  incluidos** — el modelo nunca tiene que sumar. Cada campo que devolvés son
  tokens que se pagan en cada vuelta.
- Agregala a `HERRAMIENTAS`.

## 3. Tests, en `src/lib/ia/herramientas.test.ts`

- El caso feliz, con números verificados a mano.
- Una entrada inválida devuelve un error legible (y no una excepción).
- Los excluidos no cuentan; una devolución (monto negativo) resta.

El meta-test de las definiciones (esquema estricto, nombre único, descripción
larga) ya cubre la tuya sin que hagas nada.

## 4. Probala en el bucle

Un caso en `src/lib/ia/agente.test.ts` con `proveedorFalso([llama({ nombre:
"tu_herramienta", entrada: {…} }), dice("…")])`. Confirmás que el resultado
llega con el mismo `id` y que `sinRespaldo` queda vacío cuando el texto cita
números del resultado.

## 5. Documentala

La tabla de herramientas de [`../agente.md`](../agente.md). Una línea: qué
contesta y qué envuelve.

## 6. Verificá

```bash
npm run lint && npm run typecheck && npm test && npm run docs:check
```
