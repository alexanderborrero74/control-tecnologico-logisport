const fs = require('fs');
let c = fs.readFileSync('pages/nomina/servicios.js','utf8');

// Agregar función cargarTodosServicios después de cargarServiciosBase
const fnNueva = `
  const cargarTodosServicios = async () => {
    if (!confirm('¿Cargar servicios base para TERRESTRE, CIAMSA 2 y CIAMSA 3 de una vez?\\nSolo se agregarán los que no existan.')) return;
    setCargandoBase(true);
    let totalAgregados = 0;
    try {
      for (const cId of ['cliente1','cliente2','cliente3']) {
        const base = SERVICIOS_BASE[cId];
        if (!base) continue;
        const existentes = new Set(servicios.filter(s=>s.clienteId===cId).map(s=>s.nombre?.toUpperCase()));
        for (let i=0;i<base.length;i++) {
          const s = base[i];
          if (existentes.has(s.nombre.toUpperCase())) continue;
          await addDoc(collection(db,'nomina_servicios'),{
            ...s, clienteId:cId, tarifa:s.valor,
            orden:servicios.length+i+1, activo:true,
            creadoEn:new Date(), actualizadoEn:new Date()
          });
          totalAgregados++;
        }
      }
      await cargar();
      setBaseOk(true);
      setTimeout(()=>setBaseOk(false),3000);
      alert('✅ '+totalAgregados+' servicios nuevos agregados en los 3 clientes');
    } catch(e){ alert('Error: '+e.message); }
    setCargandoBase(false);
  };

`;

// Insertar antes del return
const retIdx = c.indexOf('  return (\n    <LayoutWithSidebar>');
if(retIdx !== -1){
  c = c.substring(0, retIdx) + fnNueva + c.substring(retIdx);
  console.log('OK - cargarTodosServicios agregada');
} else {
  console.log('SKIP - return no encontrado');
}

// Reemplazar el botón individual por "Cargar Todos"
c = c.replace(
  `{["cliente1","cliente2","cliente3"].includes(clienteActivo) && (
              <button onClick={cargarServiciosBase} disabled={cargandoBase} style={{
                background: baseOk ? "#f0fdf4" : "#eff6ff",
                border: \`1.5px solid \${baseOk ? "#10b981" : "#3b82f6"}\`,
                borderRadius: "10px", padding: "0.75rem 1.1rem",
                color: baseOk ? "#065f46" : "#1d4ed8", cursor: cargandoBase ? "wait" : "pointer",
                fontWeight: "700", display: "flex", alignItems: "center", gap: "0.5rem", fontSize:"0.88rem",
              }}>
                {cargandoBase ? <><RefreshCw size={15} style={{animation:"spin 1s linear infinite"}}/> Cargando...</>
                  : baseOk ? <><CheckCircle size={15}/> ¡Listo!</>
                  : <>⚡ Cargar Base</>}
              </button>
            )}`,
  `<button onClick={cargarTodosServicios} disabled={cargandoBase} style={{
              background: baseOk ? "#f0fdf4" : "#eff6ff",
              border: \`1.5px solid \${baseOk ? "#10b981" : "#3b82f6"}\`,
              borderRadius: "10px", padding: "0.75rem 1.1rem",
              color: baseOk ? "#065f46" : "#1d4ed8", cursor: cargandoBase ? "wait" : "pointer",
              fontWeight: "700", display: "flex", alignItems: "center", gap: "0.5rem", fontSize:"0.88rem",
            }}>
              {cargandoBase
                ? <><RefreshCw size={15} style={{animation:"spin 1s linear infinite"}}/> Cargando 3 clientes...</>
                : baseOk ? <><CheckCircle size={15}/> ¡Listo!</>
                : <>⚡ Cargar Base (3 clientes)</>}
            </button>`
);
console.log('OK - botón actualizado a Cargar Base (3 clientes)');

fs.writeFileSync('pages/nomina/servicios.js', c, 'utf8');
console.log('LISTO');
