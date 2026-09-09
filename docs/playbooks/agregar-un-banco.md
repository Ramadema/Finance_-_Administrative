# Agregar un banco (o un export nuevo)

Hoy se lee **un** formato: el export de tarjeta de BBVA. El resumen de cuenta —el
que trae los ingresos— es el hueco más grande de la app.

## El contrato

Un parser recibe un `ArrayBuffer` y devuelve `ResultadoParseo`
(`src/lib/ingest/tipos.ts`). No toca la base, no toca React: convierte bytes en
`MovimientoCrudo[]` más los totales que el archivo declara. Miralo entero en
`bbva-xls.ts` antes de escribir el tuyo.

## Reglas que no son del banco, son del problema

1. **Las columnas se buscan por NOMBRE, nunca por posición.** El banco cambia el
   orden entre exports y una lectura posicional falla en silencio, con los
   montos corridos de columna.
2. **Todo importe por `parseImporteAR()`** y con su signo
   ([0002](../decisiones/0002-importes-como-texto-en-formato-argentino.md)).
3. **Validá contra el total que declara el propio archivo.** Es lo único que
   detecta un parseo mal hecho el mismo día. Si no cuadra, el import avisa; no
   se traga la diferencia.
4. **El período sale del contenido, no del nombre del archivo**
   ([0003](../decisiones/0003-el-mes-es-el-del-resumen.md)).
5. **Las fechas imposibles no son fechas.** BBVA usa `01/01/0001` como hueco:
   esos movimientos toman la fecha de cierre y quedan con `fechaEstimada: true`.
6. **Ids estables** con `asignarIds()` (`ingest/dedupe.ts`): reimportar el mismo
   archivo no puede duplicar nada.

## Pasos

1. `src/lib/ingest/<banco>-<producto>.ts` con la función de parseo.
2. Su `.test.ts`, con planillas sintéticas (`xlsFalso()` en `bbva-xls.test.ts` es
   el modelo). Casos obligatorios: columnas en otro orden, archivo corrupto,
   fecha imposible, total que no cuadra, importe negativo.
3. Elegir el parser en `importarArchivo()` (`lib/db/repo.ts`) — hoy llama
   directo a `parsearBBVATarjeta`. Detectá el formato por el contenido, no por el
   nombre del archivo.
4. Si el formato trae **ingresos**, revisá que la clase de flujo salga bien:
   `ingreso` suma, `interno` (pago de tarjeta, transferencia propia) no suma
   nada — si no, el mes se cuenta dos veces.
5. Dejá un archivo real en `samples/` (git lo ignora) y corré `npm test`: la
   tanda de regresión contra archivos reales se activa sola.

## Lo que hay que actualizar además

- La sección "Limitaciones conocidas" del `README.md`.
- Las instrucciones de descarga, si el producto nuevo se baja de otro lado.
