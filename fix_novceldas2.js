const fs = require('fs');
const path = 'pages/nomina/matriz.js';
const lines = fs.readFileSync(path, 'utf8').split('\n');

// Insertar celda Nov. en CIAMSA - entre línea 4525 (fecha) y 4526 (servicio)
// Línea 4526 es índice 4525 (0-based)
// Verificar que la línea es el td de maxWidth:180px del CIAMSA
const ciamsaServLine = 4525; // 0-based index (línea 4526 en el output)
console.log('Linea CIAMSA servicio:', lines[ciamsaServLine]?.substring(0,80));

const novCiamsaCell = [
  '                              <td style={{...tdSt,textAlign:"center"}}>',
  '                                {(op.trabajadoresAusentes?.length>0||op.modoNovedad) ? (',
  '                                  <button onClick={()=>{setEditNovOp(op);setShowEditNovModal(true);}}',
  '                                    style={{background:"#fff1f2",border:"1px solid #fecdd3",borderRadius:"6px",padding:"2px 7px",cursor:"pointer",color:"#dc2626",fontWeight:"700",fontSize:"0.7rem"}}>',
  '                                    \u26a0\ufe0f {op.trabajadoresAusentes?.length||1}',
  '                                  </button>',
  '                                ) : (',
  '                                  <button onClick={()=>{setEditNovOp(op);setShowEditNovModal(true);}}',
  '                                    style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:"6px",padding:"2px 7px",cursor:"pointer",color:"#10b981",fontWeight:"700",fontSize:"0.7rem"}}>',
  '                                    \u2713',
  '                                  </button>',
  '                                )}',
  '                              </td>',
];

// Insertar después de la línea de fecha td (4524, índice 0-based)
// La fecha es línea 4525 en el output = índice 4524
// El servicio td es línea 4526 = índice 4525
// Insertar antes del índice 4525
lines.splice(4525, 0, ...novCiamsaCell);
console.log('OK - Nov. CIAMSA insertada en linea 4526');

// Ahora insertar en SPIA - encontrar td de servicio en SPIA
// Buscar "fontSize:\"0.85rem\",color:\"#374151\"}}>{op.servicioNombre" después de línea 4600
let spiaServIdx = -1;
for(let i=4600;i<lines.length;i++){
  if(lines[i] && lines[i].includes('fontSize:"0.85rem",color:"#374151"') && lines[i].includes('op.servicioNombre')){
    spiaServIdx = i;
    break;
  }
}
console.log('SPIA servicio td en linea:', spiaServIdx+1);

if(spiaServIdx > 0){
  // El td de servicio tiene una línea de apertura antes
  // Necesito insertar antes del td (línea spiaServIdx - 1 debería ser el <td...)
  let tdStart = spiaServIdx;
  while(tdStart > spiaServIdx-3 && !lines[tdStart].includes('<td')){
    tdStart--;
  }
  console.log('TD apertura en linea:', tdStart+1, lines[tdStart]?.substring(0,60));
  
  const novSpiaCell = [
    '              <td style={{...tdSt,textAlign:"center"}}>',
    '                {(op.trabajadoresAusentes?.length>0||op.modoNovedad) ? (',
    '                  <button onClick={()=>{setEditNovOp(op);setShowEditNovModal(true);}}',
    '                    style={{background:"#fff1f2",border:"1px solid #fecdd3",borderRadius:"6px",padding:"2px 8px",cursor:"pointer",color:"#dc2626",fontWeight:"700",fontSize:"0.72rem"}}>',
    '                    \u26a0\ufe0f {op.trabajadoresAusentes?.length||1}',
    '                  </button>',
    '                ) : (',
    '                  <button onClick={()=>{setEditNovOp(op);setShowEditNovModal(true);}}',
    '                    style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:"6px",padding:"2px 8px",cursor:"pointer",color:"#10b981",fontWeight:"700",fontSize:"0.72rem"}}>',
    '                    \u2713',
    '                  </button>',
    '                )}',
    '              </td>',
  ];
  lines.splice(tdStart, 0, ...novSpiaCell);
  console.log('OK - Nov. SPIA insertada');
}

fs.writeFileSync(path, lines.join('\n'), 'utf8');
console.log('LISTO');
