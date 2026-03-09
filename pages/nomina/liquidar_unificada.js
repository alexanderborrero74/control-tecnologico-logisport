// pages/nomina/liquidar_unificada.js
// ════════════════════════════════════════════════════════════════════════════
// LIQUIDACIÓN UNIFICADA — todos los clientes en una sola nómina
//
// Columnas IDÉNTICAS a liquidar.js + columna extra "CLIENTE" tras el #
// La celda de Producción es clicable → ModalDetalleProduccion
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
  X, Info, Filter,
} from "lucide-react";

// ── Constantes visuales ──────────────────────────────────────────────────────
const PRIMARY = "#0B3D91";
const ACCENT  = "#00AEEF";
const SUCCESS = "#10b981";
const WARN    = "#f59e0b";
const DANGER  = "#ef4444";

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
  const porCliente = {};
  ops.forEach(op => {
    const cid = op.clienteId || "spia";
    if (!porCliente[cid]) porCliente[cid] = { info: clienteInfo(cid), ops: [] };
    porCliente[cid].ops.push(op);
  });
  const total = ops.reduce((s, op) => s + (op.valor || 0), 0);
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:9999,
        display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem" }}>
      <div style={{ background:"#fff",borderRadius:"16px",width:"100%",maxWidth:"780px",
        maxHeight:"90vh",display:"flex",flexDirection:"column",
        boxShadow:"0 20px 60px rgba(0,0,0,0.3)",overflow:"hidden" }}>
        <div style={{ background:`linear-gradient(135deg,${PRIMARY} 0%,#1a56c4 100%)`,
          padding:"1.1rem 1.5rem",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
          <div>
            <div style={{color:"#fff",fontWeight:"800",fontSize:"1.05rem"}}>
              ⚙️ Detalle de Producción — {trabajador?.nombre || "Trabajador"}
            </div>
            <div style={{color:"rgba(255,255,255,0.75)",fontSize:"0.8rem",marginTop:"2px"}}>
              Cédula: {trabajador?.cedula} · {ops.length} operación{ops.length!==1?"es":""} · Total:{" "}
              <strong style={{color:"#a5f3fc"}}>{formatCOP(total)}</strong>
            </div>
          </div>
          <button onClick={onClose}
            style={{background:"rgba(255,255,255,0.15)",border:"none",borderRadius:"8px",
              padding:"0.5rem",cursor:"pointer",color:"#fff",display:"flex"}}>
            <X size={18}/>
          </button>
        </div>
        <div style={{overflowY:"auto",flex:1,padding:"1.25rem"}}>
          {Object.entries(porCliente).map(([cid, grupo]) => {
            const ci = grupo.info;
            const subtotal = grupo.ops.reduce((s,op) => s+(op.valor||0), 0);
            return (
              <div key={cid} style={{marginBottom:"1.5rem"}}>
                <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",
                  background:`${ci.color}12`,border:`1.5px solid ${ci.color}40`,
                  borderRadius:"10px 10px 0 0",padding:"0.65rem 1rem" }}>
                  <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
                    <span style={{fontSize:"1.1rem"}}>{ci.emoji}</span>
                    <span style={{fontWeight:"800",color:ci.color,fontSize:"0.95rem"}}>{ci.nombre}</span>
                    <span style={{background:`${ci.color}20`,color:ci.color,borderRadius:"12px",
                      padding:"1px 8px",fontSize:"0.72rem",fontWeight:"700"}}>
                      {grupo.ops.length} reg.
                    </span>
                  </div>
                  <span style={{fontWeight:"900",color:ci.color,fontFamily:"monospace",fontSize:"0.95rem"}}>
                    {formatCOP(subtotal)}
                  </span>
                </div>
                <div style={{border:`1.5px solid ${ci.color}30`,borderTop:"none",borderRadius:"0 0 10px 10px",overflow:"hidden"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:"0.82rem"}}>
                    <thead>
                      <tr style={{background:`${ci.color}08`}}>
                        {["Fecha","Servicio / Labor","Detalle operación","Neto"].map(h => (
                          <th key={h} style={{padding:"0.5rem 0.75rem",textAlign:"left",fontSize:"0.72rem",
                            fontWeight:"700",color:ci.color,borderBottom:`1px solid ${ci.color}20`,whiteSpace:"nowrap"}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {grupo.ops.sort((a,b)=>(a.fecha||"").localeCompare(b.fecha||"")).map((op, i) => (
                        <tr key={i} style={{borderBottom:"1px solid #f1f5f9",background:i%2===0?"#fff":"#fafafa"}}>
                          <td style={{padding:"0.55rem 0.75rem",color:"#475569",fontWeight:"600",whiteSpace:"nowrap"}}>
                            {op.fecha || "—"}
                          </td>
                          <td style={{padding:"0.55rem 0.75rem",color:"#1e293b",fontWeight:"600",maxWidth:"180px"}}>
                            <div style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={op.servicio}>
                              {op.servicio || "—"}
                            </div>
                            {op.cuadrilla && (
                              <div style={{fontSize:"0.68rem",color:"#94a3b8",marginTop:"2px"}}>👥 {op.cuadrilla}</div>
                            )}
                          </td>
                          <td style={{padding:"0.55rem 0.75rem",color:"#64748b"}}>
                            <DetalleOperacion op={op} color={ci.color}/>
                          </td>
                          <td style={{padding:"0.55rem 0.75rem",fontWeight:"900",color:SUCCESS,
                            fontFamily:"monospace",fontSize:"0.88rem",textAlign:"right",whiteSpace:"nowrap"}}>
                            {formatCOP(op.valor)}
                          </td>
                        </tr>
                      ))}
                      <tr style={{background:`${ci.color}08`,borderTop:`2px solid ${ci.color}30`}}>
                        <td colSpan={3} style={{padding:"0.5rem 0.75rem",fontWeight:"700",color:ci.color,fontSize:"0.8rem"}}>
                          Subtotal {ci.nombre} ({grupo.ops.length} operaciones)
                        </td>
                        <td style={{padding:"0.5rem 0.75rem",fontWeight:"900",color:ci.color,
                          fontFamily:"monospace",fontSize:"0.9rem",textAlign:"right",whiteSpace:"nowrap"}}>
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
        <div style={{borderTop:"2px solid #e2e8f0",padding:"0.9rem 1.5rem",
          display:"flex",alignItems:"center",justifyContent:"space-between",background:"#f0fdf4"}}>
          <span style={{fontWeight:"700",color:"#065f46",fontSize:"0.9rem"}}>
            TOTAL PRODUCCIÓN — {ops.length} operaciones en {Object.keys(porCliente).length} cliente(s)
          </span>
          <span style={{fontWeight:"900",color:"#065f46",fontFamily:"monospace",fontSize:"1.15rem"}}>
            {formatCOP(total)}
          </span>
        </div>
      </div>
    </div>
  );
}

function DetalleOperacion({ op, color }) {
  if (op.modoHE) return (
    <div style={{display:"flex",flexDirection:"column",gap:"2px"}}>
      <span style={{background:"#fef3c7",color:"#92400e",borderRadius:"5px",
        padding:"1px 7px",fontSize:"0.72rem",fontWeight:"700",display:"inline-block"}}>
        ⏰ {op.horasExtras}h extras
      </span>
      {op.tarifa > 0 && <span style={{fontSize:"0.68rem",color:"#94a3b8"}}>{formatCOP(op.tarifa)}/hr × {op.horasExtras}h</span>}
    </div>
  );
  if (op.modoCiamsa || op.cantidadTons != null) return (
    <div style={{display:"flex",flexDirection:"column",gap:"2px"}}>
      <span style={{background:`${color}15`,color,borderRadius:"5px",
        padding:"1px 7px",fontSize:"0.72rem",fontWeight:"700",display:"inline-block"}}>⚖️ Destajo</span>
      {op.cantidadTons != null && (
        <span style={{fontSize:"0.68rem",color:"#94a3b8"}}>
          {op.cantidadTons} {op.unidad||"ton"} ÷ {op.nPersonas||1} pers.
        </span>
      )}
    </div>
  );
  if (op.personas > 1 || op.cantidad > 0) return (
    <div style={{display:"flex",flexDirection:"column",gap:"2px"}}>
      <span style={{background:"#eff6ff",color:PRIMARY,borderRadius:"5px",
        padding:"1px 7px",fontSize:"0.72rem",fontWeight:"700",display:"inline-block"}}>
        👥 Cuadrilla · {op.personas||"—"} pers.
      </span>
      {op.cantidad > 0 && (
        <span style={{fontSize:"0.68rem",color:"#94a3b8"}}>Cant: {op.cantidad}</span>
      )}
    </div>
  );
  return <span style={{color:"#94a3b8",fontSize:"0.75rem"}}>—</span>;
}

// ════════════════════════════════════════════════════════════════════════════
export default function NominaLiquidarUnificada() {
  const router       = useRouter();
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
  const [filtroCliente,  setFiltroCliente]  = useState("");

  // Modal detalle producción
  const [modalProd, setModalProd] = useState(null);

  const qId    = `unificada_${fechaInicio}_${fechaFin}`;
  const qLabel = `UNIFICADA · ${labelPeriodo(fechaInicio, fechaFin)}`;
  const diasDef = diasEntreFechas(fechaInicio, fechaFin);
  const periodoValido = fechaInicio && fechaFin && fechaFin >= fechaInicio;

  useEffect(() => {
    getDocs(collection(db,"nomina_clientes")).then(snap => {
      if (snap.empty) return;
      setClientes(CLIENTES_BASE.map(b => {
        const d = snap.docs.find(x => x.id === b.id);
        return d ? {...b, nombre: d.data().nombre || b.nombre} : b;
      }));
    }).catch(()=>{});
  }, []);

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
    if (!loading && periodoValido) cargarPeriodo();
  }, [qId, loading]);

  const cargarCatalogos = async () => {
    const [cSnap, tSnap] = await Promise.all([
      getDocs(query(collection(db,"nomina_cargos"),       orderBy("nombre"))),
      getDocs(query(collection(db,"nomina_trabajadores"), orderBy("nombre"))),
    ]);
    setListaCargos(cSnap.docs.map(d => ({id:d.id,...d.data()})));
    const todos = tSnap.docs.map(d => ({id:d.id,...d.data()}));
    setListaTrabaj(todos.filter(t => t.activo !== false));
  };

  const cargarPeriodo = async () => {
    setRecalculando(true);
    try {
      const ini = Timestamp.fromDate(new Date(fechaInicio+"T00:00:00"));
      const fin = Timestamp.fromDate(new Date(fechaFin+"T23:59:59"));
      const opsSnap = await getDocs(query(
        collection(db,"nomina_operaciones"),
        where("fecha",">=",ini), where("fecha","<=",fin), orderBy("fecha"),
      ));

      const prod = {};
      let opsCount = 0;
      const trabajadoresSet = new Set();

      opsSnap.docs.forEach(d => {
        const op = d.data();
        opsCount++;
        const asisten   = op.trabajadoresAsisten || [];
        const fechaStr  = op.fecha?.toDate ? op.fecha.toDate().toISOString().split("T")[0] : "";
        const servNom   = op.servicioNombre || op.servicio || "";
        const clienteId = op.clienteId || "spia";
        const modoHE    = op.modoHorasExtras || false;
        const hExtras   = op.horasExtras ?? null;
        const cantOp    = op.cantidad ?? null;
        const cuadrilla = op.cuadrillaNombre || op.cuadrilla || "";
        const cantTons  = op.cantidadTons ?? null;
        const nPersonas = op.nPersonas ?? null;
        const per       = op.per ?? null;
        const tarifa    = op.tarifaUnitaria ?? op.servicioValorUnitario ?? null;
        const unidad    = op.unidad || null;
        const personas  = op.personas || asisten.length || 1;

        const opDetalle = {
          fecha: fechaStr, servicio: servNom, clienteId,
          modoHE, horasExtras: hExtras, cantidad: cantOp,
          cuadrilla, cantidadTons: cantTons, nPersonas, per,
          tarifa, unidad, personas, modoCiamsa: op.modoCiamsa || false,
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
      } catch(e) {}

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

  const agregarFila  = () => setFilas(p => [...p, filaVacia(diasDef)]);
  const eliminarFila = key => setFilas(p => p.filter(f => f._key !== key));

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
      .map(([cod, cnt]) => {
        const n = NOV_MAP[cod];
        const label = n ? `${n.emoji} ${n.label}` : cod;
        return cnt > 1 ? `${label} ×${cnt}` : label;
      }).join(", ");
    const adelantosDeducidos = adelantosMap[String(f.cedula).trim()] || 0;
    const comidaDeducida     = comidaMap[String(f.cedula).trim()]    || 0;
    const netoFinal          = Math.max(0, calc.netoAPagar - adelantosDeducidos);
    const clienteInfo        = clientes.find(c => c.id === (f.clienteId||"spia")) || clientes[0];
    return {
      ...f, idx: i+1, totalProduccion, detalleOps: prodData.ops,
      totalExtras, desgloseExtras, ...calc, motivoResumen,
      adelantosDeducidos, comidaDeducida, netoFinal, clienteInfo,
    };
  });

  const hayFiltro = filtroNombre.trim() || filtroCedula.trim() || filtroCliente;
  const filasFiltradas = filasCalculadas.filter(f => {
    const okN  = !filtroNombre.trim() || f.nombre?.toLowerCase().includes(filtroNombre.toLowerCase());
    const okC  = !filtroCedula.trim() || String(f.cedula).includes(filtroCedula.trim());
    const okCl = !filtroCliente       || f.clienteId === filtroCliente;
    return okN && okC && okCl;
  });
  const limpiarFiltros = () => { setFiltroNombre(""); setFiltroCedula(""); setFiltroCliente(""); };

  const totalesPorTipoExtra = HORAS_EXTRAS_2026.reduce((acc, t) => {
    acc[t.codigo] = {
      horas: filasCalculadas.reduce((s, e) => s + (e.horasExtras?.[t.codigo] || 0), 0),
      valor: filasCalculadas.reduce((s, e) => s + (e.desgloseExtras?.[t.codigo]?.valor || 0), 0),
    };
    return acc;
  }, {});

  const totales = {
    totalProduccion:     filasCalculadas.reduce((s,e)=>s+e.totalProduccion,0),
    complementoSalario:  filasCalculadas.reduce((s,e)=>s+e.complementoSalario,0),
    totalExtras:         filasCalculadas.reduce((s,e)=>s+(e.totalExtras||0),0),
    salud:               filasCalculadas.reduce((s,e)=>s+e.salud,0),
    pension:             filasCalculadas.reduce((s,e)=>s+e.pension,0),
    subsidioTransporte:  filasCalculadas.reduce((s,e)=>s+e.subsidioTransporte,0),
    salarioMenosDeducciones: filasCalculadas.reduce((s,e)=>s+e.salarioMenosDeducciones,0),
    valorIncapacidad:    filasCalculadas.reduce((s,e)=>s+(e.valorIncapacidad||0),0),
    valorIncapacidad100: filasCalculadas.reduce((s,e)=>s+(e.valorIncapacidad100||0),0),
    netoAPagar:          filasCalculadas.reduce((s,e)=>s+e.netoAPagar,0),
    adelantos:           filasCalculadas.reduce((s,e)=>s+(e.adelantosDeducidos||0),0),
    comida:              filasCalculadas.reduce((s,e)=>s+(e.comidaDeducida||0),0),
    netoFinal:           filasCalculadas.reduce((s,e)=>s+(e.netoFinal||0),0),
  };
  const conComplemento = filasCalculadas.filter(e => e.complementoSalario > 0).length;

  const guardarNomina = async () => {
    if (!periodoValido)        { alert("Selecciona el período."); return; }
    if (filas.length === 0)    { alert("No hay filas para guardar."); return; }
    if (!confirm(`¿Guardar nómina unificada "${qLabel}"?`)) return;
    setGuardando(true);
    try {
      const empleadosData = filasCalculadas.map(e => ({
        cedula: e.cedula, nombre: e.nombre, cargo: e.cargo, clienteId: e.clienteId||"spia",
        basicoMensual:           e.basicoMensual||0,
        totalProduccion:         e.totalProduccion,
        diasTrabajados:          parseInt(e.dias)||0,
        salarioBasicoQuincena:   e.salarioBasicoQuincena,
        productividad:           e.productividad,
        complementoSalario:      e.complementoSalario,
        produccionEfectiva:      e.produccionEfectiva,
        horasExtras:             e.horasExtras||{},
        totalHorasExtras:        e.totalExtras||0,
        baseCotizacion:          e.baseCotizacion,
        salud:                   e.salud, pension: e.pension,
        salarioMenosDeducciones: e.salarioMenosDeducciones,
        subsidioTransporte:      e.subsidioTransporte,
        diasIncapacidad:         e.diasIncapacidad||0,
        valorIncapacidad:        e.valorIncapacidad||0,
        valorIncapacidad100:     e.valorIncapacidad100||0,
        retroactivo:             parseFloat(e.retroactivo)||0,
        netoAPagar:              e.netoAPagar,
        adelantosDeducidos:      e.adelantosDeducidos||0,
        netoFinal:               e.netoFinal||0,
        firma: e.firma||"", observacion: e.observacion||"", motivoResumen: e.motivoResumen||"",
      }));
      await setDoc(doc(db,"nomina_periodos",qId), {
        quincenaId:qId, nombre:qLabel, fechaInicio, fechaFin, tipo:"unificada",
        empleados:empleadosData,
        totalGeneral:totales.netoAPagar,
        totalProduccion:totales.totalProduccion,
        cantidadEmpleados:empleadosData.length,
        estado:"borrador", actualizadoEn:new Date(),
      });
      setNominaGuardada({ nombre:qLabel });
      alert(`✅ Nómina unificada guardada — ${empleadosData.length} empleados.`);
    } catch(err) { alert("Error al guardar: "+err.message); }
    setGuardando(false);
  };

  if (loading) return (
    <LayoutWithSidebar>
      <div style={{textAlign:"center",padding:"4rem",color:PRIMARY}}>
        <div style={{fontSize:"2rem"}}>🗂️ Cargando nómina unificada...</div>
      </div>
    </LayoutWithSidebar>
  );

  return (
    <LayoutWithSidebar>
      <div style={{width:"100%"}}>

        {/* ── HEADER ── */}
        <div style={{display:"flex",alignItems:"center",gap:"1rem",marginBottom:"1.25rem",flexWrap:"wrap"}}>
          <button onClick={()=>router.push("/nomina")}
            style={{background:"none",border:"none",cursor:"pointer",color:PRIMARY}}>
            <ArrowLeft size={22}/>
          </button>
          <div style={{flex:1, minWidth:"200px"}}>
            <h1 style={{margin:0,color:PRIMARY,fontSize:"1.6rem",fontWeight:"800"}}>
              🗂️ Liquidación Unificada
            </h1>
            <p style={{margin:0,color:"#64748b",fontSize:"0.9rem"}}>
              {nominaGuardada
                ? `✅ Guardada — ${filas.length} empleados`
                : filas.length > 0 ? `🆕 Nueva — ${filas.length} filas` : "🆕 Nueva liquidación"}
              {" · Todos los clientes en una sola nómina"}
            </p>
          </div>
          <div style={{display:"flex",gap:"0.6rem",flexWrap:"wrap"}}>
            <button onClick={cargarTodosTrabajadores} style={btnStyle("#8b5cf6",false,"sm")}>
              <UserPlus size={14}/> Cargar todos
            </button>
            <button onClick={agregarFila} style={btnStyle(ACCENT,false,"sm")}>
              <Plus size={14}/> Agregar fila
            </button>
            <button onClick={guardarNomina} disabled={guardando||filas.length===0}
              style={btnStyle(PRIMARY, guardando||filas.length===0)}>
              <Save size={16}/>{guardando?"Guardando...":"Guardar Nómina"}
            </button>
          </div>
        </div>

        {/* Aviso informativo */}
        <div style={{background:"#fffbeb",border:"1.5px solid #fcd34d",borderRadius:"12px",
          padding:"0.65rem 1rem",marginBottom:"1.25rem",fontSize:"0.82rem",
          color:"#92400e",display:"flex",alignItems:"flex-start",gap:"0.6rem"}}>
          <Info size={16} style={{marginTop:"1px",flexShrink:0}}/>
          <div>
            <strong>Página de comparación:</strong> Todos los clientes en una sola nómina.
            La columna <strong>TOTAL PROD. ▼</strong> es clicable — muestra el detalle completo por operación y cliente.
            La nómina original por cliente sigue disponible en <strong>Liquidar Nómina</strong>.
          </div>
        </div>

        {/* ── PERÍODO + STATS ── */}
        <div style={{display:"grid",gridTemplateColumns:"auto 1fr 1fr 1fr 1fr",gap:"1rem",marginBottom:"1.5rem",alignItems:"stretch"}}>
          <div style={{...cardStyle, minWidth:"320px"}}>
            <div style={{fontSize:"0.72rem",color:"#64748b",fontWeight:"700",marginBottom:"0.6rem",display:"flex",alignItems:"center",gap:"0.4rem"}}>
              <Calendar size={14} color={PRIMARY}/> PERÍODO DE LIQUIDACIÓN
            </div>
            <div style={{display:"flex",gap:"0.75rem",alignItems:"center",flexWrap:"wrap"}}>
              {[
                {label:"DESDE", val:fechaInicio, max:fechaFin, set:setFechaInicio},
                {label:"HASTA", val:fechaFin, min:fechaInicio, set:setFechaFin},
              ].map((f,i)=>(
                <div key={i}>
                  <div style={{fontSize:"0.68rem",color:"#94a3b8",marginBottom:"2px"}}>{f.label}</div>
                  <input type="date" value={f.val} max={f.max} min={f.min}
                    onChange={e=>f.set(e.target.value)} style={dateInputStyle}/>
                </div>
              ))}
              <button onClick={cargarPeriodo} disabled={recalculando||!periodoValido}
                style={{background:periodoValido?PRIMARY:"#e2e8f0",border:"none",borderRadius:"8px",
                  padding:"0.45rem 0.7rem",cursor:periodoValido?"pointer":"not-allowed",marginTop:"14px",
                  color:"#fff",fontWeight:"700",fontSize:"0.78rem",display:"flex",alignItems:"center",gap:"0.3rem"}}>
                <RefreshCw size={14} style={{animation:recalculando?"spin 1s linear infinite":"none"}}/>
                {recalculando?"...":"Buscar"}
              </button>
            </div>
            {periodoValido && (
              <div style={{marginTop:"0.6rem",padding:"0.35rem 0.6rem",
                background:nominaGuardada?"#f0fdf4":"#eff6ff",borderRadius:"6px",
                fontSize:"0.78rem",fontWeight:"700",
                color:nominaGuardada?"#059669":PRIMARY,
                border:`1px solid ${nominaGuardada?"#86efac":"#bfdbfe"}`}}>
                {nominaGuardada?"✅":"📋"} {qLabel}
                {nominaGuardada&&<span style={{fontWeight:"400",color:"#64748b"}}> — guardada</span>}
                <span style={{marginLeft:"0.5rem",color:"#94a3b8",fontWeight:"400"}}>({diasDef} días)</span>
              </div>
            )}
          </div>
          {[
            { label:"Empleados",         value:filas.length,                          color:"#3b82f6", icon:"👷" },
            { label:`Producción (${infoMatriz.ops} ops)`, value:formatCOP(totales.totalProduccion), color:SUCCESS, icon:"📋" },
            { label:conComplemento>0?`Complemento SMMLV (${conComplemento})`:"Salud + Pensión",
              value:conComplemento>0?formatCOP(totales.complementoSalario):formatCOP(totales.salud+totales.pension),
              color:conComplemento>0?WARN:"#f59e0b", icon:conComplemento>0?"⚠️":"🏥" },
            { label:"NETO A PAGAR", value:formatCOP(totales.netoAPagar), color:PRIMARY, icon:"💰" },
          ].map((s,i)=>(
            <div key={i} style={{...cardStyle, borderLeft:`4px solid ${s.color}`}}>
              <div style={{fontSize:"1.3rem",marginBottom:"0.1rem"}}>{s.icon}</div>
              <div style={{fontWeight:"800",color:s.color,fontSize:i===3?"0.98rem":"1.05rem"}}>{s.value}</div>
              <div style={{color:"#64748b",fontSize:"0.73rem"}}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── STICKY HEADER con filtros ── */}
        <div style={{background:"#fff",borderRadius:"12px 12px 0 0",
          boxShadow:"0 4px 16px rgba(11,61,145,0.12)",position:"sticky",top:0,zIndex:50}}>

          <div style={{padding:"0.75rem 1.5rem",borderBottom:"1px solid #e2e8f0",
            display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"0.5rem"}}>
            <div>
              <h2 style={{margin:0,color:PRIMARY,fontWeight:"800",fontSize:"1rem"}}>
                NÓMINA UNIFICADA — {qLabel}
              </h2>
              <p style={{margin:0,color:"#64748b",fontSize:"0.78rem"}}>
                LOGISPORT S.A.S. · Todos los clientes · {new Date().toLocaleDateString("es-CO")} · {filas.length} empleados
              </p>
            </div>
            <div style={{fontSize:"0.75rem",color:"#64748b",textAlign:"right"}}>
              Salud / Pensión: <strong>4%</strong> &nbsp;|&nbsp;
              Subsidio transp.: <strong>{formatCOP(SUBSIDIO_TRANSPORTE_MENSUAL)}/mes</strong> &nbsp;|&nbsp;
              SMMLV: <strong>{formatCOP(SMMLV)}</strong>
            </div>
          </div>

          {/* Filtros */}
          <div style={{padding:"0.6rem 1.25rem",display:"flex",flexDirection:"column",gap:"0.5rem",
            background:"#ffffff",boxShadow:"0 4px 20px rgba(11,61,145,0.18)",borderBottom:"2.5px solid #bfdbfe"}}>

            <div style={{display:"flex",gap:"0.5rem",alignItems:"center",flexWrap:"wrap"}}>
              <span style={{fontSize:"0.72rem",color:"#94a3b8",fontWeight:"700",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:"0.25rem"}}>
                <Search size={12}/> FILTRAR:
              </span>
              {/* Nombre */}
              <div style={{position:"relative"}}>
                <Search size={13} style={{position:"absolute",left:"0.6rem",top:"50%",transform:"translateY(-50%)",color:"#94a3b8",pointerEvents:"none"}}/>
                <input value={filtroNombre} onChange={e=>setFiltroNombre(e.target.value)} placeholder="Nombre..."
                  style={{border:`1.5px solid ${filtroNombre?PRIMARY:"#e2e8f0"}`,borderRadius:"8px",
                    padding:"0.38rem 1.6rem 0.38rem 2rem",fontSize:"0.82rem",outline:"none",
                    background:filtroNombre?"#eff6ff":"#f8fafc",width:"160px",color:"#1e293b"}}/>
                {filtroNombre&&<button onClick={()=>setFiltroNombre("")}
                  style={{position:"absolute",right:"0.4rem",top:"50%",transform:"translateY(-50%)",
                    background:"none",border:"none",cursor:"pointer",color:"#94a3b8",fontSize:"1rem",lineHeight:1,padding:0}}>×</button>}
              </div>
              {/* Cédula */}
              <div style={{position:"relative"}}>
                <Filter size={13} style={{position:"absolute",left:"0.6rem",top:"50%",transform:"translateY(-50%)",color:"#94a3b8",pointerEvents:"none"}}/>
                <input value={filtroCedula} onChange={e=>setFiltroCedula(e.target.value)} placeholder="Cédula..."
                  inputMode="numeric"
                  style={{border:`1.5px solid ${filtroCedula?"#8b5cf6":"#e2e8f0"}`,borderRadius:"8px",
                    padding:"0.38rem 1.6rem 0.38rem 2rem",fontSize:"0.82rem",outline:"none",fontFamily:"monospace",
                    background:filtroCedula?"#f5f3ff":"#f8fafc",width:"140px",color:"#1e293b"}}/>
                {filtroCedula&&<button onClick={()=>setFiltroCedula("")}
                  style={{position:"absolute",right:"0.4rem",top:"50%",transform:"translateY(-50%)",
                    background:"none",border:"none",cursor:"pointer",color:"#94a3b8",fontSize:"1rem",lineHeight:1,padding:0}}>×</button>}
              </div>
              {/* Cliente */}
              <select value={filtroCliente} onChange={e=>setFiltroCliente(e.target.value)}
                style={{border:`1.5px solid ${filtroCliente?"#f59e0b":"#e2e8f0"}`,borderRadius:"8px",
                  padding:"0.38rem 0.9rem",fontSize:"0.82rem",outline:"none",
                  background:filtroCliente?"#fffbeb":"#f8fafc",cursor:"pointer",height:"34px",minWidth:"160px"}}>
                <option value="">🏢 Todos los clientes</option>
                {clientes.map(c=><option key={c.id} value={c.id}>{c.emoji} {c.nombre}</option>)}
              </select>
              {hayFiltro&&(
                <div style={{display:"flex",alignItems:"center",gap:"0.35rem"}}>
                  <span style={{fontSize:"0.78rem",color:"#64748b",fontWeight:"700",background:"#f1f5f9",
                    padding:"0.25rem 0.6rem",borderRadius:"20px",whiteSpace:"nowrap"}}>
                    {filasFiltradas.length} / {filas.length}
                  </span>
                  <button onClick={limpiarFiltros}
                    style={{background:"#f1f5f9",border:"none",borderRadius:"6px",padding:"0.28rem 0.55rem",
                      cursor:"pointer",color:"#64748b",fontSize:"0.75rem",fontWeight:"700"}}>
                    ✕ Limpiar
                  </button>
                </div>
              )}
            </div>

            <div style={{display:"flex",gap:"0.5rem",alignItems:"center",flexWrap:"wrap"}}>
              <button onClick={agregarFila} style={btnStyle(ACCENT,false,"sm")}>
                <Plus size={14}/> Agregar fila
              </button>
              <button onClick={cargarTodosTrabajadores} style={btnStyle("#8b5cf6",false,"sm")}>
                <UserPlus size={14}/> Cargar trabajadores BD
              </button>
              {filas.length>0&&(
                <button onClick={()=>{if(confirm("¿Limpiar todas las filas?"))setFilas([]);}}
                  style={btnStyle(DANGER,false,"sm")}>
                  <Trash2 size={14}/> Limpiar todo
                </button>
              )}
            </div>
          </div>

          {/* Leyenda */}
          <div style={{padding:"0.4rem 1.25rem",display:"flex",gap:"1rem",flexWrap:"wrap",
            fontSize:"0.72rem",color:"#64748b",borderBottom:"1px solid #f1f5f9",background:"#fff"}}>
            {[
              {bg:"#eff6ff",border:"#93c5fd",label:"Campo editable"},
              {bg:"#fefce8",border:"#fde047",label:"Desde catálogo"},
              {bg:"#f0fdf4",border:"#86efac",label:"Fórmula auto"},
              {bg:"#fff7ed",border:"#fed7aa",label:"Complemento SMMLV"},
              {bg:"#dcfce7",border:"#4ade80",label:"NETO"},
              {bg:"#e0f2fe",border:"#7dd3fc",label:"Motivo asistencia"},
            ].map((l,i)=>(
              <span key={i} style={{display:"flex",alignItems:"center",gap:"0.3rem"}}>
                <span style={{width:11,height:11,background:l.bg,borderRadius:2,display:"inline-block",border:`1px solid ${l.border}`}}/>
                {l.label}
              </span>
            ))}
          </div>
        </div>{/* fin sticky */}

        {/* ── TABLA PRINCIPAL ── */}
        <div style={{overflowX:"auto",overflowY:"auto",maxHeight:"62vh",background:"#fff",
          borderRadius:"0 0 12px 12px",boxShadow:"0 4px 12px rgba(0,0,0,0.06)",
          WebkitOverflowScrolling:"touch"}}>

          {recalculando ? (
            <div style={{textAlign:"center",padding:"3rem",color:"#94a3b8"}}>
              <RefreshCw size={28} style={{animation:"spin 1s linear infinite",display:"block",margin:"0 auto 0.5rem"}}/>
              <div>Calculando nómina...</div>
            </div>
          ) : filas.length === 0 ? (
            <div style={{textAlign:"center",padding:"3rem",color:"#94a3b8"}}>
              <div style={{fontSize:"3rem",marginBottom:"0.75rem"}}>🗂️</div>
              <div style={{fontSize:"1.1rem",fontWeight:"700",color:"#64748b",marginBottom:"0.5rem"}}>
                Nómina unificada en blanco
              </div>
              <div style={{fontSize:"0.85rem",marginBottom:"1.5rem"}}>
                Usa <strong>"Cargar trabajadores BD"</strong> para cargar todos los trabajadores activos.
              </div>
              <div style={{display:"flex",justifyContent:"center",gap:"0.75rem",flexWrap:"wrap"}}>
                <button onClick={cargarTodosTrabajadores} style={btnStyle(PRIMARY)}><UserPlus size={16}/> Cargar trabajadores BD</button>
                <button onClick={agregarFila} style={btnStyle(ACCENT)}><Plus size={16}/> Agregar manualmente</button>
              </div>
            </div>
          ) : filasFiltradas.length === 0 ? (
            <div style={{textAlign:"center",padding:"2rem",color:"#94a3b8"}}>
              <div style={{fontSize:"2rem",marginBottom:"0.5rem"}}>🔍</div>
              <div style={{fontWeight:"600",color:"#64748b",marginBottom:"0.35rem"}}>Sin resultados</div>
              <button onClick={limpiarFiltros} style={{...btnStyle(PRIMARY,false,"sm"),margin:"0 auto"}}>Limpiar filtros</button>
            </div>
          ) : (
            <table style={{width:"100%",minWidth:"2900px",borderCollapse:"collapse",fontSize:"0.76rem"}}>
              <thead style={{position:"sticky",top:0,zIndex:10}}>
                {/* ── Fila 1: grupos de columnas ── */}
                <tr style={{background:"#e2e8f0"}}>
                  <th colSpan={3} style={thGrupo("#94a3b8")}/>
                  <th colSpan={3} style={thGrupo("#3b82f6")}>DATOS EDITABLES</th>
                  <th style={thGrupo(SUCCESS)}>PRODUCCIÓN MATRIZ</th>
                  <th style={thGrupo(WARN)}>COMPLEMENTO</th>
                  <th colSpan={3} style={thGrupo("#3b82f6")}>DÍAS / OBSERVACIÓN / MOTIVO</th>
                  <th colSpan={2} style={thGrupo(SUCCESS)}>FÓRMULAS AUTO</th>
                  <th colSpan={8} style={{...thGrupo("#7c3aed"),background:"#ede9fe",fontWeight:"800",fontSize:"0.68rem"}}>
                    ⏱ HORAS EXTRAS Y RECARGOS 2026 — Ley colombiana (CST arts. 168-170)
                  </th>
                  <th style={thGrupo("#3b82f6")}>RETRO.</th>
                  <th style={thGrupo("#94a3b8")}>BASE COTIZ.</th>
                  <th colSpan={2} style={thGrupo(DANGER)}>DEDUCCIONES</th>
                  <th colSpan={2} style={thGrupo(SUCCESS)}>CÁLCULOS AUTO</th>
                  <th style={thGrupo("#0891b2")}>INC. REM. 66%</th>
                  <th style={thGrupo("#047857")}>INC. REM. 100%</th>
                  <th style={thGrupo("#065f46")}>NETO</th>
                  <th style={thGrupo("#ef4444")}>ADELANTOS</th>
                  <th style={thGrupo("#f97316")}>COMIDA</th>
                  <th style={{...thGrupo("#065f46"),background:"#bbf7d0",fontWeight:"900"}}>NETO FINAL</th>
                  <th style={thGrupo("#0ea5e9")}>FIRMA</th>
                  <th style={thGrupo("#94a3b8")}/>
                </tr>
                {/* ── Fila 2: etiquetas de columnas ── */}
                <tr style={{background:PRIMARY,color:"#fff"}}>
                  {[
                    { h:"#",              w:"35px",  a:"center" },
                    { h:"CLIENTE",        w:"110px", a:"center", tip:"Cliente del trabajador" },
                    { h:"NOMBRE",         w:"160px", a:"left" },
                    { h:"CÉDULA",         w:"110px", a:"left" },
                    { h:"CARGO",          w:"175px", a:"left",  tip:"Desde catálogo Administrar" },
                    { h:"BÁSICO MENS.",   w:"105px", a:"right", tip:"Auto desde cargo" },
                    { h:"TOTAL PROD. ▼",  w:"115px", a:"right", tip:"Clic para ver detalle de operaciones" },
                    { h:"COMPL.SMMLV",    w:"100px", a:"right", tip:"Empresa completa si prod < SMMLV" },
                    { h:"DÍAS",           w:"55px",  a:"center" },
                    { h:"OBSERVACIÓN",    w:"135px", a:"left" },
                    { h:"MOTIVO AST.",    w:"120px", a:"left",  tip:"Novedades del período" },
                    { h:"SAL.BÁS.Q.",    w:"100px", a:"right", tip:"=(Básico/30)×Días" },
                    { h:"PRODUCTIVIDAD",  w:"100px", a:"right", tip:"=TotalProd − Sal.Básico" },
                    { h:"HED 25%",   w:"80px", a:"right", tip:"H.Extra Diurna — factor 1.25",   xe:"HED" },
                    { h:"HEN 75%",   w:"80px", a:"right", tip:"H.Extra Nocturna — factor 1.75", xe:"HEN" },
                    { h:"HRN 35%",   w:"80px", a:"right", tip:"Recargo Nocturno — factor 0.35", xe:"HRN" },
                    { h:"HRDF 75%",  w:"80px", a:"right", tip:"Recargo Dom/Fest — factor 0.75", xe:"HRDF" },
                    { h:"HRNDF 110%",w:"88px", a:"right", tip:"Rec. Noc. Dom/Fest — factor 1.10",xe:"HRNDF" },
                    { h:"HEDDF 100%",w:"88px", a:"right", tip:"H.Extra Diurna D/F — factor 2.00",xe:"HEDDF" },
                    { h:"HENDF 150%",w:"88px", a:"right", tip:"H.Extra Noc. D/F — factor 2.50",  xe:"HENDF" },
                    { h:"TOTAL H.E.", w:"100px",a:"right", tip:"Total horas extras y recargos" },
                    { h:"RETROACTIVO", w:"88px", a:"right" },
                    { h:"BASE COTIZ.", w:"105px",a:"right", tip:"=ProdEfectiva + Retro + H.Extras" },
                    { h:"SALUD 4%",   w:"88px", a:"right", tip:"=Base×4%" },
                    { h:"PENSIÓN 4%", w:"88px", a:"right", tip:"=Base×4%" },
                    { h:"SAL−DEDUCC.",w:"110px",a:"right", tip:"=Base−Salud−Pensión" },
                    { h:"SUBS.TRANSP.",w:"108px",a:"right", tip:"=Días×(SubsidioMensual/30)" },
                    { h:"INC.REM.💊 66%",  w:"100px",a:"right", tip:"Empleador paga 66.67% × días IR" },
                    { h:"INC.REM.🏥 100%", w:"105px",a:"right", tip:"Empleador paga 100% × días IR-100" },
                    { h:"NETO A PAGAR", w:"118px",a:"right" },
                    { h:"ADELANTOS ↓",  w:"108px",a:"right", tip:"Adelantos pendientes" },
                    { h:"COMIDA ↓",     w:"100px",a:"right", tip:"Comida pendiente" },
                    { h:"NETO FINAL ✓", w:"120px",a:"right", tip:"= Neto a pagar − Adelantos" },
                    { h:"FIRMA",        w:"78px", a:"left" },
                    { h:"",             w:"36px", a:"center" },
                  ].map((col,ci)=>(
                    <th key={ci} title={col.tip||""} style={{
                      padding:"0.5rem 0.4rem",textAlign:col.a,fontWeight:"700",
                      whiteSpace:"nowrap",fontSize:"0.63rem",minWidth:col.w,
                      cursor:col.tip?"help":"default",
                      borderRight:"1px solid rgba(255,255,255,0.1)",
                      background:col.xe?"#4c1d95":PRIMARY,
                      boxShadow:"0 2px 4px rgba(0,0,0,0.15)",
                    }}>
                      {col.h}{col.tip&&<span style={{marginLeft:"2px",opacity:0.55}}>ℹ</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filasFiltradas.map(e => (
                  <FilaUnificada
                    key={e._key} fila={e} listaCargos={listaCargos}
                    onCambio={actualizarFila} onBlurCedula={buscarPorCedula}
                    onHoraExtra={actualizarHoraExtra}
                    onEliminar={()=>eliminarFila(e._key)}
                    onVerProd={()=>setModalProd({nombre:e.nombre, cedula:e.cedula, ops:e.detalleOps||[]})}
                  />
                ))}

                {/* ── FILA TOTALES ── */}
                {!hayFiltro && (
                  <tr style={{background:"#f0fdf4",borderTop:`3px solid ${SUCCESS}`}}>
                    <td colSpan={5} style={{padding:"0.85rem 0.5rem",color:"#065f46",fontWeight:"800",fontSize:"0.82rem"}}>
                      TOTALES — {filas.length} empleados · Todos los clientes
                    </td>
                    <td/>{/* BÁSICO */}
                    <td style={tdTotal(SUCCESS)}>{formatCOP(totales.totalProduccion)}</td>
                    <td style={tdTotal(totales.complementoSalario>0?WARN:"#94a3b8")}>
                      {totales.complementoSalario>0?formatCOP(totales.complementoSalario):"—"}
                    </td>
                    <td/><td/><td/>{/* DIAS, OBS, MOTIVO */}
                    <td/><td/>{/* SAL.BÁS, PROD */}
                    {HORAS_EXTRAS_2026.map(t=>(
                      <td key={t.codigo} style={{padding:"0.85rem 0.3rem",textAlign:"right",background:"#ede9fe"}}>
                        <div style={{fontFamily:"monospace",fontWeight:"800",color:"#6d28d9",fontSize:"0.75rem"}}>
                          {totalesPorTipoExtra[t.codigo]?.valor>0?formatCOP(totalesPorTipoExtra[t.codigo].valor):"—"}
                        </div>
                        {totalesPorTipoExtra[t.codigo]?.horas>0&&(
                          <div style={{fontSize:"0.62rem",color:"#7c3aed",opacity:0.75}}>
                            {totalesPorTipoExtra[t.codigo].horas}h
                          </div>
                        )}
                      </td>
                    ))}
                    <td style={{...tdTotal("#7c3aed"),background:"#ede9fe"}}>
                      {totales.totalExtras>0?formatCOP(totales.totalExtras):"—"}
                    </td>
                    <td/>{/* RETRO */}
                    <td/>{/* BASE COTIZ */}
                    <td style={tdTotal(DANGER)}>{formatCOP(totales.salud)}</td>
                    <td style={tdTotal(DANGER)}>{formatCOP(totales.pension)}</td>
                    <td/>{/* SAL-DEDUCC */}
                    <td style={tdTotal()}>{formatCOP(totales.subsidioTransporte)}</td>
                    <td style={{padding:"0.85rem 0.5rem",textAlign:"right",fontFamily:"monospace",fontWeight:"800",
                      color:"#0891b2",background:totales.valorIncapacidad>0?"#e0f2fe":"#f8fafc"}}>
                      {totales.valorIncapacidad>0?formatCOP(totales.valorIncapacidad):"—"}
                    </td>
                    <td style={{padding:"0.85rem 0.5rem",textAlign:"right",fontFamily:"monospace",fontWeight:"800",
                      color:"#047857",background:totales.valorIncapacidad100>0?"#d1fae5":"#f8fafc"}}>
                      {totales.valorIncapacidad100>0?formatCOP(totales.valorIncapacidad100):"—"}
                    </td>
                    <td style={{padding:"0.85rem 0.5rem",textAlign:"right",fontWeight:"900",color:"#065f46",
                      fontFamily:"monospace",fontSize:"0.92rem",background:"#dcfce7"}}>
                      {formatCOP(totales.netoAPagar)}
                    </td>
                    <td style={{padding:"0.85rem 0.5rem",textAlign:"right",fontFamily:"monospace",fontWeight:"800",
                      color:"#b91c1c",background:totales.adelantos>0?"#fef2f2":"#f8fafc"}}>
                      {totales.adelantos>0?`−${formatCOP(totales.adelantos)}`:"—"}
                    </td>
                    <td style={{padding:"0.85rem 0.5rem",textAlign:"right",fontFamily:"monospace",fontWeight:"800",
                      color:"#c2410c",background:totales.comida>0?"#fff7ed":"#f8fafc"}}>
                      {totales.comida>0?`−${formatCOP(totales.comida)}`:"—"}
                    </td>
                    <td style={{padding:"0.85rem 0.5rem",textAlign:"right",fontWeight:"900",color:"#064e3b",
                      fontFamily:"monospace",fontSize:"0.95rem",background:"#bbf7d0",borderLeft:"2.5px solid #10b981"}}>
                      {formatCOP(totales.netoFinal)}
                    </td>
                    <td colSpan={2}/>{/* FIRMA + DELETE */}
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* MODAL DETALLE PRODUCCIÓN */}
      {modalProd&&(
        <ModalDetalleProduccion
          trabajador={modalProd} ops={modalProd.ops}
          clientes={clientes} onClose={()=>setModalProd(null)}
        />
      )}

      <style jsx global>{`
        @keyframes spin{to{transform:rotate(360deg);}}
        .main-content{overflow-x:clip;}
      `}</style>
    </LayoutWithSidebar>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// FilaUnificada — idéntica a FilaNomina de liquidar.js + columna CLIENTE
// ════════════════════════════════════════════════════════════════════════════
function FilaUnificada({ fila, listaCargos, onCambio, onBlurCedula, onHoraExtra, onEliminar, onVerProd }) {
  const e  = fila;
  const cc = (campo, val) => onCambio(e._key, campo, val);
  const tieneComplemento = e.complementoSalario > 0;

  const tdEdit = { padding:"0.35rem 0.3rem", background:"#eff6ff" };
  const tdAuto = { padding:"0.35rem 0.3rem", background:"#fefce8" };
  const tdCalc = { padding:"0.35rem 0.3rem", background:"#f0fdf4" };
  const tdWarn = { padding:"0.35rem 0.3rem", background:tieneComplemento?"#fff7ed":"#f8fafc" };
  const tdNorm = { padding:"0.35rem 0.3rem" };
  const ci = e.clienteInfo || { color:"#0B3D91", emoji:"🏭", nombre:"SPIA" };

  return (
    <tr style={{borderBottom:"1px solid #f1f5f9",background:tieneComplemento?"#fffdf7":"transparent"}}
      onMouseEnter={el=>el.currentTarget.style.filter="brightness(0.97)"}
      onMouseLeave={el=>el.currentTarget.style.filter="none"}>

      {/* Col 1: # */}
      <td style={{...tdNorm,textAlign:"center",color:"#94a3b8",fontSize:"0.72rem",fontWeight:"700"}}>{e.idx}</td>

      {/* Col 2: CLIENTE (extra vs liquidar.js) */}
      <td style={{...tdNorm,textAlign:"center"}}>
        <span style={{
          background:`${ci.color}15`,color:ci.color,
          border:`1px solid ${ci.color}40`,
          borderRadius:"8px",padding:"2px 7px",
          fontSize:"0.68rem",fontWeight:"700",whiteSpace:"nowrap",
        }}>
          {ci.emoji} {ci.nombre}
        </span>
      </td>

      {/* Col 3: NOMBRE */}
      <td style={tdEdit}>
        <input value={e.nombre} onChange={ev=>cc("nombre",ev.target.value)}
          placeholder="Nombre..." style={iS("155px")}/>
      </td>

      {/* Col 4: CÉDULA */}
      <td style={tdEdit}>
        <input value={e.cedula} onChange={ev=>cc("cedula",ev.target.value)}
          onBlur={ev=>onBlurCedula(e._key,ev.target.value)}
          placeholder="Cédula..." style={iS("100px",{fontFamily:"monospace"})}/>
      </td>

      {/* Col 5: CARGO */}
      <td style={tdAuto}>
        <select value={e.cargo} onChange={ev=>cc("cargo",ev.target.value)}
          style={{...iS("168px"),background:"#fefce8"}}>
          <option value="">— Cargo —</option>
          {listaCargos.map(c=><option key={c.id||c.nombre} value={c.nombre}>{c.nombre}</option>)}
        </select>
      </td>

      {/* Col 6: BÁSICO MENSUAL */}
      <td style={tdAuto}>
        <input type="number" value={e.basicoMensual||""} onChange={ev=>cc("basicoMensual",parseFloat(ev.target.value)||0)}
          placeholder="0" style={{...iS("95px",{textAlign:"right",fontFamily:"monospace"}),background:"#fefce8"}}/>
      </td>

      {/* Col 7: TOTAL PRODUCCIÓN — clicable */}
      <td style={{...tdCalc,textAlign:"right",position:"relative"}}>
        <button
          onClick={onVerProd}
          title={e.detalleOps?.length>0?`Ver ${e.detalleOps.length} operación(es)`:"Sin operaciones"}
          style={{
            background:"none",border:"none",padding:0,cursor:"pointer",
            display:"flex",flexDirection:"column",alignItems:"flex-end",gap:"1px",
          }}
        >
          <span style={{
            fontFamily:"monospace",
            color:e.totalProduccion>0?"#059669":"#94a3b8",
            fontWeight:"700",fontSize:"0.82rem",
            borderBottom:e.totalProduccion>0?"1.5px dashed #6ee7b7":"none",
          }}>
            {e.totalProduccion>0?formatCOP(e.totalProduccion):"—"}
          </span>
          {e.detalleOps?.length>1&&(
            <span style={{fontSize:"0.6rem",color:"#6b7280"}}>{e.detalleOps.length} ops</span>
          )}
        </button>
      </td>

      {/* Col 8: COMPLEMENTO SMMLV */}
      <td style={{...tdWarn,textAlign:"right"}}>
        {tieneComplemento?(
          <span title={`Mínimo proporcional: ${formatCOP(e.minimoProporcionl)} | Prod: ${formatCOP(e.totalProduccion)}`}
            style={{fontFamily:"monospace",color:"#92400e",fontWeight:"700",fontSize:"0.82rem",cursor:"help"}}>
            +{formatCOP(e.complementoSalario)}
          </span>
        ):(
          <span style={{color:"#cbd5e1",fontSize:"0.72rem"}}>—</span>
        )}
      </td>

      {/* Col 9: DÍAS */}
      <td style={tdEdit}>
        <input type="number" min="0" max="31" value={e.dias}
          onChange={ev=>cc("dias",ev.target.value)}
          style={iS("50px",{textAlign:"center",fontWeight:"800"})}/>
      </td>

      {/* Col 10: OBSERVACIÓN */}
      <td style={{padding:"0.35rem 0.3rem",background:"#fafafa"}}>
        <input value={e.observacion||""} onChange={ev=>cc("observacion",ev.target.value)}
          placeholder="Observación..."
          style={{...iS("130px"),
            background:e.observacion?"#fffbeb":"transparent",
            border:e.observacion?"1px solid #fcd34d":"1px solid #e2e8f0",
            color:"#374151",fontSize:"0.74rem"}}/>
      </td>

      {/* Col 11: MOTIVO */}
      <td style={{padding:"0.35rem 0.4rem",background:e.motivoResumen?"#e0f2fe":"#f8fafc"}}>
        {e.motivoResumen?(
          <span title="Novedades del período" style={{
            fontSize:"0.72rem",color:"#0369a1",fontWeight:"700",
            background:"#bae6fd",borderRadius:"4px",padding:"2px 6px",
            whiteSpace:"nowrap",display:"inline-block",
          }}>
            {e.motivoResumen}
          </span>
        ):(
          <span style={{color:"#cbd5e1",fontSize:"0.7rem"}}>—</span>
        )}
      </td>

      {/* Col 12: SAL. BÁSICO QUINCENA */}
      <td style={{...tdCalc,textAlign:"right",fontFamily:"monospace"}}>{formatCOP(e.salarioBasicoQuincena)}</td>

      {/* Col 13: PRODUCTIVIDAD */}
      <td style={{...tdCalc,textAlign:"right",fontFamily:"monospace",
        color:e.productividad<0?DANGER:e.productividad>0?"#059669":"#94a3b8"}}>
        {e.totalProduccion>0?formatCOP(e.productividad):"—"}
      </td>

      {/* Cols 14-20: 7 tipos horas extras */}
      {HORAS_EXTRAS_2026.map(t => {
        const horas = e.horasExtras?.[t.codigo] || 0;
        const valor = e.desgloseExtras?.[t.codigo]?.valor || 0;
        return (
          <td key={t.codigo} style={{padding:"0.25rem 0.3rem",background:t.bg,verticalAlign:"middle"}}>
            <input type="number" min="0" step="0.5"
              value={horas||""}
              onChange={ev=>onHoraExtra(e._key,t.codigo,ev.target.value)}
              placeholder="0"
              title={`${t.label} (${t.pct})`}
              style={{
                width:"52px",padding:"0.22rem 0.3rem",
                border:`1.5px solid ${horas>0?t.color:"#e2e8f0"}`,
                borderRadius:"4px",fontSize:"0.74rem",textAlign:"center",
                fontWeight:horas>0?"800":"400",
                background:horas>0?t.bg:"transparent",
                outline:"none",boxSizing:"border-box",color:t.color,
              }}
            />
            {valor>0&&(
              <div style={{fontSize:"0.62rem",color:t.color,fontFamily:"monospace",fontWeight:"700",textAlign:"right",marginTop:"1px"}}>
                {formatCOP(valor)}
              </div>
            )}
          </td>
        );
      })}

      {/* Col 21: TOTAL H.E. */}
      <td style={{...tdCalc,textAlign:"right",fontFamily:"monospace",background:"#ede9fe"}}>
        {(e.totalExtras||0)>0?(
          <span style={{color:"#6d28d9",fontWeight:"800"}}>{formatCOP(e.totalExtras)}</span>
        ):<span style={{color:"#c4b5fd"}}>—</span>}
      </td>

      {/* Col 22: RETROACTIVO */}
      <td style={tdEdit}>
        <input type="number" min="0" value={e.retroactivo||""} onChange={ev=>cc("retroactivo",ev.target.value)}
          placeholder="0" style={iS("80px",{textAlign:"right",fontFamily:"monospace"})}/>
      </td>

      {/* Col 23: BASE COTIZACIÓN */}
      <td style={{...tdCalc,textAlign:"right",fontFamily:"monospace"}}>
        {tieneComplemento?(
          <span style={{color:"#92400e",fontWeight:"700"}} title="Elevada al mínimo proporcional">
            {formatCOP(e.baseCotizacion)}
          </span>
        ):formatCOP(e.baseCotizacion)}
      </td>

      {/* Col 24: SALUD */}
      <td style={{...tdCalc,textAlign:"right",fontFamily:"monospace",color:DANGER}}>{formatCOP(e.salud)}</td>

      {/* Col 25: PENSIÓN */}
      <td style={{...tdCalc,textAlign:"right",fontFamily:"monospace",color:DANGER}}>{formatCOP(e.pension)}</td>

      {/* Col 26: SAL - DEDUCC. */}
      <td style={{...tdCalc,textAlign:"right",fontFamily:"monospace"}}>{formatCOP(e.salarioMenosDeducciones)}</td>

      {/* Col 27: SUBSIDIO TRANSPORTE */}
      <td style={{...tdCalc,textAlign:"right",fontFamily:"monospace"}}>{formatCOP(e.subsidioTransporte)}</td>

      {/* Col 28: INCAPACIDAD REMUNERADA 66.67% */}
      <td style={{padding:"0.35rem 0.5rem",textAlign:"right",background:e.valorIncapacidad>0?"#e0f2fe":"#f8fafc"}}>
        {e.valorIncapacidad>0?(
          <div>
            <div style={{fontFamily:"monospace",fontWeight:"800",color:"#0891b2",fontSize:"0.82rem"}}>
              {formatCOP(e.valorIncapacidad)}
            </div>
            <div style={{fontSize:"0.62rem",color:"#0369a1"}}>💊 {e.diasIncapacidad}d × 66.67%</div>
          </div>
        ):<span style={{color:"#cbd5e1",fontSize:"0.7rem"}}>—</span>}
      </td>

      {/* Col 29: INCAPACIDAD REMUNERADA 100% */}
      <td style={{padding:"0.35rem 0.5rem",textAlign:"right",background:e.valorIncapacidad100>0?"#d1fae5":"#f8fafc"}}>
        {e.valorIncapacidad100>0?(
          <div>
            <div style={{fontFamily:"monospace",fontWeight:"800",color:"#047857",fontSize:"0.82rem"}}>
              {formatCOP(e.valorIncapacidad100)}
            </div>
            <div style={{fontSize:"0.62rem",color:"#065f46"}}>🏥 {e.diasIncapacidad100}d × 100%</div>
          </div>
        ):<span style={{color:"#cbd5e1",fontSize:"0.7rem"}}>—</span>}
      </td>

      {/* Col 30: NETO A PAGAR */}
      <td style={{padding:"0.35rem 0.5rem",textAlign:"right",fontWeight:"900",color:"#065f46",
        fontFamily:"monospace",fontSize:"0.85rem",background:"#dcfce7",whiteSpace:"nowrap"}}>
        {formatCOP(e.netoAPagar)}
      </td>

      {/* Col 31: ADELANTOS */}
      <td style={{padding:"0.35rem 0.5rem",textAlign:"right",background:e.adelantosDeducidos>0?"#fef2f2":"#f8fafc"}}>
        {e.adelantosDeducidos>0?(
          <span style={{fontFamily:"monospace",fontWeight:"800",color:"#b91c1c",fontSize:"0.82rem"}}>
            −{formatCOP(e.adelantosDeducidos)}
          </span>
        ):<span style={{color:"#cbd5e1",fontSize:"0.7rem"}}>—</span>}
      </td>

      {/* Col 32: COMIDA */}
      <td style={{padding:"0.35rem 0.5rem",textAlign:"right",background:e.comidaDeducida>0?"#fff7ed":"#f8fafc"}}>
        {e.comidaDeducida>0?(
          <span style={{fontFamily:"monospace",fontWeight:"800",color:"#c2410c",fontSize:"0.82rem"}}>
            −{formatCOP(e.comidaDeducida)}
          </span>
        ):<span style={{color:"#cbd5e1",fontSize:"0.7rem"}}>—</span>}
      </td>

      {/* Col 33: NETO FINAL */}
      <td style={{padding:"0.35rem 0.5rem",textAlign:"right",fontWeight:"900",fontFamily:"monospace",
        fontSize:"0.88rem",
        background:(e.adelantosDeducidos>0||e.comidaDeducida>0)?"#bbf7d0":"#f0fdf4",
        whiteSpace:"nowrap",color:"#064e3b",borderLeft:"2.5px solid #10b981"}}>
        {(e.adelantosDeducidos>0||e.comidaDeducida>0)
          ? formatCOP(e.netoFinal)
          : <span style={{color:"#94a3b8",fontWeight:"400",fontSize:"0.7rem"}}>=Neto</span>
        }
      </td>

      {/* Col 34: FIRMA */}
      <td style={tdEdit}>
        <input value={e.firma||""} onChange={ev=>cc("firma",ev.target.value)}
          placeholder="Firma..." style={iS("72px")}/>
      </td>

      {/* Col 35: ELIMINAR */}
      <td style={{padding:"0.35rem 0.3rem",textAlign:"center"}}>
        <button onClick={onEliminar} title="Eliminar fila"
          style={{background:"#fff1f2",border:"1px solid #fca5a5",borderRadius:"5px",
            padding:"0.25rem 0.35rem",cursor:"pointer",color:DANGER,lineHeight:1}}>
          <Trash2 size={12}/>
        </button>
      </td>
    </tr>
  );
}

// ── Estilos helpers ──────────────────────────────────────────────────────────
function btnStyle(color, disabled=false, size="md") {
  const sm = size==="sm";
  return {
    background:color, border:"none", borderRadius:"8px",
    padding:sm?"0.45rem 0.8rem":"0.72rem 1.1rem",
    color:"#fff", cursor:disabled?"not-allowed":"pointer",
    fontWeight:"700", fontSize:sm?"0.8rem":"0.88rem",
    display:"flex", alignItems:"center", gap:"0.4rem",
    opacity:disabled?0.6:1, transition:"opacity 0.15s", whiteSpace:"nowrap",
  };
}
const cardStyle = {
  background:"#fff", borderRadius:"12px",
  padding:"1rem 1.25rem", boxShadow:"0 2px 8px rgba(0,0,0,0.06)",
};
const dateInputStyle = {
  border:"1.5px solid #bfdbfe", borderRadius:"8px",
  padding:"0.4rem 0.6rem", fontSize:"0.88rem",
  fontWeight:"600", color:"#0B3D91", outline:"none",
  cursor:"pointer", background:"#eff6ff",
};
function thGrupo(color) {
  return {
    padding:"3px 4px", textAlign:"center", fontSize:"0.62rem",
    fontWeight:"700", color, borderRight:"1px solid #f1f5f9",
    background:"#e2e8f0", whiteSpace:"nowrap", overflow:"visible",
  };
}
function tdTotal(color) {
  return { padding:"0.85rem 0.5rem", textAlign:"right", fontFamily:"monospace",
    fontWeight:"800", color:color||"#374151", whiteSpace:"nowrap" };
}
function iS(width, extra={}) {
  return {
    width, minWidth:width, padding:"0.28rem 0.4rem",
    border:"1px solid #bfdbfe", borderRadius:"5px",
    fontSize:"0.76rem", outline:"none",
    background:"transparent", boxSizing:"border-box", ...extra,
  };
}
