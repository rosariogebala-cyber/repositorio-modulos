#!/bin/sh
# Copia lo público a public/. Las páginas del panel y las reglas quedan afuera
# para que Vercel las mande al servidor, que pide la sesión.
set -e
rm -rf public
mkdir public
cp -R index.html 404.html css js assets data maquetas Proyectos public/
for page in constructor landings clientes cliente consultas reglas; do
  rm -f "public/maquetas/$page.html"
done
rm -f public/data/reglas.json public/data/db.json
