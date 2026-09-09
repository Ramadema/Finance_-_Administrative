# 0004 — Fijo se detecta, no se etiqueta

## Contexto

"Gastos fijos" podía ser una categoría más, con el usuario marcando cuáles lo
son. Etiquetar a mano tiene dos problemas: nadie mantiene la lista, y la
etiqueta miente cuando el gasto cambia de comportamiento.

El primer intento de detectarlo automáticamente usó el coeficiente de variación
del monto. No funciona: Netflix a 5000, 5000, 5000, 7500 tiene CV 0.19, el mismo
orden que un supermercado errático. Con un umbral sobre CV, la suscripción
dejaba de detectarse **justo el mes que aumenta** — exactamente cuando querés el
aviso.

## Decisión

La naturaleza (`fijo` / `variable` / `esporadico`) se **calcula** por comercio
sobre una ventana de meses:

- Recurrente = aparece en ≥75% de los meses de la ventana.
- Suscripción = recurrente **y** con la mayoría de las transiciones mes a mes
  planas (±5%).

Lo que separa una suscripción de un gasto variable no es *cuánto* se mueve el
monto sino *cuántas veces*: una suscripción está planchada casi siempre y salta
una vez; un gasto variable cambia todos los meses.

El monto típico es la **mediana**, no el promedio: un mes con outlier no mueve
el piso.

Aparte están los **gastos fijos declarados** a mano (alquiler, facultad,
prepaga), que no pasan por la tarjeta y el banco no ve. Se guardan con su
categoría real y con vigencia (`desde`/`hasta`), y **lo declarado manda sobre lo
detectado**.

## Consecuencias

- Una suscripción que aumenta sigue siendo suscripción y además dispara la
  alerta de aumento.
- El "piso mensual" del fondo de emergencia sale de datos, no de una lista que
  alguien tiene que mantener.
- **Se paga**: la clasificación necesita historia. Con dos meses cargados casi
  todo es `esporadico`, y eso es correcto aunque parezca pobre.

## Cómo se verifica

`src/lib/categorize/recurrencia.test.ts`, con el caso Netflix explícito.
