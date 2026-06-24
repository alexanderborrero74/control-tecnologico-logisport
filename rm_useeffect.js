const fs = require('fs');
const path = 'pages/nomina/matriz.js';
let content = fs.readFileSync(path, 'utf8');

// Eliminar el useEffect problemático
const effPattern = /\/\/ Recalcular neto cuando cambian los trabajadores adicionales\s*useEffect\(\(\)=>\{[\s\S]*?\},\s*\[trabsAdicionales\]\);/;

if (effPattern.test(content)) {
  content = content.replace(effPattern, '// ── Multi-servicio CIAMSA/Terrestre ──');
  console.log('OK - useEffect eliminado');
} else {
  console.log('Patron no encontrado - buscando variante...');
  const idx = content.indexOf('Recalcular neto cuando cambian');
  if (idx !== -1) {
    console.log('Encontrado en posicion:', idx);
    console.log('Contexto:', content.substring(idx, idx+300));
  }
}

fs.writeFileSync(path, content, 'utf8');
