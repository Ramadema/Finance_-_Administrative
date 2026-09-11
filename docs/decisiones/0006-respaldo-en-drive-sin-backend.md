# 0006 — Respaldo en Drive, sin backend

## Contexto

IndexedDB se borra: el usuario limpia los datos del navegador, cambia de máquina,
o el navegador desaloja la base. El respaldo manual en JSON cubría el caso pero
había que acordarse, y el que se acuerda ya perdió los datos una vez.

Un backend propio resolvía la sincronización pero rompe
[0001](0001-todo-corre-en-el-navegador.md) entero.

## Decisión

Respaldo en el Google Drive **del propio usuario**, con su sesión, contra un
único archivo. *(Desde [0011](0011-agente-con-tu-propia-key.md) la misma carpeta
privada guarda además `plata-ia.json`, la key del asistente — en otro archivo,
para que bajar el respaldo de datos nunca arrastre una credencial.)* OAuth desde el navegador con un `client_id` público
(`NEXT_PUBLIC_GOOGLE_CLIENT_ID`), sin client secret porque no hay servidor donde
esconderlo — y no hace falta: el `client_id` solo identifica a la app, lo que
autoriza es la sesión de Google del usuario.

Cuando lo local y lo remoto difieren, la app **pregunta** en vez de elegir: un
merge automático sobre datos financieros puede duplicar o borrar movimientos sin
que nadie se entere.

## Consecuencias

- Los datos siguen sin pasar por ningún servidor nuestro: van del navegador al
  Drive del usuario.
- Sirve de sincronización entre dispositivos, manual y explícita.
- **Se paga**: el flujo de OAuth y de conflicto es la parte más compleja de la
  app (`src/lib/nube/`), y sin `client_id` configurado la función simplemente no
  aparece — la app tiene que seguir andando igual.

## Cómo se verifica

Toda la capa vive en `src/lib/nube/` y es la única que habla con la red. El
resto de la app la ve solo a través de `useSesionDrive` y del contexto.
