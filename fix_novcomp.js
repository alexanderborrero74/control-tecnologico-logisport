// Componente helper para editar novedades de un registro
// Se agrega al inicio de matriz.js después de los otros componentes helper

const NOV_EDIT_COMPONENT = `
// ── Componente: lista editable de novedades por trabajador ──
function NovEditList({ todos, novedades, onGuardar, onCancelar, puedeEditar }) {
  const [lista, setLista] = React.useState(todos.map(w=>({...w})));
  const setNov = (id, val) => setLista(prev => prev.map(w => w.id===id ? {...w, novedad:val} : w));
  const conNov = lista.filter(w=>w.novedad).length;
  return (
    <div>
      <div style={{fontSize:"0.78rem",color:"#64748b",marginBottom:"0.75rem"}}>
        {lista.length} trabajadores en este registro · {conNov} con novedad
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:"0.4rem",marginBottom:"1rem"}}>
        {lista.map(w=>{
          const nov = novedades.find(n=>n.codigo===w.novedad);
          return (
            <div key={w.id} style={{display:"flex",alignItems:"center",gap:"0.5rem",padding:"0.4rem 0.6rem",borderRadius:"8px",
              background:w.novedad?(nov?.bg||"#fff1f2"):"#f8fafc",border:\`1px solid \${w.novedad?(nov?.color||"#fecdd3"):"#e2e8f0"}\`}}>
              <div style={{flex:1,fontWeight:"600",fontSize:"0.82rem",color:"#1e293b",minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                {w.nombre}
                {w.cedula&&<span style={{fontSize:"0.68rem",color:"#94a3b8",marginLeft:"0.4rem",fontFamily:"monospace"}}>{w.cedula}</span>}
              </div>
              {puedeEditar ? (
                <select value={w.novedad||""} onChange={e=>setNov(w.id,e.target.value)}
                  style={{border:\`1.5px solid \${w.novedad?(nov?.color||"#fecdd3"):"#e2e8f0"}\`,borderRadius:"6px",
                    padding:"0.25rem 0.5rem",fontSize:"0.75rem",fontWeight:w.novedad?"700":"400",
                    background:w.novedad?(nov?.bg||"#fff1f2"):"#fff",color:w.novedad?(nov?.color||"#dc2626"):"#475569",outline:"none",cursor:"pointer",minWidth:"180px"}}>
                  <option value="">✓ Sin novedad — asistió normal</option>
                  {novedades.map(n=>(<option key={n.codigo} value={n.codigo}>{n.emoji} {n.label} ({n.codigo})</option>))}
                </select>
              ) : (
                <span style={{fontSize:"0.75rem",fontWeight:"700",color:nov?.color||"#475569",background:nov?.bg||"#f1f5f9",borderRadius:"5px",padding:"2px 8px"}}>
                  {nov?nov.emoji+" "+nov.label:"✓ Normal"}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {puedeEditar && (
        <div style={{display:"flex",gap:"0.5rem",justifyContent:"flex-end",borderTop:"1px solid #e2e8f0",paddingTop:"0.75rem"}}>
          <button onClick={onCancelar} style={{background:"#f1f5f9",border:"1px solid #e2e8f0",borderRadius:"7px",padding:"0.4rem 0.9rem",cursor:"pointer",color:"#475569",fontWeight:"700",fontSize:"0.82rem"}}>
            Cancelar
          </button>
          <button onClick={()=>onGuardar(lista)} style={{background:"#dc2626",border:"none",borderRadius:"7px",padding:"0.4rem 1rem",cursor:"pointer",color:"#fff",fontWeight:"800",fontSize:"0.82rem",display:"flex",alignItems:"center",gap:"0.3rem"}}>
            💾 Guardar Novedades
          </button>
        </div>
      )}
    </div>
  );
}
`;

const fs = require('fs');
const path = 'pages/nomina/matriz.js';
let content = fs.readFileSync(path, 'utf8');

// Insertar el componente antes de export default
const marker = 'export default function NominaMatriz()';
if (content.includes(marker)) {
  content = content.replace(marker, NOV_EDIT_COMPONENT + '\n' + marker);
  fs.writeFileSync(path, content, 'utf8');
  console.log('OK - NovEditList componente agregado');
} else {
  console.log('ERROR - marker no encontrado');
}
