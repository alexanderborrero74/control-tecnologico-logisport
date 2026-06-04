const fs = require('fs');
const path = 'pages/nomina/matriz.js';
let content = fs.readFileSync(path, 'utf8');

// ══ 1. ESTADOS para modal editar novedad ══
content = content.replace(
  'const [novedadActivaWorker, setNovedadActivaWorker] = useState(null);',
  'const [novedadActivaWorker, setNovedadActivaWorker] = useState(null);\n' +
  '  const [showEditNovModal,    setShowEditNovModal]    = useState(false);\n' +
  '  const [editNovOp,           setEditNovOp]           = useState(null);\n' +
  '  const [showRegNovForm,      setShowRegNovForm]      = useState(false);\n' +
  '  const [regNovForm,          setRegNovForm]          = useState({fecha:"",trabajadorId:"",trabajadorNombre:"",novedad:"",observacion:""});'
);

// ══ 2. Col "Nov." en tabla SPIA ══
content = content.replace(
  '["#","Cuadrilla","Fecha","Asistentes","Servicio","Cant.","Neto","X Persona","Acc."].map(h=>(<th key={h}>{h}</th>))',
  '["#","Cuadrilla","Fecha","Asistentes","Nov.","Servicio","Cant.","Neto","X Persona","Acc."].map(h=>(<th key={h}>{h}</th>))'
);

// ══ 3. Col "Nov." en tabla CIAMSA ══
content = content.replace(
  '["#","Trabajador","Cédula","Fecha","Servicio","Cantidad","N.Per","PER","Tarifa","Neto","Acc."].map(h=>(<th key={h}>{h}</th>))',
  '["#","Trabajador","Cédula","Fecha","Nov.","Servicio","Cantidad","N.Per","PER","Tarifa","Neto","Acc."].map(h=>(<th key={h}>{h}</th>))'
);

// ══ 4. Celda Nov. en filas SPIA (después de td de asistentes) ══
const spiaAfterAsist = '{asisten.slice(0,2).map(w=>w.nombre?.split(" ")[0]).join(", ")}{asisten.length>2?`+${asisten.length-2}`:""}\n                </div>\n              </td>';
const spiaWithNov = '{asisten.slice(0,2).map(w=>w.nombre?.split(" ")[0]).join(", ")}{asisten.length>2?`+${asisten.length-2}`:""}\n                </div>\n              </td>\n' +
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
  '              </td>';

if (content.includes(spiaAfterAsist)) {
  content = content.replace(spiaAfterAsist, spiaWithNov);
  console.log('OK - celda Nov SPIA');
} else {
  console.log('SKIP - patron SPIA no encontrado (puede ya estar)');
}

// ══ 5. Celda Nov. en filas CIAMSA (antes del td de acciones eliminar/editar) ══
const ciamsaAccBtn = '<td style={tdSt}>\n            <div style={{display:"flex",gap:"0.3rem"}}>\n            <button onClick={()=>ciamsaIniciarEdicion(op)}';
const ciamsaWithNov =
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
  '              <td style={tdSt}>\n            <div style={{display:"flex",gap:"0.3rem"}}>\n            <button onClick={()=>ciamsaIniciarEdicion(op)}';

if (content.includes(ciamsaAccBtn)) {
  content = content.replace(ciamsaAccBtn, ciamsaWithNov);
  console.log('OK - celda Nov CIAMSA');
} else {
  console.log('SKIP - patron CIAMSA no encontrado');
}

// ══ 6. Modal editar novedades + form registrar novedad pura ══
const insertMark = '      {/* \u2550\u2550 MODAL DETALLE POR TRABAJADOR \u2550\u2550 */}';
const novModales =
  '      {/* \u2550\u2550 MODAL EDITAR NOVEDADES \u2550\u2550 */}\n' +
  '      {showEditNovModal && editNovOp && (() => {\n' +
  '        const todos = (editNovOp.trabajadoresAsisten||[]).map(w=>({\n' +
  '          ...w, novedad:(editNovOp.trabajadoresAusentes||[]).find(a=>a.id===w.id)?.novedad||""\n' +
  '        }));\n' +
  '        const guardarNovedades = async (nuevosTodos) => {\n' +
  '          const ausentes = nuevosTodos.filter(w=>w.novedad).map(w=>({id:w.id,nombre:w.nombre,novedad:w.novedad}));\n' +
  '          const {updateDoc,doc:dc} = await import("firebase/firestore");\n' +
  '          await updateDoc(dc(db,"nomina_operaciones",editNovOp.id),{trabajadoresAusentes:ausentes,actualizadoEn:new Date()});\n' +
  '          setShowEditNovModal(false); setEditNovOp(null); await cargarOperaciones();\n' +
  '        };\n' +
  '        return (\n' +
  '          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}}\n' +
  '            onClick={e=>{if(e.target===e.currentTarget){setShowEditNovModal(false);setEditNovOp(null);}}}>\n' +
  '            <div style={{background:"#fff",borderRadius:"16px",width:"100%",maxWidth:"680px",boxShadow:"0 20px 60px rgba(0,0,0,0.3)",overflow:"hidden"}}>\n' +
  '              <div style={{background:"linear-gradient(135deg,#dc2626,#b91c1c)",padding:"1rem 1.5rem",display:"flex",alignItems:"center",justifyContent:"space-between"}}>\n' +
  '                <div>\n' +
  '                  <div style={{fontWeight:"800",color:"#fff",fontSize:"1rem"}}>\u26a0\ufe0f Novedades del Registro</div>\n' +
  '                  <div style={{color:"rgba(255,255,255,0.8)",fontSize:"0.78rem"}}>{editNovOp.fechaStr} \u00b7 {editNovOp.cuadrillaNombre||editNovOp.cuadrilla} \u00b7 {editNovOp.servicioNombre}</div>\n' +
  '                </div>\n' +
  '                <button onClick={()=>{setShowEditNovModal(false);setEditNovOp(null);}} style={{background:"rgba(255,255,255,0.15)",border:"none",borderRadius:"8px",padding:"0.4rem",cursor:"pointer",color:"#fff"}}><X size={18}/></button>\n' +
  '              </div>\n' +
  '              <div style={{padding:"1rem 1.5rem",maxHeight:"60vh",overflowY:"auto"}}>\n' +
  '                <NovEditList todos={todos} novedades={novedades} onGuardar={guardarNovedades} onCancelar={()=>{setShowEditNovModal(false);setEditNovOp(null);}} puedeEditar={puedeEditarMatriz}/>\n' +
  '              </div>\n' +
  '            </div>\n' +
  '          </div>\n' +
  '        );\n' +
  '      })()}\n\n' +
  '      {/* \u2550\u2550 PANEL REGISTRAR NOVEDAD PURA \u2550\u2550 */}\n' +
  '      {showRegNovForm && clienteActivo==="spia" && (\n' +
  '        <div style={{margin:"0 0.75rem 1rem",background:"#fff",borderRadius:"12px",border:"2px solid #fecdd3",overflow:"hidden"}}>\n' +
  '          <div style={{background:"#fff1f2",padding:"0.55rem 1rem",fontWeight:"800",color:"#dc2626",fontSize:"0.85rem",borderBottom:"1px solid #fecdd3",display:"flex",alignItems:"center",justifyContent:"space-between"}}>\n' +
  '            <span>\ud83d\udccb Registrar Novedad (sin producci\u00f3n)</span>\n' +
  '            <button onClick={()=>setShowRegNovForm(false)} style={{background:"none",border:"none",cursor:"pointer",color:"#94a3b8"}}><X size={16}/></button>\n' +
  '          </div>\n' +
  '          <div style={{padding:"1rem",display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0.75rem",alignItems:"end"}}>\n' +
  '            <div>\n' +
  '              <label style={{display:"block",fontSize:"0.72rem",fontWeight:"700",color:"#374151",marginBottom:"0.2rem"}}>\ud83d\udc64 Trabajador</label>\n' +
  '              <select value={regNovForm.trabajadorId} onChange={e=>{\n' +
  '                const t=listaTrabajadores.find(x=>x.id===e.target.value)||{};\n' +
  '                setRegNovForm(p=>({...p,trabajadorId:e.target.value,trabajadorNombre:t.nombre||""}));\n' +
  '              }} style={{width:"100%",border:"1px solid #fecdd3",borderRadius:"6px",padding:"0.38rem 0.6rem",fontSize:"0.82rem",outline:"none"}}>\n' +
  '                <option value="">\u2014 Seleccionar \u2014</option>\n' +
  '                {listaTrabajadores.map(t=>(<option key={t.id} value={t.id}>{t.nombre}</option>))}\n' +
  '              </select>\n' +
  '            </div>\n' +
  '            <div>\n' +
  '              <label style={{display:"block",fontSize:"0.72rem",fontWeight:"700",color:"#374151",marginBottom:"0.2rem"}}>\ud83d\udcc5 Fecha</label>\n' +
  '              <input type="date" value={regNovForm.fecha} onChange={e=>setRegNovForm(p=>({...p,fecha:e.target.value}))}\n' +
  '                style={{width:"100%",border:"1px solid #fecdd3",borderRadius:"6px",padding:"0.38rem 0.6rem",fontSize:"0.82rem",outline:"none",boxSizing:"border-box"}}/>\n' +
  '            </div>\n' +
  '            <div>\n' +
  '              <label style={{display:"block",fontSize:"0.72rem",fontWeight:"700",color:"#374151",marginBottom:"0.2rem"}}>\u26a0\ufe0f Novedad</label>\n' +
  '              <select value={regNovForm.novedad} onChange={e=>setRegNovForm(p=>({...p,novedad:e.target.value}))}\n' +
  '                style={{width:"100%",border:"1px solid #fecdd3",borderRadius:"6px",padding:"0.38rem 0.6rem",fontSize:"0.82rem",outline:"none"}}>\n' +
  '                <option value="">\u2014 Tipo \u2014</option>\n' +
  '                {novedades.map(n=>(<option key={n.codigo} value={n.codigo}>{n.emoji} {n.label}</option>))}\n' +
  '              </select>\n' +
  '            </div>\n' +
  '            <div style={{gridColumn:"1/-1"}}>\n' +
  '              <label style={{display:"block",fontSize:"0.72rem",fontWeight:"700",color:"#374151",marginBottom:"0.2rem"}}>\ud83d\udcdd Observaci\u00f3n</label>\n' +
  '              <input value={regNovForm.observacion} onChange={e=>setRegNovForm(p=>({...p,observacion:e.target.value}))}\n' +
  '                placeholder="Detalle de la novedad..."\n' +
  '                style={{width:"100%",border:"1px solid #fecdd3",borderRadius:"6px",padding:"0.38rem 0.6rem",fontSize:"0.82rem",outline:"none",boxSizing:"border-box"}}/>\n' +
  '            </div>\n' +
  '            <div style={{gridColumn:"1/-1",display:"flex",gap:"0.5rem"}}>\n' +
  '              <button onClick={async()=>{\n' +
  '                if(!regNovForm.trabajadorId||!regNovForm.fecha||!regNovForm.novedad){alert("Completa trabajador, fecha y novedad.");return;}\n' +
  '                const t=listaTrabajadores.find(x=>x.id===regNovForm.trabajadorId)||{};\n' +
  '                const nov=novedades.find(n=>n.codigo===regNovForm.novedad)||{};\n' +
  '                const {addDoc,collection:col,Timestamp}=await import("firebase/firestore");\n' +
  '                await addDoc(col(db,"nomina_operaciones"),{\n' +
  '                  periodoDesde,periodoHasta,clienteId:"spia",modoNovedad:true,modoCiamsa:false,\n' +
  '                  quincenaId:periodoDesde+" al "+periodoHasta,\n' +
  '                  quincenaLabel:periodoDesde+" al "+periodoHasta,\n' +
  '                  cuadrillaId:regNovForm.trabajadorId,\n' +
  '                  cuadrillaNombre:t.nombre||"",trabajadorId:regNovForm.trabajadorId,\n' +
  '                  trabajadorNombre:t.nombre||"",trabajadorCedula:String(t.cedula||""),\n' +
  '                  fecha:Timestamp.fromDate(new Date(regNovForm.fecha+"T12:00:00")),\n' +
  '                  fechaStr:regNovForm.fecha,servicioNombre:regNovForm.novedad,\n' +
  '                  novedad:regNovForm.novedad,novedadLabel:nov.label||"",\n' +
  '                  observacion:regNovForm.observacion,\n' +
  '                  netoAPagar:0,personas:1,cantidad:1,\n' +
  '                  trabajadoresAsisten:[{id:t.id,nombre:t.nombre,cedula:String(t.cedula||"")}],\n' +
  '                  trabajadoresAusentes:[{id:t.id,nombre:t.nombre,novedad:regNovForm.novedad}],\n' +
  '                  actualizadoEn:new Date(),creadoEn:new Date(),\n' +
  '                });\n' +
  '                setRegNovForm({fecha:"",trabajadorId:"",trabajadorNombre:"",novedad:"",observacion:""});\n' +
  '                setShowRegNovForm(false); await cargarOperaciones();\n' +
  '                alert("\u2705 Novedad registrada correctamente");\n' +
  '              }} style={{background:"#dc2626",border:"none",borderRadius:"7px",padding:"0.45rem 1.25rem",cursor:"pointer",color:"#fff",fontWeight:"800",fontSize:"0.82rem"}}>\n' +
  '                \ud83d\udcbe Guardar Novedad\n' +
  '              </button>\n' +
  '              <button onClick={()=>setShowRegNovForm(false)} style={{background:"#f1f5f9",border:"1px solid #e2e8f0",borderRadius:"7px",padding:"0.45rem 0.75rem",cursor:"pointer",color:"#475569",fontWeight:"700",fontSize:"0.82rem"}}>Cancelar</button>\n' +
  '            </div>\n' +
  '          </div>\n' +
  '        </div>\n' +
  '      )}\n\n' +
  '      {/* \u2550\u2550 MODAL DETALLE POR TRABAJADOR \u2550\u2550 */}';

if (content.includes(insertMark)) {
  content = content.replace(insertMark, novModales);
  console.log('OK - modales novedad insertados');
} else {
  console.log('ERROR - marca MODAL DETALLE no encontrada');
}

// ══ 7. Botón Registrar Novedad en SPIA ══
const btnRegNov =
  '              {clienteActivo==="spia" && personalFijoC2.length === 0 && (\n' +
  '                <button onClick={async()=>{';
if (content.includes('clienteActivo==="spia" && personalFijoC2.length === 0')) {
  content = content.replace(
    'clienteActivo==="spia" && personalFijoC2.length === 0',
    'clienteActivo==="spia" && false /* seed btn oculto */'
  );
  // Agregar boton registrar novedad después de "Cargar trabajadores BD"
  content = content.replace(
    '<button onClick={cargarTodosTrabajadores} style={btnStyle("8b5cf6", false, "sm")}>\n                <UserPlus size={14} /> Cargar trabajadores BD\n              </button>',
    '<button onClick={cargarTodosTrabajadores} style={btnStyle("8b5cf6", false, "sm")}>\n                <UserPlus size={14} /> Cargar trabajadores BD\n              </button>\n              {clienteActivo==="spia" && (\n                <button onClick={()=>setShowRegNovForm(p=>!p)}\n                  style={{...btnStyle("dc2626",false,"sm"),background:showRegNovForm?"#b91c1c":"#fff1f2",color:showRegNovForm?"#fff":"#dc2626",border:"1px solid #fecdd3"}}>\n                  \ud83d\udccb {showRegNovForm?"Cerrar":"Registrar Novedad"}\n                </button>\n              )}'
  );
  console.log('OK - boton Registrar Novedad agregado');
}

fs.writeFileSync(path, content, 'utf8');
console.log('LISTO');
