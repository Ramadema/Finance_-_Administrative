# Plata

Dashboard personal de finanzas. Subís el Excel de movimientos que te da BBVA y
te muestra a dónde se va la plata: en qué gastás, cuánto es fijo, cuánto te
sobra y qué cuotas ya tenés comprometidas.

**Todo corre en tu navegador.** No hay servidor, no hay base de datos en la nube
y no hay API keys. Tus movimientos bancarios nunca salen de tu máquina.

## Cómo se usa

1. BBVA home banking → **Tarjetas → Resúmenes → Descargar Excel** (elegí un
   resumen ya cerrado; "Últimos movimientos" trae el período en curso y suele
   venir vacío).
2. Arrastrá el `.xls` a la app.
3. Listo. Repetí cada mes.

Los movimientos quedan en IndexedDB. Cada tanto bajá un respaldo con el botón
de descarga del encabezado — si limpiás los datos del navegador, se van.

## Arranque

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # 86 tests
npm run build        # export estático a ./out
```

En `samples/` hay 4 meses de datos de demo con el formato exacto de BBVA para
probar sin usar tus datos reales.

## Deploy

Es un export estático, así que anda en el plan gratis de Vercel sin ninguna
función de servidor:

```bash
npx vercel            # o conectá el repo desde vercel.com
```

Al ser archivos estáticos también se puede hostear en GitHub Pages, Netlify o
Cloudflare Pages sin tocar una línea.

## Cómo está armado

```
src/lib/ingest/       Parseo del Excel de BBVA
  numero.ts             ← formato argentino ($ 1.234,56). La función más crítica.
  bbva-xls.ts           Columnas por NOMBRE, no por posición
  dedupe.ts             Ids estables: reimportar no duplica
src/lib/categorize/   Categorización sin LLM, en cascada
  semilla.ts            ~180 comercios argentinos precargados
  motor.ts              reglas → memoria → semilla → sin categorizar
  recurrencia.ts        detecta fijos y suscripciones solo
src/lib/analisis/     Métricas del dashboard
src/lib/db/           IndexedDB (Dexie) detrás de un repositorio
src/lib/design/       Paleta validada para daltonismo y contraste
```

### Decisiones que vale la pena conocer

**Los importes son texto, no números.** BBVA exporta `"1.234,56"`. En JS,
`parseFloat("1.234")` devuelve `1.234` en vez de `1234` — sin tirar error. Todo
importe pasa por `parseImporteAR()`, que está testeada contra ese caso y una
docena más.

**El import se valida contra el total del archivo.** El Excel trae su propia
fila "Monto total del período". Si la suma de los movimientos no cuadra, el
import te avisa en vez de mostrarte números en los que no podés confiar.

**Fijo vs variable no se etiqueta: se detecta.** Un comercio es fijo si aparece
casi todos los meses con monto planchado. La métrica es la fracción de meses
sin cambio, no el desvío estándar — así una suscripción que aumenta de precio
sigue siendo una suscripción, que es justo cuando querés la alerta.

**Los movimientos internos no son gasto.** El pago de la tarjeta aparece como
débito en el resumen de cuenta y sus consumos en el de tarjeta. Sumar ambos
duplicaría el mes entero, así que las transferencias propias van a una clase
aparte que no computa.

**La descripción cruda del banco nunca se pisa.** Todo lo derivado (comercio,
categoría, naturaleza) se puede recalcular sin volver a subir nada.

### Limitaciones conocidas

- Solo lee el export de **tarjeta** de BBVA. El de cuenta (con los ingresos)
  todavía no: por eso "Te sobra" aparece vacío si solo cargaste tarjetas.
- Los consumos en dólares **no se convierten a pesos** (el resumen no trae
  cotización). Se muestran aparte para que no desaparezcan del análisis.
- Sin sincronización entre dispositivos. El respaldo JSON cubre el hueco.
