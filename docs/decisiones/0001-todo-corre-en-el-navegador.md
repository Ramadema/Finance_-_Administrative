# 0001 — Todo corre en el navegador

> **Acotado por [0011](0011-agente-con-tu-propia-key.md)**: si el usuario activa el
> agente con su propia key, sale de su máquina la pregunta y lo que hace falta
> para contestarla. Todo lo demás de este ADR sigue vigente.

## Contexto

La app maneja el resumen de tarjeta completo: cuánto ganás, en qué gastás, dónde
comés, a qué hora, con qué frecuencia. Es de los datos personales más sensibles
que existen. Cualquier arquitectura con servidor obliga a contestar dónde se
guardan, quién los puede leer y qué pasa cuando el servidor se apaga.

## Decisión

Cliente puro. Los movimientos viven en IndexedDB del navegador. `next.config.ts`
usa `output: "export"`: el build son archivos estáticos, sin una sola función de
servidor. No hay API keys en el producto, ni endpoint propio, ni analytics.

## Consecuencias

- La promesa "tus movimientos nunca salen de tu máquina" es verificable mirando
  la pestaña de red, no una política de privacidad.
- Hosting gratis en cualquier lado y para siempre.
- **Se paga**: no hay sincronización entre dispositivos (lo cubre el respaldo,
  [0006](0006-respaldo-en-drive-sin-backend.md)), no hay nada que hacer del lado
  del servidor, y si el usuario limpia los datos del navegador se pierden. Por
  eso la app pide persistencia y avisa cuando el navegador la niega.
- Nada de LLM en el producto: mandar los movimientos a una API rompería la
  promesa central. Si algún día se hace, es una decisión nueva y explícita, no
  un detalle de implementación.

## Cómo se verifica

`npm run build` tiene que seguir escribiendo `out/`. Cualquier route handler,
middleware o server action rompe el export.
