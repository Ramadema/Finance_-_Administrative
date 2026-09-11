# Plata

Dashboard personal de finanzas. Subís el Excel de movimientos que te da BBVA y
te muestra a dónde se va la plata: en qué gastás, cuánto es fijo, cuánto te
sobra y qué cuotas ya tenés comprometidas.

**Tus datos viven en tu navegador.** No hay base de datos en la nube. El único
código de servidor es el del asistente **Preguntar**: una función que tiene la
key de Anthropic del dueño y solo le responde a su cuenta de Google. Cuando
preguntás, sale tu pregunta y lo que hace falta para contestarla (totales por
categoría o comercio, o los movimientos que coincidan con una búsqueda), pasa
por esa función —que no guarda nada— y llega a Anthropic. Nunca la base entera
ni la descripción cruda del banco.

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
npm test             # 203 tests
npm run build        # páginas prerenderizadas + la función /api/modelo
```

La app arranca vacía. Los únicos datos que muestra son los de los archivos que
vos importás — no hay data de ejemplo precargada ni valores por defecto.

Para Drive y para Preguntar hace falta un `.env.local` (copiá `.env.example`):
`NEXT_PUBLIC_GOOGLE_CLIENT_ID` para entrar con Google, y —solo servidor, nunca
con `NEXT_PUBLIC_`— `ANTHROPIC_API_KEY` y `DUENO_EMAIL`, la cuenta de Google que
puede preguntar.

`samples/` es donde dejás tus `.xls` del banco: `.gitignore` los bloquea, así
que nunca se suben al repo. Si están, `npm test` corre además una tanda de
regresión contra ellos; si no, esa tanda se saltea sola.

## Deploy

Vercel, plan Hobby (gratis para uso personal). Las páginas se prerenderizan y la
única función de servidor es `/api/modelo`:

```bash
npx vercel            # o conectá el repo desde vercel.com
```

En el proyecto de Vercel → Settings → Environment Variables cargá las tres
variables de `.env.example`. `ANTHROPIC_API_KEY` y `DUENO_EMAIL` van sin el
prefijo `NEXT_PUBLIC_`: son del servidor y el navegador no las ve nunca. Y en
la consola de Google Cloud, agregá tu dominio de Vercel a los orígenes
autorizados del Client ID.

## Secciones

| Sección | Qué responde |
|---|---|
| **Resumen** | Cuánto gastaste, cuánto te sobra, a dónde se fue (Sankey), evolución y composición |
| **Gastos** | En qué categorías y comercios, día por día, qué cambió contra el mes anterior |
| **Fijos** | Qué gastos se repiten todos los meses, cuáles aumentaron, qué cuotas debés |
| **Ahorro** | Cargás tus ingresos → capacidad de ahorro, proyección a 12 meses, simulador de recorte, fondo de emergencia |
| **Alertas** | Observaciones automáticas sobre tu propio historial |
| **Movimientos** | El detalle auditable; acá categorizás lo que quedó suelto |
| **Preguntar** | Le preguntás a tus datos en castellano. El modelo elige qué calcular y la app calcula; se ve de dónde salió cada número. Solo para la cuenta de Google del dueño |

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
src/lib/analisis/     Métricas, capacidad de ahorro y motor de observaciones
  metricas.ts           agregados, Sankey, cuotas, drill-down por comercio
  ahorro.ts             capacidad, proyección, fondo de emergencia, escenarios
  insights.ts           reglas de observación
src/lib/db/           IndexedDB (Dexie) detrás de un repositorio
src/lib/design/       Paleta validada para daltonismo y contraste
```

**Si vas a tocar el código**, la documentación del repo está en
[`docs/`](docs/): la arquitectura y sus fronteras, el glosario del dominio, las
decisiones (ADRs) y los playbooks de las tareas que se repiten. Las reglas
duras, cortas, están en [`AGENTS.md`](AGENTS.md).

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

**El mes de un gasto es el del resumen, no el de la compra.** BBVA repite la
fecha de la compra original en cada cuota: la cuota 3/12 de algo comprado el
14/05 llega fechada 14/05 en el resumen de julio. Agrupando por fecha de compra,
mayo acumulaba la misma compra una vez por resumen importado y los meses que
realmente la pagan salían en cero. Cada movimiento guarda las dos cosas: `fecha`
es cuándo compraste, `periodo` es qué resumen te lo cobra.

**El período sale del contenido, no del nombre del archivo.** La hoja se llama
`Mov_Periodo_29-08-2026`, que es la fecha de descarga: dos resúmenes distintos
bajados el mismo día traen el mismo nombre y colapsaban en un solo mes. El
período es el mes donde cae la mayoría de los consumos, que además es como uno
los llama ("el resumen de junio").

**Lo que ya importaste no es compromiso futuro.** Una compra en cuotas aparece
en todos los resúmenes hasta que se termina de pagar. Proyectar desde cada
aparición contaba la misma compra una vez por resumen — dos cuotas 4/12 del
mismo comercio en agosto. Las cuotas se agrupan por plan (comercio + cantidad de
cuotas + mes de la primera) y se proyectan solo desde la más reciente, y solo
más allá del último resumen que tenés.

**Los importes llevan signo.** El resumen trae devoluciones en negativo y su
suma aritmética da el total declarado. Pasarlas por `Math.abs()` las convertía
en gasto: te inflaba el mes justo cuando el banco te había devuelto la plata.

**Una tarjeta se sabe por dónde termina, no por la fila.** La columna
"Nro. Tarjeta" viene vacía en cada consumo; el número aparece recién en la fila
`Total Tarjeta Nro ****XXXX` que cierra la sección. Cada subtotal se valida
contra sus propios movimientos, aparte del checksum general.

**01/01/0001 no es una fecha.** Es el hueco que deja BBVA en ajustes y
devoluciones. Leída literal generaba un mes fantasma de 2001 en el selector.
Esos movimientos toman la fecha de cierre del resumen y quedan marcados con
`fechaEstimada`.

**El id de operación no es parte del nombre del comercio.** "CURSOR, AI POWER
in1Tm5auB4TZW" cambia de id todos los meses. Sin sacarlo, el mismo comercio
generaba una clave distinta cada mes: la memoria no aprendía y una suscripción
mensual nunca se detectaba como gasto fijo. Cuando la semilla acierta, además,
la clave pasa a ser el nombre canónico — BBVA trunca el campo distinto cada mes
("MICROSOFT*PC GAME PASS" vs "Microsoft*PC Gam Microsoft*PC") y si no serían dos
comercios.

**Los movimientos internos no son gasto.** El pago de la tarjeta aparece como
débito en el resumen de cuenta y sus consumos en el de tarjeta. Sumar ambos
duplicaría el mes entero, así que las transferencias propias van a una clase
aparte que no computa.

**La descripción cruda del banco nunca se pisa.** Todo lo derivado (comercio,
categoría, naturaleza) se puede recalcular sin volver a subir nada.

**Ninguna observación sin un número que la respalde.** "Cuidá tus gastos" es
ruido. "Gastronomía está 61% arriba de tu promedio, son $19.569 de más" es
accionable. Si una regla no tiene datos suficientes para calcular la
comparación, no se dispara.

**Las observaciones no recomiendan instrumentos de inversión.** La sección de
Ahorro calcula cuánta plata te queda libre y qué pasaría si recortaras un gasto
— aritmética sobre tus propios datos. Dónde poner esa plata depende de tu
situación completa y de tu tolerancia al riesgo, y corresponde a un asesor
matriculado; el código no opina sobre eso a propósito.

### Sobre los datos

La app **nunca inventa un número**. Todo lo que ves sale de un archivo que
importaste: no hay datos de ejemplo, ni valores por defecto, ni estimaciones que
rellenen un hueco. Si falta un dato, la métrica muestra "—" y dice qué hace
falta cargar.

Los tests sí construyen planillas sintéticas en memoria (`xlsFalso(...)` en
`bbva-xls.test.ts`). Eso es distinto: sirven para verificar casos que un archivo
real no te da — una fecha imposible como 31/02, las columnas cambiadas de orden,
un archivo corrupto, un total que no cuadra. Nunca tocan la base de la app ni
salen del proceso de test.

### Limitaciones conocidas

- Solo lee el export de **tarjeta** de BBVA. El de cuenta (con los ingresos)
  todavía no: por eso "Te sobra" aparece vacío si solo cargaste tarjetas.
- Los consumos en dólares **no se convierten a pesos** (el resumen no trae
  cotización). Se muestran aparte para que no desaparezcan del análisis.
- La sincronización entre dispositivos es manual, por el respaldo en tu Google
  Drive (botón del encabezado). No hay sincronización automática.
