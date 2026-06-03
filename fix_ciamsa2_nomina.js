const fs = require('fs');
const path = 'pages/nomina/liquidar.js';
let content = fs.readFileSync(path, 'utf8');

const old = /const cargarTodosTrabajadores = \(\) => \{[\s\S]*?\};\n\n  const importarExcel/;

const nuevo = `const cargarTodosTrabajadores = () => {
    if (clienteActivo === "cliente2" && personalFijoC2.length > 0) {
      const cedsFijo = new Set(personalFijoC2.map(p => String(p.cedula).trim()));
      const fijoFilas = personalFijoC2.map(p => ({
        _key: ++_rowCounter, nombre: p.nombre, cedula: String(p.cedula),
        cargo: p.cargo || "", basicoMensual: p.salarioMensual || 0,
        dias: diasDef, retroactivo: 0, horasExtras: HORAS_VACIAS(),
        firma: "", observacion: "", esFijo: true,
      }));
      const varFilas = listaTrabaj
        .filter(t => !cedsFijo.has(String(t.cedula || "").trim()))
        .map(t => {
          const c = listaCargos.find(c => c.nombre === t.cargo);
          return {
            _key: ++_rowCounter, nombre: t.nombre || "", cedula: String(t.cedula || ""),
            cargo: t.cargo || "", basicoMensual: c?.basicoMensual || t.basicoMensual || 0,
            dias: diasDef, retroactivo: 0, horasExtras: HORAS_VACIAS(),
            firma: "", observacion: "", esFijo: false,
          };
        });
      setFilas(deduplicar([...fijoFilas, ...varFilas]));
      return;
    }
    const cedulasExistentes = new Set(filas.map(f => String(f.cedula || "").trim()).filter(Boolean));
    const trabajadoresNuevos = listaTrabaj.filter(t => !cedulasExistentes.has(String(t.cedula || "").trim()));
    if (filas.length === 0) {
    } else if (trabajadoresNuevos.length === 0) {
      alert("Todos los trabajadores ya están en la tabla."); return;
    } else if (!confirm(\`¿Agregar \${trabajadoresNuevos.length} trabajadores faltantes? (\${cedulasExistentes.size} ya están)\`)) {
      return;
    }
    const fuente = filas.length === 0 ? listaTrabaj : trabajadoresNuevos;
    setFilas(prev => deduplicar([...prev, ...fuente.map(t => {
      const c = listaCargos.find(c => c.nombre === t.cargo);
      return {
        _key: ++_rowCounter, nombre: t.nombre || "", cedula: String(t.cedula || ""),
        cargo: t.cargo || "", basicoMensual: c?.basicoMensual || t.basicoMensual || 0,
        dias: diasDef, retroactivo: 0, horasExtras: HORAS_VACIAS(), firma: "", observacion: "",
      };
    })]));
  };

  const importarExcel`;

if (old.test(content)) {
  content = content.replace(old, nuevo);
  fs.writeFileSync(path, content, 'utf8');
  console.log('OK - cargarTodosTrabajadores actualizado para CIAMSA 2');
} else {
  console.log('NO ENCONTRADO - verificar manualmente');
}
