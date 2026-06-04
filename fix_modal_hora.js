const fs = require('fs');
const path = 'pages/nomina/matriz.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Agregar hora y opId al push de filas (sin asistentes)
content = content.replace(
  `filas.push({nombre:op.trabajadorNombre||op.cuadrillaNombre||"",cedula:op.trabajadorCedula||"",fecha:op.fechaStr||"",cuadrilla:op.c`,
  `filas.push({nombre:op.trabajadorNombre||op.cuadrillaNombre||"",cedula:op.trabajadorCedula||"",fecha:op.fechaStr||"",hora:(()=>{try{const d=op.creadoEn?.toDate?op.creadoEn.toDate():new Date(op.creadoEn?.seconds*1000||op.creadoEn);return d.toLocaleTimeString("es-CO",{hour:"2-digit",minute:"2-digit"});}catch(e){return"";}})(),opId:op.id,cuadrilla:op.c`
);

// 2. Agregar hora y opId al push de filas con asistentes
content = content.replace(
  `asisten.forEach(w=>filas.push({nombre:w.nombre||"",cedula:w.cedula||"",fecha:op.fechaStr||"",cuadrilla:op.cuadrillaNombre||op.cuad`,
  `asisten.forEach(w=>filas.push({nombre:w.nombre||"",cedula:w.cedula||"",fecha:op.fechaStr||"",hora:(()=>{try{const d=op.creadoEn?.toDate?op.creadoEn.toDate():new Date(op.creadoEn?.seconds*1000||op.creadoEn);return d.toLocaleTimeString("es-CO",{hour:"2-digit",minute:"2-digit"});}catch(e){return"";}})(),opId:op.id,cuadrilla:op.cuadrillaNombre||op.cuad`
);

// 3. Agregar "Hora" y "Acc." a los headers
content = content.replace(
  `{["#","Trabajador","Cédula","Fecha","Cuadrilla","Servicio","Cant.","Neto"].map(h=>(`,
  `{["#","Trabajador","Cédula","Fecha","Hora","Cuadrilla","Servicio","Cant.","Neto","Acc."].map(h=>(`
);

// 4. Agregar celda de hora después de fecha en las filas
content = content.replace(
  `<td style={{...tdSt,color:"#475569",whiteSpace:"nowrap"}}>{f.fecha}</td>`,
  `<td style={{...tdSt,color:"#475569",whiteSpace:"nowrap"}}>{f.fecha}</td>
                <td style={{...tdSt,fontFamily:"monospace",fontSize:"0.78rem",color:"#6366f1",whiteSpace:"nowrap",textAlign:"center"}}>{f.hora||"—"}</td>`
);

// 5. Agregar botón eliminar después del neto
content = content.replace(
  `<td style={{...tdSt,fontWeight:"900",color:SUCCESS,fontFamily:"monospace",whiteSpace:"nowrap",background:"#f0fdf4"}}>{formatCOP(f.`,
  `<td style={{...tdSt,fontWeight:"900",color:SUCCESS,fontFamily:"monospace",whiteSpace:"nowrap",background:"#f0fdf4"}}>{formatCOP(f.`
);

// Buscar el cierre de la fila del modal para agregar botón eliminar
content = content.replace(
  `<td style={{...tdSt,fontWeight:"900",color:SUCCESS,fontFamily:"monospace",whiteSpace:"nowrap",background:"#f0fdf4"}}>{formatCOP(f.neto||0)}</td>
                </tr>`,
  `<td style={{...tdSt,fontWeight:"900",color:SUCCESS,fontFamily:"monospace",whiteSpace:"nowrap",background:"#f0fdf4"}}>{formatCOP(f.neto||0)}</td>
                <td style={{...tdSt,textAlign:"center"}}>
                  {f.opId&&tieneControlMatriz&&(
                    <button onClick={async()=>{
                      if(!confirm("¿Eliminar este registro?")) return;
                      const {deleteDoc:dd,doc:dc}=await import("firebase/firestore");
                      await dd(dc(db,"nomina_operaciones",f.opId));
                      setShowDetalleModal(false);
                      await cargarOperaciones();
                    }} style={{background:"#fee2e2",border:"1px solid #fecdd3",borderRadius:"5px",padding:"2px 8px",cursor:"pointer",color:"#dc2626",fontWeight:"700",fontSize:"0.72rem"}}>
                      🗑
                    </button>
                  )}
                </td>
                </tr>`
);

// 6. colSpan total actualizado
content = content.replace(
  `<td colSpan={7} style={{padding:"0.75rem 0.8rem",fontWeight:"700",color:"#065f46"}}>TOTAL — {filasFilt.length} registros</td>`,
  `<td colSpan={9} style={{padding:"0.75rem 0.8rem",fontWeight:"700",color:"#065f46"}}>TOTAL — {filasFilt.length} registros</td>`
);

// 7. colSpan sin registros
content = content.replace(
  `colSpan={8} style={{textAlign:"center",padding:"3rem",color:"#94a3b8"}}>Sin registros con los filtr`,
  `colSpan={10} style={{textAlign:"center",padding:"3rem",color:"#94a3b8"}}>Sin registros con los filtr`
);

fs.writeFileSync(path, content, 'utf8');
console.log('OK - hora y boton eliminar agregados al modal Detalle');
