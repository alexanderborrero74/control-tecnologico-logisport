const fs = require('fs');
const path = 'pages/nomina/matriz.js';
let content = fs.readFileSync(path, 'utf8');

// Buscar la línea con personas en el guardar de SPIA
const lines = content.split('\n');
let lineIdx = -1;
for (let i = 2545; i < 2570; i++) {
  if (lines[i] && lines[i].includes('const personas') && lines[i].includes('form.personas')) {
    lineIdx = i;
    console.log('Encontrado en linea', i+1, ':', lines[i]);
    break;
  }
}

if (lineIdx === -1) {
  console.log('NO ENCONTRADO - busqueda amplia...');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] && lines[i].includes('form.personas') && lines[i].includes('parseInt')) {
      console.log('Linea', i+1, ':', lines[i]);
    }
  }
} else {
  const old = lines[lineIdx];
  lines[lineIdx] = lines[lineIdx].replace(
    /const personas\s*=\s*parseInt\(form\.personas\)\|\|1;/,
    'const personas = (parseInt(form.personas)||1) + (trabsAdicionales?.length||0); // incluye adicionales'
  );
  console.log('Reemplazado:');
  console.log('  ANTES:', old);
  console.log('  DESPUES:', lines[lineIdx]);
  fs.writeFileSync(path, lines.join('\n'), 'utf8');
  console.log('OK');
}
