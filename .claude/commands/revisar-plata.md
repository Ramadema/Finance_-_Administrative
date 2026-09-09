---
description: Audita el diff actual contra los invariantes de plata del repo
allowed-tools: Bash(git diff:*), Bash(git status:*), Bash(npm run lint), Bash(npm run typecheck), Bash(npm test), Read, Grep, Glob
---

## Diff a revisar

!`git status --short`

!`git diff --stat HEAD`

!`git diff HEAD -- src`

## Tu tarea

Revisá ese diff **solo** contra los invariantes de `AGENTS.md` y `docs/`. No es
un code review general: buscás errores de plata, que son los caros.

1. **Parseo de importes** — ¿algún número del banco que no pase por
   `parseImporteAR()`? ¿Algún `parseFloat`, `Number()` o `+cadena` sobre un
   campo del Excel?
2. **Signos** — ¿algún `Math.abs()` sobre un monto de gasto? Las devoluciones
   son negativas a propósito.
3. **`periodo` vs `fecha`** — ¿alguna agrupación mensual por `fecha`? Todo lo
   mensual va por `periodo`.
4. **Clase de flujo** — ¿algún total que sume `ingreso`, `ahorro` o `interno`
   como si fuera gasto? Solo `gasto` suma.
5. **`excluido`** — ¿alguna cuenta nueva que se olvide de filtrarlos?
6. **Números inventados** — ¿algún `?? 0`, valor por defecto o estimación que
   tape un dato faltante? Sin dato va `null` arriba y `—` en pantalla.
7. **Observaciones sin respaldo** — ¿alguna regla de insight que se dispare sin
   el número que la justifica?
8. **Fronteras** — ¿la UI abriendo la base, el dominio importando React, un
   `eslint-disable` de frontera nuevo?
9. **Tests** — cada cuenta nueva o modificada, ¿tiene su caso? ¿Están los bordes
   (mes vacío, un solo mes, monto negativo, cuotas repetidas entre resúmenes)?

Para cada hallazgo: archivo y línea, qué invariante rompe, y el número
concreto que saldría mal. Si no hay ninguno, decilo en una línea y no inventes
observaciones de relleno.

Cerrá corriendo `npm run lint && npm run typecheck && npm test`.
