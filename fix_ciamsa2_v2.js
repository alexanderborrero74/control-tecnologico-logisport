const fs = require('fs');
const path = 'pages/nomina/liquidar.js';
let content = fs.readFileSync(path, 'utf8');
let changed = 0;

// FIX 1: Cálculo correcto para personal fijo CIAMSA 2
const oldCalc = `    if (isCiamsaCliente) {
      // Fórmula Terrestre / Ciamsa 2 / Ciamsa 3
      const raw = calcularNominaCiamsa({
        basicoMensual:   f.basicoMensual || 0,
        totalProduccion,
        diasTrabajados:  parseInt(f.dias) || 0,
        adelanto:        parseFloat(f.retroactivo) || 0, // campo retroactivo se usa como descuento manual
        esTerrestre:     clienteActivo === "cliente1",
      });`;

const newCalc = `    if (isCiamsaCliente) {
      // Fórmula Terrestre / Ciamsa 2 / Ciamsa 3
      // Para personal fijo C2: totalProduccion = salario proporcional + horas extras (NO viene de la Matriz)
      let totalProdParaCalc = totalProduccion;
      if (f.esFijo && clienteActivo === "cliente2") {
        const { total: hextraFijo } = calcularHorasExtras(f.basicoMensual || 0, f.horasExtras || {});
        const salBaseFijo = (f.basicoMensual || 0) / 30 * (parseInt(f.dias) || 0);
        totalProdParaCalc = salBaseFijo + hextraFijo;
      }
      const raw = calcularNominaCiamsa({
        basicoMensual:   f.basicoMensual || 0,
        totalProduccion: totalProdParaCalc,
        diasTrabajados:  parseInt(f.dias) || 0,
        adelanto:        parseFloat(f.retroactivo) || 0,
        esTerrestre:     clienteActivo === "cliente1",
      });`;

if (content.includes(oldCalc)) {
  content = content.replace(oldCalc, newCalc);
  changed++; console.log('OK - Fix 1: cálculo fijo C2');
} else { console.log('NO encontrado Fix 1'); }

// FIX 2: Agregar campo esFijo al resultado de filasCalculadas
const oldReturn = `    return { ...f, idx: i + 1, totalProduccion, detalleOps: prodData.ops, totalExtras, desgloseExtras, ...calc, motivoResumen, motivosCodes, novedadesFormales, primeraFechaNovedad, adelantosDeducidos, comidaDeducida, netoFinal };`;
const newReturn = `    return { ...f, idx: i + 1, totalProduccion: totalProdParaCalc || totalProduccion, detalleOps: prodData.ops, totalExtras, desgloseExtras, ...calc, motivoResumen, motivosCodes, novedadesFormales, primeraFechaNovedad, adelantosDeducidos, comidaDeducida, netoFinal };`;

if (content.includes(oldReturn)) {
  content = content.replace(oldReturn, newReturn);
  changed++; console.log('OK - Fix 2: totalProduccion en return');
} else { console.log('NO encontrado Fix 2 (no crítico)'); }

// FIX 3: Separador visual FIJO/VARIABLE en la tabla — insertar justo antes de cada fila de FilaNomina
// Añadir lógica de separador en el tbody
const oldTbody = `                  {filasFiltradas.map(e => (
                    <FilaNomina
                      key={e._key} fila={e} listaCargos={listaCargos}
                      onCambio={actualizarFila} onBlurCedula={buscarPorCedula}
                      onHoraExtra={actualizarHoraExtra}
                      onEliminar={() => eliminarFila(e._key)}
                    />
                  ))}`;

const newTbody = `                  {clienteActivo === "cliente2" && filasFiltradas.some(f => f.esFijo) && (
                    <tr style={{background:"#ede9fe",borderTop:"2px solid #8b5cf6",borderBottom:"2px solid #8b5cf6"}}>
                      <td colSpan={35} style={{padding:"0.45rem 1rem",fontWeight:"800",fontSize:"0.82rem",color:"#6d28d9"}}>
                        👔 BLOQUE 1 — PERSONAL FIJO CIAMSA 2 &nbsp;·&nbsp; Salario mensual fijo (no está en la Matriz)
                      </td>
                    </tr>
                  )}
                  {filasFiltradas.map((e, idx) => {
                    const esInicioVariable = clienteActivo === "cliente2"
                      && !e.esFijo
                      && (idx === 0 || filasFiltradas[idx-1].esFijo);
                    return (
                      <>
                        {esInicioVariable && (
                          <tr key={"sep-var"} style={{background:"#dcfce7",borderTop:"2px solid #10b981",borderBottom:"2px solid #10b981"}}>
                            <td colSpan={35} style={{padding:"0.45rem 1rem",fontWeight:"800",fontSize:"0.82rem",color:"#065f46"}}>
                              ⚙️ BLOQUE 2 — PERSONAL POR SERVICIOS &nbsp;·&nbsp; Producción variable desde la Matriz
                            </td>
                          </tr>
                        )}
                        <FilaNomina
                          key={e._key} fila={e} listaCargos={listaCargos}
                          onCambio={actualizarFila} onBlurCedula={buscarPorCedula}
                          onHoraExtra={actualizarHoraExtra}
                          onEliminar={() => eliminarFila(e._key)}
                        />
                      </>
                    );
                  })}`;

if (content.includes(oldTbody)) {
  content = content.replace(oldTbody, newTbody);
  changed++; console.log('OK - Fix 3: separadores visuales en tabla');
} else { console.log('NO encontrado Fix 3'); }

fs.writeFileSync(path, content, 'utf8');
console.log(`\nTotal cambios: ${changed}/3`);
