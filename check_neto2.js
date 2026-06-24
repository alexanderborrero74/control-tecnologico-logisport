const fs = require('fs');
const lines = fs.readFileSync('pages/nomina/matriz.js','utf8').split('\n');
console.log('=== Linea 2290-2310 ===');
for(let i=2289;i<2310;i++) console.log((i+1)+': '+lines[i]?.trim().substring(0,130));
console.log('=== Linea 4282-4310 ===');
for(let i=4281;i<4310;i++) console.log((i+1)+': '+lines[i]?.trim().substring(0,130));
