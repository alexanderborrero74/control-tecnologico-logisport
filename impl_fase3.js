const fs = require('fs');
const path = 'pages/nomina/matriz.js';
let c = fs.readFileSync(path,'utf8');

// ══ 4. CROSS-CLIENT WORKERS EN TERRESTRE/CIAMSA ══
// El panel actual muestra solo SPIA workers como "Personal SPIA adicional"
// Necesitamos mostrar workers de TODOS los demás clientes

// La sección actual del panel de workers SPIA en Terrestre:
// trabSpia = todosTrabajadores.filter(t => !ids.includes(clienteActivo) && ids.includes("spia"))
// La mostramos como "Personal SPIA adicional"
// Necesitamos extenderlo para mostrar TODOS los otros clientes

// Reemplazar la definición de trabSpia para incluir todos los otros clientes
const oldTrabSpia = `          const trabSpia = todosTrabajadores.filter(t =>
            !(t.clienteIds || ["spia"]).includes(clienteActivo) &&
            (t.clienteIds || ["spia"]).includes("spia")
          );`;

const newTrabSpia = `          const trabSpia = todosTrabajadores.filter(t =>
            (t.clienteIds || ["spia"]).includes("spia") &&
            !(t.clienteIds || ["spia"]).includes(clienteActivo)
          );
          // Workers de TODOS los demás clientes (no solo SPIA)
          const OTROS_CLIENTES_INFO = [
            {id:"spia",    label:"SPIA",     color:"#0B3D91"},
            {id:"cliente1",label:"Terrestre",color:"#f59e0b"},
            {id:"cliente2",label:"CIAMSA 2", color:"#3b82f6"},
            {id:"cliente3",label:"CIAMSA 3", color:"#8b5cf6"},
          ];
          const trabOtrosPorCliente = OTROS_CLIENTES_INFO
            .filter(cl=>cl.id!==clienteActivo)
            .map(cl=>({
              ...cl,
              trabajadores: todosTrabajadores.filter(t=>{
                const ids=t.clienteIds||["spia"];
                return ids.includes(cl.id) && !ids.includes(clienteActivo);
              })
            }))
            .filter(cl=>cl.trabajadores.length>0);`;

if(c.includes(oldTrabSpia)){
  c = c.replace(oldTrabSpia, newTrabSpia);
  console.log('4a. trabSpia y trabOtrosPorCliente definidos');
} else {
  console.log('4a. SKIP - patron trabSpia no encontrado');
}

// Ahora reemplazar la UI del "Personal SPIA adicional" para mostrar TODOS los clientes
// El patrón actual:
// {trabSpia.length > 0 && (
//   <>
//     <div>🧿 Personal SPIA adicional</div>
//     <input value={busqSpiaCiamsa} .../>
//     <div><filtSpia.map(t=>(...)}</div>
//   </>
// )}
// Reemplazarlo con un panel para CADA cliente adicional

const oldSpiaPanelStart = `                  {/* Personal SPIA adicional */}
                  {trabSpia.length > 0 && (
                    <>
                      <div style={{ fontSize:"0.72rem", fontWeight:"700", color:"#0B3D91",
                        textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:"0.35rem" }}>
                        ðY§³ Personal SPIA adicional
                      </div>
                      <input value={busqSpiaCiamsa} onChange={e => setBusqSpiaCiamsa(e.target.value)}
                        placeholder="ðY"? Buscar SPIA..."
                        style={{ ...inputSt, padding:"0.45rem 0.75rem", fontSize:"0.82rem", marginBottom:"0.5rem" }} />
                      <div style={{ border:"1px solid #dbeafe", borderRadius:"10px",
                        overflow:"hidden", maxHeight:"140px", overflowY:"auto" }}>
                        {filtSpia.map(t => {
                          const selec = sel.some(x => x.id === t.id);
                          return (
                            <div key={t.id} onClick={() => cuadrillaDiaToggleTrabajador(t)}
                              style={{ display:"flex", alignItems:"center", gap:"0.5rem",
                                padding:"0.4rem 0.65rem",
                                background: selec ? "#eff6ff" : "#fff",
                                borderBottom:"1px solid #f0f9ff",
                                cursor:"pointer" }}
                              onMouseEnter={e=>{ if(!selec) e.currentTarget.style.background="#f0f9ff"; }}
                              onMouseLeave={e=>{ if(!selec) e.currentTarget.style.background="#fff"; }}>
                              <div style={{ width:"15px", height:"15px", borderRadius:"4px", flexShrink:0,
                                border:\`2px solid \${selec ? "#0B3D91" : "#cbd5e1"}\`,
                                background: selec ? "#0B3D91" : "#fff",
                                display:"flex", alignItems:"center", justifyContent:"center" }}>
                                {selec && <CheckCircle size={9} color="#fff" strokeWidth={3}/>}
                              </div>
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ fontWeight: selec?"700":"400", fontSize:"0.82rem",
                                  color: selec ? "#0B3D91" : "#1e293b",
                                  overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                                  {t.nombre}
                                </div>
                                <div style={{ fontSize:"0.67rem", color:"#94a3b8", fontFamily:"monospace" }}>{t.cedula}</div>
                              </div>
                              <span style={{ fontSize:"0.6rem", background:"#dbeafe", color:"#1d4ed8",
                                borderRadius:"4px", padding:"1px 5px", fontWeight:"700", flexShrink:0 }}>SPIA</span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}`;

const newAllClientsPanel = `                  {/* Personal adicional de TODOS los demás clientes */}
                  {trabOtrosPorCliente.length > 0 && (
                    <>
                      <div style={{fontSize:"0.72rem",fontWeight:"700",color:"#374151",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"0.35rem"}}>
                        👥 Personal adicional — otros clientes
                      </div>
                      <input value={busqSpiaCiamsa} onChange={e=>setBusqSpiaCiamsa(e.target.value)}
                        placeholder="🔍 Buscar por nombre o cédula..."
                        style={{...inputSt,padding:"0.45rem 0.75rem",fontSize:"0.82rem",marginBottom:"0.5rem"}}/>
                      {trabOtrosPorCliente.map(cl=>{
                        const qS=busqSpiaCiamsa.toLowerCase().trim();
                        const filtCl=qS?cl.trabajadores.filter(t=>t.nombre?.toLowerCase().includes(qS)||String(t.cedula||"").includes(busqSpiaCiamsa)):cl.trabajadores;
                        if(!filtCl.length) return null;
                        return (
                          <div key={cl.id} style={{marginBottom:"0.5rem"}}>
                            <div style={{fontSize:"0.67rem",fontWeight:"700",color:cl.color,textTransform:"uppercase",letterSpacing:"0.04em",padding:"2px 6px",background:cl.color+"18",borderRadius:"4px",display:"inline-block",marginBottom:"0.25rem"}}>
                              {cl.label}
                            </div>
                            <div style={{border:\`1px solid \${cl.color}40\`,borderRadius:"8px",overflow:"hidden",maxHeight:"140px",overflowY:"auto"}}>
                              {filtCl.map(t=>{
                                const selec=sel.some(x=>x.id===t.id);
                                return(
                                  <div key={t.id} onClick={()=>cuadrillaDiaToggleTrabajador(t)}
                                    style={{display:"flex",alignItems:"center",gap:"0.5rem",padding:"0.4rem 0.65rem",background:selec?\`\${cl.color}12\`:"#fff",borderBottom:"1px solid #f8fafc",cursor:"pointer"}}
                                    onMouseEnter={e=>{if(!selec)e.currentTarget.style.background=cl.color+"08";}}
                                    onMouseLeave={e=>{if(!selec)e.currentTarget.style.background="#fff";}}>
                                    <div style={{width:"15px",height:"15px",borderRadius:"4px",flexShrink:0,border:\`2px solid \${selec?cl.color:"#cbd5e1"}\`,background:selec?cl.color:"#fff",display:"flex",alignItems:"center",justifyContent:"center"}}>
                                      {selec&&<CheckCircle size={9} color="#fff" strokeWidth={3}/>}
                                    </div>
                                    <div style={{flex:1,minWidth:0}}>
                                      <div style={{fontWeight:selec?"700":"400",fontSize:"0.82rem",color:selec?cl.color:"#1e293b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.nombre}</div>
                                      <div style={{fontSize:"0.67rem",color:"#94a3b8",fontFamily:"monospace"}}>{t.cedula}</div>
                                    </div>
                                    <span style={{fontSize:"0.6rem",background:cl.color+"20",color:cl.color,borderRadius:"4px",padding:"1px 5px",fontWeight:"700",flexShrink:0}}>{cl.label}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}`;

if(c.includes(oldSpiaPanelStart.substring(0,60))){
  // Buscar y reemplazar usando índice
  const idx = c.indexOf(oldSpiaPanelStart.substring(0,60));
  if(idx !== -1){
    // Encontrar el fin del bloque (buscar el cierre )})
    const endMark = `                  )}`;
    const searchFrom = idx + 200;
    let endIdx = c.indexOf(endMark, searchFrom);
    if(endIdx !== -1){
      const replaced = c.substring(0, idx) + newAllClientsPanel + c.substring(endIdx + endMark.length);
      c = replaced;
      console.log('4b. Panel cross-client reemplazado');
    } else {
      console.log('4b. SKIP - no se encontró el cierre del panel');
    }
  }
} else {
  console.log('4b. SKIP - panel SPIA adicional no encontrado (puede haber cambiado)');
}

fs.writeFileSync(path, c, 'utf8');
console.log('FASE 3 OK');
