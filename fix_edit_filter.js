const fs = require('fs');
const lines = fs.readFileSync('pages/nomina/matriz.js','utf8').split('\n');

// ══ FIX 1: ciamsaGuardar — agregar updateDoc cuando ciamsaEditId está activo ══
// Buscar la línea del addDoc principal en ciamsaGuardar (después de línea 2908)
let addDocCiamsaIdx = -1;
for(let i=2908;i<2980;i++){
  if(lines[i]?.includes('addDoc(collection(db, "nomina_operaciones")') && !lines[i]?.includes('//') ){
    addDocCiamsaIdx = i;
    break;
  }
}
console.log('addDoc ciamsaGuardar en linea:', addDocCiamsaIdx+1);
console.log('Contexto:', lines[addDocCiamsaIdx]?.trim().substring(0,80));

if(addDocCiamsaIdx !== -1){
  // Reemplazar el addDoc por lógica condicional
  const oldLine = lines[addDocCiamsaIdx];
  const indent = oldLine.match(/^(\s*)/)[1];
  
  // Insertar antes del addDoc la verificación de edición
  const newLines = [
    `${indent}if (ciamsaEditId) {`,
    `${indent}  await import("firebase/firestore").then(async({updateDoc:upd,doc:dc})=>{`,
    `${indent}    await upd(dc(db,"nomina_operaciones",ciamsaEditId),{...data,actualizadoEn:new Date()});`,
    `${indent}  });`,
    `${indent}  setCiamsaEditId(null);`,
    `${indent}} else {`,
    oldLine.trimEnd(),
    `${indent}}`,
  ];
  lines.splice(addDocCiamsaIdx, 1, ...newLines);
  console.log('OK - updateDoc lógica agregada en ciamsaGuardar');
} else {
  console.log('ERROR - addDoc ciamsaGuardar no encontrado');
}

// ══ FIX 2: Filtro de servicios en formulario CIAMSA/Terrestre ══
// Buscar el estado de búsqueda de servicios o agregar uno
// La línea del select de servicio está alrededor de 3477 (pero ahora el archivo cambió)
const servSelectIdx = lines.findIndex(l=>l.includes('cuadrillaDiaSelServicio') && l.includes('select'));
console.log('\nSelector servicio ciamsa en linea:', servSelectIdx+1);

if(servSelectIdx !== -1){
  // Buscar el <label> del servicio (2-3 líneas antes)
  let labelIdx = servSelectIdx - 1;
  while(labelIdx > servSelectIdx - 5 && !lines[labelIdx]?.includes('<label')) labelIdx--;
  console.log('Label servicio en linea:', labelIdx+1);
  
  // Insertar un input de búsqueda antes del label
  const indent = lines[labelIdx]?.match(/^(\s*)/)?.[1] || '                  ';
  const filterInput = [
    `${indent}{/* Filtro de servicios CIAMSA/Terrestre */}`,
    `${indent}(() => {`,
    `${indent}  if(typeof window==="undefined") return null;`,
    `${indent}  const [_q,_setQ]=React.useState?.(["",()=>{}]);`,
    `${indent}  return null;`,
    `${indent}})()}`,
  ];
  // En lugar de IIFE complejo, simplemente agregar un input de búsqueda encima usando busqSpiaCiamsa
  // Reusar el estado busqServicioCia si existe, o crear inline
  
  // Buscar si existe busqServicioCia
  const hasBusqServ = lines.some(l=>l.includes('busqServicioCia'));
  console.log('busqServicioCia existe:', hasBusqServ);
}

fs.writeFileSync('pages/nomina/matriz.js', lines.join('\n'), 'utf8');
console.log('\nFase 1 completada - revisar Fix 2 manualmente');
