# Glosario del dominio

Las palabras del dominio son en castellano y significan una sola cosa. Si vas a
nombrar algo nuevo, buscá acá primero: la mitad de los bugs de una app de plata
son dos personas llamando distinto a lo mismo.

## Lo que entra

**Importación** — Un archivo del banco procesado. Guarda `hashArchivo` (subir el
mismo dos veces no duplica nada), cuántos movimientos trajo, el total que
declaraba el archivo, el que calculamos, y si **cuadra**. Borrar una importación
borra sus movimientos.

**Cuadra** — La suma de los movimientos coincide con la fila "Monto total del
período" del propio Excel, dentro de la tolerancia. Si no cuadra, la app te
avisa en lugar de mostrarte números en los que no podés confiar.

**Movimiento** — Una línea del resumen. Es la unidad de todo: no hay ninguna
métrica que no sea una cuenta sobre movimientos.

**`descripcionCruda`** — El texto tal cual lo emitió el banco. Intocable. Todo
lo demás (comercio, categoría, naturaleza) es derivado y recalculable.

**`fecha`** — Cuándo compraste. **`periodo`** — Qué resumen te lo cobra,
`"2026-08"`. **No son lo mismo y no se pueden usar indistintamente**: la cuota
3/12 de una compra de mayo llega fechada en mayo dentro del resumen de julio.
Todo lo mensual agrupa por `periodo` ([decisión 0003](decisiones/0003-el-mes-es-el-del-resumen.md)).

**`fechaEstimada`** — El banco no trajo fecha (la exporta como `01/01/0001`) y se
le asignó la del cierre del resumen. Pasa con ajustes y devoluciones.

**`excluido`** — Ocultar un movimiento del análisis sin borrarlo. Ninguna métrica
lo cuenta. **`editadoManualmente`** — Lo tocaste vos; un reimport no lo pisa.

## Cómo se identifica un comercio

**`claveComercio`** — La descripción normalizada: sin tildes, sin el id de
operación que cambia todos los meses, sin el ruido del banco. Es la clave con la
que la memoria aprende y con la que se detecta la recurrencia. **`comercio`** es
el nombre lindo que se muestra.

**Fuente de categoría** — De dónde salió la categoría, en cascada:
`regla` (una regla tuya) → `memoria` (ya categorizaste ese comercio antes) →
`semilla` (~180 comercios argentinos precargados) → `ninguna` (queda en
"Sin categoría", que es un estado válido y visible, no un error).

## Cómo se clasifica la plata

**Categoría / subcategoría** — 9 raíces de gasto, cada una con su color propio, y
subcategorías adentro. La lista está en `lib/categorize/categorias.ts` y es
cerrada a propósito.

**Clase de flujo** — Qué representa el movimiento: `gasto`, `ingreso`, `ahorro` o
`interno`. **Solo `gasto` suma al gasto del mes.** `interno` existe para el pago
de la tarjeta: aparece como débito en el resumen de cuenta y como consumos en el
de tarjeta, y contarlo dos veces duplicaría el mes entero.

**Naturaleza** — Qué tan repetitivo es un comercio, calculado sobre una ventana
de meses, no declarado por nadie:

- `fijo` — aparece en al menos el 75% de los meses de la ventana.
- `variable` — aparece seguido pero irregular.
- `esporadico` — aparece poco.

**Suscripción** — Recurrente *y* con monto planchado: la fracción de meses en que
el monto no se movió (±5%) supera la mitad. Se mide así, y no con el desvío
estándar, para que una suscripción que aumenta siga siendo una suscripción —
justo el mes en que querés el aviso ([decisión 0004](decisiones/0004-fijo-se-detecta-no-se-etiqueta.md)).

**Alerta de aumento** — El último monto está más de 10% arriba del promedio de
los anteriores.

**Gasto fijo declarado** — Alquiler, facultad, prepaga: no pasan por la tarjeta,
así que los cargás a mano con su vigencia (`desde` / `hasta`). Se guardan como
movimientos con `importacionId = "fijo"` y con su categoría real, no en una
categoría "Fijos". Lo declarado manda sobre lo detectado. **Ojo:** un gasto fijo
declarado *también* cae en el detector de recurrencia — el detector describe, la
declaración decide.

**Ingreso manual** — El resumen de tarjeta no trae ingresos, solo consumos. Sin
cargarlos, la app puede decir cuánto gastás pero nunca cuánto te sobra. `origen`
distingue el que cargaste (`manual`) del que se copió hacia adelante
(`repetido`), para poder deshacerlo.

**Plan de cuotas** — Comercio + cantidad de cuotas + mes de la primera. Es la
unidad para proyectar: una compra en cuotas reaparece en cada resumen, y contar
cada aparición proyectaba la misma compra varias veces. Solo se proyecta desde
la aparición más reciente y solo más allá del último resumen importado.

## Lo que se calcula

**Resumen del período** (`ResumenPeriodo`) — La foto de un mes: `ingresos`,
`gastos`, `ahorro`, `sobrante` (ingresos − gastos − ahorro), el reparto
`fijo`/`variable`/`esporadico`, cuántos quedaron `sinCategorizar` y `gastosUSD`.

**`gastosUSD` va aparte y sin convertir**, porque el resumen no trae cotización.
Sumarlo como cero haría desaparecer un gasto real sin que nada lo indique.

**Capacidad de ahorro** — `ingresos − gastos` del mes. Puede ser negativa.
**Tasa de ahorro**: qué fracción del ingreso lográs no gastar. **Carga fija**:
qué fracción se lleva el piso ineludible. **Margen discrecional**:
`ingresos − fijos`, la plata sobre la que realmente podés decidir.

**Fondo de emergencia** — Cuántos meses de *gastos fijos* cubre tu ahorro
acumulado. El piso mensual es la **mediana** de los fijos de la serie, no el
promedio: un mes raro no tiene que mover la meta.

**Observación (insight)** — Una frase con un número atrás, con severidad
`critico`, `atencion`, `info` o `bueno`. Si no hay datos para calcular la
comparación, la regla no se dispara: no existe la observación genérica.

**Cobertura** — Qué porcentaje de los movimientos tiene categoría. Es la métrica
de salud del motor de categorización.

## Cómo se dicen los períodos

`"2026-08"` en los datos, siempre. Ordenable como texto y comparable con `===`.
Para mostrar, `nombrePeriodo()` y `periodoCorto()` en `lib/utils.ts`. Nunca
construyas un `Date` para hacer aritmética de meses: usá `periodoAnterior()` o
`desplazarPeriodo()`.
