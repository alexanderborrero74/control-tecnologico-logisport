const fs = require('fs');
const path = 'pages/nomina/matriz.js';
const lines = fs.readFileSync(path, 'utf8').split('\n');

// Encontrar las 4 constantes al final
const constLines = ['inputSt', 'selectSt', 'readonlySt', 'tdSt'];
let removeIdx = [];
lines.forEach((l, i) => {
  if (constLines.some(c => l.trim().startsWith('const ' + c))) removeIdx.push(i);
});
console.log('Constantes encontradas en lineas:', removeIdx.map(i=>i+1));

// Extraer el contenido de esas líneas
const constContent = removeIdx.map(i => lines[i]).join('\n');
console.log('Contenido a mover:');
console.log(constContent);

// Eliminar esas líneas del final
removeIdx.sort((a,b)=>b-a).forEach(i => lines.splice(i, 1));

// Encontrar dónde insertar: ANTES del primer componente/función
// Buscar la primera línea que sea un componente o función helper
let insertIdx = 0;
for(let i=0;i<lines.length;i++){
  if(lines[i].match(/^(function |const [A-Z]|export default)/)){
    insertIdx = i;
    break;
  }
}
console.log('Insertar antes de linea:', insertIdx+1, ':', lines[insertIdx]?.substring(0,60));

// Insertar las constantes antes de los componentes
lines.splice(insertIdx, 0, '', constContent, '');

fs.writeFileSync(path, lines.join('\n'), 'utf8');
console.log('OK - constantes movidas al inicio');
