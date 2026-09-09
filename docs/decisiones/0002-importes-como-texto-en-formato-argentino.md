# 0002 — Los importes son texto en formato argentino

## Contexto

BBVA exporta los importes como `"1.234,56"`: punto para miles, coma para
decimales. En JavaScript, `parseFloat("1.234,56")` devuelve `1.234` — mil veces
menos — **y no tira error**. Un gasto de mil doscientos pesos entra al análisis
como uno con veinte y nada se rompe: los totales cierran, los gráficos dibujan,
el número está mal.

## Decisión

Todo importe que venga del banco entra por `parseImporteAR()`
(`src/lib/ingest/numero.ts`), que devuelve `number | null` y trata el `null` como
dato faltante, nunca como cero. `parseFloat` y `Number.parseFloat` están
prohibidos en todo `src/` por regla de lint.

Corolario: **los importes llevan signo**. Las devoluciones vienen negativas y su
suma aritmética da el total declarado del archivo. `Math.abs()` sobre un monto de
gasto convierte una devolución en gasto e infla el mes justo cuando el banco te
devolvió la plata.

## Consecuencias

- Un import validado contra el total del propio archivo detecta el error de
  parseo el mismo día en vez de meses después.
- El precio es tener que acordarse de la función. Por eso además es lint: el
  agente que escriba `parseFloat` se entera antes de commitear.

## Cómo se verifica

`src/lib/ingest/numero.test.ts` cubre el caso `"1.234"` y una docena más.
La regla `no-restricted-globals` de `eslint.config.mjs` bloquea `parseFloat`.
