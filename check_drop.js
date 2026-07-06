const fs = require('fs');
const lines = fs.readFileSync('pages/nomina/matriz.js','utf8').split('\n');

// Ver contexto amplio alrededor del dropdown para entender la estructura
console.log('=== Contexto dropdown (3530-3560) ===');
for(let i=3529;i<3560;i++) console.log((i+1)+': '+lines[i]);

console.log('\n=== Contexto cierre (3545-3560) ===');
for(let i=3544;i<3560;i++) console.log((i+1)+': '+ JSON.stringify(lines[i]));
