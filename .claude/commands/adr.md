---
description: Escribe un ADR nuevo en docs/decisiones/ con la decisión que acabamos de tomar
argument-hint: [decisión en una frase]
allowed-tools: Bash(ls:*), Bash(git log:*), Bash(git diff:*), Read, Write, Edit, Grep
---

## ADRs que ya existen

!`ls docs/decisiones/`

## Tu tarea

Escribí un ADR nuevo sobre: **$ARGUMENTS**

(Si no vino nada arriba, usá la decisión que se tomó en esta conversación.)

Antes de escribir, leé un ADR existente para copiar el tono: concreto, con el
problema real que la motivó, sin lenguaje de manual.

1. **Numeralo** con el siguiente número libre: `NNNN-titulo-en-kebab.md`.
2. Cuatro secciones, ni una más: **Contexto** (qué pasaba, con el caso concreto
   que lo obligó — un bug, un número mal, una tarea que se hizo lenta),
   **Decisión** (qué se hace, en imperativo), **Consecuencias** (qué se gana y,
   explícito, **qué se paga** — un ADR sin costo es propaganda), **Cómo se
   verifica** (el test, la regla de lint o el comando que lo sostiene; si no hay
   ninguno, decí que no lo hay).
3. Agregalo al índice de `docs/decisiones/README.md`.
4. Si la decisión **reemplaza** a un ADR anterior, marcá el viejo como
   superseded por el nuevo. No lo edites ni lo borres: la historia de por qué se
   pensó distinto vale tanto como la conclusión.
5. Si además implica una regla nueva para quien escribe código, agregala a
   `AGENTS.md` — corta e imperativa, con el link al ADR.

Escribí en castellano, en la voz del repo.
