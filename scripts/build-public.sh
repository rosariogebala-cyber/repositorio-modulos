#!/bin/sh
# Vercel: copia a public/ lo que se sirve tal cual. Las páginas del panel, las landings (l/) y los datos
# (data/*.js) quedan afuera: los sirve el servidor, que pide la clave y los lee frescos de GitHub.
set -e
rm -rf public
mkdir public
cp -R 404.html css js assets maquetas portal Proyectos public/
cp index.html public/biblioteca.html
printf '%s\n' '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Lanzate | Próximamente</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#10102c;color:white;font-family:system-ui;text-align:center}h1{font-size:clamp(3rem,10vw,7rem);margin:0}p{color:#e4e1ff}</style></head><body><main><h1>Lanzate.</h1><p>Algo nuevo está por llegar.</p></main></body></html>' > public/index.html
mkdir -p public/data
cp data/modules.js data/modules.json public/data/
for page in constructor landings clientes cliente reglas; do
  rm -f "public/maquetas/$page.html"
done

# Publish pinned commercial site locally.
commercial_tmp="$(mktemp -d)"
trap 'rm -rf "$commercial_tmp"' EXIT HUP INT TERM
curl -fsSL --retry 3 -o "$commercial_tmp/site.tar.gz" https://codeload.github.com/rosariogebala-cyber/lanzate/tar.gz/ee942075664faf39ab0684735ecd63e226b0f372
tar -xzf "$commercial_tmp/site.tar.gz" -C "$commercial_tmp" --strip-components=1
mkdir -p public/site_demo
for file in "$commercial_tmp"/*.html; do cp "$file" public/site_demo/; done
for dir in css js img assets fonts vendor; do
  if [ -d "$commercial_tmp/$dir" ]; then cp -R "$commercial_tmp/$dir" public/site_demo/; fi
done
test -s public/site_demo/index.html
test -s public/site_demo/js/main.js
test -s public/site_demo/css/main.css
