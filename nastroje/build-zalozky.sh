#!/bin/sh
# Vytvoří dvě záložky pro test náhledu na onglazz.cz.
#
#   ./nastroje/build-zalozky.sh https://preview.onglazz.cz/
#
#   zalozka-hosting.txt       krátká, načte vždy nejnovější soubory z hostingu
#   zalozka-bez-hostingu.txt  celý kód v záložce, funguje i bez hostingu
set -e
cd "$(dirname "$0")/.."
HOST="${1:-https://mullerlukas15.github.io/onglazz-preview/}"
case "$HOST" in */) ;; *) HOST="$HOST/" ;; esac

MIN="npx -y terser@5.31.0 -c -m --comments false -f ascii_only=true"

LOADER="(function(){var s=document.createElement('script');s.src='${HOST}test.js?v='+Date.now();document.head.appendChild(s)})()"
printf 'javascript:%s' "$LOADER" > nastroje/zalozka-hosting.txt

BUNDLE=$(cat widget.js templates.js test.js | $MIN)
node -e 'process.stdout.write("javascript:" + encodeURIComponent(process.argv[1]))' \
  "if(!window.OnglazzPreview){$BUNDLE}else{alert('Náhled už na stránce běží. Obnovte stránku a klikněte znovu.')}" \
  > nastroje/zalozka-bez-hostingu.txt

cat > nastroje/onglazz-nahled.user.js <<EOF
// ==UserScript==
// @name         OnGlazz – test živého náhledu
// @namespace    onglazz-preview
// @version      0.2
// @description  Na stránkách produktů onglazz.cz načte náhled z hostingu (jen ve vašem prohlížeči)
// @match        https://onglazz.cz/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==
$LOADER;
EOF

wc -c nastroje/zalozka-hosting.txt nastroje/zalozka-bez-hostingu.txt nastroje/onglazz-nahled.user.js
