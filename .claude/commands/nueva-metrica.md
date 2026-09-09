---
description: Agrega una métrica siguiendo el playbook (cálculo puro → test → contexto → UI)
argument-hint: [qué tiene que contestar la métrica]
allowed-tools: Read, Edit, Write, Grep, Glob, Bash(npm run lint), Bash(npm run typecheck), Bash(npm test)
---

Leé `docs/playbooks/agregar-una-metrica.md` y seguilo para: **$ARGUMENTS**

Recordá el orden, que no es negociable:

1. Función **pura** en `src/lib/analisis/`, que recibe los movimientos por
   parámetro. Sin datos suficientes devuelve `null`, nunca `0`.
2. **Test antes de la UI**, con los bordes del playbook.
3. Recién ahí, el contexto (`Datos` + el `useMemo` + **el objeto del
   `if (!periodo)`**) y el componente.
4. `npm run lint && npm run typecheck && npm test`.

Si en el paso 1 descubrís que la métrica necesita un dato que no está en la
base, pará y decímelo antes de tocar el esquema.
