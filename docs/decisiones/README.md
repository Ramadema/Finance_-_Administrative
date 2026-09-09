# Decisiones (ADRs)

Cada archivo es **una** decisión que costaría revertir, con el problema que la
motivó. Sirven para lo mismo que un cartel de "no tocar": cuando algo del código
parece innecesariamente raro, casi siempre es raro a propósito y acá está el
caso que lo obligó.

## Formato

Numerados y en orden, `NNNN-titulo-en-kebab.md`, con cuatro secciones:
**Contexto** (qué pasaba), **Decisión** (qué se hace), **Consecuencias** (qué se
gana y qué se paga), **Cómo se verifica** (el test o la regla que la sostiene).

Un ADR no se edita cuando cambia de opinión: se escribe uno nuevo que lo
supersede y el viejo queda marcado. La historia de por qué se pensó distinto
vale tanto como la conclusión.

## Índice

| # | Decisión | Estado |
|---|---|---|
| [0001](0001-todo-corre-en-el-navegador.md) | Todo corre en el navegador | Vigente |
| [0002](0002-importes-como-texto-en-formato-argentino.md) | Los importes son texto en formato argentino | Vigente |
| [0003](0003-el-mes-es-el-del-resumen.md) | El mes de un gasto es el del resumen | Vigente |
| [0004](0004-fijo-se-detecta-no-se-etiqueta.md) | Fijo se detecta, no se etiqueta | Vigente |
| [0005](0005-categorizacion-en-cascada-sin-llm.md) | Categorización en cascada, sin LLM | Vigente |
| [0006](0006-respaldo-en-drive-sin-backend.md) | Respaldo en Drive sin backend | Vigente |
| [0007](0007-las-fronteras-viven-en-el-lint.md) | Las fronteras viven en el lint | Vigente |
| [0008](0008-migracion-incremental-a-modulos.md) | Migración incremental a módulos por dominio | Vigente |
| [0009](0009-la-documentacion-se-verifica.md) | La documentación se verifica, no se promete | Vigente |
| [0010](0010-ninguna-dependencia-sin-usar.md) | Ninguna dependencia declarada sin usar | Vigente |
