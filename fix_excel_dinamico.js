const fs = require('fs');
let c = fs.readFileSync('pages/nomina/servicios.js','utf8');

// Mapeo nombre de cliente en Excel → clienteId en Firestore
// Dinámico: lee TODAS las columnas pares del Excel automáticamente

const idx = c.indexOf('  const cargarTodosServicios = async () => {');
if(idx === -1){ console.log('NO ENCONTRADO'); process.exit(1); }
let end = c.indexOf('\n  const cargar', idx+100);
if(end === -1) end = c.indexOf('\n  return (', idx);

const NEW_FN = `  const cargarTodosServicios = async () => {
    if (!confirm('¿Cargar servicios base desde SERVICIOS_POR_CLIENTE.xlsx?\\nSolo se agregarán los que no existan aún.')) return;
    setCargandoBase(true);
    let totalAgregados = 0;
    try {
      // Leer Excel desde public/data/SERVICIOS_POR_CLIENTE.xlsx
      const res = await fetch('/data/SERVICIOS_POR_CLIENTE.xlsx');
      if (!res.ok) throw new Error('No se encontró el archivo. Copia SERVICIOS_POR_CLIENTE.xlsx a public/data/');
      const buf = await res.arrayBuffer();

      // Usar XLSX ya importado en la página
      const wb = XLSX.read(new Uint8Array(buf), {type:'array'});
      const ws = wb.Sheets['Hoja1'] || wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});

      // Fila 0 = nombres de cliente (TERRESTRE, CIAMSA3, CIAMSA2, ...)
      // Fila 1 = encabezados (SERVICIOS, VALOR SERVICIO, ...) — se omite
      // Fila 2+ = datos
      const headerRow = rows[0] || [];

      // Mapeo automático: nombre en Excel → clienteId Firestore
      const MAPA_CLIENTE = {
        'TERRESTRE': 'cliente1',
        'CIAMSA 2':  'cliente2',
        'CIAMSA2':   'cliente2',
        'CIAMSA 3':  'cliente3',
        'CIAMSA3':   'cliente3',
        'SPIA':      'spia',
      };

      // Detectar TODAS las columnas pares automáticamente
      // Cada par de columnas (col i, col i+1) corresponde a un cliente
      const columnas = [];
      for (let col=0; col<headerRow.length; col+=2) {
        const nombreCliente = String(headerRow[col]||'').trim().toUpperCase();
        if (!nombreCliente) continue;
        const cId = MAPA_CLIENTE[nombreCliente];
        if (!cId) {
          console.warn('Cliente no mapeado:', nombreCliente, '— agrega al MAPA_CLIENTE');
          continue;
        }
        columnas.push({ cId, colNombre: col, colValor: col+1, label: nombreCliente });
      }

      if (columnas.length === 0) throw new Error('No se encontraron clientes en la fila 1 del Excel');

      // Cargar servicios por cada cliente detectado
      for (const { cId, colNombre, colValor, label } of columnas) {
        const existentes = new Set(
          servicios.filter(s=>s.clienteId===cId).map(s=>s.nombre?.toUpperCase().trim())
        );
        let agregadosEste = 0;
        // Datos desde fila 2 (índice 2) en adelante — fila 1 son encabezados
        for (let i=2; i<rows.length; i++) {
          const row = rows[i];
          const nombre = String(row[colNombre]||'').trim().toUpperCase();
          const valor  = parseFloat(String(row[colValor]||'').replace(/[^0-9.]/g,''));
          if (!nombre || isNaN(valor) || valor<=0) continue;
          if (existentes.has(nombre)) continue;
          // Leer columnas adicionales dinámicamente (columna 3 en adelante del par)
          // Por ahora unidad viene del header row si existe col+2
          const unidad = 'ton'; // default
          await addDoc(collection(db,'nomina_servicios'),{
            nombre, valor, unidad, clienteId:cId, tarifa:valor,
            orden: servicios.length+i, activo:true,
            creadoEn:new Date(), actualizadoEn:new Date()
          });
          existentes.add(nombre);
          agregadosEste++;
          totalAgregados++;
        }
        console.log(label, ':', agregadosEste, 'servicios agregados');
      }

      await cargar();
      setBaseOk(true);
      setTimeout(()=>setBaseOk(false),4000);
      alert('✅ '+totalAgregados+' servicios nuevos cargados desde el Excel\\n'+
        columnas.map(({label})=>label).join(', '));
    } catch(e){
      console.error(e);
      alert('Error: '+e.message);
    }
    setCargandoBase(false);
  };`;

c = c.substring(0, idx) + NEW_FN + '\n\n' + c.substring(end);
fs.writeFileSync('pages/nomina/servicios.js', c, 'utf8');
console.log('OK - cargarTodosServicios actualizada para leer Excel dinamicamente');
