const fs = require('fs');
const lines = fs.readFileSync('pages/nomina/matriz.js','utf8').split('\n');
// Ver cuadrillaDiaGuardar - líneas clave de n y trabajadoresSeleccionados
for(let i=2314;i<2360;i++){
  if(lines[i] && (lines[i].includes(' n ') || lines[i].includes('const n') || lines[i].includes('trabajadoresSeleccionados') || lines[i].includes('cuadrillaDiaToggle')))
    console.log((i+1)+': '+lines[i].trim());
}
// Ver cuadrillaDiaToggleTrabajador
for(let i=2295;i<2315;i++){
  console.log((i+1)+': '+lines[i].trim());
}
