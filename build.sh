#!/bin/sh

if [ ! $1 = "--noEmit" ]; then 
  mkdir docs/fontawesome
  cp -R node_modules/@fortawesome/fontawesome-pro/css docs/fontawesome/css
  cp -R node_modules/@fortawesome/fontawesome-pro/webfonts docs/fontawesome/webfonts
fi

tsc -p tsconfig.server.json "$@"
tsc -p tsconfig.client.json "$@"
