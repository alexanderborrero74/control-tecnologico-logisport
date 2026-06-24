const fs = require('fs');
const lines = fs.readFileSync('pages/nomina/matriz.js','utf8').split('\n');
console.log('=== Multi-servicio render (4300-4380) ===');
for(let i=4299;i<4380;i++) console.log((i+1)+': '+lines[i]?.trim().substring(0,120));
