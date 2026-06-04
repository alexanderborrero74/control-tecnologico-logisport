const fs = require('fs');
const lines = fs.readFileSync('pages/nomina/matriz.js','utf8').split('\n');
let count = 0;
for(let i=0;i<lines.length;i++){
  if(lines[i] && lines[i].toLowerCase().includes('novedad') && !lines[i].includes('//'))
    if(++count<=40) console.log((i+1)+': '+lines[i].trim().substring(0,120));
}
console.log('Total lineas con novedad:',count);
