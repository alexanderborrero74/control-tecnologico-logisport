const fs = require('fs');
const lines = fs.readFileSync('pages/nomina/matriz.js','utf8').split('\n');

// Ver contexto línea 2051
console.log('=== Contexto linea 2051 ===');
for(let i=2044;i<2060;i++) console.log((i+1)+': '+lines[i]?.trim().substring(0,120));

// Buscar selector de servicio en ciamsaForm (no cuadrillaDia)
console.log('\n=== Selector servicio ciamsaForm ===');
for(let i=0;i<lines.length;i++){
  if(lines[i]&&lines[i].includes('ciamsaForm.servicioId')&&lines[i].includes('select'))
    console.log((i+1)+': '+lines[i].trim().substring(0,120));
}

// Ver cambio de cliente - setClienteActivo
console.log('\n=== setClienteActivo ===');
for(let i=0;i<lines.length;i++){
  if(lines[i]&&lines[i].includes('setClienteActivo'))
    console.log((i+1)+': '+lines[i].trim().substring(0,120));
}
