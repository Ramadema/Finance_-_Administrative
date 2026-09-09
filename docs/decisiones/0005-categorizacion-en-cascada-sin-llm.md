# 0005 — Categorización en cascada, sin LLM

## Contexto

Categorizar `"MERPAGO*KIOSCOLASFLOR in1Tm5auB4TZW"` es el problema que un modelo
de lenguaje resolvería en una línea. Pero mandar las descripciones a una API
rompe la promesa de [0001](0001-todo-corre-en-el-navegador.md), necesita una key
y hace que la app deje de funcionar sin internet.

Además, el id de operación (`in1Tm5auB4TZW`) cambia todos los meses: sin
sacarlo, el mismo comercio genera una clave distinta cada vez, la memoria no
aprende y una suscripción mensual nunca se detecta como fija.

## Decisión

Cascada determinística, toda local:

```
regla del usuario → memoria (lo que ya categorizaste) → semilla (~180 comercios
argentinos) → sin categorizar
```

`sin categorizar` es un estado **válido y visible**, no un error: la app te
muestra cuántos quedaron y te deja resolverlos desde Movimientos. Categorizar uno
enseña al resto del histórico de ese comercio.

La clave del comercio se normaliza (sin tildes, sin id de operación, sin ruido)
y, cuando la semilla acierta, pasa a ser el nombre canónico: BBVA trunca el campo
distinto cada mes (`"MICROSOFT*PC GAME PASS"` vs `"Microsoft*PC Gam Microsoft*PC"`)
y si no serían dos comercios.

## Consecuencias

- Funciona sin internet, sin key, gratis, y el mismo input da siempre el mismo
  output — se puede testear de verdad.
- La memoria mejora con el uso y es del usuario.
- **Se paga**: la semilla hay que mantenerla, y un comercio nuevo cae en "sin
  categorizar" hasta que alguien lo resuelva una vez.

## Cómo se verifica

`src/lib/categorize/motor.test.ts` y `normalizar.ts` (incluido el caso del id de
operación que cambia todos los meses).
