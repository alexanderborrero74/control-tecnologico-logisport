const fs = require('fs');
const lines = fs.readFileSync('pages/nomina/matriz.js','utf8').split('\n');

// 1. Contexto botón multi-servicio SPIA (línea 4357)
console.log('=== BOTON MULTI SPIA (4350-4370) ===');
for(let i=4349;i<4370;i++) console.log((i+1)+': '+lines[i]?.trim().substring(0,120));

// 2. Contexto cuadrillaDia form - workers panel (línea 3130-3160)
console.log('\n=== CUADRILLA DIA WORKERS (3125-3165) ===');
for(let i=3124;i<3165;i++) console.log((i+1)+': '+lines[i]?.trim().substring(0,120));

// 3. Contexto botón editar SPIA en tabla
console.log('\n=== BOTONES EDITAR TABLA SPIA (4195-4220) ===');
for(let i=4194;i<4225;i++) console.log((i+1)+': '+lines[i]?.trim().substring(0,120));

// 4. Estado editandoId y guardar SPIA
const editIdx = lines.findIndex(l=>l.includes('editandoId') && l.includes('useState'));
console.log('\n=== editandoId estado linea:', editIdx+1);
for(let i=editIdx-1;i<editIdx+3;i++) console.log((i+1)+': '+lines[i]?.trim().substring(0,120));
