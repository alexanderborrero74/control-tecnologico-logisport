const fs = require('fs');
const path = 'pages/nomina/matriz.js';
let content = fs.readFileSync(path, 'utf8');

// Celda Nov. para CIAMSA - insertar entre fecha y servicio
// El patron exacto es el td de servicio en CIAMSA que sigue a la fecha
const ciamsaServTd = '<td style={{...tdSt,maxWidth:"180px"}}>\n<div style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontSize:"0.83rem",color:"#374151"}}>{op.servicioNombre';

const novCellCiamsa =
  '<td style={{...tdSt,textAlign:"center"}}>\n' +
  '                {(op.trabajadoresAusentes?.length>0||op.modoNovedad) ? (\n' +
  '                  <button onClick={()=>{setEditNovOp(op);setShowEditNovModal(true);}}\n' +
  '                    style={{background:"#fff1f2",border:"1px solid #fecdd3",borderRadius:"6px",padding:"2px 7px",cursor:"pointer",color:"#dc2626",fontWeight:"700",fontSize:"0.7rem"}}>\n' +
  '                    \u26a0\ufe0f {op.trabajadoresAusentes?.length||1}\n' +
  '                  </button>\n' +
  '                ) : (\n' +
  '                  <button onClick={()=>{setEditNovOp(op);setShowEditNovModal(true);}}\n' +
  '                    style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:"6px",padding:"2px 7px",cursor:"pointer",color:"#10b981",fontWeight:"700",fontSize:"0.7rem"}}>\n' +
  '                    \u2713\n' +
  '                  </button>\n' +
  '                )}\n' +
  '              </td>\n' +
  '              <td style={{...tdSt,maxWidth:"180px"}}>\n' +
  '<div style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontSize:"0.83rem",color:"#374151"}}>{op.servicioNombre';

// Buscar el patron en el contenido
const idx = content.indexOf('<td style={{...tdSt,maxWidth:"180px"}}>\n<div style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontSize:"0.83rem",color:"#374151"}}>{op.servicioNombre');

if (idx !== -1) {
  const before = content.substring(0, idx);
  const after = content.substring(idx + '<td style={{...tdSt,maxWidth:"180px"}}>\n<div style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontSize:"0.83rem",color:"#374151"}}>{op.servicioNombre'.length);
  content = before + novCellCiamsa + after;
  console.log('OK - celda Nov. CIAMSA insertada');
} else {
  // Buscar variacion
  const lines = content.split('\n');
  for(let i=4520;i<4535;i++){
    console.log((i+1)+': '+JSON.stringify(lines[i]?.substring(0,80)));
  }
}

// Buscar celda Nov SPIA - tabla debajo
// En SPIA la tabla tiene columna Asistentes seguida de Servicio
// Buscar el patron de td servicio en SPIA
const spiaNomCua = '{op.cuadrillaNombre||op.cuadrilla||"—"}';
// El td de asistentes en SPIA tiene: op.personas asisten
const spiaAsistEnd = '</div>\n              </td>\n              <td style={{...tdSt,maxWidth:"180px"}}>\n                <div style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontSize:"0.85rem",color:"#374151"}}>{op.servicioNombre';

const novCellSpia =
  '</div>\n              </td>\n' +
  '              <td style={{...tdSt,textAlign:"center"}}>\n' +
  '                {(op.trabajadoresAusentes?.length>0||op.modoNovedad) ? (\n' +
  '                  <button onClick={()=>{setEditNovOp(op);setShowEditNovModal(true);}}\n' +
  '                    style={{background:"#fff1f2",border:"1px solid #fecdd3",borderRadius:"6px",padding:"2px 8px",cursor:"pointer",color:"#dc2626",fontWeight:"700",fontSize:"0.72rem"}}>\n' +
  '                    \u26a0\ufe0f {op.trabajadoresAusentes?.length||1}\n' +
  '                  </button>\n' +
  '                ) : (\n' +
  '                  <button onClick={()=>{setEditNovOp(op);setShowEditNovModal(true);}}\n' +
  '                    style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:"6px",padding:"2px 8px",cursor:"pointer",color:"#10b981",fontWeight:"700",fontSize:"0.72rem"}}>\n' +
  '                    \u2713\n' +
  '                  </button>\n' +
  '                )}\n' +
  '              </td>\n' +
  '              <td style={{...tdSt,maxWidth:"180px"}}>\n' +
  '                <div style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontSize:"0.85rem",color:"#374151"}}>{op.servicioNombre';

if (content.includes(spiaAsistEnd)) {
  content = content.replace(spiaAsistEnd, novCellSpia);
  console.log('OK - celda Nov. SPIA insertada');
} else {
  console.log('SKIP SPIA - buscando patron alternativo...');
  // Buscar donde está el td de servicio en SPIA
  const idx2 = content.indexOf('fontSize:"0.85rem",color:"#374151"}}>{op.servicioNombre');
  console.log('Patron servicio SPIA en posicion:', idx2);
}

fs.writeFileSync(path, content, 'utf8');
console.log('LISTO');
