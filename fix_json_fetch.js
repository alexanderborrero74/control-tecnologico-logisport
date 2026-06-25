const fs = require('fs');
let c = fs.readFileSync('pages/nomina/servicios.js','utf8');

// Reemplazar cargarTodosServicios para que use fetch del JSON
const OLD = `  const cargarTodosServicios = async () => {
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
  };`;

// Contar ocurrencias
const count = (c.match(/const cargarTodosServicios/g)||[]).length;
console.log('cargarTodosServicios aparece', count, 'veces');

// Nueva versión que lee del JSON
const NEW = `  const cargarTodosServicios = async () => {
    if (!confirm('¿Cargar servicios base para TERRESTRE, CIAMSA 2 y CIAMSA 3?\\nSolo se agregarán los que no existan.')) return;
    setCargandoBase(true);
    let totalAgregados = 0;
    try {
      // Leer servicios desde public/data/servicios_base.json
      const res = await fetch('/data/servicios_base.json');
      const SERVICIOS_BASE_JSON = await res.json();
      // cliente3 = mismos servicios que cliente2
      if (!SERVICIOS_BASE_JSON.cliente3) SERVICIOS_BASE_JSON.cliente3 = SERVICIOS_BASE_JSON.cliente2;
      for (const cId of ['cliente1','cliente2','cliente3']) {
        const base = SERVICIOS_BASE_JSON[cId];
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
  };`;

// Eliminar todas las ocurrencias y dejar solo una (la nueva)
// Eliminar la primera ocurrencia y reemplazar con nueva
let idx = c.indexOf(OLD.substring(0,50));
if(idx !== -1){
  // Encontrar el fin de la función
  // Buscar el patrón de cierre
  const start = c.indexOf('  const cargarTodosServicios', idx);
  let end = c.indexOf('\n  const ', start+50);
  if(end === -1) end = c.indexOf('\n  return (', start);
  if(end !== -1){
    c = c.substring(0,start) + NEW + '\n\n' + c.substring(end);
    console.log('OK - cargarTodosServicios actualizada a fetch JSON');
  } else {
    console.log('SKIP - no se encontro el fin');
  }
} else {
  // Buscar por patron generico
  const start = c.indexOf('  const cargarTodosServicios = async');
  if(start !== -1){
    let end = c.indexOf('\n  const cargar', start+100);
    if(end === -1) end = c.indexOf('\n  return (', start);
    if(end !== -1){
      c = c.substring(0,start) + NEW + '\n\n' + c.substring(end);
      console.log('OK - reemplazado por patron generico');
    }
  }
}

// Eliminar SERVICIOS_BASE del código si existe (ya no lo necesitamos)
const sbStart = c.indexOf('  const SERVICIOS_BASE = {');
if(sbStart !== -1){
  // Encontrar fin del objeto
  let braces = 0;
  let i = sbStart + '  const SERVICIOS_BASE = '.length;
  while(i < c.length){
    if(c[i]==='{') braces++;
    else if(c[i]==='}') { braces--; if(braces===0){ i++; break; } }
    i++;
  }
  // Buscar el final incluyendo SERVICIOS_BASE.cliente3
  let endSB = c.indexOf('\n  const cargar', i);
  if(endSB === -1) endSB = c.indexOf('\n  return (', i);
  if(endSB !== -1){
    c = c.substring(0, sbStart) + c.substring(endSB);
    console.log('OK - SERVICIOS_BASE objeto eliminado del codigo');
  }
}

// Contar al final
const countAfter = (c.match(/const cargarTodosServicios/g)||[]).length;
console.log('Resultado final:', countAfter, 'instancias de cargarTodosServicios');

fs.writeFileSync('pages/nomina/servicios.js', c, 'utf8');
console.log('LISTO');
