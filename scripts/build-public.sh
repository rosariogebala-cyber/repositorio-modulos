#!/bin/sh
# Vercel: copia a public/ lo que se sirve tal cual. Las páginas del panel, las landings (l/) y los datos
# (data/*.js) quedan afuera: los sirve el servidor, que pide la clave y los lee frescos de GitHub.
set -e
rm -rf public
mkdir public
cp -R index.html 404.html css js assets maquetas editar Proyectos public/
mkdir -p public/data
cp data/modules.js data/modules.json public/data/
for page in constructor landings clientes cliente reglas; do
  rm -f "public/maquetas/$page.html"
done
