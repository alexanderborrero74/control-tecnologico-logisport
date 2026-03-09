// pages/nomina/liquidar.js
// Módulo de Liquidación de Nómina — LOGISPORT
//
// FLUJO DE PRODUCCIÓN (cómo llega el dato desde la Matriz):
//   Matriz guarda en nomina_operaciones:
//     netoAPagar  = (valorServicio × cantidad) ÷ personas  ← ya es POR PERSONA
//     trabajadoresAsisten: [{id, nombre, cedula}, ...]
//
//   Liquidar suma: para cada operación, por cada asistente → prod[cedula] += op.netoAPagar
//   ✅ NUNCA volver a dividir entre asisten.length (ya está dividido en la Matriz)
//
// REGLA COMPLEMENTO SALARIO MÍNIMO:
//   Si totalProduccion < (SMMLV/30) × diasTrabajados
//   → empresa complementa la diferencia (visible en columna COMPLEMENTO, color naranja)
//   → la base de cotización usa el mínimo, no la producción bruta

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  collection, getDocs, setDoc, getDoc,
  doc, query, orderBy, where, Timestamp
} from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";
import { getUserRoleByUid } from "@/utils/getUserRole";
import LayoutWithSidebar from "@/components/LayoutWithSidebar";
import {
  calcularNominaEmpleado, formatCOP,
  SUBSIDIO_TRANSPORTE_MENSUAL, SMMLV,
  HORAS_EXTRAS_2026, calcularHorasExtras,
} from "@/utils/nominaCalculos";
import {
  ArrowLeft, Save, Download, RefreshCw, Calendar,
  Printer, Plus, Trash2, UserPlus, Search,
  Upload, FileSpreadsheet, Filter, AlertTriangle, Info
} from "lucide-react";

// ── Catálogo de novedades (igual que asistencia.js) ─────────────────────────
const NOV_MAP = {
  "D":      { emoji:"😴", label:"Descanso" },
  "I":      { emoji:"❌", label:"Inasistencia" },
  "INC":    { emoji:"🏥", label:"Incapacidad" },
  "INC-EG": { emoji:"🤕", label:"Inc. Enf. General" },
  "INC-AT": { emoji:"🛡️", label:"Inc. Acc. Trabajo" },
  "INC-EL": { emoji:"🪢", label:"Inc. Enf. Laboral" },
  "INC-MAT":{ emoji:"🤱", label:"Lic. Maternidad" },
  "INC-PAT":{ emoji:"👶", label:"Lic. Paternidad" },
  "IR":     { emoji:"💊", label:"Inc. Remunerada 66.67%" },
  "IR-100": { emoji:"🏥", label:"Inc. Remunerada 100%" },
  "S":      { emoji:"🚫", label:"Suspensión" },
  "B":      { emoji:"⛔", label:"Bloqueado muelle" },
  "PNR":    { emoji:"📋", label:"Permiso no remunerado" },
  "CAL":    { emoji:"🏠", label:"Calamidad doméstica" },
  "ADV":    { emoji:"⛪", label:"Adventista" },
  "L":      { emoji:"🖤", label:"Luto" },
  "VAC":    { emoji:"🏖️", label:"Vacaciones" },
  "PR":     { emoji:"📝", label:"Permiso Remunerado" },
};

const PRIMARY = "#0B3D91";
const ACCENT  = "#00AEEF";
const SUCCESS = "#10b981";
const WARN    = "#f59e0b";
const DANGER  = "#ef4444";

// ── Clientes del sistema ─────────────────────────────────────────────────────
const CLIENTES_BASE = [
  { id:"spia",     nombre:"SPIA",     color:"#0B3D91", emoji:"🏭" },
  { id:"cliente1", nombre:"Cliente 1",color:"#10b981", emoji:"🏢" },
  { id:"cliente2", nombre:"Cliente 2",color:"#8b5cf6", emoji:"🏗️" },
  { id:"cliente3", nombre:"Cliente 3",color:"#f59e0b", emoji:"🏭" },
];

// ── Helpers de fecha ──────────────────────────────────────────────────────────
function fechaHoy() { return new Date().toISOString().split("T")[0]; }
function quincenaActual() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const dia = now.getDate();
  const diasMes = new Date(y, now.getMonth() + 1, 0).getDate();
  if (dia <= 15) return { fechaInicio: `${y}-${m}-01`, fechaFin: `${y}-${m}-15` };
  return { fechaInicio: `${y}-${m}-16`, fechaFin: `${y}-${m}-${String(diasMes).padStart(2, "0")}` };
}
function periodoId(fi, ff)  { return `${fi}_${ff}`; }
function diasEntreFechas(fi, ff) {
  if (!fi || !ff) return 15;
  return Math.max(1, Math.round((new Date(ff + "T00:00:00") - new Date(fi + "T00:00:00")) / 86400000) + 1);
}
function labelPeriodo(fi, ff) {
  if (!fi || !ff) return "Sin período";
  const fmt = s => {
    const [y, mo, d] = s.split("-");
    const mes = ["","Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][+mo];
    return `${+d} ${mes} ${y}`;
  };
  return `${fmt(fi)} — ${fmt(ff)}`;
}

function getMonthsInPeriod(fi, ff) {
  const months = [];
  let curr = new Date(fi + "T00:00:00");
  const end = new Date(ff + "T00:00:00");
  while (curr <= end) {
    months.push({ year: curr.getFullYear(), month: curr.getMonth() + 1 });
    curr = new Date(curr.getFullYear(), curr.getMonth() + 1, 1);
  }
  return months;
}

let _rowCounter = 0;
const HORAS_VACIAS = () => Object.fromEntries(HORAS_EXTRAS_2026.map(t => [t.codigo, 0]));

// Elimina filas con cédula duplicada — conserva la primera ocurrencia
function deduplicar(arr) {
  const vistas = new Set();
  return arr.filter(f => {
    const cc = String(f.cedula || "").trim();
    if (!cc) return true;
    if (vistas.has(cc)) return false;
    vistas.add(cc);
    return true;
  });
}

function filaVacia(diasDefault = 15) {
  return {
    _key: ++_rowCounter, nombre: "", cedula: "", cargo: "",
    basicoMensual: 0, dias: diasDefault, retroactivo: 0,
    horasExtras: HORAS_VACIAS(),
    firma: "", observacion: "",
  };
}

// ════════════════════════════════════════════════════════════════════════════
export default function NominaLiquidar() {
  const router       = useRouter();
  const fileInputRef = useRef(null);
  const def          = quincenaActual();

  const [rol,            setRol]            = useState(null);
  const [fechaInicio,    setFechaInicio]    = useState(def.fechaInicio);
  const [fechaFin,       setFechaFin]       = useState(def.fechaFin);
  const [filas,          setFilas]          = useState([]);
  const [produccion,     setProduccion]     = useState({});  // { cedula: { total, ops:[{fecha,servicio,valor,modoHE,horasExtras}] } }
  const [listaCargos,    setListaCargos]    = useState([]);
  const [listaTrabaj,    setListaTrabaj]    = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [recalculando,   setRecalculando]   = useState(false);
  const [guardando,      setGuardando]      = useState(false);
  const [nominaGuardada, setNominaGuardada] = useState(null);
  const [importando,     setImportando]     = useState(false);
  const [filtroNombre,   setFiltroNombre]   = useState("");
  const [filtroCedula,   setFiltroCedula]   = useState("");
  const [filtroSubgrupo, setFiltroSubgrupo] = useState(""); // codigo del subgrupo
  const [subgruposCliente, setSubgruposCliente] = useState([]); // subgrupos del cliente activo
  const [infoMatriz,     setInfoMatriz]     = useState({ ops: 0, trabajadores: 0 });
  const [motivosMap,     setMotivosMap]     = useState({});
  const [diasIRMap,      setDiasIRMap]      = useState({});  // días IR por cédula
  const [adelantosMap,   setAdelantosMap]   = useState({});  // { cedula: total adelantos pendientes }
  const [comidaMap,      setComidaMap]      = useState({});  // { cedula: total comida pendiente }
  const [clienteActivo,  setClienteActivo]  = useState("spia");
  const [clientes,       setClientes]       = useState(CLIENTES_BASE);

  // qId incluye cliente para separar períodos — SPIA conserva formato original
  const qId     = clienteActivo === "spia"
    ? periodoId(fechaInicio, fechaFin)
    : `${clienteActivo}_${periodoId(fechaInicio, fechaFin)}`;
  const qLabel  = labelPeriodo(fechaInicio, fechaFin);
  const diasDef = diasEntreFechas(fechaInicio, fechaFin);

  // Cargar nombres reales de clientes desde Firestore
  useEffect(() => {
    getDocs(collection(db, "nomina_clientes")).then(snap => {
      if (snap.empty) return;
      setClientes(CLIENTES_BASE.map(b => {
        const d = snap.docs.find(x => x.id === b.id);
        return d ? { ...b, nombre: d.data().nombre || b.nombre } : b;
      }));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async user => {
      if (!user) { router.push("/login"); return; }
      const r = await getUserRoleByUid(user.uid);
      setRol(r);
      if (!["admin", "admin_nomina", "nomina"].includes(r)) { router.push("/nomina"); return; }
      await cargarCatalogos("spia");
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Recargar cuando cambia el cliente activo
  useEffect(() => {
    if (!loading) {
      setFilas([]);
      setProduccion({});
      setNominaGuardada(null);
      cargarCatalogos(clienteActivo);
    }
  }, [clienteActivo]);

  useEffect(() => {
    if (!loading && fechaInicio && fechaFin && fechaFin >= fechaInicio) cargarPeriodo();
  }, [qId, loading]);

  const cargarCatalogos = async (cliente) => {
    const cli = cliente || clienteActivo;
    const [cSnap, tSnap, sgSnap] = await Promise.all([
      getDocs(query(collection(db, "nomina_cargos"),       orderBy("nombre"))),
      getDocs(query(collection(db, "nomina_trabajadores"), orderBy("nombre"))),
      getDocs(query(collection(db, "nomina_subgrupos"),    orderBy("orden"))),
    ]);
    setListaCargos(cSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    // Filtrar trabajadores por clienteIds — sin clienteIds significa SPIA (compatibilidad)
    const todos = tSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Excluir trabajadores inactivos de la nómina
    setListaTrabaj(todos.filter(t => t.activo !== false && (t.clienteIds || ["spia"]).includes(cli)));
    // Subgrupos contables del cliente activo
    setSubgruposCliente(sgSnap.docs.map(d => ({ id:d.id, ...d.data() })).filter(s => s.clienteId === cli));
    setFiltroSubgrupo(""); // reset al cambiar cliente
  };

  const cargarPeriodo = async () => {
    setRecalculando(true);
    try {
      const ini = Timestamp.fromDate(new Date(fechaInicio + "T00:00:00"));
      const fin = Timestamp.fromDate(new Date(fechaFin    + "T23:59:59"));
      const opsSnap = await getDocs(query(
        collection(db, "nomina_operaciones"),
        where("fecha", ">=", ini),
        where("fecha", "<=", fin),
        orderBy("fecha"),
      ));

      const prod = {};  // { cedula: { total: number, ops: [...] } }
      let opsCount = 0;
      const trabajadoresSet = new Set();

      // Filtrar por clienteId en JS (ops sin clienteId = SPIA, compatibilidad)
      const opsFiltradas = opsSnap.docs.filter(d => {
        const cid = d.data().clienteId;
        return clienteActivo === "spia" ? (!cid || cid === "spia") : cid === clienteActivo;
      });

      opsFiltradas.forEach(d => {
        const op = d.data();
        opsCount++;
        const asisten = op.trabajadoresAsisten || [];
        // Datos del concepto para el tooltip
        const fechaStr  = op.fecha?.toDate ? op.fecha.toDate().toISOString().split("T")[0] : "";
        const servNom   = op.servicioNombre || op.servicio || "";
        const modoHE    = op.modoHorasExtras || false;
        const hExtras   = op.horasExtras ?? null;
        const cantOp    = op.cantidad ?? null;

        if (asisten.length > 0) {
          const netoPorPersona = op.netoAPagar || 0;
          asisten.forEach(w => {
            const cc = String(w.cedula || w.id || "").trim();
            if (!cc) return;
            if (!prod[cc]) prod[cc] = { total: 0, ops: [] };
            prod[cc].total += netoPorPersona;
            prod[cc].ops.push({ fecha: fechaStr, servicio: servNom, valor: netoPorPersona, modoHE, horasExtras: hExtras, cantidad: cantOp });
            trabajadoresSet.add(cc);
          });
        } else {
          const cc = String(op.trabajadorCedula || op.cedula || "").trim();
          if (!cc) return;
          if (!prod[cc]) prod[cc] = { total: 0, ops: [] };
          const v = op.netoAPagar || 0;
          prod[cc].total += v;
          prod[cc].ops.push({ fecha: fechaStr, servicio: servNom, valor: v, modoHE, horasExtras: hExtras, cantidad: cantOp });
          trabajadoresSet.add(cc);
        }
      });

      setProduccion(prod);
      setInfoMatriz({ ops: opsCount, trabajadores: trabajadoresSet.size });

      // Motivos desde asistencia_registro
      try {
        const cuadSnap = await getDocs(collection(db, "nomina_asistencia"));
        const cuadIds  = cuadSnap.docs.map(d => d.id);
        const months   = getMonthsInPeriod(fechaInicio, fechaFin);
        const workerMap = {};
        listaTrabaj.forEach(t => { workerMap[t.id] = String(t.cedula || "").trim(); });
        const motivosAcc = {};
        for (const cId of cuadIds) {
          for (const { year, month } of months) {
            const regId = `${cId}_${year}_${String(month).padStart(2, "0")}`;
            try {
              const regSnap = await getDoc(doc(db, "nomina_asistencia_registro", regId));
              if (!regSnap.exists()) continue;
              const registro = regSnap.data().registro || {};
              for (const [dia, novsDia] of Object.entries(registro)) {
                const diaNum  = parseInt(dia);
                const fecha   = `${year}-${String(month).padStart(2,"0")}-${String(diaNum).padStart(2,"0")}`;
                if (fecha < fechaInicio || fecha > fechaFin) continue;
                for (const [workerId, codigo] of Object.entries(novsDia)) {
                  const ced = workerMap[workerId];
                  if (!ced) continue;
                  if (!motivosAcc[ced]) motivosAcc[ced] = {};
                  motivosAcc[ced][codigo] = (motivosAcc[ced][codigo] || 0) + 1;
                }
              }
            } catch (_) {}
          }
        }
        setMotivosMap(motivosAcc);
      } catch (e) { console.warn("Error cargando motivos:", e); }

      // Cargar adelantos pendientes
      try {
        const adSnap = await getDocs(query(
          collection(db, "nomina_adelantos"),
          where("estado", "==", "pendiente")
        ));
        const adMap = {};
        adSnap.docs.forEach(d => {
          const a = d.data();
          const cc = String(a.cedula || "").trim();
          if (!cc) return;
          adMap[cc] = (adMap[cc] || 0) + (a.monto || 0);
        });
        setAdelantosMap(adMap);
      } catch (e) { console.warn("Error cargando adelantos:", e); }

      // Cargar comida pendiente — filtrar por clienteActivo
      try {
        const comSnap = await getDocs(query(
          collection(db, "nomina_comida"),
          where("estado", "==", "pendiente")
        ));
        const comMap = {};
        comSnap.docs.forEach(d => {
          const c = d.data();
          // Solo incluir comida del cliente activo (o sin clienteId = todos)
          if (c.clienteId && c.clienteId !== clienteActivo) return;
          const cc = String(c.cedula || "").trim();
          if (!cc) return;
          comMap[cc] = (comMap[cc] || 0) + (c.total || (c.cantidad || 1) * (c.valor || 0));
        });
        setComidaMap(comMap);
      } catch (e) { console.warn("Error cargando comida:", e); }

      const nomDoc = await getDoc(doc(db, "nomina_periodos", qId));
      if (nomDoc.exists()) {
        const data = nomDoc.data();
        setNominaGuardada(data);
        setFilas(deduplicar((data.empleados || []).map(e => ({
          _key:          ++_rowCounter,
          nombre:        e.nombre        || "",
          cedula:        String(e.cedula || ""),
          cargo:         e.cargo         || "",
          basicoMensual: e.basicoMensual || 0,
          dias:          e.diasTrabajados ?? diasDef,
          retroactivo:   e.retroactivo   || 0,
          horasExtras:   e.horasExtras   || HORAS_VACIAS(),
          firma:         e.firma         || "",
          observacion:   e.observacion   || "",
        }))));
      } else {
        setNominaGuardada(null);
        setFilas([]);
      }
    } catch (err) {
      console.error("Error cargando período:", err);
    }
    setRecalculando(false);
  };

  const agregarFila = () => setFilas(p => [...p, filaVacia(diasDef)]);
  const eliminarFila = key => setFilas(p => p.filter(f => f._key !== key));

  const actualizarFila = useCallback((key, campo, valor) => {
    setFilas(prev => prev.map(f => {
      if (f._key !== key) return f;
      const u = { ...f, [campo]: valor };
      if (campo === "cargo") {
        const c = listaCargos.find(c => c.nombre === valor);
        if (c?.basicoMensual) u.basicoMensual = c.basicoMensual;
      }
      return u;
    }));
  }, [listaCargos]);

  const actualizarHoraExtra = useCallback((key, codigo, valor) => {
    setFilas(prev => prev.map(f => {
      if (f._key !== key) return f;
      return { ...f, horasExtras: { ...(f.horasExtras || {}), [codigo]: parseFloat(valor) || 0 } };
    }));
  }, []);

  const buscarPorCedula = useCallback((key, cedula) => {
    if (!cedula) return;
    const cc = String(cedula).trim();
    const t  = listaTrabaj.find(w => String(w.cedula).trim() === cc);
    if (!t) return;
    setFilas(prev => prev.map(f => {
      if (f._key !== key) return f;
      const c = listaCargos.find(c => c.nombre === t.cargo);
      return {
        ...f,
        nombre:        f.nombre || t.nombre || "",
        cargo:         t.cargo  || f.cargo,
        basicoMensual: c?.basicoMensual || t.basicoMensual || f.basicoMensual || 0,
      };
    }));
  }, [listaTrabaj, listaCargos]);

  const cargarTodosTrabajadores = () => {
    // Deduplicar: cédulas ya presentes en la tabla
    const cedulasExistentes = new Set(filas.map(f => String(f.cedula || "").trim()).filter(Boolean));
    const trabajadoresNuevos = listaTrabaj.filter(t => !cedulasExistentes.has(String(t.cedula || "").trim()));
    if (filas.length === 0) {
      // tabla vacía → cargar todos
    } else if (trabajadoresNuevos.length === 0) {
      alert("Todos los trabajadores ya están en la tabla."); return;
    } else if (!confirm(`¿Agregar ${trabajadoresNuevos.length} trabajadores faltantes? (${cedulasExistentes.size} ya están)`)) {
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

  const importarExcel = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportando(true);
    try {
      const XLSX = await import("https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs");
      const buf  = await file.arrayBuffer();
      const wb   = XLSX.read(buf, { type: "array" });
      const sheetName = wb.SheetNames.find(n => n.toUpperCase().includes("NOMINA PRUEBA"))
                     || wb.SheetNames.find(n => n.toUpperCase().includes("NOMINA"))
                     || wb.SheetNames[0];
      const ws   = wb.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
      let headerRow = -1;
      for (let r = 0; r < Math.min(10, data.length); r++) {
        if (data[r].some(v => String(v).toUpperCase().includes("NOMBRE"))) { headerRow = r; break; }
      }
      if (headerRow === -1) { alert("No se encontró la fila de encabezados."); setImportando(false); return; }
      const headers = data[headerRow].map(v => String(v).toUpperCase().trim());
      const iNom   = headers.findIndex(h => h.includes("NOMBRE"));
      const iCed   = headers.findIndex(h => h.includes("CEDULA") || h.includes("CÉDULA"));
      const iCargo = headers.findIndex(h => h.includes("CARGO"));
      const iBas   = headers.findIndex(h => h.includes("BASICO") || h.includes("BÁSICO"));
      const iDias  = headers.findIndex(h => h.includes("DIA") || h.includes("DÍA"));
      const nuevas = [];
      for (let r = headerRow + 1; r < data.length; r++) {
        const row = data[r];
        const nom = iNom >= 0 ? String(row[iNom] || "").trim() : "";
        if (!nom || nom.toLowerCase().includes("total") || nom === "") continue;
        const ced   = iCed >= 0   ? String(row[iCed]   || "").replace(/\.0$/, "").trim() : "";
        const cargo = iCargo >= 0 ? String(row[iCargo] || "").trim() : "";
        const bas   = iBas >= 0   ? parseFloat(row[iBas])  || 0 : 0;
        const dias  = iDias >= 0  ? parseInt(row[iDias])   || diasDef : diasDef;
        const cargoObj = listaCargos.find(c => c.nombre === cargo);
        nuevas.push({ _key: ++_rowCounter, nombre: nom, cedula: ced, cargo,
          basicoMensual: cargoObj?.basicoMensual || bas || 0,
          dias, retroactivo: 0, horasExtras: HORAS_VACIAS(), firma: "", observacion: "" });
      }
      if (nuevas.length === 0) { alert("No se encontraron trabajadores."); setImportando(false); return; }
      if (filas.length > 0 && !confirm(`¿Reemplazar ${filas.length} filas con ${nuevas.length} del Excel?`)) { setImportando(false); return; }
      setFilas(deduplicar(nuevas));
      alert(`✅ ${nuevas.length} trabajadores importados desde "${sheetName}"`);
    } catch (err) { alert("Error importando Excel: " + err.message); }
    setImportando(false);
    e.target.value = "";
  };

  const filasCalculadas = filas.map((f, i) => {
    const prodData       = produccion[String(f.cedula).trim()] || { total: 0, ops: [] };
    const totalProduccion = prodData.total;
    const { total: totalExtras, desglose: desgloseExtras } = calcularHorasExtras(
      f.basicoMensual || 0,
      f.horasExtras || {}
    );
    const mots = motivosMap[String(f.cedula).trim()] || {};
    const calc = calcularNominaEmpleado({
      basicoMensual:     f.basicoMensual || 0,
      totalProduccion,
      diasTrabajados:    parseInt(f.dias) || 0,
      retroactivo:       parseFloat(f.retroactivo) || 0,
      totalHorasExtras:  totalExtras,
      diasIncapacidad:   mots["IR"]     || 0,   // 66.67% — IR
      diasIncapacidad100: mots["IR-100"] || 0,  // 100%   — IR-100
    });
    const motivoResumen = Object.entries(mots)
      .map(([cod, cnt]) => {
        const n = NOV_MAP[cod];
        const label = n ? `${n.emoji} ${n.label}` : cod;
        return cnt > 1 ? `${label} ×${cnt}` : label;
      })
      .join(", ");
    const adelantosDeducidos = adelantosMap[String(f.cedula).trim()] || 0;
    const comidaDeducida     = comidaMap[String(f.cedula).trim()]    || 0;  // solo informativo
    const netoFinal = Math.max(0, calc.netoAPagar - adelantosDeducidos); // comida NO resta por ahora
    return { ...f, idx: i + 1, totalProduccion, detalleOps: prodData.ops, totalExtras, desgloseExtras, ...calc, motivoResumen, adelantosDeducidos, comidaDeducida, netoFinal };
  });

  // ── Mapa cédula → centroCostos del trabajador (para filtro subgrupo)
  const cedulaCCMap = {};
  listaTrabaj.forEach(t => { cedulaCCMap[String(t.cedula).trim()] = t.centroCostos || ""; });

  const hayFiltro = filtroNombre.trim() || filtroCedula.trim() || filtroSubgrupo;
  const filasFiltradas = filasCalculadas.filter(f => {
    const okNombre = !filtroNombre.trim() || f.nombre?.toLowerCase().includes(filtroNombre.trim().toLowerCase());
    const okCedula = !filtroCedula.trim() || String(f.cedula).includes(filtroCedula.trim());
    const okSubgrupo = !filtroSubgrupo || (() => {
      const cc = cedulaCCMap[String(f.cedula).trim()] || "";
      // cc puede ser "110204", "110204 Estibadores", o el nombre solo
      return cc.includes(filtroSubgrupo);
    })();
    return okNombre && okCedula && okSubgrupo;
  });
  const limpiarFiltros = () => { setFiltroNombre(""); setFiltroCedula(""); setFiltroSubgrupo(""); };

  const totalesPorTipoExtra = HORAS_EXTRAS_2026.reduce((acc, t) => {
    acc[t.codigo] = {
      horas: filasCalculadas.reduce((s, e) => s + (e.horasExtras?.[t.codigo] || 0), 0),
      valor: filasCalculadas.reduce((s, e) => s + (e.desgloseExtras?.[t.codigo]?.valor || 0), 0),
    };
    return acc;
  }, {});

  const totales = {
    totalProduccion:     filasCalculadas.reduce((s, e) => s + e.totalProduccion, 0),
    complementoSalario:  filasCalculadas.reduce((s, e) => s + e.complementoSalario, 0),
    totalExtras:         filasCalculadas.reduce((s, e) => s + (e.totalExtras || 0), 0),
    salud:               filasCalculadas.reduce((s, e) => s + e.salud, 0),
    pension:             filasCalculadas.reduce((s, e) => s + e.pension, 0),
    subsidioTransporte:  filasCalculadas.reduce((s, e) => s + e.subsidioTransporte, 0),
    salarioMenosDeducciones: filasCalculadas.reduce((s, e) => s + e.salarioMenosDeducciones, 0),
    valorIncapacidad:    filasCalculadas.reduce((s, e) => s + (e.valorIncapacidad    || 0), 0),
    valorIncapacidad100: filasCalculadas.reduce((s, e) => s + (e.valorIncapacidad100 || 0), 0),
    netoAPagar:          filasCalculadas.reduce((s, e) => s + e.netoAPagar, 0),
    adelantosDeducidos:  filasCalculadas.reduce((s, e) => s + (e.adelantosDeducidos || 0), 0),
    comidaDeducida:      filasCalculadas.reduce((s, e) => s + (e.comidaDeducida     || 0), 0),
    netoFinal:           filasCalculadas.reduce((s, e) => s + (e.netoFinal || 0), 0), // solo resta adelantos
  };
  const conComplemento = filasCalculadas.filter(e => e.complementoSalario > 0).length;

  const guardarNomina = async () => {
    if (!fechaInicio || !fechaFin) { alert("Selecciona el período completo."); return; }
    if (fechaFin < fechaInicio)    { alert("La fecha fin no puede ser anterior."); return; }
    if (filas.length === 0)        { alert("No hay filas para guardar."); return; }
    if (!confirm(`¿Guardar nómina "${qLabel}"?`)) return;
    setGuardando(true);
    try {
      const auth = getAuth();
      const empleadosData = filasCalculadas.map(e => ({
        cedula: e.cedula, nombre: e.nombre, cargo: e.cargo,
        basicoMensual:           e.basicoMensual || 0,
        totalProduccion:         e.totalProduccion,
        diasTrabajados:          parseInt(e.dias) || 0,
        salarioBasicoQuincena:   e.salarioBasicoQuincena,
        productividad:           e.productividad,
        complementoSalario:      e.complementoSalario,
        produccionEfectiva:      e.produccionEfectiva,
        horasExtras:             e.horasExtras || {},
        totalHorasExtras:        e.totalExtras || 0,
        baseCotizacion:          e.baseCotizacion,
        salud:                   e.salud,
        pension:                 e.pension,
        salarioMenosDeducciones: e.salarioMenosDeducciones,
        subsidioTransporte:      e.subsidioTransporte,
        diasIncapacidad:         e.diasIncapacidad || 0,
        valorIncapacidad:        e.valorIncapacidad || 0,
        retroactivo:             parseFloat(e.retroactivo) || 0,
        netoAPagar:              e.netoAPagar,
        firma:                   e.firma       || "",
        observacion:             e.observacion || "",
        motivoResumen:           e.motivoResumen || "",
      }));

      await setDoc(doc(db, "nomina_periodos", qId), {
        quincenaId: qId, nombre: qLabel, fechaInicio, fechaFin,
        clienteId: clienteActivo,
        empleados: empleadosData,
        totalGeneral:      totales.netoAPagar,
        totalProduccion:   totales.totalProduccion,
        totalComplemento:  totales.complementoSalario,
        totalSalud:        totales.salud,
        totalPension:      totales.pension,
        totalSubsidio:     totales.subsidioTransporte,
        cantidadEmpleados: empleadosData.length,
        cantidadComplemento: conComplemento,
        estado:            "borrador",
        actualizadoEn:     new Date(),
        actualizadoPor:    auth.currentUser?.uid || "",
      }, { merge: true });

      await Promise.all(empleadosData.map(e => {
        const ced   = String(e.cedula || "").trim();
        const docId = ced ? `${ced}_${qId}` : null;
        if (!docId) return Promise.resolve();
        return setDoc(doc(db, "nomina_desprendibles", docId), {
          token: docId,
          cedula: ced, nombre: e.nombre, cargo: e.cargo, empresa: "LOGISPORT S.A.S.",
          quincenaId: qId, quincenaDesde: fechaInicio, quincenaHasta: fechaFin, quincenaLabel: qLabel,
          basicoMensual:           e.basicoMensual,
          diasTrabajados:          e.diasTrabajados,
          totalProduccion:         e.totalProduccion,
          salarioBasicoQuincena:   e.salarioBasicoQuincena,
          productividad:           e.productividad,
          complementoSalario:      e.complementoSalario,
          produccionEfectiva:      e.produccionEfectiva,
          baseCotizacion:          e.baseCotizacion,
          salud:                   e.salud,
          pension:                 e.pension,
          retroactivo:             e.retroactivo,
          salarioMenosDeducciones: e.salarioMenosDeducciones,
          subsidioTransporte:      e.subsidioTransporte,
          netoAPagar:              e.netoAPagar,
          observacion:             e.observacion || "",
          motivoResumen:           e.motivoResumen || "",
          firma:                   e.firma || "",
          fuente:                  "liquidar",
          generadoEn:              new Date(),
          generadoPor:             auth.currentUser?.uid || "",
        }, { merge: true });
      }));

      setNominaGuardada({ quincenaId: qId, nombre: qLabel, estado: "borrador" });
      alert(`✅ Nómina guardada — ${empleadosData.length} comprobantes publicados en /mi-pago`);
    } catch (e) { alert("Error al guardar: " + e.message); }
    setGuardando(false);
  };

  const exportarExcel = async () => {
    if (filas.length === 0) { alert("No hay datos para exportar."); return; }
    try {
      const XLSX = await import("https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs");
      const wb   = XLSX.utils.book_new();
      const rows = [];
      rows.push([`NÓMINA ${qLabel}`, , , , , , , , , , , , , , , , formatNum(SUBSIDIO_TRANSPORTE_MENSUAL)]);
      rows.push(["", "", "", "", "", "", "", "", "", "", "", 0.04, 0.04, "", "", "", formatNum(SUBSIDIO_TRANSPORTE_MENSUAL / 30)]);
      rows.push(["ITEM","NOMBRE","CEDULA","CARGO","BASICO MENSUAL","TOTAL PRODUCCION",
                 "COMPLEMENTO SMMLV","No. DIAS","OBSERVACION","MOTIVO ASISTENCIA",
                 "SALARIO BASICO QUINCENA","PRODUCTIVIDAD","SALABASE DE COTIZACION","SALUD","PENSION",
                 "SALARIO MENOS SALUD Y PENSION","SUBSIDIO DE TRANSPORTE","INC. REMUNERADA 66.67%","NETO A PAGAR","FIRMA"]);
      filasCalculadas.forEach((e, i) => {
        rows.push([
          i + 1, e.nombre, e.cedula, e.cargo, e.basicoMensual || 0, e.totalProduccion,
          e.complementoSalario, parseInt(e.dias) || 0, e.observacion || "", e.motivoResumen || "",
          e.salarioBasicoQuincena, e.productividad, e.baseCotizacion, e.salud, e.pension,
          e.salarioMenosDeducciones, e.subsidioTransporte, e.valorIncapacidad || 0, e.netoAPagar, e.firma || "",
        ]);
      });
      rows.push(["", "", "", "", "", totales.totalProduccion, totales.complementoSalario,
                 "", "", "", "", "", "", totales.salud, totales.pension,
                 "", totales.subsidioTransporte, totales.valorIncapacidad || 0, totales.netoAPagar, ""]);
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = [
        {wch:5},{wch:35},{wch:14},{wch:32},{wch:15},{wch:17},
        {wch:16},{wch:8},{wch:30},{wch:20},{wch:20},{wch:14},
        {wch:22},{wch:11},{wch:11},{wch:24},{wch:20},{wch:15},{wch:10},
      ];
      XLSX.utils.book_append_sheet(wb, ws, "NOMINA PRUEBA");
      XLSX.writeFile(wb, `nomina_${qId}.xlsx`);
    } catch (err) { alert("Error exportando Excel: " + err.message); }
  };

  const formatNum = n => Math.round((n || 0) * 100) / 100;

  // ── Exportar para DATAX ─────────────────────────────────────────────────────
  // Genera un Excel con DOS hojas:
  //   1. «NOVEDADES_DATAX» → formato listo para importar (una fila por concepto por empleado)
  //   2. «RESUMEN_COMPLETO» → tabla completa con todos los cálculos
  // Una vez que la contadora confirme las columnas exactas de DATAX, solo se ajusta esta función.
  const exportarDATAX = async () => {
    if (filasCalculadas.length === 0) { alert("No hay datos para exportar."); return; }
    try {
      const XLSX = await import("https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs");
      const wb   = XLSX.utils.book_new();
      const clienteNombre = clientes.find(c => c.id === clienteActivo)?.nombre || clienteActivo;

      // ═══════════════════════════════════════════════════════════════════
      // HOJA 1 — NOVEDADES_DATAX
      // Formato: una fila por CONCEPTO por EMPLEADO
      // Columnas estándar que acepta la mayoría de software nómina Colombia
      // ═══════════════════════════════════════════════════════════════════
      const CONCEPTO_CODIGOS = {
        PRODUCCION_VARIABLE: "PROD_VAR",
        COMPLEMENTO_SMMLV:   "COMP_SMMLV",
        SALUD:               "DED_SALUD",
        PENSION:             "DED_PENSION",
        SUBSIDIO_TRANSP:     "AUX_TRANSP",
        INC_REM_66:          "INC_REM",
        INC_REM_100:         "INC_REM_100",
        RETROACTIVO:         "RETROACT",
        HED:                 "HED",
        HEN:                 "HEN",
        HRN:                 "HRN",
        HRDF:                "HRDF",
        HRNDF:               "HRNDF",
        HEDDF:               "HEDDF",
        HENDF:               "HENDF",
      };

      const hdrs1 = [
        "PERIODO_INICIO",
        "PERIODO_FIN",
        "CEDULA",
        "NOMBRE_EMPLEADO",
        "CARGO",
        "CODIGO_CONCEPTO",
        "DESCRIPCION_CONCEPTO",
        "TIPO",
        "DIAS",
        "VALOR",
        "OBSERVACION",
      ];
      const rows1 = [hdrs1];

      filasCalculadas.forEach(e => {
        const cc = String(e.cedula || "").trim();
        if (!cc) return;
        const base = [fechaInicio, fechaFin, cc, e.nombre, e.cargo];
        const obs  = e.motivoResumen || "";
        const dias = parseInt(e.dias) || 0;

        const push = (cod, desc, tipo, diasN, valor) => {
          if (!valor || valor === 0) return;
          rows1.push([...base, cod, desc, tipo, diasN, Math.round(valor), obs]);
        };

        // Devengados
        push(CONCEPTO_CODIGOS.PRODUCCION_VARIABLE, "Producción Variable",   "DEVENGADO", dias, e.totalProduccion);
        push(CONCEPTO_CODIGOS.COMPLEMENTO_SMMLV,   "Complemento SMMLV",     "DEVENGADO", dias, e.complementoSalario);
        push(CONCEPTO_CODIGOS.SUBSIDIO_TRANSP,      "Auxilio de Transporte", "DEVENGADO", dias, e.subsidioTransporte);
        push(CONCEPTO_CODIGOS.INC_REM_66,           "Incapacidad Rem. 66.67%","DEVENGADO", e.diasIncapacidad || 0, e.valorIncapacidad || 0);
        push(CONCEPTO_CODIGOS.INC_REM_100,          "Incapacidad Rem. 100%", "DEVENGADO", e.diasIncapacidad100 || 0, e.valorIncapacidad100 || 0);
        push(CONCEPTO_CODIGOS.RETROACTIVO,          "Retroactivo",           "DEVENGADO", 0, parseFloat(e.retroactivo) || 0);
        // Horas extras
        const heDesc = { HED:"H.Extra Diurna 25%",HEN:"H.Extra Nocturna 75%",HRN:"Recargo Nocturno 35%",HRDF:"Recargo Dom/Fest 75%",HRNDF:"Rec.Noc.Dom/Fest 110%",HEDDF:"H.Extra Diurna D/F 100%",HENDF:"H.Extra Noc D/F 150%" };
        HORAS_EXTRAS_2026.forEach(t => {
          const val = e.desgloseExtras?.[t.codigo]?.valor || 0;
          push(CONCEPTO_CODIGOS[t.codigo], heDesc[t.codigo] || t.label, "DEVENGADO", 0, val);
        });
        // Deducciones (valores positivos, DATAX sabe que son descuentos por TIPO)
        push(CONCEPTO_CODIGOS.SALUD,   "Aporte Salud 4%",   "DEDUCCION", dias, e.salud);
        push(CONCEPTO_CODIGOS.PENSION, "Aporte Pensión 4%", "DEDUCCION", dias, e.pension);
      });

      const ws1 = XLSX.utils.aoa_to_sheet(rows1);
      ws1["!cols"] = [
        {wch:14},{wch:12},{wch:14},{wch:35},{wch:28},
        {wch:15},{wch:28},{wch:12},{wch:6},{wch:14},{wch:30},
      ];
      // Estilo encabezado hoja 1
      const rng1 = XLSX.utils.decode_range(ws1["!ref"]);
      for (let C = rng1.s.c; C <= rng1.e.c; C++) {
        const addr = XLSX.utils.encode_cell({ r: 0, c: C });
        if (!ws1[addr]) continue;
        ws1[addr].s = { font:{ bold:true, color:{ rgb:"FFFFFF" } }, fill:{ fgColor:{ rgb:"0B3D91" } }, alignment:{ horizontal:"center" } };
      }
      XLSX.utils.book_append_sheet(wb, ws1, "NOVEDADES_DATAX");

      // ═══════════════════════════════════════════════════════════════════
      // HOJA 2 — RESUMEN_COMPLETO (referencia para la contadora)
      // ═══════════════════════════════════════════════════════════════════
      const hdrs2 = [
        "#","CÉDULA","NOMBRE","CARGO","BÁSICO MENSUAL","DÍAS",
        "TOTAL PRODUCCIÓN","COMPLEMENTO SMMLV","SAL.BÁSICO QUINCENA",
        "BASE COTIZACIÓN","SALUD 4%","PENSIÓN 4%",
        "SUBSIDIO TRANSP.","INC.REM 66%","INC.REM 100%","RETROACTIVO",
        "NETO A PAGAR","MOTIVO ASISTENCIA","OBSERVACIÓN",
      ];
      const rows2 = [
        [`LIQUIDACIÓN DE NÓMINA — ${clienteNombre} — ${qLabel}`],
        [`Generado: ${new Date().toLocaleString("es-CO")}   |   SOPORTEIA.NET   |   LOGISPORT`],
        [],
        hdrs2,
      ];
      filasCalculadas.forEach((e, i) => rows2.push([
        i + 1,
        String(e.cedula || ""),
        e.nombre,
        e.cargo,
        Math.round(e.basicoMensual || 0),
        parseInt(e.dias) || 0,
        Math.round(e.totalProduccion),
        Math.round(e.complementoSalario),
        Math.round(e.salarioBasicoQuincena),
        Math.round(e.baseCotizacion),
        Math.round(e.salud),
        Math.round(e.pension),
        Math.round(e.subsidioTransporte),
        Math.round(e.valorIncapacidad || 0),
        Math.round(e.valorIncapacidad100 || 0),
        Math.round(parseFloat(e.retroactivo) || 0),
        Math.round(e.netoAPagar),
        e.motivoResumen || "",
        e.observacion || "",
      ]));
      // Fila totales
      rows2.push([
        "TOTAL","","","","","",
        Math.round(totales.totalProduccion),
        Math.round(totales.complementoSalario),
        "","",
        Math.round(totales.salud),
        Math.round(totales.pension),
        Math.round(totales.subsidioTransporte),
        Math.round(totales.valorIncapacidad || 0),
        Math.round(totales.valorIncapacidad100 || 0),
        "",
        Math.round(totales.netoAPagar),
        "","",
      ]);
      const ws2 = XLSX.utils.aoa_to_sheet(rows2);
      ws2["!merges"] = [{ s:{r:0,c:0}, e:{r:0,c:18} }, { s:{r:1,c:0}, e:{r:1,c:18} }];
      ws2["!cols"] = [
        {wch:5},{wch:14},{wch:35},{wch:28},{wch:14},{wch:6},
        {wch:16},{wch:16},{wch:18},{wch:16},{wch:12},{wch:12},
        {wch:16},{wch:14},{wch:14},{wch:13},{wch:16},{wch:30},{wch:25},
      ];
      XLSX.utils.book_append_sheet(wb, ws2, "RESUMEN_COMPLETO");

      // ═══════════════════════════════════════════════════════════════════
      // HOJA 3 — INSTRUCCIONES para la contadora
      // ═══════════════════════════════════════════════════════════════════
      const instrucciones = [
        ["📋 INSTRUCCIONES DE IMPORTACIÓN A DATAX"],
        [""],
        ["HOJA: NOVEDADES_DATAX"],
        ["Esta hoja contiene las novedades en formato de importación."],
        ["Cada fila = un concepto de un empleado para el período."],
        [""],
        ["COLUMNAS CLAVE:"],
        ["CEDULA",          "Número de cédula del empleado (sin puntos)"],
        ["CODIGO_CONCEPTO",  "Código del concepto (puede necesitar ajuste según DATAX)"],
        ["TIPO",             "DEVENGADO = ingreso / DEDUCCION = descuento"],
        ["DIAS",             "Días del concepto (0 si aplica sobre el período completo)"],
        ["VALOR",            "Valor en pesos colombianos (sin decimales)"],
        [""],
        ["CODIGOS DE CONCEPTO — confirmar con DATAX:"],
        ["PROD_VAR",    "Producción Variable del período"],
        ["COMP_SMMLV",  "Complemento al Salario Mínimo"],
        ["AUX_TRANSP",  "Auxilio de Transporte"],
        ["INC_REM",     "Incapacidad Remunerada 66.67%"],
        ["INC_REM_100", "Incapacidad Remunerada 100% (primeros 2 días)"],
        ["RETROACT",    "Retroactivo"],
        ["HED",         "Hora Extra Diurna 25%"],
        ["HEN",         "Hora Extra Nocturna 75%"],
        ["HRN",         "Recargo Nocturno 35%"],
        ["HRDF",        "Recargo Dominical/Festivo 75%"],
        ["HRNDF",       "Recargo Nocturno Dom/Fest 110%"],
        ["HEDDF",       "H.Extra Diurna Dom/Fest 100%"],
        ["HENDF",       "H.Extra Nocturna Dom/Fest 150%"],
        ["DED_SALUD",   "Deducción Salud 4% (ya calculado)"],
        ["DED_PENSION", "Deducción Pensión 4% (ya calculado)"],
        [""],
        ["NOTA IMPORTANTE:"],
        ["Los códigos de concepto deben coincidir con los parametrizados en DATAX."],
        ["Si DATAX usa códigos diferentes (ej. 'OTROS INGRESOS', 'HORAS EXTRAS'),"],
        ["solicitar al administrador de DATAX la lista de conceptos y se ajusta el archivo."],
        [""],
        [`Período: ${qLabel}`],
        [`Cliente: ${clienteNombre}`],
        [`Empleados: ${filasCalculadas.length}`],
        [`Total Neto: ${Math.round(totales.netoAPagar).toLocaleString("es-CO")}`],
        [`Generado por: LOGISPORT — SOPORTEIA.NET`],
      ];
      const ws3 = XLSX.utils.aoa_to_sheet(instrucciones);
      ws3["!cols"] = [{wch:20},{wch:60}];
      XLSX.utils.book_append_sheet(wb, ws3, "INSTRUCCIONES");

      XLSX.writeFile(wb, `DATAX_novedades_${clienteActivo}_${qId}.xlsx`);
      alert(`✅ Archivo DATAX generado:\n• Hoja 1: NOVEDADES_DATAX (${rows1.length - 1} filas para importar)\n• Hoja 2: RESUMEN_COMPLETO\n• Hoja 3: INSTRUCCIONES`);
    } catch (err) {
      alert("Error generando archivo DATAX: " + err.message);
    }
  };

  const exportarCSV = () => {
    const H = ["ITEM","NOMBRE","CÉDULA","CARGO","BÁSICO MENSUAL","TOTAL PRODUCCIÓN",
               "COMPLEMENTO","DÍAS","OBSERVACIÓN","MOTIVO",
               "SAL.BÁSICO QUIN.","PRODUCTIVIDAD","BASE COTIZACIÓN","SALUD 4%","PENSIÓN 4%",
               "SAL-DEDUCC.","SUBSIDIO TRANSP.","NETO A PAGAR","FIRMA"];
    let csv = `NÓMINA ${qLabel}\n\n` + H.join(",") + "\n";
    filasCalculadas.forEach((e, i) => {
      csv += [i+1, `"${e.nombre}"`, `"${e.cedula}"`, `"${e.cargo}"`,
        e.basicoMensual||0, e.totalProduccion, e.complementoSalario,
        e.dias||0, `"${e.observacion||""}"`, `"${e.motivoResumen||""}"`,
        e.salarioBasicoQuincena, e.productividad,
        e.baseCotizacion, e.salud, e.pension, e.salarioMenosDeducciones,
        e.subsidioTransporte, e.netoAPagar, `"${e.firma||""}"`].join(",") + "\n";
    });
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `nomina_${qId}.csv`; a.click();
  };

  if (loading) return (
    <LayoutWithSidebar>
      <div style={{ textAlign: "center", padding: "4rem", color: PRIMARY }}>
        <div style={{ fontSize: "2rem" }}>💰 Cargando módulo de liquidación...</div>
      </div>
    </LayoutWithSidebar>
  );

  const periodoValido = fechaInicio && fechaFin && fechaFin >= fechaInicio;

  return (
    <LayoutWithSidebar>
      <div style={{ width: "100%" }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
          <button onClick={() => router.push("/nomina")}
            style={{ background: "none", border: "none", cursor: "pointer", color: PRIMARY }}>
            <ArrowLeft size={22} />
          </button>
          <div style={{ flex: 1, minWidth: "200px" }}>
            <h1 style={{ margin: 0, color: PRIMARY, fontSize: "1.6rem", fontWeight: "800" }}>💰 Liquidar Nómina</h1>
            <p style={{ margin: 0, color: "#64748b", fontSize: "0.9rem" }}>
              {nominaGuardada
                ? `✅ Guardada — ${nominaGuardada.estado} — ${filas.length} empleados`
                : filas.length > 0 ? `🆕 Nueva — ${filas.length} filas` : "🆕 Nueva liquidación"}
            </p>
            {nominaGuardada && (
              <div style={{ marginTop: "0.35rem", display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.72rem", color: "#64748b" }}>🌐 Enlace para trabajadores:</span>
                <code style={{ fontSize: "0.72rem", background: "#eff6ff", color: PRIMARY, padding: "2px 7px", borderRadius: "5px", fontWeight: "700" }}>
                  {typeof window !== "undefined" ? window.location.origin : ""}/mi-pago
                </code>
                <button
                  onClick={() => navigator.clipboard?.writeText(`${typeof window !== "undefined" ? window.location.origin : ""}/mi-pago`)}
                  style={{ background: "none", border: "1px solid #bfdbfe", borderRadius: "5px", padding: "1px 7px", cursor: "pointer", fontSize: "0.68rem", color: PRIMARY, fontWeight: "700" }}>
                  📋 Copiar
                </button>
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={importarExcel} style={{ display: "none" }} />
            <button onClick={() => fileInputRef.current?.click()} disabled={importando} style={btnStyle("#8b5cf6", importando)}>
              <Upload size={16} />{importando ? "Importando..." : "Importar Excel"}
            </button>
            <button onClick={exportarExcel} style={btnStyle(SUCCESS)}>
              <FileSpreadsheet size={16} /> Exportar Excel
            </button>
            <button onClick={exportarDATAX} style={btnStyle("#7c3aed")}>
              <Download size={16} /> 📤 Exportar DATAX
            </button>
            <button onClick={exportarCSV} style={btnStyle("#64748b")}>
              <Download size={16} /> CSV
            </button>
            <button onClick={() => window.print()} style={btnStyle("#6366f1")}>
              <Printer size={16} /> Imprimir
            </button>
            <button onClick={guardarNomina} disabled={guardando || !periodoValido}
              style={btnStyle(PRIMARY, guardando || !periodoValido)}>
              <Save size={16} />{guardando ? "Guardando..." : "Guardar Nómina"}
            </button>
          </div>
        </div>

        {/* ── Selector de cliente ── */}
        <div style={{ display:"flex", gap:"0.5rem", marginBottom:"1rem", flexWrap:"wrap", alignItems:"center" }}>
          <span style={{ fontSize:"0.78rem", color:"#64748b", fontWeight:"700", marginRight:"0.25rem" }}>CLIENTE:</span>
          {clientes.map(cl => (
            <button key={cl.id} onClick={() => setClienteActivo(cl.id)}
              style={{
                border: clienteActivo === cl.id ? `2px solid ${cl.color}` : "2px solid #e2e8f0",
                borderRadius:"999px", padding:"0.35rem 1rem", cursor:"pointer",
                fontWeight: clienteActivo === cl.id ? "800" : "600",
                fontSize:"0.82rem",
                background: clienteActivo === cl.id ? cl.color : "#f8fafc",
                color: clienteActivo === cl.id ? "#fff" : "#64748b",
                transition:"all 0.15s",
                display:"flex", alignItems:"center", gap:"0.35rem",
              }}>
              {cl.emoji} {cl.nombre}
            </button>
          ))}
        </div>

        {/* ── Selector período + Stats ── */}
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr 1fr 1fr", gap: "1rem", marginBottom: "1.5rem", alignItems: "stretch" }}>
          <div style={{ ...cardStyle, minWidth: "320px" }}>
            <div style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: "700", marginBottom: "0.6rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <Calendar size={14} color={PRIMARY} /> PERÍODO DE LIQUIDACIÓN
            </div>
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
              {[
                { label: "DESDE", val: fechaInicio, max: fechaFin, set: setFechaInicio },
                { label: "HASTA", val: fechaFin, min: fechaInicio, set: setFechaFin },
              ].map((f, i) => (
                <div key={i}>
                  <div style={{ fontSize: "0.68rem", color: "#94a3b8", marginBottom: "2px" }}>{f.label}</div>
                  <input type="date" value={f.val} max={f.max} min={f.min}
                    onChange={e => f.set(e.target.value)} style={dateInputStyle} />
                </div>
              ))}
              <span style={{ color: "#94a3b8", fontWeight: "700", marginTop: "14px" }}>→</span>
              <button onClick={cargarPeriodo} disabled={recalculando || !periodoValido}
                style={{ background: periodoValido ? PRIMARY : "#e2e8f0", border: "none", borderRadius: "8px", padding: "0.45rem 0.7rem", cursor: periodoValido ? "pointer" : "not-allowed", marginTop: "14px", color: "#fff", fontWeight: "700", fontSize: "0.78rem", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                <RefreshCw size={14} style={{ animation: recalculando ? "spin 1s linear infinite" : "none" }} />
                {recalculando ? "..." : "Buscar"}
              </button>
            </div>
            {periodoValido && (
              <div style={{ marginTop: "0.6rem", padding: "0.35rem 0.6rem", background: nominaGuardada ? "#f0fdf4" : "#eff6ff", borderRadius: "6px", fontSize: "0.78rem", fontWeight: "700", color: nominaGuardada ? "#059669" : PRIMARY, border: `1px solid ${nominaGuardada ? "#86efac" : "#bfdbfe"}` }}>
                {nominaGuardada ? "✅" : "📋"} {qLabel}
                {nominaGuardada && <span style={{ fontWeight: "400", color: "#64748b" }}> — guardada</span>}
                <span style={{ marginLeft: "0.5rem", color: "#94a3b8", fontWeight: "400" }}>({diasDef} días)</span>
              </div>
            )}
          </div>
          {[
            { label: "Empleados",         value: filas.length,                                  color: "#3b82f6", icon: "👷" },
            { label: `Producción Matriz (${infoMatriz.ops} ops)`, value: formatCOP(totales.totalProduccion), color: SUCCESS, icon: "📋" },
            { label: conComplemento > 0 ? `Complemento SMMLV (${conComplemento})` : "Salud + Pensión",
              value: conComplemento > 0 ? formatCOP(totales.complementoSalario) : formatCOP(totales.salud + totales.pension),
              color: conComplemento > 0 ? WARN : "#f59e0b", icon: conComplemento > 0 ? "⚠️" : "🏥" },
            { label: "NETO A PAGAR", value: formatCOP(totales.netoAPagar), color: PRIMARY, icon: "💰" },
          ].map((s, i) => (
            <div key={i} style={{ ...cardStyle, borderLeft: `4px solid ${s.color}` }}>
              <div style={{ fontSize: "1.3rem", marginBottom: "0.1rem" }}>{s.icon}</div>
              <div style={{ fontWeight: "800", color: s.color, fontSize: i === 3 ? "0.98rem" : "1.05rem" }}>{s.value}</div>
              <div style={{ color: "#64748b", fontSize: "0.73rem" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── Banners ── */}
        {infoMatriz.ops > 0 && (
          <div style={{ background: "#f0fdf4", border: "1.5px solid #86efac", borderRadius: "10px", padding: "0.65rem 1rem", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.6rem", fontSize: "0.83rem", color: "#065f46" }}>
            <Info size={15} color={SUCCESS} style={{ flexShrink: 0 }} />
            <span>
              <strong>Producción sincronizada desde la Matriz:</strong> {infoMatriz.ops} operaciones · {infoMatriz.trabajadores} trabajadores con datos.

            </span>
          </div>
        )}
        {infoMatriz.ops === 0 && !recalculando && filas.length > 0 && (
          <div style={{ background: "#fff7ed", border: "1.5px solid #fed7aa", borderRadius: "10px", padding: "0.65rem 1rem", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.6rem", fontSize: "0.83rem", color: "#92400e" }}>
            <AlertTriangle size={15} color={WARN} style={{ flexShrink: 0 }} />
            <span><strong>Sin operaciones en la Matriz para este período.</strong> La columna TOTAL PROD. mostrará $0.</span>
          </div>
        )}

        {/* Barra filtros: sticky vertical, sin verse afectada por scroll horizontal */}
        <div style={{ background: "#fff", borderRadius: "12px 12px 0 0", boxShadow: "0 4px 16px rgba(11,61,145,0.12)", position: "sticky", top: 0, zIndex: 50, boxSizing: "border-box" }}>

          {/* ── Tabla principal ── */}
          {/* El div id=nomina-print ahora solo contiene la tabla */}

            {/* Título */}
            <div style={{ padding: "0.75rem 1.5rem", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
              <div>
                <h2 style={{ margin: 0, color: PRIMARY, fontWeight: "800", fontSize: "1rem" }}>NÓMINA — {qLabel}</h2>
                <p style={{ margin: 0, color: "#64748b", fontSize: "0.78rem" }}>
                  LOGISPORT S.A.S. — {clientes.find(c=>c.id===clienteActivo)?.nombre || clienteActivo} — {new Date().toLocaleDateString("es-CO")} — {filas.length} empleados
                </p>
              </div>
              <div style={{ fontSize: "0.75rem", color: "#64748b", textAlign: "right" }}>
                Salud / Pensión: <strong>4%</strong> &nbsp;|&nbsp;
                Subsidio transp.: <strong>{formatCOP(SUBSIDIO_TRANSPORTE_MENSUAL)}/mes</strong> &nbsp;|&nbsp;
                SMMLV: <strong>{formatCOP(SMMLV)}</strong>
              </div>
            </div>

          {/* ═══ BARRA FILTROS + HERRAMIENTAS ═══ */}
          <div style={{
            padding: "0.6rem 1.25rem",
            display: "flex", flexDirection: "column", gap: "0.5rem",
            background: "#ffffff",
            boxShadow: "0 4px 20px rgba(11,61,145,0.18)",
            borderBottom: "2.5px solid #bfdbfe",
          }}>

            {/* ── Fila 1: Filtros de búsqueda — SIEMPRE VISIBLES A LA IZQUIERDA ── */}
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
              {/* Etiqueta */}
              <span style={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: "700", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                <Search size={12} /> FILTRAR:
              </span>

              {/* Filtro NOMBRE */}
              <div style={{ position: "relative" }}>
                <Search size={13} style={{ position: "absolute", left: "0.6rem", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }} />
                <input
                  value={filtroNombre}
                  onChange={e => setFiltroNombre(e.target.value)}
                  placeholder="Nombre..."
                  style={{
                    border: `1.5px solid ${filtroNombre ? PRIMARY : "#e2e8f0"}`,
                    borderRadius: "8px", padding: "0.38rem 1.6rem 0.38rem 2rem",
                    fontSize: "0.82rem", outline: "none",
                    background: filtroNombre ? "#eff6ff" : "#f8fafc", width: "160px",
                    color: "#1e293b", transition: "border-color 0.15s",
                  }}
                />
                {filtroNombre && (
                  <button onClick={() => setFiltroNombre("")}
                    style={{ position: "absolute", right: "0.4rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: "1rem", lineHeight: 1, padding: 0 }}>×</button>
                )}
              </div>

              {/* Filtro CÉDULA */}
              <div style={{ position: "relative" }}>
                <Filter size={13} style={{ position: "absolute", left: "0.6rem", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }} />
                <input
                  value={filtroCedula}
                  onChange={e => setFiltroCedula(e.target.value)}
                  placeholder="Cédula..."
                  inputMode="numeric"
                  style={{
                    border: `1.5px solid ${filtroCedula ? "#8b5cf6" : "#e2e8f0"}`,
                    borderRadius: "8px", padding: "0.38rem 1.6rem 0.38rem 2rem",
                    fontSize: "0.82rem", outline: "none", fontFamily: "monospace",
                    background: filtroCedula ? "#f5f3ff" : "#f8fafc", width: "140px",
                    color: "#1e293b", transition: "border-color 0.15s",
                  }}
                />
                {filtroCedula && (
                  <button onClick={() => setFiltroCedula("")}
                    style={{ position: "absolute", right: "0.4rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: "1rem", lineHeight: 1, padding: 0 }}>×</button>
                )}
              </div>

              {/* Filtro SUBGRUPO / CENTRO DE COSTO */}
              {subgruposCliente.length > 0 && (
                <div style={{ position: "relative" }}>
                  <select
                    value={filtroSubgrupo}
                    onChange={e => setFiltroSubgrupo(e.target.value)}
                    style={{
                      border: `1.5px solid ${filtroSubgrupo ? "#f59e0b" : "#e2e8f0"}`,
                      borderRadius: "8px",
                      padding: "0.38rem 0.9rem 0.38rem 0.75rem",
                      fontSize: "0.82rem", outline: "none",
                      background: filtroSubgrupo ? "#fffbeb" : "#f8fafc",
                      color: filtroSubgrupo ? "#92400e" : "#64748b",
                      fontWeight: filtroSubgrupo ? "700" : "500",
                      cursor: "pointer", height: "34px",
                      transition: "border-color 0.15s", minWidth: "170px",
                    }}
                  >
                    <option value="">📊 Centro de costo...</option>
                    {subgruposCliente.map(sg => (
                      <option key={sg.id} value={sg.codigo}>{sg.codigo} — {sg.nombre}</option>
                    ))}
                  </select>
                  {filtroSubgrupo && (
                    <button onClick={() => setFiltroSubgrupo("")}
                      style={{ position: "absolute", right: "1.4rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: "1rem", lineHeight: 1, padding: 0 }}>×</button>
                  )}
                </div>
              )}

              {/* Contador + limpiar */}
              {hayFiltro && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                  <span style={{ fontSize: "0.78rem", color: "#64748b", fontWeight: "700", background: "#f1f5f9", padding: "0.25rem 0.6rem", borderRadius: "20px", whiteSpace: "nowrap" }}>
                    {filasFiltradas.length} / {filas.length}
                  </span>
                  <button onClick={limpiarFiltros}
                    style={{ background: "#f1f5f9", border: "none", borderRadius: "6px", padding: "0.28rem 0.55rem", cursor: "pointer", color: "#64748b", fontSize: "0.75rem", fontWeight: "700" }}>
                    ✕ Limpiar
                  </button>
                </div>
              )}
            </div>

            {/* ── Fila 2: Botones de acción ── */}
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
              <button onClick={agregarFila} style={btnStyle(ACCENT, false, "sm")}>
                <Plus size={14} /> Agregar fila
              </button>
              <button onClick={cargarTodosTrabajadores} style={btnStyle("#8b5cf6", false, "sm")}>
                <UserPlus size={14} /> Cargar trabajadores BD
              </button>
              {filas.length > 0 && (
                <button onClick={() => { if (confirm("¿Limpiar todas las filas?")) setFilas([]); }}
                  style={btnStyle(DANGER, false, "sm")}>
                  <Trash2 size={14} /> Limpiar todo
                </button>
              )}
            </div>

          </div>

            {/* Leyenda */}
            <div style={{ padding: "0.4rem 1.25rem", display: "flex", gap: "1rem", flexWrap: "wrap", fontSize: "0.72rem", color: "#64748b", borderBottom: "1px solid #f1f5f9", background: "#fff" }}>
              {[
                { bg: "#eff6ff", border: "#93c5fd", label: "Campo editable" },
                { bg: "#fefce8", border: "#fde047", label: "Desde catálogo" },
                { bg: "#f0fdf4", border: "#86efac", label: "Fórmula auto" },
                { bg: "#fff7ed", border: "#fed7aa", label: "Complemento SMMLV" },
                { bg: "#dcfce7", border: "#4ade80", label: "NETO" },
                { bg: "#e0f2fe", border: "#7dd3fc", label: "Motivo asistencia" },
              ].map((l, i) => (
                <span key={i} style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                  <span style={{ width: 11, height: 11, background: l.bg, borderRadius: 2, display: "inline-block", border: `1px solid ${l.border}` }} />
                  {l.label}
                </span>
              ))}
            </div>
          </div>{/* fin sticky header */}

        {/* ── Tabla principal — solo la tabla dentro de nomina-print ── */}
        <div id="nomina-print">

          {/* Tabla — scroll libre horizontal + vertical, sin contenedor padre que recorte */}
          <div style={{
            overflowX: "auto", overflowY: "auto",
            maxHeight: "62vh",
            background: "#fff",
            borderRadius: "0 0 12px 12px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
            WebkitOverflowScrolling: "touch",
          }}>
            {filas.length === 0 ? (
              <div style={{ textAlign: "center", padding: "3rem", color: "#94a3b8" }}>
                <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>📋</div>
                <div style={{ fontSize: "1.1rem", fontWeight: "700", color: "#64748b", marginBottom: "0.5rem" }}>Nómina en blanco</div>
                <div style={{ fontSize: "0.85rem", marginBottom: "1.5rem" }}>
                  Usa <strong>"Importar Excel"</strong> para cargar desde el archivo de nómina,<br />
                  o <strong>"Cargar trabajadores BD"</strong> para cargar desde el sistema.
                </div>
                <div style={{ display: "flex", justifyContent: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                  <button onClick={() => fileInputRef.current?.click()} style={btnStyle("#8b5cf6")}><Upload size={16} /> Importar Excel</button>
                  <button onClick={cargarTodosTrabajadores} style={btnStyle(PRIMARY)}><UserPlus size={16} /> Cargar trabajadores BD</button>
                  <button onClick={agregarFila} style={btnStyle(ACCENT)}><Plus size={16} /> Agregar manualmente</button>
                </div>
              </div>
            ) : filasFiltradas.length === 0 ? (
              <div style={{ textAlign: "center", padding: "2rem", color: "#94a3b8" }}>
                <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🔍</div>
                <div style={{ fontWeight: "600", color: "#64748b", marginBottom: "0.35rem" }}>Sin resultados</div>
                <button onClick={limpiarFiltros} style={{ ...btnStyle(PRIMARY, false, "sm"), margin: "0 auto" }}>Limpiar filtros</button>
              </div>
            ) : (
              <table style={{ width: "100%", minWidth: "2800px", borderCollapse: "collapse", fontSize: "0.76rem" }}>
                <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                  {/* ── Fila 1: grupos de columnas — 29 cols total ── */}
                  <tr style={{ background: "#e2e8f0" }}>
                    <th colSpan={2} style={thGrupo("#94a3b8")} />
                    <th colSpan={3} style={thGrupo("#3b82f6")}>DATOS EDITABLES</th>
                    <th style={thGrupo(SUCCESS)}>PRODUCCIÓN MATRIZ</th>
                    <th style={thGrupo(WARN)}>COMPLEMENTO</th>
                    <th colSpan={3} style={thGrupo("#3b82f6")}>DÍAS / OBSERVACIÓN / MOTIVO</th>
                    <th colSpan={2} style={thGrupo(SUCCESS)}>FÓRMULAS AUTO</th>
                    <th colSpan={8} style={{ ...thGrupo("#7c3aed"), background: "#ede9fe", fontWeight: "800", fontSize: "0.68rem" }}>⏱ HORAS EXTRAS Y RECARGOS 2026 — Ley colombiana (CST arts. 168-170)</th>
                    <th style={thGrupo("#3b82f6")}>RETRO.</th>
                    <th style={thGrupo("#94a3b8")}>BASE COTIZ.</th>
                    <th colSpan={2} style={thGrupo(DANGER)}>DEDUCCIONES</th>
                    <th colSpan={2} style={thGrupo(SUCCESS)}>CÁLCULOS AUTO</th>
                    <th style={thGrupo("#0891b2")}>INC. REM. 66%</th>
                    <th style={thGrupo("#047857")}>INC. REM. 100%</th>
                    <th style={thGrupo("#065f46")}>NETO</th>
                    <th style={thGrupo("#ef4444")}>ADELANTOS</th>
                    <th style={thGrupo("#f97316")}>COMIDA</th>
                    <th style={{ ...thGrupo("#065f46"), background:"#bbf7d0", fontWeight:"900" }}>NETO FINAL</th>
                    <th style={thGrupo("#0ea5e9")}>FIRMA</th>
                    <th style={thGrupo("#94a3b8")} />
                  </tr>
                  {/* ── Fila 2: etiquetas de columnas — 21 columnas totales ── */}
                  {/* 1:#  2:NOMBRE  3:CÉDULA  4:CARGO  5:BÁSICO  6:TOTAL PROD  7:COMPL
                      8:DÍAS  9:OBSERVACIÓN  10:MOTIVO (←movido aquí)
                      11:SAL.BÁS.Q  12:PRODUCTIVIDAD  13:BASE COTIZ
                      14:SALUD  15:PENSIÓN  16:RETROACTIVO
                      17:SAL-DEDUCC  18:SUBS.TRANSP  19:NETO  20:FIRMA  21:DELETE */}
                  <tr style={{ background: PRIMARY, color: "#fff" }}>
                    {[
                      { h: "#",             w: "35px",  a: "center" },
                      { h: "NOMBRE",        w: "160px", a: "left" },
                      { h: "CÉDULA",        w: "110px", a: "left" },
                      { h: "CARGO",         w: "175px", a: "left",  tip: "Desde catálogo Administrar" },
                      { h: "BÁSICO MENS.",  w: "105px", a: "right", tip: "Auto desde cargo" },
                      { h: "TOTAL PROD. ▼", w: "115px", a: "right", tip: "Suma desde Matriz" },
                      { h: "COMPL.SMMLV",   w: "100px", a: "right", tip: "Empresa completa si prod < SMMLV" },
                      { h: "DÍAS",          w: "55px",  a: "center" },
                      { h: "OBSERVACIÓN",   w: "135px", a: "left" },
                      { h: "MOTIVO AST.",   w: "120px", a: "left",  tip: "Novedades del período" },
                      { h: "SAL.BÁS.Q.",   w: "100px", a: "right", tip: "=(Básico/30)×Días" },
                      { h: "PRODUCTIVIDAD", w: "100px", a: "right", tip: "=TotalProd − Sal.Básico" },
                      // ─ Horas extras (8 cols: 7 tipos + total) ─
                      { h: "HED 25%",    w: "80px", a: "right", tip: "H.Extra Diurna — factor 1.25 — (Básico/240)×horas×1.25", xe: "HED" },
                      { h: "HEN 75%",    w: "80px", a: "right", tip: "H.Extra Nocturna — factor 1.75", xe: "HEN" },
                      { h: "HRN 35%",    w: "80px", a: "right", tip: "Recargo Nocturno — factor 0.35", xe: "HRN" },
                      { h: "HRDF 75%",   w: "80px", a: "right", tip: "Recargo Dom/Fest — factor 0.75", xe: "HRDF" },
                      { h: "HRNDF 110%", w: "88px", a: "right", tip: "Rec. Noc. Dom/Fest — factor 1.10", xe: "HRNDF" },
                      { h: "HEDDF 100%", w: "88px", a: "right", tip: "H.Extra Diurna D/F — factor 2.00", xe: "HEDDF" },
                      { h: "HENDF 150%", w: "88px", a: "right", tip: "H.Extra Noc. D/F — factor 2.50", xe: "HENDF" },
                      { h: "TOTAL H.E.", w: "100px", a: "right", tip: "Total horas extras y recargos" },
                      // ──
                      { h: "RETROACTIVO",  w: "88px",  a: "right" },
                      { h: "BASE COTIZ.",  w: "105px", a: "right", tip: "=ProdEfectiva + Retro + H.Extras" },
                      { h: "SALUD 4%",     w: "88px",  a: "right", tip: "=Base×4%" },
                      { h: "PENSIÓN 4%",   w: "88px",  a: "right", tip: "=Base×4%" },
                      { h: "SAL−DEDUCC.", w: "110px", a: "right", tip: "=Base−Salud−Pensión" },
                      { h: "SUBS.TRANSP.", w: "108px", a: "right", tip: "=Días×(SubsidioMensual/30)" },
                      { h: "INC.REM.💊 66%",  w: "100px", a: "right", tip: "Empleador paga 66.67% salario diario × días IR" },
                      { h: "INC.REM.🏥 100%", w: "105px", a: "right", tip: "Empleador paga 100% salario diario × días IR-100 (primeros 2 días EG)" },
                      { h: "NETO A PAGAR", w: "118px", a: "right", tip: "=Sal.Ded+Subsidio+IR+IR100" },
                      { h: "ADELANTOS ↓",  w: "108px", a: "right", tip: "Adelantos pendientes (se descuentan del neto)" },
                      { h: "COMIDA ↓",     w: "100px", a: "right", tip: "Comida pendiente (se descuenta del neto)" },
                      { h: "NETO FINAL ✓", w: "120px", a: "right", tip: "= Neto a pagar − Adelantos (comida es solo informativa)" },
                      { h: "FIRMA",        w: "78px",  a: "left" },
                      { h: "",             w: "36px",  a: "center" },
                    ].map((col, ci) => (
                      <th key={ci} title={col.tip || ""} style={{
                        padding: "0.5rem 0.4rem", textAlign: col.a, fontWeight: "700",
                        whiteSpace: "nowrap", fontSize: "0.63rem", minWidth: col.w,
                        cursor: col.tip ? "help" : "default",
                        borderRight: "1px solid rgba(255,255,255,0.1)",
                        background: col.xe ? "#4c1d95" : PRIMARY,
                        boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
                      }}>
                        {col.h}{col.tip && <span style={{ marginLeft: "2px", opacity: 0.55 }}>ℹ</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filasFiltradas.map(e => (
                    <FilaNomina
                      key={e._key} fila={e} listaCargos={listaCargos}
                      onCambio={actualizarFila} onBlurCedula={buscarPorCedula}
                      onHoraExtra={actualizarHoraExtra}
                      onEliminar={() => eliminarFila(e._key)}
                    />
                  ))}

                  {/* Totales — 29 cols — solo si no hay filtro */}
                  {!hayFiltro && (
                    <tr style={{ background: "#f0fdf4", borderTop: `3px solid ${SUCCESS}` }}>
                      <td colSpan={4} style={{ padding: "0.85rem 0.5rem", color: "#065f46", fontWeight: "800", fontSize: "0.82rem" }}>
                        TOTALES — {filas.length} empleados
                      </td>
                      <td />{/* BÁSICO */}
                      <td style={tdTotal(SUCCESS)}>{formatCOP(totales.totalProduccion)}</td>
                      <td style={tdTotal(totales.complementoSalario > 0 ? WARN : "#94a3b8")}>{totales.complementoSalario > 0 ? formatCOP(totales.complementoSalario) : "—"}</td>
                      <td /><td /><td />{/* DIAS, OBS, MOTIVO */}
                      <td /><td />{/* SAL.BÁS, PROD */}
                      {/* 7 tipos de hora extra */}
                      {HORAS_EXTRAS_2026.map(t => (
                        <td key={t.codigo} style={{ padding: "0.85rem 0.3rem", textAlign: "right", background: "#ede9fe" }}>
                          <div style={{ fontFamily: "monospace", fontWeight: "800", color: "#6d28d9", fontSize: "0.75rem" }}>
                            {totalesPorTipoExtra[t.codigo]?.valor > 0 ? formatCOP(totalesPorTipoExtra[t.codigo].valor) : "—"}
                          </div>
                          {totalesPorTipoExtra[t.codigo]?.horas > 0 && (
                            <div style={{ fontSize: "0.62rem", color: "#7c3aed", opacity: 0.75 }}>
                              {totalesPorTipoExtra[t.codigo].horas}h
                            </div>
                          )}
                        </td>
                      ))}
                      {/* TOTAL H.E. */}
                      <td style={{ ...tdTotal("#7c3aed"), background: "#ede9fe" }}>
                        {totales.totalExtras > 0 ? formatCOP(totales.totalExtras) : "—"}
                      </td>
                      <td />{/* RETROACTIVO */}
                      <td />{/* BASE COTIZ */}
                      <td style={tdTotal(DANGER)}>{formatCOP(totales.salud)}</td>
                      <td style={tdTotal(DANGER)}>{formatCOP(totales.pension)}</td>
                      <td />{/* SAL-DEDUCC */}
                      <td style={tdTotal()}>{formatCOP(totales.subsidioTransporte)}</td>
                      <td style={{ padding: "0.85rem 0.5rem", textAlign: "right", fontFamily: "monospace", fontWeight: "800", color: "#0891b2", background: totales.valorIncapacidad > 0 ? "#e0f2fe" : "#f8fafc" }}>
                        {totales.valorIncapacidad > 0 ? formatCOP(totales.valorIncapacidad) : "—"}
                      </td>
                      <td style={{ padding: "0.85rem 0.5rem", textAlign: "right", fontFamily: "monospace", fontWeight: "800", color: "#047857", background: totales.valorIncapacidad100 > 0 ? "#d1fae5" : "#f8fafc" }}>
                        {totales.valorIncapacidad100 > 0 ? formatCOP(totales.valorIncapacidad100) : "—"}
                      </td>
                      <td style={{ padding: "0.85rem 0.5rem", textAlign: "right", fontWeight: "900", color: "#065f46", fontFamily: "monospace", fontSize: "0.92rem", background: "#dcfce7" }}>
                        {formatCOP(totales.netoAPagar)}
                      </td>
                      {/* ADELANTOS total */}
                      <td style={{ padding: "0.85rem 0.5rem", textAlign: "right", fontFamily: "monospace", fontWeight: "800", color: "#b91c1c", background: totales.adelantosDeducidos > 0 ? "#fef2f2" : "#f8fafc" }}>
                        {totales.adelantosDeducidos > 0 ? `−${formatCOP(totales.adelantosDeducidos)}` : "—"}
                      </td>
                      {/* COMIDA total */}
                      <td style={{ padding: "0.85rem 0.5rem", textAlign: "right", fontFamily: "monospace", fontWeight: "800", color: "#c2410c", background: totales.comidaDeducida > 0 ? "#fff7ed" : "#f8fafc" }}>
                        {totales.comidaDeducida > 0 ? `−${formatCOP(totales.comidaDeducida)}` : "—"}
                      </td>
                      {/* NETO FINAL total */}
                      <td style={{ padding: "0.85rem 0.5rem", textAlign: "right", fontWeight: "900", color: "#064e3b", fontFamily: "monospace", fontSize: "0.95rem", background: "#bbf7d0", borderLeft: "2.5px solid #10b981" }}>
                        {formatCOP(totales.netoFinal)}
                      </td>
                      <td colSpan={2} />{/* FIRMA + DELETE */}
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input[type="date"]::-webkit-calendar-picker-indicator { cursor: pointer; }
        /* Evitar scroll horizontal del body — la tabla scrollea dentro de su propio div */
        .main-content { overflow-x: clip; }
        @media print {
          .sidebar-desktop, .mobile-menu-btn, button { display: none !important; }
          .main-content { margin-left: 0 !important; overflow-x: visible !important; }
          #nomina-print { box-shadow: none !important; }
        }
      `}</style>
    </LayoutWithSidebar>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Fila individual de nómina — 21 columnas
// Orden: # | NOMBRE | CÉDULA | CARGO | BÁSICO | TOTAL PROD | COMPL |
//        DÍAS | OBSERVACIÓN | MOTIVO (←aquí) |
//        SAL.BÁS.Q | PRODUCTIVIDAD | BASE COTIZ | SALUD | PENSIÓN |
//        RETROACTIVO | SAL-DEDUCC | SUBS.TRANSP | NETO | FIRMA | DELETE
// ════════════════════════════════════════════════════════════════════════════
function FilaNomina({ fila, listaCargos, onCambio, onBlurCedula, onHoraExtra, onEliminar }) {
  const e  = fila;
  const cc = (campo, val) => onCambio(e._key, campo, val);
  const tieneComplemento = e.complementoSalario > 0;

  const tdEdit = { padding: "0.35rem 0.3rem", background: "#eff6ff" };
  const tdAuto = { padding: "0.35rem 0.3rem", background: "#fefce8" };
  const tdCalc = { padding: "0.35rem 0.3rem", background: "#f0fdf4" };
  const tdWarn = { padding: "0.35rem 0.3rem", background: tieneComplemento ? "#fff7ed" : "#f8fafc" };
  const tdNorm = { padding: "0.35rem 0.3rem" };

  return (
    <tr style={{ borderBottom: "1px solid #f1f5f9", background: tieneComplemento ? "#fffdf7" : "transparent" }}
      onMouseEnter={el => el.currentTarget.style.filter = "brightness(0.97)"}
      onMouseLeave={el => el.currentTarget.style.filter = "none"}>

      {/* Col 1: # */}
      <td style={{ ...tdNorm, textAlign: "center", color: "#94a3b8", fontSize: "0.72rem", fontWeight: "700" }}>{e.idx}</td>

      {/* Col 2: NOMBRE */}
      <td style={tdEdit}>
        <input value={e.nombre} onChange={ev => cc("nombre", ev.target.value)}
          placeholder="Nombre..." style={iS("155px")} />
      </td>

      {/* Col 3: CÉDULA */}
      <td style={tdEdit}>
        <input value={e.cedula} onChange={ev => cc("cedula", ev.target.value)}
          onBlur={ev => onBlurCedula(e._key, ev.target.value)}
          placeholder="Cédula..." style={iS("100px", { fontFamily: "monospace" })} />
      </td>

      {/* Col 4: CARGO */}
      <td style={tdAuto}>
        <select value={e.cargo} onChange={ev => cc("cargo", ev.target.value)}
          style={{ ...iS("168px"), background: "#fefce8" }}>
          <option value="">— Cargo —</option>
          {listaCargos.map(c => <option key={c.id || c.nombre} value={c.nombre}>{c.nombre}</option>)}
        </select>
      </td>

      {/* Col 5: BÁSICO MENSUAL */}
      <td style={tdAuto}>
        <input type="number" value={e.basicoMensual || ""} onChange={ev => cc("basicoMensual", parseFloat(ev.target.value) || 0)}
          placeholder="0" style={{ ...iS("95px", { textAlign: "right", fontFamily: "monospace" }), background: "#fefce8" }} />
      </td>

      {/* Col 6: TOTAL PRODUCCIÓN — tooltip con detalle de conceptos */}
      <td style={{ ...tdCalc, textAlign: "right", position: "relative" }}>
        <span
          title={e.detalleOps && e.detalleOps.length > 0
            ? e.detalleOps.map(op =>
                op.modoHE
                  ? `${op.fecha || "Sin fecha"} | ${op.servicio || "Servicio"} | ⏰ ${op.horasExtras ?? 1}h → ${formatCOP(op.valor)}`
                  : op.cantidad != null
                    ? `${op.fecha || "Sin fecha"} | ${op.servicio || "Servicio"} | Cant: ${op.cantidad} → ${formatCOP(op.valor)}`
                    : `${op.fecha || "Sin fecha"} | ${op.servicio || "Servicio"} → ${formatCOP(op.valor)}`
              ).join("\n") + `\n──────────\nTOTAL: ${formatCOP(e.totalProduccion)}`
            : "Sin operaciones en Matriz para este período"
          }
          style={{
            fontFamily: "monospace",
            color: e.totalProduccion > 0 ? "#059669" : "#94a3b8",
            fontWeight: "700", fontSize: "0.82rem",
            cursor: e.totalProduccion > 0 ? "help" : "default",
            borderBottom: e.totalProduccion > 0 ? "1.5px dashed #6ee7b7" : "none",
          }}
        >
          {e.totalProduccion > 0 ? formatCOP(e.totalProduccion) : "—"}
        </span>
        {e.detalleOps && e.detalleOps.length > 1 && (
          <div style={{ fontSize: "0.6rem", color: "#6b7280", marginTop: "1px" }}>
            {e.detalleOps.length} conceptos
          </div>
        )}
      </td>

      {/* Col 7: COMPLEMENTO SMMLV */}
      <td style={{ ...tdWarn, textAlign: "right" }}>
        {tieneComplemento ? (
          <span title={`Mínimo proporcional: ${formatCOP(e.minimoProporcionl)} | Prod: ${formatCOP(e.totalProduccion)}`}
            style={{ fontFamily: "monospace", color: "#92400e", fontWeight: "700", fontSize: "0.82rem", cursor: "help" }}>
            +{formatCOP(e.complementoSalario)}
          </span>
        ) : (
          <span style={{ color: "#cbd5e1", fontSize: "0.72rem" }}>—</span>
        )}
      </td>

      {/* Col 8: DÍAS */}
      <td style={tdEdit}>
        <input type="number" min="0" max="31" value={e.dias}
          onChange={ev => cc("dias", ev.target.value)}
          style={iS("50px", { textAlign: "center", fontWeight: "800" })} />
      </td>

      {/* Col 9: OBSERVACIÓN (editable) */}
      <td style={{ padding: "0.35rem 0.3rem", background: "#fafafa" }}>
        <input value={e.observacion || ""} onChange={ev => cc("observacion", ev.target.value)}
          placeholder="Observación..."
          style={{
            ...iS("130px"),
            background: e.observacion ? "#fffbeb" : "transparent",
            border: e.observacion ? "1px solid #fcd34d" : "1px solid #e2e8f0",
            color: "#374151", fontSize: "0.74rem",
          }} />
      </td>

      {/* Col 10: MOTIVO desde asistencia (ahora junto a OBSERVACIÓN) */}
      <td style={{ padding: "0.35rem 0.4rem", background: e.motivoResumen ? "#e0f2fe" : "#f8fafc" }}>
        {e.motivoResumen ? (
          <span title="Novedades del período (desde Asistencia)" style={{
            fontSize: "0.72rem", color: "#0369a1", fontWeight: "700",
            background: "#bae6fd", borderRadius: "4px", padding: "2px 6px",
            whiteSpace: "nowrap", display: "inline-block",
          }}>
            {e.motivoResumen}
          </span>
        ) : (
          <span style={{ color: "#cbd5e1", fontSize: "0.7rem" }}>—</span>
        )}
      </td>

      {/* Col 11: SAL. BÁSICO QUINCENA */}
      <td style={{ ...tdCalc, textAlign: "right", fontFamily: "monospace" }}>{formatCOP(e.salarioBasicoQuincena)}</td>

      {/* Col 12: PRODUCTIVIDAD */}
      <td style={{ ...tdCalc, textAlign: "right", fontFamily: "monospace", color: e.productividad < 0 ? "#ef4444" : e.productividad > 0 ? "#059669" : "#94a3b8" }}>
        {e.totalProduccion > 0 ? formatCOP(e.productividad) : "—"}
      </td>

      {/* Cols 13-19: 7 tipos de horas extras + total */}
      {HORAS_EXTRAS_2026.map(t => {
        const horas = e.horasExtras?.[t.codigo] || 0;
        const valor = e.desgloseExtras?.[t.codigo]?.valor || 0;
        return (
          <td key={t.codigo} style={{ padding: "0.25rem 0.3rem", background: t.bg, verticalAlign: "middle" }}>
            <input
              type="number" min="0" step="0.5"
              value={horas || ""}
              onChange={ev => onHoraExtra(e._key, t.codigo, ev.target.value)}
              placeholder="0"
              title={`${t.label} (${t.pct}) — Valor hora: ${formatCOP(Math.round((e.basicoMensual || 0) / 240 * t.factor))}`}
              style={{
                width: "52px", padding: "0.22rem 0.3rem",
                border: `1.5px solid ${horas > 0 ? t.color : "#e2e8f0"}`,
                borderRadius: "4px", fontSize: "0.74rem", textAlign: "center",
                fontWeight: horas > 0 ? "800" : "400",
                background: horas > 0 ? t.bg : "transparent",
                outline: "none", boxSizing: "border-box",
                color: t.color,
              }}
            />
            {valor > 0 && (
              <div style={{ fontSize: "0.62rem", color: t.color, fontFamily: "monospace", fontWeight: "700", textAlign: "right", marginTop: "1px" }}>
                {formatCOP(valor)}
              </div>
            )}
          </td>
        );
      })}
      {/* Col 20: TOTAL H.E. */}
      <td style={{ ...tdCalc, textAlign: "right", fontFamily: "monospace", background: "#ede9fe" }}>
        {(e.totalExtras || 0) > 0 ? (
          <span style={{ color: "#6d28d9", fontWeight: "800" }}>{formatCOP(e.totalExtras)}</span>
        ) : <span style={{ color: "#c4b5fd" }}>—</span>}
      </td>

      {/* Col 21: RETROACTIVO */}
      <td style={tdEdit}>
        <input type="number" min="0" value={e.retroactivo || ""} onChange={ev => cc("retroactivo", ev.target.value)}
          placeholder="0" style={iS("80px", { textAlign: "right", fontFamily: "monospace" })} />
      </td>

      {/* Col 22: BASE COTIZACIÓN */}
      <td style={{ ...tdCalc, textAlign: "right", fontFamily: "monospace" }}>
        {tieneComplemento ? (
          <span style={{ color: "#92400e", fontWeight: "700" }} title="Elevada al mínimo proporcional">
            {formatCOP(e.baseCotizacion)}
          </span>
        ) : formatCOP(e.baseCotizacion)}
      </td>

      {/* Col 23: SALUD */}
      <td style={{ ...tdCalc, textAlign: "right", fontFamily: "monospace", color: "#ef4444" }}>{formatCOP(e.salud)}</td>

      {/* Col 24: PENSIÓN */}
      <td style={{ ...tdCalc, textAlign: "right", fontFamily: "monospace", color: "#ef4444" }}>{formatCOP(e.pension)}</td>

      {/* Col 25: SAL - DEDUCC. */}
      <td style={{ ...tdCalc, textAlign: "right", fontFamily: "monospace" }}>{formatCOP(e.salarioMenosDeducciones)}</td>

      {/* Col 26: SUBSIDIO TRANSPORTE */}
      <td style={{ ...tdCalc, textAlign: "right", fontFamily: "monospace" }}>{formatCOP(e.subsidioTransporte)}</td>

      {/* Col 27: INCAPACIDAD REMUNERADA IR 66.67% */}
      <td style={{ padding: "0.35rem 0.5rem", textAlign: "right", background: e.valorIncapacidad > 0 ? "#e0f2fe" : "#f8fafc" }}>
        {e.valorIncapacidad > 0 ? (
          <div>
            <div style={{ fontFamily: "monospace", fontWeight: "800", color: "#0891b2", fontSize: "0.82rem" }}>
              {formatCOP(e.valorIncapacidad)}
            </div>
            <div style={{ fontSize: "0.62rem", color: "#0369a1" }}>
              💊 {e.diasIncapacidad}d × 66.67%
            </div>
          </div>
        ) : <span style={{ color: "#cbd5e1", fontSize: "0.7rem" }}>—</span>}
      </td>

      {/* Col 28: INCAPACIDAD REMUNERADA IR-100 100% (primeros 2 días EG) */}
      <td style={{ padding: "0.35rem 0.5rem", textAlign: "right", background: e.valorIncapacidad100 > 0 ? "#d1fae5" : "#f8fafc" }}>
        {e.valorIncapacidad100 > 0 ? (
          <div>
            <div style={{ fontFamily: "monospace", fontWeight: "800", color: "#047857", fontSize: "0.82rem" }}>
              {formatCOP(e.valorIncapacidad100)}
            </div>
            <div style={{ fontSize: "0.62rem", color: "#065f46" }}>
              🏥 {e.diasIncapacidad100}d × 100%
            </div>
          </div>
        ) : <span style={{ color: "#cbd5e1", fontSize: "0.7rem" }}>—</span>}
      </td>

      {/* NETO A PAGAR */}
      <td style={{ padding: "0.35rem 0.5rem", textAlign: "right", fontWeight: "900", color: "#065f46", fontFamily: "monospace", fontSize: "0.85rem", background: "#dcfce7", whiteSpace: "nowrap" }}>
        {formatCOP(e.netoAPagar)}
      </td>

      {/* ADELANTOS */}
      <td style={{ padding: "0.35rem 0.5rem", textAlign: "right", background: e.adelantosDeducidos > 0 ? "#fef2f2" : "#f8fafc" }}>
        {e.adelantosDeducidos > 0 ? (
          <span style={{ fontFamily:"monospace", fontWeight:"800", color:"#b91c1c", fontSize:"0.82rem" }}>
            −{formatCOP(e.adelantosDeducidos)}
          </span>
        ) : <span style={{ color:"#cbd5e1", fontSize:"0.7rem" }}>—</span>}
      </td>

      {/* COMIDA */}
      <td style={{ padding: "0.35rem 0.5rem", textAlign: "right", background: e.comidaDeducida > 0 ? "#fff7ed" : "#f8fafc" }}>
        {e.comidaDeducida > 0 ? (
          <span style={{ fontFamily:"monospace", fontWeight:"800", color:"#c2410c", fontSize:"0.82rem" }}>
            −{formatCOP(e.comidaDeducida)}
          </span>
        ) : <span style={{ color:"#cbd5e1", fontSize:"0.7rem" }}>—</span>}
      </td>

      {/* NETO FINAL */}
      <td style={{ padding: "0.35rem 0.5rem", textAlign: "right", fontWeight: "900", fontFamily: "monospace", fontSize: "0.88rem", background: (e.adelantosDeducidos > 0 || e.comidaDeducida > 0) ? "#bbf7d0" : "#f0fdf4", whiteSpace: "nowrap", color: "#064e3b", borderLeft: "2.5px solid #10b981" }}>
        {(e.adelantosDeducidos > 0 || e.comidaDeducida > 0)
          ? formatCOP(e.netoFinal)
          : <span style={{ color:"#94a3b8", fontWeight:"400", fontSize:"0.7rem" }}>=Neto</span>
        }
      </td>

      {/* FIRMA */}
      <td style={tdEdit}>
        <input value={e.firma || ""} onChange={ev => cc("firma", ev.target.value)}
          placeholder="Firma..." style={iS("72px")} />
      </td>

      {/* Col 29: ELIMINAR */}
      <td style={{ padding: "0.35rem 0.3rem", textAlign: "center" }}>
        <button onClick={onEliminar} title="Eliminar fila"
          style={{ background: "#fff1f2", border: "1px solid #fca5a5", borderRadius: "5px", padding: "0.25rem 0.35rem", cursor: "pointer", color: "#ef4444", lineHeight: 1 }}>
          <Trash2 size={12} />
        </button>
      </td>
    </tr>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────
function btnStyle(color, disabled = false, size = "md") {
  const sm = size === "sm";
  return {
    background: color, border: "none", borderRadius: "8px",
    padding: sm ? "0.45rem 0.8rem" : "0.72rem 1.1rem",
    color: "#fff", cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: "700", fontSize: sm ? "0.8rem" : "0.88rem",
    display: "flex", alignItems: "center", gap: "0.4rem",
    opacity: disabled ? 0.6 : 1, transition: "opacity 0.15s", whiteSpace: "nowrap",
  };
}

const cardStyle = {
  background: "#fff", borderRadius: "12px",
  padding: "1rem 1.25rem", boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
};

const dateInputStyle = {
  border: "1.5px solid #bfdbfe", borderRadius: "8px",
  padding: "0.4rem 0.6rem", fontSize: "0.88rem",
  fontWeight: "600", color: "#0B3D91", outline: "none",
  cursor: "pointer", background: "#eff6ff",
};

function thGrupo(color) {
  return {
    padding: "3px 4px", textAlign: "center", fontSize: "0.62rem",
    fontWeight: "700", color, borderRight: "1px solid #f1f5f9",
    background: "#e2e8f0", whiteSpace: "nowrap", overflow: "visible",
  };
}

function tdTotal(color) {
  return { padding: "0.85rem 0.5rem", textAlign: "right", fontFamily: "monospace", fontWeight: "800", color: color || "#374151", whiteSpace: "nowrap" };
}

function iS(width, extra = {}) {
  return {
    width, minWidth: width, padding: "0.28rem 0.4rem",
    border: "1px solid #bfdbfe", borderRadius: "5px",
    fontSize: "0.76rem", outline: "none",
    background: "transparent", boxSizing: "border-box", ...extra,
  };
}
