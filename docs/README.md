# Documentación del proyecto

Documentación **del repo**, para quien lo modifica —vos o un agente—. La
documentación de uso vive en el `README.md` de la raíz y no se duplica acá.

| Archivo | Qué contesta | Cuándo se lee |
|---|---|---|
| [`arquitectura.md`](arquitectura.md) | Con qué está hecho, cómo fluye la plata desde el `.xls` hasta la pantalla, y dónde va cada cosa nueva | Antes de crear un archivo nuevo |
| [`dominio.md`](dominio.md) | Qué significa cada palabra del dominio (`periodo`, naturaleza, plan de cuotas…) | Antes de nombrar algo o de tocar una métrica |
| [`agente.md`](agente.md) | Cómo está hecho el agente de consulta y qué hay que saber de LLMs, herramientas, embeddings y RAG para tocarlo | Antes de tocar `src/lib/ia/`, o para aprender |
| [`decisiones/`](decisiones/) | Por qué el código es así y qué se rompe si lo cambiás | Antes de "arreglar" algo que parece raro |
| [`playbooks/`](playbooks/) | Cómo hacer una tarea que ya se hizo antes, paso a paso | Antes de empezar la tarea |

Las reglas duras están en [`../AGENTS.md`](../AGENTS.md), corto a propósito.
Acá está el porqué; allá, el qué.

## Si te sumás al proyecto

En este orden, media hora:

1. **[`../README.md`](../README.md)** — qué hace la app y para qué sirve cada
   sección. Sin esto, el resto no se entiende.
2. **[`arquitectura.md`](arquitectura.md)** — con qué está hecho, los cuatro
   caminos que recorre un dato (importar, pintar, corregir, respaldar), las
   capas y qué puede tocar cada una.
3. **[`dominio.md`](dominio.md)** — el vocabulario. `periodo` no es `fecha`,
   "fijo" no es una etiqueta. Casi todos los errores caros salen de acá.
4. **[`../AGENTS.md`](../AGENTS.md)** — las reglas para escribir código, con los
   invariantes de plata que no se rompen.

Después, por necesidad: [`decisiones/`](decisiones/) cuando algo del código
parezca raro —casi siempre es raro a propósito— y [`playbooks/`](playbooks/)
cuando vayas a hacer algo que ya se hizo antes.

Para levantar el proyecto: `npm install && npm run dev`. Arranca vacío, sin
datos de ejemplo — necesitás un `.xls` de tu banco para ver algo.

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
