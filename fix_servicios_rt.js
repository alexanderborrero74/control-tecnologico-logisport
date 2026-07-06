const fs = require('fs');
const path = 'pages/nomina/matriz.js';
let c = fs.readFileSync(path,'utf8');

// ══ 1. Agregar onSnapshot al import de Firestore ══
c = c.replace(
  'collection, getDocs, addDoc, updateDoc, deleteDoc,\ndoc, getDoc, setDoc, query, orderBy, where, Timestamp',
  'collection, getDocs, addDoc, updateDoc, deleteDoc,\ndoc, getDoc, setDoc, query, orderBy, where, Timestamp, onSnapshot'
);
console.log('1. onSnapshot agregado al import');

// ══ 2. Agregar ref para el unsubscribe del listener ══
// Insertar después de los imports de lucide-react
const afterImports = '} from "lucide-react";';
const listenerRef = '} from "lucide-react";\n\n// Ref global para el listener de servicios\nlet _unsubServicios = null;';
c = c.replace(afterImports, listenerRef);
console.log('2. Ref listener agregada');

// ══ 3. Reemplazar cargarServicios con onSnapshot ══
const oldCargarServicios =
`  const cargarServicios = async (cId) => {
    const cActivo = cId || "spia";
    const snap = await getDocs(query(collection(db,"nomina_servicios"),orderBy("nombre")));
    const all = snap.docs.map(d=>({id:d.id,...d.data()}));
    const filtered = all.filter(s=>(s.clienteId||"spia")===cActivo);
    setServicios(filtered.length>0 ? filtered : (cActivo==="spia" ? all.filter(s=>!s.clienteId) : []));
  };`;

const newCargarServicios =
`  const cargarServicios = (cId) => {
    const cActivo = cId || "spia";
    // Cancelar listener anterior si existe
    if (_unsubServicios) { _unsubServicios(); _unsubServicios = null; }
    // Listener en tiempo real — se actualiza cuando Servicios y Tarifas hace cambios
    _unsubServicios = onSnapshot(
      query(collection(db,"nomina_servicios"), orderBy("nombre")),
      (snap) => {
        const all = snap.docs.map(d=>({id:d.id,...d.data()}));
        const filtered = all.filter(s=>(s.clienteId||"spia")===cActivo);
        setServicios(filtered.length>0 ? filtered : (cActivo==="spia" ? all.filter(s=>!s.clienteId) : []));
      },
      (err) => console.error("Error listener servicios:", err)
    );
  };`;

if(c.includes(oldCargarServicios.substring(0,60))){
  c = c.replace(oldCargarServicios, newCargarServicios);
  console.log('3. cargarServicios reemplazada con onSnapshot');
} else {
  // Buscar por patrón más flexible
  const idx = c.indexOf('  const cargarServicios = async (cId) => {');
  if(idx !== -1){
    const end = c.indexOf('\n  };', idx) + 5;
    c = c.substring(0, idx) + newCargarServicios + c.substring(end);
    console.log('3. cargarServicios reemplazada (patron flexible)');
  } else {
    console.log('3. ERROR - cargarServicios no encontrada');
  }
}

// ══ 4. Resetear busqServicioCia al cambiar cliente ══
c = c.replace(
  '    setBusqSpiaCiamsa("");\n    setC2Form(CIAMSA2_FORM_INIT);',
  '    setBusqSpiaCiamsa("");\n    setBusqServicioCia(""); // reset filtro servicios al cambiar cliente\n    setC2Form(CIAMSA2_FORM_INIT);'
);
console.log('4. Reset busqServicioCia al cambiar cliente');

// ══ 5. Cleanup del listener al desmontar el componente ══
// Buscar el useEffect de carga inicial para agregar cleanup
const cleanupMarker = '  useEffect(() => { if (!loading) cargarOperaciones(); }, [periodoDesde, periodoHasta, loading]);';
const withCleanup = `  useEffect(() => { if (!loading) cargarOperaciones(); }, [periodoDesde, periodoHasta, loading]);

  // Cleanup listener de servicios al desmontar
  useEffect(() => {
    return () => { if (_unsubServicios) { _unsubServicios(); _unsubServicios = null; } };
  }, []);`;

if(c.includes(cleanupMarker)){
  c = c.replace(cleanupMarker, withCleanup);
  console.log('5. Cleanup listener agregado');
} else {
  console.log('5. SKIP - marker cleanup no encontrado');
}

fs.writeFileSync(path, c, 'utf8');
console.log('\nLISTO');
