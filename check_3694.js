const fs = require('fs');
const lines = fs.readFileSync('pages/nomina/matriz.js','utf8').split('\n');
for(let i=3680;i<3710;i++) console.log((i+1)+': '+lines[i]);
