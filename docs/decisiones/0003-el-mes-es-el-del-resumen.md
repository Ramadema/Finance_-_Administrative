# 0003 — El mes de un gasto es el del resumen, no el de la compra

## Contexto

BBVA repite la fecha de la compra original en cada cuota: la cuota 3/12 de algo
comprado el 14/05 aparece fechada 14/05 dentro del resumen de julio.

Agrupando por fecha de compra pasaban dos cosas a la vez: mayo acumulaba la misma
compra una vez por cada resumen importado, y los meses que realmente la estaban
pagando salían en cero.

Además, el período no se puede sacar del nombre del archivo: la hoja se llama
`Mov_Periodo_29-08-2026`, que es la fecha de descarga. Dos resúmenes distintos
bajados el mismo día colapsaban en un solo mes.

## Decisión

Cada movimiento guarda las dos cosas: `fecha` (cuándo compraste) y `periodo`
(qué resumen te lo cobra, `"2026-08"`). El período sale del **contenido**: el mes
donde cae la mayoría de los consumos del archivo, que además es como uno los
llama ("el resumen de junio").

**Todo lo mensual agrupa por `periodo`.** `fecha` sirve para el detalle, el orden
y el calendario del mes.

## Consecuencias

- Las cuotas caen en el mes en que se pagan, que es lo que el usuario espera ver.
- Reimportar el mismo resumen no mueve nada de lugar.
- Hay que ser disciplinado: una métrica nueva que agrupe por `fecha` "porque es
  la fecha" reintroduce el bug entero.

## Cómo se verifica

`src/lib/ingest/dedupe.test.ts` y `src/lib/analisis/metricas.test.ts`.
El glosario ([`../dominio.md`](../dominio.md)) marca la diferencia como
intraducible: son dos campos, no dos nombres del mismo.
