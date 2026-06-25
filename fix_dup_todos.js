const fs = require('fs');
const path = 'pages/nomina/servicios.js';
let c = fs.readFileSync(path,'utf8');

const count = (c.match(/const cargarTodosServicios/g)||[]).length;
console.log('cargarTodosServicios aparece', count, 'veces');

if(count > 1){
  // Eliminar la segunda ocurrencia completa
  const marker = '\n  const cargarTodosServicios = async () => {';
  const first = c.indexOf(marker);
  const second = c.indexOf(marker, first+1);
  if(second !== -1){
    // Encontrar el fin de la segunda función (buscar siguiente const o return)
    const endMarker = '\n  const cargar';
    let endIdx = c.indexOf(endMarker, second+1);
    if(endIdx === -1){
      // Buscar return como alternativa
      endIdx = c.indexOf('\n  return (', second+1);
    }
    if(endIdx !== -1){
      c = c.substring(0, second) + c.substring(endIdx);
      console.log('OK - segunda instancia eliminada');
    }
  }
}

fs.writeFileSync(path, c,'utf8');
const countAfter = (c.match(/const cargarTodosServicios/g)||[]).length;
console.log('Despues:', countAfter, 'instancias');
