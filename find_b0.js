const fs = require('fs');
const path = require('path');

// Leer el bundle SSR
const bundleDir = '.next/server/chunks/ssr';
const files = fs.readdirSync(bundleDir);
const ssfFile = files.find(f => f.includes('95577c07'));
if (!ssfFile) { console.log('Archivo no encontrado. Archivos disponibles:', files.join('\n')); process.exit(1); }

const content = fs.readFileSync(path.join(bundleDir, ssfFile), 'utf8');
const pos = 63315;

// Mostrar contexto alrededor de la posición del error
const start = Math.max(0, pos - 300);
const end = Math.min(content.length, pos + 300);
const ctx = content.substring(start, end);

console.log('=== Contexto alrededor de posicion', pos, '===');
console.log('...', ctx.substring(0, 300));
console.log('>>> ERROR EN ESTA POSICION <<<');
console.log('...', ctx.substring(300));
