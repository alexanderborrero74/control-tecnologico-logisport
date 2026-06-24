const fs = require('fs');
const path = 'pages/nomina/matriz.js';
let c = fs.readFileSync(path,'utf8');

// ══ 1. FIX MULTI-SERVICIO SPIA ══
// El botón ya existe pero con condición form.cuadrillaNombre
// Lo hacemos visible siempre dentro del bloque de servicio
c = c.replace(
  '{/* Botón agregar servicio adicional — siempre activo */}\n              {form.cuadrillaNombre && (',
  '{/* Botón agregar servicio adicional — siempre activo */}\n              {('
);
console.log('1. Multi-servicio SPIA - condición simplificada');

// ══ 2. EDICIÓN DE REGISTROS SPIA ══
// Agregar función iniciarEdicion para SPIA
const SPIA_EDIT_FN = `
  // ── Iniciar edición SPIA ──
  const spiaIniciarEdicion = (op) => {
    setEditandoId(op.id);
    const servId = op.servicioId || "";
    const serv = servicios.find(s=>s.id===servId)||{};
    setForm(prev=>({
      ...prev,
      cuadrillaId:      op.cuadrillaId||"",
      cuadrillaNombre:  op.cuadrillaNombre||op.cuadrilla||"",
      cuadrillaPersonas:op.personas||1,
      personas:         op.personas||1,
      tipoSeleccion:    op.modoHorasExtras?"trabajador":"cuadrilla",
      fecha:            op.fechaStr||"",
      servicioId:       servId,
      servicioNombre:   op.servicioNombre||"",
      servicioValor:    serv.valor||serv.tarifa||op.tarifaUnitaria||0,
      cantidad:         op.cantidad||1,
      horasExtras:      op.horasExtras||"",
      netoCalculado:    op.netoAPagar||0,
    }));
    // Scrollear al formulario
    setTimeout(()=>{ try{ document.querySelector('.nueva-operacion-form')?.scrollIntoView({behavior:'smooth',block:'start'}); }catch(e){} }, 100);
  };

  const spiaCancelarEdicion = () => {
    setEditandoId(null);
    setForm(prev=>({...prev, cuadrillaId:"", cuadrillaNombre:"", servicioId:"", servicioNombre:"", cantidad:"", netoCalculado:0}));
  };

`;

// Insertar antes de la función guardar de SPIA (const guardar = async)
// Buscar el guardar de SPIA que tiene: if (!form.cuadrillaNombre || !form.servicioNombre)
const guardarSPIA = '  const guardar = async () => {\n    if (!form.cuadrillaNombre || !form.servicioNombre)';
if (c.includes(guardarSPIA)) {
  c = c.replace(guardarSPIA, SPIA_EDIT_FN + guardarSPIA);
  console.log('2. spiaIniciarEdicion función agregada');
} else {
  console.log('2. SKIP - guardar SPIA no encontrado');
}

fs.writeFileSync(path, c, 'utf8');
console.log('FASE 1 OK');
