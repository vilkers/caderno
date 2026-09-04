#!/usr/bin/env bash
# tools/testar.sh — roda a bateria inteira. Uso:
#   tools/testar.sh            só o rápido (node + navegador, ~3 min)
#   tools/testar.sh tudo       inclui o audit de layout (3 larguras, ~4 min a mais)
#   tools/testar.sh <nome>     um teste de navegador só, ex.: tools/testar.sh dias
set -u
cd "$(dirname "$0")/.."
PORTA=${CADERNO_PORTA:-8899}
falhas=0

# ── servidor local, derrubado no fim ────────────────────────────
if ! curl -s -o /dev/null "http://127.0.0.1:$PORTA/index.html"; then
  python3 -m http.server "$PORTA" --bind 127.0.0.1 >/dev/null 2>&1 &
  SERVIDOR=$!
  trap 'kill $SERVIDOR 2>/dev/null' EXIT
  for _ in $(seq 20); do
    curl -s -o /dev/null "http://127.0.0.1:$PORTA/index.html" && break
    sleep 0.3
  done
fi
export CADERNO_URL="http://127.0.0.1:$PORTA"

# ── um teste só ─────────────────────────────────────────────────
if [ $# -gt 0 ] && [ "$1" != "tudo" ]; then
  exec node "tools/browser/$1.mjs"
fi

echo "── lógica (node) ──"
for t in tools/test-*.mjs; do
  printf '  %-24s ' "$(basename "$t" .mjs)"
  saida=$(node "$t" 2>&1 | tail -1)
  echo "$saida"
  case "$saida" in *falharam*|*FALHOU*) falhas=$((falhas+1));; esac
done

echo
echo "── navegador (playwright) ──"
for t in tools/browser/*.mjs; do
  nome=$(basename "$t" .mjs)
  case "$nome" in _comum|audit) continue;; esac
  printf '  %-24s ' "$nome"
  if saida=$(timeout 150 node "$t" 2>&1); then
    linha=$(echo "$saida" | grep -E '^erros:' | tail -1)
    echo "${linha:-ok}"
    case "$linha" in *nenhum*|'') ;; *) falhas=$((falhas+1));; esac
  else
    echo "FALHOU"; echo "$saida" | tail -4 | sed 's/^/      /'
    falhas=$((falhas+1))
  fi
done

# ── audit de layout: lento, só sob pedido ───────────────────────
if [ "${1:-}" = "tudo" ]; then
  echo
  echo "── layout em 360/393/440 ──"
  timeout 400 node tools/browser/audit.mjs 2>&1 | sed 's/^/  /'
fi

echo
[ "$falhas" -eq 0 ] && echo "tudo passou" || echo "$falhas teste(s) com problema"
exit "$falhas"
