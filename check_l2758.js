const fs = require('fs');
const lines = fs.readFileSync('pages/nomina/matriz.js','utf8').split('\n');
for(let i=2754;i<2762;i++) console.log((i+1)+': '+lines[i]);
