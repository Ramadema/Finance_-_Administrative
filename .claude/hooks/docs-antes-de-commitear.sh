#!/usr/bin/env bash
#
# Antes de commitear: ¿el cambio quedó documentado?
#
# El commit es el momento correcto para preguntarlo. Después ya es historia y
# nadie vuelve. Corre como hook PreToolUse: si lo que está por commitearse pide
# documentación y ningún doc se movió, el commit se frena con la lista.
#
# Escape: anteponer DOCS_OK=1 al comando (`DOCS_OK=1 git commit -m "..."`).
# Es para cuando de verdad no hay nada que documentar, no para salir del paso.

set -uo pipefail

entrada=$(cat)
command -v jq >/dev/null 2>&1 || exit 0   # sin jq no bloqueamos por infraestructura

comando=$(printf '%s' "$entrada" | jq -r '.tool_input.command // ""')

# ¿Es un commit? (`git commit`, `git -C x commit`, encadenado con && o ;)
printf '%s' "$comando" | grep -qE '(^|[;&|]|&&)[[:space:]]*git[[:space:]]+(-[^[:space:]]+[[:space:]]+)*commit\b' || exit 0
printf '%s' "$comando" | grep -q 'DOCS_OK=1' && exit 0

raiz="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
cd "$raiz" || exit 0

# `git commit -a` no pasa por el índice: ahí hay que mirar el árbol de trabajo.
modo="--staged"
[ -z "$(git diff --cached --name-only)" ] && modo=""

if ! salida=$(node scripts/docs-al-dia.mjs --obligaciones $modo 2>&1); then
  {
    echo "$salida"
    echo "Actualizá los docs y volvé a commitear — o, si el cambio de verdad no"
    echo "amerita registro, repetí el comando con DOCS_OK=1 adelante."
  } >&2
  exit 2
fi

exit 0
