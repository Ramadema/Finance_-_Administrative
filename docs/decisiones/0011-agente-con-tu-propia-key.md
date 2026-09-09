# 0011 — Un agente de consulta, con tu propia key, sin servidor

## Contexto

El dashboard contesta las preguntas que alguien pensó de antemano. Las que no
—"¿gasté más en delivery que el promedio?", "¿qué me viene en cuotas si compro
esto?"— obligan a abrir Movimientos y sumar a ojo. Y hay una segunda razón,
explícita: este tramo del proyecto es para **aprender** cómo se construye un
agente y qué implica, con datos propios y un problema real.

Dos restricciones ya decididas lo enmarcan: el proyecto es gratis y estático
(Vercel, sin servidor, [0001](0001-todo-corre-en-el-navegador.md)) y tiene que
poder usarse desde el teléfono o desde cualquier lado — lo que descarta un
modelo local, que solo existe donde esté instalado.

Y una tensión: un LLM es una máquina de producir números plausibles, en una app
cuya regla central es no inventar ninguno.

## Decisión

Un agente que corre **en el navegador**, con estas propiedades:

- **El modelo no calcula.** Tiene herramientas que envuelven las funciones del
  dominio que ya existen (`resumenDe`, `gastoPorCategoria`, …) y que devuelven
  totales y porcentajes ya calculados. El sistema le prohíbe sumar a mano, y
  `numerosSinRespaldo()` marca en la respuesta cualquier cifra que no haya salido
  de una herramienta. La fuente de verdad de la respuesta son los resultados de
  las herramientas; el texto del modelo es la explicación.
- **La key es del usuario**, pegada en la app y guardada en su navegador. No hay
  key nuestra, no hay servidor, no hay costo para el proyecto: cada uno paga sus
  centavos. En cada dispositivo hay que pegarla una vez.
- **Opt-in.** Sin key la función no aparece, y la app entera sigue igual.
- **Puerto y adaptadores.** `src/lib/ia/tipos.ts` define qué le pedimos a un
  modelo; Anthropic es un adaptador, y un guion de test es otro. El resto de la
  app solo conoce `preguntar()`. Cambiar de proveedor —o agregar un modelo
  local para quien quiera— no toca el dominio ni la UI.
- **`lib/ia` es la única capa que habla con un modelo**, como `lib/nube` es la
  única que habla con Drive. Lo verifica el lint.

## Consecuencias

- **Acota a [0001](0001-todo-corre-en-el-navegador.md).** "Tus movimientos nunca
  salen de tu máquina" pasa a ser: *nunca salen salvo que le preguntes al agente,
  y entonces sale tu pregunta y lo que hace falta para contestarla* — agregados
  por categoría o comercio, y en una búsqueda, los movimientos que coinciden.
  Nunca la base entera ni la descripción cruda. Bajo tu key y tu decisión. El
  README tiene que decirlo con esas palabras.
- Se puede usar desde cualquier dispositivo que tenga la app y la key: el
  teléfono incluido, con los datos que llegan por el respaldo de Drive.
- El costo es de centavos por mes para uso personal, y lo paga cada usuario.
- **Se paga**: una función depende de un tercero (si la API cae, esa función no
  anda); la key vive en `localStorage`, así que quien tenga acceso a ese
  navegador tiene acceso a la key; el control de números es una heurística —
  agarra cifras de plata y porcentajes, deja pasar cantidades chicas—, no una
  demostración.
- Lo que se aprendió construyendo el núcleo quedó escrito en
  [`../agente.md`](../agente.md), que es a la vez el diseño y el material de
  estudio.

## Cómo se verifica

`src/lib/ia/*.test.ts` prueba el bucle entero con un proveedor de mentira, sin
red ni key. El lint (zona `plata/ia`) impide que otra capa importe un SDK de
modelo o algo de `lib/ia` que no sea su `index.ts`.
