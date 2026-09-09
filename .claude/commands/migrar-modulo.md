---
description: Migra un dominio a la estructura por módulos, un commit sin cambios de comportamiento
argument-hint: [fijos | ahorro | observaciones | movimientos]
allowed-tools: Read, Edit, Write, Grep, Glob, Bash(git status:*), Bash(git diff:*), Bash(npm run lint), Bash(npm run typecheck), Bash(npm test)
---

Leé `docs/playbooks/migrar-un-modulo.md` y
`docs/decisiones/0008-migracion-incremental-a-modulos.md`, y migrá: **$ARGUMENTS**

Las tres reglas que hacen que esto sea seguro:

- **Mudanza, no reescritura.** Si aparece la tentación de mejorar una fórmula
  mientras la movés, anotala y dejala para otro commit: un diff de movimiento
  se revisa leyendo; uno mezclado, no.
- **Cero cambios de comportamiento** en este commit.
- Termina con `index.ts` como única puerta del módulo **y** la regla de lint que
  prohíbe importar sus archivos internos. Sin esa regla, el módulo dura dos
  semanas.

Antes de empezar, decime qué archivos vas a mover y qué va a exportar el
`index.ts`. Después de terminar, actualizá `docs/arquitectura.md` para que
describa lo que hay.
