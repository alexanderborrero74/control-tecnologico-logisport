/**
 * utils/nominaCalculos.js
 * Fórmulas de liquidación — LOGISPORT SPIA 2026
 *
 * ─────────────────────────────────────────────────────────────────────────
 * REGLA DE NEGOCIO (confirmada):
 *
 *   El trabajador tiene un SALARIO BASE MENSUAL de contrato.
 *   Cada quincena se le paga:
 *     → La parte proporcional de su salario base (basicoMensual/30 × días)
 *     → MÁS lo que produjo en el período (desde la Matriz)
 *
 *   BASE COTIZACIÓN = salarioBasicoQuincena + totalProduccion
 *                   + retroactivo + horasExtras
 *
 *   Piso SMMLV: si (salarioBasicoQuincena + produccion) < SMMLV_prop
 *               → empresa completa la diferencia
 *               (en la práctica el salario base ya cubre esto)
 *
 *   SALUD    = BASE × 4%
 *   PENSIÓN  = BASE × 4%
 *   SAL-DED  = BASE × 92%
 *   TRANSPORTE = días × (249.095 / 30)   [si básico ≤ 2×SMMLV]
 *   NETO     = SAL-DED + TRANSPORTE + IR − adelanto
 *
 * Ejemplo Héctor (básico $2.050.000, 15 días, prod $446.250):
 *   Salario quincena = $2.050.000 / 2       = $1.025.000
 *   + Producción                            =   $446.250
 *   = BASE                                  = $1.471.250
 *   − Salud 4%                              =   $58.850
 *   − Pensión 4%                            =   $58.850
 *   + Transporte                            =  $124.547
 *   = NETO A PAGAR                          = $1.478.097
 * ─────────────────────────────────────────────────────────────────────────
 */

export const SUBSIDIO_TRANSPORTE_MENSUAL  = 249095;  // Auxilio transporte 2025-2026 (SPIA / Ciamsa)
export const TRANSPORTE_TERRESTRE_MENSUAL = 200000;  // Auxilio transporte Terrestre (cliente1)
export const SMMLV                        = 1423500; // SMMLV 2025-2026
export const PORCENTAJE_SALUD             = 0.04;
export const PORCENTAJE_PENSION           = 0.04;

export const TASA_INCAPACIDAD     = 2 / 3; // 66.67% — IR
export const TASA_INCAPACIDAD_100 = 1;     // 100%   — IR-100

/**
 * Calcula todos los valores de nómina de un empleado.
 *
 * @param {Object} p
 * @param {number}  p.basicoMensual      — Salario mensual de contrato
 * @param {number}  p.totalProduccion    — Total producción desde la Matriz
 * @param {number}  p.diasTrabajados     — Días del período
 * @param {number}  p.retroactivo        — Retroactivo manual
 * @param {number}  p.adelanto           — Adelanto/descuento
 * @param {number}  p.totalHorasExtras   — Horas extras y recargos
 * @param {number}  p.diasIncapacidad    — Días IR 66.67%
 * @param {number}  p.diasIncapacidad100 — Días IR-100 100%
 */
export function calcularNominaEmpleado({
  basicoMensual      = 0,
  totalProduccion    = 0,
  diasTrabajados     = 15,
  retroactivo        = 0,
  adelanto           = 0,
  totalHorasExtras   = 0,
  diasIncapacidad    = 0,
  diasIncapacidad100 = 0,
}) {
  const dias   = parseInt(diasTrabajados)     || 0;
  const bm     = parseFloat(basicoMensual)    || 0;
  const fp     = parseFloat(totalProduccion)  || 0;
  const ret    = parseFloat(retroactivo)      || 0;
  const ade    = parseFloat(adelanto)         || 0;
  const hextra = parseFloat(totalHorasExtras) || 0;

  // ── Salario básico proporcional al período ───────────────────────────────
  // Ej: básico $2.050.000, 15 días → $1.025.000
  const salarioBasicoQuincena = (bm / 30) * dias;

  // ── Productividad (parte variable por encima del salario base) ────────────
  // = TotalProduccion − SalarioBasicoQuincena
  // Puede ser negativa (prod < base), cero (prod = base) o positiva
  const productividad = fp - salarioBasicoQuincena;

  // ── SMMLV proporcional (referencia) ──────────────────────────────────────
  const minimoProporcionl = (SMMLV / 30) * dias;

  // ── Complemento salario mínimo ───────────────────────────────────────────
  // La suma (salario + producción) siempre debe ser >= SMMLV proporcional
  // Con un básico > SMMLV esto nunca aplica, pero se deja como salvaguarda
  const totalBruto = salarioBasicoQuincena + fp;
  const complementoSalario = Math.max(0, minimoProporcionl - totalBruto);
  const produccionEfectiva  = totalBruto + complementoSalario; // = MAX(total, piso)

  // ── Incapacidades remuneradas ────────────────────────────────────────────
  const diasIR              = parseInt(diasIncapacidad)    || 0;
  const valorIncapacidad    = Math.round((bm / 30) * diasIR * TASA_INCAPACIDAD * 100) / 100;

  const diasIR100           = parseInt(diasIncapacidad100) || 0;
  const valorIncapacidad100 = Math.round((bm / 30) * diasIR100 * TASA_INCAPACIDAD_100 * 100) / 100;

  // ── FÓRMULA PRINCIPAL ────────────────────────────────────────────────────
  // BASE = salarioQuincena + producción + retroactivo + horasExtras
  // (con piso SMMLV como salvaguarda)
  const baseCotizacion = produccionEfectiva + ret + hextra;

  const salud   = baseCotizacion * PORCENTAJE_SALUD;
  const pension = baseCotizacion * PORCENTAJE_PENSION;
  const salarioMenosDeducciones = baseCotizacion - salud - pension; // BASE × 92%

  // Subsidio de transporte (si básico mensual ≤ 2 × SMMLV)
  const subsidioTransporte = bm <= SMMLV * 2
    ? (SUBSIDIO_TRANSPORTE_MENSUAL / 30) * dias
    : 0;

  // NETO = BASE×92% + TRANSPORTE + IR − adelanto
  const netoAPagar = salarioMenosDeducciones
    + subsidioTransporte
    + valorIncapacidad
    + valorIncapacidad100
    - ade;

  const r = (n) => Math.round(n * 100) / 100;

  return {
    salarioBasicoQuincena:   r(salarioBasicoQuincena),  // display: parte del básico
    productividad:           r(productividad),          // display: producción del período
    complementoSalario:      r(complementoSalario),     // complemento si cae bajo SMMLV
    produccionEfectiva:      r(produccionEfectiva),     // = salarioQ + prod (+ complemento)
    minimoProporcionl:       r(minimoProporcionl),
    baseCotizacion:          r(baseCotizacion),
    salud:                   r(salud),
    pension:                 r(pension),
    salarioMenosDeducciones: r(salarioMenosDeducciones),
    subsidioTransporte:      r(subsidioTransporte),
    diasIncapacidad:         diasIR,
    valorIncapacidad:        r(valorIncapacidad),
    diasIncapacidad100:      diasIR100,
    valorIncapacidad100:     r(valorIncapacidad100),
    netoAPagar:              r(netoAPagar),
    totalHorasExtras:        r(hextra),
  };
}

/**
 * Calcula el neto de una operación individual (fila de la MATRIZ).
 */
export function calcularNetoOperacion(valorServicio, personas, cantidad) {
  if (!personas || personas === 0) return 0;
  return (valorServicio / personas) * cantidad;
}

/**
 * Suma los netos de operaciones de un trabajador en un período.
 */
export function calcularTotalProduccion(operaciones, cedula) {
  return operaciones
    .filter(op => op.cedula === cedula || op.trabajadorCedula === cedula)
    .reduce((sum, op) => sum + (op.netoAPagar || 0), 0);
}

// ─────────────────────────────────────────────────────────────────────────
// HORAS EXTRAS Y RECARGOS — Colombia 2026 (CST art. 168-170, 179-180)
// ─────────────────────────────────────────────────────────────────────────
export const HORAS_EXTRAS_2026 = [
  { codigo:"HED",   label:"H. Extra Diurna",      factor:1.25, pct:"25%",  color:"#3b82f6", bg:"#eff6ff" },
  { codigo:"HEN",   label:"H. Extra Nocturna",    factor:1.75, pct:"75%",  color:"#8b5cf6", bg:"#f5f3ff" },
  { codigo:"HRN",   label:"Recargo Nocturno",     factor:0.35, pct:"35%",  color:"#6366f1", bg:"#eef2ff" },
  { codigo:"HRDF",  label:"Recargo Dom./Fest.",   factor:0.75, pct:"75%",  color:"#f59e0b", bg:"#fffbeb" },
  { codigo:"HRNDF", label:"Rec. Noc. Dom./Fest.", factor:1.10, pct:"110%", color:"#ef4444", bg:"#fff1f2" },
  { codigo:"HEDDF", label:"H. Extra Diurna D/F",  factor:2.00, pct:"100%", color:"#059669", bg:"#f0fdf4" },
  { codigo:"HENDF", label:"H. Extra Noc. D/F",    factor:2.50, pct:"150%", color:"#dc2626", bg:"#fef2f2" },
];

export function calcularHorasExtras(basicoMensual, horasPorTipo = {}) {
  const valorHoraOrd = (parseFloat(basicoMensual) || 0) / 240;
  let total = 0;
  const desglose = {};
  HORAS_EXTRAS_2026.forEach(t => {
    const horas = parseFloat(horasPorTipo[t.codigo] || 0);
    const valor = Math.round(horas * valorHoraOrd * t.factor * 100) / 100;
    desglose[t.codigo] = { horas, valor };
    total += valor;
  });
  return { total: Math.round(total * 100) / 100, desglose };
}

/**
 * calcularNominaCiamsa
 * Fórmula de liquidación para TERRESTRE (cliente1), CIAMSA 2 (cliente2) y CIAMSA 3 (cliente3).
 * Fuente: hoja NOMINA ORG de los libros Excel mayo 2026.
 *
 * TERRESTRE:  transporte = $200.000/mes, mismo 4%+4% que Ciamsa
 * CIAMSA 2/3: transporte = $249.095/mes
 *
 * Fórmula:
 *   SALARIO BASE     = diasTrabajados × (basicoMensual / 30)
 *   TRANSPORTE       = diasTrabajados × (transporteMensual / 30)
 *   PRODUCTIVIDAD    = totalProduccion − salarioBase
 *   SALUD            = totalProduccion × 4%
 *   PENSIÓN          = totalProduccion × 4%
 *   MENOS S&P        = totalProduccion − salud − pensión
 *   A PAGAR          = MENOS S&P + TRANSPORTE
 *   NETO A PAGAR     = A PAGAR − adelanto
 */
export function calcularNominaCiamsa({
  basicoMensual   = 0,
  totalProduccion = 0,
  diasTrabajados  = 15,
  adelanto        = 0,
  esTerrestre     = false,
}) {
  const r = (n) => Math.round(n * 100) / 100;
  const bm   = parseFloat(basicoMensual)   || 0;
  const fp   = parseFloat(totalProduccion) || 0;
  const dias = parseInt(diasTrabajados)    || 0;
  const ade  = parseFloat(adelanto)        || 0;

  const transporteMensual      = esTerrestre ? TRANSPORTE_TERRESTRE_MENSUAL : SUBSIDIO_TRANSPORTE_MENSUAL;
  const salarioBasicoQuincena  = r((bm / 30) * dias);
  const transporte             = r((transporteMensual / 30) * dias);
  const productividad          = r(fp - salarioBasicoQuincena);
  const salud                  = r(fp * PORCENTAJE_SALUD);
  const pension                = r(fp * PORCENTAJE_PENSION);
  const menosSP                = r(fp - salud - pension);
  const aPagar                 = r(menosSP + transporte);
  const netoAPagar             = r(aPagar - ade);

  return {
    salarioBasicoQuincena,
    transporte,
    productividad,
    salud,
    pension,
    menosSP,
    aPagar,
    netoAPagar,
  };
}

export function formatCOP(valor) {
  if (valor === null || valor === undefined || isNaN(valor)) return '$ 0';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(valor);
}
