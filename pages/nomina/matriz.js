// pages/nomina/matriz.js
// Registro de Operaciones — SPIA/C1 (cuadrilla) | Cliente2/Cliente3 (destajo individual: PER=Cant/NPer, Neto=PER×Tarifa)

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, getDoc, setDoc, query, orderBy, where, Timestamp
} from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";
import { getUserRoleByUid } from "@/utils/getUserRole";
import LayoutWithSidebar from "@/components/LayoutWithSidebar";
import { calcularNetoOperacion, formatCOP } from "@/utils/nominaCalculos";
import {
  ArrowLeft, Save, Trash2, Edit2, RefreshCw,
  Calendar, ChevronDown, CheckCircle, X,
  FileText, DollarSign, Users, Search, UserCheck
} from "lucide-react";

const PRIMARY = "#0B3D91";
const ACCENT  = "#00AEEF";
const SUCCESS = "#10b981";
const DANGER  = "#ef4444";
const PURPLE  = "#8b5cf6";
const ORANGE  = "#f59e0b";

const CLIENTES_BASE = [
  { id:"spia",     nombre:"SPIA",     color:"#0B3D91", emoji:"🏭" },
  { id:"cliente1", nombre:"Cliente 1",color:"#10b981", emoji:"🏢" },
  { id:"cliente2", nombre:"Cliente 2",color:"#8b5cf6", emoji:"🏗️" },
  { id:"cliente3", nombre:"Cliente 3",color:"#f59e0b", emoji:"🏭" },
];

// NOV_MAP se construye dinámicamente desde Firestore — ver novMapState en el componente
// Esta función se usa en contextos donde novMapState no está disponible (ej: fuera del render)
const novLabelStatic = (cod) => cod; // fallback minimal — se sobreescribe en render con novMapState

const hoy         = () => new Date().toISOString().split("T")[0];
const primerDiaMes= () => { const d=new Date(); return new Date(d.getFullYear(),d.getMonth(),1).toISOString().split("T")[0]; };
const docIdReg    = (cId,a,m) => `${cId}_${a}_${String(m).padStart(2,"0")}`;

// ── Fallback mínimo — solo se usa si Firestore está vacío
// La fuente real es nomina_novedades en Firestore (administrar.js)
const NOVEDADES_DEFAULT = [
  { codigo:"D", label:"Descanso",    emoji:"😴", color:"#64748b", bg:"#f1f5f9", orden:1 },
  { codigo:"I", label:"Inasistencia",emoji:"❌", color:"#dc2626", bg:"#fee2e2", orden:2 },
];

// ── Formulario SPIA/C1 (cuadrilla) ──
const FORM_INIT = {
  cuadrillaId:"", cuadrillaNombre:"", cuadrillaPersonas:0,
  fecha:hoy(), servicioId:"", servicioNombre:"", servicioValor:0,
  cantidad:1, personas:1, netoCalculado:0,
  tipoSeleccion:"",
  motivo:"",
  // Campos para modo trabajador individual con horas extras
  horasExtras: 1,   // horas extras trabajadas (permite decimales: 1.5, 2, etc.)
  novedad: "",      // novedad del trabajador individual ese día
};

// ── Formulario Cliente 2 (por días trabajados) ──
const CIAMSA2_FORM_INIT = {
  trabajadorId:"", trabajadorNombre:"", trabajadorCedula:"",
  fecha: hoy(),
  servicioId:"", servicioNombre:"", tarifaUnitaria:0, unidad:"dia",
  dias:"",         // días trabajados
  netoCalculado:0,
  motivo:"",
};

// ── Formulario Destajo (Cliente 2 y Cliente 3) ──
// Lógica Excel CIAMSA: PER = CANTIDAD / N_DE_PER  →  Neto = PER × VALOR_TN (= (G×E)/H)
const CIAMSA_FORM_INIT = {
  trabajadorId:"", trabajadorNombre:"", trabajadorCedula:"",
  fecha: hoy(),
  servicioId:"", servicioNombre:"", tarifaUnitaria:0, unidad:"ton",
  cantidad:"",   // toneladas / unidades totales del grupo
  nPersonas:1,   // N DE PER — cuántas personas comparten este trabajo
  per:0,         // CANTIDAD / N_DE_PER (por persona)
  netoCalculado:0, // PER × tarifaUnitaria
  esAjuste: false,  // fila de ajuste (sin servicio, solo monto)
  montoAjuste: "",  // monto fijo de ajuste
  motivo: "",    // novedad del trabajador ese día (opcional)
};

// ── Selector de motivo/novedad — dropdown reutilizable ──
function SelectMotivo({ value, onChange, novedades, color }) {
  const novSelec = novedades.find(n => n.codigo === value);
  const esPositivo = novSelec && !["-100%"].includes(novSelec.porcentaje);
  return (
    <div>
      <div style={{position:"relative"}}>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            width:"100%",
            padding:"0.65rem 2.4rem 0.65rem 0.9rem",
            border:`1.5px solid ${value ? (novSelec?.color || "#ef4444") : "#e2e8f0"}`,
            borderRadius:"10px",
            fontSize:"0.9rem",
            outline:"none",
            cursor:"pointer",
            appearance:"none",
            background: value ? (novSelec?.bg || "#fee2e2") : "#fff",
            color: value ? (novSelec?.color || "#dc2626") : "#374151",
            fontWeight: value ? "700" : "400",
            boxSizing:"border-box",
            transition:"all 0.15s",
          }}
        >
          <option value="">Sin novedad — asistió normal</option>
          {novedades.map(n => (
            <option key={n.codigo} value={n.codigo}>
              {n.emoji} {n.label}{n.porcentaje ? ` · ${n.porcentaje}` : ""} ({n.codigo})
            </option>
          ))}
        </select>
        <span style={{position:"absolute",right:"0.75rem",top:"50%",transform:"translateY(-50%)",pointerEvents:"none",fontSize:"0.9rem"}}>
          {value ? novSelec?.emoji || "❌" : "📋"}
        </span>
      </div>

      {/* Ficha informativa cuando hay una novedad seleccionada */}
      {value && novSelec && (
        <div style={{
          marginTop:"0.45rem",borderRadius:"10px",overflow:"hidden",
          border:`1.5px solid ${novSelec.color}40`,
          background:novSelec.bg,
        }}>
          {/* Barra superior con nombre y % */}
          <div style={{
            display:"flex",alignItems:"center",justifyContent:"space-between",
            padding:"0.4rem 0.75rem",
            background:novSelec.color,
          }}>
            <span style={{color:"#fff",fontWeight:"800",fontSize:"0.8rem"}}>
              {novSelec.emoji} {novSelec.label}
            </span>
            <div style={{display:"flex",gap:"0.4rem",alignItems:"center"}}>
              {novSelec.paga && (
                <span style={{
                  background:"rgba(255,255,255,0.25)",color:"#fff",
                  borderRadius:"6px",padding:"1px 7px",fontSize:"0.68rem",fontWeight:"700"
                }}>
                  Paga: {novSelec.paga}
                </span>
              )}
              {novSelec.porcentaje && (
                <span style={{
                  background: novSelec.porcentaje.startsWith("-") ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.3)",
                  color:"#fff",borderRadius:"6px",padding:"1px 8px",
                  fontSize:"0.75rem",fontWeight:"900",fontFamily:"monospace"
                }}>
                  {novSelec.porcentaje}
                </span>
              )}
            </div>
          </div>
          {/* Texto legal informativo */}
          {novSelec.info && (
            <div style={{
              padding:"0.35rem 0.75rem",
              fontSize:"0.72rem",color:novSelec.color,fontWeight:"600",lineHeight:1.4
            }}>
              ℹ️ {novSelec.info}
            </div>
          )}
          <div style={{
            padding:"0.25rem 0.75rem 0.4rem",
            fontSize:"0.68rem",color:novSelec.color,opacity:0.7
          }}>
            Se registrará en asistencia al guardar
          </div>
        </div>
      )}
    </div>
  );
}

// ── Componente fila resumen por trabajador ──
function FilaResumen({ t, i, formatCOP }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <tr style={{borderBottom:"1px solid #f1f5f9",background:i%2===0?"#fff":"#f8fafc",verticalAlign:"top"}}>
      <td style={{...tdSt,color:"#cbd5e1",width:"35px"}}>{i+1}</td>
      <td style={{...tdSt,fontWeight:"700",color:"#1e293b"}}>{t.nombre}</td>
      <td style={{...tdSt,fontFamily:"monospace",color:"#64748b",fontSize:"0.82rem"}}>{t.cedula||"—"}</td>
      <td style={tdSt}>
        <span style={{background:"#f0f9ff",color:ACCENT,borderRadius:"6px",padding:"2px 8px",fontSize:"0.8rem",fontWeight:"700"}}>
          {t.cuadrillaNombre}
        </span>
      </td>
      <td style={tdSt}>
        <button onClick={()=>setAbierto(p=>!p)}
          style={{display:"flex",alignItems:"center",gap:"0.5rem",
            background:abierto?"#eff6ff":"#f8fafc",
            border:`1.5px solid ${abierto?"#93c5fd":"#e2e8f0"}`,
            borderRadius:"8px",padding:"0.35rem 0.75rem",cursor:"pointer",
            color:abierto?PRIMARY:"#475569",fontWeight:"700",fontSize:"0.8rem",
            transition:"all 0.15s",whiteSpace:"nowrap"}}>
          <span style={{fontWeight:"900",color:abierto?PRIMARY:SUCCESS,fontSize:"1rem"}}>{t.dias.length}</span>
          {t.dias.length===1?"día trabajado":"días trabajados"}
          <span style={{fontSize:"0.65rem",transition:"transform 0.2s",transform:abierto?"rotate(180deg)":"rotate(0deg)"}}>▼</span>
        </button>
        {abierto && (
          <div style={{marginTop:"0.5rem",borderRadius:"8px",border:"1px solid #e2e8f0",overflow:"hidden",maxHeight:"220px",overflowY:"auto",boxShadow:"0 4px 12px rgba(0,0,0,0.08)"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:"0.75rem"}}>
              <thead>
                <tr style={{background:PRIMARY}}>
                  {["Fecha","Servicio","Neto"].map(h=>(
                    <th key={h} style={{padding:"0.35rem 0.6rem",textAlign:"left",color:"#fff",fontWeight:"700",fontSize:"0.68rem",whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.dias.map((d,j)=>(
                  <tr key={j} style={{borderBottom:"1px solid #f1f5f9",background:j%2===0?"#fff":"#f8fafc"}}>
                    <td style={{padding:"0.35rem 0.6rem",color:"#475569",whiteSpace:"nowrap",fontWeight:"600"}}>{d.fecha}</td>
                    <td style={{padding:"0.35rem 0.6rem",color:"#64748b",maxWidth:"150px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={d.servicio}>{d.servicio}</td>
                    <td style={{padding:"0.35rem 0.6rem",fontWeight:"800",color:"#065f46",fontFamily:"monospace",whiteSpace:"nowrap"}}>{formatCOP(d.neto)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{background:"#f0fdf4",borderTop:`2px solid ${SUCCESS}`}}>
                  <td colSpan={2} style={{padding:"0.4rem 0.6rem",fontWeight:"700",color:"#065f46",fontSize:"0.72rem"}}>Total ({t.dias.length} días)</td>
                  <td style={{padding:"0.4rem 0.6rem",fontWeight:"900",color:"#065f46",fontFamily:"monospace",whiteSpace:"nowrap"}}>{formatCOP(t.totalNeto)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </td>
      <td style={{...tdSt,fontWeight:"900",color:"#065f46",fontFamily:"monospace",fontSize:"1rem",background:"#f0fdf4",whiteSpace:"nowrap"}}>
        {formatCOP(t.totalNeto)}
      </td>
    </tr>
  );
}

export default function NominaMatriz() {
  const router = useRouter();
  const [rol,     setRol]     = useState(null);
  const [loading, setLoading] = useState(true);

  // Catálogos
  const [cuadrillasAsistencia, setCuadrillasAsistencia] = useState([]);
  const [listaTrabajadores,    setListaTrabajadores]    = useState([]);
  const [servicios,            setServicios]            = useState([]);

  // Período
  const [periodoDesde, setPeriodoDesde] = useState(primerDiaMes());
  const [periodoHasta, setPeriodoHasta] = useState(hoy());

  // Registros
  const [operaciones, setOperaciones] = useState([]);
  const [cargandoOps, setCargandoOps] = useState(false);

  // Filtros tabla
  const [filtroCuadrillaTabla, setFiltroCuadrillaTabla] = useState("");
  const [vistaTabla, setVistaTabla] = useState("registros");

  // ── Formulario SPIA/C1 ──
  const [form,       setForm]      = useState(FORM_INIT);
  const [guardando,  setGuardando] = useState(false);
  const [guardadoOk, setGuardadoOk]= useState(false);
  const [editandoId, setEditandoId]= useState(null);

  // Asistencia SPIA
  const [asistentesForm, setAsistentesForm] = useState([]);
  const [ausentesForm,   setAusentesForm]   = useState([]);
  const [cargandoAsist,  setCargandoAsist]  = useState(false);

  // ── Formulario CIAMSA 2 (por día) ──
  const [c2Form,      setC2Form]      = useState(CIAMSA2_FORM_INIT);
  const [c2Guardando, setC2Guardando] = useState(false);
  const [c2Ok,        setC2Ok]        = useState(false);
  const [c2EditId,    setC2EditId]    = useState(null);

  // ── Formulario CIAMSA 3 (destajo ton) ──
  const [ciamsaForm,      setCiamsaForm]      = useState(CIAMSA_FORM_INIT);
  const [ciamsaGuardando, setCiamsaGuardando] = useState(false);
  const [ciamsaOk,        setCiamsaOk]        = useState(false);
  const [ciamsaEditId,    setCiamsaEditId]    = useState(null);

  // Modal eliminación
  const [modalElim, setModalElim] = useState(null);

  // Novedades
  const [novedades, setNovedades] = useState(NOVEDADES_DEFAULT);
  const [novMapState, setNovMapState] = useState(Object.fromEntries(NOVEDADES_DEFAULT.map(n=>[n.codigo,n])));

  // Clientes
  const [clienteActivo, setClienteActivo] = useState("spia");
  const [clientes,      setClientes]      = useState(CLIENTES_BASE);

  const tablaRef = useRef(null);

  // ─── Identificadores de modelo por cliente ───
  // Cliente 2 = CIAMSA 2 (destajo) | Cliente 3 = CIAMSA 3 (destajo) — misma fórmula, catálogos distintos
  const isCliente2  = clienteActivo === "cliente2";
  const isCliente3  = clienteActivo === "cliente3";
  const isCiamsa    = isCliente2 || isCliente3;  // ambos usan formulario destajo
  const colorCiamsa = isCliente2 ? PURPLE : ORANGE;
  // Nombre oficial de cada cliente CIAMSA para etiquetas
  const nombreCiamsa = isCliente2
    ? (clientes.find(c=>c.id==="cliente2")?.nombre || "Cliente 2")
    : (clientes.find(c=>c.id==="cliente3")?.nombre || "Cliente 3");

  /* ── Auth ── */
  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/login"); return; }
      const r = await getUserRoleByUid(user.uid);
      setRol(r);
      if (!["admin","admin_nomina","nomina"].includes(r)) { router.push("/nomina"); return; }
      await Promise.all([cargarCuadrillas(), cargarClientes(), cargarServicios("spia"), cargarCatalogos("spia"), cargarNovedades()]);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => { if (!loading) cargarOperaciones(); }, [periodoDesde, periodoHasta, loading]);

  // Recargar al cambiar cliente
  useEffect(() => {
    if (!loading) {
      cargarServicios(clienteActivo);
      cargarCatalogos(clienteActivo);
      setForm(FORM_INIT);
      setAsistentesForm([]);
      setAusentesForm([]);
      setC2Form(CIAMSA2_FORM_INIT);
      setC2EditId(null);
      setCiamsaForm(CIAMSA_FORM_INIT);
      setCiamsaEditId(null);
      setEditandoId(null);
    }
  }, [clienteActivo]);

  // Recargar asistencia SPIA cuando cambia cuadrilla/fecha
  useEffect(() => {
    if (isCiamsa) return;
    if (form.tipoSeleccion === "trabajador") return;
    if (form.cuadrillaId && form.fecha) {
      cargarAsistenciaDia(form.cuadrillaId, form.fecha);
    } else {
      setAsistentesForm([]);
      setAusentesForm([]);
    }
  }, [form.cuadrillaId, form.fecha]);

  /* ── Novedades — fuente: Firestore (administrar.js) ── */
  const cargarNovedades = async () => {
    try {
      const snap = await getDocs(query(collection(db,"nomina_novedades"), orderBy("orden")));
      const lista = snap.empty
        ? NOVEDADES_DEFAULT   // fallback mínimo si Firestore aún no tiene datos
        : snap.docs.map(d=>({...d.data()}));
      lista.sort((a,b) => (a.orden||99) - (b.orden||99));
      setNovedades(lista);
      setNovMapState(Object.fromEntries(lista.map(n=>[n.codigo,n])));
    } catch {
      setNovedades(NOVEDADES_DEFAULT);
      setNovMapState(Object.fromEntries(NOVEDADES_DEFAULT.map(n=>[n.codigo,n])));
    }
  };
  // Generar etiqueta de novedad usando el mapa dinámico de Firestore
  const novLabel = (cod) => {
    const n = novMapState[cod];
    return n ? `${n.emoji} ${n.label}` : cod;
  };

  /**
   * Guarda un motivo en nomina_asistencia_registro para el trabajador ese día.
   * Busca la cuadrilla a la que pertenece el trabajador.
   * Si no está en ninguna, usa un doc genérico "individual_[year]_[month]".
   */
  const guardarMotivoEnRegistro = async (trabajadorId, fecha, motivo) => {
    if (!motivo || !trabajadorId || !fecha) return;
    const d    = new Date(fecha + "T12:00:00");
    const anio = d.getFullYear();
    const mes  = d.getMonth() + 1;
    const dia  = String(d.getDate());

    // Buscar la cuadrilla que contiene al trabajador
    let cuadId = null;
    for (const c of cuadrillasAsistencia) {
      if ((c.miembros||[]).some(m => m.id === trabajadorId)) {
        cuadId = c.id;
        break;
      }
    }
    // Si no tiene cuadrilla, usamos un doc genérico por trabajador
    if (!cuadId) cuadId = `individual_${trabajadorId}`;

    const regId = docIdReg(cuadId, anio, mes);
    try {
      const snap = await getDoc(doc(db,"nomina_asistencia_registro",regId));
      const registro = snap.exists() ? (snap.data().registro || {}) : {};
      const diaData  = { ...(registro[dia] || {}) };
      if (motivo === null) {
        delete diaData[trabajadorId];
      } else {
        diaData[trabajadorId] = motivo;
      }
      await setDoc(doc(db,"nomina_asistencia_registro",regId), {
        cuadrillaId:    cuadId,
        cuadrillaNombre: cuadId.startsWith("individual_") ? "Individual" : (cuadrillasAsistencia.find(c=>c.id===cuadId)?.nombre||""),
        anio, mes,
        registro: { ...registro, [dia]: diaData },
        actualizadoEn: new Date(),
      }, { merge: true });
    } catch (e) {
      console.error("Error guardando motivo en registro:", e);
    }
  };

  /* ── Catálogos ── */
  const cargarCuadrillas = async () => {
    const snap = await getDocs(collection(db,"nomina_asistencia"));
    const lista = snap.docs.map(d=>({id:d.id,...d.data()}));
    lista.sort((a,b)=>(a.orden||99)-(b.orden||99));
    setCuadrillasAsistencia(lista);
  };

  const cargarClientes = async () => {
    try {
      const snap = await getDocs(collection(db,"nomina_clientes"));
      if (!snap.empty) {
        const data = snap.docs.map(d=>({id:d.id,...d.data()}))
          .filter(c => c.id !== "admon"); // admon excluido de la matriz
        const orden = ["spia","cliente1","cliente2","cliente3"];
        data.sort((a,b)=>orden.indexOf(a.id)-orden.indexOf(b.id));
        const merged = data.map(c=>{const base=CLIENTES_BASE.find(b=>b.id===c.id);return{...base,...c};});
        setClientes(merged.length>0?merged:CLIENTES_BASE);
      }
    } catch {}
  };

  const cargarServicios = async (cId) => {
    const cActivo = cId || "spia";
    const snap = await getDocs(query(collection(db,"nomina_servicios"),orderBy("nombre")));
    const all = snap.docs.map(d=>({id:d.id,...d.data()}));
    const filtered = all.filter(s=>(s.clienteId||"spia")===cActivo);
    setServicios(filtered.length>0 ? filtered : (cActivo==="spia" ? all.filter(s=>!s.clienteId) : []));
  };

  const cargarCatalogos = async (cId) => {
    try {
      const cActivo = cId || "spia";
      const t = await getDocs(query(collection(db,"nomina_trabajadores"), orderBy("nombre")));
      if(!t.empty) {
        const all = t.docs.map(d=>({id:d.id,...d.data()}));
        // Solo trabajadores ACTIVOS (activo !== false)
        const activos   = all.filter(w => w.activo !== false);
        const filtered  = activos.filter(w=>(w.clienteIds||["spia"]).includes(cActivo));
        setListaTrabajadores(filtered.length>0?filtered:activos);
      }
    } catch {}
  };

  /* ── Asistencia SPIA ── */
  const cargarAsistenciaDia = async (cuadrillaId, fechaStr) => {
    setCargandoAsist(true);
    try {
      const c = cuadrillasAsistencia.find(x=>x.id===cuadrillaId);
      if (!c || !c.miembros || c.miembros.length===0) {
        setAsistentesForm([]); setAusentesForm([]); setCargandoAsist(false); return;
      }
      const d    = new Date(fechaStr+"T12:00:00");
      const anio = d.getFullYear();
      const mes  = d.getMonth()+1;
      const dia  = d.getDate();
      const id   = docIdReg(cuadrillaId, anio, mes);
      const snap = await getDoc(doc(db,"nomina_asistencia_registro",id));
      let novedadesDia = {};
      if (snap.exists()) novedadesDia = snap.data().registro?.[String(dia)] || {};
      const asisten  = c.miembros.filter(m => !novedadesDia[m.id]);
      const ausentes = c.miembros.filter(m => !!novedadesDia[m.id]).map(m=>({...m,novedad:novedadesDia[m.id]}));
      setAsistentesForm(asisten);
      setAusentesForm(ausentes);
      setForm(prev => {
        const personas = asisten.length || 1;
        const neto = Math.round(calcularNetoOperacion(parseFloat(prev.servicioValor)||0, personas, parseInt(prev.cantidad)||1)*100)/100;
        return { ...prev, personas, cuadrillaPersonas: c.miembros.length, netoCalculado: neto };
      });
    } catch(e) {
      console.error("Error asistencia:", e);
      setAsistentesForm([]); setAusentesForm([]);
    }
    setCargandoAsist(false);
  };

  /* ── Cargar operaciones ── */
  const cargarOperaciones = async () => {
    if (!periodoDesde || !periodoHasta) return;
    setCargandoOps(true);
    try {
      const inicio = Timestamp.fromDate(new Date(periodoDesde+"T00:00:00"));
      const fin    = Timestamp.fromDate(new Date(periodoHasta +"T23:59:59"));
      const snap   = await getDocs(query(
        collection(db,"nomina_operaciones"),
        where("fecha",">=",inicio), where("fecha","<=",fin), orderBy("fecha"),
      ));
      const ops = snap.docs.map(d=>({id:d.id,...d.data()}));
      ops.sort((a,b)=>{
        const nc=(a.cuadrillaNombre||"").localeCompare(b.cuadrillaNombre||"","es");
        return nc!==0?nc:(a.fechaStr||"").localeCompare(b.fechaStr||"");
      });
      setOperaciones(ops);
    } catch(e) { console.error(e); setOperaciones([]); }
    finally { setCargandoOps(false); }
  };

  /* ── SPIA: cálculo neto ── */
  const recalcular = (f) => {
    let neto = 0;
    if (f.tipoSeleccion === "trabajador") {
      // Modo individual: Neto = tarifa_hora × horas_extras
      const tarifa = parseFloat(f.servicioValor) || 0;
      const horas  = parseFloat(f.horasExtras)   || 0;
      neto = Math.round(tarifa * horas * 100) / 100;
    } else {
      // Modo cuadrilla: (valor_unitario × cantidad) ÷ personas
      neto = Math.round(calcularNetoOperacion(parseFloat(f.servicioValor)||0, parseInt(f.personas)||1, parseInt(f.cantidad)||1)*100)/100;
    }
    return { ...f, netoCalculado: neto };
  };

  const setField = (key,value) => setForm(prev => {
    const next = {...prev,[key]:value};
    return ["servicioValor","personas","cantidad","horasExtras","tipoSeleccion"].includes(key) ? recalcular(next) : next;
  });

  const seleccionarCuadrilla = (val) => {
    if (!val) {
      setForm(prev=>recalcular({...prev,cuadrillaId:"",cuadrillaNombre:"",cuadrillaPersonas:0,personas:1,tipoSeleccion:""}));
      setAsistentesForm([]); setAusentesForm([]); return;
    }
    if (val.startsWith("trab_")) {
      const tId = val.replace("trab_","");
      const t = listaTrabajadores.find(x=>x.id===tId);
      if (!t) return;
      setAsistentesForm([{ id:t.id, nombre:t.nombre, cedula:String(t.cedula||"") }]);
      setAusentesForm([]);
      setForm(prev=>recalcular({...prev, cuadrillaId:val, cuadrillaNombre:t.nombre, cuadrillaPersonas:1, personas:1, tipoSeleccion:"trabajador"}));
      return;
    }
    const c = cuadrillasAsistencia.find(x=>x.id===val);
    if (!c) return;
    setForm(prev=>({...prev, cuadrillaId:c.id, cuadrillaNombre:c.nombre, cuadrillaPersonas:c.miembros?.length||c.totalPersonas||0, personas:c.miembros?.length||c.totalPersonas||1, tipoSeleccion:"cuadrilla"}));
  };

  const seleccionarServicio = (id) => {
    const s = servicios.find(x=>x.id===id);
    if (!s) { setForm(prev=>recalcular({...prev,servicioId:"",servicioNombre:"",servicioValor:0})); return; }
    setForm(prev=>recalcular({...prev,servicioId:s.id,servicioNombre:s.nombre,servicioValor:s.valor||s.tarifa||0}));
  };

  /* ── SPIA: Guardar ── */
  const guardar = async () => {
    if (!form.cuadrillaNombre || !form.servicioNombre) { alert("Selecciona cuadrilla y servicio."); return; }
    setGuardando(true);
    const valorUnitario = parseFloat(form.servicioValor)||0;
    const cantidad      = parseInt(form.cantidad)||1;
    const personas      = parseInt(form.personas)||1;
    const esTrabajadorIndividual = form.tipoSeleccion === "trabajador";
    const horasExtras   = esTrabajadorIndividual ? (parseFloat(form.horasExtras) || 1) : null;
    // Fórmula diferente según modo
    const netoFinal = esTrabajadorIndividual
      ? Math.round(valorUnitario * (horasExtras||1) * 100) / 100
      : Math.round(calcularNetoOperacion(valorUnitario, personas, cantidad)*100)/100;
    const data = {
      periodoDesde, periodoHasta,
      clienteId: clienteActivo,
      modoCiamsa: false,
      quincenaId:`${periodoDesde} al ${periodoHasta}`,
      quincenaLabel:`${periodoDesde} al ${periodoHasta}`,
      cuadrillaId:       form.cuadrillaId,
      cuadrillaNombre:   form.cuadrillaNombre.trim().toUpperCase(),
      cuadrilla:         form.cuadrillaNombre.trim().toUpperCase(),
      cuadrillaPersonas: form.cuadrillaPersonas,
      fecha:             form.fecha ? Timestamp.fromDate(new Date(form.fecha+"T12:00:00")) : null,
      fechaStr:          form.fecha,
      servicioNombre:    form.servicioNombre.trim().toUpperCase(),
      servicioValorUnitario: valorUnitario,
      servicioValor:     esTrabajadorIndividual ? netoFinal : valorUnitario * cantidad,
      cantidad,
      personas,
      horasExtras,       // null para cuadrillas, número para individuales
      modoHorasExtras:   esTrabajadorIndividual, // flag para identificar este modo
      netoAPagar:        netoFinal,
      trabajadoresAsisten: asistentesForm.map(a=>({id:a.id,nombre:a.nombre,cedula:a.cedula||""})),
      trabajadoresAusentes: ausentesForm.map(a=>({id:a.id,nombre:a.nombre,novedad:a.novedad})),
      actualizadoEn: new Date(),
    };
    try {
      if (editandoId) {
        await updateDoc(doc(db,"nomina_operaciones",editandoId),data);
        setEditandoId(null);
      } else {
        await addDoc(collection(db,"nomina_operaciones"),{...data,creadoEn:new Date()});
      }
      // Guardar novedad del trabajador individual (campo novedad)
      if (form.tipoSeleccion==="trabajador" && form.novedad && form.fecha) {
        const trabId = form.cuadrillaId.replace("trab_","");
        await guardarMotivoEnRegistro(trabId, form.fecha, form.novedad);
      }
      // Guardar motivo legacy
      if (form.motivo && form.tipoSeleccion==="trabajador" && form.cuadrillaId && form.fecha) {
        const trabId = form.cuadrillaId.replace("trab_","");
        await guardarMotivoEnRegistro(trabId, form.fecha, form.motivo);
      }
      await cargarOperaciones();
      setForm({...FORM_INIT,cuadrillaId:form.cuadrillaId,cuadrillaNombre:form.cuadrillaNombre,cuadrillaPersonas:form.cuadrillaPersonas,personas:form.cuadrillaPersonas||1,fecha:form.fecha});
      setGuardadoOk(true);
      setTimeout(()=>setGuardadoOk(false),2000);
      tablaRef.current?.scrollIntoView({behavior:"smooth",block:"start"});
    } catch(e) { alert("Error: "+e.message); }
    setGuardando(false);
  };

  const iniciarEdicion = (op) => {
    setEditandoId(op.id);
    const serv = servicios.find(s=>s.nombre.toUpperCase()===op.servicioNombre?.toUpperCase());
    const cua  = cuadrillasAsistencia.find(c=>c.id===op.cuadrillaId||c.nombre===op.cuadrillaNombre);
    setForm(recalcular({
      cuadrillaId:      cua?.id||op.cuadrillaId||"",
      cuadrillaNombre:  op.cuadrillaNombre||op.cuadrilla||"",
      cuadrillaPersonas:op.cuadrillaPersonas||op.personas||1,
      fecha:            op.fechaStr||"",
      servicioId:       serv?.id||"",
      servicioNombre:   op.servicioNombre||"",
      servicioValor:    op.servicioValorUnitario||op.servicioValor||0,
      cantidad:         op.cantidad||1,
      personas:         op.personas||1,
      netoCalculado:    op.netoAPagar||0,
    }));
    window.scrollTo({top:0,behavior:"smooth"});
  };
  const cancelarEdicion = () => { setEditandoId(null); setForm(FORM_INIT); };

  /* ── CIAMSA 2: lógica por día trabajado ──
     Neto = DÍAS × TARIFA_DÍA
  */
  const c2Recalcular = (f) => {
    const dias   = parseFloat(f.dias)          || 0;
    const tarifa = parseFloat(f.tarifaUnitaria)|| 0;
    return {...f, netoCalculado: Math.round(dias * tarifa * 100) / 100};
  };

  const c2SetField = (key, value) => setC2Form(prev => c2Recalcular({...prev, [key]: value}));

  const c2SeleccionarTrabajador = (trabId) => {
    if (!trabId) { setC2Form(prev=>({...prev,trabajadorId:"",trabajadorNombre:"",trabajadorCedula:""})); return; }
    const t = listaTrabajadores.find(x=>x.id===trabId);
    if (!t) return;
    setC2Form(prev=>({...prev, trabajadorId:t.id, trabajadorNombre:t.nombre, trabajadorCedula:String(t.cedula||"") }));
  };

  const c2SeleccionarServicio = (servId) => {
    if (!servId) { setC2Form(prev=>c2Recalcular({...prev,servicioId:"",servicioNombre:"",tarifaUnitaria:0,unidad:"dia"})); return; }
    const s = servicios.find(x=>x.id===servId);
    if (!s) return;
    setC2Form(prev=>c2Recalcular({...prev, servicioId:s.id, servicioNombre:s.nombre, tarifaUnitaria:s.tarifa||s.valor||0, unidad:s.unidad||"dia"}));
  };

  const c2Guardar = async () => {
    if (!c2Form.trabajadorNombre || !c2Form.servicioNombre) { alert("Selecciona trabajador y servicio."); return; }
    if (!c2Form.dias || parseFloat(c2Form.dias) <= 0) { alert("Ingresa los días trabajados."); return; }
    setC2Guardando(true);
    const dias    = parseFloat(c2Form.dias)    || 0;
    const tarifa  = parseFloat(c2Form.tarifaUnitaria) || 0;
    const neto    = Math.round(dias * tarifa * 100) / 100;
    const data = {
      periodoDesde, periodoHasta,
      clienteId:  clienteActivo,
      modoCiamsa: true,
      modoCliente2: true,
      quincenaId:   `${periodoDesde} al ${periodoHasta}`,
      quincenaLabel:`${periodoDesde} al ${periodoHasta}`,
      cuadrillaId:       `trab_${c2Form.trabajadorId}`,
      cuadrillaNombre:   c2Form.trabajadorNombre,
      cuadrilla:         c2Form.trabajadorNombre,
      cuadrillaPersonas: 1,
      trabajadorId:      c2Form.trabajadorId,
      trabajadorNombre:  c2Form.trabajadorNombre,
      trabajadorCedula:  c2Form.trabajadorCedula,
      fecha:             c2Form.fecha ? Timestamp.fromDate(new Date(c2Form.fecha+"T12:00:00")) : null,
      fechaStr:          c2Form.fecha,
      servicioId:        c2Form.servicioId,
      servicioNombre:    c2Form.servicioNombre.trim().toUpperCase(),
      tarifaUnitaria:    tarifa,
      unidad:            c2Form.unidad || "dia",
      cantidadDias:      dias,        // días trabajados
      cantidadTons:      null,
      nPersonas:         1,
      per:               dias,
      servicioValorUnitario: tarifa,
      servicioValor:     neto,
      cantidad:          1,
      personas:          1,
      netoAPagar:        neto,
      trabajadoresAsisten: [{ id:c2Form.trabajadorId, nombre:c2Form.trabajadorNombre, cedula:c2Form.trabajadorCedula }],
      trabajadoresAusentes: [],
      actualizadoEn: new Date(),
    };
    try {
      if (c2EditId) {
        await updateDoc(doc(db,"nomina_operaciones",c2EditId), data);
        setC2EditId(null);
      } else {
        await addDoc(collection(db,"nomina_operaciones"), {...data, creadoEn:new Date()});
      }
      if (c2Form.motivo && c2Form.trabajadorId && c2Form.fecha) {
        await guardarMotivoEnRegistro(c2Form.trabajadorId, c2Form.fecha, c2Form.motivo);
      }
      await cargarOperaciones();
      setC2Form({...CIAMSA2_FORM_INIT, trabajadorId:c2Form.trabajadorId, trabajadorNombre:c2Form.trabajadorNombre, trabajadorCedula:c2Form.trabajadorCedula, fecha:c2Form.fecha, servicioId:c2Form.servicioId, servicioNombre:c2Form.servicioNombre, tarifaUnitaria:tarifa, unidad:c2Form.unidad});
      setC2Ok(true);
      setTimeout(()=>setC2Ok(false),2000);
      tablaRef.current?.scrollIntoView({behavior:"smooth",block:"start"});
    } catch(e) { alert("Error: "+e.message); }
    setC2Guardando(false);
  };

  const c2IniciarEdicion = (op) => {
    setC2EditId(op.id);
    const serv = servicios.find(s=>s.nombre.toUpperCase()===op.servicioNombre?.toUpperCase());
    setC2Form(c2Recalcular({
      trabajadorId:    op.trabajadorId||"",
      trabajadorNombre:op.trabajadorNombre||op.cuadrillaNombre||"",
      trabajadorCedula:op.trabajadorCedula||"",
      fecha:           op.fechaStr||"",
      servicioId:      serv?.id||op.servicioId||"",
      servicioNombre:  op.servicioNombre||"",
      tarifaUnitaria:  op.tarifaUnitaria||0,
      unidad:          op.unidad||"dia",
      dias:            op.cantidadDias||op.per||1,
      netoCalculado:   op.netoAPagar||0,
    }));
    window.scrollTo({top:0,behavior:"smooth"});
  };
  const c2Cancelar = () => { setC2EditId(null); setC2Form(CIAMSA2_FORM_INIT); };

  /* ── CIAMSA 3: lógica destajo ──
     PER = CANTIDAD / N_DE_PER
     Neto = PER × TARIFA_UNITARIA
  */
  const ciamsaRecalcular = (f) => {
    const cantidad   = parseFloat(f.cantidad)      || 0;
    const nPersonas  = parseInt(f.nPersonas)        || 1;
    const tarifa     = parseFloat(f.tarifaUnitaria) || 0;
    const per        = nPersonas > 0 ? cantidad / nPersonas : 0;
    const netoCalculado = Math.round(per * tarifa * 100) / 100;
    return {...f, per: Math.round(per * 10000) / 10000, netoCalculado};
  };

  const ciamsaSetField = (key, value) => {
    setCiamsaForm(prev => ciamsaRecalcular({...prev,[key]:value}));
  };

  const ciamsaSeleccionarTrabajador = (trabId) => {
    if (!trabId) { setCiamsaForm(prev=>({...prev,trabajadorId:"",trabajadorNombre:"",trabajadorCedula:""})); return; }
    const t = listaTrabajadores.find(x=>x.id===trabId);
    if (!t) return;
    setCiamsaForm(prev=>({...prev, trabajadorId:t.id, trabajadorNombre:t.nombre, trabajadorCedula:String(t.cedula||"")}));
  };

  const ciamsaSeleccionarServicio = (servId) => {
    if (!servId) { setCiamsaForm(prev=>ciamsaRecalcular({...prev,servicioId:"",servicioNombre:"",tarifaUnitaria:0,unidad:"ton"})); return; }
    const s = servicios.find(x=>x.id===servId);
    if (!s) return;
    const tarifa = s.tarifa || s.valor || 0;
    setCiamsaForm(prev=>ciamsaRecalcular({...prev, servicioId:s.id, servicioNombre:s.nombre, tarifaUnitaria:tarifa, unidad:s.unidad||"ton"}));
  };

  const ciamsaGuardar = async () => {
    if (!ciamsaForm.trabajadorNombre || !ciamsaForm.servicioNombre) { alert("Selecciona trabajador y servicio."); return; }
    if (!ciamsaForm.cantidad || parseFloat(ciamsaForm.cantidad)<=0) { alert("Ingresa la cantidad (toneladas/unidades)."); return; }
    setCiamsaGuardando(true);

    const cantidad  = parseFloat(ciamsaForm.cantidad) || 0;
    const nPersonas = parseInt(ciamsaForm.nPersonas)  || 1;
    const per       = nPersonas > 0 ? cantidad / nPersonas : 0;
    const netoFinal = Math.round(per * ciamsaForm.tarifaUnitaria * 100) / 100;

    const data = {
      periodoDesde, periodoHasta,
      clienteId:  clienteActivo,
      modoCiamsa: true,
      quincenaId:   `${periodoDesde} al ${periodoHasta}`,
      quincenaLabel:`${periodoDesde} al ${periodoHasta}`,
      // Campos compatibles con resumen por trabajador:
      cuadrillaId:       `trab_${ciamsaForm.trabajadorId}`,
      cuadrillaNombre:   ciamsaForm.trabajadorNombre,
      cuadrilla:         ciamsaForm.trabajadorNombre,
      cuadrillaPersonas: 1,
      // Datos específicos CIAMSA:
      trabajadorId:      ciamsaForm.trabajadorId,
      trabajadorNombre:  ciamsaForm.trabajadorNombre,
      trabajadorCedula:  ciamsaForm.trabajadorCedula,
      fecha:             ciamsaForm.fecha ? Timestamp.fromDate(new Date(ciamsaForm.fecha+"T12:00:00")) : null,
      fechaStr:          ciamsaForm.fecha,
      servicioId:        ciamsaForm.servicioId,
      servicioNombre:    ciamsaForm.servicioNombre.trim().toUpperCase(),
      tarifaUnitaria:    ciamsaForm.tarifaUnitaria,
      unidad:            ciamsaForm.unidad || "ton",
      cantidadTons:      cantidad,    // total del grupo
      nPersonas,                      // N DE PER
      per:               Math.round(per * 10000) / 10000, // porción por persona
      servicioValorUnitario: ciamsaForm.tarifaUnitaria,
      servicioValor:     netoFinal,
      cantidad:          nPersonas,
      personas:          nPersonas,
      netoAPagar:        netoFinal,
      trabajadoresAsisten: [{
        id:     ciamsaForm.trabajadorId,
        nombre: ciamsaForm.trabajadorNombre,
        cedula: ciamsaForm.trabajadorCedula,
      }],
      trabajadoresAusentes: [],
      actualizadoEn: new Date(),
    };

    try {
      if (ciamsaEditId) {
        await updateDoc(doc(db,"nomina_operaciones",ciamsaEditId),data);
        setCiamsaEditId(null);
      } else {
        await addDoc(collection(db,"nomina_operaciones"),{...data,creadoEn:new Date()});
      }
      // Guardar motivo en registro de asistencia si se seleccionó uno
      if (ciamsaForm.motivo && ciamsaForm.trabajadorId && ciamsaForm.fecha) {
        await guardarMotivoEnRegistro(ciamsaForm.trabajadorId, ciamsaForm.fecha, ciamsaForm.motivo);
      }
      await cargarOperaciones();
      setCiamsaForm({...CIAMSA_FORM_INIT, trabajadorId:ciamsaForm.trabajadorId, trabajadorNombre:ciamsaForm.trabajadorNombre, trabajadorCedula:ciamsaForm.trabajadorCedula, fecha:ciamsaForm.fecha});
      setCiamsaOk(true);
      setTimeout(()=>setCiamsaOk(false),2000);
      tablaRef.current?.scrollIntoView({behavior:"smooth",block:"start"});
    } catch(e) { alert("Error: "+e.message); }
    setCiamsaGuardando(false);
  };

  const ciamsaIniciarEdicion = (op) => {
    setCiamsaEditId(op.id);
    const serv = servicios.find(s=>s.nombre.toUpperCase()===op.servicioNombre?.toUpperCase());
    setCiamsaForm(ciamsaRecalcular({
      trabajadorId:    op.trabajadorId||"",
      trabajadorNombre:op.trabajadorNombre||op.cuadrillaNombre||"",
      trabajadorCedula:op.trabajadorCedula||"",
      fecha:           op.fechaStr||"",
      servicioId:      serv?.id||op.servicioId||"",
      servicioNombre:  op.servicioNombre||"",
      tarifaUnitaria:  op.tarifaUnitaria||0,
      unidad:          op.unidad||"ton",
      cantidad:        op.cantidadTons||"",
      nPersonas:       op.nPersonas||1,
      per:             op.per||0,
      netoCalculado:   op.netoAPagar||0,
      esAjuste:        op.esAjuste||false,
      montoAjuste:     op.montoAjuste||"",
    }));
    window.scrollTo({top:0,behavior:"smooth"});
  };
  const ciamsaCancelar = () => { setCiamsaEditId(null); setCiamsaForm(CIAMSA_FORM_INIT); };

  /* ── Eliminar ── */
  const eliminar = async (op) => {
    if (!confirm(`¿Eliminar este registro?`)) return;
    await deleteDoc(doc(db,"nomina_operaciones",op.id));
    setOperaciones(prev=>prev.filter(o=>o.id!==op.id));
  };

  const abrirModalElim   = (tipo) => setModalElim({tipo,textoInput:"",procesando:false});
  const cerrarModalElim  = () => setModalElim(null);
  const confirmarEliminacion = async () => {
    const esperado = modalElim.tipo==="periodo"?"ELIMINAR":"ELIMINAR TODO";
    if (modalElim.textoInput!==esperado) return;
    setModalElim(prev=>({...prev,procesando:true}));
    try {
      if (modalElim.tipo==="periodo") {
        await Promise.all(operaciones.map(op=>deleteDoc(doc(db,"nomina_operaciones",op.id))));
        setOperaciones([]);
      } else {
        const snap = await getDocs(collection(db,"nomina_operaciones"));
        await Promise.all(snap.docs.map(d=>deleteDoc(doc(db,"nomina_operaciones",d.id))));
        setOperaciones([]);
      }
      cerrarModalElim();
    } catch(e) { setModalElim(prev=>({...prev,procesando:false,error:e.message})); }
  };

  /* ── Resumen por trabajador ── */
  const calcularResumenTrabajadores = () => {
    const mapa = {};
    operaciones
      .filter(op=>(op.clienteId||"spia")===clienteActivo)
      .forEach(op => {
        const asisten = op.trabajadoresAsisten || [];
        if (asisten.length === 0) return;
        const netoPorPersona = op.netoAPagar || 0;
        asisten.forEach(w => {
          if (!mapa[w.id]) mapa[w.id] = {
            nombre: w.nombre, cedula: w.cedula || "",
            cuadrillaId: op.cuadrillaId,
            cuadrillaNombre: op.modoCiamsa ? "Individual" : (op.cuadrillaNombre||op.cuadrilla||""),
            dias: [], totalNeto: 0,
          };
          mapa[w.id].dias.push({ fecha:op.fechaStr, neto:netoPorPersona, servicio:op.servicioNombre });
          mapa[w.id].totalNeto += netoPorPersona;
        });
      });
    return Object.values(mapa).sort((a,b)=>a.nombre.localeCompare(b.nombre,"es"));
  };

  /* ── Computed ── */
  const opsFiltradas = operaciones
    .filter(op=>(op.clienteId||"spia")===clienteActivo)
    .filter(op=>!filtroCuadrillaTabla||(op.modoCiamsa?op.trabajadorNombre:op.cuadrillaNombre||op.cuadrilla)===filtroCuadrillaTabla);
  const totalNeto       = opsFiltradas.reduce((s,op)=>s+(op.netoAPagar||0),0);
  const totalCuadrillas = isCiamsa
    ? new Set(opsFiltradas.map(op=>op.trabajadorNombre).filter(Boolean)).size
    : new Set(opsFiltradas.map(op=>op.cuadrillaNombre||op.cuadrilla).filter(Boolean)).size;
  const nombresCuadrillaTabla = isCiamsa
    ? [...new Set(operaciones.filter(op=>(op.clienteId||"spia")===clienteActivo).map(op=>op.trabajadorNombre).filter(Boolean))].sort()
    : [...new Set(operaciones.map(op=>op.cuadrillaNombre||op.cuadrilla).filter(Boolean))].sort();

  const resumenTrab  = vistaTabla==="resumen" ? calcularResumenTrabajadores() : [];
  const totalResumen = resumenTrab.reduce((s,t)=>s+t.totalNeto,0);

  if (loading) return (
    <LayoutWithSidebar>
      <div style={{textAlign:"center",padding:"4rem",color:PRIMARY}}>
        <RefreshCw size={32} style={{animation:"spin 1s linear infinite"}}/>
        <div style={{marginTop:"1rem",fontWeight:"600"}}>Cargando matriz...</div>
      </div>
    </LayoutWithSidebar>
  );

  return (
    <LayoutWithSidebar>
      <div style={{maxWidth:"1400px",margin:"0 auto",padding:"0 0 3rem"}}>

        {/* ── HEADER ── */}
        <div style={{display:"flex",alignItems:"center",gap:"1rem",marginBottom:"1rem",flexWrap:"wrap"}}>
          <button onClick={()=>router.push("/nomina")} style={{background:"none",border:"none",cursor:"pointer",color:PRIMARY}}>
            <ArrowLeft size={22}/>
          </button>
          <div style={{flex:1}}>
            <h1 style={{margin:0,color:PRIMARY,fontSize:"1.6rem",fontWeight:"800"}}>📋 Matriz de Operaciones</h1>
            <p style={{margin:0,color:"#64748b",fontSize:"0.88rem"}}>
              {isCiamsa
                ? "Destajo individual por tonelada/unidad · Fórmula: PER = Cantidad ÷ N°Personas × Tarifa"
                : "Registro diario por cuadrilla · asistencia en tiempo real"}
            </p>
          </div>
        </div>

        {/* ── SELECTOR DE CLIENTE ── */}
        <div style={{display:"flex",gap:"0.5rem",marginBottom:"1.25rem",flexWrap:"wrap",alignItems:"center"}}>
          <span style={{fontSize:"0.78rem",fontWeight:"700",color:"#64748b",marginRight:"0.25rem"}}>🏢 Cliente:</span>
          {clientes.map(c=>{
            const activo = clienteActivo===c.id;
            return (
              <button key={c.id} onClick={()=>setClienteActivo(c.id)}
                style={{padding:"0.45rem 1rem",borderRadius:"20px",border:`2px solid ${activo?c.color||PRIMARY:"#e2e8f0"}`,
                  background:activo?c.color||PRIMARY:"#fff",color:activo?"#fff":"#475569",
                  fontWeight:"700",fontSize:"0.82rem",cursor:"pointer",transition:"all 0.15s",
                  boxShadow:activo?`0 2px 8px ${c.color||PRIMARY}40`:"none"}}>
                {c.emoji||"🏢"} {c.nombre}
                {(c.id==="cliente2"||c.id==="cliente3") && (
                  <span style={{marginLeft:"0.4rem",fontSize:"0.65rem",background:"rgba(255,255,255,0.25)",padding:"1px 5px",borderRadius:"8px"}}>
                    DESTAJO
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── PERÍODO ── */}
        <div style={{display:"flex",alignItems:"center",gap:"1rem",marginBottom:"1.5rem",flexWrap:"wrap"}}>
          <div style={{display:"flex",alignItems:"center",gap:"0.6rem",background:"#fff",
            border:`1.5px solid ${PRIMARY}30`,borderRadius:"12px",padding:"0.6rem 1rem",flexWrap:"wrap",
            boxShadow:"0 2px 8px rgba(11,61,145,0.08)"}}>
            <Calendar size={16} color={PRIMARY}/>
            {[{label:"Desde",val:periodoDesde,set:setPeriodoDesde},{label:"Hasta",val:periodoHasta,set:setPeriodoHasta}].map((f,i)=>(
              <div key={i} style={{display:"flex",flexDirection:"column"}}>
                <span style={{fontSize:"0.68rem",color:"#94a3b8",fontWeight:"700",textTransform:"uppercase",letterSpacing:"0.05em"}}>{f.label}</span>
                <input type="date" value={f.val} onChange={e=>f.set(e.target.value)}
                  style={{border:"none",outline:"none",fontSize:"0.9rem",fontWeight:"700",color:PRIMARY,cursor:"pointer",background:"transparent",padding:0}}/>
              </div>
            ))}
            <button onClick={cargarOperaciones} title="Recargar"
              style={{background:`${PRIMARY}10`,border:"none",borderRadius:"8px",padding:"0.35rem 0.5rem",cursor:"pointer",color:PRIMARY}}>
              <RefreshCw size={14} style={{animation:cargandoOps?"spin 1s linear infinite":"none"}}/>
            </button>
          </div>
        </div>

        {/* ── STATS ── */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:"1rem",marginBottom:"1.5rem"}}>
          {[
            {icon:<FileText   size={20}/>,label:"Registros",        value:opsFiltradas.length,color:PRIMARY   },
            {icon:<Users      size={20}/>,label:isCiamsa?"Trabajadores":"Cuadrillas",value:totalCuadrillas,color:isCiamsa?colorCiamsa:"#8b5cf6"},
            {icon:<DollarSign size={20}/>,label:"Total Producción", value:formatCOP(totalNeto),color:SUCCESS   },
            {icon:<UserCheck  size={20}/>,label:"Período",          value:`${periodoDesde.slice(5)} → ${periodoHasta.slice(5)}`,color:"#3b82f6"},
          ].map((s,i)=>(
            <div key={i} style={{background:"#fff",borderRadius:"12px",padding:"1rem 1.1rem",
              boxShadow:"0 2px 8px rgba(0,0,0,0.06)",borderLeft:`4px solid ${s.color}`,
              display:"flex",alignItems:"center",gap:"0.7rem"}}>
              <div style={{width:"40px",height:"40px",background:`${s.color}18`,borderRadius:"10px",
                display:"flex",alignItems:"center",justifyContent:"center",color:s.color,flexShrink:0}}>
                {s.icon}
              </div>
              <div>
                <div style={{fontWeight:"800",color:s.color,fontSize:i===3?"0.82rem":"1.25rem",lineHeight:1.2}}>{s.value}</div>
                <div style={{color:"#64748b",fontSize:"0.72rem"}}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ════════════════════════════════════════════════
            FORMULARIO CIAMSA (destajo)
            ════════════════════════════════════════════════ */}
        {isCiamsa && (
          <div style={{background:"#fff",borderRadius:"14px",
            boxShadow:`0 4px 20px ${colorCiamsa}20`,
            border:`2px solid ${ciamsaEditId?"#f59e0b":colorCiamsa}`,
            marginBottom:"1.75rem",overflow:"hidden"}}>

            {/* Header */}
            <div style={{background:ciamsaEditId?"#fffbeb":`linear-gradient(135deg,${colorCiamsa} 0%,${colorCiamsa}cc 100%)`,
              padding:"1rem 1.5rem",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{display:"flex",alignItems:"center",gap:"0.6rem"}}>
                <span style={{fontSize:"1.2rem"}}>{ciamsaEditId?"✏️":"⚖️"}</span>
                <div>
                  <div style={{fontWeight:"800",color:ciamsaEditId?"#92400e":"#fff",fontSize:"1rem"}}>
                    {ciamsaEditId?"Editando operación destajo":
                      `Nueva operación destajo — ${clienteActivo==="cliente2"?"CIAMSA 2":"CIAMSA 3"}`}
                  </div>
                  <div style={{color:ciamsaEditId?"#b45309":"rgba(255,255,255,0.80)",fontSize:"0.78rem"}}>
                    Fórmula: <strong style={{fontFamily:"monospace"}}>PER = Cantidad ÷ N°Personas</strong> · 
                    <strong style={{fontFamily:"monospace"}}> Neto = PER × Tarifa</strong>
                  </div>
                </div>
              </div>
              {ciamsaEditId && (
                <button onClick={ciamsaCancelar}
                  style={{background:"#fef3c7",border:"1.5px solid #fcd34d",borderRadius:"8px",padding:"0.4rem 0.8rem",cursor:"pointer",color:"#92400e",fontWeight:"700",fontSize:"0.82rem",display:"flex",alignItems:"center",gap:"0.4rem"}}>
                  <X size={14}/> Cancelar
                </button>
              )}
            </div>

            <div style={{padding:"1.5rem"}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:"1rem"}}>

                {/* Trabajador */}
                <div style={{gridColumn:"span 2"}}>
                  <label style={labelSt}>👤 Trabajador *</label>
                  <div style={{position:"relative"}}>
                    <select value={ciamsaForm.trabajadorId} onChange={e=>ciamsaSeleccionarTrabajador(e.target.value)} style={{...selectSt,border:`1.5px solid ${colorCiamsa}50`}}>
                      <option value="">— Seleccionar trabajador —</option>
                      {listaTrabajadores.map(t=>(
                        <option key={t.id} value={t.id}>
                          {t.nombre}{t.cedula?` · ${t.cedula}`:""}{t.cargo?` (${t.cargo})`:""}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={15} style={{position:"absolute",right:"0.75rem",top:"50%",transform:"translateY(-50%)",color:"#94a3b8",pointerEvents:"none"}}/>
                  </div>
                  {ciamsaForm.trabajadorNombre && (
                    <div style={{marginTop:"0.35rem",fontSize:"0.78rem",color:colorCiamsa,background:`${colorCiamsa}10`,padding:"0.3rem 0.7rem",borderRadius:"6px",display:"inline-block",fontWeight:"700"}}>
                      ✅ {ciamsaForm.trabajadorNombre} · {ciamsaForm.trabajadorCedula||"sin cédula"}
                    </div>
                  )}
                </div>

                {/* Motivo / Novedad */}
                <div>
                  <label style={labelSt}>📋 Novedad <span style={{fontWeight:"400",color:"#94a3b8"}}>(opcional)</span></label>
                  <SelectMotivo
                    value={ciamsaForm.motivo}
                    onChange={v => ciamsaSetField("motivo", v)}
                    novedades={novedades}
                    color={colorCiamsa}
                  />
                </div>

                {/* Fecha */}
                <div>
                  <label style={labelSt}>📅 Fecha *</label>
                  <input type="date" value={ciamsaForm.fecha} onChange={e=>ciamsaSetField("fecha",e.target.value)} style={inputSt}/>
                </div>

                {/* Servicio */}
                <div style={{gridColumn:"span 2"}}>
                  <label style={labelSt}>🔧 Servicio / Labor *</label>
                  <div style={{position:"relative"}}>
                    <select value={ciamsaForm.servicioId} onChange={e=>ciamsaSeleccionarServicio(e.target.value)} style={{...selectSt,border:`1.5px solid ${colorCiamsa}50`}}>
                      <option value="">— Seleccionar servicio —</option>
                      {servicios.map(s=>(
                        <option key={s.id} value={s.id}>
                          {s.nombre}{(s.tarifa||s.valor)>0?` · ${formatCOP(s.tarifa||s.valor||0)}/${s.unidad||"ton"}`:""}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={15} style={{position:"absolute",right:"0.75rem",top:"50%",transform:"translateY(-50%)",color:"#94a3b8",pointerEvents:"none"}}/>
                  </div>
                </div>

              </div>

              {/* ── Fila cálculo destajo ── */}
              <div style={{marginTop:"1rem",background:`${colorCiamsa}06`,border:`1.5px solid ${colorCiamsa}20`,borderRadius:"12px",padding:"1.1rem"}}>
                <div style={{fontSize:"0.75rem",fontWeight:"800",color:colorCiamsa,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:"0.85rem"}}>
                  ⚖️ Cálculo Destajo · PER = Cantidad Total ÷ N° Personas · Neto = PER × Tarifa
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:"1rem",alignItems:"end"}}>

                  {/* Cantidad total (toneladas/unidades del grupo) */}
                  <div>
                    <label style={labelSt}>📦 Cantidad total del grupo *</label>
                    <input type="number" step="0.01" min="0" value={ciamsaForm.cantidad}
                      onChange={e=>ciamsaSetField("cantidad",e.target.value)}
                      placeholder="Ej: 55.32"
                      style={{...inputSt,border:`1.5px solid ${colorCiamsa}60`,fontWeight:"700"}}/>
                    <div style={{fontSize:"0.68rem",color:"#94a3b8",marginTop:"0.2rem"}}>Toneladas o unidades totales del grupo</div>
                  </div>

                  {/* N° personas (divisor) */}
                  <div>
                    <label style={labelSt}>👥 N° Personas (divisor)</label>
                    <input type="number" min="1" value={ciamsaForm.nPersonas}
                      onChange={e=>ciamsaSetField("nPersonas",e.target.value)}
                      style={{...inputSt,border:`1.5px solid ${colorCiamsa}60`,fontWeight:"700"}}/>
                    <div style={{fontSize:"0.68rem",color:"#94a3b8",marginTop:"0.2rem"}}>Cuántas personas comparten este trabajo</div>
                  </div>

                  {/* PER (readonly) */}
                  <div>
                    <label style={labelSt}>📊 PER (porción por persona)</label>
                    <div style={{...readonlySt,border:`1.5px solid ${colorCiamsa}40`,background:`${colorCiamsa}08`,
                      color:ciamsaForm.per>0?colorCiamsa:"#94a3b8",fontWeight:"800",fontFamily:"monospace",fontSize:"1rem"}}>
                      {ciamsaForm.per>0 ? ciamsaForm.per.toFixed(4) : "—"}
                    </div>
                    <div style={{fontSize:"0.68rem",color:"#94a3b8",marginTop:"0.2rem"}}>
                      = {ciamsaForm.cantidad||"0"} ÷ {ciamsaForm.nPersonas}
                    </div>
                  </div>

                  {/* Tarifa (readonly de servicio) */}
                  <div>
                    <label style={labelSt}>💲 Tarifa unitaria</label>
                    <div style={{...readonlySt,color:ciamsaForm.tarifaUnitaria>0?"#059669":"#94a3b8",fontWeight:"700",fontFamily:"monospace"}}>
                      {ciamsaForm.tarifaUnitaria>0 ? formatCOP(ciamsaForm.tarifaUnitaria) : <span style={{color:"#cbd5e1"}}>Del servicio</span>}
                    </div>
                    <div style={{fontSize:"0.68rem",color:"#94a3b8",marginTop:"0.2rem"}}>Por ton/unidad</div>
                  </div>

                  {/* Neto calculado */}
                  <div style={{gridColumn:"span 2"}}>
                    <label style={labelSt}>💰 Neto a Pagar este trabajador</label>
                    <div style={{padding:"0.9rem 1.1rem",
                      background:ciamsaForm.netoCalculado>0?"#f0fdf4":"#f8fafc",
                      border:`2px solid ${ciamsaForm.netoCalculado>0?SUCCESS:"#e2e8f0"}`,
                      borderRadius:"10px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                      <span style={{fontWeight:"900",color:"#065f46",fontSize:"1.4rem",fontFamily:"monospace"}}>
                        {ciamsaForm.netoCalculado>0 ? formatCOP(ciamsaForm.netoCalculado) : "—"}
                      </span>
                      {ciamsaForm.netoCalculado>0 && (
                        <span style={{fontSize:"0.78rem",color:"#065f46",background:"#dcfce7",padding:"0.25rem 0.8rem",borderRadius:"20px",fontWeight:"700",fontFamily:"monospace"}}>
                          = {ciamsaForm.per.toFixed(4)} × {formatCOP(ciamsaForm.tarifaUnitaria)}
                        </span>
                      )}
                    </div>
                  </div>

                </div>
              </div>

              {/* Botón guardar */}
              <div style={{marginTop:"1.25rem",display:"flex",gap:"0.75rem",alignItems:"center",flexWrap:"wrap"}}>
                <button onClick={ciamsaGuardar}
                  disabled={ciamsaGuardando||!ciamsaForm.trabajadorNombre||!ciamsaForm.servicioNombre||!ciamsaForm.cantidad}
                  style={{background:(ciamsaGuardando||!ciamsaForm.trabajadorNombre||!ciamsaForm.servicioNombre||!ciamsaForm.cantidad)?"#94a3b8":ciamsaEditId?"#f59e0b":colorCiamsa,
                    border:"none",borderRadius:"10px",padding:"0.85rem 2rem",color:"#fff",fontWeight:"800",fontSize:"1rem",cursor:"pointer",
                    display:"flex",alignItems:"center",gap:"0.6rem",boxShadow:`0 4px 12px ${colorCiamsa}40`}}>
                  {ciamsaGuardando?<><RefreshCw size={18} style={{animation:"spin 1s linear infinite"}}/> Guardando...</>
                    :ciamsaOk?<><CheckCircle size={18}/> ¡Guardado!</>
                    :<><Save size={18}/> {ciamsaEditId?"Actualizar":"Guardar operación"}</>}
                </button>
                {(!ciamsaForm.trabajadorNombre||!ciamsaForm.servicioNombre||!ciamsaForm.cantidad) && (
                  <span style={{color:"#94a3b8",fontSize:"0.82rem"}}>
                    {!ciamsaForm.trabajadorNombre?"Selecciona trabajador":!ciamsaForm.servicioNombre?"Selecciona servicio":"Ingresa la cantidad"}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════
            FORMULARIO SPIA / CLIENTE 1 (cuadrilla)
            ════════════════════════════════════════════════ */}
        {!isCiamsa && (
          <div style={{background:"#fff",borderRadius:"14px",
            boxShadow:"0 4px 20px rgba(11,61,145,0.10)",
            border:`2px solid ${editandoId?"#f59e0b":PRIMARY}`,
            marginBottom:"1.75rem",overflow:"hidden"}}>

            <div style={{background:editandoId?"#fffbeb":`linear-gradient(135deg,${PRIMARY} 0%,#1a56c4 100%)`,
              padding:"1rem 1.5rem",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{display:"flex",alignItems:"center",gap:"0.6rem"}}>
                <span style={{fontSize:"1.2rem"}}>{editandoId?"✏️":"➕"}</span>
                <div>
                  <div style={{fontWeight:"800",color:editandoId?"#92400e":"#fff",fontSize:"1rem"}}>
                    {editandoId?"Editando operación":"Nueva Operación"}
                  </div>
                  <div style={{color:editandoId?"#b45309":"rgba(255,255,255,0.75)",fontSize:"0.78rem"}}>
                    Selecciona cuadrilla y fecha → asistencia automática
                  </div>
                </div>
              </div>
              {editandoId&&(
                <button onClick={cancelarEdicion}
                  style={{background:"#fef3c7",border:"1.5px solid #fcd34d",borderRadius:"8px",padding:"0.4rem 0.8rem",cursor:"pointer",color:"#92400e",fontWeight:"700",fontSize:"0.82rem",display:"flex",alignItems:"center",gap:"0.4rem"}}>
                  <X size={14}/> Cancelar
                </button>
              )}
            </div>

            <div style={{padding:"1.5rem"}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:"1rem"}}>
                <div style={{gridColumn:"span 2"}}>
                  <label style={labelSt}>👥 Cuadrilla / Trabajador *</label>
                  <div style={{position:"relative"}}>
                    <select value={form.cuadrillaId} onChange={e=>seleccionarCuadrilla(e.target.value)} style={selectSt}>
                      <option value="">— Seleccionar —</option>
                      {cuadrillasAsistencia.length > 0 && (
                        <optgroup label="── CUADRILLAS ──">
                          {cuadrillasAsistencia.map(c=>(
                            <option key={c.id} value={c.id}>Cuadrilla {c.nombre} · {c.miembros?.length||0} miembros</option>
                          ))}
                        </optgroup>
                      )}
                      {listaTrabajadores.length > 0 && (
                        <optgroup label="── TRABAJADORES INDIVIDUALES ──">
                          {listaTrabajadores.map(t=>(
                            <option key={t.id} value={`trab_${t.id}`}>{t.nombre}{t.cedula?` · ${t.cedula}`:""}</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    <ChevronDown size={15} style={{position:"absolute",right:"0.75rem",top:"50%",transform:"translateY(-50%)",color:"#94a3b8",pointerEvents:"none"}}/>
                  </div>
                </div>
                <div>
                  <label style={labelSt}>📅 Fecha *</label>
                  <input type="date" value={form.fecha} onChange={e=>setField("fecha",e.target.value)} style={inputSt}/>
                </div>

                {/* Solo mostrar contador de personas en modo cuadrilla */}
                {form.tipoSeleccion !== "trabajador" && (
                  <div>
                    <label style={labelSt}>🧑‍🤝‍🧑 Trabajadores activos</label>
                    <div style={{position:"relative"}}>
                      <input type="number" min="1" value={form.personas} onChange={e=>setField("personas",e.target.value)} style={inputSt}/>
                      {cargandoAsist&&<span style={{position:"absolute",right:"0.65rem",top:"50%",transform:"translateY(-50%)"}}>
                        <RefreshCw size={13} color="#94a3b8" style={{animation:"spin 1s linear infinite"}}/>
                      </span>}
                    </div>
                  </div>
                )}
              </div>

              {/* Panel asistencia */}
              {form.cuadrillaId && form.fecha && (
                <div style={{margin:"1rem 0",borderRadius:"12px",border:"1px solid #e2e8f0",overflow:"hidden"}}>
                  <div style={{padding:"0.65rem 1rem",background:`${PRIMARY}08`,display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid #e2e8f0"}}>
                    <span style={{fontWeight:"700",color:PRIMARY,fontSize:"0.85rem"}}>
                      {form.tipoSeleccion==="trabajador" ? "👤 Trabajador individual" : `📋 Asistencia del día — ${form.fecha}`}
                    </span>
                    {cargandoAsist ? (
                      <span style={{fontSize:"0.75rem",color:"#94a3b8",display:"flex",alignItems:"center",gap:"0.35rem"}}>
                        <RefreshCw size={12} style={{animation:"spin 1s linear infinite"}}/> Cargando...
                      </span>
                    ) : (
                      <span style={{fontSize:"0.75rem",color:"#64748b"}}>
                        <span style={{color:SUCCESS,fontWeight:"700"}}>{asistentesForm.length} asisten</span>
                        {ausentesForm.length>0&&<span style={{color:DANGER,fontWeight:"700",marginLeft:"0.5rem"}}> · {ausentesForm.length} con novedad</span>}
                      </span>
                    )}
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:0}}>
                    <div style={{padding:"0.75rem 1rem",borderRight:"1px solid #e2e8f0"}}>
                      <div style={{fontSize:"0.72rem",fontWeight:"700",color:SUCCESS,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"0.4rem"}}>
                        ✅ Asisten ({asistentesForm.length})
                      </div>
                      {asistentesForm.length===0&&!cargandoAsist ? (
                        <div style={{fontSize:"0.78rem",color:"#94a3b8"}}>Sin registro para este día</div>
                      ) : asistentesForm.map(w=>(
                        <div key={w.id} style={{display:"flex",alignItems:"center",gap:"0.5rem",padding:"0.3rem 0",borderBottom:"1px solid #f1f5f9",fontSize:"0.8rem"}}>
                          <span style={{color:SUCCESS}}>✓</span>
                          <span style={{fontWeight:"600",color:"#1e293b"}}>{w.nombre}</span>
                          <span style={{color:"#94a3b8",fontSize:"0.68rem",fontFamily:"monospace"}}>{w.cedula}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{padding:"0.75rem 1rem"}}>
                      <div style={{fontSize:"0.72rem",fontWeight:"700",color:DANGER,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"0.4rem"}}>
                        ❌ Con novedad ({ausentesForm.length})
                      </div>
                      {ausentesForm.length===0 ? (
                        <div style={{fontSize:"0.78rem",color:"#94a3b8"}}>Todos asistieron 🎉</div>
                      ) : ausentesForm.map(w=>(
                        <div key={w.id} style={{padding:"0.3rem 0",borderBottom:"1px solid #f1f5f9"}}>
                          <div style={{display:"flex",alignItems:"center",gap:"0.5rem",fontSize:"0.8rem",marginBottom:"0.25rem"}}>
                            <span>❌</span>
                            <div>
                              <div style={{fontWeight:"600",color:"#475569"}}>{w.nombre}</div>
                              <div style={{fontSize:"0.68rem",color:DANGER,fontWeight:"700"}}>{novLabel(w.novedad)}</div>
                            </div>
                          </div>
                          {/* Selector de motivo inline — dropdown compacto */}
                          <div style={{marginLeft:"1.5rem",marginTop:"0.25rem"}}>
                            <select
                              value={w.novedad||""}
                              onChange={async e=>{
                                const val = e.target.value;
                                setAusentesForm(prev=>prev.map(x=>x.id===w.id?{...x,novedad:val}:x));
                                if (val) await guardarMotivoEnRegistro(w.id, form.fecha, val);
                              }}
                              style={{
                                padding:"0.3rem 1.8rem 0.3rem 0.55rem",
                                border:`1.5px solid ${novedades.find(n=>n.codigo===w.novedad)?.color||DANGER}`,
                                borderRadius:"8px",fontSize:"0.72rem",fontWeight:"700",cursor:"pointer",
                                appearance:"none",outline:"none",
                                background:novedades.find(n=>n.codigo===w.novedad)?.bg||"#fee2e2",
                                color:novedades.find(n=>n.codigo===w.novedad)?.color||DANGER,
                                minWidth:"160px",
                              }}
                            >
                              {novedades.map(n=>(
                                <option key={n.codigo} value={n.codigo}>{n.emoji} {n.label} ({n.codigo})</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:"1rem",marginTop:"0.5rem"}}>

                {/* Servicio: muestra tarifa/hora si hay servicio */}
                <div style={{gridColumn:"span 2"}}>
                  <label style={labelSt}>🔧 Servicio *</label>
                  <div style={{position:"relative"}}>
                    <select value={form.servicioId} onChange={e=>seleccionarServicio(e.target.value)} style={selectSt}>
                      <option value="">— Seleccionar servicio —</option>
                      {servicios.map(s=>(
                        <option key={s.id} value={s.id}>
                          {s.nombre}{(s.valor||s.tarifa)>0?` · ${formatCOP(s.valor||s.tarifa||0)}${form.tipoSeleccion==="trabajador"?"/hr":""}`:""}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={15} style={{position:"absolute",right:"0.75rem",top:"50%",transform:"translateY(-50%)",color:"#94a3b8",pointerEvents:"none"}}/>
                  </div>
                </div>

                {/* MODO CUADRILLA: campo Cantidad normal */}
                {form.tipoSeleccion !== "trabajador" && (
                  <div>
                    <label style={labelSt}>📦 Cantidad</label>
                    <input type="number" min="1" value={form.cantidad} onChange={e=>setField("cantidad",e.target.value)} style={inputSt}/>
                  </div>
                )}

                {/* MODO INDIVIDUAL: Horas Extras + Novedad */}
                {form.tipoSeleccion === "trabajador" && (<>
                  {/* Panel de horas extras con selector visual */}
                  <div style={{gridColumn:"span 2",background:"#fffbeb",border:"1.5px solid #fcd34d",borderRadius:"12px",padding:"1rem"}}>
                    <div style={{fontSize:"0.75rem",fontWeight:"800",color:"#92400e",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:"0.75rem"}}>
                      ⏰ Horas Extras Trabajadas · Neto = Tarifa/hora × Horas
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1rem",alignItems:"end"}}>
                      <div>
                        <label style={labelSt}>⏰ Cantidad de horas extras *</label>
                        <input
                          type="number" step="0.5" min="0.5"
                          value={form.horasExtras}
                          onChange={e=>setField("horasExtras",e.target.value)}
                          placeholder="Ej: 2 ó 1.5"
                          style={{...inputSt,border:"1.5px solid #f59e0b",fontWeight:"700",fontSize:"1.1rem",color:"#92400e"}}
                        />
                        <div style={{display:"flex",gap:"0.35rem",marginTop:"0.4rem",flexWrap:"wrap"}}>
                          {[0.5,1,1.5,2,2.5,3,4].map(h=>(
                            <button key={h} type="button"
                              onClick={()=>setField("horasExtras",h)}
                              style={{padding:"0.25rem 0.6rem",borderRadius:"6px",border:`1.5px solid ${Number(form.horasExtras)===h?"#f59e0b":"#e2e8f0"}`,
                                background:Number(form.horasExtras)===h?"#fef3c7":"#fff",
                                color:Number(form.horasExtras)===h?"#92400e":"#64748b",
                                fontWeight:Number(form.horasExtras)===h?"800":"500",
                                fontSize:"0.78rem",cursor:"pointer"}}>
                              {h}h
                            </button>
                          ))}
                        </div>
                        <div style={{fontSize:"0.68rem",color:"#94a3b8",marginTop:"0.2rem"}}>Acepta medias horas: 0.5, 1, 1.5, 2…</div>
                      </div>
                      <div>
                        <label style={labelSt}>💲 Tarifa por hora</label>
                        <div style={{...readonlySt,background:"#fffbeb",border:"1.5px solid #fcd34d",color:form.servicioValor>0?"#92400e":"#94a3b8",fontWeight:"700",fontFamily:"monospace",fontSize:"1.1rem"}}>
                          {form.servicioValor>0 ? <>{formatCOP(form.servicioValor)}<span style={{fontSize:"0.72rem",marginLeft:"4px",opacity:0.7}}>/ hr</span></> : <span style={{color:"#cbd5e1"}}>Del servicio</span>}
                        </div>
                        <div style={{fontSize:"0.68rem",color:"#94a3b8",marginTop:"0.2rem"}}>Valor unitario del servicio seleccionado</div>
                      </div>
                    </div>
                  </div>

                  {/* Novedad del trabajador individual */}
                  <div style={{gridColumn:"span 2"}}>
                    <label style={labelSt}>📋 Novedad del trabajador <span style={{fontWeight:"400",color:"#94a3b8"}}>(opcional)</span></label>
                    <SelectMotivo
                      value={form.novedad}
                      onChange={v => setForm(prev=>({...prev, novedad:v}))}
                      novedades={novedades}
                      color={PRIMARY}
                    />
                  </div>
                </>)}

                {/* Neto calculado */}
                <div style={{gridColumn:"span 2"}}>
                  <label style={labelSt}>💰 Neto a Pagar</label>
                  <div style={{padding:"0.85rem 1.1rem",background:form.netoCalculado>0?"#f0fdf4":"#f8fafc",border:`2px solid ${form.netoCalculado>0?SUCCESS:"#e2e8f0"}`,borderRadius:"10px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <span style={{fontWeight:"800",color:"#065f46",fontSize:"1.3rem",fontFamily:"monospace"}}>
                      {form.netoCalculado>0?formatCOP(form.netoCalculado):"—"}
                    </span>
                    {form.netoCalculado>0&&(
                      <span style={{fontSize:"0.75rem",color:"#4ade80",background:"#dcfce7",padding:"0.2rem 0.7rem",borderRadius:"20px",fontWeight:"600",fontFamily:"monospace"}}>
                        {form.tipoSeleccion==="trabajador"
                          ? `= ${formatCOP(form.servicioValor)} × ${form.horasExtras}h`
                          : `= (${formatCOP(form.servicioValor)} × ${form.cantidad}) ÷ ${form.personas} pers.`}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div style={{marginTop:"1.5rem",display:"flex",gap:"0.75rem",alignItems:"center"}}>
                <button onClick={guardar}
                  disabled={guardando||!form.cuadrillaNombre||!form.servicioNombre||asistentesForm.length===0}
                  style={{background:(guardando||!form.cuadrillaNombre||!form.servicioNombre||asistentesForm.length===0)?"#94a3b8":editandoId?"#f59e0b":PRIMARY,
                    border:"none",borderRadius:"10px",padding:"0.85rem 2rem",color:"#fff",fontWeight:"800",fontSize:"1rem",cursor:"pointer",
                    display:"flex",alignItems:"center",gap:"0.6rem",boxShadow:"0 4px 12px rgba(11,61,145,0.25)"}}>
                  {guardando?<><RefreshCw size={18} style={{animation:"spin 1s linear infinite"}}/> Guardando...</>
                    :guardadoOk?<><CheckCircle size={18}/> ¡Guardado!</>
                    :<><Save size={18}/> {editandoId?"Actualizar":"Guardar"}</>}
                </button>
                {asistentesForm.length===0 && form.cuadrillaId && (
                  <span style={{color:DANGER,fontSize:"0.82rem",fontWeight:"600"}}>⚠️ Sin asistentes — registra asistencia primero</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── TABLA ── */}
        <div ref={tablaRef}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"0.75rem",flexWrap:"wrap",gap:"0.75rem"}}>
            <div>
              <h2 style={{margin:0,color:PRIMARY,fontSize:"1.1rem",fontWeight:"800"}}>
                📊 {periodoDesde} al {periodoHasta}
              </h2>
              <p style={{margin:0,color:"#64748b",fontSize:"0.8rem"}}>
                {opsFiltradas.length} registros · Total: {formatCOP(totalNeto)}
              </p>
            </div>
            <div style={{display:"flex",gap:"0.5rem",flexWrap:"wrap",alignItems:"center"}}>
              <div style={{display:"flex",background:"#f1f5f9",borderRadius:"10px",padding:"3px",gap:"2px"}}>
                {[{key:"registros",label:"Registros"},{key:"resumen",label:"Resumen por trabajador"}].map(v=>(
                  <button key={v.key} onClick={()=>setVistaTabla(v.key)}
                    style={{padding:"0.42rem 0.85rem",borderRadius:"8px",border:"none",cursor:"pointer",fontWeight:"700",fontSize:"0.78rem",transition:"all 0.15s",
                      background:vistaTabla===v.key?"#fff":"transparent",
                      color:vistaTabla===v.key?PRIMARY:"#94a3b8",
                      boxShadow:vistaTabla===v.key?"0 2px 6px rgba(0,0,0,0.1)":"none"}}>
                    {v.label}
                  </button>
                ))}
              </div>
              {vistaTabla==="registros"&&(<>
                <div style={{position:"relative"}}>
                  <Search size={13} style={{position:"absolute",left:"0.6rem",top:"50%",transform:"translateY(-50%)",color:"#94a3b8"}}/>
                  <select value={filtroCuadrillaTabla} onChange={e=>setFiltroCuadrillaTabla(e.target.value)}
                    style={{border:"1.5px solid #e2e8f0",borderRadius:"8px",padding:"0.45rem 0.75rem 0.45rem 2rem",fontSize:"0.85rem",outline:"none",background:"#fff"}}>
                    <option value="">{isCiamsa?"Todos los trabajadores":"Todas las cuadrillas"}</option>
                    {nombresCuadrillaTabla.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <button onClick={()=>abrirModalElim("periodo")} disabled={operaciones.length===0}
                  style={{background:"#fff7ed",border:"1.5px solid #fed7aa",borderRadius:"8px",padding:"0.45rem 0.75rem",cursor:operaciones.length===0?"not-allowed":"pointer",display:"flex",alignItems:"center",gap:"0.4rem",color:"#c2410c",fontSize:"0.82rem",fontWeight:"700",opacity:operaciones.length===0?0.5:1}}>
                  <Trash2 size={13}/> Eliminar período
                </button>
                <button onClick={()=>abrirModalElim("todo")}
                  style={{background:"#fff1f2",border:"1.5px solid #fecdd3",borderRadius:"8px",padding:"0.45rem 0.75rem",cursor:"pointer",display:"flex",alignItems:"center",gap:"0.4rem",color:"#be123c",fontSize:"0.82rem",fontWeight:"700"}}>
                  <Trash2 size={13}/> Eliminar todo
                </button>
              </>)}
            </div>
          </div>

          {/* ─── Vista registros ─── */}
          {vistaTabla==="registros" && (
            <div style={{background:"#fff",borderRadius:"14px",boxShadow:"0 2px 12px rgba(0,0,0,0.07)",overflow:"hidden"}}>
              {cargandoOps ? (
                <div style={{textAlign:"center",padding:"3rem",color:"#94a3b8"}}>
                  <RefreshCw size={28} style={{animation:"spin 1s linear infinite",display:"block",margin:"0 auto 0.5rem"}}/>
                  <div>Cargando operaciones...</div>
                </div>
              ) : (
                <div style={{overflowX:"auto"}}>
                  {/* ── Tabla CIAMSA ── */}
                  {isCiamsa ? (
                    <table style={{width:"100%",borderCollapse:"collapse"}}>
                      <thead>
                        <tr style={{background:colorCiamsa}}>
                          {["#","Trabajador","Cédula","Fecha","Servicio","Cantidad","N.Per","PER","Tarifa","Neto","Acc."].map(h=>(
                            <th key={h} style={{padding:"0.8rem 0.7rem",textAlign:"left",fontSize:"0.75rem",fontWeight:"700",color:"#fff",whiteSpace:"nowrap"}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {opsFiltradas.length===0 ? (
                          <tr><td colSpan="11" style={{textAlign:"center",padding:"3.5rem",color:"#94a3b8"}}>
                            <div style={{fontSize:"2.5rem",marginBottom:"0.75rem"}}>⚖️</div>
                            <div style={{fontWeight:"600"}}>Sin registros — usa el formulario para agregar operaciones destajo</div>
                          </td></tr>
                        ) : opsFiltradas.map((op,i)=>{
                          const esEd = ciamsaEditId===op.id;
                          return (
                            <tr key={op.id}
                              style={{borderBottom:"1px solid #f1f5f9",background:esEd?"#fffbeb":i%2===0?"#fff":"#f8fafc"}}
                              onMouseEnter={e=>{if(!esEd)e.currentTarget.style.background="#f5f0ff";}}
                              onMouseLeave={e=>{if(!esEd)e.currentTarget.style.background=i%2===0?"#fff":"#f8fafc";}}>
                              <td style={{...tdSt,color:"#94a3b8",fontSize:"0.75rem"}}>{i+1}</td>
                              <td style={{...tdSt,fontWeight:"700",color:"#1e293b",whiteSpace:"nowrap"}}>
                                {esEd&&<span style={{background:"#fef3c7",color:"#92400e",borderRadius:"4px",padding:"1px 5px",fontSize:"0.68rem",marginRight:"4px",fontWeight:"700"}}>ed.</span>}
                                {op.trabajadorNombre||op.cuadrillaNombre||"—"}
                              </td>
                              <td style={{...tdSt,fontFamily:"monospace",color:"#64748b",fontSize:"0.8rem"}}>{op.trabajadorCedula||"—"}</td>
                              <td style={{...tdSt,color:"#475569",fontSize:"0.85rem",whiteSpace:"nowrap"}}>{op.fechaStr||"—"}</td>
                              <td style={{...tdSt,maxWidth:"180px"}}>
                                <div style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontSize:"0.83rem",color:"#374151"}}>{op.servicioNombre||"—"}</div>
                              </td>
                              <td style={{...tdSt,fontWeight:"700",color:"#374151",fontFamily:"monospace",textAlign:"right"}}>
                                {op.cantidadTons!=null?op.cantidadTons:"—"}
                              </td>
                              <td style={{...tdSt,fontFamily:"monospace",color:"#64748b",textAlign:"center"}}>{op.nPersonas||1}</td>
                              <td style={{...tdSt,fontFamily:"monospace",color:colorCiamsa,fontWeight:"700",textAlign:"right"}}>
                                {op.per!=null?op.per.toFixed(4):"—"}
                              </td>
                              <td style={{...tdSt,fontFamily:"monospace",color:"#059669",fontSize:"0.82rem",textAlign:"right"}}>
                                {op.tarifaUnitaria>0?formatCOP(op.tarifaUnitaria):"—"}
                              </td>
                              <td style={{...tdSt,fontWeight:"900",color:SUCCESS,fontFamily:"monospace",fontSize:"0.9rem",whiteSpace:"nowrap",textAlign:"right"}}>
                                {formatCOP(op.netoAPagar)}
                              </td>
                              <td style={tdSt}>
                                <div style={{display:"flex",gap:"0.3rem"}}>
                                  <button onClick={()=>ciamsaIniciarEdicion(op)} style={{background:`${colorCiamsa}18`,border:"none",borderRadius:"6px",padding:"0.3rem 0.45rem",cursor:"pointer",color:colorCiamsa}}><Edit2 size={13}/></button>
                                  <button onClick={()=>eliminar(op)} style={{background:"#fff1f2",border:"none",borderRadius:"6px",padding:"0.3rem 0.45rem",cursor:"pointer",color:DANGER}}><Trash2 size={13}/></button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {opsFiltradas.length>0&&(
                          <tr style={{background:"#f0fdf4",borderTop:`2px solid ${SUCCESS}`}}>
                            <td colSpan="9" style={{padding:"0.9rem",fontWeight:"700",color:"#065f46",fontSize:"0.9rem"}}>
                              TOTAL — {opsFiltradas.length} registros
                            </td>
                            <td style={{padding:"0.9rem",fontWeight:"800",color:"#065f46",fontFamily:"monospace",fontSize:"1rem",whiteSpace:"nowrap",textAlign:"right"}}>
                              {formatCOP(totalNeto)}
                            </td>
                            <td/>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  ) : (
                    /* ── Tabla SPIA/C1 ── */
                    <table style={{width:"100%",borderCollapse:"collapse"}}>
                      <thead>
                        <tr style={{background:PRIMARY}}>
                          {["#","Cuadrilla","Fecha","Asistentes","Servicio","Cant.","Neto","X Persona","Acc."].map(h=>(
                            <th key={h} style={{padding:"0.8rem 0.9rem",textAlign:"left",fontSize:"0.78rem",fontWeight:"700",color:"#fff",whiteSpace:"nowrap"}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {opsFiltradas.length===0 ? (
                          <tr><td colSpan="9" style={{textAlign:"center",padding:"3.5rem",color:"#94a3b8"}}>
                            <div style={{fontSize:"2.5rem",marginBottom:"0.75rem"}}>📋</div>
                            <div style={{fontWeight:"600"}}>Sin registros en este período</div>
                          </td></tr>
                        ) : opsFiltradas.map((op,i)=>{
                          const esEd = editandoId===op.id;
                          const nomCua = op.cuadrillaNombre||op.cuadrilla||"—";
                          const asisten = op.trabajadoresAsisten||[];
                          const xPersona = asisten.length>0?(op.netoAPagar||0)/asisten.length:0;
                          return (
                            <tr key={op.id}
                              style={{borderBottom:"1px solid #f1f5f9",background:esEd?"#fffbeb":"transparent"}}
                              onMouseEnter={e=>{if(!esEd)e.currentTarget.style.background="#f8fafc";}}
                              onMouseLeave={e=>{if(!esEd)e.currentTarget.style.background="transparent";}}>
                              <td style={tdSt}><span style={{color:"#94a3b8",fontSize:"0.78rem"}}>{i+1}</span></td>
                              <td style={{...tdSt,whiteSpace:"nowrap"}}>
                                {esEd&&<span style={{background:"#fef3c7",color:"#92400e",borderRadius:"4px",padding:"1px 5px",fontSize:"0.7rem",marginRight:"5px",fontWeight:"700"}}>ed.</span>}
                                <span style={{background:"#f0f9ff",color:ACCENT,borderRadius:"6px",padding:"3px 10px",fontSize:"0.82rem",fontWeight:"700"}}>
                                  Cua. {nomCua}
                                </span>
                              </td>
                              <td style={{...tdSt,color:"#475569",fontSize:"0.85rem",whiteSpace:"nowrap"}}>{op.fechaStr||"—"}</td>
                              <td style={tdSt}>
                                <div style={{fontSize:"0.78rem"}}>
                                  <span style={{fontWeight:"700",color:SUCCESS}}>{op.personas} asisten</span>
                                  {op.trabajadoresAusentes?.length>0&&<span style={{color:DANGER,marginLeft:"0.35rem"}}>· {op.trabajadoresAusentes.length} aus.</span>}
                                </div>
                                <div style={{fontSize:"0.65rem",color:"#94a3b8"}}>
                                  {asisten.slice(0,2).map(w=>w.nombre?.split(" ")[0]).join(", ")}{asisten.length>2?` +${asisten.length-2}`:""}
                                </div>
                              </td>
                              <td style={{...tdSt,maxWidth:"180px"}}>
                                <div style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontSize:"0.85rem",color:"#374151"}}>{op.servicioNombre}</div>
                              </td>
                              <td style={{...tdSt,textAlign:"center",fontWeight:"700",color:op.modoHorasExtras?"#92400e":"#374151"}}>
                                {op.modoHorasExtras
                                  ? <span title="Horas extras" style={{background:"#fef3c7",color:"#92400e",borderRadius:"6px",padding:"2px 7px",fontSize:"0.8rem",fontWeight:"800",fontFamily:"monospace"}}>
                                      ⏰ {op.horasExtras}h
                                    </span>
                                  : op.cantidad}
                              </td>
                              <td style={{...tdSt,fontWeight:"800",color:SUCCESS,fontFamily:"monospace",fontSize:"0.9rem",whiteSpace:"nowrap"}}>{formatCOP(op.netoAPagar)}</td>
                              <td style={{...tdSt,fontFamily:"monospace",fontSize:"0.82rem",color:"#475569"}}>{xPersona>0?formatCOP(xPersona):"—"}</td>
                              <td style={tdSt}>
                                <div style={{display:"flex",gap:"0.4rem"}}>
                                  <button onClick={()=>iniciarEdicion(op)} style={{background:"#f0f9ff",border:"none",borderRadius:"6px",padding:"0.3rem 0.45rem",cursor:"pointer",color:ACCENT}}><Edit2 size={13}/></button>
                                  <button onClick={()=>eliminar(op)} style={{background:"#fff1f2",border:"none",borderRadius:"6px",padding:"0.3rem 0.45rem",cursor:"pointer",color:DANGER}}><Trash2 size={13}/></button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {opsFiltradas.length>0&&(
                          <tr style={{background:"#f0fdf4",borderTop:`2px solid ${SUCCESS}`}}>
                            <td colSpan="6" style={{padding:"0.9rem",fontWeight:"700",color:"#065f46",fontSize:"0.9rem"}}>TOTAL — {opsFiltradas.length} registros</td>
                            <td style={{padding:"0.9rem",fontWeight:"800",color:"#065f46",fontFamily:"monospace",fontSize:"1rem",whiteSpace:"nowrap"}}>{formatCOP(totalNeto)}</td>
                            <td colSpan="2"/>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ─── Vista resumen ─── */}
          {vistaTabla==="resumen" && (
            <div style={{background:"#fff",borderRadius:"14px",boxShadow:"0 2px 12px rgba(0,0,0,0.07)",overflow:"hidden"}}>
              <div style={{padding:"0.85rem 1.1rem",background:`${PRIMARY}06`,borderBottom:"1px solid #e2e8f0",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div style={{fontSize:"0.85rem",color:"#475569",fontWeight:"600"}}>
                  {isCiamsa
                    ? "⚖️ Destajo — suma de todos los netoAPagar por trabajador en el período"
                    : "💡 Neto por participación real en cada operación del período"}
                </div>
                <div style={{fontWeight:"800",color:PRIMARY,fontSize:"0.9rem"}}>Total: {formatCOP(totalResumen)}</div>
              </div>
              {resumenTrab.length===0 ? (
                <div style={{textAlign:"center",padding:"3rem",color:"#94a3b8"}}>
                  <div style={{fontSize:"2.5rem",marginBottom:"0.75rem"}}>👷</div>
                  <div style={{fontWeight:"600"}}>Sin datos en este período</div>
                </div>
              ) : (
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead>
                      <tr style={{background:isCiamsa?colorCiamsa:PRIMARY}}>
                        {["#","Trabajador","Cédula","Tipo","Registros","Total quincena"].map(h=>(
                          <th key={h} style={{padding:"0.8rem 0.9rem",textAlign:"left",fontSize:"0.78rem",fontWeight:"700",color:"#fff",whiteSpace:"nowrap"}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {resumenTrab.map((t,i)=>(
                        <FilaResumen key={t.nombre+i} t={t} i={i} formatCOP={formatCOP}/>
                      ))}
                      <tr style={{background:"#f0fdf4",borderTop:`3px solid ${SUCCESS}`}}>
                        <td colSpan={5} style={{padding:"0.9rem",fontWeight:"800",color:"#065f46",fontSize:"0.9rem"}}>
                          TOTAL QUINCENA — {resumenTrab.length} trabajadores
                        </td>
                        <td style={{padding:"0.9rem",fontWeight:"900",color:"#065f46",fontFamily:"monospace",fontSize:"1.1rem",whiteSpace:"nowrap"}}>
                          {formatCOP(totalResumen)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Modal eliminación ── */}
      {modalElim&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}}
          onClick={e=>{if(e.target===e.currentTarget&&!modalElim.procesando)cerrarModalElim();}}>
          <div style={{background:"#fff",borderRadius:"16px",padding:"2rem",maxWidth:"440px",width:"100%",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
            <div style={{textAlign:"center",marginBottom:"1.25rem"}}>
              <div style={{fontSize:"3rem",marginBottom:"0.5rem"}}>{modalElim.tipo==="todo"?"🚨":"⚠️"}</div>
              <h2 style={{margin:0,color:modalElim.tipo==="todo"?"#be123c":"#c2410c",fontSize:"1.2rem",fontWeight:"800"}}>
                {modalElim.tipo==="todo"?"Eliminar TODOS los registros":"Eliminar registros del período"}
              </h2>
            </div>
            <div style={{background:modalElim.tipo==="todo"?"#fff1f2":"#fff7ed",border:`1.5px solid ${modalElim.tipo==="todo"?"#fecdd3":"#fed7aa"}`,borderRadius:"10px",padding:"1rem",marginBottom:"1.25rem",fontSize:"0.88rem",color:"#374151"}}>
              {modalElim.tipo==="periodo"
                ? <><div><strong>Período:</strong> {periodoDesde} al {periodoHasta}</div><div><strong>Registros:</strong> {operaciones.length}</div><div style={{color:"#c2410c",fontWeight:"600",marginTop:"0.4rem"}}>⚠️ No se puede deshacer.</div></>
                : <><div>Se eliminarán <strong>TODOS</strong> los registros.</div><div style={{color:"#be123c",fontWeight:"700",marginTop:"0.4rem"}}>❗ Acción irreversible.</div></>}
            </div>
            <label style={{display:"block",fontSize:"0.85rem",fontWeight:"700",color:"#374151",marginBottom:"0.5rem"}}>
              Escribe <span style={{color:modalElim.tipo==="todo"?"#be123c":"#c2410c",fontFamily:"monospace",background:"#f1f5f9",padding:"2px 6px",borderRadius:"4px"}}>
                {modalElim.tipo==="periodo"?"ELIMINAR":"ELIMINAR TODO"}
              </span>:
            </label>
            <input autoFocus value={modalElim.textoInput}
              onChange={e=>setModalElim(prev=>({...prev,textoInput:e.target.value}))}
              onKeyDown={e=>{if(e.key==="Enter")confirmarEliminacion();}}
              disabled={modalElim.procesando}
              placeholder={modalElim.tipo==="periodo"?"ELIMINAR":"ELIMINAR TODO"}
              style={{width:"100%",padding:"0.75rem",border:`1.5px solid ${modalElim.textoInput===(modalElim.tipo==="periodo"?"ELIMINAR":"ELIMINAR TODO")?"#ef4444":"#e2e8f0"}`,borderRadius:"10px",fontSize:"0.95rem",outline:"none",marginBottom:"1.25rem",boxSizing:"border-box",fontFamily:"monospace"}}/>
            {modalElim.error&&<div style={{color:"#ef4444",fontSize:"0.82rem",marginBottom:"0.75rem"}}>{modalElim.error}</div>}
            <div style={{display:"flex",gap:"0.75rem"}}>
              <button onClick={cerrarModalElim} disabled={modalElim.procesando}
                style={{flex:1,padding:"0.75rem",background:"#f1f5f9",border:"none",borderRadius:"10px",color:"#475569",fontWeight:"700",cursor:"pointer"}}>
                Cancelar
              </button>
              <button onClick={confirmarEliminacion}
                disabled={modalElim.procesando||modalElim.textoInput!==(modalElim.tipo==="periodo"?"ELIMINAR":"ELIMINAR TODO")}
                style={{flex:2,padding:"0.75rem",background:modalElim.textoInput===(modalElim.tipo==="periodo"?"ELIMINAR":"ELIMINAR TODO")?DANGER:"#94a3b8",border:"none",borderRadius:"10px",color:"#fff",fontWeight:"700",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:"0.5rem"}}>
                {modalElim.procesando?<><RefreshCw size={16} style={{animation:"spin 1s linear infinite"}}/> Eliminando...</>:<><Trash2 size={16}/> Confirmar</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
    </LayoutWithSidebar>
  );
}

const labelSt   = {display:"block",fontWeight:"700",color:"#374151",marginBottom:"0.35rem",fontSize:"0.82rem"};
const inputSt   = {width:"100%",padding:"0.7rem 0.9rem",border:"1.5px solid #e2e8f0",borderRadius:"10px",fontSize:"0.93rem",outline:"none",boxSizing:"border-box"};
const selectSt  = {width:"100%",padding:"0.7rem 2.2rem 0.7rem 0.9rem",border:"1.5px solid #e2e8f0",borderRadius:"10px",fontSize:"0.9rem",outline:"none",boxSizing:"border-box",cursor:"pointer",appearance:"none",background:"#fff"};
const readonlySt= {padding:"0.7rem 0.9rem",background:"#f8fafc",border:"1.5px solid #e2e8f0",borderRadius:"10px",fontSize:"0.9rem",minHeight:"42px",display:"flex",alignItems:"center"};
const tdSt      = {padding:"0.75rem 0.7rem",verticalAlign:"middle"};
