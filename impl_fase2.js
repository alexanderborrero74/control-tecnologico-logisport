const fs = require('fs');
const path = 'pages/nomina/matriz.js';
let c = fs.readFileSync(path,'utf8');
const lines = c.split('\n');

// ══ 3. BOTÓN EDITAR EN TABLA SPIA ══
// Buscar el botón eliminar en la tabla SPIA para agregar editar antes
// La tabla SPIA tiene: op.cuadrillaNombre, op.personas, op.servicioNombre, op.netoAPagar
// Buscar el patrón del botón eliminar en la tabla SPIA (no CIAMSA)

// La tabla SPIA está en la segunda tabla (xl-table para SPIA)
// El botón eliminar en la tabla SPIA tiene: onClick={()=>eliminar(op)} con tdSt
const spiaDeleteBtn = '<button onClick={()=>eliminar(op)} disabled={!tieneControlMatriz} title={!tieneControlMatriz?"Sin permiso":""} style={{background:"#fee2e2",border:"1px solid #fecdd3",borderRadius:"6px",padding:"0.25rem 0.5rem",cursor:tieneControlMatriz?"pointer":"not-allowed",color:"#dc2626",opacity:!tieneControlMatriz?0.5:1}}>\n              <Trash2 size={14}/>\n            </button>\n            </div>\n          </td>\n          </tr>\n          );\n          })}';

// Buscar las líneas del botón eliminar de SPIA
let spiaDelIdx = -1;
for(let i=0;i<lines.length;i++){
  if(lines[i].includes('onClick={()=>eliminar(op)}') && lines[i+2]?.includes('Trash2')){
    // Verificar que es la tabla SPIA (no CIAMSA que tiene ciamsaIniciarEdicion)
    // Buscar en las 30 líneas anteriores si hay 'ciamsaIniciarEdicion'
    const prev30 = lines.slice(Math.max(0,i-30),i).join('\n');
    if(!prev30.includes('ciamsaIniciarEdicion')){
      spiaDelIdx = i;
      console.log('Botón eliminar SPIA encontrado en línea:', i+1);
      console.log('Contexto:', lines[i].trim().substring(0,80));
      break;
    }
  }
}

if(spiaDelIdx !== -1){
  // Insertar botón editar ANTES del botón eliminar
  const editBtn = [
    '            <button onClick={()=>spiaIniciarEdicion(op)} disabled={!puedeEditarMatriz} title={!puedeEditarMatriz?"Sin permiso de edición":""} style={{background:editandoId===op.id?"#fef3c7":"#eff6ff",border:`1px solid ${editandoId===op.id?"#fbbf24":"#bfdbfe"}`,borderRadius:"6px",padding:"0.25rem 0.5rem",cursor:puedeEditarMatriz?"pointer":"not-allowed",color:editandoId===op.id?"#92400e":"#1d4ed8",opacity:!puedeEditarMatriz?0.5:1}}>',
    '              <Edit2 size={14}/>',
    '            </button>',
  ];
  lines.splice(spiaDelIdx, 0, ...editBtn);
  console.log('3. Botón editar SPIA insertado');
} else {
  console.log('3. SKIP - botón eliminar SPIA no encontrado');
}

c = lines.join('\n');
fs.writeFileSync(path, c, 'utf8');
console.log('FASE 2 OK');
