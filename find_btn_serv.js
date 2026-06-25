const fs = require('fs');
const lines = fs.readFileSync('pages/nomina/servicios.js','utf8').split('\n');
// Buscar botón "Importar Excel"
for(let i=0;i<lines.length;i++){
  if(lines[i].includes('Importar Excel') || lines[i].includes('Nuevo Servicio') || lines[i].includes('Limpiar duplicados'))
    console.log((i+1)+': '+lines[i].trim().substring(0,100));
}
