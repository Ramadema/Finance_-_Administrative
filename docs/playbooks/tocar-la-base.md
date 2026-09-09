# Tocar la base

Del otro lado hay datos reales de alguien y **no hay servidor que los recupere**.
Un `upgrade` mal escrito no da error: deja movimientos apuntando a algo que ya no
existe y la app muestra números mal.

## Antes de empezar

¿Hace falta cambiar el esquema? Muchas cosas que parecen un campo nuevo son un
cálculo derivado que va en `lib/analisis/`. Guardá solo lo que no se puede
recalcular. Recordá que **`descripcionCruda` es la fuente y no se pisa**: si el
dato se puede volver a derivar de ahí, no es un campo, es una función.

## Migrar el esquema (Dexie)

Está en `src/lib/db/esquema.ts`, hoy en la **versión 5**.

1. **Nunca edites una `version(n)` que ya se publicó.** Alguien la tiene
   aplicada; cambiarla deja su base en un estado que ninguna versión describe.
2. Agregá `this.version(6)` con los `stores` completos (Dexie quiere el esquema
   entero, no el delta) y, si hay que rellenar datos, `.upgrade(tx => …)`.
3. Comentá **qué** hace la migración y **por qué**, como las que ya están: la v3
   rellenó `fechaEstimada` en falso; la v4 remapeó categorías que dejaron de
   existir cuando "Ocio y viajes" se partió en dos.
4. Si borrás o renombrás un id de categoría, hay que remapear lo guardado. Un
   movimiento con una categoría inexistente no explota: cae en "Sin categoría" y
   ensucia todas las métricas sin avisar.

## Actualizar el respaldo

`exportarJSON()` / `importarJSON()` en `lib/db/repo.ts` llevan su propio número
de `version` (hoy **3**), que no es el de Dexie.

- Si agregás una tabla, agregala al export **y** al import.
- **Un respaldo viejo tiene que seguir entrando.** Es el único plan de
  recuperación que existe: si `importarJSON` deja de leer el JSON del mes pasado,
  los datos se perdieron.

## Probar de verdad

1. Con datos reales: abrí la app con la base vieja y verificá que la migración
   corre sin errores en consola y que los números no se movieron.
2. Base vacía: la app arranca y no rompe.
3. Bajá un respaldo **antes** de probar la migración, y probá restaurarlo después.
4. Si hay respaldo en Drive, acordate de que el archivo remoto quedó con el
   formato viejo: la app tiene que poder leerlo igual.

## Verificá

```bash
npm run lint && npm run typecheck && npm test
```
