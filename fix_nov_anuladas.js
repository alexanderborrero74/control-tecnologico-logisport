const fs = require('fs');
let c = fs.readFileSync('pages/nomina/matriz.js','utf8');
// Agregar reset de novedadesAnuladas al cambiar cliente
c = c.replace(
  'setBusqServicioCia(""); // reset filtro servicios al cambiar cliente\n    setNovedadesAnuladas(new Set());',
  'setBusqServicioCia(""); // reset filtro servicios al cambiar cliente\n    setNovedadesAnuladas(new Set()); // reset anulaciones manuales'
);
// Si el anterior no aplica, buscar por contexto
if(c.includes('setBusqServicioCia(""); // reset filtro servicios al cambiar cliente')){
  c = c.replace(
    'setBusqServicioCia(""); // reset filtro servicios al cambiar cliente',
    'setBusqServicioCia(""); // reset filtro servicios al cambiar cliente\n    setNovedadesAnuladas(new Set()); // reset anulaciones manuales al cambiar cliente'
  );
  console.log('OK - reset novedadesAnuladas agregado al cambiar cliente');
} else {
  console.log('SKIP - patron no encontrado');
}
// También limpiar al cambiar FECHA
c = c.replace(
  '}, [clienteActivo]);',
  '}, [clienteActivo]);\n\n  // Limpiar anulaciones manuales al cambiar de fecha\n  useEffect(() => {\n    setNovedadesAnuladas(new Set());\n  }, [form.fecha]);'
);
console.log('OK - reset novedadesAnuladas al cambiar fecha');
fs.writeFileSync('pages/nomina/matriz.js', c, 'utf8');
console.log('LISTO');
