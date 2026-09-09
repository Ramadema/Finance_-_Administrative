#!/usr/bin/env bash
#
# Verificación de cierre: lint + tipos + tests + documentación al día.
#
# Corre cuando Claude termina de trabajar (hook Stop). Si algo falla, devuelve
# exit 2 con la salida del comando: Claude la recibe y lo arregla en vez de
# dejar el repo roto y avisar recién en el próximo `npm test`.
#
# Son las mismas verificaciones del CI y de AGENTS.md. Tardan ~6 segundos.

set -uo pipefail

entrada=$(cat)

# Cortafuegos contra el bucle: si ya bloqueamos una vez y Claude volvió a
# terminar, no insistimos. Que la segunda decisión sea del humano.
case "$entrada" in
  *'"stop_hook_active":true'* | *'"stop_hook_active": true'*) exit 0 ;;
esac

raiz="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
cd "$raiz" || exit 0

hay_codigo=$(git status --porcelain -- src eslint.config.mjs tsconfig.json package.json next.config.ts scripts 2>/dev/null)
hay_docs=$(git status --porcelain -- docs README.md AGENTS.md 2>/dev/null)

# Ni código ni documentación: no hay nada que verificar (una charla no tiene por
# qué esperar seis segundos).
[ -z "$hay_codigo" ] && [ -z "$hay_docs" ] && exit 0

ULTIMA_SALIDA=""

verificar() {
  local nombre="$1"; shift
  if ! ULTIMA_SALIDA=$("$@" 2>&1); then
    {
      echo "❌ $nombre falló. El repo no queda así: arreglalo antes de terminar."
      echo
      echo "$ULTIMA_SALIDA" | tail -40
    } >&2
    exit 2
  fi
}

tests_reales=""
if [ -n "$hay_codigo" ]; then
  verificar "El lint (fronteras entre capas)" npm run lint
  verificar "El typecheck" npm run typecheck
  verificar "Los tests" npm test
  # La cantidad real, para que el chequeo de docs no tenga que correrlos de nuevo.
  tests_reales=$(printf '%s' "$ULTIMA_SALIDA" | grep -oE 'Tests +[0-9]+ passed' | grep -oE '[0-9]+' | head -1)
fi

# La documentación es parte del trabajo, no un extra: un cambio que amerita
# registro y no lo deja escrito está a medio hacer.
if ! salida=$(PLATA_TESTS="$tests_reales" node scripts/docs-al-dia.mjs 2>&1); then
  {
    echo "$salida"
    echo "(docs/README.md dice qué archivo es cuál. AGENTS.md tiene la tabla de qué actualizar según lo que tocaste.)"
  } >&2
  exit 2
fi

exit 0
