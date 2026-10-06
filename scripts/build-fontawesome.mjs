import { copyFileSync, mkdirSync } from 'node:fs';

const source = new URL('../node_modules/@fortawesome/fontawesome-pro/', import.meta.url);
const target = new URL('../public/assets/fontawesome/', import.meta.url);

for (const file of ['css/all.min.css', 'webfonts/fa-solid-900.woff2', 'webfonts/fa-regular-400.woff2']) {
  const destination = new URL(file, target);
  mkdirSync(new URL(file.slice(0, file.lastIndexOf('/') + 1), target), { recursive: true });
  copyFileSync(new URL(file, source), destination);
}