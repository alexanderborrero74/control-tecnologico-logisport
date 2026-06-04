const fs = require('fs');
const path = 'pages/nomina/matriz.js';
let content = fs.readFileSync(path, 'utf8');

// Encontrar cuántas veces aparece NovEditList
const count = (content.match(/function NovEditList/g)||[]).length;
console.log('NovEditList aparece', count, 'veces');

if (count > 1) {
  // Eliminar la segunda ocurrencia completa del componente
  // El componente empieza con el comentario y termina con la llave de cierre
  const marker = '\n// ── Componente: lista editable de novedades por trabajador ──\nfunction NovEditList(';
  const first = content.indexOf(marker);
  const second = content.indexOf(marker, first + 1);
  
  if (second !== -1) {
    // Encontrar el fin de la segunda declaración
    // Buscar 'export default function NominaMatriz' que viene después
    const endMarker = '\nexport default function NominaMatriz()';
    const endIdx = content.indexOf(endMarker, second);
    if (endIdx !== -1) {
      // Eliminar desde second hasta endIdx (exclusive)
      content = content.substring(0, second) + content.substring(endIdx);
      console.log('OK - segunda instancia de NovEditList eliminada');
    }
  } else {
    console.log('No se encontro segunda instancia con ese patron exacto');
    // Buscar patron alternativo
    const alt = 'function NovEditList';
    const i1 = content.indexOf(alt);
    const i2 = content.indexOf(alt, i1+1);
    console.log('Primera en:', i1, 'Segunda en:', i2);
  }
}

fs.writeFileSync(path, content, 'utf8');
const countAfter = (content.match(/function NovEditList/g)||[]).length;
console.log('Despues: NovEditList aparece', countAfter, 'veces');
