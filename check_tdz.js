const fs = require('fs');
const content = fs.readFileSync('pages/nomina/matriz.js','utf8');
const lines = content.split('\n');

// Buscar posibles TDZ: const usado antes de su declaración en el scope del componente
// Buscar NovEditList y el contexto alrededor
const novIdx = lines.findIndex(l=>l.includes('function NovEditList'));
console.log('NovEditList en linea:', novIdx+1);
console.log('Contexto:');
for(let i=novIdx-3;i<novIdx+5;i++) console.log((i+1)+': '+lines[i]?.substring(0,100));

// Buscar el useEffect que agregué
const effIdx = lines.findIndex(l=>l.includes('Recalcular neto cuando cambian'));
console.log('\nuseEffect trabsAdicionales en linea:', effIdx+1);
for(let i=effIdx-2;i<effIdx+8;i++) console.log((i+1)+': '+lines[i]?.substring(0,100));

// Buscar si hay const declarados DESPUÉS de donde se usan
console.log('\nBuscando posibles forward refs...');
const stateVars = [];
lines.forEach((l,i) => {
  const m = l.match(/const\s+\[(\w+),\s*set\w+\]\s*=\s*useState/);
  if(m) stateVars.push({name:m[1], line:i});
});
console.log('Total estados:', stateVars.length);
// Mostrar los primeros 20
stateVars.slice(0,20).forEach(v => console.log(`  ${v.name} en linea ${v.line+1}`));
