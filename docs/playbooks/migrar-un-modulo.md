# Migrar un módulo

Cómo se pasa un dominio de la estructura por capas a la estructura por módulos
([decisión 0008](../decisiones/0008-migracion-incremental-a-modulos.md)).

**Cuándo:** cuando ya tenés que tocar ese dominio por otra razón. No se migra
"para dejarlo prolijo": la reestructuración sin motivo es riesgo sin beneficio.

## La forma de llegada

```
src/modules/<dominio>/
  dominio/     cálculo puro, sin React ni base       ← lo que hoy está en lib/analisis
  datos/       lo único que toca Dexie de este módulo ← lo que hoy está en lib/db/repo
  ui/          componentes propios del módulo
  index.ts     API pública: lo único que otros módulos importan
  AGENTS.md    reglas del módulo, si tiene alguna propia
```

Candidatos naturales, en el orden en que conviene: `fijos/`, `ahorro/`,
`observaciones/`, `movimientos/`.

## Pasos

1. **Empezá por los tests.** Movelos primero y dejalos pasando; son la red de la
   migración entera.
2. **Mové el cálculo puro** desde `lib/analisis/*` a `<modulo>/dominio/`. Es
   mudanza, no reescritura: si aprovechás para "mejorar" una fórmula, el diff
   deja de ser verificable.
3. **Mové las funciones de datos** desde `lib/db/repo.ts` a `<modulo>/datos/`,
   solo las que son de este dominio. El esquema Dexie sigue siendo uno solo y
   compartido: no se parte.
4. **Escribí `index.ts`** exportando lo mínimo que el resto necesita. Todo lo
   demás queda privado del módulo — ahí está la ganancia real.
5. **Actualizá los imports** de quienes lo usaban, incluido `DatosContext`.
6. **Agregá la regla de lint** en `eslint.config.mjs`: nadie importa un archivo
   interno del módulo, solo su `index.ts`. Sin esa regla, en dos semanas hay
   imports profundos y el módulo no existe más.
7. **Aflojá el contexto:** si el cálculo del módulo ya no lo necesitan otras
   secciones, sacalo del `useMemo` de `DatosContext` y que lo consuma su propia
   página.

## Reglas de la migración

- **Un módulo por commit**, y el commit no cambia comportamiento. Si además hay
  una feature, van en dos commits.
- `npm run lint && npm run typecheck && npm test` en verde al terminar.
- Ningún módulo queda a medio migrar entre dos commits.
- Cuando migres el primero, actualizá [`../arquitectura.md`](../arquitectura.md):
  la doc describe lo que hay, no lo que se pretende.
