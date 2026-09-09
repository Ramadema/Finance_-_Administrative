# Agregar una métrica

Vale para un número del dashboard, una serie para un gráfico o una comparación
entre meses. El orden importa: el cálculo primero, la pantalla al final.

## 1. Escribila como función pura

En `src/lib/analisis/metricas.ts` (o un archivo nuevo de `analisis/` si es un
tema propio: `ahorro.ts` e `insights.ts` ya se separaron así).

```ts
export function loQueSea(
  movimientos: readonly Movimiento[],
  periodo: string,
): Resultado | null
```

- Recibe los movimientos por parámetro. **No lee la base**: el lint lo impide, y
  es lo que permite testearla sin navegador.
- Filtrá `excluido` (usá el helper `activos`) y agrupá por **`periodo`**, no por
  `fecha` ([decisión 0003](../decisiones/0003-el-mes-es-el-del-resumen.md)).
- Solo la clase `gasto` suma al gasto. `ingreso`, `ahorro` e `interno` no.
- **Sin datos suficientes se devuelve `null`, nunca `0`.** Cero es un número que
  el usuario va a leer como "no gastaste nada".

## 2. Testeala antes de mostrarla

En el `.test.ts` de al lado. Los casos que siempre faltan:

- Mes sin movimientos → `null`, no `0` ni `NaN`.
- Un solo mes de historia (todo lo comparativo tiene que aguantarlo).
- Un monto negativo (devolución) sin `Math.abs()`.
- Movimientos `excluido` que no tienen que contar.
- Una compra en cuotas que aparece en varios resúmenes → se cuenta una vez por
  período, no una vez por aparición.

## 3. Publicala en el contexto

En `src/lib/DatosContext.tsx`:

1. Agregá el campo a la interfaz `Datos`.
2. Calculalo dentro del `useMemo` de `derivado`.
3. **Agregá el mismo campo al objeto que devuelve el `if (!periodo)`** de arriba
   del `useMemo` — es el estado "no hay datos todavía" y TypeScript te lo va a
   exigir. Ahí el valor es `null` o vacío, jamás un número inventado.

Va al contexto solo si lo usa más de una sección o si es caro. Un cálculo de una
sola pantalla puede quedar en un `useMemo` de esa página, siempre que la función
viva igual en `lib/`.

## 4. Mostrala

El componente recibe lo ya calculado por props o de `useDatos()`. **Un componente
decide cómo se ve un número, nunca cuánto vale.** Si te aparece un `if` sobre
plata en el JSX, ese `if` va en `lib/`.

- Formateá con `formatARS` / `formatUSD` / `formatCompacto` (`lib/ingest/numero.ts`).
- Sin dato, mostrá `—` y qué falta cargar. No `$0`.
- Colores: `colorSerie(slot, tema)` de `lib/design/paleta.ts`. Nada de hex sueltos.

## 5. Verificá

```bash
npm run lint && npm run typecheck && npm test
```
