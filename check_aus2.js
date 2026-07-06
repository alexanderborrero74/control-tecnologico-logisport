const fs = require('fs');
const lines = fs.readFileSync('pages/nomina/matriz.js','utf8').split('\n');
for(let i=4050;i<4095;i++) console.log((i+1)+': '+lines[i]?.trim().substring(0,120));
