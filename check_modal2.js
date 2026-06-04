const fs = require('fs');
const lines = fs.readFileSync('pages/nomina/matriz.js','utf8').split('\n');
for(let i=4575;i<4680;i++){
  if(lines[i]) console.log((i+1)+': '+lines[i].trim().substring(0,130));
}
