#!/usr/bin/env bash
#
# Verificación de cierre: lint + typecheck + tests antes de dar algo por hecho.
#
# Corre cuando Claude termina de trabajar (hook Stop). Si algo falla, devuelve
# exit 2 con la salida del comando: Claude la recibe y lo arregla en vez de
# dejar el repo roto y avisar recién en el próximo `npm test`.
#
# Son las mismas tres verificaciones del CI y de AGENTS.md. Tardan ~5 segundos.

set -uo pipefail

entrada=$(cat)

# Cortafuegos contra el bucle: si ya bloqueamos una vez y Claude volvió a
# terminar, no insistimos. Que la segunda decisión sea del humano.
case "$entrada" in
  *'"stop_hook_active":true'* | *'"stop_hook_active": true'*) exit 0 ;;
esac

raiz="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
cd "$raiz" || exit 0

# Si esta sesión no tocó código, no hay nada que verificar (una charla o un
# cambio de docs no tiene por qué esperar cinco segundos).
if [ -z "$(git status --porcelain -- src eslint.config.mjs tsconfig.json package.json 2>/dev/null)" ]; then
  exit 0
fi

verificar() {
  local nombre="$1"; shift
  local salida
  if ! salida=$("$@" 2>&1); then
    {
      echo "❌ $nombre falló. El repo no queda así: arreglalo antes de terminar."
      echo
      echo "$salida" | tail -40
    } >&2
    exit 2
  fi
}

verificar "El lint (fronteras entre capas)" npm run lint
verificar "El typecheck" npm run typecheck
verificar "Los tests" npm test

exit 0
