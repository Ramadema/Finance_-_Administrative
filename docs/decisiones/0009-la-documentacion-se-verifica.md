# 0009 — La documentación se verifica, no se promete

## Contexto

La documentación de un repo se desactualiza de una forma particular: nadie la
rompe, simplemente el código sigue y ella se queda. Nada falla. Se descubre
meses después, cuando alguien confía en un número que ya no es cierto.

Este repo ya tenía el caso el día que se escribió `docs/`: el `README.md` decía
"150 tests" y hacía rato eran 160. <!-- histórico: ese 150 es la anécdota, no un
dato vigente --> Nadie mintió — el número era cierto cuando se escribió.

Con agentes escribiendo el código el problema se acelera, y además aparece uno
nuevo: un agente **no se acuerda**. Cada sesión arranca de cero. "Acordate de
actualizar los docs" no es una instrucción que sobreviva a cerrar la ventana.
Lo que sobrevive es lo que está escrito en un archivo que se lee siempre, y lo
que falla cuando no se cumple.

## Decisión

Tres capas, de la más blanda a la más dura:

1. **La regla, en `AGENTS.md`** — se lee en cada sesión: la documentación se
   actualiza en el mismo commit, con una tabla de qué tocar según lo que
   cambiaste.
2. **`npm run docs:check`** (`scripts/docs-al-dia.mjs`) — verifica lo que se
   puede verificar sin leer el sentido: que las rutas y los links que la
   documentación cita existan, que todo ADR y playbook esté en su índice, y que
   los números que afirma (cantidad de tests, versión del esquema, versión del
   respaldo) coincidan con el código. Corre en CI y al cerrar cada sesión.
3. **Un hook antes del commit** — si lo que se está por commitear toca algo de
   la lista corta que casi nunca se puede cambiar sin documentar (el esquema, la
   taxonomía, las secciones, las fronteras, una dependencia) y ningún archivo de
   documentación se movió, el commit se frena con la lista de qué actualizar.

La lista de disparadores es **corta a propósito**: un aviso que salta en cada
cambio se ignora en cada cambio, y ahí se pierde todo. Por la misma razón hay
salida: `DOCS_OK=1 git commit …` cuando de verdad no hay nada que registrar.

## Consecuencias

- La documentación desactualizada pasa de descubrirse por accidente a fallar en
  CI, que es cuando todavía es barata de arreglar.
- Los números que la documentación afirma quedan atados al código que los
  decide: si cambia uno, salta el otro.
- **Se paga en dos monedas.** Los números verificados dependen de anclas de
  texto: si alguien reescribe la frase que los contiene, el chequeo avisa que
  perdió el ancla y hay que ajustar el patrón — molesto, pero mejor que un
  chequeo que dejó de mirar y sigue dando verde. Y el aviso del commit solo
  puede ver **que** un doc cambió, nunca si lo que dice ahora es correcto: eso
  sigue siendo trabajo de quien escribe.
- El escape existe y se puede abusar. Es a propósito: la alternativa —no tener
  salida— termina en gente commiteando con `--no-verify` y en un chequeo que
  todos aprendieron a saltear.

## Cómo se verifica

`npm run docs:check`. Los hooks están en `.claude/hooks/` y el paso de CI en
`.github/workflows/ci.yml`. El chequeo se probó contra los dos casos que tiene
que agarrar: un link a un archivo que no existe y un cambio de esquema sin docs.
