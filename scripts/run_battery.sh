#!/usr/bin/env bash
# Batería R18: todos los smokes del juego con bun desde la raíz.
# Resultado: scripts/_battery.txt (una línea por smoke + total final).
cd /home/z/my-project
OUT=scripts/_battery.txt
: > "$OUT"
PASS=0; FAIL=0
for f in scripts/smoke_*.ts; do
  name=$(basename "$f")
  if timeout 120 bun "$f" > "scripts/_out_${name%.ts}.txt" 2>&1; then
    echo "VERDE   $name" >> "$OUT"
    PASS=$((PASS+1))
  else
    echo "ROJO    $name" >> "$OUT"
    FAIL=$((FAIL+1))
  fi
done
echo "TOTAL: $PASS verdes, $FAIL rojos" >> "$OUT"
cat "$OUT"
