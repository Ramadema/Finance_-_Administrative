# Agregar una sección

Una entrada nueva del menú con su pantalla. Lo caro no es la ruta: es que la
sección conteste **una** pregunta que las otras seis no contestan.

## 1. La ruta

`src/app/<ruta>/page.tsx`, con `"use client"`. La página **compone y no
calcula**: saca lo que necesita de `useDatos()` y arma componentes.

Las páginas se prerenderizan y no tienen servidor: nada de segmentos dinámicos
que dependan de datos del servidor, ni server actions, ni leer la base desde
ahí (no hay base ahí). Para "ver el detalle de X", filtrá con estado o con query
params en el cliente, como ya hace Movimientos con la categoría. La única ruta de
servidor es `src/app/api/modelo`, y agregar otra es una decisión que lleva ADR.

## 2. El menú

En `src/components/Nav.tsx`, agregá una entrada a `SECCIONES`:

```ts
{ href: "/ruta", nombre: "Nombre largo", corto: "Corto", Icono: IconoDeLucide }
```

`corto` no es opcional: es lo que se ve en la barra inferior del celular, donde
siete ítems a ancho fijo no entran con las etiquetas largas.

## 3. Los datos

Si la sección necesita un cálculo nuevo, seguí
[`agregar-una-metrica.md`](agregar-una-metrica.md) **antes** de escribir la
pantalla. Si necesita algo que se lee de la base y todavía no se lee, la función
va en `lib/db/repo.ts`; el componente la llama, nunca abre la base.

## 4. Los estados que siempre faltan

La app arranca vacía y esa es la primera pantalla que va a ver alguien:

- **Sin datos importados** — qué hay que hacer para que la sección sirva.
- **Sin ingresos cargados** — todo lo que dependa de ingresos muestra `—`.
- **Con un solo mes** — lo comparativo no puede romper ni mentir.
- **Cargando** — el esqueleto, no un cero que después salta a otro número.

## 5. Verificá

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

El `build` acá sí importa: la página nueva tiene que salir como estática (○),
no como función (ƒ).
