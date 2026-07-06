const fs = require('fs');
const lines = fs.readFileSync('pages/nomina/matriz.js','utf8').split('\n');
// Ver MINI_FORM_INIT
const initIdx = lines.findIndex(l=>l.includes('MINI_FORM_INIT'));
console.log('=== MINI_FORM_INIT linea:', initIdx+1);
for(let i=initIdx;i<initIdx+15;i++) console.log((i+1)+': '+lines[i]?.trim().substring(0,120));

// Ver el reset en linea 1313 y el guardar antes
console.log('\n=== Reset y guardar mini (1280-1330) ===');
for(let i=1279;i<1330;i++) console.log((i+1)+': '+lines[i]?.trim().substring(0,120));
