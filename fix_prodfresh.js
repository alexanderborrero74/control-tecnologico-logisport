const fs = require('fs');
const path = 'pages/nomina/liquidar.js';
let content = fs.readFileSync(path, 'utf8');

// Reemplazar Object.entries(produccion) por Object.entries(prodFresh) dentro del bloque CIAMSA 2
// y añadir const prodFresh = await cargarPeriodo() || {};
const old = `      // Primero actualizar producción desde Firestore para tener datos frescos
      await cargarPeriodo();
      const cedsFijo`;

const nuevo = `      // Primero actualizar producción desde Firestore para tener datos frescos
      const prodFresh = await cargarPeriodo() || {};
      const cedsFijo`;

if (content.includes(old)) {
  content = content.replace(old, nuevo);
  // También reemplazar Object.entries(produccion) por Object.entries(prodFresh)
  // Solo dentro del bloque CIAMSA 2 (reemplazar la primera ocurrencia después de prodFresh)
  const idx = content.indexOf('const prodFresh');
  const parte1 = content.substring(0, idx);
  let parte2 = content.substring(idx);
  parte2 = parte2.replace('Object.entries(produccion)', 'Object.entries(prodFresh)');
  content = parte1 + parte2;
  fs.writeFileSync(path, content, 'utf8');
  console.log('OK - cargarTodosTrabajadores usa prodFresh en lugar del estado');
} else {
  console.log('NO ENCONTRADO - verificar');
}
