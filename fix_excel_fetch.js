const fs = require('fs');
let c = fs.readFileSync('pages/nomina/servicios.js','utf8');

// Reemplazar la función para leer desde Excel
const OLD_FN_START = '  const cargarTodosServicios = async () => {';
const idx = c.indexOf(OLD_FN_START);
if(idx === -1){ console.log('No encontrado'); process.exit(1); }

// Encontrar fin de función
let end = c.indexOf('\n  const cargar', idx+100);
if(end === -1) end = c.indexOf('\n  return (', idx);

const NEW_FN = `  const cargarTodosServicios = async () => {
    if (!confirm('¿Cargar servicios base desde el Excel para TERRESTRE, CIAMSA 2 y CIAMSA 3?\\nSolo se agregarán los que no existan aún.')) return;
    setCargandoBase(true);
    let totalAgregados = 0;
    try {
      // Leer Excel desde public/data/SERVICIOS_POR_CLIENTE.xlsx
      const res = await fetch('/data/SERVICIOS_POR_CLIENTE.xlsx');
      const buf = await res.arrayBuffer();
      const { read, utils } = await import('https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs');
      const wb = read(new Uint8Array(buf), {type:'array'});

      // Mapeo de hojas a clienteId
      const HOJA_CLIENTE = {
        'TERRESTRE': 'cliente1',
        'CIAMSA 2':  'cliente2',
        'CIAMSA 3':  'cliente3',
      };

      for (const [hoja, cId] of Object.entries(HOJA_CLIENTE)) {
        const ws = wb.Sheets[hoja] || wb.Sheets[wb.SheetNames.find(n=>n.toUpperCase().includes(hoja.toUpperCase()))];
        if (!ws) { console.warn('Hoja no encontrada:', hoja); continue; }
        const rows = utils.sheet_to_json(ws, {header:1});
        const existentes = new Set(servicios.filter(s=>s.clienteId===cId).map(s=>s.nombre?.toUpperCase()));
        for (let i=1;i<rows.length;i++) {
          const nombre = String(rows[i][0]||'').trim().toUpperCase();
          const valor  = parseFloat(rows[i][1])||0;
          const unidad = String(rows[i][2]||'ton').trim().toLowerCase();
          if (!nombre || valor<=0) continue;
          if (existentes.has(nombre)) continue;
          await addDoc(collection(db,'nomina_servicios'),{
            nombre, valor, unidad, clienteId:cId, tarifa:valor,
            orden:servicios.length+i, activo:true,
            creadoEn:new Date(), actualizadoEn:new Date()
          });
          totalAgregados++;
        }
      }
      await cargar();
      setBaseOk(true);
      setTimeout(()=>setBaseOk(false),3000);
      alert('✅ '+totalAgregados+' servicios nuevos cargados desde el Excel');
    } catch(e){ console.error(e); alert('Error al leer Excel: '+e.message); }
    setCargandoBase(false);
  };`;

c = c.substring(0, idx) + NEW_FN + '\n\n' + c.substring(end);
console.log('OK - cargarTodosServicios usa Excel de public/data/');

fs.writeFileSync('pages/nomina/servicios.js', c, 'utf8');
console.log('LISTO');
