// pages/nomina/liquidar_unificada.js
// ════════════════════════════════════════════════════════════════════════════
// LIQUIDACIÓN UNIFICADA — todos los clientes en una sola nómina
//
// Diferencias vs liquidar.js:
//   1. Sin selector de cliente — carga TODOS los trabajadores de TODOS los clientes
//   2. Columna "Cliente" visible en la tabla
//   3. Celda de Producción es clicable → modal con detalle completo de cada operación
//      (cliente, servicio, fecha, cantidad, horas extras, tarifa, neto, etc.)
//   4. Documento guardado en nomina_periodos con id: unificada_{fi}_{ff}
// ════════════════════════════════════════════════════════════════════════════

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
  ArrowLeft, Save, RefreshCw, Calendar,
  Plus, Trash2, UserPlus, Search,
  X, ExternalLink, ChevronDown, Info,
  FileSpreadsheet, Upload, Filter,
} from "lucide-react";

// ── Constantes visuales ──────────────────────────────────────────────────────
const PRIMARY = "#0B3D91";
const SUCCESS = "#10b981";
const WARN    = "#f59e0b";
const DANGER  = "#ef4444";
const PURPLE  = "#8b5cf6";

const CLIENTES_BASE = [
  { id:"spia",     nombre:"SPIA",      color:"#0B3D91", emoji:"🏭" },
  { id:"cliente1", nombre:"Cliente 1", color:"#10b981", emoji:"🏢" },
  { id:"cliente2", nombre:"Cliente 2", color:"#8b5cf6", emoji:"🏗️" },
  { id:"cliente3", nombre:"Cliente 3", color:"#f59e0b", emoji:"🏭" },
];

const NOV_MAP = {
  "D":      { emoji:"😴", label:"Descanso" },
  "I":      { emoji:"❌", label:"Inasistencia" },
  "INC":    { emoji:"🏥", label:"Incapacidad" },
  "INC-EG": { emoji:"🤕", label:"Inc. Enf. General" },
  "INC-AT": { emoji:"🛡️", label:"Inc. Acc. Trabajo" },
  "IR":     { emoji:"💊", label:"Inc. Remunerada 66.67%" },
  "IR-100": { emoji:"🏥", label:"Inc. Remunerada 100%" },
  "S":      { emoji:"🚫", label:"Suspensión" },
  "L":      { emoji:"🖤", label:"Luto" },
  "PNR":    { emoji:"📋", label:"Permiso no remunerado" },
  "CAL":    { emoji:"🏠", label:"Calamidad doméstica" },
  "ADV":    { emoji:"⛪", label:"Adventista" },
  "B":      { emoji:"⛔", label:"Bloqueado muelle" },
};

// ── Helpers de fecha ─────────────────────────────────────────────────────────
function quincenaActual() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const dia = now.getDate();
  const diasMes = new Date(y, now.getMonth() + 1, 0).getDate();
  if (dia <= 15) return { fechaInicio: `${y}-${m}-01`, fechaFin: `${y}-${m}-15` };
  return { fechaInicio: `${y}-${m}-16`, fechaFin: `${y}-${m}-${String(diasMes).padStart(2,"0")}` };
}
function diasEntreFechas(fi, ff) {
  if (!fi || !ff) return 15;
  return Math.max(1, Math.round((new Date(ff+"T00:00:00") - new Date(fi+"T00:00:00")) / 86400000) + 1);
}
function labelPeriodo(fi, ff) {
  if (!fi || !ff) return "Sin período";
  const fmt = s => {
    const [y,mo,d] = s.split("-");
    const mes = ["","Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][+mo];
    return `${+d} ${mes} ${y}`;
  };
  return `${fmt(fi)} — ${fmt(ff)}`;
}
function getMonthsInPeriod(fi, ff) {
  const months = [];
  let curr = new Date(fi+"T00:00:00");
  const end  = new Date(ff+"T00:00:00");
  while (curr <= end) {
    months.push({ year: curr.getFullYear(), month: curr.getMonth()+1 });
    curr = new Date(curr.getFullYear(), curr.getMonth()+1, 1);
  }
  return months;
}

let _rowCounter = 0;
const HORAS_VACIAS = () => Object.fromEntries(HORAS_EXTRAS_2026.map(t => [t.codigo, 0]));
function deduplicar(arr) {
  const vistas = new Set();
  return arr.filter(f => {
    const cc = String(f.cedula||"").trim();
    if (!cc) return true;
    if (vistas.has(cc)) return false;
    vistas.add(cc); return true;
  });
}
function filaVacia(dias = 15) {
  return { _key:++_rowCounter, nombre:"", cedula:"", cargo:"", clienteId:"spia",
    basicoMensual:0, dias, retroactivo:0, horasExtras:HORAS_VACIAS(), firma:"", observacion:"" };
}

// ════════════════════════════════════════════════════════════════════════════
// MODAL DE DETALLE DE PRODUCCIÓN
// ════════════════════════════════════════════════════════════════════════════
function ModalDetalleProduccion({ trabajador, ops, clientes, onClose }) {
  if (!ops) return null;

  const clienteInfo = (cid) => clientes.find(c => c.id === cid) || { nombre: cid||"SPIA", color:"#0B3D91", emoji:"🏭" };

  // Agrupar ops por cliente
  const porCliente = {};
  ops.forEach(op => {
    const cid = op.clienteId || "spia";
    if (!porCliente[cid]) porCliente[cid] = { info: clienteInfo(cid), ops: [] };
    porCliente[cid].ops.push(op);
  });

  const total = ops.reduce((s, op) => s + (op.valor || 0), 0);

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position:"fixed", inset:0, background:"rgba(0,0,0,0.55)",
        zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center",
        padding:"1rem",
      }}
    >
      <div style={{
        background:"#fff", borderRadius:"16px", width:"100%", maxWidth:"780px",
        maxHeight:"90vh", display:"flex", flexDirection:"column",
        boxShadow:"0 20px 60px rgba(0,0,0,0.3)", overflow:"hidden",
      }}>
        {/* Header */}
        <div style={{
          background:`linear-gradient(135deg,${PRIMARY} 0%,#1a56c4 100%)`,
          padding:"1.1rem 1.5rem",
          display:"flex", alignItems:"center", justifyContent:"space-between",
        }}>
          <div>
            <div style={{color:"#fff", fontWeight:"800", fontSize:"1.05rem"}}>
              ⚙️ Detalle de Producción — {trabajador?.nombre || "Trabajador"}
            </div>
            <div style={{color:"rgba(255,255,255,0.75)", fontSize:"0.8rem", marginTop:"2px"}}>
              Cédula: {trabajador?.cedula} · {ops.length} operación{ops.length !== 1 ? "es" : ""} · Total:{" "}
              <strong style={{color:"#a5f3fc"}}>{formatCOP(total)}</strong>
            </div>
          </div>
          <button onClick={onClose}
            style={{background:"rgba(255,255,255,0.15)", border:"none", borderRadius:"8px",
              padding:"0.5rem", cursor:"pointer", color:"#fff", display:"flex"}}>
            <X size={18}/>
          </button>
        </div>

        {/* Body con scroll */}
        <div style={{overflowY:"auto", flex:1, padding:"1.25rem"}}>
          {Object.entries(porCliente).map(([cid, grupo]) => {
            const ci = grupo.info;
            const subtotal = grupo.ops.reduce((s, op) => s + (op.valor || 0), 0);
            return (
              <div key={cid} style={{marginBottom:"1.5rem"}}>
                {/* Encabezado de cliente */}
                <div style={{
                  display:"flex", alignItems:"center", justifyContent:"space-between",
                  background:`${ci.color}12`, border:`1.5px solid ${ci.color}40`,
                  borderRadius:"10px 10px 0 0", padding:"0.65rem 1rem",
                }}>
                  <div style={{display:"flex", alignItems:"center", gap:"0.5rem"}}>
                    <span style={{fontSize:"1.1rem"}}>{ci.emoji}</span>
                    <span style={{fontWeight:"800", color:ci.color, fontSize:"0.95rem"}}>{ci.nombre}</span>
                    <span style={{background:`${ci.color}20`, color:ci.color, borderRadius:"12px",
                      padding:"1px 8px", fontSize:"0.72rem", fontWeight:"700"}}>
                      {grupo.ops.length} reg.
                    </span>
                  </div>
                  <span style={{fontWeight:"900", color:ci.color, fontFamily:"monospace", fontSize:"0.95rem"}}>
                    {formatCOP(subtotal)}
                  </span>
                </div>

                {/* Tabla de operaciones */}
                <div style={{border:`1.5px solid ${ci.color}30`, borderTop:"none", borderRadius:"0 0 10px 10px", overflow:"hidden"}}>
                  <table style={{width:"100%", borderCollapse:"collapse", fontSize:"0.82rem"}}>
                    <thead>
                      <tr style={{background:`${ci.color}08`}}>
                        {["Fecha","Servicio / Labor","Detalle operación","Neto"].map(h => (
                          <th key={h} style={{
                            padding:"0.5rem 0.75rem", textAlign:"left",
                            fontSize:"0.72rem", fontWeight:"700", color:ci.color,
                            borderBottom:`1px solid ${ci.color}20`, whiteSpace:"nowrap",
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {grupo.ops.sort((a,b)=>(a.fecha||"").localeCompare(b.fecha||"")).map((op, i) => (
                        <tr key={i} style={{
                          borderBottom:"1px solid #f1f5f9",
                          background: i%2===0 ? "#fff" : "#fafafa",
                        }}>
                          {/* Fecha */}
                          <td style={{padding:"0.55rem 0.75rem", color:"#475569", fontWeight:"600", whiteSpace:"nowrap"}}>
                            {op.fecha || "—"}
                          </td>

                          {/* Servicio */}
                          <td style={{padding:"0.55rem 0.75rem", color:"#1e293b", fontWeight:"600", maxWidth:"180px"}}>
                            <div style={{overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}
                              title={op.servicio}>
                              {op.servicio || "—"}
                            </div>
                            {op.cuadrilla && (
                              <div style={{fontSize:"0.68rem", color:"#94a3b8", marginTop:"2px"}}>
                                👥 {op.cuadrilla}
                              </div>
                            )}
                          </td>

                          {/* Detalle */}
                          <td style={{padding:"0.55rem 0.75rem", color:"#64748b"}}>
                            <DetalleOperacion op={op} color={ci.color}/>
                          </td>

                          {/* Neto */}
                          <td style={{
                            padding:"0.55rem 0.75rem",
                            fontWeight:"900", color:SUCCESS,
                            fontFamily:"monospace", fontSize:"0.88rem",
                            textAlign:"right", whiteSpace:"nowrap",
                          }}>
                            {formatCOP(op.valor)}
                          </td>
                        </tr>
                      ))}
                      {/* Subtotal por cliente */}
                      <tr style={{background:`${ci.color}08`, borderTop:`2px solid ${ci.color}30`}}>
                        <td colSpan={3} style={{padding:"0.5rem 0.75rem", fontWeight:"700", color:ci.color, fontSize:"0.8rem"}}>
                          Subtotal {ci.nombre} ({grupo.ops.length} operaciones)
                        </td>
                        <td style={{padding:"0.5rem 0.75rem", fontWeight:"900", color:ci.color,
                          fontFamily:"monospace", fontSize:"0.9rem", textAlign:"right", whiteSpace:"nowrap"}}>
                          {formatCOP(subtotal)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer total */}
        <div style={{
          borderTop:"2px solid #e2e8f0", padding:"0.9rem 1.5rem",
          display:"flex", alignItems:"center", justifyContent:"space-between",
          background:"#f0fdf4",
        }}>
          <span style={{fontWeight:"700", color:"#065f46", fontSize:"0.9rem"}}>
            TOTAL PRODUCCIÓN — {ops.length} operaciones en {Object.keys(porCliente).length} cliente(s)
          </span>
          <span style={{fontWeight:"900", color:"#065f46", fontFamily:"monospace", fontSize:"1.15rem"}}>
            {formatCOP(total)}
          </span>
        </div>
      </div>
    </div>
  );
}

// Subcomponente: línea de detalle según tipo de operación
function DetalleOperacion({ op, color }) {
  if (op.modoHE) {
    // Horas extras individuales
    return (
      <div style={{display:"flex", flexDirection:"column", gap:"2px"}}>
        <span style={{background:"#fef3c7", color:"#92400e", borderRadius:"5px",
          padding:"1px 7px", fontSize:"0.72rem", fontWeight:"700", display:"inline-block"}}>
          ⏰ {op.horasExtras}h extras
        </span>
        {op.tarifa > 0 && (
          <span style={{fontSize:"0.68rem", color:"#94a3b8"}}>
            {formatCOP(op.tarifa)}/hr × {op.horasExtras}h
          </span>
        )}
      </div>
    );
  }
  if (op.modoCiamsa || op.cantidadTons != null) {
    // Destajo CIAMSA
    return (
      <div style={{display:"flex", flexDirection:"column", gap:"2px"}}>
        <span style={{background:`${color}15`, color:color, borderRadius:"5px",
          padding:"1px 7px", fontSize:"0.72rem", fontWeight:"700", display:"inline-block"}}>
          ⚖️ Destajo
        </span>
        {op.cantidadTons != null && (
          <span style={{fontSize:"0.68rem", color:"#94a3b8"}}>
            {op.cantidadTons} {op.unidad||"ton"} ÷ {op.nPersonas||1} pers. = {op.per?.toFixed?.(4)||"—"} {op.unidad||"ton"}/per
          </span>
        )}
        {op.tarifa > 0 && (
          <span style={{fontSize:"0.68rem", color:"#059669"}}>
            {formatCOP(op.tarifa)}/{op.unidad||"ton"}
          </span>
        )}
      </div>
    );
  }
  if (op.personas > 1 || op.cantidad > 0) {
    // Cuadrilla
    return (
      <div style={{display:"flex", flexDirection:"column", gap:"2px"}}>
        <span style={{background:"#eff6ff", color:PRIMARY, borderRadius:"5px",
          padding:"1px 7px", fontSize:"0.72rem", fontWeight:"700", display:"inline-block"}}>
          👥 Cuadrilla · {op.personas||"—"} pers.
        </span>
        {op.cantidad > 0 && (
          <span style={{fontSize:"0.68rem", color:"#94a3b8"}}>
            Cant: {op.cantidad} · Neto total: {formatCOP((op.valor||0)*(op.personas||1))}
          </span>
        )}
      </div>
    );
  }
  return <span style={{color:"#94a3b8", fontSize:"0.75rem"}}>—</span>;
}

// ════════════════════════════════════════════════════════════════════════════
export default function NominaLiquidarUnificada() {
  const router       = useRouter();
  const fileInputRef = useRef(null);
  const def          = quincenaActual();

  const [rol,            setRol]            = useState(null);
  const [fechaInicio,    setFechaInicio]    = useState(def.fechaInicio);
  const [fechaFin,       setFechaFin]       = useState(def.fechaFin);
  const [filas,          setFilas]          = useState([]);
  const [produccion,     setProduccion]     = useState({});
  const [listaCargos,    setListaCargos]    = useState([]);
  const [listaTrabaj,    setListaTrabaj]    = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [recalculando,   setRecalculando]   = useState(false);
  const [guardando,      setGuardando]      = useState(false);
  const [nominaGuardada, setNominaGuardada] = useState(null);
  const [infoMatriz,     setInfoMatriz]     = useState({ ops:0, trabajadores:0 });
  const [motivosMap,     setMotivosMap]     = useState({});
  const [adelantosMap,   setAdelantosMap]   = useState({});
  const [comidaMap,      setComidaMap]      = useState({});
  const [clientes,       setClientes]       = useState(CLIENTES_BASE);

  // Filtros tabla
  const [filtroNombre,   setFiltroNombre]   = useState("");
  const [filtroCedula,   setFiltroCedula]   = useState("");
  const [filtroCliente,  setFiltroCliente]  = useState("");  // filtro por clienteId

  // Modal detalle producción
  const [modalProd, setModalProd] = useState(null); // { nombre, cedula, ops }

  // qId único para esta modalidad
  const qId    = `unificada_${fechaInicio}_${fechaFin}`;
  const qLabel = `UNIFICADA · ${labelPeriodo(fechaInicio, fechaFin)}`;
  const diasDef = diasEntreFechas(fechaInicio, fechaFin);

  // Cargar nombres reales de clientes
  useEffect(() => {
    getDocs(collection(db,"nomina_clientes")).then(snap => {
      if (snap.empty) return;
      setClientes(CLIENTES_BASE.map(b => {
        const d = snap.docs.find(x => x.id === b.id);
        return d ? {...b, nombre: d.data().nombre || b.nombre} : b;
      }));
    }).catch(()=>{});
  }, []);

  // Auth
  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async user => {
      if (!user) { router.push("/login"); return; }
      const r = await getUserRoleByUid(user.uid);
      setRol(r);
      if (!["admin","admin_nomina","nomina"].includes(r)) { router.push("/nomina"); return; }
      await cargarCatalogos();
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!loading && fechaInicio && fechaFin && fechaFin >= fechaInicio) cargarPeriodo();
  }, [qId, loading]);

  // ── Cargar TODOS los trabajadores activos de todos los clientes ──────────
  const cargarCatalogos = async () => {
    const [cSnap, tSnap] = await Promise.all([
      getDocs(query(collection(db,"nomina_cargos"),       orderBy("nombre"))),
      getDocs(query(collection(db,"nomina_trabajadores"), orderBy("nombre"))),
    ]);
    setListaCargos(cSnap.docs.map(d => ({id:d.id,...d.data()})));
    const todos = tSnap.docs.map(d => ({id:d.id,...d.data()}));
    setListaTrabaj(todos.filter(t => t.activo !== false));
  };

  // ── Cargar período — SIN filtro por clienteId ────────────────────────────
  const cargarPeriodo = async () => {
    setRecalculando(true);
    try {
      const ini = Timestamp.fromDate(new Date(fechaInicio+"T00:00:00"));
      const fin = Timestamp.fromDate(new Date(fechaFin+"T23:59:59"));
      const opsSnap = await getDocs(query(
        collection(db,"nomina_operaciones"),
        where("fecha",">=",ini), where("fecha","<=",fin), orderBy("fecha"),
      ));

      const prod = {}; // { cedula: { total, ops: [{...}] } }
      let opsCount = 0;
      const trabajadoresSet = new Set();

      opsSnap.docs.forEach(d => {
        const op = d.data();
        opsCount++;
        const asisten    = op.trabajadoresAsisten || [];
        const fechaStr   = op.fecha?.toDate ? op.fecha.toDate().toISOString().split("T")[0] : "";
        const servNom    = op.servicioNombre || op.servicio || "";
        const clienteId  = op.clienteId || "spia";
        const modoHE     = op.modoHorasExtras || false;
        const hExtras    = op.horasExtras ?? null;
        const cantOp     = op.cantidad ?? null;
        const cuadrilla  = op.cuadrillaNombre || op.cuadrilla || "";
        // Destajo
        const cantTons   = op.cantidadTons ?? null;
        const nPersonas  = op.nPersonas ?? null;
        const per        = op.per ?? null;
        const tarifa     = op.tarifaUnitaria ?? op.servicioValorUnitario ?? null;
        const unidad     = op.unidad || null;
        const personas   = op.personas || asisten.length || 1;

        const opDetalle = {
          fecha: fechaStr, servicio: servNom, clienteId,
          modoHE, horasExtras: hExtras, cantidad: cantOp,
          cuadrilla, cantidadTons: cantTons, nPersonas, per,
          tarifa, unidad, personas,
          modoCiamsa: op.modoCiamsa || false,
        };

        if (asisten.length > 0) {
          const netoPorPersona = op.netoAPagar || 0;
          asisten.forEach(w => {
            const cc = String(w.cedula || w.id || "").trim();
            if (!cc) return;
            if (!prod[cc]) prod[cc] = { total:0, ops:[] };
            prod[cc].total += netoPorPersona;
            prod[cc].ops.push({...opDetalle, valor: netoPorPersona});
            trabajadoresSet.add(cc);
          });
        } else {
          const cc = String(op.trabajadorCedula || op.cedula || "").trim();
          if (!cc) return;
          if (!prod[cc]) prod[cc] = { total:0, ops:[] };
          const v = op.netoAPagar || 0;
          prod[cc].total += v;
          prod[cc].ops.push({...opDetalle, valor: v});
          trabajadoresSet.add(cc);
        }
      });

      setProduccion(prod);
      setInfoMatriz({ ops: opsCount, trabajadores: trabajadoresSet.size });

      // Motivos de asistencia
      try {
        const cuadSnap = await getDocs(collection(db,"nomina_asistencia"));
        const cuadIds  = cuadSnap.docs.map(d => d.id);
        const months   = getMonthsInPeriod(fechaInicio, fechaFin);
        const workerMap = {};
        listaTrabaj.forEach(t => { workerMap[t.id] = String(t.cedula||"").trim(); });
        const motivosAcc = {};
        for (const cId of cuadIds) {
          for (const {year, month} of months) {
            const regId = `${cId}_${year}_${String(month).padStart(2,"0")}`;
            try {
              const regSnap = await getDoc(doc(db,"nomina_asistencia_registro",regId));
              if (!regSnap.exists()) continue;
              const registro = regSnap.data().registro || {};
              for (const [dia, novsDia] of Object.entries(registro)) {
                const dNum  = parseInt(dia);
                const fecha = `${year}-${String(month).padStart(2,"0")}-${String(dNum).padStart(2,"0")}`;
                if (fecha < fechaInicio || fecha > fechaFin) continue;
                for (const [wId, codigo] of Object.entries(novsDia)) {
                  const ced = workerMap[wId];
                  if (!ced) continue;
                  if (!motivosAcc[ced]) motivosAcc[ced] = {};
                  motivosAcc[ced][codigo] = (motivosAcc[ced][codigo]||0) + 1;
                }
              }
            } catch(_) {}
          }
        }
        setMotivosMap(motivosAcc);
      } catch(e) { console.warn("Motivos:", e); }

      // Adelantos pendientes
      try {
        const adSnap = await getDocs(query(collection(db,"nomina_adelantos"), where("estado","==","pendiente")));
        const adMap = {};
        adSnap.docs.forEach(d => {
          const a = d.data();
          const cc = String(a.cedula||"").trim();
          if (cc) adMap[cc] = (adMap[cc]||0) + (a.monto||0);
        });
        setAdelantosMap(adMap);
      } catch(e) {}

      // Comida pendiente
      try {
        const comSnap = await getDocs(query(collection(db,"nomina_comida"), where("estado","==","pendiente")));
        const comMap = {};
        comSnap.docs.forEach(d => {
          const c = d.data();
          const cc = String(c.cedula||"").trim();
          if (cc) comMap[cc] = (comMap[cc]||0) + (c.total || (c.cantidad||1)*(c.valor||0));
        });
        setComidaMap(comMap);
      } catch(e) {}

      // Cargar nómina guardada si existe
      const nomDoc = await getDoc(doc(db,"nomina_periodos",qId));
      if (nomDoc.exists()) {
        const data = nomDoc.data();
        setNominaGuardada(data);
        setFilas(deduplicar((data.empleados||[]).map(e => ({
          _key:          ++_rowCounter,
          nombre:        e.nombre        || "",
          cedula:        String(e.cedula || ""),
          cargo:         e.cargo         || "",
          clienteId:     e.clienteId     || "spia",
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
    } catch(err) { console.error("Error cargarPeriodo:", err); }
    setRecalculando(false);
  };

  const agregarFila       = () => setFilas(p => [...p, filaVacia(diasDef)]);
  const eliminarFila      = key => setFilas(p => p.filter(f => f._key !== key));

  const actualizarFila = useCallback((key, campo, valor) => {
    setFilas(prev => prev.map(f => {
      if (f._key !== key) return f;
      const u = {...f, [campo]: valor};
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
      return {...f, horasExtras: {...(f.horasExtras||{}), [codigo]: parseFloat(valor)||0}};
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
      // Determinar clienteId principal del trabajador
      const cids = t.clienteIds || ["spia"];
      return {
        ...f,
        nombre:        f.nombre || t.nombre || "",
        cargo:         t.cargo  || f.cargo,
        clienteId:     cids[0] || "spia",
        basicoMensual: c?.basicoMensual || t.basicoMensual || f.basicoMensual || 0,
      };
    }));
  }, [listaTrabaj, listaCargos]);

  // Cargar TODOS los trabajadores en la tabla
  const cargarTodosTrabajadores = () => {
    const cedulasExistentes = new Set(filas.map(f => String(f.cedula||"").trim()).filter(Boolean));
    const nuevos = listaTrabaj.filter(t => !cedulasExistentes.has(String(t.cedula||"").trim()));
    if (filas.length > 0 && nuevos.length === 0) { alert("Todos ya están en la tabla."); return; }
    const fuente = filas.length === 0 ? listaTrabaj : nuevos;
    if (!confirm(`¿Agregar ${fuente.length} trabajador(es)?`)) return;
    setFilas(prev => deduplicar([...prev, ...fuente.map(t => {
      const c = listaCargos.find(c => c.nombre === t.cargo);
      const cids = t.clienteIds || ["spia"];
      return {
        _key: ++_rowCounter, nombre: t.nombre||"", cedula: String(t.cedula||""),
        cargo: t.cargo||"", clienteId: cids[0]||"spia",
        basicoMensual: c?.basicoMensual || t.basicoMensual || 0,
        dias: diasDef, retroactivo:0, horasExtras: HORAS_VACIAS(), firma:"", observacion:"",
      };
    })]));
  };

  // ── Calcular filas ───────────────────────────────────────────────────────
  const filasCalculadas = filas.map((f, i) => {
    const prodData         = produccion[String(f.cedula).trim()] || { total:0, ops:[] };
    const totalProduccion  = prodData.total;
    const { total: totalExtras, desglose: desgloseExtras } = calcularHorasExtras(
      f.basicoMensual || 0, f.horasExtras || {}
    );
    const mots = motivosMap[String(f.cedula).trim()] || {};
    const calc = calcularNominaEmpleado({
      basicoMensual:      f.basicoMensual || 0,
      totalProduccion,
      diasTrabajados:     parseInt(f.dias) || 0,
      retroactivo:        parseFloat(f.retroactivo) || 0,
      totalHorasExtras:   totalExtras,
      diasIncapacidad:    mots["IR"]     || 0,
      diasIncapacidad100: mots["IR-100"] || 0,
    });
    const motivoResumen = Object.entries(mots)
      .map(([cod, cnt]) => { const n=NOV_MAP[cod]; return (n?`${n.emoji} ${n.label}`:cod)+(cnt>1?` ×${cnt}`:""); })
      .join(", ");
    const adelantosDeducidos = adelantosMap[String(f.cedula).trim()] || 0;
    const comidaDeducida     = comidaMap[String(f.cedula).trim()]    || 0;
    const netoFinal          = Math.max(0, calc.netoAPagar - adelantosDeducidos);

    // Info de cliente del trabajador
    const clienteInfo = clientes.find(c => c.id === (f.clienteId||"spia")) || clientes[0];

    return {
      ...f, idx: i+1, totalProduccion, detalleOps: prodData.ops,
      totalExtras, desgloseExtras, ...calc, motivoResumen,
      adelantosDeducidos, comidaDeducida, netoFinal, clienteInfo,
    };
  });

  // Filtros
  const filasFiltradas = filasCalculadas.filter(f => {
    const okN  = !filtroNombre.trim()  || f.nombre?.toLowerCase().includes(filtroNombre.toLowerCase());
    const okC  = !filtroCedula.trim()  || String(f.cedula).includes(filtroCedula.trim());
    const okCl = !filtroCliente        || f.clienteId === filtroCliente;
    return okN && okC && okCl;
  });

  const totales = {
    totalProduccion:    filasCalculadas.reduce((s,e)=>s+e.totalProduccion,0),
    complementoSalario: filasCalculadas.reduce((s,e)=>s+e.complementoSalario,0),
    totalExtras:        filasCalculadas.reduce((s,e)=>s+(e.totalExtras||0),0),
    salud:              filasCalculadas.reduce((s,e)=>s+e.salud,0),
    pension:            filasCalculadas.reduce((s,e)=>s+e.pension,0),
    subsidioTransporte: filasCalculadas.reduce((s,e)=>s+e.subsidioTransporte,0),
    netoAPagar:         filasCalculadas.reduce((s,e)=>s+e.netoAPagar,0),
    adelantos:          filasCalculadas.reduce((s,e)=>s+(e.adelantosDeducidos||0),0),
    comida:             filasCalculadas.reduce((s,e)=>s+(e.comidaDeducida||0),0),
    netoFinal:          filasCalculadas.reduce((s,e)=>s+(e.netoFinal||0),0),
  };

  const guardarNomina = async () => {
    if (!fechaInicio||!fechaFin) { alert("Selecciona el período."); return; }
    if (filas.length === 0)      { alert("No hay filas para guardar."); return; }
    if (!confirm(`¿Guardar nómina unificada "${qLabel}"?`)) return;
    setGuardando(true);
    try {
      const empleadosData = filasCalculadas.map(e => ({
        cedula:e.cedula, nombre:e.nombre, cargo:e.cargo, clienteId:e.clienteId||"spia",
        basicoMensual:e.basicoMensual||0,
        totalProduccion:e.totalProduccion,
        diasTrabajados:parseInt(e.dias)||0,
        salarioBasicoQuincena:e.salarioBasicoQuincena,
        productividad:e.productividad,
        complementoSalario:e.complementoSalario,
        horasExtras:e.horasExtras||{},
        totalHorasExtras:e.totalExtras||0,
        baseCotizacion:e.baseCotizacion,
        salud:e.salud, pension:e.pension,
        salarioMenosDeducciones:e.salarioMenosDeducciones,
        subsidioTransporte:e.subsidioTransporte,
        retroactivo:parseFloat(e.retroactivo)||0,
        netoAPagar:e.netoAPagar,
        adelantosDeducidos:e.adelantosDeducidos||0,
        netoFinal:e.netoFinal||0,
        firma:e.firma||"", observacion:e.observacion||"", motivoResumen:e.motivoResumen||"",
      }));
      await setDoc(doc(db,"nomina_periodos",qId), {
        quincenaId:qId, nombre:qLabel, fechaInicio, fechaFin,
        tipo:"unificada",
        empleados:empleadosData,
        totalGeneral:totales.netoAPagar,
        totalProduccion:totales.totalProduccion,
        cantidadEmpleados:empleadosData.length,
        estado:"borrador",
        actualizadoEn:new Date(),
      });
      setNominaGuardada({ nombre:qLabel });
      alert("✅ Nómina unificada guardada correctamente.");
    } catch(err) { alert("Error al guardar: "+err.message); }
    setGuardando(false);
  };

  if (loading) return (
    <LayoutWithSidebar>
      <div style={{textAlign:"center",padding:"4rem",color:PRIMARY}}>
        <RefreshCw size={32} style={{animation:"spin 1s linear infinite"}}/>
        <div style={{marginTop:"1rem",fontWeight:"600"}}>Cargando nómina unificada...</div>
      </div>
    </LayoutWithSidebar>
  );

  return (
    <LayoutWithSidebar>
      <div style={{maxWidth:"1600px",margin:"0 auto",padding:"0 0 4rem"}}>

        {/* ── HEADER ── */}
        <div style={{display:"flex",alignItems:"center",gap:"1rem",marginBottom:"1rem",flexWrap:"wrap"}}>
          <button onClick={()=>router.push("/nomina")} style={{background:"none",border:"none",cursor:"pointer",color:PRIMARY}}>
            <ArrowLeft size={22}/>
          </button>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:"0.75rem",flexWrap:"wrap"}}>
              <h1 style={{margin:0,color:PRIMARY,fontSize:"1.5rem",fontWeight:"800"}}>
                🗂️ Liquidación Unificada
              </h1>
              <span style={{background:"#eff6ff",color:PRIMARY,border:"1.5px solid #bfdbfe",
                borderRadius:"20px",padding:"3px 12px",fontSize:"0.75rem",fontWeight:"700"}}>
                VERSIÓN PARALELA · Todos los clientes
              </span>
              {nominaGuardada && (
                <span style={{background:"#f0fdf4",color:SUCCESS,border:"1.5px solid #86efac",
                  borderRadius:"20px",padding:"3px 12px",fontSize:"0.75rem",fontWeight:"700"}}>
                  ✅ Guardada
                </span>
              )}
            </div>
            <p style={{margin:"2px 0 0",color:"#64748b",fontSize:"0.82rem"}}>
              Una sola nómina con trabajadores de todos los clientes · Producción detallada por operación
            </p>
          </div>
        </div>

        {/* Aviso informativo */}
        <div style={{
          background:"#fffbeb", border:"1.5px solid #fcd34d", borderRadius:"12px",
          padding:"0.75rem 1.1rem", marginBottom:"1.25rem", fontSize:"0.82rem",
          color:"#92400e", display:"flex", alignItems:"flex-start", gap:"0.6rem",
        }}>
          <Info size={16} style={{marginTop:"1px", flexShrink:0}}/>
          <div>
            <strong>Página de comparación:</strong> Esta es la versión unificada donde todos los clientes comparten una sola nómina.
            La columna <strong>⚙️ Producción</strong> es clicable — muestra el detalle completo de cada operación.
            La nómina original por cliente sigue disponible en <strong>Liquidar Nómina</strong>.
          </div>
        </div>

        {/* ── PERÍODO + STATS ── */}
        <div style={{display:"flex",gap:"1rem",marginBottom:"1.25rem",flexWrap:"wrap",alignItems:"center"}}>
          {/* Selector de período */}
          <div style={{display:"flex",alignItems:"center",gap:"0.75rem",background:"#fff",
            border:`1.5px solid ${PRIMARY}30`,borderRadius:"12px",padding:"0.65rem 1.1rem",
            boxShadow:"0 2px 8px rgba(11,61,145,0.07)"}}>
            <Calendar size={16} color={PRIMARY}/>
            {[{label:"Desde",val:fechaInicio,set:setFechaInicio},{label:"Hasta",val:fechaFin,set:setFechaFin}].map((f,i)=>(
              <div key={i}>
                <div style={{fontSize:"0.65rem",color:"#94a3b8",fontWeight:"700",textTransform:"uppercase"}}>{f.label}</div>
                <input type="date" value={f.val} onChange={e=>f.set(e.target.value)}
                  style={{border:"none",outline:"none",fontSize:"0.9rem",fontWeight:"700",color:PRIMARY,background:"transparent",cursor:"pointer"}}/>
              </div>
            ))}
            <button onClick={cargarPeriodo} title="Recargar"
              style={{background:`${PRIMARY}10`,border:"none",borderRadius:"8px",padding:"0.35rem 0.5rem",cursor:"pointer",color:PRIMARY}}>
              <RefreshCw size={14} style={{animation:recalculando?"spin 1s linear infinite":"none"}}/>
            </button>
          </div>

          {/* Stats */}
          {[
            {label:"Trabajadores",val:filas.length,color:PRIMARY},
            {label:"Ops. Matriz",val:infoMatriz.ops,color:"#8b5cf6"},
            {label:"Con producción",val:infoMatriz.trabajadores,color:SUCCESS},
            {label:"Total neto",val:formatCOP(totales.netoAPagar),color:"#0891b2"},
          ].map((s,i)=>(
            <div key={i} style={{background:"#fff",borderRadius:"10px",padding:"0.6rem 1rem",
              boxShadow:"0 2px 8px rgba(0,0,0,0.05)",borderLeft:`3px solid ${s.color}`,minWidth:"120px"}}>
              <div style={{fontWeight:"800",color:s.color,fontSize:i===3?"0.85rem":"1.1rem"}}>{s.val}</div>
              <div style={{color:"#94a3b8",fontSize:"0.7rem"}}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── TOOLBAR ── */}
        <div style={{display:"flex",gap:"0.6rem",marginBottom:"1rem",flexWrap:"wrap",alignItems:"center"}}>
          {/* Filtros */}
          <div style={{position:"relative"}}>
            <Search size={13} style={{position:"absolute",left:"0.55rem",top:"50%",transform:"translateY(-50%)",color:"#94a3b8"}}/>
            <input value={filtroNombre} onChange={e=>setFiltroNombre(e.target.value)} placeholder="Filtrar nombre..."
              style={{border:"1.5px solid #e2e8f0",borderRadius:"8px",padding:"0.45rem 0.75rem 0.45rem 2rem",fontSize:"0.83rem",outline:"none",width:"170px"}}/>
          </div>
          <div style={{position:"relative"}}>
            <Search size={13} style={{position:"absolute",left:"0.55rem",top:"50%",transform:"translateY(-50%)",color:"#94a3b8"}}/>
            <input value={filtroCedula} onChange={e=>setFiltroCedula(e.target.value)} placeholder="Filtrar cédula..."
              style={{border:"1.5px solid #e2e8f0",borderRadius:"8px",padding:"0.45rem 0.75rem 0.45rem 2rem",fontSize:"0.83rem",outline:"none",width:"140px"}}/>
          </div>
          {/* Filtro cliente */}
          <select value={filtroCliente} onChange={e=>setFiltroCliente(e.target.value)}
            style={{border:"1.5px solid #e2e8f0",borderRadius:"8px",padding:"0.45rem 0.75rem",fontSize:"0.83rem",outline:"none",background:"#fff"}}>
            <option value="">🏢 Todos los clientes</option>
            {clientes.map(c=><option key={c.id} value={c.id}>{c.emoji} {c.nombre}</option>)}
          </select>
          {(filtroNombre||filtroCedula||filtroCliente) && (
            <button onClick={()=>{setFiltroNombre("");setFiltroCedula("");setFiltroCliente("");}}
              style={{background:"#f1f5f9",border:"none",borderRadius:"8px",padding:"0.45rem 0.75rem",cursor:"pointer",color:"#64748b",fontSize:"0.82rem",fontWeight:"600",display:"flex",alignItems:"center",gap:"0.3rem"}}>
              <X size={12}/> Limpiar
            </button>
          )}

          <div style={{flex:1}}/>

          {/* Acciones */}
          <button onClick={cargarTodosTrabajadores}
            style={{background:PRIMARY,border:"none",borderRadius:"8px",padding:"0.5rem 0.9rem",cursor:"pointer",color:"#fff",fontWeight:"700",fontSize:"0.83rem",display:"flex",alignItems:"center",gap:"0.4rem"}}>
            <UserPlus size={14}/> Cargar todos
          </button>
          <button onClick={agregarFila}
            style={{background:"#10b981",border:"none",borderRadius:"8px",padding:"0.5rem 0.9rem",cursor:"pointer",color:"#fff",fontWeight:"700",fontSize:"0.83rem",display:"flex",alignItems:"center",gap:"0.4rem"}}>
            <Plus size={14}/> Agregar fila
          </button>
          <button onClick={guardarNomina} disabled={guardando||filas.length===0}
            style={{background:(guardando||filas.length===0)?"#94a3b8":SUCCESS,border:"none",borderRadius:"8px",padding:"0.5rem 1.1rem",cursor:"pointer",color:"#fff",fontWeight:"800",fontSize:"0.88rem",display:"flex",alignItems:"center",gap:"0.4rem"}}>
            <Save size={15}/>{guardando?"Guardando...":"💾 Guardar nómina"}
          </button>
        </div>

        {/* ── TABLA PRINCIPAL ── */}
        <div style={{background:"#fff",borderRadius:"14px",boxShadow:"0 2px 12px rgba(0,0,0,0.07)",overflow:"hidden"}}>
          {recalculando ? (
            <div style={{textAlign:"center",padding:"3rem",color:"#94a3b8"}}>
              <RefreshCw size={28} style={{animation:"spin 1s linear infinite",display:"block",margin:"0 auto 0.5rem"}}/>
              <div>Calculando nómina...</div>
            </div>
          ) : (
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:"0.8rem"}}>
                <thead>
                  {/* Fila de grupos */}
                  <tr style={{background:"#1e3a5f"}}>
                    <th colSpan={5} style={thGrp("#bfdbfe")}>IDENTIFICACIÓN</th>
                    <th colSpan={3} style={thGrp("#a7f3d0")}>PRODUCCIÓN</th>
                    <th colSpan={2} style={thGrp("#fde68a")}>DEDUCCIONES</th>
                    <th colSpan={2} style={thGrp("#c7d2fe")}>NETO</th>
                    <th style={thGrp("#94a3b8")}>ACC.</th>
                  </tr>
                  {/* Fila de columnas */}
                  <tr style={{background:PRIMARY}}>
                    {[
                      "#","Cliente","Nombre","Cédula","Cargo / Días",
                      "⚙️ Producción","Complemento","H. Extras",
                      "Salud","Pensión",
                      "Neto bruto","Neto final ✓",
                      "🗑️",
                    ].map(h => (
                      <th key={h} style={{
                        padding:"0.55rem 0.5rem",textAlign:"center",
                        fontSize:"0.72rem",fontWeight:"700",color:"#fff",
                        whiteSpace:"nowrap",borderRight:"1px solid rgba(255,255,255,0.1)",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filasFiltradas.length === 0 ? (
                    <tr><td colSpan={13} style={{textAlign:"center",padding:"3.5rem",color:"#94a3b8"}}>
                      <div style={{fontSize:"2.5rem",marginBottom:"0.75rem"}}>🗂️</div>
                      <div style={{fontWeight:"600",marginBottom:"0.5rem"}}>
                        {filas.length === 0
                          ? "Sin trabajadores — usa \"Cargar todos\" o \"Agregar fila\""
                          : "Sin resultados para los filtros aplicados"}
                      </div>
                    </td></tr>
                  ) : filasFiltradas.map((f, i) => {
                    const ci = f.clienteInfo || clientes[0];
                    const hasProd = f.totalProduccion > 0;
                    const opsCount = f.detalleOps?.length || 0;
                    return (
                      <tr key={f._key}
                        style={{borderBottom:"1px solid #f1f5f9",background:i%2===0?"#fff":"#f8fafc"}}
                        onMouseEnter={e=>e.currentTarget.style.background="#f0f9ff"}
                        onMouseLeave={e=>e.currentTarget.style.background=i%2===0?"#fff":"#f8fafc"}>

                        {/* # */}
                        <td style={td}><span style={{color:"#cbd5e1",fontSize:"0.72rem"}}>{f.idx}</span></td>

                        {/* Cliente badge */}
                        <td style={{...td,textAlign:"center"}}>
                          <span style={{
                            background:`${ci.color}15`, color:ci.color,
                            border:`1px solid ${ci.color}40`,
                            borderRadius:"8px", padding:"2px 7px",
                            fontSize:"0.7rem", fontWeight:"700", whiteSpace:"nowrap",
                          }}>
                            {ci.emoji} {ci.nombre}
                          </span>
                        </td>

                        {/* Nombre */}
                        <td style={{...td,minWidth:"160px"}}>
                          <input value={f.nombre} onChange={e=>actualizarFila(f._key,"nombre",e.target.value)}
                            style={iS("150px")} placeholder="Nombre"/>
                        </td>

                        {/* Cédula */}
                        <td style={td}>
                          <input value={f.cedula}
                            onChange={e=>actualizarFila(f._key,"cedula",e.target.value)}
                            onBlur={e=>buscarPorCedula(f._key,e.target.value)}
                            style={iS("105px",{fontFamily:"monospace"})} placeholder="Cédula"/>
                        </td>

                        {/* Cargo / Días */}
                        <td style={td}>
                          <div style={{display:"flex",flexDirection:"column",gap:"3px"}}>
                            <input value={f.cargo} onChange={e=>actualizarFila(f._key,"cargo",e.target.value)}
                              style={iS("130px")} placeholder="Cargo" list={`cargos_${f._key}`}/>
                            <datalist id={`cargos_${f._key}`}>
                              {listaCargos.map(c=><option key={c.id} value={c.nombre}/>)}
                            </datalist>
                            <div style={{display:"flex",gap:"3px",alignItems:"center"}}>
                              <span style={{fontSize:"0.67rem",color:"#94a3b8"}}>Días:</span>
                              <input type="number" value={f.dias} min="1" max="31"
                                onChange={e=>actualizarFila(f._key,"dias",parseInt(e.target.value)||0)}
                                style={iS("44px",{textAlign:"center"})}/>
                            </div>
                          </div>
                        </td>

                        {/* ⚙️ Producción — CLICABLE */}
                        <td style={{...td,textAlign:"right"}}>
                          <button
                            onClick={() => setModalProd({
                              nombre: f.nombre, cedula: f.cedula, ops: f.detalleOps || [],
                            })}
                            style={{
                              display:"inline-flex", alignItems:"center", gap:"0.35rem",
                              background: hasProd ? "#f0fdf4" : "#f8fafc",
                              border:`1.5px solid ${hasProd ? "#86efac" : "#e2e8f0"}`,
                              borderRadius:"8px", padding:"0.35rem 0.65rem",
                              cursor:"pointer", transition:"all 0.15s",
                            }}
                            title={opsCount > 0 ? `Ver ${opsCount} operación(es)` : "Sin operaciones"}
                          >
                            <span style={{fontWeight:"900",color:hasProd?SUCCESS:"#94a3b8",
                              fontFamily:"monospace",fontSize:"0.83rem"}}>
                              {formatCOP(f.totalProduccion)}
                            </span>
                            {opsCount > 0 && (
                              <span style={{background:SUCCESS+"20",color:SUCCESS,
                                borderRadius:"10px",padding:"0px 5px",fontSize:"0.65rem",fontWeight:"800"}}>
                                {opsCount}
                              </span>
                            )}
                          </button>
                          {f.motivoResumen && (
                            <div style={{fontSize:"0.65rem",color:DANGER,marginTop:"2px",maxWidth:"120px",
                              overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={f.motivoResumen}>
                              {f.motivoResumen}
                            </div>
                          )}
                        </td>

                        {/* Complemento */}
                        <td style={{...td,textAlign:"right"}}>
                          {f.complementoSalario > 0 ? (
                            <span style={{color:WARN,fontWeight:"700",fontFamily:"monospace",fontSize:"0.8rem"}}>
                              {formatCOP(f.complementoSalario)}
                            </span>
                          ) : <span style={{color:"#cbd5e1",fontSize:"0.72rem"}}>—</span>}
                        </td>

                        {/* Horas extras total */}
                        <td style={{...td,textAlign:"right"}}>
                          <span style={{fontFamily:"monospace",fontSize:"0.8rem",color:f.totalExtras>0?"#92400e":"#cbd5e1"}}>
                            {f.totalExtras > 0 ? formatCOP(f.totalExtras) : "—"}
                          </span>
                        </td>

                        {/* Salud */}
                        <td style={{...td,textAlign:"right"}}>
                          <span style={{fontFamily:"monospace",fontSize:"0.8rem",color:DANGER}}>
                            -{formatCOP(f.salud)}
                          </span>
                        </td>

                        {/* Pensión */}
                        <td style={{...td,textAlign:"right"}}>
                          <span style={{fontFamily:"monospace",fontSize:"0.8rem",color:DANGER}}>
                            -{formatCOP(f.pension)}
                          </span>
                        </td>

                        {/* Neto bruto */}
                        <td style={{...td,textAlign:"right"}}>
                          <span style={{fontWeight:"700",color:"#374151",fontFamily:"monospace",fontSize:"0.85rem"}}>
                            {formatCOP(f.netoAPagar)}
                          </span>
                        </td>

                        {/* Neto final (- adelantos) */}
                        <td style={{...td,textAlign:"right",background:"#f0fdf4"}}>
                          <div>
                            <span style={{fontWeight:"900",color:SUCCESS,fontFamily:"monospace",fontSize:"0.9rem"}}>
                              {formatCOP(f.netoFinal)}
                            </span>
                            {f.adelantosDeducidos > 0 && (
                              <div style={{fontSize:"0.65rem",color:DANGER}}>
                                -{formatCOP(f.adelantosDeducidos)} adel.
                              </div>
                            )}
                            {f.comidaDeducida > 0 && (
                              <div style={{fontSize:"0.65rem",color:WARN}}>
                                🍽️ {formatCOP(f.comidaDeducida)}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Eliminar */}
                        <td style={td}>
                          <button onClick={()=>eliminarFila(f._key)}
                            style={{background:"#fff1f2",border:"none",borderRadius:"6px",padding:"0.3rem 0.45rem",
                              cursor:"pointer",color:DANGER,display:"flex"}}>
                            <Trash2 size={13}/>
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {/* FILA DE TOTALES */}
                  {filasFiltradas.length > 0 && (
                    <tr style={{background:"#f0fdf4",borderTop:`3px solid ${SUCCESS}`}}>
                      <td colSpan={5} style={{padding:"0.85rem",fontWeight:"800",color:"#065f46",fontSize:"0.88rem"}}>
                        TOTALES — {filasFiltradas.length} trabajadores
                        {filtroCliente && ` · ${clientes.find(c=>c.id===filtroCliente)?.nombre||filtroCliente}`}
                      </td>
                      <td style={tdT(SUCCESS)}>{formatCOP(totales.totalProduccion)}</td>
                      <td style={tdT(WARN)}>{totales.complementoSalario>0?formatCOP(totales.complementoSalario):"—"}</td>
                      <td style={tdT("#92400e")}>{totales.totalExtras>0?formatCOP(totales.totalExtras):"—"}</td>
                      <td style={tdT(DANGER)}>-{formatCOP(totales.salud)}</td>
                      <td style={tdT(DANGER)}>-{formatCOP(totales.pension)}</td>
                      <td style={tdT("#374151")}>{formatCOP(totales.netoAPagar)}</td>
                      <td style={{...tdT(SUCCESS),background:"#dcfce7",fontSize:"1rem",fontWeight:"900"}}>
                        {formatCOP(totales.netoFinal)}
                      </td>
                      <td/>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── MODAL DETALLE PRODUCCIÓN ── */}
      {modalProd && (
        <ModalDetalleProduccion
          trabajador={modalProd}
          ops={modalProd.ops}
          clientes={clientes}
          onClose={() => setModalProd(null)}
        />
      )}

      <style jsx global>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
    </LayoutWithSidebar>
  );
}

// ── Estilos helpers ──────────────────────────────────────────────────────────
function thGrp(color) {
  return {
    padding:"4px 6px", textAlign:"center", fontSize:"0.65rem",
    fontWeight:"700", color, borderRight:"1px solid rgba(255,255,255,0.15)",
    letterSpacing:"0.05em", textTransform:"uppercase",
  };
}
const td = { padding:"0.5rem 0.4rem", verticalAlign:"middle" };
function tdT(color) {
  return { padding:"0.85rem 0.6rem", textAlign:"right", fontFamily:"monospace",
    fontWeight:"800", color, whiteSpace:"nowrap" };
}
function iS(width, extra={}) {
  return {
    width, padding:"0.28rem 0.4rem",
    border:"1px solid #bfdbfe", borderRadius:"5px",
    fontSize:"0.76rem", outline:"none",
    background:"transparent", boxSizing:"border-box", ...extra,
  };
}
