#!/bin/sh

# Cleanup before build
echo "Cleaning up build directories..."
rm -rf build
rm -rf docs/build
rm -rf docs/fontawesome

# Run TypeScript compilations
tsc -p tsconfig.server.json "$@"
tsc -p tsconfig.client.json "$@"

# Check if --noEmit is NOT in the arguments
if ! echo "$@" | grep -q "\--noEmit"; then
  mkdir -p docs/fontawesome
  cp -R node_modules/@fortawesome/fontawesome-pro/css docs/fontawesome/css
  cp -R node_modules/@fortawesome/fontawesome-pro/webfonts docs/fontawesome/webfonts
  cp src/client/style.css docs/build/client/style.css
fi