# El agente

Un agente es un modelo de lenguaje con herramientas y un bucle. Nada más que
eso — y la mayoría de lo que hay que entender está en por qué cada una de las
tres partes hace lo que hace y no otra cosa. Este documento es el diseño de
`src/lib/ia/` y, a la vez, el material para aprenderlo.

## El bucle

```
  pregunta ─▶ modelo ─▶ ¿pide herramientas? ─sí─▶ se ejecutan ─▶ resultados ─▶ modelo …
                             │ no
                             ▼
                        respuesta
```

El modelo **decide** qué herramienta usar y con qué parámetros; el código
**decide qué herramientas existen**, las ejecuta y corta cuando se pasa de
vueltas. Ninguna de las dos partes puede hacer el trabajo de la otra: el modelo
no puede tocar la base ni sumar por su cuenta, y el código no interpreta la
pregunta. Esa separación es toda la seguridad del diseño.

Está entero en `src/lib/ia/agente.ts`, y son ~40 líneas. Si te parece poco para
llamarse "agente", esa es la lección: lo difícil no es el bucle, es lo que hay
alrededor.

## Por qué el modelo no calcula

La regla del repo es que **la app nunca inventa un número**, y un LLM es una
máquina de producir números plausibles. Tres capas lo sostienen:

1. **Las herramientas devuelven totales.** `buscar_movimientos` trae
   `sumaTotal`; `comparar_meses` trae `variacionPct`. Si el modelo necesita un
   número, hay una herramienta que lo calcula con el mismo código que usa el
   dashboard. Un modelo que suma a mano se equivoca; uno que pide la suma, no.
2. **El sistema le prohíbe calcular** (`src/lib/ia/sistema.ts`): "todo número
   que digas tiene que salir textual de un resultado de herramienta".
3. **Se verifica después** (`src/lib/ia/respaldo.ts`): `numerosSinRespaldo()`
   busca en la respuesta las cifras de plata, porcentajes y números grandes, y
   marca los que no aparecen en ningún resultado ni en la pregunta. La UI los
   muestra como "esto no salió de tus datos". Es una red, no una demostración —
   un prompt no es una garantía y este chequeo tampoco, pero juntos cuestan poco
   y agarran mucho.

La consecuencia de diseño es que **la fuente de verdad de una respuesta son los
resultados de las herramientas**, no el texto del modelo. La pantalla tiene que
mostrarlos.

## Las piezas

| Archivo | Qué es | Depende de |
|---|---|---|
| `src/lib/ia/tipos.ts` | El **puerto**: qué le pedimos a un modelo (`responder(peticion)`) y qué devuelve (texto y/o llamadas). Sin ningún proveedor adentro | nada |
| `src/lib/ia/herramientas.ts` | El **catálogo**: cada herramienta envuelve una función del dominio que ya existe y ya está testeada. Valida la entrada y devuelve salidas compactas | `analisis/`, `categorize/` |
| `src/lib/ia/sistema.ts` | El **system prompt**: reglas, cómo están los datos, meses y categorías. Determinístico byte a byte | `categorize/` |
| `src/lib/ia/agente.ts` | El **bucle** | todo lo anterior |
| `src/lib/ia/respaldo.ts` | El control de números | — |
| `src/lib/ia/proveedores/falso.ts` | Un modelo de mentira que sigue un guion: con él se testea todo sin red ni key | `tipos.ts` |
| `src/lib/ia/proveedores/anthropic.ts` | El **adaptador** real: traduce el puerto a la API de Messages y de vuelta. Único archivo que importa el SDK | `@anthropic-ai/sdk` |
| `src/lib/ia/clave.ts` | La key y el modelo elegido, en `localStorage` | — |
| `src/lib/ia/index.ts` | Lo único que el resto de la app importa. El lint lo hace cumplir | — |
| `src/components/Preguntar.tsx` | La pantalla: key, pregunta, y la respuesta con sus fuentes | `@/lib/ia` |

`lib/ia` es una capa con la misma regla que `lib/nube`: **es la única que puede
hablar con un modelo**. Nadie más importa un SDK de IA, y nadie importa de
`lib/ia` otra cosa que su `index.ts` (`eslint.config.mjs`, zona `plata/ia`).

## Las herramientas que hay

| Herramienta | Contesta | Envuelve |
|---|---|---|
| `resumen_del_mes` | cuánto gasté, cuánto me sobró, cómo me fue | `resumenDe()` |
| `gasto_por_categoria` | en qué gasté, qué pesa más | `gastoPorCategoria()` |
| `comercios_de_categoria` | en qué se me fue la plata de X | `comerciosDeCategoria()` |
| `top_comercios` | dónde gasto más | `topComercios()` |
| `comparar_meses` | gasté más o menos que el mes pasado, qué subió | `variacionPorCategoria()` |
| `serie_mensual` | cómo viene el año, en qué mes gasté más | `serieMensual()` |
| `cuotas_comprometidas` | cuánto debo en cuotas, qué me viene | `cuotasComprometidas()` |
| `buscar_movimientos` | cuánto gasté en Rappi, hay algo mayor a X | filtro + suma |

Los errores de entrada —un mes que no existe, una categoría mal escrita— se le
**devuelven al modelo como texto** en vez de tirarse: los lee y se corrige solo
("Meses disponibles: 2026-07, 2026-08"). Es la diferencia entre un agente que se
traba y uno que reintenta.

Para agregar una: [`playbooks/agregar-una-herramienta-al-agente.md`](playbooks/agregar-una-herramienta-al-agente.md).

## Qué sale de tu máquina

Con un proveedor remoto (fase 1, Anthropic con tu propia key), en cada vuelta
viajan: el sistema (reglas, meses, la lista de categorías), tu pregunta, las
definiciones de las herramientas, y **los resultados de las herramientas que el
modelo pidió** — agregados por categoría o comercio, y en `buscar_movimientos`
los movimientos que coinciden (fecha, comercio, monto). Nunca la base entera,
nunca la descripción cruda del banco, nunca nada que el modelo no haya pedido.

No es "nada sale de tu máquina" (ADR 0001). Es "sale lo que preguntás y lo que
hace falta para contestarlo", bajo tu key, opt-in. Está escrito en el
[ADR 0011](decisiones/0011-agente-con-tu-propia-key.md).

## El adaptador de Anthropic

`proveedores/anthropic.ts` es la traducción entre nuestro puerto y la API de
Messages. Lo que hace, y por qué, en el orden en que arma la petición:

- **`system` con punto de caché** (`cache_control: ephemeral`). El sistema y las
  herramientas son idénticos en cada vuelta; con el punto de caché ahí, a partir
  de la segunda vuelta ese prefijo se cobra al 10%. Por eso `armarSistema()` es
  determinístico: un byte distinto y el caché no aplica.
- **`strict: true` en cada herramienta.** La API garantiza que la llamada cumple
  el JSON Schema o no la hace. Sin esto validás a mano y el modelo se equivoca en
  el nombre de un campo cada tanto.
- **Pensamiento adaptativo y `effort: medium`.** El modelo decide cuánto razonar
  antes de elegir herramientas; elegir sobre un catálogo de ocho no necesita
  mucho. Haiku 4.5 es de otra generación y no acepta ninguna de las dos cosas —
  mandárselas es un error 400, así que el adaptador las omite para ese modelo.
- **`crudo`**: lo que el modelo devolvió se guarda tal cual en el mensaje del
  asistente y se le devuelve tal cual en la vuelta siguiente. Ahí van sus bloques
  de razonamiento, que la API exige intactos. El agente no los entiende ni los
  necesita: solo los repite. Es la razón de que el puerto tenga ese campo opaco.
- **Los errores se traducen** de la clase del SDK a algo que se pueda leer y
  resolver: key inválida, sin crédito, límite de uso, sin conexión. De lo más
  específico a lo más general, porque todas heredan de la misma.

Se prueba **sin red**: el SDK acepta un `fetch` propio, y el test le pasa uno que
guarda la petición y contesta con una respuesta armada a mano. Así se verifica la
traducción completa —qué JSON sale, qué vuelve— sin gastar un token. Es una
técnica general para cualquier cliente HTTP, no solo este.

## La key y lo que cuesta

La key la pegás una vez por navegador y queda en `localStorage` (`clave.ts`).
**No va a la base de Dexie** a propósito: la base entera viaja en el respaldo de
Drive, y una key dentro de un respaldo es una key en un archivo que no
controlás. Tampoco va al repo ni a Vercel: nada que empiece con `NEXT_PUBLIC_`,
porque eso termina dentro del JavaScript que descarga cualquiera.

El SDK exige `dangerouslyAllowBrowser: true` para correr en el navegador. El
nombre asusta con razón: exponer **tu** key en una app de **terceros** es
peligroso. Acá la key es del usuario, en su navegador, y no viaja a nadie más que
a Anthropic — el "peligro" no aplica. La protección que sí importa es externa:
un tope de gasto mensual en la consola, para que aunque se filtre el daño tenga
techo.

Cada respuesta muestra abajo los tokens de entrada (y cuántos vinieron del
caché), los de salida y el costo estimado. Los precios de lista están en
`MODELOS`, en `anthropic.ts`, con la fecha en que se tomaron. Una pregunta
típica —dos vueltas, ~1.500 tokens de sistema, ~200 de salida— cuesta alrededor
de un centavo con Opus 5, y bastante menos con los otros dos.

## La pantalla

`Preguntar.tsx` muestra la respuesta en un orden deliberado: primero el texto del
modelo **con sus cifras sin respaldo marcadas**, y debajo "De dónde salió" — cada
herramienta que se ejecutó, con qué parámetros, y la tabla con lo que devolvió.
Esas tablas las calculó la app; el texto es la explicación. Si hay una marca, la
pantalla lo dice: fiate de las tablas.

Mientras el modelo trabaja, `alPaso` va mostrando las herramientas a medida que
se ejecutan: se ve al agente decidir.

## Cómo se prueba sin key

`proveedorFalso()` sigue un guion: `llama(...)` hace que el "modelo" pida una
herramienta, `dice(...)` que responda con texto. Con eso los tests de
`src/lib/ia/agente.test.ts` verifican el bucle entero —que ejecuta lo que se le
pide, que devuelve todos los resultados de una vuelta juntos, que un error vuelve
como texto, que corta a las N vueltas, que detecta un número inventado— en
milisegundos y sin red. Es lo que permite cambiar de proveedor sin miedo: si el
bucle pasa con el falso, lo que falla es el adaptador.

## Glosario, en el orden en que lo vas a necesitar

**Token** — La unidad en que el modelo lee y cobra: ~¾ de palabra en castellano.
Todo lo que viaja (sistema, pregunta, herramientas, resultados) se cuenta en
tokens; por eso las herramientas devuelven listas cortas y pesos redondeados.

**Ventana de contexto** — Cuánto puede tener presente el modelo a la vez. Lo que
se manda en cada vuelta es *toda* la conversación de nuevo: la API no recuerda.

**System prompt** — Lo que el modelo sabe antes de leer la pregunta. Es el lugar
de las reglas, y conviene que sea estable byte a byte (siguiente punto).

**Prompt caching** — Los proveedores cachean el prefijo de la conversación si es
idéntico al de la petición anterior; una fecha de hoy o un id al azar en el
sistema lo invalida y pagás todo de nuevo. Por eso `armarSistema()` es
determinístico.

**Tool use** (o *function calling*) — El modelo no ejecuta nada: devuelve "quiero
llamar a `X` con estos parámetros" y espera. El código ejecuta y le devuelve el
resultado. Cada proveedor lo escribe distinto; `tipos.ts` es la forma común.

**Esquema estricto** — Los parámetros de cada herramienta se declaran en JSON
Schema con `additionalProperties: false` y todo en `required`; el proveedor
garantiza que el modelo cumple el esquema o no llama. Lo opcional se modela como
`["tipo", "null"]`. Un test verifica que todas cumplan.

**Vuelta** — Una ida y vuelta con el modelo. `maxVueltas` es el freno: un agente
que no para es un agente que factura.

**Agente vs. pipeline** — Un pipeline hace siempre los mismos pasos; un agente
elige los pasos según la pregunta. Esto es un agente porque el modelo elige qué
herramientas llamar y en qué orden — pero uno acotado a propósito: las
herramientas no tienen efectos, solo leen.

**Embeddings** — Convertir un texto en un vector de números tal que textos
parecidos quedan cerca. Es lo que va a permitir "movimientos parecidos a este" y
categorizar por similitud lo que la cascada dejó en "sin categorizar" (fase 2).
No es un LLM: no genera texto, y corre en el navegador.

**RAG** — *Retrieval-Augmented Generation*: buscar los fragmentos relevantes de
un corpus (por embeddings) y dárselos al modelo para que responda con ellos.
Sirve para **texto** — documentos, contratos, facturas —, no para tablas: para
"cuánto gasté" la respuesta exacta la da una consulta, no una búsqueda por
parecido. Fase 3, si entra la sección Documentos.

**Evaluación (eval)** — Un conjunto de preguntas con su respuesta esperada, para
medir si un cambio de prompt, de herramientas o de modelo mejoró o empeoró. Sin
esto se "mejora" a ojo, que es la forma de empeorar sin darse cuenta. Tus propias
preguntas reales son la mejor semilla.

## Las fases

| | Qué | Estado |
|---|---|---|
| 0 | Puerto, herramientas, bucle, control de números, proveedor falso, tests, frontera en el lint | **hecha** |
| 1 | Adaptador Anthropic (tu key en el navegador, opt-in), pantalla "Preguntar" que muestra los resultados de las herramientas como fuente y el texto como explicación, tokens y costo por pregunta | **hecha** |
| 2 | Embeddings locales (en el navegador): herramienta "movimientos parecidos" y el paso *similitud* en la cascada de categorización | siguiente |
| 3 | Documentos adjuntos + RAG con citas | si entra Documentos |
| 4 | El agente desde afuera de la app (un backend chico que lee tu respaldo) | supersede 0001 entero |

Cada fase deja algo usable y termina con `npm run lint && npm run typecheck && npm test`.
