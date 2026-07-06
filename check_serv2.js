const fs = require('fs');
const lines = fs.readFileSync('pages/nomina/matriz.js','utf8').split('\n');

// Buscar todas las llamadas a cargarServicios
console.log('=== Llamadas a cargarServicios ===');
for(let i=0;i<lines.length;i++){
  if(lines[i]&&lines[i].includes('cargarServicios(')&&!lines[i].includes('const cargar'))
    console.log((i+1)+': '+lines[i].trim().substring(0,120));
}

// Ver useEffect del cliente activo
console.log('\n=== useEffect clienteActivo ===');
for(let i=0;i<lines.length;i++){
  if(lines[i]&&lines[i].includes('clienteActivo')&&lines[i].includes('useEffect'))
    console.log((i+1)+': '+lines[i].trim().substring(0,120));
}

// Lineas 3480-3500 del selector de servicio
console.log('\n=== Selector servicio CIAMSA (3480-3500) ===');
for(let i=3479;i<3502;i++) console.log((i+1)+': '+lines[i]?.trim().substring(0,120));
