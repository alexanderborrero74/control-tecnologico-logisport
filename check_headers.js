const fs = require('fs');
const lines = fs.readFileSync('pages/nomina/matriz.js','utf8').split('\n');
for(let i=4455;i<4465;i++) console.log((i+1)+': '+lines[i]?.trim().substring(0,130));
console.log('---CIAMSA---');
for(let i=4413;i<4420;i++) console.log((i+1)+': '+lines[i]?.trim().substring(0,130));
