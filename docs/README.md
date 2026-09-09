# Documentación del proyecto

Documentación **del repo**, para quien lo modifica —vos o un agente—. La
documentación de uso vive en el `README.md` de la raíz y no se duplica acá.

| Archivo | Qué contesta | Cuándo se lee |
|---|---|---|
| [`arquitectura.md`](arquitectura.md) | Dónde va cada cosa y por qué las capas no se cruzan | Antes de crear un archivo nuevo |
| [`dominio.md`](dominio.md) | Qué significa cada palabra del dominio (`periodo`, naturaleza, plan de cuotas…) | Antes de nombrar algo o de tocar una métrica |
| [`decisiones/`](decisiones/) | Por qué el código es así y qué se rompe si lo cambiás | Antes de "arreglar" algo que parece raro |
| [`playbooks/`](playbooks/) | Cómo hacer una tarea que ya se hizo antes, paso a paso | Antes de empezar la tarea |

Las reglas duras están en [`../AGENTS.md`](../AGENTS.md), corto a propósito.
Acá está el porqué; allá, el qué.

## Cómo se mantiene

Se actualiza **en el mismo commit que el cambio**, no después. La tabla de qué
tocar según lo que cambiaste está en [`../AGENTS.md`](../AGENTS.md).

- Una decisión que costaría revertir → un ADR en `decisiones/`. No se edita el
  ADR viejo: se escribe uno nuevo que lo supersede.
- Una tarea que hiciste dos veces y saliste a buscar cómo era → un playbook.
- Una regla que un agente puede violar sin darse cuenta → antes que un párrafo
  acá, una regla de lint o un test. La doc explica; el código verifica.
- Al actualizar, **corregí lo viejo en lugar de agregar al final**. Un documento
  que se contradice a sí mismo es peor que uno desactualizado.

`npm run docs:check` verifica lo que se puede verificar: que las rutas y los
links que la documentación menciona existan, que todo ADR y todo playbook esté
en su índice, y que los números que afirma (cantidad de tests, versión del
esquema y del respaldo) sigan siendo ciertos. Corre en CI, al cerrar cada
sesión de Claude y antes de cada commit. El porqué está en
[`decisiones/0009-la-documentacion-se-verifica.md`](decisiones/0009-la-documentacion-se-verifica.md).
