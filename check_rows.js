const fs = require('fs');
const lines = fs.readFileSync('pages/nomina/matriz.js','utf8').split('\n');
// Ver filas CIAMSA (después del header en 4505)
for(let i=4505;i<4560;i++){
  if(lines[i]) console.log((i+1)+': '+lines[i].trim().substring(0,120));
}
