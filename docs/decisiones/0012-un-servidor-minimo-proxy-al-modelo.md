# 0012 — Un servidor mínimo: proxy autenticado al modelo

## Contexto

La primera versión del asistente ([0011](0011-agente-con-tu-propia-key.md))
hacía que el navegador llamara a Anthropic directo, con la key del usuario
pegada en la app y guardada en su Drive. Funcionaba, pero pedía algo que no
cierra: que el dueño pegue una credencial en un formulario y confíe en que el
navegador es el lugar para tenerla.

Lo intuitivo —"la key va en una variable de entorno de Vercel"— no servía tal
como estaba el repo, y vale dejar escrito por qué: con `output: "export"` no
hay código nuestro corriendo en el servidor. Los archivos que Vercel reparte son
JavaScript estático, y la única forma de que una variable llegue ahí es
`NEXT_PUBLIC_*`, que **la pega literal dentro del bundle**. Se comprobó con el
Client ID de Google: está en texto plano en `out/_next/static/chunks/…`. Con el
Client ID no importa (es público por diseño); con la key de Anthropic sería
regalar el saldo.

La regla que ordena todo: **la key la tiene quien hace la llamada.** Si llama el
navegador, la tiene el navegador. Si tiene que estar en un lugar que el visitante
no vea, la llamada la tiene que hacer un servidor.

## Decisión

Un servidor **mínimo**: una sola ruta, `POST /api/modelo`
(`src/app/api/modelo/`), que hace tres cosas y nada más:

1. **Verifica quién pregunta.** El navegador manda su token de Google; la ruta
   le pregunta a Google de quién es y compara el email con `DUENO_EMAIL`. Sin
   token, 401; otra cuenta, 403. Sin esto la ruta sería un proxy gratis para
   cualquiera que la encuentre.
2. **Agrega la key** (`ANTHROPIC_API_KEY`, variable de entorno del servidor,
   nunca `NEXT_PUBLIC_`) y llama a Anthropic con el mismo adaptador que ya
   existía — `proveedorAnthropic` se mudó al servidor tal cual.
3. **Devuelve la respuesta del puerto**, que el navegador usa como si el modelo
   hubiera contestado directo (`proveedorProxy`).

**El agente sigue corriendo en el navegador**, con las herramientas sobre los
datos que solo están ahí. La ruta no guarda nada, no lee ninguna base y no
conoce los movimientos: ve lo que el modelo vería de todas formas.

Para que exista la ruta se saca `output: "export"`. Las páginas siguen
prerenderizadas; Vercel corre la app como Next con una función, gratis en el
plan Hobby para uso personal.

## Consecuencias

- **Supersede en parte a [0001](0001-todo-corre-en-el-navegador.md)**: ya no
  es "sin servidor". Es "sin servidor *con datos*": la única función no
  persiste nada y solo existe para guardar una credencial. Todo lo demás de
  0001 sigue en pie.
- **Precisa a [0011](0011-agente-con-tu-propia-key.md)**: la key deja de estar
  en el navegador y en Drive. Quién puede preguntar ya no depende de tener la
  key sino de entrar con la cuenta de `DUENO_EMAIL`.
- El dueño configura dos variables en Vercel y se olvida. En cualquier
  dispositivo: entrar con Google, preguntar.
- **Se paga**: dependencia de las funciones de Vercel (ya no se puede hostear
  como archivos sueltos en GitHub Pages); una ida extra a Google por sesión para
  verificar la identidad (se recuerda cinco minutos); una función que en el plan
  Hobby tiene 60 segundos de tope por pedido; y un pedazo de la app que ya no se
  puede probar abriendo `out/index.html`.
- Google pide un permiso más (`userinfo.email`): una vez, al volver a entrar.

## Cómo se verifica

`src/app/api/modelo/manejador.test.ts` prueba la ruta sin red: 200 con la
cuenta del dueño, 401 sin token o con token vencido, 403 con otra cuenta, 500
si faltan las variables, 400 con un cuerpo inválido — y que en ninguno de los
casos de rechazo se llame a Anthropic. El lint (zona `plata/servidor`) impide
que la ruta toque Dexie, el contexto, la nube o componentes, y que el navegador
importe el adaptador de Anthropic o el SDK.
