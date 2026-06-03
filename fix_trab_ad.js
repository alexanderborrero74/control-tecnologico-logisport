const fs = require('fs');
const path = 'pages/nomina/matriz.js';
let lines = fs.readFileSync(path, 'utf8').split('\n');

// Encontrar inicio y fin del bloque TRABAJADORES ADICIONALES
let start = -1, end = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('TRABAJADORES ADICIONALES (cross-cliente)') && start === -1) {
    start = i - 1; // incluir la línea )}\n anterior
  }
  if (start !== -1 && lines[i].includes('Banner novedad activa') && end === -1) {
    end = i;
  }
}

console.log('Bloque encontrado: líneas', start+1, 'a', end+1);

if (start === -1 || end === -1) {
  console.log('ERROR: No se encontró el bloque');
  process.exit(1);
}

// Nuevo bloque correcto usando todosTrabajadores
const nuevoBloque = `
              {/* ── Trabajadores adicionales de otros clientes (SPIA) ── */}
              {clienteActivo==="spia" && (() => {
                const CLIENTES_AD = [
                  {id:"cliente1", label:"Terrestre", color:"#f59e0b"},
                  {id:"cliente2", label:"CIAMSA 2",  color:"#3b82f6"},
                  {id:"cliente3", label:"CIAMSA 3",  color:"#8b5cf6"},
                ];
                const qA = busqTrabAd.toLowerCase().trim();
                const trabsOtros = (todosTrabajadores||[]).filter(t =>
                  (t.clienteIds||["spia"]).some(id=>["cliente1","cliente2","cliente3"].includes(id))
                );
                const filtOtros = qA
                  ? trabsOtros.filter(t=>t.nombre?.toLowerCase().includes(qA)||String(t.cedula||"").includes(busqTrabAd))
                  : trabsOtros;
                if (trabsOtros.length === 0) return null;
                return (
                  <div style={{margin:"0.75rem 0",borderRadius:"12px",overflow:"hidden",border:"1.5px solid #e0e7ff"}}>
                    {/* Header colapsable */}
                    <div onClick={()=>setShowTrabsPanel(p=>!p)}
                      style={{padding:"0.55rem 1rem",background:showTrabsPanel?"#4f46e5":"#eef2ff",
                        display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",borderBottom:showTrabsPanel?"1px solid #4338ca":"none"}}>
                      <span style={{fontWeight:"800",color:showTrabsPanel?"#fff":"#4f46e5",fontSize:"0.82rem",display:"flex",alignItems:"center",gap:"0.5rem"}}>
                        👥 Personal adicional de otros clientes
                        {trabsAdicionales.length>0&&(
                          <span style={{background:showTrabsPanel?"rgba(255,255,255,0.25)":"#4f46e5",color:"#fff",borderRadius:"12px",padding:"1px 8px",fontSize:"0.7rem",fontWeight:"800"}}>
                            {trabsAdicionales.length}
                          </span>
                        )}
                      </span>
                      <span style={{color:showTrabsPanel?"rgba(255,255,255,0.7)":"#6366f1",fontSize:"0.68rem"}}>
                        {showTrabsPanel?"▲ Cerrar":"▼ "+ trabsOtros.length+" disponibles"}
                      </span>
                    </div>

                    {/* Chips seleccionados */}
                    {trabsAdicionales.length>0&&(
                      <div style={{padding:"0.4rem 0.75rem",background:"#f5f3ff",borderBottom:"1px solid #e0e7ff",display:"flex",flexWrap:"wrap",gap:"0.3rem"}}>
                        {trabsAdicionales.map(t=>{
                          const cli = CLIENTES_AD.find(c=>c.id===t.clienteId)||{color:"#a5b4fc",label:"?"};
                          return(
                            <span key={t.id} style={{background:"#fff",border:\`1.5px solid \${cli.color}\`,color:"#1e293b",borderRadius:"20px",padding:"0.18rem 0.5rem 0.18rem 0.6rem",fontSize:"0.75rem",fontWeight:"700",display:"flex",alignItems:"center",gap:"0.3rem"}}>
                              <span style={{background:cli.color,color:"#fff",borderRadius:"3px",padding:"0 4px",fontSize:"0.58rem",fontWeight:"800"}}>{cli.label}</span>
                              {t.nombre}
                              <button onClick={()=>setTrabsAdicionales(prev=>prev.filter(x=>x.id!==t.id))}
                                style={{background:"none",border:"none",cursor:"pointer",color:"#94a3b8",padding:0,display:"flex",lineHeight:1}}>
                                <X size={11}/>
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Lista expandible */}
                    {showTrabsPanel&&(
                      <div style={{background:"#fff",padding:"0.55rem 0.75rem"}}>
                        <input value={busqTrabAd} onChange={e=>setBusqTrabAd(e.target.value)}
                          placeholder="🔍 Buscar por nombre o cédula..."
                          style={{...inputSt,marginBottom:"0.5rem",padding:"0.38rem 0.75rem",fontSize:"0.8rem"}}/>
                        {CLIENTES_AD.map(cli=>{
                          const tCli = filtOtros.filter(t=>(t.clienteIds||[]).includes(cli.id));
                          if(!tCli.length) return null;
                          return(
                            <div key={cli.id} style={{marginBottom:"0.5rem"}}>
                              <div style={{fontSize:"0.67rem",fontWeight:"800",color:cli.color,textTransform:"uppercase",
                                letterSpacing:"0.05em",marginBottom:"0.3rem",padding:"0.1rem 0.4rem",
                                background:\`\${cli.color}18\`,borderRadius:"4px",display:"inline-block"}}>
                                {cli.label}
                              </div>
                              <div style={{border:\`1px solid \${cli.color}40\`,borderRadius:"8px",overflow:"hidden",maxHeight:"160px",overflowY:"auto"}}>
                                {tCli.map(t=>{
                                  const sel=trabsAdicionales.some(x=>x.id===t.id);
                                  const tConCliente={...t,clienteId:cli.id,clienteLabel:cli.label,clienteColor:cli.color};
                                  return(
                                    <div key={t.id}
                                      onClick={()=>sel?setTrabsAdicionales(p=>p.filter(x=>x.id!==t.id)):setTrabsAdicionales(p=>[...p,tConCliente])}
                                      style={{display:"flex",alignItems:"center",gap:"0.5rem",padding:"0.38rem 0.65rem",
                                        background:sel?\`\${cli.color}12\`:"#fff",
                                        borderBottom:"1px solid #f0f4ff",cursor:"pointer",transition:"background 0.1s"}}
                                      onMouseEnter={e=>{if(!sel)e.currentTarget.style.background="#f8faff";}}
                                      onMouseLeave={e=>{if(!sel)e.currentTarget.style.background="#fff";}}>
                                      <div style={{width:"14px",height:"14px",borderRadius:"3px",flexShrink:0,
                                        border:\`2px solid \${sel?cli.color:"#cbd5e1"}\`,
                                        background:sel?cli.color:"#fff",
                                        display:"flex",alignItems:"center",justifyContent:"center"}}>
                                        {sel&&<span style={{color:"#fff",fontSize:"0.55rem",fontWeight:"900"}}>✓</span>}
                                      </div>
                                      <div style={{flex:1,minWidth:0}}>
                                        <div style={{fontWeight:sel?"700":"400",fontSize:"0.8rem",
                                          color:sel?cli.color:"#1e293b",
                                          overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                                          {t.nombre}
                                        </div>
                                        {t.cedula&&<div style={{fontSize:"0.65rem",color:"#94a3b8",fontFamily:"monospace"}}>{t.cedula}</div>}
                                      </div>
                                      {t.cargo&&<span style={{fontSize:"0.6rem",color:"#94a3b8",flexShrink:0,textTransform:"uppercase"}}>{t.cargo}</span>}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}`;

// Reemplazar las líneas del bloque (start a end-1, preservar línea de Banner)
lines.splice(start, end - start, nuevoBloque);

fs.writeFileSync(path, lines.join('\n'), 'utf8');
console.log('OK - Bloque reemplazado correctamente usando todosTrabajadores');
