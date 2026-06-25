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
import { usePermisosNomina } from "@/utils/usePermisosNomina";
import LayoutWithSidebar from "@/components/LayoutWithSidebar";
import { calcularNetoOperacion, formatCOP } from "@/utils/nominaCalculos";
import {
  ArrowLeft, Save, Trash2, Edit2, RefreshCw,
  Calendar, ChevronDown, CheckCircle, X,
  FileText, DollarSign, Users, Search, UserCheck,
  Zap, Clock, Plus, ChevronRight, UserPlus
} from "lucide-react";






const inputSt   = {width:"100%",padding:"0.7rem 0.9rem",border:"1.5px solid #e2e8f0",borderRadius:"10px",fontSize:"0.93rem",outline:"none",boxSizing:"border-box"};
const selectSt  = {width:"100%",padding:"0.7rem 2.2rem 0.7rem 0.9rem",border:"1.5px solid #e2e8f0",borderRadius:"10px",fontSize:"0.9rem",outline:"none",boxSizing:"border-box",cursor:"pointer",appearance:"none",background:"#fff"};
const readonlySt= {padding:"0.7rem 0.9rem",background:"#f8fafc",border:"1.5px solid #e2e8f0",borderRadius:"10px",fontSize:"0.9rem",minHeight:"42px",display:"flex",alignItems:"center"};
const tdSt      = {padding:"0.38rem 0.6rem",verticalAlign:"middle",borderBottom:"1px solid #d0d7e0",borderRight:"1px solid #e8ecf0",fontSize:"0.8rem"};

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
const primerDiaMes  = () => { const d=new Date(); return new Date(d.getFullYear(),d.getMonth(),1).toISOString().split("T")[0]; };
const ultimoDiaMes  = () => { const d=new Date(); return new Date(d.getFullYear(),d.getMonth()+1,0).toISOString().split("T")[0]; };
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
  cantidad:"", personas:1, netoCalculado:0,
  tipoSeleccion:"",
  motivo:"",
  // Campos para modo trabajador individual con horas extras
  horasExtras: 1,   // horas extras trabajadas (permite decimales: 1.5, 2, etc.)
  novedad: "",      // novedad del trabajador individual ese día
};

// ── Formulario Cuadrilla Diaria (Terrestre, Ciamsa 2, Ciamsa 3) ──
// El supervisor selecciona múltiples trabajadores por día y registra servicios grupales
const CUADRILLA_DIA_FORM_INIT = {
  fecha: hoy(),
  trabajadoresSeleccionados: [],  // [{id, nombre, cedula, cargo}]
  servicioId: "", servicioNombre: "", tarifaUnitaria: 0, unidad: "ton",
  cantidad: "",
  nPersonas: 0,   // auto = trabajadoresSeleccionados.length
  per: 0,         // cantidad / nPersonas
  netoCalculado: 0, // per × tarifaUnitaria
  motivo: "",
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

// Genera los días Lun-Sáb de una cuadrilla semanal como entradas individuales
function diasDeCuadrillaSemanal(c) {
  if (c.tipo !== "semanal" || !c.semanaDesde || !c.semanaHasta) return [];
  const LETRAS = ["Lun","Mar","Mié","Jue","Vie","Sáb"];
  const MESES_CORTO = ["","Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const dias = [];
  const ini = new Date(c.semanaDesde + "T12:00:00");
  for (let i = 0; i <= 5; i++) {
    const d = new Date(ini); d.setDate(ini.getDate() + i);
    const fecha = d.toISOString().split("T")[0];
    dias.push({
      id: `semanal_dia_${c.id}_${fecha.replace(/-/g,"")}`,
      cuadId: c.id, cuadNombre: c.nombre, fecha,
      label: `${LETRAS[i]} ${parseInt(fecha.split("-")[2])}/${MESES_CORTO[parseInt(fecha.split("-")[1])]}`,
    });
  }
  return dias;
}

// ── Selector con búsqueda para Cuadrilla / Trabajador Individual ──
function SearchableCuadrillaSelect({ cuadrillas, trabajadores, value, onChange, color, onFechaChange, diasSeleccionados, onDiasChange, onMiniClick }) {
  const [query, setQuery]   = useState("");
  const [open,  setOpen]    = useState(false);
  const [semanaOverrides, setSemanaOverrides] = useState({});
  const wrapRef             = useRef(null);

  // Cerrar al click fuera
  useEffect(() => {
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Etiqueta del valor seleccionado
  const etiqueta = () => {
    // MODO MULTI-DÍA: mostrar resumen de días seleccionados
    if (diasSeleccionados?.length > 0) {
      const cuad = cuadrillas.find(c => c.id === diasSeleccionados[0].cuadId);
      const labels = diasSeleccionados.map(d => d.label).join(", ");
      return `📅 ${cuad?.nombre||"Semanal"} · ${labels} (${diasSeleccionados.length} día${diasSeleccionados.length!==1?"s":""})`;    }
    if (!value) return null;
    if (value.startsWith("trab_")) {
      const t = trabajadores.find(x => x.id === value.replace("trab_",""));
      return t ? `👤 ${t.nombre}${t.cedula ? ` · ${t.cedula}` : ""}` : value;
    }
    if (value.startsWith("semanal_dia_")) {
      for (const c of cuadrillas) {
        const dia = diasDeCuadrillaSemanal(c).find(d => d.id === value);
        if (dia) return `📅 ${c.nombre} · ${dia.label}`;
      }
      return value;
    }
    const c = cuadrillas.find(x => x.id === value);
    return c ? `👥 Cuadrilla ${c.nombre} · ${c.miembros?.length||0} miembros` : value;
  };

  const q = query.toLowerCase().trim();
  const trabFiltrados = q
    ? trabajadores.filter(t =>
        t.nombre?.toLowerCase().includes(q) ||
        String(t.cedula||""  ).includes(q)   ||
        (t.cargo||""         ).toLowerCase().includes(q)
      )
    : trabajadores;

  // Cuadrillas normales (no semanales)
  const cuadNormales = cuadrillas
    .filter(c => c.tipo !== "semanal")
    .filter(c => !q || c.nombre?.toLowerCase().includes(q));

  // Cuadrillas semanales con sus días
  const cuadSemanales = cuadrillas
    .filter(c => c.tipo === "semanal")
    .filter(c => !q || c.nombre?.toLowerCase().includes(q) ||
      diasDeCuadrillaSemanal(c).some(d => d.label.toLowerCase().includes(q)));

  const select = (val, fecha) => {
    onChange(val);
    if (fecha && onFechaChange) onFechaChange(fecha);
    setOpen(false); setQuery("");
  };

  return (
    <div ref={wrapRef} style={{position:"relative"}}>
      {/* Trigger */}
      <div
        onClick={() => setOpen(p => !p)}
        style={{
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"0.7rem 0.9rem",
          border:`1.5px solid ${value ? (color||"#0B3D91") : "#e2e8f0"}`,
          borderRadius:"10px", background:"#fff", cursor:"pointer",
          fontSize:"0.9rem", color: value ? "#1e293b" : "#94a3b8",
          fontWeight: value ? "700" : "400",
          boxSizing:"border-box", userSelect:"none",
          transition:"border-color 0.15s",
        }}
      >
        <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>
          {value ? etiqueta() : "— Seleccionar cuadrilla o trabajador —"}
        </span>
        <ChevronDown size={15} style={{marginLeft:"0.5rem",color:"#94a3b8",flexShrink:0,
          transition:"transform 0.2s",transform:open?"rotate(180deg)":"rotate(0deg)"}} />
      </div>

      {/* Dropdown */}
      {open && (
        <div style={{
          position:"absolute",top:"calc(100% + 4px)",left:0,right:0,
          background:"#fff",borderRadius:"12px",
          border:"1.5px solid #e2e8f0",
          boxShadow:"0 8px 28px rgba(0,0,0,0.13)",
          zIndex:999,overflow:"hidden",
        }}>
          {/* Buscador */}
          <div style={{padding:"0.6rem 0.75rem",borderBottom:"1px solid #f1f5f9",background:"#f8fafc"}}>
            <div style={{position:"relative"}}>
              <Search size={14} style={{position:"absolute",left:"0.6rem",top:"50%",transform:"translateY(-50%)",color:"#94a3b8",pointerEvents:"none"}} />
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Buscar cuadrilla, día o trabajador..."
                style={{width:"100%",padding:"0.55rem 0.7rem 0.55rem 2rem",
                  border:"1.5px solid #e2e8f0",borderRadius:"8px",
                  fontSize:"0.88rem",outline:"none",boxSizing:"border-box",background:"#fff"}}
                onClick={e => e.stopPropagation()}
              />
            </div>
          </div>

          {/* Lista */}
          <div style={{maxHeight:"340px",overflowY:"auto"}}>
            {/* Opción vacía */}
            {!q && (
              <div onClick={() => select("")}
                style={{padding:"0.55rem 0.9rem",fontSize:"0.85rem",color:"#94a3b8",cursor:"pointer",
                  background:value===""?"#eff6ff":"transparent",borderBottom:"1px solid #f8fafc"}}>
                — Ninguna —
              </div>
            )}

            {/* CUADRILLAS SEMANALES — checkboxes multi-selección por día */}
            {cuadSemanales.length > 0 && (
              <>
                <div style={{padding:"0.35rem 0.75rem",fontSize:"0.68rem",fontWeight:"800",
                  color:"#059669",textTransform:"uppercase",letterSpacing:"0.07em",
                  background:"#f0fdf4",borderBottom:"1px solid #d1fae5",position:"sticky",top:0,
                  display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <span>📅 CUADRILLAS SEMANALES — marca los días</span>
                  {diasSeleccionados?.length > 0 && (
                    <button onClick={e=>{e.stopPropagation();setOpen(false);}}
                      style={{background:"#059669",color:"#fff",border:"none",borderRadius:"6px",
                        padding:"2px 10px",cursor:"pointer",fontWeight:"800",fontSize:"0.68rem"}}>
                      ✔ Confirmar {diasSeleccionados.length} día{diasSeleccionados.length!==1?"s":""}
                    </button>
                  )}
                </div>
                {cuadSemanales.map(c => {
                  // Aplicar override de fechas si el usuario las cambió
                  const ov = semanaOverrides[c.id];
                  const cEfectivo = ov ? {...c, semanaDesde: ov.desde||c.semanaDesde, semanaHasta: ov.hasta||c.semanaHasta} : c;
                  const todosLosDias = diasDeCuadrillaSemanal(cEfectivo);
                  const diasFiltrados = todosLosDias
                    .filter(d => !q || d.label.toLowerCase().includes(q) || c.nombre.toLowerCase().includes(q));
                  const diasDeEstaCuad = (diasSeleccionados||[]).filter(d => d.cuadId === c.id);
                  const todosSelec = todosLosDias.length > 0 && todosLosDias.every(d => (diasSeleccionados||[]).some(s=>s.id===d.id));
                  const toggleDia = (dia, e) => {
                    e.stopPropagation();
                    const yaSelec = (diasSeleccionados||[]).some(s => s.id === dia.id);
                    let nuevos;
                    if (yaSelec) {
                      nuevos = (diasSeleccionados||[]).filter(s => s.id !== dia.id);
                    } else {
                      // Limpiar días de OTRAS cuadrillas al seleccionar una nueva
                      const deOtrasCuad = (diasSeleccionados||[]).filter(s => s.cuadId !== dia.cuadId);
                      nuevos = [...deOtrasCuad, dia];
                    }
                    onDiasChange?.(nuevos);
                    // Setear cuadrillaId en el form al seleccionar el primer día
                    if (!yaSelec) onChange(c.id);
                  };
                  const toggleTodos = (e) => {
                    e.stopPropagation();
                    const deOtrasCuad = (diasSeleccionados||[]).filter(s => s.cuadId !== c.id);
                    if (todosSelec) {
                      onDiasChange?.(deOtrasCuad);
                      if (deOtrasCuad.length === 0) onChange("");
                    } else {
                      onDiasChange?.([...deOtrasCuad, ...todosLosDias]);
                      onChange(c.id);
                    }
                  };
                  return (
                    <div key={c.id}>
                      {/* Header cuadrilla con btn Todos/Ninguno */}
                      <div style={{padding:"0.4rem 0.75rem 0.25rem",fontSize:"0.78rem",fontWeight:"800",
                        color:"#059669",background:"#f9fafb",borderBottom:"1px solid #f1f5f9",
                        display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:"0.25rem"}}>
                        <div style={{display:"flex",alignItems:"center",gap:"0.4rem",flexWrap:"wrap"}}>
                          <span>👥 {c.nombre}</span>
                          <span style={{fontSize:"0.65rem",color:"#94a3b8",fontWeight:"400"}}>Semana:</span>
                          <input type="date"
                            value={(semanaOverrides[c.id]?.desde)||c.semanaDesde}
                            onClick={e=>e.stopPropagation()}
                            onChange={e=>{
                              e.stopPropagation();
                              const desde=e.target.value;
                              setSemanaOverrides(prev=>({...prev,[c.id]:{...(prev[c.id]||{}),desde}}));
                              // Limpiar días seleccionados de esta cuadrilla al cambiar semana
                              onDiasChange?.((diasSeleccionados||[]).filter(d=>d.cuadId!==c.id));
                              onChange("");
                            }}
                            style={{fontSize:"0.65rem",border:"1px solid #6ee7b7",borderRadius:"3px",
                              padding:"1px 3px",color:"#059669",cursor:"pointer",outline:"none",
                              background:semanaOverrides[c.id]?.desde?"#f0fdf4":"#fff"}}/>
                          <span style={{fontSize:"0.65rem",color:"#94a3b8"}}>→</span>
                          <input type="date"
                            value={(semanaOverrides[c.id]?.hasta)||c.semanaHasta}
                            onClick={e=>e.stopPropagation()}
                            onChange={e=>{
                              e.stopPropagation();
                              const hasta=e.target.value;
                              setSemanaOverrides(prev=>({...prev,[c.id]:{...(prev[c.id]||{}),hasta}}));
                              onDiasChange?.((diasSeleccionados||[]).filter(d=>d.cuadId!==c.id));
                              onChange("");
                            }}
                            style={{fontSize:"0.65rem",border:"1px solid #6ee7b7",borderRadius:"3px",
                              padding:"1px 3px",color:"#059669",cursor:"pointer",outline:"none",
                              background:semanaOverrides[c.id]?.hasta?"#f0fdf4":"#fff"}}/>
                          {(semanaOverrides[c.id]?.desde||semanaOverrides[c.id]?.hasta)&&(
                            <button onClick={e=>{e.stopPropagation();setSemanaOverrides(prev=>{const n={...prev};delete n[c.id];return n;});onDiasChange?.((diasSeleccionados||[]).filter(d=>d.cuadId!==c.id));onChange("");}}
                              style={{fontSize:"0.6rem",background:"#fee2e2",border:"none",borderRadius:"3px",padding:"1px 4px",cursor:"pointer",color:"#dc2626",fontWeight:"700"}}>
                              ↺ Reset
                            </button>
                          )}
                        </div>
                        <div style={{display:"flex",gap:"0.3rem"}}>
                          <button onClick={toggleTodos}
                            style={{background:todosSelec?"#dc2626":"#059669",color:"#fff",border:"none",
                              borderRadius:"5px",padding:"1px 8px",cursor:"pointer",fontWeight:"700",fontSize:"0.67rem"}}>
                            {todosSelec?"Ninguno":"Todos"}
                          </button>
                          {diasDeEstaCuad.length > 0 && !todosSelec && (
                            <span style={{fontSize:"0.67rem",color:"#059669",fontWeight:"700",alignSelf:"center"}}>
                              {diasDeEstaCuad.length}/{todosLosDias.length}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Checkboxes de días */}
                      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"2px",
                        padding:"0.35rem 0.6rem",borderBottom:"1px solid #f1f5f9"}}>
                        {diasFiltrados.map(d => {
                          const selec = (diasSeleccionados||[]).some(s => s.id === d.id);
                          return (
                            <div key={d.id} onClick={e => toggleDia(d, e)}
                              style={{padding:"0.42rem 0.5rem",borderRadius:"8px",cursor:"pointer",
                                display:"flex",alignItems:"center",gap:"0.3rem",
                                background:selec?"#f0fdf4":"#fff",
                                border:`1.5px solid ${selec?"#059669":"#e2e8f0"}`,
                                transition:"all 0.1s"}}
                              onMouseEnter={e=>{if(!selec)e.currentTarget.style.background="#f0fdf4";}}
                              onMouseLeave={e=>{if(!selec)e.currentTarget.style.background="#fff";}}>
                              <div style={{width:"14px",height:"14px",borderRadius:"4px",flexShrink:0,
                                border:`2px solid ${selec?"#059669":"#cbd5e1"}`,
                                background:selec?"#059669":"#fff",
                                display:"flex",alignItems:"center",justifyContent:"center"}}>
                                {selec&&<CheckCircle size={9} color="#fff" strokeWidth={3}/>}
                              </div>
                              <span style={{fontWeight:selec?"800":"600",fontSize:"0.73rem",
                                color:selec?"#065f46":"#374151"}}>{d.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {/* Botón confirmar al final si hay días seleccionados */}
                {diasSeleccionados?.length > 0 && (
                  <div style={{padding:"0.5rem 0.75rem",background:"#f0fdf4",borderBottom:"1px solid #d1fae5"}}>
                    <button onClick={e=>{e.stopPropagation();setOpen(false);}}
                      style={{width:"100%",background:"#059669",color:"#fff",border:"none",
                        borderRadius:"8px",padding:"0.5rem",cursor:"pointer",fontWeight:"800",fontSize:"0.85rem",
                        display:"flex",alignItems:"center",justifyContent:"center",gap:"0.4rem"}}>
                      <CheckCircle size={14}/>
                      Confirmar {diasSeleccionados.length} día{diasSeleccionados.length!==1?"s":""} seleccionado{diasSeleccionados.length!==1?"s":""}
                    </button>
                  </div>
                )}
              </>
            )}

            {/* CUADRILLAS PERMANENTES */}
            {cuadNormales.length > 0 && (
              <>
                <div style={{padding:"0.35rem 0.75rem",fontSize:"0.68rem",fontWeight:"800",
                  color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.07em",
                  background:"#f8fafc",borderBottom:"1px solid #f1f5f9",position:"sticky",top:0}}>
                  👥 CUADRILLAS PERMANENTES
                </div>
                {cuadNormales.map(c => (
                  <div key={c.id}
                    style={{padding:"0.55rem 0.9rem",fontSize:"0.88rem",cursor:"pointer",
                      background:value===c.id?"#eff6ff":"transparent",
                      color:value===c.id?"#0B3D91":"#1e293b",
                      fontWeight:value===c.id?"700":"500",
                      borderBottom:"1px solid #f8fafc",transition:"background 0.1s",
                      display:"flex",alignItems:"center",justifyContent:"space-between",gap:"0.5rem"}}
                    onMouseEnter={e=>{ if(value!==c.id) e.currentTarget.style.background="#f0f9ff"; }}
                    onMouseLeave={e=>{ if(value!==c.id) e.currentTarget.style.background="transparent"; }}>
                    <div onClick={() => select(c.id)} style={{flex:1,cursor:"pointer"}}>
                      Cuadrilla {c.nombre}
                      <span style={{marginLeft:"0.4rem",fontSize:"0.72rem",color:"#94a3b8",fontWeight:"400"}}>
                        · {c.miembros?.length||0} miembros
                      </span>
                    </div>
                    {onMiniClick && (
                      <button
                        onClick={e=>{ e.stopPropagation(); onMiniClick(c); setOpen(false); }}
                        style={{background:"#fff1f2",border:"1px solid #fecdd3",borderRadius:"6px",
                          padding:"2px 8px",cursor:"pointer",color:"#e11d48",fontSize:"0.68rem",
                          fontWeight:"800",whiteSpace:"nowrap",flexShrink:0,
                          display:"flex",alignItems:"center",gap:"3px"}}>
                        ⚡ Mini
                      </button>
                    )}
                  </div>
                ))}
              </>
            )}

            {/* Trabajadores individuales */}
            {trabFiltrados.length > 0 && (
              <>
                <div style={{padding:"0.35rem 0.75rem",fontSize:"0.68rem",fontWeight:"800",
                  color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.07em",
                  background:"#f8fafc",borderBottom:"1px solid #f1f5f9",position:"sticky",top:0}}>
                  👤 TRABAJADORES{q ? ` (${trabFiltrados.length})` : ` INDIVIDUALES (${trabFiltrados.length})`}
                </div>
                {trabFiltrados.map(t => {
                  const val = `trab_${t.id}`;
                  return (
                    <div key={t.id} onClick={() => select(val)}
                      style={{padding:"0.55rem 0.9rem",fontSize:"0.85rem",cursor:"pointer",
                        background:value===val?"#eff6ff":"transparent",
                        color:value===val?"#0B3D91":"#1e293b",
                        fontWeight:value===val?"700":"400",
                        borderBottom:"1px solid #f8fafc",transition:"background 0.1s",
                        display:"flex",alignItems:"center",justifyContent:"space-between",gap:"0.5rem"}}
                      onMouseEnter={e=>{ if(value!==val) e.currentTarget.style.background="#f0f9ff"; }}
                      onMouseLeave={e=>{ if(value!==val) e.currentTarget.style.background="transparent"; }}>
                      <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.nombre}</span>
                      <span style={{fontFamily:"monospace",fontSize:"0.75rem",color:"#64748b",flexShrink:0}}>
                        {t.cedula||""}
                      </span>
                    </div>
                  );
                })}
              </>
            )}

            {/* Sin resultados */}
            {q && trabFiltrados.length === 0 && cuadFiltradas.length === 0 && (
              <div style={{padding:"1.5rem",textAlign:"center",color:"#94a3b8",fontSize:"0.85rem"}}>
                😕 Sin resultados para «{query}»
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

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
          {t.dias.length===1?"servicio":"servicios"}
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
                  <td colSpan={2} style={{padding:"0.4rem 0.6rem",fontWeight:"700",color:"#065f46",fontSize:"0.72rem"}}>Total ({t.dias.length} servicio{t.dias.length!==1?"s":""})</td>
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

// ─────────────────────────────────────────────────────────────────────────────
// CONJUNTOS — Panel embebido en Matriz
// Un «conjunto» agrupa trabajadores de distintas cuadrillas para una operación
// ─────────────────────────────────────────────────────────────────────────────
const CONJUNTO_FORM_INIT = {
  nombre: "",
  fecha: "",
  trabajadoresSeleccionados: [], // [{id, nombre, cedula, cuadrillaNombre}]
  servicioId: "",
  servicioNombre: "",
  servicioValor: 0,
  cantidad: 1,
  netoCalculado: 0,
};

function ConjuntosPanel({ cuadrillas, servicios, clienteId, onGuardado, onClose, todosTrabajadores, clientes }) {
  const [form, setForm]   = useState({ ...CONJUNTO_FORM_INIT, fecha: hoy() });
  const [guardando, setGuardando] = useState(false);
  const [okMsg, setOkMsg] = useState("");
  const [historial, setHistorial] = useState([]);
  const [cargando, setCargando]   = useState(false);
  const [busq, setBusq]           = useState("");
  const [cuadExpandida, setCuadExpandida] = useState(null);
  const [serviciosExtra, setServiciosExtra] = useState([]);
  const sExtraNext = useRef(1);
  const [editandoConjuntoId, setEditandoConjuntoId] = useState(null);
  const [errNombre, setErrNombre] = useState("");

  const recalc = (f) => {
    const n    = f.trabajadoresSeleccionados.length || 1;
    const neto = Math.round(calcularNetoOperacion(parseFloat(f.servicioValor)||0, n, parseInt(f.cantidad)||1)*100)/100;
    return { ...f, netoCalculado: neto };
  };

  const setF = (key, val) => setForm(prev => {
    const next = { ...prev, [key]: val };
    return ["servicioValor","cantidad","trabajadoresSeleccionados"].includes(key) ? recalc(next) : next;
  });

  const toggleTrab = (t, cuadNom, clienteNombre, clienteColor) => {
    const sel = form.trabajadoresSeleccionados;
    const ya  = sel.some(x => x.id === t.id);
    const nuevo = ya
      ? sel.filter(x => x.id !== t.id)
      : [...sel, { id:t.id, nombre:t.nombre, cedula:t.cedula||"", cuadrillaNombre: cuadNom, clienteNombre: clienteNombre||"SPIA", clienteColor: clienteColor||"#0B3D91" }];
    setF("trabajadoresSeleccionados", nuevo);
  };

  const selServicio = (id) => {
    const s = servicios.find(x => x.id === id);
    if (!s) { setForm(prev => recalc({...prev, servicioId:"", servicioNombre:"", servicioValor:0})); return; }
    setForm(prev => recalc({...prev, servicioId:s.id, servicioNombre:s.nombre, servicioValor:s.valor||s.tarifa||0}));
  };

  const sExtraAdd = () => setServiciosExtra(prev => [
    ...prev, { uid: sExtraNext.current++, servicioId:"", servicioNombre:"", servicioValor:0, cantidad:1, netoCalculado:0 }
  ]);
  const sExtraUpdate = (uid, field, val) => setServiciosExtra(prev => prev.map(s => {
    if (s.uid !== uid) return s;
    const next = { ...s, [field]: val };
    if (field === "servicioId") {
      const srv = servicios.find(x => x.id === val);
      next.servicioNombre = srv?.nombre || "";
      next.servicioValor  = srv?.valor || srv?.tarifa || 0;
    }
    const n = form.trabajadoresSeleccionados.length || 1;
    next.netoCalculado = Math.round(calcularNetoOperacion(parseFloat(next.servicioValor)||0, n, parseFloat(next.cantidad)||1)*100)/100;
    return next;
  }));
  const sExtraRemove = (uid) => setServiciosExtra(prev => prev.filter(s => s.uid !== uid));

  const cargarHistorial = async () => {
    setCargando(true);
    try {
      const snap = await getDocs(query(collection(db,"nomina_conjuntos"), orderBy("creadoEn","desc")));
      setHistorial(snap.docs.slice(0,15).map(d=>({id:d.id,...d.data()})));
    } catch(e) { console.error(e); }
    setCargando(false);
  };

  useEffect(() => { cargarHistorial(); }, []);

  const guardar = async () => {
    if (!form.nombre.trim())                    { alert("Escribe un nombre para el conjunto."); return; }
    if (form.trabajadoresSeleccionados.length===0) { alert("Selecciona al menos un trabajador."); return; }
    if (!form.servicioId)                       { alert("Selecciona el servicio."); return; }
    if (!form.fecha)                            { alert("Indica la fecha."); return; }
    // Bloquear nombre duplicado al CREAR
    if (!editandoConjuntoId) {
      const nombreUp = form.nombre.trim().toUpperCase();
      if (historial.some(c => c.nombre === nombreUp)) {
        setErrNombre(`❌ Ya existe un conjunto "${nombreUp}". Edítalo desde el historial o elige otro nombre.`);
        return;
      }
    }
    setErrNombre("");
    setGuardando(true);
    try {
      const n    = form.trabajadoresSeleccionados.length;
      const neto = Math.round(calcularNetoOperacion(parseFloat(form.servicioValor)||0, n, parseInt(form.cantidad)||1)*100)/100;
      const nombreFinal = form.nombre.trim().toUpperCase();
      const cuadNom = `🔗 ${nombreFinal}`;
      const opBase = {
        clienteId, modoCiamsa:false, esConjunto:true,
        cuadrillaNombre: cuadNom, cuadrilla: cuadNom,
        cuadrillaPersonas: n,
        fecha:    Timestamp.fromDate(new Date(form.fecha+"T12:00:00")),
        fechaStr: form.fecha,
        servicioNombre:        form.servicioNombre.toUpperCase(),
        servicioValorUnitario: parseFloat(form.servicioValor)||0,
        servicioValor:         (parseFloat(form.servicioValor)||0)*(parseInt(form.cantidad)||1),
        cantidad:  parseInt(form.cantidad)||1, personas: n,
        modoHorasExtras:false, horasExtras:null,
        netoAPagar: neto,
        trabajadoresAsisten:  form.trabajadoresSeleccionados.map(t=>({id:t.id,nombre:t.nombre,cedula:t.cedula||""})),
        trabajadoresAusentes: [], actualizadoEn: new Date(),
      };
      const guardarExtras = async (conjId) => {
        for (const se of serviciosExtra) {
          if (!se.servicioNombre||!se.cantidad) continue;
          const netoSe=Math.round(calcularNetoOperacion(parseFloat(se.servicioValor)||0,n,parseFloat(se.cantidad)||1)*100)/100;
          await addDoc(collection(db,"nomina_operaciones"),{...opBase,conjuntoId:conjId,cuadrillaId:`conjunto_${conjId}`,servicioNombre:se.servicioNombre.toUpperCase(),servicioValorUnitario:parseFloat(se.servicioValor)||0,servicioValor:(parseFloat(se.servicioValor)||0)*parseFloat(se.cantidad||1),cantidad:parseFloat(se.cantidad)||1,netoAPagar:netoSe,creadoEn:new Date(),actualizadoEn:new Date()});
        }
      };
      const payload = { clienteId, nombre:nombreFinal, fecha:form.fecha, trabajadores:form.trabajadoresSeleccionados, servicioId:form.servicioId, servicioNombre:form.servicioNombre, servicioValor:parseFloat(form.servicioValor)||0, cantidad:parseInt(form.cantidad)||1, netoAPagar:neto, actualizadoEn:new Date() };
      if (editandoConjuntoId) {
        // EDITAR conjunto existente
        await updateDoc(doc(db,"nomina_conjuntos",editandoConjuntoId), payload);
        const opSnap = await getDocs(query(collection(db,"nomina_operaciones"),where("conjuntoId","==",editandoConjuntoId)));
        for (const d of opSnap.docs) await deleteDoc(d.ref);
        await addDoc(collection(db,"nomina_operaciones"),{...opBase,conjuntoId:editandoConjuntoId,cuadrillaId:`conjunto_${editandoConjuntoId}`,creadoEn:new Date()});
        await guardarExtras(editandoConjuntoId);
        setOkMsg(`✅ Conjunto "${nombreFinal}" actualizado`);
        setEditandoConjuntoId(null);
      } else {
        // CREAR nuevo
        const ref = await addDoc(collection(db,"nomina_conjuntos"),{...payload,creadoEn:new Date()});
        await addDoc(collection(db,"nomina_operaciones"),{...opBase,conjuntoId:ref.id,cuadrillaId:`conjunto_${ref.id}`,creadoEn:new Date()});
        await guardarExtras(ref.id);
        setOkMsg(`✅ Conjunto "${nombreFinal}" creado — ${n} trabajadores`);
      }
      setTimeout(()=>setOkMsg(""),4000);
      setForm({...CONJUNTO_FORM_INIT, fecha:form.fecha});
      setServiciosExtra([]);
      setBusq("");
      await cargarHistorial();
      onGuardado();
    } catch(e) { alert("Error: "+e.message); }
    setGuardando(false);
  };

  const iniciarEdicion = (c) => {
    setEditandoConjuntoId(c.id);
    setErrNombre("");
    const srv = servicios.find(s=>s.nombre.toUpperCase()===c.servicioNombre?.toUpperCase());
    setForm({ nombre:c.nombre, fecha:c.fecha, trabajadoresSeleccionados:c.trabajadores||[], servicioId:srv?.id||"", servicioNombre:c.servicioNombre||"", servicioValor:c.servicioValor||0, cantidad:c.cantidad||1, netoCalculado:c.netoAPagar||0 });
    setServiciosExtra([]);
    setBusq("");
  };

  const cancelarEdicion = () => {
    setEditandoConjuntoId(null);
    setErrNombre("");
    setForm({...CONJUNTO_FORM_INIT,fecha:hoy()});
    setServiciosExtra([]);
  };

  const eliminarConjunto = async (c) => {
    if (!confirm(`¿Eliminar conjunto "${c.nombre}"?`)) return;
    try {
      await deleteDoc(doc(db,"nomina_conjuntos",c.id));
      const opSnap = await getDocs(query(collection(db,"nomina_operaciones"),where("conjuntoId","==",c.id)));
      for (const d of opSnap.docs) await deleteDoc(d.ref);
      await cargarHistorial();
      onGuardado();
    } catch(e) { alert("Error: "+e.message); }
  };

  const CONJ_COLOR = "#7c3aed";
  const q = busq.toLowerCase().trim();

  return (
    <div style={{background:"#fff",borderRadius:"16px",
      boxShadow:"0 4px 24px rgba(124,58,237,0.10)",
      border:`2px solid ${CONJ_COLOR}30`,
      marginBottom:"1.5rem",overflow:"hidden"}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
        padding:"0.9rem 1.25rem",
        background:`linear-gradient(135deg,${CONJ_COLOR}15 0%,#f5f3ff 100%)`,
        borderBottom:`2px solid ${CONJ_COLOR}20`}}>
        <div style={{display:"flex",alignItems:"center",gap:"0.6rem"}}>
          <div style={{background:CONJ_COLOR,borderRadius:"10px",padding:"0.5rem",
            display:"flex",alignItems:"center",justifyContent:"center"}}>
            <Users size={18} color="#fff"/>
          </div>
          <div>
            <div style={{fontWeight:"800",fontSize:"1rem",color:CONJ_COLOR}}>🔗 Conjuntos de Cuadrillas</div>
            <div style={{fontSize:"0.75rem",color:"#94a3b8"}}>Agrupa trabajadores de distintas cuadrillas en una operación</div>
          </div>
        </div>
        <button onClick={onClose}
          style={{background:"#f1f5f9",border:"none",borderRadius:"8px",padding:"0.5rem",cursor:"pointer",color:"#64748b"}}>
          <X size={16}/>
        </button>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0"}}>
        {/* ── COLUMNA IZQ: Formulario ── */}
        <div style={{padding:"1.25rem",borderRight:`1px solid ${CONJ_COLOR}15`}}>
          <div style={{fontWeight:"800",fontSize:"0.82rem",
            color:editandoConjuntoId?"#92400e":CONJ_COLOR,
            textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"1rem",
            display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <span>{editandoConjuntoId?"✏️ Editando conjunto":"\uD83D\uDCCB Nuevo Conjunto"}</span>
            {editandoConjuntoId && (
              <button onClick={cancelarEdicion}
                style={{background:"#fef3c7",border:"1.5px solid #fcd34d",borderRadius:"7px",
                  padding:"2px 10px",cursor:"pointer",color:"#92400e",fontWeight:"700",fontSize:"0.75rem"}}>
                × Cancelar
              </button>
            )}
          </div>

          {/* Nombre */}
          <div style={{marginBottom:"0.9rem"}}>
            <label style={{...labelSt,color:editandoConjuntoId?"#92400e":CONJ_COLOR}}>
              1️⃣ Nombre del conjunto *
            </label>
            <input value={form.nombre} onChange={e=>{setF("nombre",e.target.value);setErrNombre("");}}
              placeholder="Ej: ALFA, BETA, TOTAL..."
              disabled={!!editandoConjuntoId}
              style={{...inputSt,border:`1.5px solid ${errNombre?"#ef4444":editandoConjuntoId?"#fcd34d":CONJ_COLOR+"60"}`,fontWeight:"700",textTransform:"uppercase",background:editandoConjuntoId?"#fffbeb":"#fff"}}/>
            {errNombre && (
              <div style={{marginTop:"0.35rem",fontSize:"0.78rem",color:"#dc2626",fontWeight:"600",
                background:"#fee2e2",border:"1px solid #fecaca",borderRadius:"7px",padding:"0.4rem 0.65rem"}}>
                {errNombre}
              </div>
            )}
          </div>

          {/* Fecha */}
          <div style={{marginBottom:"0.9rem"}}>
            <label style={labelSt}>📅 Fecha *</label>
            <input type="date" value={form.fecha} onChange={e=>setF("fecha",e.target.value)}
              style={{...inputSt,border:`1.5px solid ${CONJ_COLOR}60`}}/>
          </div>

          {/* Buscador + lista de trabajadores por cuadrilla */}
          <div style={{marginBottom:"0.9rem"}}>
            <label style={{...labelSt,color:CONJ_COLOR}}>2️⃣ Seleccionar trabajadores
              <span style={{fontWeight:"400",color:"#94a3b8",marginLeft:"0.4rem"}}>
                ({form.trabajadoresSeleccionados.length} seleccionados)
              </span>
            </label>
            <input value={busq} onChange={e=>setBusq(e.target.value)}
              placeholder="🔍 Buscar por nombre o cédula..."
              style={{...inputSt,padding:"0.45rem 0.75rem",fontSize:"0.82rem",marginBottom:"0.4rem"}}/>
            <div style={{border:`1.5px solid ${CONJ_COLOR}30`,borderRadius:"10px",overflow:"hidden",maxHeight:"260px",overflowY:"auto"}}>
              {cuadrillas.filter(c=>c.tipo!=="semanal").map(c => {
                const cliId   = c.clienteId || "spia";
                const cliInfo = (clientes||[]).find(x=>x.id===cliId) || {nombre:cliId.toUpperCase(),color:"#64748b"};
                const miembrosFilt = (c.miembros||[]).filter(m =>
                  !q || m.nombre?.toLowerCase().includes(q) || String(m.cedula||'').includes(busq)
                );
                if (miembrosFilt.length===0 && !q) return null;
                if (miembrosFilt.length===0) return null;
                const expanded = cuadExpandida===c.id || q.length>0;
                const selEnCuad = form.trabajadoresSeleccionados.filter(x=>
                  (c.miembros||[]).some(m=>m.id===x.id)
                ).length;
                return (
                  <div key={c.id}>
                    <div onClick={()=>setCuadExpandida(expanded&&!q?null:c.id)}
                      style={{padding:"0.4rem 0.75rem",background:`${CONJ_COLOR}08`,
                        borderBottom:`1px solid ${CONJ_COLOR}15`,
                        display:"flex",alignItems:"center",justifyContent:"space-between",
                        cursor:"pointer",position:"sticky",top:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:"0.4rem"}}>
                        <span style={{fontWeight:"700",fontSize:"0.78rem",color:CONJ_COLOR}}>
                          👥 {c.nombre}
                        </span>
                        <span style={{background:cliInfo.color+"22",color:cliInfo.color,
                          border:`1px solid ${cliInfo.color}44`,
                          borderRadius:"6px",padding:"1px 6px",fontSize:"0.63rem",fontWeight:"800"}}>
                          {cliInfo.nombre}
                        </span>
                      </div>
                      {selEnCuad>0 && (
                        <span style={{background:CONJ_COLOR,color:"#fff",borderRadius:"12px",
                          padding:"1px 8px",fontSize:"0.68rem",fontWeight:"800"}}>
                          {selEnCuad} ✓
                        </span>
                      )}
                    </div>
                    {expanded && miembrosFilt.map(m => {
                      const sel = form.trabajadoresSeleccionados.some(x=>x.id===m.id);
                      return (
                        <div key={m.id} onClick={()=>toggleTrab(m, c.nombre, cliInfo.nombre, cliInfo.color)}
                          style={{display:"flex",alignItems:"center",gap:"0.5rem",
                            padding:"0.38rem 0.75rem",
                            background:sel?`${CONJ_COLOR}10`:"#fff",
                            borderBottom:`1px solid ${CONJ_COLOR}08`,
                            cursor:"pointer"}}
                          onMouseEnter={e=>{if(!sel)e.currentTarget.style.background="#f5f3ff";}}
                          onMouseLeave={e=>{if(!sel)e.currentTarget.style.background="#fff";}}>
                          <div style={{width:"15px",height:"15px",borderRadius:"4px",flexShrink:0,
                            border:`2px solid ${sel?CONJ_COLOR:"#cbd5e1"}`,
                            background:sel?CONJ_COLOR:"#fff",
                            display:"flex",alignItems:"center",justifyContent:"center"}}>
                            {sel&&<CheckCircle size={9} color="#fff" strokeWidth={3}/>}
                          </div>
                          <span style={{flex:1,fontSize:"0.82rem",fontWeight:sel?"700":"400",
                            color:sel?CONJ_COLOR:"#1e293b",
                            overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                            {m.nombre}
                          </span>
                          <span style={{fontSize:"0.7rem",fontFamily:"monospace",color:"#94a3b8"}}>{m.cedula||""}</span>
                          <span style={{background:cliInfo.color+"18",color:cliInfo.color,
                            borderRadius:"5px",padding:"1px 5px",fontSize:"0.62rem",fontWeight:"800",flexShrink:0}}>
                            {cliInfo.nombre.split(" ")[0]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            {/* Chips seleccionados */}
            {form.trabajadoresSeleccionados.length>0 && (
              <div style={{marginTop:"0.4rem",display:"flex",flexWrap:"wrap",gap:"0.25rem"}}>
                {form.trabajadoresSeleccionados.map(t=>(
                  <span key={t.id} onClick={()=>setF("trabajadoresSeleccionados",
                    form.trabajadoresSeleccionados.filter(x=>x.id!==t.id))}
                    style={{background:`${t.clienteColor||CONJ_COLOR}18`,color:t.clienteColor||CONJ_COLOR,
                      border:`1px solid ${t.clienteColor||CONJ_COLOR}40`,borderRadius:"20px",
                      padding:"0.18rem 0.55rem",fontSize:"0.72rem",fontWeight:"700",
                      cursor:"pointer",display:"flex",alignItems:"center",gap:"0.25rem"}}>
                    {t.nombre.split(" ")[0]}
                    {t.clienteNombre&&<span style={{fontSize:"0.6rem",opacity:0.7}}> {t.clienteNombre.split(" ")[0]}</span>}
                    <X size={9}/>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Servicio + cantidad */}
          <div style={{marginBottom:"0.9rem"}}>
            <label style={labelSt}>3️⃣ Servicio *</label>
            <div style={{position:"relative"}}>
              <select value={form.servicioId} onChange={e=>selServicio(e.target.value)}
                style={{...selectSt,border:`1.5px solid ${CONJ_COLOR}60`}}>
                <option value="">— Seleccionar servicio —</option>
                {servicios.map(s=>(
                  <option key={s.id} value={s.id}>{s.nombre} · {formatCOP(s.valor||s.tarifa||0)}</option>
                ))}
              </select>
              <ChevronDown size={14} style={{position:"absolute",right:"0.65rem",top:"50%",transform:"translateY(-50%)",color:"#94a3b8",pointerEvents:"none"}}/>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.6rem",marginBottom:"1rem"}}>
            <div>
              <label style={labelSt}>📦 Cantidad</label>
              <input type="number" min="1" value={form.cantidad}
                onChange={e=>setF("cantidad",e.target.value)}
                style={{...inputSt,border:`1.5px solid ${CONJ_COLOR}60`,textAlign:"center"}}/>
            </div>
            <div>
              <label style={{...labelSt,color:"#065f46"}}>💰 Neto por persona</label>
              <div style={{...readonlySt,background:form.netoCalculado>0?"#f0fdf4":"#f8fafc",
                border:`1.5px solid ${form.netoCalculado>0?"#6ee7b7":"#e2e8f0"}`,
                fontWeight:"900",color:"#065f46",fontFamily:"monospace",fontSize:"1rem"}}>
                {form.netoCalculado>0?formatCOP(form.netoCalculado):"—"}
              </div>
            </div>
          </div>

          {okMsg && (
            <div style={{background:"#f0fdf4",border:"1.5px solid #6ee7b7",borderRadius:"10px",
              padding:"0.6rem 0.9rem",color:"#065f46",fontWeight:"700",fontSize:"0.85rem",
              marginBottom:"0.75rem"}}>{okMsg}</div>
          )}
          {/* Multi-servicio */}
          {serviciosExtra.length>0 && (
            <div style={{borderRadius:"10px",border:"1.5px solid #e0e7ff",overflow:"hidden",background:"#f5f8ff",marginBottom:"0.5rem"}}>
              <div style={{padding:"0.4rem 0.8rem",background:"#4f46e5",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <span style={{fontWeight:"800",color:"#fff",fontSize:"0.78rem"}}>➕ Servicios adicionales ({serviciosExtra.length})</span>
                <span style={{fontSize:"0.68rem",color:"rgba(255,255,255,0.75)"}}>Un registro por servicio</span>
              </div>
              {serviciosExtra.map((se,si)=>(
                <div key={se.uid} style={{display:"grid",gridTemplateColumns:"1fr auto auto auto",gap:"0.5rem",
                  alignItems:"end",padding:"0.55rem 0.8rem",borderBottom:"1px solid #e0e7ff",
                  background:si%2===0?"#f5f8ff":"#eef2ff"}}>
                  <div>
                    <label style={{...labelSt,color:"#4f46e5",fontSize:"0.7rem"}}>🔧 Servicio {si+2}</label>
                    <div style={{position:"relative"}}>
                      <select value={se.servicioId} onChange={e=>sExtraUpdate(se.uid,"servicioId",e.target.value)}
                        style={{...selectSt,border:"1.5px solid #a5b4fc",fontSize:"0.82rem"}}>
                        <option value="">— Seleccionar —</option>
                        {servicios.map(s=>(<option key={s.id} value={s.id}>{s.nombre}</option>))}
                      </select>
                      <ChevronDown size={12} style={{position:"absolute",right:"0.5rem",top:"50%",transform:"translateY(-50%)",color:"#94a3b8",pointerEvents:"none"}}/>
                    </div>
                  </div>
                  <div style={{minWidth:"75px"}}>
                    <label style={{...labelSt,color:"#4f46e5",fontSize:"0.7rem"}}>📦 Cant.</label>
                    <input type="number" min="1" value={se.cantidad} onChange={e=>sExtraUpdate(se.uid,"cantidad",e.target.value)}
                      style={{...inputSt,border:"1.5px solid #a5b4fc",textAlign:"center",fontSize:"0.82rem"}}/>
                  </div>
                  <div style={{minWidth:"90px"}}>
                    <label style={{...labelSt,color:"#065f46",fontSize:"0.7rem"}}>💰 Neto</label>
                    <div style={{...readonlySt,background:se.netoCalculado>0?"#f0fdf4":"#f8fafc",
                      border:`1.5px solid ${se.netoCalculado>0?"#6ee7b7":"#e2e8f0"}`,
                      fontWeight:"800",color:"#065f46",fontFamily:"monospace",fontSize:"0.85rem"}}>
                      {se.netoCalculado>0?formatCOP(se.netoCalculado):"—"}
                    </div>
                  </div>
                  <button onClick={()=>sExtraRemove(se.uid)}
                    style={{background:"#fff1f2",border:"1px solid #fecdd3",borderRadius:"7px",
                      padding:"0.45rem 0.5rem",cursor:"pointer",color:"#e11d48",display:"flex",alignItems:"center"}}>
                    <X size={13}/>
                  </button>
                </div>
              ))}
            </div>
          )}
          <button type="button" onClick={sExtraAdd}
            style={{width:"100%",marginBottom:"0.75rem",background:"#eef2ff",
              border:"1.5px dashed #818cf8",borderRadius:"8px",padding:"0.4rem",
              cursor:"pointer",color:"#4f46e5",fontWeight:"700",fontSize:"0.78rem",
              display:"flex",alignItems:"center",justifyContent:"center",gap:"0.35rem"}}>
            <Plus size={13}/> Agregar otro servicio
          </button>
          <button onClick={guardar} disabled={guardando}
            style={{width:"100%",padding:"0.8rem",
              background:guardando?"#94a3b8":CONJ_COLOR,
              border:"none",borderRadius:"10px",color:"#fff",
              fontWeight:"800",fontSize:"0.9rem",cursor:"pointer",
              display:"flex",alignItems:"center",justifyContent:"center",gap:"0.5rem"}}>
            {guardando?<><RefreshCw size={16} style={{animation:"spin 1s linear infinite"}}/> Guardando...</>
              :<><Users size={16}/> Crear Conjunto</>}
          </button>
        </div>

        {/* ── COLUMNA DER: Historial ── */}
        <div style={{padding:"1.25rem",background:"#fafafa"}}>
          <div style={{fontWeight:"800",fontSize:"0.82rem",color:"#64748b",
            textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"1rem",
            display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <span>🔗 Conjuntos Recientes</span>
            <button onClick={cargarHistorial}
              style={{background:"transparent",border:"none",cursor:"pointer",color:"#94a3b8"}}>
              <RefreshCw size={13}/>
            </button>
          </div>
          {cargando?(
            <div style={{textAlign:"center",padding:"2rem",color:"#94a3b8"}}>
              <RefreshCw size={20} style={{animation:"spin 1s linear infinite"}}/>
            </div>
          ):historial.length===0?(
            <div style={{textAlign:"center",padding:"2rem",color:"#cbd5e1"}}>
              <Users size={32} color="#e2e8f0" style={{marginBottom:"0.5rem"}}/>
              <div style={{fontSize:"0.85rem"}}>Sin conjuntos creados</div>
            </div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:"0.6rem",maxHeight:"520px",overflowY:"auto"}}>
              {historial.map(c=>(
                <div key={c.id} style={{background:"#fff",borderRadius:"10px",
                  border:`1.5px solid ${CONJ_COLOR}25`,padding:"0.75rem",fontSize:"0.82rem",
                  boxShadow:`0 1px 4px ${CONJ_COLOR}10`}}>
                  <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:"0.35rem"}}>
                    <div>
                      <span style={{background:`${CONJ_COLOR}15`,color:CONJ_COLOR,
                        borderRadius:"6px",padding:"1px 8px",fontWeight:"800",fontSize:"0.78rem"}}>
                        🔗 {c.nombre}
                      </span>
                      <span style={{marginLeft:"0.4rem",color:"#64748b",fontSize:"0.72rem",fontFamily:"monospace"}}>
                        {c.fecha}
                      </span>
                    </div>
                    <button onClick={()=>eliminarConjunto(c)}
                      style={{background:"#fff1f2",border:"none",borderRadius:"6px",
                        padding:"2px 5px",cursor:"pointer",color:"#ef4444"}}>
                      <Trash2 size={11}/>
                    </button>
                  </div>
                  <button onClick={()=>iniciarEdicion(c)}
                    style={{marginBottom:"0.35rem",background:`${CONJ_COLOR}10`,
                      border:`1px solid ${CONJ_COLOR}30`,borderRadius:"6px",
                      padding:"2px 10px",cursor:"pointer",color:CONJ_COLOR,
                      fontWeight:"700",fontSize:"0.7rem",display:"flex",alignItems:"center",gap:"0.3rem"}}>
                    ✏️ Editar conjunto
                  </button>
                  <div style={{color:"#334155",fontWeight:"600",marginBottom:"0.25rem"}}>{c.servicioNombre}</div>
                  <div style={{display:"flex",gap:"0.4rem",flexWrap:"wrap"}}>
                    <span style={{background:"#f0f9ff",color:"#0ea5e9",borderRadius:"5px",
                      padding:"1px 7px",fontSize:"0.7rem",fontWeight:"700"}}>
                      👥 {c.trabajadores?.length||0} trabajadores
                    </span>
                    <span style={{background:"#f0fdf4",color:"#065f46",borderRadius:"5px",
                      padding:"1px 7px",fontSize:"0.7rem",fontWeight:"900",fontFamily:"monospace"}}>
                      {formatCOP(c.netoAPagar)}/p
                    </span>
                  </div>
                  <div style={{marginTop:"0.35rem",display:"flex",flexWrap:"wrap",gap:"0.2rem"}}>
                    {(c.trabajadores||[]).slice(0,5).map(t=>(
                      <span key={t.id} style={{background:"#f8fafc",borderRadius:"5px",
                        padding:"1px 6px",fontSize:"0.67rem",color:"#475569",
                        border:"1px solid #e2e8f0"}}>
                        {t.nombre.split(" ")[0]}
                        {t.cuadrillaNombre&&<span style={{color:"#94a3b8",fontSize:"0.6rem"}}> C{t.cuadrillaNombre}</span>}
                      </span>
                    ))}
                    {(c.trabajadores||[]).length>5&&(
                      <span style={{fontSize:"0.68rem",color:"#94a3b8"}}>+{(c.trabajadores||[]).length-5} más</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// MINI CUADRILLAS — Panel embebido en Matriz
// Una «mini cuadrilla» es un subconjunto de la cuadrilla principal que trabaja
// las horas restantes del día para completar contenedores pendientes.
// ─────────────────────────────────────────────────────────────────────────────
const MINI_FORM_INIT = {
  cuadrillaPrincipalId: "",
  cuadrillaPrincipalNombre: "",
  fecha: "",
  miembrosSeleccionados: [],
  horasInicio: "15:00",
  horasFin: "",
  horas: 3,
  servicioId: "",
  servicioNombre: "",
  servicioValor: 0,
  contenedores: 1,
  netoCalculado: 0,
};

function MiniCuadrillaPanel({ cuadrillas, servicios, clienteId, onGuardado, onClose, todosTrabajadores, clientes }) {
  const [miniForm, setMiniForm] = useState({ ...MINI_FORM_INIT, fecha: hoy() });
  const [guardando, setGuardando] = useState(false);
  const [okMsg, setOkMsg] = useState("");
  const [miniCuadrillas, setMiniCuadrillas] = useState([]);
  const [cargandoLista, setCargandoLista] = useState(false);
  const [busqAdicional, setBusqAdicional] = useState("");

  // Calcular neto cada vez que cambian los valores
  const recalcMini = (f) => {
    const n = f.miembrosSeleccionados.length || 1;
    const neto = Math.round(
      calcularNetoOperacion(parseFloat(f.servicioValor)||0, n, parseInt(f.contenedores)||1) * 100
    ) / 100;
    return { ...f, netoCalculado: neto };
  };

  const setMF = (key, val) => setMiniForm(prev => {
    const next = { ...prev, [key]: val };
    return ["servicioValor","contenedores","miembrosSeleccionados"].includes(key) ? recalcMini(next) : next;
  });

  const cuadActual = cuadrillas.find(c => c.id === miniForm.cuadrillaPrincipalId);
  const miembros   = cuadActual?.miembros || [];

  const toggleMiembro = (m) => {
    const sel = miniForm.miembrosSeleccionados;
    const existe = sel.some(x => x.id === m.id);
    const next = existe ? sel.filter(x => x.id !== m.id) : [...sel, { id:m.id, nombre:m.nombre, cedula:m.cedula||"" }];
    setMF("miembrosSeleccionados", next);
  };

  const selTodos = () => setMF("miembrosSeleccionados", miembros.map(m=>({id:m.id,nombre:m.nombre,cedula:m.cedula||""})));
  const deselTodos = () => setMF("miembrosSeleccionados", []);

  const selServicio = (id) => {
    const s = servicios.find(x=>x.id===id);
    if (!s) { setMF("servicioId",""); return; }
    setMiniForm(prev => recalcMini({ ...prev, servicioId:s.id, servicioNombre:s.nombre, servicioValor:s.valor||s.tarifa||0 }));
  };

  const cargarLista = async () => {
    setCargandoLista(true);
    try {
      const snap = await getDocs(query(
        collection(db, "nomina_mini_cuadrillas"),
        orderBy("creadoEn","desc")
      ));
      setMiniCuadrillas(snap.docs.slice(0,15).map(d=>({id:d.id,...d.data()})));
    } catch(e) { console.error(e); }
    setCargandoLista(false);
  };

  useEffect(() => { cargarLista(); }, []);

  const guardar = async () => {
    if (!miniForm.cuadrillaPrincipalId) { alert("Selecciona la cuadrilla principal."); return; }
    if (miniForm.miembrosSeleccionados.length === 0) { alert("Selecciona al menos un miembro."); return; }
    if (!miniForm.servicioId) { alert("Selecciona el servicio."); return; }
    if (!miniForm.fecha) { alert("Indica la fecha."); return; }
    setGuardando(true);
    try {
      const n = miniForm.miembrosSeleccionados.length;
      const neto = Math.round(calcularNetoOperacion(
        parseFloat(miniForm.servicioValor)||0, n, parseInt(miniForm.contenedores)||1
      )*100)/100;
      // 1. Guardar mini cuadrilla en su colección
      const miniRef = await addDoc(collection(db, "nomina_mini_cuadrillas"), {
        clienteId,
        cuadrillaPrincipalId:     miniForm.cuadrillaPrincipalId,
        cuadrillaPrincipalNombre: miniForm.cuadrillaPrincipalNombre,
        fecha:     miniForm.fecha,
        miembros:  miniForm.miembrosSeleccionados,
        horasInicio: miniForm.horasInicio,
        horasFin:    miniForm.horasFin,
        horas:       parseFloat(miniForm.horas)||0,
        servicioId:    miniForm.servicioId,
        servicioNombre: miniForm.servicioNombre,
        servicioValor:  parseFloat(miniForm.servicioValor)||0,
        contenedores:   parseInt(miniForm.contenedores)||1,
        netoAPagar:    neto,
        creadoEn: new Date(),
      });
      // 2. Guardar en nomina_operaciones como operación etiquetada
      await addDoc(collection(db,"nomina_operaciones"), {
        clienteId,
        modoCiamsa: false,
        esMiniCuadrilla: true,
        miniCuadrillaId: miniRef.id,
        cuadrillaPrincipalId:     miniForm.cuadrillaPrincipalId,
        cuadrillaPrincipalNombre: miniForm.cuadrillaPrincipalNombre,
        // La mini cuadrilla se identifica con un nombre especial en las tablas
        cuadrillaId:       `mini_${miniForm.cuadrillaPrincipalId}`,
        cuadrillaNombre:   `⚡ MINI · Cuad ${miniForm.cuadrillaPrincipalNombre}`,
        cuadrilla:         `⚡ MINI · Cuad ${miniForm.cuadrillaPrincipalNombre}`,
        cuadrillaPersonas: n,
        fecha:    Timestamp.fromDate(new Date(miniForm.fecha+"T12:00:00")),
        fechaStr: miniForm.fecha,
        servicioNombre:   miniForm.servicioNombre.toUpperCase(),
        servicioValorUnitario: parseFloat(miniForm.servicioValor)||0,
        servicioValor:    (parseFloat(miniForm.servicioValor)||0) * (parseInt(miniForm.contenedores)||1),
        cantidad:  parseInt(miniForm.contenedores)||1,
        personas:  n,
        horasExtras: parseFloat(miniForm.horas)||0,
        horasInicio: miniForm.horasInicio,
        horasFin:    miniForm.horasFin,
        modoHorasExtras: false,
        netoAPagar: neto,
        trabajadoresAsisten: miniForm.miembrosSeleccionados,
        trabajadoresAusentes: [],
        creadoEn: new Date(),
        actualizadoEn: new Date(),
      });
      setOkMsg(`✅ Mini cuadrilla guardada — ${n} miembros · ${miniForm.contenedores} contenedor(es)`);
      setTimeout(() => setOkMsg(""), 4000);
      setMiniForm({ ...MINI_FORM_INIT, fecha: miniForm.fecha, cuadrillaPrincipalId: miniForm.cuadrillaPrincipalId, cuadrillaPrincipalNombre: miniForm.cuadrillaPrincipalNombre });
      await cargarLista();
      onGuardado();
    } catch(e) { alert("Error: " + e.message); }
    setGuardando(false);
  };

  const eliminarMini = async (m) => {
    if (!confirm(`¿Eliminar mini cuadrilla del ${m.fecha}?`)) return;
    try {
      await deleteDoc(doc(db, "nomina_mini_cuadrillas", m.id));
      // Buscar y eliminar la operación asociada
      const opSnap = await getDocs(query(
        collection(db,"nomina_operaciones"),
        where("miniCuadrillaId","==",m.id)
      ));
      for (const d of opSnap.docs) await deleteDoc(d.ref);
      await cargarLista();
      onGuardado();
    } catch(e) { alert("Error: "+e.message); }
  };

  const MINI_COLOR = "#e11d48"; // rosa fuerte para diferenciar visualmente

  return (
    <div style={{ background:"#fff", borderRadius:"16px",
      boxShadow:"0 4px 24px rgba(225,29,72,0.10)",
      border:`2px solid ${MINI_COLOR}30`,
      marginBottom:"1.5rem", overflow:"hidden" }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"0.9rem 1.25rem",
        background:`linear-gradient(135deg, ${MINI_COLOR}15 0%, #fff5f7 100%)`,
        borderBottom:`2px solid ${MINI_COLOR}20` }}>
        <div style={{ display:"flex", alignItems:"center", gap:"0.6rem" }}>
          <div style={{ background:MINI_COLOR, borderRadius:"10px", padding:"0.5rem",
            display:"flex", alignItems:"center", justifyContent:"center" }}>
            <Zap size={18} color="#fff"/>
          </div>
          <div>
            <div style={{ fontWeight:"800", fontSize:"1rem", color:MINI_COLOR }}>⚡ Mini Cuadrillas</div>
            <div style={{ fontSize:"0.75rem", color:"#94a3b8" }}>Personal adicional que continúa la operación tras la jornada principal</div>
          </div>
        </div>
        <button onClick={onClose}
          style={{ background:"#f1f5f9", border:"none", borderRadius:"8px",
            padding:"0.5rem", cursor:"pointer", color:"#64748b" }}>
          <X size={16}/>
        </button>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0",
        borderBottom:`1px solid ${MINI_COLOR}15` }}>

        {/* ── COLUMNA IZQUIERDA: Formulario ── */}
        <div style={{ padding:"1.25rem", borderRight:`1px solid ${MINI_COLOR}15` }}>
          <div style={{ fontWeight:"800", fontSize:"0.82rem", color:MINI_COLOR,
            textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:"1rem" }}>
            📋 Nueva Mini Cuadrilla
          </div>

          {/* Cuadrilla principal */}
          <div style={{ marginBottom:"0.9rem" }}>
            <label style={{ ...labelSt, color:MINI_COLOR }}>1️⃣ Cuadrilla principal origen</label>
            <select value={miniForm.cuadrillaPrincipalId}
              onChange={e => {
                const c = cuadrillas.find(x=>x.id===e.target.value);
                setMiniForm(prev => ({
                  ...prev,
                  cuadrillaPrincipalId: e.target.value,
                  cuadrillaPrincipalNombre: c?.nombre||"",
                  miembrosSeleccionados: [],
                }));
              }}
              style={{ ...selectSt, border:`1.5px solid ${MINI_COLOR}60`, color:miniForm.cuadrillaPrincipalId?"#1e293b":"#94a3b8" }}>
              <option value="">— Seleccionar cuadrilla —</option>
              {cuadrillas.map(c=>(
                <option key={c.id} value={c.id}>Cuadrilla {c.nombre} · {c.miembros?.length||0} miembros</option>
              ))}
            </select>
          </div>

          {/* Seleccionar miembros */}
          {cuadActual && (
            <div style={{ marginBottom:"0.9rem" }}>
              <label style={{ ...labelSt, color:MINI_COLOR }}>2️⃣ Miembros de la mini cuadrilla</label>
              <div style={{ border:`1.5px solid ${MINI_COLOR}40`, borderRadius:"10px", overflow:"hidden", maxHeight:"220px", overflowY:"auto" }}>
                {/* Header con seleccionar todos */}
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                  padding:"0.45rem 0.75rem", background:`${MINI_COLOR}08`,
                  borderBottom:`1px solid ${MINI_COLOR}20`, position:"sticky", top:0 }}>
                  <span style={{ fontSize:"0.72rem", fontWeight:"700", color:"#64748b" }}>
                    {miniForm.miembrosSeleccionados.length} / {miembros.length} seleccionados
                  </span>
                  <div style={{ display:"flex", gap:"0.4rem" }}>
                    <button onClick={selTodos}
                      style={{ fontSize:"0.7rem", background:MINI_COLOR, color:"#fff",
                        border:"none", borderRadius:"5px", padding:"2px 8px", cursor:"pointer", fontWeight:"700" }}>
                      Todos
                    </button>
                    <button onClick={deselTodos}
                      style={{ fontSize:"0.7rem", background:"#f1f5f9", color:"#64748b",
                        border:"1px solid #e2e8f0", borderRadius:"5px", padding:"2px 8px", cursor:"pointer" }}>
                      Ninguno
                    </button>
                  </div>
                </div>
                {miembros.map(m => {
                  const sel = miniForm.miembrosSeleccionados.some(x=>x.id===m.id);
                  return (
                    <div key={m.id}
                      onClick={() => toggleMiembro(m)}
                      style={{ display:"flex", alignItems:"center", gap:"0.65rem",
                        padding:"0.5rem 0.75rem",
                        background: sel ? `${MINI_COLOR}10` : "#fff",
                        borderBottom:`1px solid ${MINI_COLOR}10`,
                        cursor:"pointer", transition:"background 0.1s" }}
                      onMouseEnter={e=>{ if(!sel) e.currentTarget.style.background="#fff5f7"; }}
                      onMouseLeave={e=>{ if(!sel) e.currentTarget.style.background="#fff"; }}>
                      <div style={{ width:"18px", height:"18px", borderRadius:"5px",
                        border:`2px solid ${sel ? MINI_COLOR : "#cbd5e1"}`,
                        background: sel ? MINI_COLOR : "#fff",
                        display:"flex", alignItems:"center", justifyContent:"center",
                        flexShrink:0, transition:"all 0.1s" }}>
                        {sel && <CheckCircle size={11} color="#fff" strokeWidth={3}/>}
                      </div>
                      <span style={{ flex:1, fontSize:"0.84rem", fontWeight: sel?"700":"500",
                        color: sel ? MINI_COLOR : "#1e293b",
                        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {m.nombre}
                      </span>
                      <span style={{ fontSize:"0.72rem", fontFamily:"monospace", color:"#94a3b8" }}>
                        {m.cedula||""}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3️⃣ Personal adicional de otros clientes */}
          {cuadActual && (todosTrabajadores||[]).length > 0 && (() => {
            const idsEnCuad = new Set((cuadActual?.miembros||[]).map(m=>m.id));
            const yaSelIds  = new Set(miniForm.miembrosSeleccionados.map(m=>m.id));
            const qa = busqAdicional.toLowerCase().trim();
            const adicionales = (todosTrabajadores||[])
              .filter(t => !idsEnCuad.has(t.id))
              .filter(t => !qa || t.nombre?.toLowerCase().includes(qa) || String(t.cedula||'').includes(busqAdicional.trim()));
            const clienteMap = {};
            (clientes||[]).forEach(c=>{ clienteMap[c.id]=c; });
            const COLS=["#0B3D91","#10b981","#8b5cf6","#f59e0b","#ef4444"];
            const NOMS={spia:"SPIA",cliente1:"C1",cliente2:"CIAMSA 2",cliente3:"CIAMSA 3"};
            return (
              <div style={{ marginBottom:"0.9rem" }}>
                <label style={{ ...labelSt, color:"#7c3aed" }}>
                  3️⃣ Personal adicional
                  <span style={{ fontWeight:"400", color:"#94a3b8", marginLeft:"0.4rem" }}>
                    ({adicionales.length} de otros clientes)
                  </span>
                </label>
                <div style={{ border:"1.5px solid #ede9fe", borderRadius:"10px", overflow:"hidden" }}>
                  <div style={{ padding:"0.35rem 0.6rem", background:"#faf5ff", borderBottom:"1px solid #ede9fe" }}>
                    <input value={busqAdicional} onChange={e=>setBusqAdicional(e.target.value)}
                      placeholder="🔍 Buscar por nombre o cédula..."
                      style={{ width:"100%", padding:"0.3rem 0.55rem", border:"1.5px solid #ede9fe",
                        borderRadius:"7px", fontSize:"0.8rem", outline:"none", boxSizing:"border-box" }}/>
                  </div>
                  <div style={{ maxHeight:"180px", overflowY:"auto" }}>
                    {adicionales.length===0 ? (
                      <div style={{ padding:"0.75rem", textAlign:"center", color:"#94a3b8", fontSize:"0.78rem" }}>
                        {qa ? "Sin resultados" : "Todos los trabajadores ya están en la cuadrilla"}
                      </div>
                    ) : adicionales.map(t => {
                      const sel = yaSelIds.has(t.id);
                      const cIds = t.clienteIds||["spia"];
                      const borderCol = sel ? "#7c3aed" : "#c4b5fd";
                      const bgCol = sel ? "#7c3aed" : "#fff";
                      const rowBg = sel ? "#f5f3ff" : "#fff";
                      return (
                        <div key={t.id}
                          onClick={()=>toggleMiembro({...t,cedula:t.cedula||""})}
                          style={{ display:"flex", alignItems:"center", gap:"0.5rem",
                            padding:"0.4rem 0.7rem",
                            background:rowBg,
                            borderBottom:"1px solid #f3f0ff",
                            cursor:"pointer" }}>
                          <div style={{ width:"16px", height:"16px", borderRadius:"4px", flexShrink:0,
                            border:"2px solid "+borderCol,
                            background:bgCol,
                            display:"flex", alignItems:"center", justifyContent:"center" }}>
                            {sel&&<CheckCircle size={10} color="#fff" strokeWidth={3}/>}
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontWeight:sel?"700":"500", fontSize:"0.82rem",
                              color:sel?"#7c3aed":"#1e293b",
                              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t.nombre}</div>
                            <div style={{ fontSize:"0.68rem", color:"#94a3b8", fontFamily:"monospace" }}>{t.cedula||""}</div>
                          </div>
                          <div style={{ display:"flex", gap:"0.2rem", flexWrap:"wrap", maxWidth:"100px" }}>
                            {cIds.map((cid,ci)=>{
                              const cl=clienteMap[cid];
                              const col=cl?.color||COLS[ci%COLS.length];
                              return(
                                <span key={cid} style={{ background:col+"18", color:col,
                                  border:"1px solid "+col+"40", borderRadius:"5px",
                                  padding:"1px 4px", fontSize:"0.6rem", fontWeight:"800", whiteSpace:"nowrap" }}>
                                  {cl?.nombre||NOMS[cid]||cid.toUpperCase()}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {(() => {
                    const nadics = miniForm.miembrosSeleccionados.filter(m=>!idsEnCuad.has(m.id));
                    if(nadics.length===0) return null;
                    return (
                      <div style={{ padding:"0.3rem 0.7rem", background:"#ede9fe",
                        borderTop:"1px solid #ddd6fe", fontSize:"0.72rem", color:"#7c3aed", fontWeight:"700" }}>
                        {nadics.length} adicional(es) seleccionado(s)
                      </div>
                    );
                  })()}
                </div>
              </div>
            );
          })()}

          {/* Fecha y horas */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"0.6rem", marginBottom:"0.9rem" }}>
            <div style={{ gridColumn:"1/-1" }}>
              <label style={labelSt}>📅 Fecha</label>
              <input type="date" value={miniForm.fecha}
                onChange={e => setMF("fecha", e.target.value)}
                style={{ ...inputSt, border:`1.5px solid ${MINI_COLOR}60` }}/>
            </div>
            <div>
              <label style={labelSt}><Clock size={12} style={{marginRight:"4px"}}/>Hora inicio</label>
              <input type="time" value={miniForm.horasInicio}
                onChange={e => setMF("horasInicio", e.target.value)}
                style={{ ...inputSt, textAlign:"center" }}/>
            </div>
            <div>
              <label style={labelSt}><Clock size={12} style={{marginRight:"4px"}}/>Hora fin</label>
              <input type="time" value={miniForm.horasFin}
                onChange={e => {
                  const inicio = miniForm.horasInicio;
                  let horas = miniForm.horas;
                  if (inicio && e.target.value) {
                    const [ih,im] = inicio.split(":").map(Number);
                    const [fh,fm] = e.target.value.split(":").map(Number);
                    horas = Math.max(0, (fh*60+fm - ih*60-im)/60);
                    horas = Math.round(horas*10)/10;
                  }
                  setMiniForm(prev => ({ ...prev, horasFin:e.target.value, horas }));
                }}
                style={{ ...inputSt, textAlign:"center" }}/>
            </div>
            <div>
              <label style={labelSt}>⏱ Horas totales</label>
              <input type="number" min="0" step="0.5" value={miniForm.horas}
                onChange={e => setMF("horas", parseFloat(e.target.value)||0)}
                style={{ ...inputSt, textAlign:"center", background:"#f8fafc" }}/>
            </div>
          </div>

          {/* Servicio */}
          <div style={{ marginBottom:"0.9rem" }}>
            <label style={labelSt}>3️⃣ Servicio</label>
            <div style={{ position:"relative" }}>
              <select value={miniForm.servicioId} onChange={e => selServicio(e.target.value)}
                style={{ ...selectSt, border:`1.5px solid ${MINI_COLOR}60` }}>
                <option value="">— Seleccionar servicio —</option>
                {servicios.map(s=>(
                  <option key={s.id} value={s.id}>{s.nombre} · {formatCOP(s.valor||s.tarifa||0)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Contenedores y neto */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.6rem", marginBottom:"1rem" }}>
            <div>
              <label style={labelSt}>📦 Contenedores</label>
              <input type="number" min="1" value={miniForm.contenedores}
                onChange={e => setMF("contenedores", e.target.value)}
                style={{ ...inputSt, textAlign:"center", border:`1.5px solid ${MINI_COLOR}60` }}/>
            </div>
            <div>
              <label style={{ ...labelSt, color:"#065f46" }}>💵 Neto por persona</label>
              <div style={{ ...readonlySt, background:miniForm.netoCalculado>0?"#f0fdf4":"#f8fafc",
                border:`1.5px solid ${miniForm.netoCalculado>0?"#6ee7b7":"#e2e8f0"}`,
                fontWeight:"900", color:"#065f46", fontFamily:"monospace", fontSize:"1rem" }}>
                {formatCOP(miniForm.netoCalculado)}
              </div>
            </div>
          </div>

          {/* Resumen */}
          {miniForm.miembrosSeleccionados.length > 0 && miniForm.netoCalculado > 0 && (
            <div style={{ background:`${MINI_COLOR}08`, border:`1.5px solid ${MINI_COLOR}30`,
              borderRadius:"10px", padding:"0.75rem", marginBottom:"1rem",
              fontSize:"0.82rem" }}>
              <div style={{ fontWeight:"800", color:MINI_COLOR, marginBottom:"0.4rem" }}>📊 Resumen operación</div>
              <div style={{ color:"#475569" }}>
                {miniForm.miembrosSeleccionados.length} miembros · 
                {miniForm.contenedores} contenedor(es) · 
                {miniForm.horas}h de trabajo
              </div>
              <div style={{ fontWeight:"900", color:"#065f46", marginTop:"0.35rem", fontFamily:"monospace" }}>
                Total mini cuadrilla: {formatCOP(miniForm.netoCalculado * miniForm.miembrosSeleccionados.length)}
              </div>
            </div>
          )}

          {okMsg && (
            <div style={{ background:"#f0fdf4", border:"1.5px solid #6ee7b7",
              borderRadius:"10px", padding:"0.6rem 0.9rem",
              color:"#065f46", fontWeight:"700", fontSize:"0.85rem",
              marginBottom:"0.75rem" }}>{okMsg}</div>
          )}

          <button onClick={guardar} disabled={guardando}
            style={{ width:"100%", padding:"0.8rem",
              background: guardando ? "#94a3b8" : MINI_COLOR,
              border:"none", borderRadius:"10px", color:"#fff",
              fontWeight:"800", fontSize:"0.9rem", cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"center", gap:"0.5rem",
              transition:"background 0.15s" }}>
            {guardando ? <><RefreshCw size={16} style={{animation:"spin 1s linear infinite"}}/> Guardando...</>
              : <><Zap size={16}/> Crear Mini Cuadrilla</>}
          </button>
        </div>

        {/* ── COLUMNA DERECHA: Historial ── */}
        <div style={{ padding:"1.25rem", background:"#fafafa" }}>
          <div style={{ fontWeight:"800", fontSize:"0.82rem", color:"#64748b",
            textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:"1rem",
            display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <span>⚡ Mini Cuadrillas Recientes</span>
            <button onClick={cargarLista}
              style={{ background:"transparent", border:"none", cursor:"pointer", color:"#94a3b8" }}>
              <RefreshCw size={13}/>
            </button>
          </div>
          {cargandoLista ? (
            <div style={{ textAlign:"center", padding:"2rem", color:"#94a3b8" }}>
              <RefreshCw size={20} style={{animation:"spin 1s linear infinite"}}/>
            </div>
          ) : miniCuadrillas.length === 0 ? (
            <div style={{ textAlign:"center", padding:"2rem", color:"#cbd5e1" }}>
              <Zap size={32} color="#e2e8f0" style={{marginBottom:"0.5rem"}}/>
              <div style={{ fontSize:"0.85rem" }}>Sin mini cuadrillas creadas</div>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:"0.6rem", maxHeight:"520px", overflowY:"auto" }}>
              {miniCuadrillas.map(mc => (
                <div key={mc.id} style={{
                  background:"#fff", borderRadius:"10px",
                  border:`1.5px solid ${MINI_COLOR}25`,
                  padding:"0.75rem", fontSize:"0.82rem",
                  boxShadow:"0 1px 4px rgba(225,29,72,0.06)" }}>
                  {/* Header */}
                  <div style={{ display:"flex", alignItems:"flex-start",
                    justifyContent:"space-between", marginBottom:"0.4rem" }}>
                    <div>
                      <span style={{ background:`${MINI_COLOR}15`, color:MINI_COLOR,
                        borderRadius:"6px", padding:"1px 8px",
                        fontWeight:"800", fontSize:"0.72rem" }}>
                        ⚡ Cuad. {mc.cuadrillaPrincipalNombre}
                      </span>
                      <span style={{ marginLeft:"0.4rem", color:"#64748b",
                        fontSize:"0.72rem", fontFamily:"monospace" }}>
                        {mc.fecha}
                      </span>
                    </div>
                    <button onClick={() => eliminarMini(mc)}
                      style={{ background:"#fff1f2", border:"none", borderRadius:"6px",
                        padding:"2px 5px", cursor:"pointer", color:"#ef4444" }}>
                      <Trash2 size={11}/>
                    </button>
                  </div>
                  {/* Detalle */}
                  <div style={{ color:"#334155", fontWeight:"600", marginBottom:"0.25rem" }}>
                    {mc.servicioNombre}
                  </div>
                  <div style={{ display:"flex", gap:"0.5rem", flexWrap:"wrap" }}>
                    <span style={{ background:"#f0f9ff", color:"#0ea5e9",
                      borderRadius:"5px", padding:"1px 7px", fontSize:"0.7rem", fontWeight:"700" }}>
                      👥 {mc.miembros?.length||0} miembros
                    </span>
                    <span style={{ background:"#fef9c3", color:"#92400e",
                      borderRadius:"5px", padding:"1px 7px", fontSize:"0.7rem", fontWeight:"700" }}>
                      📦 {mc.contenedores} cont.
                    </span>
                    {mc.horasInicio && mc.horasFin && (
                      <span style={{ background:"#f5f3ff", color:"#7c3aed",
                        borderRadius:"5px", padding:"1px 7px", fontSize:"0.7rem", fontWeight:"700" }}>
                        ⏱ {mc.horasInicio}–{mc.horasFin}
                      </span>
                    )}
                    <span style={{ background:"#f0fdf4", color:"#065f46",
                      borderRadius:"5px", padding:"1px 7px", fontSize:"0.7rem",
                      fontWeight:"900", fontFamily:"monospace" }}>
                      {formatCOP(mc.netoAPagar)} p.p.
                    </span>
                  </div>
                  {/* Miembros */}
                  <div style={{ marginTop:"0.4rem", display:"flex", flexWrap:"wrap", gap:"0.25rem" }}>
                    {(mc.miembros||[]).slice(0,6).map(m=>(
                      <span key={m.id} style={{ background:"#f8fafc", borderRadius:"5px",
                        padding:"1px 6px", fontSize:"0.68rem", color:"#475569",
                        border:"1px solid #e2e8f0" }}>{m.nombre.split(" ")[0]}</span>
                    ))}
                    {(mc.miembros||[]).length > 6 && (
                      <span style={{ fontSize:"0.68rem", color:"#94a3b8" }}>+{(mc.miembros||[]).length-6} más</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────


// ── Componente: lista editable de novedades por trabajador ──
function NovEditList({ todos, novedades, onGuardar, onCancelar, puedeEditar }) {
  const [lista, setLista] = useState(todos.map(w=>({...w})));
  const setNov = (id, val) => setLista(prev => prev.map(w => w.id===id ? {...w, novedad:val} : w));
  const conNov = lista.filter(w=>w.novedad).length;
  return (
    <div>
      <div style={{fontSize:"0.78rem",color:"#64748b",marginBottom:"0.75rem"}}>
        {lista.length} trabajadores en este registro · {conNov} con novedad
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:"0.4rem",marginBottom:"1rem"}}>
        {lista.map(w=>{
          const nov = novedades.find(n=>n.codigo===w.novedad);
          return (
            <div key={w.id} style={{display:"flex",alignItems:"center",gap:"0.5rem",padding:"0.4rem 0.6rem",borderRadius:"8px",
              background:w.novedad?(nov?.bg||"#fff1f2"):"#f8fafc",border:`1px solid ${w.novedad?(nov?.color||"#fecdd3"):"#e2e8f0"}`}}>
              <div style={{flex:1,fontWeight:"600",fontSize:"0.82rem",color:"#1e293b",minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                {w.nombre}
                {w.cedula&&<span style={{fontSize:"0.68rem",color:"#94a3b8",marginLeft:"0.4rem",fontFamily:"monospace"}}>{w.cedula}</span>}
              </div>
              {puedeEditar ? (
                <select value={w.novedad||""} onChange={e=>setNov(w.id,e.target.value)}
                  style={{border:`1.5px solid ${w.novedad?(nov?.color||"#fecdd3"):"#e2e8f0"}`,borderRadius:"6px",
                    padding:"0.25rem 0.5rem",fontSize:"0.75rem",fontWeight:w.novedad?"700":"400",
                    background:w.novedad?(nov?.bg||"#fff1f2"):"#fff",color:w.novedad?(nov?.color||"#dc2626"):"#475569",outline:"none",cursor:"pointer",minWidth:"180px"}}>
                  <option value="">✓ Sin novedad — asistió normal</option>
                  {novedades.map(n=>(<option key={n.codigo} value={n.codigo}>{n.emoji} {n.label} ({n.codigo})</option>))}
                </select>
              ) : (
                <span style={{fontSize:"0.75rem",fontWeight:"700",color:nov?.color||"#475569",background:nov?.bg||"#f1f5f9",borderRadius:"5px",padding:"2px 8px"}}>
                  {nov?nov.emoji+" "+nov.label:"✓ Normal"}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {puedeEditar && (
        <div style={{display:"flex",gap:"0.5rem",justifyContent:"flex-end",borderTop:"1px solid #e2e8f0",paddingTop:"0.75rem"}}>
          <button onClick={onCancelar} style={{background:"#f1f5f9",border:"1px solid #e2e8f0",borderRadius:"7px",padding:"0.4rem 0.9rem",cursor:"pointer",color:"#475569",fontWeight:"700",fontSize:"0.82rem"}}>
            Cancelar
          </button>
          <button onClick={()=>onGuardar(lista)} style={{background:"#dc2626",border:"none",borderRadius:"7px",padding:"0.4rem 1rem",cursor:"pointer",color:"#fff",fontWeight:"800",fontSize:"0.82rem",display:"flex",alignItems:"center",gap:"0.3rem"}}>
            💾 Guardar Novedades
          </button>
        </div>
      )}
    </div>
  );
}


export default function NominaMatriz() {
  const router = useRouter();
  const [rol,     setRol]     = useState(null);
  const [uid,     setUid]     = useState(null);
  const [loading, setLoading] = useState(true);

  // Permisos desde control-roles
  const { puedeEditar: puedeEditarMatriz, tieneControl: tieneControlMatriz } = usePermisosNomina(uid, rol);

  // Catálogos
  const [cuadrillasAsistencia, setCuadrillasAsistencia] = useState([]);
  const [listaTrabajadores,    setListaTrabajadores]    = useState([]);
  const [todosTrabajadores,    setTodosTrabajadores]    = useState([]); // todos sin filtro de cliente
  const [servicios,            setServicios]            = useState([]);

  // Vista Excel / Detalle
  const [showDetalleExcel, setShowDetalleExcel] = useState(false);
  const [tabDetalle,       setTabDetalle]       = useState("trabajadores");
  const [filtroExcelServ,  setFiltroExcelServ]  = useState("");
  const [filtroExcelCuad,  setFiltroExcelCuad]  = useState("");
  const [filtroExcelTrab,  setFiltroExcelTrab]  = useState("");

  const exportarCSV = (filas, nombre) => {
    const BOM = '\uFEFF';
    const csv = BOM + filas.map(row =>
      row.map(c => '"'+String(c==null?'':c).replace(/"/g,'""')+'"').join(',')
    ).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = nombre + '.csv';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  // Período
  const [periodoDesde, setPeriodoDesde] = useState(primerDiaMes());
  const [periodoHasta, setPeriodoHasta] = useState(ultimoDiaMes());

  // Registros
  const [operaciones, setOperaciones] = useState([]);
  const [cargandoOps, setCargandoOps] = useState(false);

  // Filtros tabla
  const [filtroCuadrillaTabla, setFiltroCuadrillaTabla] = useState("");
  const [vistaTabla, setVistaTabla] = useState("registros");

  // ── Multi-día semanal — días seleccionados para guardar en lote
  // Cada elemento: { id, cuadId, cuadNombre, fecha, label }
  const [diasSemanalSeleccionados, setDiasSemanalSeleccionados] = useState([]);

  // ── Cuadrilla Diaria (Terrestre / Ciamsa 2 / Ciamsa 3) ──
  const [cuadrillaDiaForm,       setCuadrillaDiaForm]       = useState(CUADRILLA_DIA_FORM_INIT);
  const [cuadrillaDiaGuardando,  setCuadrillaDiaGuardando]  = useState(false);
  const [cuadrillaDiaOk,         setCuadrillaDiaOk]         = useState(false);
  const [busqTrabCiamsa,         setBusqTrabCiamsa]         = useState("");
  const [busqSpiaCiamsa,         setBusqSpiaCiamsa]         = useState("");

  // ── Multi-servicio Cuadrilla Diaria (Terrestre/CIAMSA) ──
  const [serviciosMultiCiamsa, setServiciosMultiCiamsa] = useState([]);
  const sMultiCiamsaNext = useRef(1);
  const sMultiCiamsaAdd = () => setServiciosMultiCiamsa(prev => [
    ...prev, { uid: sMultiCiamsaNext.current++, servicioId:"", servicioNombre:"", tarifaUnitaria:0, unidad:"ton", cantidad:"", netoCalculado:0 }
  ]);
  const sMultiCiamsaUpdate = (uid, field, val) => setServiciosMultiCiamsa(prev => prev.map(s => {
    if (s.uid !== uid) return s;
    const next = { ...s, [field]: val };
    if (field === "servicioId") {
      const srv = servicios.find(x => x.id === val);
      next.servicioNombre  = srv?.nombre || "";
      next.tarifaUnitaria  = srv?.valor || srv?.tarifa || 0;
      next.unidad          = srv?.unidad || "ton";
    }
    const n      = cuadrillaDiaForm.trabajadoresSeleccionados.length || 1;
    const cant   = parseFloat(next.cantidad) || 0;
    const unidad = next.unidad || "ton";
    const per    = (unidad==="dia"||unidad==="hora") ? cant : (n>0 ? cant/n : 0);
    next.netoCalculado = Math.round(per * (parseFloat(next.tarifaUnitaria)||0) * 100) / 100;
    return next;
  }));
  const sMultiCiamsaRemove = (uid) => setServiciosMultiCiamsa(prev => prev.filter(s => s.uid !== uid));

  // ── Multi-servicio SPIA ──
  const [serviciosMulti, setServiciosMulti] = useState([]);
  // serviciosMulti = [{ uid, servicioId, servicioNombre, servicioValor, cantidad, netoCalculado }]
  const sMultiNext = useRef(1);

  const sMultiAdd = () => setServiciosMulti(prev => [
    ...prev,
    { uid: sMultiNext.current++, servicioId:"", servicioNombre:"", servicioValor:0, cantidad:"", netoCalculado:0 }
  ]);

  const sMultiUpdate = (uid, field, val) => setServiciosMulti(prev => prev.map(s => {
    if (s.uid !== uid) return s;
    const next = { ...s, [field]: val };
    if (field === "servicioId") {
      const srv = servicios.find(x => x.id === val);
      next.servicioNombre = srv?.nombre || "";
      next.servicioValor  = srv?.valor  || srv?.tarifa || 0;
    }
    const tarifa = parseFloat(next.servicioValor) || 0;
    const cant   = parseFloat(next.cantidad)       || 0;
    const pers   = (parseInt(form.personas) || 1) + (trabsAdicionales?.length || 0); // incluye adicionales
    next.netoCalculado = Math.round((tarifa * cant / pers) * 100) / 100;
    if (field === "servicioId" || field === "cantidad") next.netoCalculado = Math.round(calcularNetoOperacion(tarifa, pers, parseFloat(next.cantidad)||1)*100)/100;
    return next;
  }));

  const sMultiRemove = (uid) => setServiciosMulti(prev => prev.filter(s => s.uid !== uid));

  
  const [serviciosExtraCia, setServiciosExtraCia] = useState([]);
  const sExtraCiaNext = useRef(1);
  const sExtraCiaAdd = () => setServiciosExtraCia(prev=>[...prev,{uid:sExtraCiaNext.current++,servicioId:"",servicioNombre:"",tarifaUnitaria:0,unidad:"ton",cantidad:"",netoCalculado:0}]);
  const sExtraCiaUpdate = (uid,field,val) => setServiciosExtraCia(prev=>prev.map(s=>{
    if(s.uid!==uid) return s;
    const next={...s,[field]:val};
    if(field==="servicioId"){const srv=servicios.find(x=>x.id===val);next.servicioNombre=srv?.nombre||"";next.tarifaUnitaria=srv?.valor||srv?.tarifa||0;next.unidad=srv?.unidad||"ton";}
    const n=cuadrillaDiaForm.trabajadoresSeleccionados.length||1;
    const cant=parseFloat(next.cantidad)||0;
    const unidad=next.unidad||"ton";
    const per=(unidad==="dia"||unidad==="hora")?cant:(n>0?cant/n:0);
    next.netoCalculado=Math.round(per*(parseFloat(next.tarifaUnitaria)||0)*100)/100;
    return next;
  }));
  const sExtraCiaRemove = (uid) => setServiciosExtraCia(prev=>prev.filter(s=>s.uid!==uid));

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

  // ── Cuadrilla del Día — Terrestre / Ciamsa 2 / Ciamsa 3 ──
  const [cuadDiaFecha,        setCuadDiaFecha]        = useState(hoy());
  const [busqServicioCia,    setBusqServicioCia]    = useState(""); // filtro servicios CIAMSA/Terrestre
  const [cuadDiaTrabajadores, setCuadDiaTrabajadores] = useState([]);
  const [trabsServicio,       setTrabsServicio]       = useState([]);
  const [trabsAdicionales,    setTrabsAdicionales]    = useState([]); // trabajadores adicionales seleccionados (cross-cliente)
  const [cuadsOtrosClientes,  setCuadsOtrosClientes]  = useState([]); // cuadrillas de C1/C2/C3 para mostrar en SPIA
  const [showTrabsPanel,      setShowTrabsPanel]      = useState(false);
  const [busqTrabAd,          setBusqTrabAd]          = useState("");
  const [cuadDiaBusq,         setCuadDiaBusq]         = useState('');

  const [showTotalesPanel, setShowTotalesPanel] = useState(false);

  // Mini cuadrillas y Conjuntos
  const [showMiniCuad,   setShowMiniCuad]   = useState(false);
  const [showConjuntos,  setShowConjuntos]  = useState(false);

  // Modal Detalle por trabajador
  const [showDetalleModal, setShowDetalleModal] = useState(false);
  const [filtroDetNombre,  setFiltroDetNombre]  = useState("");
  const [filtroDetCedula,  setFiltroDetCedula]  = useState("");
  const [filtroDetServicio,setFiltroDetServicio]= useState("");

  // Multi-servicio CIAMSA 2
  const [serviciosExtraC2, setServiciosExtraC2] = useState([]);
  const sExtraC2Next = useRef(1);
  const sExtraC2Add = () => setServiciosExtraC2(prev=>[...prev,{uid:sExtraC2Next.current++,servicioId:"",servicioNombre:"",servicioValor:0,dias:1,netoCalculado:0}]);
  const sExtraC2Update = (uid,field,val) => setServiciosExtraC2(prev=>prev.map(s=>{
    if(s.uid!==uid) return s;
    const next={...s,[field]:val};
    if(field==="servicioId"){const srv=servicios.find(x=>x.id===val);next.servicioNombre=srv?.nombre||"";next.servicioValor=srv?.tarifa||srv?.valor||0;}
    next.netoCalculado=Math.round((parseFloat(next.servicioValor)||0)*(parseFloat(next.dias)||0)*100)/100;
    return next;
  }));
  const sExtraC2Remove = (uid) => setServiciosExtraC2(prev=>prev.filter(s=>s.uid!==uid));

  // Multi-servicio CIAMSA 3
  const [serviciosExtraC3, setServiciosExtraC3] = useState([]);
  const sExtraC3Next = useRef(1);
  const sExtraC3Add = () => setServiciosExtraC3(prev=>[...prev,{uid:sExtraC3Next.current++,servicioId:"",servicioNombre:"",servicioValor:0,cantidad:"",nPersonas:1,netoCalculado:0}]);
  const sExtraC3Update = (uid,field,val) => setServiciosExtraC3(prev=>prev.map(s=>{
    if(s.uid!==uid) return s;
    const next={...s,[field]:val};
    if(field==="servicioId"){const srv=servicios.find(x=>x.id===val);next.servicioNombre=srv?.nombre||"";next.servicioValor=srv?.tarifa||srv?.valor||0;}
    const cant=parseFloat(next.cantidad)||0; const np=parseInt(next.nPersonas)||1;
    next.netoCalculado=Math.round((cant/np)*(parseFloat(next.servicioValor)||0)*100)/100;
    return next;
  }));
  const sExtraC3Remove = (uid) => setServiciosExtraC3(prev=>prev.filter(s=>s.uid!==uid));

  // Modal eliminación
  const [modalElim, setModalElim] = useState(null);

  // Novedades catálogo
  const [novedades, setNovedades] = useState(NOVEDADES_DEFAULT);
  const [novMapState, setNovMapState] = useState(Object.fromEntries(NOVEDADES_DEFAULT.map(n=>[n.codigo,n])));

  // Novedad del día del trabajador (leída de nomina_asistencia_registro — fuente: Llamado a Lista)
  const [novedadActivaWorker, setNovedadActivaWorker] = useState(null);
  const [showEditNovModal,    setShowEditNovModal]    = useState(false);
  const [editNovOp,           setEditNovOp]           = useState(null);
  const [showRegNovForm,      setShowRegNovForm]      = useState(false);
  const [regNovForm,          setRegNovForm]          = useState({fecha:"",trabajadorId:"",trabajadorNombre:"",novedad:"",observacion:""});
  // Indica si cargarAsistenciaDia usó un snapshot histórico (true) o miembros actuales (false)
  const [usandoSnapshotHistorico, setUsandoSnapshotHistorico] = useState(false);

  // Clientes
  const [clienteActivo, setClienteActivo] = useState("spia");
  const [clientes,      setClientes]      = useState(CLIENTES_BASE);

  const tablaRef = useRef(null);

  // ─── Identificadores de modelo por cliente ───
  // Terrestre/CIAMSA 2/CIAMSA 3 = destajo (formulario CIAMSA) | SPIA = cuadrilla
  const isCliente1  = clienteActivo === "cliente1";
  const isCliente2  = clienteActivo === "cliente2";
  const isCliente3  = clienteActivo === "cliente3";
  const isCiamsa    = isCliente1 || isCliente2 || isCliente3;  // todos usan formulario destajo
  const colorCiamsa = isCliente1 ? "#14b8a6" : isCliente2 ? PURPLE : ORANGE;
  // Nombre oficial de cada cliente para etiquetas
  const nombreCiamsa = isCliente1
    ? (clientes.find(c=>c.id==="cliente1")?.nombre || "Terrestre")
    : isCliente2
    ? (clientes.find(c=>c.id==="cliente2")?.nombre || "CIAMSA 2")
    : (clientes.find(c=>c.id==="cliente3")?.nombre || "CIAMSA 3");

  /* ── Auth ── */
  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/login"); return; }
      setUid(user.uid);
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
      setDiasSemanalSeleccionados([]);
      setAsistentesForm([]);
      setAusentesForm([]);
      setCuadrillaDiaForm(CUADRILLA_DIA_FORM_INIT);
      setServiciosExtraCia([]);
      setBusqTrabCiamsa("");
      setBusqSpiaCiamsa("");
      setC2Form(CIAMSA2_FORM_INIT);
      setC2EditId(null);
      setCiamsaForm(CIAMSA_FORM_INIT);
      setCiamsaEditId(null);
      setEditandoId(null);
      setTrabsAdicionales([]);
      setShowTrabsPanel(false);
      setBusqTrabAd("");
      setServiciosExtraC2([]);
      setServiciosExtraC3([]);
    }
  }, [clienteActivo]);

  // Recargar asistencia SPIA cuando cambia cuadrilla O fecha
  // Incluir form.fecha en las dependencias para que al seleccionar un día
  // de cuadrilla semanal se recargue automáticamente el snapshot correcto
  useEffect(() => {
    if (isCiamsa) return;
    if (form.tipoSeleccion === "trabajador") return;
    if (form.cuadrillaId && form.fecha) {
      cargarAsistenciaDia(form.cuadrillaId, form.fecha);
    } else {
      setAsistentesForm([]);
      setAusentesForm([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.cuadrillaId, form.fecha, form.tipoSeleccion]);

  /**
   * Lee nomina_asistencia_registro para saber si el trabajador tiene novedad
   * marcada en el día seleccionado. Fuente: Llamado a Lista (asistencia.js).
   */
  const cargarNovedadDiaWorker = async (trabId, fecha) => {
    if (!trabId || !fecha) { setNovedadActivaWorker(null); return; }
    try {
      const d    = new Date(fecha + "T12:00:00");
      const anio = d.getFullYear();
      const mes  = d.getMonth() + 1;
      const dia  = String(d.getDate());
      // Buscar cuadrilla del trabajador
      let cuadId = null;
      for (const c of cuadrillasAsistencia) {
        if ((c.miembros||[]).some(m => m.id === trabId)) { cuadId = c.id; break; }
      }
      // DocIDs posibles donde el Llamado a Lista pudo guardar la novedad
      const docIds = [];
      if (cuadId) docIds.push(docIdReg(cuadId, anio, mes));
      docIds.push(`llamado_${clienteActivo}_${anio}_${String(mes).padStart(2,"0")}`);
      docIds.push(`individual_${trabId}`);
      for (const docId of docIds) {
        const snap = await getDoc(doc(db, "nomina_asistencia_registro", docId));
        if (snap.exists()) {
          const codNov = snap.data().registro?.[dia]?.[trabId];
          if (codNov) { setNovedadActivaWorker({ novedad: codNov }); return; }
        }
      }
      setNovedadActivaWorker(null);
    } catch(e) {
      console.error("Error leyendo novedad del día:", e);
      setNovedadActivaWorker(null);
    }
  };

  // Recargar novedad del día cuando cambia trabajador o fecha
  useEffect(() => {
    if (!isCiamsa && form.tipoSeleccion === "trabajador" && form.cuadrillaId && form.fecha) {
      const trabId = form.cuadrillaId.replace("trab_","");
      cargarNovedadDiaWorker(trabId, form.fecha);
    } else {
      setNovedadActivaWorker(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.cuadrillaId, form.fecha, form.tipoSeleccion]);

  // Novedad del día para CIAMSA (cliente2/cliente3) cuando cambia trabajador o fecha
  useEffect(() => {
    if (!isCiamsa) return;
    if (ciamsaForm.trabajadorId && ciamsaForm.fecha) {
      cargarNovedadDiaWorker(ciamsaForm.trabajadorId, ciamsaForm.fecha);
    } else {
      setNovedadActivaWorker(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ciamsaForm.trabajadorId, ciamsaForm.fecha, clienteActivo]);

  /* ── Novedades catálogo — fuente: Firestore (administrar.js) ── */
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
    // Cargar cuadrillas de otros clientes para "Trabajadores adicionales" en SPIA
    const otros = lista.filter(c=>c.clienteId&&c.clienteId!=="spia"&&(c.miembros||[]).length>0);
    setCuadsOtrosClientes(otros);
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
        const activos   = all.filter(w => w.activo !== false);
        const filtered  = activos.filter(w=>(w.clienteIds||["spia"]).includes(cActivo));
        setListaTrabajadores(filtered.length>0?filtered:activos);
        setTodosTrabajadores(activos); // todos los activos sin filtro de cliente
      }
    } catch {}
  };

  /* ── Asistencia SPIA ──
   * PRIORIDAD: snapshot del día > miembros actuales de la cuadrilla
   * Si existe un snapshot en nomina_cuadrilla_snapshot/{cuadrillaId}_{YYYYMMDD}
   * se usa ESA composición, que refleja quiénes estaban el día exacto.
   * Si no existe snapshot (cuadrilla clásica sin semana), se usa los miembros actuales.
   */
  const cargarAsistenciaDia = async (cuadrillaId, fechaStr) => {
    setCargandoAsist(true);
    try {
      const c = cuadrillasAsistencia.find(x=>x.id===cuadrillaId);
      if (!c) {
        setAsistentesForm([]); setAusentesForm([]);
      setTrabsAdicionales([]); setShowTrabsPanel(false); setCargandoAsist(false); return;
      }

      // ── 1. Intentar leer snapshot del día concreto ──
      const fechaCompacta = fechaStr.replace(/-/g, ""); // "20250317"
      const snapId  = `${cuadrillaId}_${fechaCompacta}`;
      const snapDoc = await getDoc(doc(db, "nomina_cuadrilla_snapshot", snapId));
      // miembrosDelDia = composición real de ese día
      let miembrosDelDia = snapDoc.exists()
        ? (snapDoc.data().miembros || [])   // ← snapshot encontrado ✔
        : (c.miembros || []);                // ← fallback: miembros actuales
      const usandoSnapshot = snapDoc.exists();

      if (miembrosDelDia.length === 0) {
        setAsistentesForm([]); setAusentesForm([]); setCargandoAsist(false); return;
      }

      // ── 2. Leer novedades del día (asistencia_registro) ──
      const d    = new Date(fechaStr + "T12:00:00");
      const anio = d.getFullYear();
      const mes  = d.getMonth() + 1;
      const dia  = d.getDate();
      const regId = docIdReg(cuadrillaId, anio, mes);
      const regSnap = await getDoc(doc(db, "nomina_asistencia_registro", regId));
      let novedadesDia = {};
      if (regSnap.exists()) novedadesDia = regSnap.data().registro?.[String(dia)] || {};

      // ── 3. Clasificar usando la composición del snapshot ──
      const NOV_REMUNERADAS = ["D"];
      const asisten  = miembrosDelDia.filter(m => !novedadesDia[m.id] || NOV_REMUNERADAS.includes(novedadesDia[m.id]));
      const ausentes = miembrosDelDia.filter(m => !!novedadesDia[m.id] && !NOV_REMUNERADAS.includes(novedadesDia[m.id])).map(m=>({...m,novedad:novedadesDia[m.id]}));
      const asistentesM = asisten.map(m => ({...m, novedad:novedadesDia[m.id]||null, esRemunerado:NOV_REMUNERADAS.includes(novedadesDia[m.id]||"")}));

      setAsistentesForm(asistentesM);
      setAusentesForm(ausentes);
      // form.personas = solo los de la cuadrilla que asisten (sin adicionales)
      // Los adicionales se suman en el display y al guardar, NO aqui
      setForm(prev => {
        const personasCuad = asistentesM.length || 1;
        const neto = Math.round(calcularNetoOperacion(parseFloat(prev.servicioValor)||0, personasCuad, parseInt(prev.cantidad)||1)*100)/100;
      return { ...prev, personas: personasCuad, cuadrillaPersonas: miembrosDelDia.length, netoCalculado: neto };
      });

      setUsandoSnapshotHistorico(usandoSnapshot);
      if (usandoSnapshot) {
        console.info(`[Matriz] Usando snapshot del ${fechaStr} para cuadrilla ${cuadrillaId} (${miembrosDelDia.length} miembros)`);
      } else {
        console.info(`[Matriz] Sin snapshot para ${fechaStr} — usando miembros actuales (${miembrosDelDia.length})`);
      }
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

  /* ── CUADRILLA DIARIA: lógica (Terrestre, Ciamsa 2, Ciamsa 3) ──
     El supervisor selecciona qué trabajadores trabajan ese día,
     registra el servicio y la cantidad total del grupo.
     Fórmula: PER = CANTIDAD / N° PERSONAS  →  Neto = PER × TARIFA (por persona)
  */
  const cuadrillaDiaRecalcular = (f) => {
    const n       = f.trabajadoresSeleccionados.length || 1;
    const cant    = parseFloat(f.cantidad) || 0;
    const tarifa  = parseFloat(f.tarifaUnitaria) || 0;
    const unidad  = f.unidad || "ton";
    // Si el servicio es por día (valor fijo por persona/día), neto = tarifa × 1
    // Si es por tonelada, neto = (cant / n) × tarifa
    const per = (unidad === "dia" || unidad === "hora") ? cant : (n > 0 ? cant / n : 0);
    const neto = Math.round(per * tarifa * 100) / 100;
    return { ...f, nPersonas: n, per: Math.round(per * 10000) / 10000, netoCalculado: neto };
  };

  const cuadrillaDiaSetField = (key, val) =>
    setCuadrillaDiaForm(prev => cuadrillaDiaRecalcular({ ...prev, [key]: val }));

  const cuadrillaDiaToggleTrabajador = (t) => {
    setCuadrillaDiaForm(prev => {
      const ya = prev.trabajadoresSeleccionados.some(x => x.id === t.id);
      const nuevos = ya
        ? prev.trabajadoresSeleccionados.filter(x => x.id !== t.id)
        : [...prev.trabajadoresSeleccionados, { id: t.id, nombre: t.nombre, cedula: String(t.cedula || ""), cargo: t.cargo || "" }];
      return cuadrillaDiaRecalcular({ ...prev, trabajadoresSeleccionados: nuevos });
    });
  };

  const cuadrillaDiaSelServicio = (servId) => {
    const s = servicios.find(x => x.id === servId);
    if (!s) { setCuadrillaDiaForm(prev => cuadrillaDiaRecalcular({ ...prev, servicioId: "", servicioNombre: "", tarifaUnitaria: 0, unidad: "ton" })); return; }
    setCuadrillaDiaForm(prev => cuadrillaDiaRecalcular({ ...prev, servicioId: s.id, servicioNombre: s.nombre, tarifaUnitaria: s.valor || s.tarifa || 0, unidad: s.unidad || "ton" }));
  };

  const cuadrillaDiaGuardar = async () => {
    const f = cuadrillaDiaForm;
    if (f.trabajadoresSeleccionados.length === 0) { alert("Selecciona al menos un trabajador."); return; }
    if (!f.servicioNombre) { alert("Selecciona el servicio."); return; }
    if (!f.cantidad) { alert("Ingresa la cantidad."); return; }
    if (!f.fecha) { alert("Indica la fecha."); return; }
    setCuadrillaDiaGuardando(true);
    const n      = f.trabajadoresSeleccionados.length;
    const cant   = parseFloat(f.cantidad) || 0;
    const unidad = f.unidad || "ton";
    const per    = (unidad === "dia" || unidad === "hora") ? cant : (n > 0 ? cant / n : 0);
    const neto   = Math.round(per * f.tarifaUnitaria * 100) / 100;
    const data = {
      periodoDesde, periodoHasta,
      clienteId:  clienteActivo,
      modoCiamsa: true,
      modoCuadrillaDiaria: true,
      quincenaId:   `${periodoDesde} al ${periodoHasta}`,
      quincenaLabel:`${periodoDesde} al ${periodoHasta}`,
      cuadrillaId:       `diaria_${f.fecha.replace(/-/g, "")}`,
      cuadrillaNombre:   `CUADRILLA ${f.fecha}`,
      cuadrillaPersonas: n,
      fecha:      Timestamp.fromDate(new Date(f.fecha + "T12:00:00")),
      fechaStr:   f.fecha,
      servicioId:     f.servicioId,
      servicioNombre: f.servicioNombre.trim().toUpperCase(),
      tarifaUnitaria: f.tarifaUnitaria,
      unidad,
      cantidadTons:   cant,
      nPersonas:      n,
      per:            Math.round(per * 10000) / 10000,
      servicioValorUnitario: f.tarifaUnitaria,
      servicioValor:  neto,
      cantidad:       n,
      personas:       n,
      netoAPagar:     neto,   // neto por persona — liquidar.js suma esto por trabajador
      trabajadoresAsisten: f.trabajadoresSeleccionados.map(t => ({
        id: t.id, nombre: t.nombre, cedula: String(t.cedula || ""),
      })),
      trabajadoresAusentes: [],
      actualizadoEn: new Date(),
    };
    try {
      // Si hay ciamsaEditId activo = edición de registro existente
      if (ciamsaEditId) {
        await updateDoc(doc(db,"nomina_operaciones",ciamsaEditId), {...data, actualizadoEn:new Date()});
        setCiamsaEditId(null);
      } else {
        await addDoc(collection(db, "nomina_operaciones"), { ...data, creadoEn: new Date() });
      }
      // Servicios adicionales (solo en modo nuevo, no en edición)
      if (!ciamsaEditId) for (const se of serviciosExtraCia) {
        if (!se.servicioNombre || !se.cantidad) continue;
        const cantSe  = parseFloat(se.cantidad)||0;
        const unidSe  = se.unidad||"ton";
        const perSe   = (unidSe==="dia"||unidSe==="hora") ? cantSe : (n>0 ? cantSe/n : 0);
        const netoSe  = Math.round(perSe*(parseFloat(se.tarifaUnitaria)||0)*100)/100;
        await addDoc(collection(db,"nomina_operaciones"),{
          ...data,
          servicioId:        se.servicioId,
          servicioNombre:    se.servicioNombre.trim().toUpperCase(),
          tarifaUnitaria:    parseFloat(se.tarifaUnitaria)||0,
          unidad:            unidSe,
          cantidadTons:      cantSe,
          per:               Math.round(perSe*10000)/10000,
          servicioValorUnitario: parseFloat(se.tarifaUnitaria)||0,
          servicioValor:     netoSe,
          netoAPagar:        netoSe,
          creadoEn:          new Date(),
          actualizadoEn:     new Date(),
        });
      }
      await cargarOperaciones();
      // Conserva fecha y trabajadores para el siguiente registro del mismo día
      setCuadrillaDiaForm(prev => ({
        ...CUADRILLA_DIA_FORM_INIT,
        fecha: prev.fecha,
        trabajadoresSeleccionados: prev.trabajadoresSeleccionados,
      }));
      setServiciosExtraCia([]);
      setCuadrillaDiaOk(true);
      setTimeout(() => setCuadrillaDiaOk(false), 2500);
      tablaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch(e) { alert("Error: " + e.message); }
    setCuadrillaDiaGuardando(false);
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
    // Cuadrilla semanal — día específico: semanal_dia_{cuadId}_{YYYYMMDD}
    if (val.startsWith("semanal_dia_")) {
      // Extraer el cuadId buscando en todas las cuadrillas semanales
      const cuad = cuadrillasAsistencia.find(c =>
        c.tipo === "semanal" && val.startsWith(`semanal_dia_${c.id}_`)
      );
      if (!cuad) return;
      // El ID del día contiene la fecha compacta al final
      const fechaCompacta = val.replace(`semanal_dia_${cuad.id}_`, ""); // YYYYMMDD
      const fechaStr = `${fechaCompacta.slice(0,4)}-${fechaCompacta.slice(4,6)}-${fechaCompacta.slice(6,8)}`;
      // Usamos el cuadrillaId real para buscar el snapshot en Firestore
      setForm(prev=>({...prev,
        cuadrillaId: cuad.id,      // ID real de la cuadrilla — usado en cargarAsistenciaDia
        cuadrillaNombre: cuad.nombre,
        cuadrillaPersonas: cuad.miembros?.length||0,
        personas: cuad.miembros?.length||1,
        tipoSeleccion: "cuadrilla",
        // La fecha ya viene seteada por onFechaChange, no la pisamos aquí
        // a menos que el usuario no la haya seleccionado antes
        fecha: fechaStr, // auto-set al seleccionar el día
      }));
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

  /* ── SPIA: Guardar múltiples días de cuadrilla semanal ──
   * Crea UN registro independiente por cada día seleccionado.
   * Cada día usa su propio snapshot (composición real) y calcula
   * el neto según los asistentes de ESE día.
   */
  const guardarMultiDia = async () => {
    if (!form.servicioNombre) { alert("Selecciona el servicio."); return; }
    if (diasSemanalSeleccionados.length === 0) return;
    setGuardando(true);
    const NOV_REMUNERADAS = ["D"];
    const valorUnitario = parseFloat(form.servicioValor) || 0;
    const cantidad      = parseInt(form.cantidad) || 1;
    let guardados = 0;
    let errores   = [];
    try {
      for (const dia of diasSemanalSeleccionados) {
        try {
          // 1. Snapshot del día
          const snapId  = `${dia.cuadId}_${dia.fecha.replace(/-/g, "")}`;
          const snapDoc = await getDoc(doc(db, "nomina_cuadrilla_snapshot", snapId));
          const cuad    = cuadrillasAsistencia.find(c => c.id === dia.cuadId);
          const miembros = snapDoc.exists() ? (snapDoc.data().miembros || []) : (cuad?.miembros || []);
          // 2. Novedades del día
          const dObj = new Date(dia.fecha + "T12:00:00");
          const anio  = dObj.getFullYear();
          const mes   = dObj.getMonth() + 1;
          const dNum  = dObj.getDate();
          const regId = docIdReg(dia.cuadId, anio, mes);
          const regSnap = await getDoc(doc(db, "nomina_asistencia_registro", regId));
          const novDia  = regSnap.exists() ? (regSnap.data().registro?.[String(dNum)] || {}) : {};
          // 3. Clasificar asistentes
          const asisten  = miembros.filter(m => !novDia[m.id] || NOV_REMUNERADAS.includes(novDia[m.id]));
          const ausentes = miembros.filter(m => !!novDia[m.id] && !NOV_REMUNERADAS.includes(novDia[m.id])).map(m=>({...m,novedad:novDia[m.id]}));
          const personas = asisten.length || 1;
          const netoFinal = Math.round(calcularNetoOperacion(valorUnitario, personas, cantidad) * 100) / 100;
          // 4. Guardar registro
          await addDoc(collection(db, "nomina_operaciones"), {
            periodoDesde, periodoHasta,
            clienteId:  clienteActivo,
            modoCiamsa: false,
            quincenaId:   `${periodoDesde} al ${periodoHasta}`,
            quincenaLabel:`${periodoDesde} al ${periodoHasta}`,
            cuadrillaId:       dia.cuadId,
            cuadrillaNombre:   dia.cuadNombre.trim().toUpperCase(),
            cuadrilla:         dia.cuadNombre.trim().toUpperCase(),
            cuadrillaPersonas: miembros.length,
            fecha:    Timestamp.fromDate(new Date(dia.fecha + "T12:00:00")),
            fechaStr: dia.fecha,
            servicioNombre:        form.servicioNombre.trim().toUpperCase(),
            servicioValorUnitario: valorUnitario,
            servicioValor:         valorUnitario * cantidad,
            cantidad, personas,
            horasExtras:    null,
            modoHorasExtras:false,
            netoAPagar:     netoFinal,
            trabajadoresAsisten:  asisten.map(a=>({id:a.id,nombre:a.nombre,cedula:a.cedula||""})),
            trabajadoresAusentes: ausentes.map(a=>({id:a.id,nombre:a.nombre,novedad:a.novedad})),
            creadoEn:      new Date(),
            actualizadoEn: new Date(),
          });
          guardados++;
        } catch(e) {
          console.error(`Error guardando día ${dia.fecha}:`, e);
          errores.push(`${dia.label}: ${e.message}`);
        }
      }
      await cargarOperaciones();
      setDiasSemanalSeleccionados([]);
      setForm({ ...FORM_INIT,
        cuadrillaId:      form.cuadrillaId,
        cuadrillaNombre:  form.cuadrillaNombre,
        cuadrillaPersonas:form.cuadrillaPersonas,
        personas:         form.cuadrillaPersonas || 1,
      });
      setAsistentesForm([]); setAusentesForm([]);
      setGuardadoOk(true);
      setTimeout(() => setGuardadoOk(false), 3000);
      tablaRef.current?.scrollIntoView({ behavior:"smooth", block:"start" });
      if (errores.length > 0) alert(`Se guardaron ${guardados} de ${diasSemanalSeleccionados.length} días.\n\nErrores:\n${errores.join("\n")}`);
    } catch(e) { alert("Error: " + e.message); }
    setGuardando(false);
  };

  /* ── SPIA: Guardar ── */

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

  const guardar = async () => {
    if (!form.cuadrillaNombre || !form.servicioNombre) { alert("Selecciona cuadrilla y servicio."); return; }
    if (form.tipoSeleccion !== "trabajador" && (!form.cantidad || parseInt(form.cantidad) < 1)) { alert("Ingresa la cantidad."); return; }
    setGuardando(true);
    const valorUnitario = parseFloat(form.servicioValor)||0;
    const cantidad      = parseInt(form.cantidad)||1;
    // personas = cuadrilla principal + trabajadores adicionales seleccionados
    const personasCuadrilla  = parseInt(form.personas)||1;
    const personasAdicionales = trabsAdicionales?.length || 0;
    const personas      = personasCuadrilla + personasAdicionales;
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
      trabajadoresAsisten: [
        ...asistentesForm.map(a=>({id:a.id,nombre:a.nombre,cedula:a.cedula||""})),
        ...trabsAdicionales.map(t=>({id:t.id,nombre:t.nombre,cedula:t.cedula||"",clienteId:t.clienteId||"",clienteLabel:t.clienteLabel||""})),
      ],
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
      // ── Guardar servicios adicionales (multi-servicio) ──
      for (const sm of serviciosMulti) {
        if (!sm.servicioNombre || !sm.cantidad) continue;
        const cantSm  = parseInt(sm.cantidad)||1;
        const personasSm = parseInt(form.personas)||1;
        const netoSm  = Math.round(calcularNetoOperacion(parseFloat(sm.servicioValor)||0, personasSm, cantSm)*100)/100;
        await addDoc(collection(db,"nomina_operaciones"),{
          ...data,
          servicioNombre:        sm.servicioNombre.trim().toUpperCase(),
          servicioValorUnitario: parseFloat(sm.servicioValor)||0,
          servicioValor:         (parseFloat(sm.servicioValor)||0) * cantSm,
          cantidad:              cantSm,
          netoAPagar:            netoSm,
          creadoEn:              new Date(),
          actualizadoEn:         new Date(),
        });
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
      // Si la fecha de la operación es mayor que periodoHasta, extender el período
      if (form.fecha && form.fecha > periodoHasta) {
        setPeriodoHasta(form.fecha);
      }
      await cargarOperaciones();
      setForm({...FORM_INIT,cuadrillaId:form.cuadrillaId,cuadrillaNombre:form.cuadrillaNombre,cuadrillaPersonas:form.cuadrillaPersonas,personas:form.cuadrillaPersonas||1,fecha:form.fecha});
      setServiciosMulti([]);
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
      // Servicios adicionales C2
      for (const se of serviciosExtraC2) {
        if (!se.servicioNombre || !se.dias) continue;
        const netoSe = Math.round((parseFloat(se.servicioValor)||0)*(parseFloat(se.dias)||0)*100)/100;
        await addDoc(collection(db,"nomina_operaciones"),{
          ...data, servicioId:se.servicioId||data.servicioId,
          servicioNombre:se.servicioNombre.toUpperCase(),
          tarifaUnitaria:parseFloat(se.servicioValor)||0,
          servicioValorUnitario:parseFloat(se.servicioValor)||0,
          servicioValor:netoSe, cantidadDias:parseFloat(se.dias)||0,
          per:parseFloat(se.dias)||0, netoAPagar:netoSe,
          creadoEn:new Date(), actualizadoEn:new Date(),
        });
      }
      if (c2Form.fecha && c2Form.fecha > periodoHasta) setPeriodoHasta(c2Form.fecha);
      await cargarOperaciones();
      setC2Form({...CIAMSA2_FORM_INIT, trabajadorId:c2Form.trabajadorId, trabajadorNombre:c2Form.trabajadorNombre, trabajadorCedula:c2Form.trabajadorCedula, fecha:c2Form.fecha, servicioId:c2Form.servicioId, servicioNombre:c2Form.servicioNombre, tarifaUnitaria:tarifa, unidad:c2Form.unidad});
      setServiciosExtraC2([]);
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
      // Servicios adicionales C3
      for (const se of serviciosExtraC3) {
        if (!se.servicioNombre || !se.cantidad) continue;
        const np3 = parseInt(se.nPersonas)||1;
        const per3 = (parseFloat(se.cantidad)||0)/np3;
        const netoSe = Math.round(per3*(parseFloat(se.servicioValor)||0)*100)/100;
        await addDoc(collection(db,"nomina_operaciones"),{
          ...data, servicioId:se.servicioId||data.servicioId,
          servicioNombre:se.servicioNombre.toUpperCase(),
          tarifaUnitaria:parseFloat(se.servicioValor)||0,
          servicioValorUnitario:parseFloat(se.servicioValor)||0,
          cantidadTons:parseFloat(se.cantidad)||0,
          nPersonas:np3, per:Math.round(per3*10000)/10000,
          servicioValor:netoSe, netoAPagar:netoSe,
          creadoEn:new Date(), actualizadoEn:new Date(),
        });
      }
      if (ciamsaForm.fecha && ciamsaForm.fecha > periodoHasta) setPeriodoHasta(ciamsaForm.fecha);
      await cargarOperaciones();
      setCiamsaForm({...CIAMSA_FORM_INIT, trabajadorId:ciamsaForm.trabajadorId, trabajadorNombre:ciamsaForm.trabajadorNombre, trabajadorCedula:ciamsaForm.trabajadorCedula, fecha:ciamsaForm.fecha});
      setServiciosExtraC3([]);
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

  /* ── Totales por servicio ── */
  const calcularTotalesPorServicio = () => {
    const mapa = {};
    opsFiltradas.forEach(op => {
      const srv = op.servicioNombre || "SIN SERVICIO";
      if (!mapa[srv]) mapa[srv] = { servicio: srv, cantidad: 0, monto: 0, registros: 0 };
      mapa[srv].cantidad  += parseFloat(op.cantidad) || 1;
      mapa[srv].monto     += op.netoAPagar || 0;
      mapa[srv].registros += 1;
    });
    return Object.values(mapa).sort((a,b) => b.monto - a.monto);
  };
  const totalesPorServicio = showTotalesPanel ? calcularTotalesPorServicio() : [];
  const totalGeneral = opsFiltradas.reduce((s,op)=>s+(op.netoAPagar||0),0);
  const totalRegistros = opsFiltradas.length;

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
      <div className="xl-wrap">

        {/* ── HEADER EXCEL ── */}
        <div className="xl-header">
          <button onClick={()=>router.push("/nomina")}
            style={{background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.3)",borderRadius:"5px",cursor:"pointer",color:"#fff",padding:"0.3rem 0.5rem",display:"flex",alignItems:"center"}}>
            <ArrowLeft size={18}/>
          </button>
          <div>
            <h1>📋 Matriz de Operaciones</h1>
            <p>{isCiamsa?"Destajo · PER = Cantidad ÷ N°Personas × Tarifa":"Registro diario por cuadrilla · asistencia en tiempo real"}</p>
          </div>
          <div style={{marginLeft:"auto",display:"flex",gap:"0.4rem",alignItems:"center"}}>
            {clienteActivo==="spia"&&(
              <>
              <button onClick={()=>{setShowMiniCuad(p=>!p);setShowConjuntos(false);}}
                style={{background:showMiniCuad?"#e11d48":"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.35)",borderRadius:"4px",padding:"0.28rem 0.65rem",cursor:"pointer",color:"#fff",fontWeight:"700",fontSize:"0.73rem",display:"flex",alignItems:"center",gap:"0.3rem"}}>
                <Zap size={12}/> Mini Cuadrillas
              </button>
              <button onClick={()=>{setShowConjuntos(p=>!p);setShowMiniCuad(false);}}
                style={{background:showConjuntos?"#7c3aed":"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.35)",borderRadius:"4px",padding:"0.28rem 0.65rem",cursor:"pointer",color:"#fff",fontWeight:"700",fontSize:"0.73rem",display:"flex",alignItems:"center",gap:"0.3rem"}}>
                <Users size={12}/> Conjuntos
              </button>
              </>
            )}
          </div>
        </div>

        {/* ── SELECTOR DE CLIENTE ── */}
        {/* ── RIBBON: Clientes + Período + Acciones ── */}
        <div className="xl-ribbon">
          <span style={{fontSize:"0.72rem",fontWeight:"700",color:"#374151"}}>Cliente:</span>
          {clientes.map(c=>(
            <button key={c.id} onClick={()=>setClienteActivo(c.id)}
              className={`xl-tab${clienteActivo===c.id?" active":""}`}>
              {c.emoji||"🏢"} {c.nombre}
              {(c.id==="cliente1"||c.id==="cliente2"||c.id==="cliente3")&&<span style={{marginLeft:"0.3rem",fontSize:"0.6rem",opacity:0.8}}>DESTAJO</span>}
            </button>
          ))}
          <div className="xl-sep"/>
          <span style={{fontSize:"0.72rem",color:"#374151"}}>📅</span>
          <input type="date" value={periodoDesde} onChange={e=>setPeriodoDesde(e.target.value)}
            className="xl-input" style={{fontWeight:"600",color:"#217346",width:"130px"}}/>
          <span style={{fontSize:"0.72rem",color:"#888"}}>→</span>
          <input type="date" value={periodoHasta} onChange={e=>setPeriodoHasta(e.target.value)}
            className="xl-input" style={{fontWeight:"600",color:"#217346",width:"130px"}}/>
          <button onClick={cargarOperaciones} className="xl-btn primary" style={{display:"flex",alignItems:"center",gap:"0.25rem"}}>
            <RefreshCw size={12} style={{animation:cargandoOps?"spin 1s linear infinite":"none"}}/> Actualizar
          </button>
          <div className="xl-sep"/>
          <button onClick={()=>setShowDetalleModal(true)} className="xl-btn">📊 Detalle/Excel</button>
        </div>

        {/* ── STATS compactos ── */}
        <div className="xl-stats">
          <span>📋 {opsFiltradas.length} registros</span>
          <span>👥 {totalCuadrillas} {isCiamsa?"trabajadores":"cuadrillas"}</span>
          <span className="total">💰 {formatCOP(totalNeto)}</span>
          <span style={{color:"#374151"}}>{periodoDesde} → {periodoHasta}</span>
          {cargandoOps&&<RefreshCw size={11} style={{animation:"spin 1s linear infinite",color:"#217346"}}/> }
        </div>

        {/* ── PANELES MINI/CONJUNTOS ── */}

        {/* Panel Totales por Servicio */}
        {showTotalesPanel&&(
          <div style={{background:"#fff",borderRadius:"14px",boxShadow:"0 4px 20px rgba(16,185,129,0.12)",border:`2px solid ${SUCCESS}`,marginBottom:"1.5rem",overflow:"hidden"}}>
            <div style={{background:`linear-gradient(135deg,${SUCCESS} 0%,#059669 100%)`,padding:"0.9rem 1.25rem",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div><div style={{fontWeight:"800",color:"#fff",fontSize:"1rem"}}>📈 Totales — {clientes.find(c=>c.id===clienteActivo)?.nombre}</div><div style={{color:"rgba(255,255,255,0.8)",fontSize:"0.78rem"}}>Período: {periodoDesde} al {periodoHasta} · {totalRegistros} registros</div></div>
              <div style={{textAlign:"right"}}><div style={{fontWeight:"900",color:"#fff",fontSize:"1.5rem",fontFamily:"monospace"}}>{formatCOP(totalGeneral)}</div><div style={{color:"rgba(255,255,255,0.8)",fontSize:"0.75rem"}}>Total acumulado</div></div>
            </div>
            <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:"0.85rem"}}>
              <thead><tr style={{background:"#f0fdf4",borderBottom:`2px solid ${SUCCESS}`}}>{["#","Servicio","Registros","Cantidad","Total","%"].map(h=>(<th key={h} style={{padding:"0.65rem 1rem",textAlign:h==="Servicio"||h==="#"?"left":"right",fontWeight:"800",color:"#065f46",fontSize:"0.73rem",textTransform:"uppercase"}}>{h}</th>))}</tr></thead>
              <tbody>{totalesPorServicio.length===0?(<tr><td colSpan={6} style={{textAlign:"center",padding:"2rem",color:"#94a3b8"}}>Sin registros</td></tr>):totalesPorServicio.map((row,i)=>{
                const pct=totalGeneral>0?Math.round(row.monto/totalGeneral*1000)/10:0;
                return(<tr key={row.servicio} style={{borderBottom:"1px solid #f0fdf4",background:i%2===0?"#fff":"#f9fafb"}} onMouseEnter={e=>e.currentTarget.style.background="#f0fdf4"} onMouseLeave={e=>e.currentTarget.style.background=i%2===0?"#fff":"#f9fafb"}>
                  <td style={{padding:"0.6rem 1rem",color:"#94a3b8",fontSize:"0.78rem"}}>{i+1}</td>
                  <td style={{padding:"0.6rem 1rem",fontWeight:"700",color:"#1e293b"}}>{row.servicio}</td>
                  <td style={{padding:"0.6rem 1rem",textAlign:"right"}}><span style={{background:"#f0f9ff",color:"#0ea5e9",borderRadius:"6px",padding:"2px 10px",fontWeight:"700",fontSize:"0.8rem"}}>{row.registros}</span></td>
                  <td style={{padding:"0.6rem 1rem",textAlign:"right",fontWeight:"700",color:"#374151",fontFamily:"monospace"}}>{Number.isInteger(row.cantidad)?row.cantidad:row.cantidad.toFixed(2)}</td>
                  <td style={{padding:"0.6rem 1rem",textAlign:"right",fontWeight:"900",color:SUCCESS,fontFamily:"monospace",whiteSpace:"nowrap"}}>{formatCOP(row.monto)}</td>
                  <td style={{padding:"0.6rem 1rem",textAlign:"right"}}><div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:"0.4rem"}}><div style={{background:"#e2e8f0",borderRadius:"99px",height:"6px",width:"70px",overflow:"hidden"}}><div style={{background:SUCCESS,height:"100%",width:`${pct}%`,borderRadius:"99px"}}/></div><span style={{fontFamily:"monospace",fontSize:"0.75rem",color:"#64748b",fontWeight:"700",minWidth:"36px",textAlign:"right"}}>{pct}%</span></div></td>
                </tr>);
              })}</tbody>
              <tfoot><tr style={{background:"#f0fdf4",borderTop:`2px solid ${SUCCESS}`}}>
                <td colSpan={2} style={{padding:"0.7rem 1rem",fontWeight:"800",color:"#065f46"}}>TOTAL — {totalesPorServicio.length} servicio{totalesPorServicio.length!==1?"s":""}</td>
                <td style={{padding:"0.7rem 1rem",textAlign:"right",fontWeight:"800",color:"#065f46"}}>{totalRegistros}</td>
                <td style={{padding:"0.7rem 1rem",textAlign:"right",fontWeight:"800",color:"#065f46",fontFamily:"monospace"}}>{totalesPorServicio.reduce((s,r)=>s+r.cantidad,0).toFixed(2)}</td>
                <td style={{padding:"0.7rem 1rem",textAlign:"right",fontWeight:"900",color:"#065f46",fontFamily:"monospace",fontSize:"1rem",whiteSpace:"nowrap"}}>{formatCOP(totalGeneral)}</td>
                <td style={{padding:"0.7rem 1rem",textAlign:"right",fontWeight:"800",color:"#065f46"}}>100%</td>
              </tr></tfoot>
            </table></div>
          </div>
        )}

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
            FORMULARIO CUADRILLA DIARIA
            Terrestre (cliente1), Ciamsa 2 (cliente2), Ciamsa 3 (cliente3)
            ════════════════════════════════════════════════ */}
        {clienteActivo !== "spia" && (() => {
          const f   = cuadrillaDiaForm;
          const sel = f.trabajadoresSeleccionados;
          // Trabajadores del cliente activo
          const trabCliente = listaTrabajadores;
          // Trabajadores de SPIA disponibles para incluir
          const trabSpia = todosTrabajadores.filter(t =>
            (t.clienteIds || ["spia"]).includes("spia") &&
            !(t.clienteIds || ["spia"]).includes(clienteActivo)
          );
          // Workers de TODOS los demás clientes (no solo SPIA)
          const OTROS_CLIENTES_INFO = [
            {id:"spia",    label:"SPIA",     color:"#0B3D91"},
            {id:"cliente1",label:"Terrestre",color:"#f59e0b"},
            {id:"cliente2",label:"CIAMSA 2", color:"#3b82f6"},
            {id:"cliente3",label:"CIAMSA 3", color:"#8b5cf6"},
          ];
          const trabOtrosPorCliente = OTROS_CLIENTES_INFO
            .filter(cl=>cl.id!==clienteActivo)
            .map(cl=>({
              ...cl,
              trabajadores: todosTrabajadores.filter(t=>{
                const ids=t.clienteIds||["spia"];
                return ids.includes(cl.id) && !ids.includes(clienteActivo);
              })
            }))
            .filter(cl=>cl.trabajadores.length>0);
          const qC = busqTrabCiamsa.toLowerCase().trim();
          const qS = busqSpiaCiamsa.toLowerCase().trim();
          const filtCliente = qC
            ? trabCliente.filter(t => t.nombre?.toLowerCase().includes(qC) || String(t.cedula||"").includes(busqTrabCiamsa))
            : trabCliente;
          const filtSpia = qS
            ? trabSpia.filter(t => t.nombre?.toLowerCase().includes(qS) || String(t.cedula||"").includes(busqSpiaCiamsa))
            : trabSpia;

          // Acumulado por trabajador en el período actual
          const acum = {};
          opsFiltradas.forEach(op => {
            (op.trabajadoresAsisten || []).forEach(w => {
              if (!acum[w.id]) acum[w.id] = { nombre: w.nombre, cedula: w.cedula || "", total: 0, registros: 0 };
              acum[w.id].total    += op.netoAPagar || 0;
              acum[w.id].registros++;
            });
          });
          const acumLista = Object.values(acum).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

          return (
            <div style={{ marginBottom: "1.75rem" }}>

              {/* ── PANEL SUPERIOR: Fecha + Acumulado ── */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 2fr", gap:"1rem", marginBottom:"1rem" }}>

                {/* Fecha */}
                <div style={{ background:"#fff", borderRadius:"14px", padding:"1.25rem",
                  boxShadow:"0 2px 10px rgba(0,0,0,0.06)", border:`1.5px solid ${colorCiamsa}30` }}>
                  <div style={{ fontWeight:"800", fontSize:"0.82rem", color:colorCiamsa,
                    textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:"0.75rem" }}>
                    📅 Fecha de operación
                  </div>
                  <input type="date" value={f.fecha}
                    onChange={e => cuadrillaDiaSetField("fecha", e.target.value)}
                    style={{ ...inputSt, border:`1.5px solid ${colorCiamsa}60`, fontSize:"1rem", fontWeight:"700", color:colorCiamsa }} />
                  <div style={{ marginTop:"0.6rem", fontSize:"0.75rem", color:"#64748b" }}>
                    Período: {periodoDesde} → {periodoHasta}
                  </div>
                </div>

                {/* Acumulado quincena */}
                <div style={{ background:"#fff", borderRadius:"14px", padding:"1.25rem",
                  boxShadow:"0 2px 10px rgba(0,0,0,0.06)", border:"1.5px solid #e2e8f0" }}>
                  <div style={{ fontWeight:"800", fontSize:"0.82rem", color:"#475569",
                    textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:"0.6rem",
                    display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <span>📊 Acumulado quincena</span>
                    <span style={{ fontSize:"0.72rem", color:colorCiamsa, fontWeight:"700" }}>
                      Total: {formatCOP(acumLista.reduce((s, t) => s + t.total, 0))}
                    </span>
                  </div>
                  {acumLista.length === 0 ? (
                    <div style={{ fontSize:"0.8rem", color:"#94a3b8" }}>Sin registros aún en este período</div>
                  ) : (
                    <div style={{ display:"flex", flexWrap:"wrap", gap:"0.4rem", maxHeight:"110px", overflowY:"auto" }}>
                      {acumLista.map(t => (
                        <div key={t.cedula} style={{ background:`${colorCiamsa}10`,
                          border:`1px solid ${colorCiamsa}30`, borderRadius:"8px",
                          padding:"0.35rem 0.65rem", fontSize:"0.75rem" }}>
                          <div style={{ fontWeight:"700", color:"#1e293b" }}>{t.nombre.split(" ")[0]} {t.nombre.split(" ")[2]||""}</div>
                          <div style={{ fontWeight:"900", color:colorCiamsa, fontFamily:"monospace" }}>{formatCOP(t.total)}</div>
                          <div style={{ fontSize:"0.65rem", color:"#94a3b8" }}>{t.registros} reg.</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ── PANEL PRINCIPAL: Cuadrilla del día + Servicio ── */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1rem" }}>

                {/* COLUMNA IZQUIERDA: Selección de trabajadores */}
                <div style={{ background:"#fff", borderRadius:"14px", padding:"1.25rem",
                  boxShadow:"0 2px 10px rgba(0,0,0,0.06)", border:`2px solid ${colorCiamsa}40` }}>
                  <div style={{ fontWeight:"800", fontSize:"0.82rem", color:colorCiamsa,
                    textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:"0.75rem",
                    display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <span>👷 Cuadrilla del día — {f.fecha}</span>
                    <span style={{ background:`${colorCiamsa}18`, color:colorCiamsa,
                      borderRadius:"8px", padding:"2px 10px", fontSize:"0.75rem" }}>
                      {sel.length} seleccionados
                    </span>
                  </div>

                  {/* Trabajadores del cliente */}
                  <div style={{ fontSize:"0.72rem", fontWeight:"700", color:"#64748b",
                    textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:"0.35rem" }}>
                    {nombreCiamsa}
                    {filtCliente.length !== trabCliente.length && ` (${filtCliente.length}/${trabCliente.length})`}
                  </div>
                  <input value={busqTrabCiamsa} onChange={e => setBusqTrabCiamsa(e.target.value)}
                    placeholder="🔍 Buscar trabajador..."
                    style={{ ...inputSt, padding:"0.45rem 0.75rem", fontSize:"0.82rem", marginBottom:"0.5rem" }} />
                  <div style={{ border:`1px solid ${colorCiamsa}25`, borderRadius:"10px",
                    overflow:"hidden", maxHeight:"220px", overflowY:"auto", marginBottom:"0.75rem" }}>
                    {/* Seleccionar todos */}
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                      padding:"0.35rem 0.65rem", background:`${colorCiamsa}08`,
                      borderBottom:`1px solid ${colorCiamsa}15`, position:"sticky", top:0 }}>
                      <span style={{ fontSize:"0.7rem", color:"#64748b", fontWeight:"600" }}>
                        {sel.filter(x => trabCliente.some(t => t.id === x.id)).length}/{trabCliente.length}
                      </span>
                      <div style={{ display:"flex", gap:"0.35rem" }}>
                        <button onClick={() => setCuadrillaDiaForm(prev => cuadrillaDiaRecalcular({
                          ...prev,
                          trabajadoresSeleccionados: [
                            ...prev.trabajadoresSeleccionados.filter(x => !trabCliente.some(t => t.id === x.id)),
                            ...trabCliente.map(t => ({ id:t.id, nombre:t.nombre, cedula:String(t.cedula||""), cargo:t.cargo||""})),
                          ]
                        }))}
                          style={{ fontSize:"0.68rem", background:colorCiamsa, color:"#fff",
                            border:"none", borderRadius:"5px", padding:"2px 8px", cursor:"pointer", fontWeight:"700" }}>
                          Todos
                        </button>
                        <button onClick={() => setCuadrillaDiaForm(prev => cuadrillaDiaRecalcular({
                          ...prev,
                          trabajadoresSeleccionados: prev.trabajadoresSeleccionados.filter(x => !trabCliente.some(t => t.id === x.id))
                        }))}
                          style={{ fontSize:"0.68rem", background:"#f1f5f9", color:"#64748b",
                            border:"1px solid #e2e8f0", borderRadius:"5px", padding:"2px 8px", cursor:"pointer" }}>
                          Ninguno
                        </button>
                      </div>
                    </div>
                    {filtCliente.map(t => {
                      const selec = sel.some(x => x.id === t.id);
                      return (
                        <div key={t.id} onClick={() => cuadrillaDiaToggleTrabajador(t)}
                          style={{ display:"flex", alignItems:"center", gap:"0.5rem",
                            padding:"0.4rem 0.65rem",
                            background: selec ? `${colorCiamsa}12` : "#fff",
                            borderBottom:`1px solid ${colorCiamsa}10`,
                            cursor:"pointer", transition:"background 0.1s" }}
                          onMouseEnter={e=>{ if(!selec) e.currentTarget.style.background="#f8fafc"; }}
                          onMouseLeave={e=>{ if(!selec) e.currentTarget.style.background="#fff"; }}>
                          <div style={{ width:"15px", height:"15px", borderRadius:"4px", flexShrink:0,
                            border:`2px solid ${selec ? colorCiamsa : "#cbd5e1"}`,
                            background: selec ? colorCiamsa : "#fff",
                            display:"flex", alignItems:"center", justifyContent:"center" }}>
                            {selec && <CheckCircle size={9} color="#fff" strokeWidth={3}/>}
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontWeight: selec?"700":"500", fontSize:"0.83rem",
                              color: selec ? colorCiamsa : "#1e293b",
                              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                              {t.nombre}
                            </div>
                            <div style={{ fontSize:"0.68rem", color:"#94a3b8", fontFamily:"monospace" }}>{t.cedula}</div>
                          </div>
                          <span style={{ fontSize:"0.65rem", color:"#94a3b8", flexShrink:0 }}>{t.cargo}</span>
                        </div>
                      );
                    })}
                    {filtCliente.length === 0 && (
                      <div style={{ padding:"1rem", textAlign:"center", color:"#94a3b8", fontSize:"0.8rem" }}>
                        Sin resultados
                      </div>
                    )}
                  </div>

                  {/* Personal adicional de TODOS los demás clientes */}
                  {trabOtrosPorCliente.length > 0 && (
                    <>
                      <div style={{fontSize:"0.72rem",fontWeight:"700",color:"#374151",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"0.35rem"}}>
                        👥 Personal adicional — otros clientes
                      </div>
                      <input value={busqSpiaCiamsa} onChange={e=>setBusqSpiaCiamsa(e.target.value)}
                        placeholder="🔍 Buscar por nombre o cédula..."
                        style={{...inputSt,padding:"0.45rem 0.75rem",fontSize:"0.82rem",marginBottom:"0.5rem"}}/>
                      {trabOtrosPorCliente.map(cl=>{
                        const qS=busqSpiaCiamsa.toLowerCase().trim();
                        const filtCl=qS?cl.trabajadores.filter(t=>t.nombre?.toLowerCase().includes(qS)||String(t.cedula||"").includes(busqSpiaCiamsa)):cl.trabajadores;
                        if(!filtCl.length) return null;
                        return (
                          <div key={cl.id} style={{marginBottom:"0.5rem"}}>
                            <div style={{fontSize:"0.67rem",fontWeight:"700",color:cl.color,textTransform:"uppercase",letterSpacing:"0.04em",padding:"2px 6px",background:cl.color+"18",borderRadius:"4px",display:"inline-block",marginBottom:"0.25rem"}}>
                              {cl.label}
                            </div>
                            <div style={{border:`1px solid ${cl.color}40`,borderRadius:"8px",overflow:"hidden",maxHeight:"140px",overflowY:"auto"}}>
                              {filtCl.map(t=>{
                                const selec=sel.some(x=>x.id===t.id);
                                return(
                                  <div key={t.id} onClick={()=>cuadrillaDiaToggleTrabajador(t)}
                                    style={{display:"flex",alignItems:"center",gap:"0.5rem",padding:"0.4rem 0.65rem",background:selec?`${cl.color}12`:"#fff",borderBottom:"1px solid #f8fafc",cursor:"pointer"}}
                                    onMouseEnter={e=>{if(!selec)e.currentTarget.style.background=cl.color+"08";}}
                                    onMouseLeave={e=>{if(!selec)e.currentTarget.style.background="#fff";}}>
                                    <div style={{width:"15px",height:"15px",borderRadius:"4px",flexShrink:0,border:`2px solid ${selec?cl.color:"#cbd5e1"}`,background:selec?cl.color:"#fff",display:"flex",alignItems:"center",justifyContent:"center"}}>
                                      {selec&&<CheckCircle size={9} color="#fff" strokeWidth={3}/>}
                                    </div>
                                    <div style={{flex:1,minWidth:0}}>
                                      <div style={{fontWeight:selec?"700":"400",fontSize:"0.82rem",color:selec?cl.color:"#1e293b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.nombre}</div>
                                      <div style={{fontSize:"0.67rem",color:"#94a3b8",fontFamily:"monospace"}}>{t.cedula}</div>
                                    </div>
                                    <span style={{fontSize:"0.6rem",background:cl.color+"20",color:cl.color,borderRadius:"4px",padding:"1px 5px",fontWeight:"700",flexShrink:0}}>{cl.label}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>

                {/* COLUMNA DERECHA: Registro del servicio */}
                <div style={{ background:"#fff", borderRadius:"14px", padding:"1.25rem",
                  boxShadow:"0 2px 10px rgba(0,0,0,0.06)",
                  border:`2px solid ${cuadrillaDiaGuardando || cuadrillaDiaOk ? colorCiamsa : "#e2e8f0"}` }}>
                  <div style={{ fontWeight:"800", fontSize:"0.82rem", color:"#475569",
                    textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:"1rem" }}>
                    ⚖️ Registrar servicio
                  </div>

                  {/* Servicio */}
                  <div style={{ marginBottom:"0.9rem" }}>
                    <label style={labelSt}>🔧 Servicio *</label>
                    <div style={{ position:"relative" }}>
                    <input
                    value={busqServicioCia}
                    onChange={e=>setBusqServicioCia(e.target.value)}
                    placeholder="🔍 Buscar servicio..."
                    style={{...inputSt, marginBottom:"0.35rem", fontSize:"0.85rem", border:`1.5px solid ${colorCiamsa}50`}}
                    />
                    <select value={f.servicioId} onChange={e => cuadrillaDiaSelServicio(e.target.value)}
                    style={{ ...selectSt, border:`1.5px solid ${colorCiamsa}50` }}>
                      <option value="">— Seleccionar servicio —</option>
                      {servicios
                        .filter(s => !busqServicioCia || s.nombre?.toLowerCase().includes(busqServicioCia.toLowerCase()))
                        .map(s => (
                        <option key={s.id} value={s.id}>
                          {s.nombre}{(s.valor||s.tarifa) > 0 ? ` · ${formatCOP(s.valor||s.tarifa||0)}/${s.unidad||"ton"}` : ""}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={15} style={{ position:"absolute", right:"0.75rem", top:"50%",
                        transform:"translateY(-50%)", color:"#94a3b8", pointerEvents:"none" }}/>
                    </div>
                  </div>

                  {/* Cálculo destajo */}
                  {f.servicioId && (
                    <div style={{ background:`${colorCiamsa}06`, border:`1.5px solid ${colorCiamsa}20`,
                      borderRadius:"12px", padding:"1rem", marginBottom:"0.9rem" }}>
                      <div style={{ fontSize:"0.7rem", fontWeight:"800", color:colorCiamsa,
                        textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:"0.75rem" }}>
                        {f.unidad === "dia" ? "📅 Días trabajados por persona" :
                         f.unidad === "hora" ? "⏰ Horas trabajadas por persona" :
                         "⚖️ Destajo — PER = Cantidad ÷ N° Personas"}
                      </div>
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.75rem", alignItems:"end" }}>
                        <div>
                          <label style={labelSt}>
                            {f.unidad === "dia" ? "📅 Días *" :
                             f.unidad === "hora" ? "⏰ Horas *" :
                             "📦 Cantidad total del grupo *"}
                          </label>
                          <input type="number" step="0.01" min="0" value={f.cantidad}
                            onChange={e => cuadrillaDiaSetField("cantidad", e.target.value)}
                            placeholder="0"
                            style={{ ...inputSt, border:`1.5px solid ${colorCiamsa}60`, fontWeight:"700" }}/>
                          {f.unidad !== "dia" && f.unidad !== "hora" && (
                            <div style={{ fontSize:"0.67rem", color:"#94a3b8", marginTop:"0.2rem" }}>
                              {sel.length} personas → PER = {f.cantidad ? (parseFloat(f.cantidad) / (sel.length||1)).toFixed(4) : "—"}
                            </div>
                          )}
                        </div>
                        <div>
                          <label style={labelSt}>💲 Tarifa</label>
                          <div style={{ ...readonlySt, fontFamily:"monospace", fontWeight:"700",
                            color: f.tarifaUnitaria > 0 ? "#059669" : "#94a3b8",
                            background: f.tarifaUnitaria > 0 ? "#f0fdf4" : "#f8fafc" }}>
                            {f.tarifaUnitaria > 0 ? formatCOP(f.tarifaUnitaria) : <span style={{ color:"#cbd5e1" }}>Del servicio</span>}
                            {f.unidad && <span style={{ fontSize:"0.68rem", marginLeft:"4px", opacity:0.7 }}>/{f.unidad}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Neto por persona */}
                  <div style={{ marginBottom:"1rem" }}>
                    <label style={{ ...labelSt, color:"#065f46" }}>💰 Neto por persona</label>
                    <div style={{ padding:"0.85rem 1.1rem",
                      background: f.netoCalculado > 0 ? "#f0fdf4" : "#f8fafc",
                      border:`2px solid ${f.netoCalculado > 0 ? SUCCESS : "#e2e8f0"}`,
                      borderRadius:"10px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                      <span style={{ fontWeight:"900", color:"#065f46", fontSize:"1.3rem", fontFamily:"monospace" }}>
                        {f.netoCalculado > 0 ? formatCOP(f.netoCalculado) : "—"}
                      </span>
                      {f.netoCalculado > 0 && sel.length > 1 && (
                        <span style={{ fontSize:"0.75rem", color:"#065f46", background:"#dcfce7",
                          padding:"0.2rem 0.7rem", borderRadius:"20px", fontWeight:"700" }}>
                          Total grupo: {formatCOP(f.netoCalculado * sel.length)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Trabajadores seleccionados chips */}
                  {sel.length > 0 && (
                    <div style={{ marginBottom:"1rem" }}>
                      <div style={{ fontSize:"0.72rem", fontWeight:"700", color:"#64748b",
                        textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:"0.4rem" }}>
                        👷 {sel.length} trabajador{sel.length !== 1 ? "es" : ""} en cuadrilla
                      </div>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:"0.3rem" }}>
                        {sel.map(t => (
                          <span key={t.id} onClick={() => cuadrillaDiaToggleTrabajador(t)}
                            style={{ background:`${colorCiamsa}15`, color:colorCiamsa,
                              border:`1px solid ${colorCiamsa}30`, borderRadius:"20px",
                              padding:"0.2rem 0.65rem", fontSize:"0.73rem", fontWeight:"700",
                              cursor:"pointer", display:"flex", alignItems:"center", gap:"0.3rem" }}>
                            {t.nombre.split(" ")[0]}
                            <X size={10} style={{ opacity:0.6 }}/>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Botón guardar */}
                  {cuadrillaDiaOk && (
                    <div style={{ background:"#f0fdf4", border:"1.5px solid #6ee7b7",
                      borderRadius:"10px", padding:"0.5rem 0.9rem",
                      color:"#065f46", fontWeight:"700", fontSize:"0.85rem", marginBottom:"0.75rem" }}>
                      ✅ Operación guardada — trabajadores conservados para el siguiente registro
                    </div>
                  )}

                  {/* ══ MULTI-SERVICIO Terrestre/CIAMSA ══ */}
                  {serviciosExtraCia.length>0 && (
                    <div style={{borderRadius:"10px",border:"1.5px solid #e0e7ff",overflow:"hidden",background:"#f5f8ff",marginBottom:"0.5rem"}}>
                      <div style={{padding:"0.4rem 0.8rem",background:"#4f46e5",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                        <span style={{fontWeight:"800",color:"#fff",fontSize:"0.78rem"}}>➕ Servicios adicionales ({serviciosExtraCia.length})</span>
                        <span style={{fontSize:"0.68rem",color:"rgba(255,255,255,0.75)"}}>Un registro por servicio al guardar</span>
                      </div>
                      {serviciosExtraCia.map((se,si)=>(
                        <div key={se.uid} style={{display:"grid",gridTemplateColumns:"1fr auto auto auto",gap:"0.5rem",alignItems:"end",padding:"0.55rem 0.8rem",borderBottom:"1px solid #e0e7ff",background:si%2===0?"#f5f8ff":"#eef2ff"}}>
                          <div>
                            <label style={{...labelSt,color:"#4f46e5",fontSize:"0.7rem"}}>🔧 Servicio {si+2}</label>
                            <div style={{position:"relative"}}>
                              <select value={se.servicioId} onChange={e=>sExtraCiaUpdate(se.uid,"servicioId",e.target.value)} style={{...selectSt,border:"1.5px solid #a5b4fc",fontSize:"0.82rem"}}>
                                <option value="">— Seleccionar —</option>
                                {servicios.map(s=>(<option key={s.id} value={s.id}>{s.nombre}{(s.valor||s.tarifa)>0?` · ${formatCOP(s.valor||s.tarifa||0)}`:""}</option>))}
                              </select>
                              <ChevronDown size={12} style={{position:"absolute",right:"0.5rem",top:"50%",transform:"translateY(-50%)",color:"#94a3b8",pointerEvents:"none"}}/>
                            </div>
                          </div>
                          <div style={{minWidth:"80px"}}>
                            <label style={{...labelSt,color:"#4f46e5",fontSize:"0.7rem"}}>📦 Cant.</label>
                            <input type="number" min="0" step="0.01" value={se.cantidad} onChange={e=>sExtraCiaUpdate(se.uid,"cantidad",e.target.value)} style={{...inputSt,border:"1.5px solid #a5b4fc",textAlign:"center",fontSize:"0.82rem"}}/>
                          </div>
                          <div style={{minWidth:"95px"}}>
                            <label style={{...labelSt,color:"#065f46",fontSize:"0.7rem"}}>💰 Neto/p</label>
                            <div style={{...readonlySt,background:se.netoCalculado>0?"#f0fdf4":"#f8fafc",border:`1.5px solid ${se.netoCalculado>0?"#6ee7b7":"#e2e8f0"}`,fontWeight:"800",color:"#065f46",fontFamily:"monospace",fontSize:"0.85rem"}}>
                              {se.netoCalculado>0?formatCOP(se.netoCalculado):"—"}
                            </div>
                          </div>
                          <button onClick={()=>sExtraCiaRemove(se.uid)} style={{background:"#fff1f2",border:"1px solid #fecdd3",borderRadius:"7px",padding:"0.45rem 0.5rem",cursor:"pointer",color:"#e11d48",display:"flex",alignItems:"center"}}>
                            <X size={13}/>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button type="button" onClick={sExtraCiaAdd}
                    style={{width:"100%",marginBottom:"0.6rem",background:"#eef2ff",border:"1.5px dashed #818cf8",borderRadius:"8px",padding:"0.4rem",cursor:"pointer",color:"#4f46e5",fontWeight:"700",fontSize:"0.78rem",display:"flex",alignItems:"center",justifyContent:"center",gap:"0.35rem"}}>
                    <Plus size={13}/> Agregar otro servicio
                  </button>
                  <button onClick={cuadrillaDiaGuardar}
                    disabled={cuadrillaDiaGuardando || sel.length === 0 || !f.servicioNombre || !f.cantidad || !puedeEditarMatriz}
                    title={!puedeEditarMatriz ? "Sin permiso" : ""}
                    style={{
                      width:"100%", padding:"0.85rem",
                      background: (cuadrillaDiaGuardando || sel.length === 0 || !f.servicioNombre || !f.cantidad || !puedeEditarMatriz)
                        ? "#94a3b8" : colorCiamsa,
                      border:"none", borderRadius:"10px", color:"#fff",
                      fontWeight:"800", fontSize:"0.95rem",
                      cursor: puedeEditarMatriz ? "pointer" : "not-allowed",
                      display:"flex", alignItems:"center", justifyContent:"center", gap:"0.6rem",
                      boxShadow:`0 4px 12px ${colorCiamsa}40`,
                    }}>
                    {cuadrillaDiaGuardando
                      ? <><RefreshCw size={18} style={{ animation:"spin 1s linear infinite" }}/> Guardando...</>
                      : <><Save size={18}/> Guardar operación</>}
                  </button>
                  {!puedeEditarMatriz && (
                    <div style={{ textAlign:"center", fontSize:"0.78rem", color:"#94a3b8", marginTop:"0.5rem" }}>
                      🔒 Solo lectura
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {false && (
        <div style={{display:"none"}}>
          <div style={{display:"none"}}>
            <div>
            {editandoId&&(
              <button onClick={cancelarEdicion}
                style={{background:"#fef3c7",border:"1.5px solid #fcd34d",borderRadius:"8px",padding:"0.4rem 0.8rem",cursor:"pointer",color:"#92400e",fontWeight:"700",fontSize:"0.82rem",display:"flex",alignItems:"center",gap:"0.4rem"}}>
                <X size={14}/> Cancelar
              </button>
            )}
          </div>

          <div style={{padding:"1.5rem"}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:"1rem"}}>

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

              {/* Multi-servicio C3 */}
              {serviciosExtraC3.length>0 && (
                <div style={{borderRadius:"10px",border:"1.5px solid #e0e7ff",overflow:"hidden",background:"#f5f8ff",marginTop:"0.75rem",marginBottom:"0.5rem"}}>
                  <div style={{padding:"0.4rem 0.8rem",background:"#4f46e5"}}>
                    <span style={{fontWeight:"800",color:"#fff",fontSize:"0.78rem"}}>➕ Servicios adicionales ({serviciosExtraC3.length})</span>
                  </div>
                  {serviciosExtraC3.map((se,si)=>(
                    <div key={se.uid} style={{display:"grid",gridTemplateColumns:"1fr auto auto auto auto",gap:"0.5rem",alignItems:"end",padding:"0.55rem 0.8rem",borderBottom:"1px solid #e0e7ff"}}>
                      <div>
                        <label style={{...labelSt,color:"#4f46e5",fontSize:"0.7rem"}}>🔧 Servicio {si+2}</label>
                        <div style={{position:"relative"}}>
                          <select value={se.servicioId} onChange={e=>sExtraC3Update(se.uid,"servicioId",e.target.value)} style={{...selectSt,border:"1.5px solid #a5b4fc",fontSize:"0.82rem"}}>
                            <option value="">— Seleccionar —</option>
                            {servicios.map(s=>(<option key={s.id} value={s.id}>{s.nombre}</option>))}
                          </select>
                          <ChevronDown size={12} style={{position:"absolute",right:"0.5rem",top:"50%",transform:"translateY(-50%)",color:"#94a3b8",pointerEvents:"none"}}/>
                        </div>
                      </div>
                      <div style={{minWidth:"80px"}}>
                        <label style={{...labelSt,color:"#4f46e5",fontSize:"0.7rem"}}>📦 Cant.</label>
                        <input type="number" min="0" step="0.01" value={se.cantidad} onChange={e=>sExtraC3Update(se.uid,"cantidad",e.target.value)} style={{...inputSt,border:"1.5px solid #a5b4fc",textAlign:"center",fontSize:"0.82rem"}}/>
                      </div>
                      <div style={{minWidth:"60px"}}>
                        <label style={{...labelSt,color:"#4f46e5",fontSize:"0.7rem"}}>Nº Per.</label>
                        <input type="number" min="1" value={se.nPersonas} onChange={e=>sExtraC3Update(se.uid,"nPersonas",e.target.value)} style={{...inputSt,border:"1.5px solid #a5b4fc",textAlign:"center",fontSize:"0.82rem"}}/>
                      </div>
                      <div style={{minWidth:"90px"}}>
                        <label style={{...labelSt,color:"#065f46",fontSize:"0.7rem"}}>💰 Neto</label>
                        <div style={{...readonlySt,background:se.netoCalculado>0?"#f0fdf4":"#f8fafc",border:`1.5px solid ${se.netoCalculado>0?"#6ee7b7":"#e2e8f0"}`,fontWeight:"800",color:"#065f46",fontFamily:"monospace",fontSize:"0.85rem"}}>{se.netoCalculado>0?formatCOP(se.netoCalculado):"—"}</div>
                      </div>
                      <button onClick={()=>sExtraC3Remove(se.uid)} style={{background:"#fff1f2",border:"1px solid #fecdd3",borderRadius:"7px",padding:"0.45rem 0.5rem",cursor:"pointer",color:"#e11d48",display:"flex",alignItems:"center"}}><X size={13}/></button>
                    </div>
                  ))}
                </div>
              )}
              <button type="button" onClick={sExtraC3Add}
                style={{width:"100%",marginTop:"0.5rem",marginBottom:"0.75rem",background:"#eef2ff",border:"1.5px dashed #818cf8",borderRadius:"8px",padding:"0.4rem",cursor:"pointer",color:"#4f46e5",fontWeight:"700",fontSize:"0.78rem",display:"flex",alignItems:"center",justifyContent:"center",gap:"0.35rem"}}>
                <Plus size={13}/> Agregar otro servicio
              </button>
              {/* Botón guardar CIAMSA 3 */}
              <div style={{marginTop:"1.25rem",display:"flex",gap:"0.75rem",alignItems:"center",flexWrap:"wrap"}}>
                <button onClick={ciamsaGuardar}
                  disabled={ciamsaGuardando||!ciamsaForm.trabajadorNombre||!ciamsaForm.servicioNombre||!ciamsaForm.cantidad||!puedeEditarMatriz}
                  title={!puedeEditarMatriz?"Sin permiso de edición en Matriz":""}
                  style={{background:(ciamsaGuardando||!ciamsaForm.trabajadorNombre||!ciamsaForm.servicioNombre||!ciamsaForm.cantidad||!puedeEditarMatriz)?"#94a3b8":ciamsaEditId?"#f59e0b":colorCiamsa,
                    border:"none",borderRadius:"10px",padding:"0.85rem 2rem",color:"#fff",fontWeight:"800",fontSize:"1rem",cursor:puedeEditarMatriz?"pointer":"not-allowed",
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
                {!puedeEditarMatriz && <span style={{color:"#94a3b8",fontSize:"0.8rem",fontWeight:"600"}}>🔒 Solo lectura</span>}
              </div>
            </div>
          </div>
        </div>
        </div>
        )}

        {clienteActivo === "spia" && showConjuntos && (
        <ConjuntosPanel
          cuadrillas={cuadrillasAsistencia}
          servicios={servicios}
          clienteId={clienteActivo}
          onGuardado={cargarOperaciones}
          onClose={()=>setShowConjuntos(false)}
          todosTrabajadores={todosTrabajadores||listaTrabajadores}
          clientes={clientes}
        />
        )}
        {clienteActivo === "spia" && showMiniCuad && (
        <MiniCuadrillaPanel
            cuadrillas={cuadrillasAsistencia}
            servicios={servicios}
            clienteId={clienteActivo}
            onGuardado={cargarOperaciones}
            onClose={() => setShowMiniCuad(false)}
            todosTrabajadores={todosTrabajadores}
            clientes={clientes}
          />
        )}
        {clienteActivo === "spia" && (
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
              <div style={{display:"flex",gap:"0.5rem",alignItems:"center"}}>
                <button onClick={()=>{ setShowConjuntos(p=>!p); setShowMiniCuad(false); }}
                  style={{background:"rgba(255,255,255,0.12)",
                    border:"1.5px solid rgba(255,255,255,0.35)",borderRadius:"8px",
                    padding:"0.35rem 0.75rem",cursor:"pointer",
                    color:editandoId?"#92400e":"#fff",fontWeight:"700",fontSize:"0.78rem",
                    display:"flex",alignItems:"center",gap:"0.35rem"}}>
                  <Users size={13}/> Conjuntos
                </button>
                <button onClick={()=>setShowMiniCuad(p=>!p)}
                  style={{background:showMiniCuad?"rgba(255,255,255,0.25)":"rgba(255,255,255,0.12)",
                    border:"1.5px solid rgba(255,255,255,0.35)",borderRadius:"8px",
                    padding:"0.35rem 0.75rem",cursor:"pointer",
                    color:editandoId?"#92400e":"#fff",fontWeight:"700",fontSize:"0.78rem",
                    display:"flex",alignItems:"center",gap:"0.35rem"}}>
                  <Zap size={13}/> Mini Cuadrillas
                  {showMiniCuad&&<X size={11} style={{marginLeft:"2px"}}/>}
                </button>
                {editandoId&&(
                  <button onClick={cancelarEdicion}
                    style={{background:"#fef3c7",border:"1.5px solid #fcd34d",borderRadius:"8px",padding:"0.4rem 0.8rem",cursor:"pointer",color:"#92400e",fontWeight:"700",fontSize:"0.82rem",display:"flex",alignItems:"center",gap:"0.4rem"}}>
                    <X size={14}/> Cancelar
                  </button>
                )}
              </div>
            </div>

            <div style={{padding:"1.5rem"}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:"1rem"}}>
                <div style={{gridColumn:"span 2"}}>
                  <label style={labelSt}>👥 Cuadrilla / Trabajador *</label>
                  <SearchableCuadrillaSelect
                    cuadrillas={cuadrillasAsistencia}
                    trabajadores={listaTrabajadores}
                    value={form.cuadrillaId}
                    onChange={seleccionarCuadrilla}
                    color={PRIMARY}
                    onFechaChange={fecha => setField("fecha", fecha)}
                    diasSeleccionados={diasSemanalSeleccionados}
                    onDiasChange={nuevos => {
                      setDiasSemanalSeleccionados(nuevos);
                      if (nuevos.length === 0) {
                        setForm(prev=>({...prev,cuadrillaId:"",cuadrillaNombre:"",tipoSeleccion:""}));
                        setAsistentesForm([]); setAusentesForm([]);
                      }
                    }}
                    onMiniClick={c => {
                      seleccionarCuadrilla(c.id);
                      setShowMiniCuad(true);
                    }}
                  />
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

              {/* ═ PANEL MULTI-DÍA: visible cuando hay días semanal seleccionados ═ */}
              {diasSemanalSeleccionados.length > 0 && (
                <div style={{margin:"1rem 0",borderRadius:"12px",overflow:"hidden",
                  border:"2px solid #059669",background:"#f0fdf4"}}>
                  {/* Header */}
                  <div style={{padding:"0.65rem 1rem",background:"#059669",
                    display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <span style={{fontWeight:"800",color:"#fff",fontSize:"0.88rem"}}>
                      📅 Modo semanal — se crearán {diasSemanalSeleccionados.length} registro{diasSemanalSeleccionados.length!==1?"s":""} independientes
                    </span>
                    <button onClick={()=>{
                        setDiasSemanalSeleccionados([]);
                        setForm(prev=>({...prev,cuadrillaId:"",cuadrillaNombre:"",tipoSeleccion:""}));
                      }}
                      style={{background:"rgba(255,255,255,0.2)",border:"none",borderRadius:"6px",
                        padding:"2px 8px",cursor:"pointer",color:"#fff",fontWeight:"700",fontSize:"0.75rem"}}>
                      × Limpiar
                    </button>
                  </div>
                  {/* Chips de días */}
                  <div style={{padding:"0.65rem 1rem",display:"flex",flexWrap:"wrap",gap:"0.4rem",alignItems:"center"}}>
                    {diasSemanalSeleccionados.map(d => (
                      <span key={d.id} style={{
                        background:"#fff",border:"1.5px solid #86efac",
                        color:"#065f46",borderRadius:"20px",
                        padding:"0.2rem 0.6rem 0.2rem 0.8rem",
                        fontSize:"0.78rem",fontWeight:"700",
                        display:"flex",alignItems:"center",gap:"0.3rem"}}>
                        {d.label}
                        <button onClick={()=>{
                            const nuevo = diasSemanalSeleccionados.filter(x=>x.id!==d.id);
                            setDiasSemanalSeleccionados(nuevo);
                            if(nuevo.length===0){
                              setForm(prev=>({...prev,cuadrillaId:"",cuadrillaNombre:"",tipoSeleccion:""}));
                            }
                          }}
                          style={{background:"none",border:"none",cursor:"pointer",
                            color:"#94a3b8",padding:0,display:"flex",lineHeight:1}}>
                          <X size={11}/>
                        </button>
                      </span>
                    ))}
                  </div>
                  {/* Info */}
                  <div style={{padding:"0.4rem 1rem 0.65rem",fontSize:"0.78rem",color:"#065f46"}}>
                    ℹ️ Cada día usa su propio snapshot de composición y cuenta sus asistentes para calcular el neto.
                    Selecciona el servicio y cantidad abajo, luego guarda.
                  </div>
                </div>
              )}

              {/* Panel asistencia (solo en modo día único) */}
              {diasSemanalSeleccionados.length === 0 && form.cuadrillaId && form.fecha && (
                <div style={{margin:"1rem 0",borderRadius:"12px",border:"1px solid #e2e8f0",overflow:"hidden"}}>
                  <div style={{padding:"0.65rem 1rem",background:usandoSnapshotHistorico?"#f0fdf4":`${PRIMARY}08`,display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid #e2e8f0"}}>
                    <span style={{fontWeight:"700",color:usandoSnapshotHistorico?"#059669":PRIMARY,fontSize:"0.85rem",display:"flex",alignItems:"center",gap:"0.5rem"}}>
                      {form.tipoSeleccion==="trabajador" ? "👤 Trabajador individual" : `📋 Asistencia del día — ${form.fecha}`}
                      {usandoSnapshotHistorico && form.tipoSeleccion!=="trabajador" && (
                        <span style={{background:"#059669",color:"#fff",borderRadius:"6px",padding:"1px 8px",fontSize:"0.65rem",fontWeight:"800"}}>
                          📸 COMPOSICIÓN HISTÓRICA DEL DÍA
                        </span>
                      )}
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

              {/* ── Trabajadores adicionales de otros clientes (SPIA) ── */}
              {clienteActivo==="spia" && (() => {
                const CLIENTES_AD = [
                  {id:"cliente1", label:"Terrestre", color:"#f59e0b"},
                  {id:"cliente2", label:"CIAMSA 2",  color:"#3b82f6"},
                  {id:"cliente3", label:"CIAMSA 3",  color:"#8b5cf6"},
                ];
                const qA = busqTrabAd.toLowerCase().trim();
                const trabsOtros = (todosTrabajadores||[]).filter(t =>
                  !listaTrabajadores.some(x => x.id === t.id)
                );
                const filtOtros = qA
                  ? trabsOtros.filter(t=>t.nombre?.toLowerCase().includes(qA)||String(t.cedula||"").includes(busqTrabAd))
                  : trabsOtros;
                if (trabsOtros.length === 0 && todosTrabajadores.length === 0) return null;
                return (
                  <div style={{margin:"0.75rem 0",borderRadius:"12px",overflow:"hidden",border:"1.5px solid #e0e7ff"}}>
                    {/* Header colapsable */}
                    <div onClick={()=>setShowTrabsPanel(p=>!p)}
                      style={{padding:"0.55rem 1rem",background:showTrabsPanel?"#4f46e5":"#eef2ff",
                        display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",borderBottom:showTrabsPanel?"1px solid #4338ca":"none"}}>
                      <span style={{fontWeight:"800",color:showTrabsPanel?"#fff":"#4f46e5",fontSize:"0.82rem",display:"flex",alignItems:"center",gap:"0.5rem"}}>
                        👥 Personal adicional de otros clientes
                        {trabsAdicionales.length>0&&(
                          <span style={{background:showTrabsPanel?"rgba(255,255,255,0.25)":"#4f46e5",color:"#fff",borderRadius:"12px",padding:"1px 8px",fontSize:"0.7rem",fontWeight:"800"}}>
                            {trabsAdicionales.length}
                          </span>
                        )}
                      </span>
                      <span style={{color:showTrabsPanel?"rgba(255,255,255,0.7)":"#6366f1",fontSize:"0.68rem"}}>
                        {showTrabsPanel?"▲ Cerrar":"▼ "+ trabsOtros.length+" disponibles"}
                      </span>
                    </div>

                    {/* Chips seleccionados */}
                    {trabsAdicionales.length>0&&(
                      <div style={{padding:"0.4rem 0.75rem",background:"#f5f3ff",borderBottom:"1px solid #e0e7ff",display:"flex",flexWrap:"wrap",gap:"0.3rem"}}>
                        {trabsAdicionales.map(t=>{
                          const cli = CLIENTES_AD.find(c=>c.id===t.clienteId)||{color:"#a5b4fc",label:"?"};
                          return(
                            <span key={t.id} style={{background:"#fff",border:`1.5px solid ${cli.color}`,color:"#1e293b",borderRadius:"20px",padding:"0.18rem 0.5rem 0.18rem 0.6rem",fontSize:"0.75rem",fontWeight:"700",display:"flex",alignItems:"center",gap:"0.3rem"}}>
                              <span style={{background:cli.color,color:"#fff",borderRadius:"3px",padding:"0 4px",fontSize:"0.58rem",fontWeight:"800"}}>{cli.label}</span>
                              {t.nombre}
                              <button onClick={()=>setTrabsAdicionales(prev=>prev.filter(x=>x.id!==t.id))}
                                style={{background:"none",border:"none",cursor:"pointer",color:"#94a3b8",padding:0,display:"flex",lineHeight:1}}>
                                <X size={11}/>
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Lista expandible */}
                    {showTrabsPanel&&(
                      <div style={{background:"#fff",padding:"0.55rem 0.75rem"}}>
                        <input value={busqTrabAd} onChange={e=>setBusqTrabAd(e.target.value)}
                          placeholder="🔍 Buscar por nombre o cédula..."
                          style={{...inputSt,marginBottom:"0.5rem",padding:"0.38rem 0.75rem",fontSize:"0.8rem"}}/>
                        {CLIENTES_AD.map(cli=>{
                          const tCli = (todosTrabajadores||[]).filter(t=>{
                            const ids = t.clienteIds||["spia"];
                            return ids.includes(cli.id) && (!qA || t.nombre?.toLowerCase().includes(qA) || String(t.cedula||"").includes(busqTrabAd));
                          });
                          if(!tCli.length) return null;
                          return(
                            <div key={cli.id} style={{marginBottom:"0.5rem"}}>
                              <div style={{fontSize:"0.67rem",fontWeight:"800",color:cli.color,textTransform:"uppercase",
                                letterSpacing:"0.05em",marginBottom:"0.3rem",padding:"0.1rem 0.4rem",
                                background:`${cli.color}18`,borderRadius:"4px",display:"inline-block"}}>
                                {cli.label}
                              </div>
                              <div style={{border:`1px solid ${cli.color}40`,borderRadius:"8px",overflow:"hidden",maxHeight:"160px",overflowY:"auto"}}>
                                {tCli.map(t=>{
                                  const sel=trabsAdicionales.some(x=>x.id===t.id);
                                  const tConCliente={...t,clienteId:cli.id,clienteLabel:cli.label,clienteColor:cli.color};
                                  return(
                                    <div key={t.id}
                                      onClick={()=>sel?setTrabsAdicionales(p=>p.filter(x=>x.id!==t.id)):setTrabsAdicionales(p=>[...p,tConCliente])}
                                      style={{display:"flex",alignItems:"center",gap:"0.5rem",padding:"0.38rem 0.65rem",
                                        background:sel?`${cli.color}12`:"#fff",
                                        borderBottom:"1px solid #f0f4ff",cursor:"pointer",transition:"background 0.1s"}}
                                      onMouseEnter={e=>{if(!sel)e.currentTarget.style.background="#f8faff";}}
                                      onMouseLeave={e=>{if(!sel)e.currentTarget.style.background="#fff";}}>
                                      <div style={{width:"14px",height:"14px",borderRadius:"3px",flexShrink:0,
                                        border:`2px solid ${sel?cli.color:"#cbd5e1"}`,
                                        background:sel?cli.color:"#fff",
                                        display:"flex",alignItems:"center",justifyContent:"center"}}>
                                        {sel&&<span style={{color:"#fff",fontSize:"0.55rem",fontWeight:"900"}}>✓</span>}
                                      </div>
                                      <div style={{flex:1,minWidth:0}}>
                                        <div style={{fontWeight:sel?"700":"400",fontSize:"0.8rem",
                                          color:sel?cli.color:"#1e293b",
                                          overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                                          {t.nombre}
                                        </div>
                                        {t.cedula&&<div style={{fontSize:"0.65rem",color:"#94a3b8",fontFamily:"monospace"}}>{t.cedula}</div>}
                                      </div>
                                      {t.cargo&&<span style={{fontSize:"0.6rem",color:"#94a3b8",flexShrink:0,textTransform:"uppercase"}}>{t.cargo}</span>}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
              {/* ── Banner novedad activa — muestra info + botón para registrar la novedad ── */}
              {form.tipoSeleccion === "trabajador" && novedadActivaWorker && (() => {
                const ncat = novMapState[novedadActivaWorker.novedad] || { emoji:"📅", label: novedadActivaWorker.novedad, color:"#7c3aed", bg:"#ede9fe" };
                return (
                  <div style={{
                    borderRadius:"12px", overflow:"hidden",
                    border:`2px solid ${ncat.color}`,
                    marginTop:"0.75rem", marginBottom:"0.5rem",
                  }}>
                    {/* Barra titular */}
                    <div style={{
                      background:ncat.color, padding:"0.75rem 1.1rem",
                      display:"flex", alignItems:"center", justifyContent:"space-between",
                    }}>
                      <div style={{display:"flex",alignItems:"center",gap:"0.6rem"}}>
                        <span style={{fontSize:"1.4rem"}}>{ncat.emoji}</span>
                        <div>
                          <div style={{fontWeight:"800",color:"#fff",fontSize:"0.95rem"}}>
                            {ncat.label} — Novedad marcada en Llamado a Lista
                          </div>
                          <div style={{color:"rgba(255,255,255,0.85)",fontSize:"0.75rem"}}>
                            Registrada para el {form.fecha}
                          </div>
                        </div>
                      </div>
                      <span style={{background:"rgba(255,255,255,0.2)",color:"#fff",borderRadius:"8px",padding:"3px 10px",fontSize:"0.72rem",fontWeight:"800",fontFamily:"monospace"}}>
                        {novedadActivaWorker.novedad}
                      </span>
                    </div>
                    {/* Cuerpo */}
                    <div style={{background:ncat.bg, padding:"0.85rem 1.1rem"}}>
                      <div style={{fontWeight:"700",color:ncat.color,fontSize:"0.88rem",marginBottom:"0.4rem"}}>
                        ⚠️ Este trabajador tiene novedad registrada para el <strong>{form.fecha}</strong> desde el Llamado a Lista.
                      </div>
                      <div style={{fontSize:"0.8rem",color:ncat.color,opacity:0.85,marginBottom:"0.75rem"}}>
                        No genera producción este día. Solo puedes guardar la novedad en la matriz.
                      </div>
                      {/* Botón registrar novedad */}
                      <button
                        onClick={async () => {
                          if (!form.cuadrillaNombre || !form.fecha) return;
                          setGuardando(true);
                          try {
                            const trabId = form.cuadrillaId.replace("trab_","");
                            const codNov = novedadActivaWorker.novedad;
                            const data = {
                              periodoDesde, periodoHasta,
                              clienteId:       clienteActivo,
                              modoCiamsa:      false,
                              modoNovedad:     true,
                              quincenaId:      `${periodoDesde} al ${periodoHasta}`,
                              quincenaLabel:   `${periodoDesde} al ${periodoHasta}`,
                              cuadrillaId:     form.cuadrillaId,
                              cuadrillaNombre: form.cuadrillaNombre.trim().toUpperCase(),
                              cuadrilla:       form.cuadrillaNombre.trim().toUpperCase(),
                              cuadrillaPersonas: 1,
                              trabajadorId:    trabId,
                              trabajadorNombre:form.cuadrillaNombre.trim().toUpperCase(),
                              trabajadorCedula:asistentesForm[0]?.cedula || "",
                              fecha:           Timestamp.fromDate(new Date(form.fecha+"T12:00:00")),
                              fechaStr:        form.fecha,
                              servicioNombre:  codNov,
                              novedad:         codNov,
                              netoAPagar:      0,
                              personas:        1,
                              cantidad:        1,
                              modoHorasExtras: false,
                              horasExtras:     null,
                              trabajadoresAsisten: asistentesForm.map(a=>({id:a.id,nombre:a.nombre,cedula:a.cedula||""})),
                              trabajadoresAusentes:[],
                              actualizadoEn:   new Date(),
                            };
                            await addDoc(collection(db,"nomina_operaciones"),{...data,creadoEn:new Date()});
                            await guardarMotivoEnRegistro(trabId, form.fecha, codNov);
                            await cargarOperaciones();
                            setGuardadoOk(true);
                            setTimeout(()=>setGuardadoOk(false),2500);
                            tablaRef.current?.scrollIntoView({behavior:"smooth",block:"start"});
                          } catch(e) { alert("Error: "+e.message); }
                          setGuardando(false);
                        }}
                        disabled={guardando}
                        style={{
                          background:ncat.color,
                          border:`2px solid rgba(255,255,255,0.4)`,
                          borderRadius:"10px",
                          padding:"0.75rem 1.5rem",
                          color:"#fff",
                          fontWeight:"800",
                          fontSize:"0.9rem",
                          cursor:"pointer",
                          display:"flex",
                          alignItems:"center",
                          gap:"0.5rem",
                          boxShadow:`0 4px 12px ${ncat.color}50`,
                        }}
                      >
                        {guardando
                          ? <><RefreshCw size={16} style={{animation:"spin 1s linear infinite"}}/> Guardando...</>
                          : guardadoOk
                          ? <><CheckCircle size={16}/> ¡Registrado!</>
                          : <><Save size={16}/> Registrar {ncat.emoji} {ncat.label} (neto $0)</>}
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Service + horas extras: solo mostrar si NO hay novedad activa para este trabajador */}
              {!(form.tipoSeleccion === "trabajador" && novedadActivaWorker) && (<>
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
                    <input type="number" min="1" value={form.cantidad} onChange={e=>setField("cantidad",e.target.value)} placeholder="0" style={inputSt}/>
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
                          : `= (${formatCOP(form.servicioValor)} × ${form.cantidad}) ÷ ${(parseInt(form.personas)||1)+(trabsAdicionales?.length||0)} pers.`}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* ══ SERVICIOS ADICIONALES (multi-servicio) ══ */}
              {serviciosMulti.length > 0 && (
                <div style={{marginTop:"0.75rem",borderRadius:"12px",border:"1.5px solid #e0e7ff",overflow:"hidden",background:"#f5f8ff"}}>
                  <div style={{padding:"0.5rem 0.9rem",background:"#4f46e5",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <span style={{fontWeight:"800",color:"#fff",fontSize:"0.8rem"}}>➕ Servicios adicionales ({serviciosMulti.length})</span>
                    <span style={{fontSize:"0.72rem",color:"rgba(255,255,255,0.75)"}}>Se creará un registro por cada servicio al guardar</span>
                  </div>
                  {serviciosMulti.map((sm,si) => (
                    <div key={sm.uid} style={{display:"grid",gridTemplateColumns:"1fr auto auto auto",gap:"0.6rem",alignItems:"end",padding:"0.65rem 0.9rem",borderBottom:"1px solid #e0e7ff",background:si%2===0?"#f5f8ff":"#eef2ff"}}>
                      <div>
                        <label style={{...labelSt,color:"#4f46e5",fontSize:"0.72rem"}}>🔧 Servicio {si+2}</label>
                        <div style={{position:"relative"}}>
                          <select value={sm.servicioId} onChange={e=>sMultiUpdate(sm.uid,"servicioId",e.target.value)} style={{...selectSt,border:"1.5px solid #a5b4fc"}}>
                            <option value="">— Seleccionar servicio —</option>
                            {servicios.map(s=>(
                              <option key={s.id} value={s.id}>{s.nombre}{(s.valor||s.tarifa)>0?` · ${formatCOP(s.valor||s.tarifa||0)}`:""}</option>
                            ))}
                          </select>
                          <ChevronDown size={14} style={{position:"absolute",right:"0.65rem",top:"50%",transform:"translateY(-50%)",color:"#94a3b8",pointerEvents:"none"}}/>
                        </div>
                      </div>
                      <div style={{minWidth:"90px"}}>
                        <label style={{...labelSt,color:"#4f46e5",fontSize:"0.72rem"}}>📦 Cantidad</label>
                        <input type="number" min="1" value={sm.cantidad} onChange={e=>sMultiUpdate(sm.uid,"cantidad",e.target.value)} placeholder="0" style={{...inputSt,border:"1.5px solid #a5b4fc",textAlign:"center"}}/>
                      </div>
                      <div style={{minWidth:"110px"}}>
                        <label style={{...labelSt,color:"#065f46",fontSize:"0.72rem"}}>💰 Neto</label>
                        <div style={{...readonlySt,background:sm.netoCalculado>0?"#f0fdf4":"#f8fafc",border:`1.5px solid ${sm.netoCalculado>0?"#6ee7b7":"#e2e8f0"}`,fontWeight:"800",color:"#065f46",fontFamily:"monospace",fontSize:"0.9rem"}}>
                          {sm.netoCalculado>0?formatCOP(sm.netoCalculado):"—"}
                        </div>
                      </div>
                      <button onClick={()=>sMultiRemove(sm.uid)}
                        style={{background:"#fff1f2",border:"1px solid #fecdd3",borderRadius:"8px",padding:"0.5rem 0.55rem",cursor:"pointer",color:"#e11d48",display:"flex",alignItems:"center"}}>
                        <X size={14}/>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {/* Botón agregar servicio adicional — siempre activo */}
              {(
                <button type="button" onClick={sMultiAdd}
                  style={{marginTop:"0.6rem",background:"#eef2ff",border:"1.5px dashed #818cf8",borderRadius:"8px",
                    padding:"0.45rem 1rem",cursor:"pointer",color:"#4f46e5",fontWeight:"700",fontSize:"0.8rem",
                    display:"flex",alignItems:"center",gap:"0.4rem",width:"100%",justifyContent:"center"}}>
                  <Plus size={14}/> Agregar otro servicio
                </button>
              )}

              <div style={{marginTop:"1.5rem",display:"flex",gap:"0.75rem",alignItems:"center"}}>
                {/* Botón: modo multi-día semanal */}
                {diasSemanalSeleccionados.length > 0 ? (
                  <button onClick={guardarMultiDia}
                    disabled={guardando||!form.servicioNombre||!puedeEditarMatriz}
                    title={!puedeEditarMatriz?"Sin permiso de edición en Matriz":""}
                    style={{background:(guardando||!form.servicioNombre||!puedeEditarMatriz)?"#94a3b8":"#059669",
                      border:"none",borderRadius:"10px",padding:"0.85rem 2rem",color:"#fff",fontWeight:"800",fontSize:"1rem",cursor:puedeEditarMatriz?"pointer":"not-allowed",
                      display:"flex",alignItems:"center",gap:"0.6rem",boxShadow:"0 4px 12px rgba(5,150,105,0.3)"}}>
                    {guardando?<><RefreshCw size={18} style={{animation:"spin 1s linear infinite"}}/> Guardando...</>
                      :guardadoOk?<><CheckCircle size={18}/> ¡{diasSemanalSeleccionados.length} registros guardados!</>
                      :<><Save size={18}/> Guardar {diasSemanalSeleccionados.length} día{diasSemanalSeleccionados.length!==1?"s":""} ({diasSemanalSeleccionados.map(d=>d.label).join(", ")})</>}
                  </button>
                ) : (
                  <button onClick={guardar}
                    disabled={guardando||!form.cuadrillaNombre||!form.servicioNombre||asistentesForm.length===0||!puedeEditarMatriz||(form.tipoSeleccion!=="trabajador"&&!form.cantidad)}
                    title={!puedeEditarMatriz?"Sin permiso de edición en Matriz":""}
                    style={{background:(guardando||!form.cuadrillaNombre||!form.servicioNombre||asistentesForm.length===0||!puedeEditarMatriz)?"#94a3b8":editandoId?"#f59e0b":PRIMARY,
                      border:"none",borderRadius:"10px",padding:"0.85rem 2rem",color:"#fff",fontWeight:"800",fontSize:"1rem",cursor:puedeEditarMatriz?"pointer":"not-allowed",
                      display:"flex",alignItems:"center",gap:"0.6rem",boxShadow:"0 4px 12px rgba(11,61,145,0.25)"}}>
                    {guardando?<><RefreshCw size={18} style={{animation:"spin 1s linear infinite"}}/> Guardando...</>
                      :guardadoOk?<><CheckCircle size={18}/> ¡Guardado!</>
                      :<><Save size={18}/> {editandoId?"Actualizar":"Guardar"}</>}
                  </button>
                )}
                {diasSemanalSeleccionados.length === 0 && asistentesForm.length===0 && form.cuadrillaId && (
                  <span style={{color:DANGER,fontSize:"0.82rem",fontWeight:"600"}}>⚠️ Sin asistentes — registra asistencia primero</span>
                )}
                {!puedeEditarMatriz && (
                  <span style={{color:"#94a3b8",fontSize:"0.8rem",fontWeight:"600"}}>🔒 Solo lectura — solicita permiso de edición</span>
                )}
              </div>
              </>)}
          </div>
        </div>
        )}

        {/* ── TABLA ── */}
        <div ref={tablaRef} style={{margin:"0.5rem 0.75rem 1rem"}}>
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
              <button onClick={()=>setShowDetalleModal(true)}
                style={{background:"#f0fdf4",border:"1.5px solid #6ee7b7",borderRadius:"8px",
                  padding:"0.45rem 0.85rem",cursor:"pointer",color:"#065f46",
                  fontWeight:"700",fontSize:"0.78rem",display:"flex",alignItems:"center",gap:"0.4rem"}}>
                📊 Detalle / Excel
              </button>
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
            <div style={{background:"#fff",overflow:"hidden",border:"1px solid #d0d7e0"}}>
              {cargandoOps ? (
                <div style={{textAlign:"center",padding:"2rem",color:"#94a3b8"}}>
                  <RefreshCw size={24} style={{animation:"spin 1s linear infinite",display:"block",margin:"0 auto 0.5rem"}}/>
                  <div style={{fontSize:"0.85rem"}}>Cargando...</div>
                </div>
              ) : (
                <div style={{overflowX:"auto"}}>
                  {/* ── Tabla CIAMSA ── */}
                  {isCiamsa ? (
                    <table className="xl-table">
                      <thead><tr>{["#","Trabajador","Cédula","Fecha","Nov.","Servicio","Cantidad","N.Per","PER","Tarifa","Neto","Acc."].map(h=>(<th key={h}>{h}</th>))}</tr></thead>
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
                              <td style={{...tdSt,color:"#475569",fontSize:"0.85rem",whiteSpace:"nowrap"}}>{op.fechaStr||"—"}{op.creadoEn ? <span style={{display:"block",fontSize:"0.68rem",color:"#94a3b8",fontFamily:"monospace"}}>{(() => { try { const d = op.creadoEn?.toDate ? op.creadoEn.toDate() : new Date(op.creadoEn?.seconds*1000||op.creadoEn); return d.toLocaleTimeString("es-CO",{hour:"2-digit",minute:"2-digit"}); } catch(e){ return ""; } })()}</span> : null}</td>
                              <td style={{...tdSt,textAlign:"center"}}>
                                {(op.trabajadoresAusentes?.length>0||op.modoNovedad) ? (
                                  <button onClick={()=>{setEditNovOp(op);setShowEditNovModal(true);}}
                                    style={{background:"#fff1f2",border:"1px solid #fecdd3",borderRadius:"6px",padding:"2px 7px",cursor:"pointer",color:"#dc2626",fontWeight:"700",fontSize:"0.7rem"}}>
                                    ⚠️ {op.trabajadoresAusentes?.length||1}
                                  </button>
                                ) : (
                                  <button onClick={()=>{setEditNovOp(op);setShowEditNovModal(true);}}
                                    style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:"6px",padding:"2px 7px",cursor:"pointer",color:"#10b981",fontWeight:"700",fontSize:"0.7rem"}}>
                                    ✓
                                  </button>
                                )}
                              </td>
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
                                  <button onClick={()=>ciamsaIniciarEdicion(op)} disabled={!puedeEditarMatriz} title={!puedeEditarMatriz?"Sin permiso":""} style={{background:puedeEditarMatriz?`${colorCiamsa}18`:"#f8fafc",border:"none",borderRadius:"6px",padding:"0.3rem 0.45rem",cursor:puedeEditarMatriz?"pointer":"not-allowed",color:puedeEditarMatriz?colorCiamsa:"#cbd5e1",opacity:puedeEditarMatriz?1:0.5}}><Edit2 size={13}/></button>
                                  <button onClick={()=>eliminar(op)} disabled={!tieneControlMatriz} title={!tieneControlMatriz?"Sin permiso":""} style={{background:tieneControlMatriz?"#fff1f2":"#f8fafc",border:"none",borderRadius:"6px",padding:"0.3rem 0.45rem",cursor:tieneControlMatriz?"pointer":"not-allowed",color:tieneControlMatriz?DANGER:"#cbd5e1",opacity:tieneControlMatriz?1:0.5}}><Trash2 size={13}/></button>
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
                    <table className="xl-table">
                      <thead><tr>{["#","Cuadrilla","Fecha","Asistentes","Nov.","Servicio","Cant.","Neto","X Persona","Acc."].map(h=>(<th key={h}>{h}</th>))}</tr></thead>
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
                                {op.esMiniCuadrilla
                                  ? <span style={{background:"#fff1f2",color:"#e11d48",borderRadius:"6px",padding:"3px 10px",fontSize:"0.82rem",fontWeight:"700"}}>
                                      ⚡ {nomCua}
                                    </span>
                                  : <span style={{background:"#f0f9ff",color:ACCENT,borderRadius:"6px",padding:"3px 10px",fontSize:"0.82rem",fontWeight:"700"}}>
                                      Cua. {nomCua}
                                    </span>
                                }
                              </td>
                              <td style={{...tdSt,color:"#475569",fontSize:"0.85rem",whiteSpace:"nowrap"}}>{op.fechaStr||"—"}{op.creadoEn ? <span style={{display:"block",fontSize:"0.68rem",color:"#94a3b8",fontFamily:"monospace"}}>{(() => { try { const d = op.creadoEn?.toDate ? op.creadoEn.toDate() : new Date(op.creadoEn?.seconds*1000||op.creadoEn); return d.toLocaleTimeString("es-CO",{hour:"2-digit",minute:"2-digit"}); } catch(e){ return ""; } })()}</span> : null}</td>
                              <td style={tdSt}>
                                <div style={{fontSize:"0.78rem"}}>
                                  <span style={{fontWeight:"700",color:SUCCESS}}>{op.personas} asisten</span>
                                  {op.trabajadoresAusentes?.length>0&&<span style={{color:DANGER,marginLeft:"0.35rem"}}>· {op.trabajadoresAusentes.length} aus.</span>}
                                </div>
                                <div style={{fontSize:"0.65rem",color:"#94a3b8"}}>
                                  {asisten.slice(0,2).map(w=>w.nombre?.split(" ")[0]).join(", ")}{asisten.length>2?` +${asisten.length-2}`:""}
                                </div>
                              </td>
              <td style={{...tdSt,textAlign:"center"}}>
                {(op.trabajadoresAusentes?.length>0||op.modoNovedad) ? (
                  <button onClick={()=>{setEditNovOp(op);setShowEditNovModal(true);}}
                    style={{background:"#fff1f2",border:"1px solid #fecdd3",borderRadius:"6px",padding:"2px 8px",cursor:"pointer",color:"#dc2626",fontWeight:"700",fontSize:"0.72rem"}}>
                    ⚠️ {op.trabajadoresAusentes?.length||1}
                  </button>
                ) : (
                  <button onClick={()=>{setEditNovOp(op);setShowEditNovModal(true);}}
                    style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:"6px",padding:"2px 8px",cursor:"pointer",color:"#10b981",fontWeight:"700",fontSize:"0.72rem"}}>
                    ✓
                  </button>
                )}
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
                                  <button onClick={()=>iniciarEdicion(op)} disabled={!puedeEditarMatriz} title={!puedeEditarMatriz?"Sin permiso":""} style={{background:puedeEditarMatriz?"#f0f9ff":"#f8fafc",border:"none",borderRadius:"6px",padding:"0.3rem 0.45rem",cursor:puedeEditarMatriz?"pointer":"not-allowed",color:puedeEditarMatriz?ACCENT:"#cbd5e1",opacity:puedeEditarMatriz?1:0.5}}><Edit2 size={13}/></button>
                                  <button onClick={()=>eliminar(op)} disabled={!tieneControlMatriz} title={!tieneControlMatriz?"Sin permiso":""} style={{background:tieneControlMatriz?"#fff1f2":"#f8fafc",border:"none",borderRadius:"6px",padding:"0.3rem 0.45rem",cursor:tieneControlMatriz?"pointer":"not-allowed",color:tieneControlMatriz?DANGER:"#cbd5e1",opacity:tieneControlMatriz?1:0.5}}><Trash2 size={13}/></button>
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
      {/* ══ MODAL EDITAR NOVEDADES ══ */}
      {showEditNovModal && editNovOp && (() => {
        const todos = (editNovOp.trabajadoresAsisten||[]).map(w=>({
          ...w, novedad:(editNovOp.trabajadoresAusentes||[]).find(a=>a.id===w.id)?.novedad||""
        }));
        const guardarNovedades = async (nuevosTodos) => {
          const ausentes = nuevosTodos.filter(w=>w.novedad).map(w=>({id:w.id,nombre:w.nombre,novedad:w.novedad}));
          const {updateDoc,doc:dc} = await import("firebase/firestore");
          await updateDoc(dc(db,"nomina_operaciones",editNovOp.id),{trabajadoresAusentes:ausentes,actualizadoEn:new Date()});
          setShowEditNovModal(false); setEditNovOp(null); await cargarOperaciones();
        };
        return (
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}}
            onClick={e=>{if(e.target===e.currentTarget){setShowEditNovModal(false);setEditNovOp(null);}}}>
            <div style={{background:"#fff",borderRadius:"16px",width:"100%",maxWidth:"680px",boxShadow:"0 20px 60px rgba(0,0,0,0.3)",overflow:"hidden"}}>
              <div style={{background:"linear-gradient(135deg,#dc2626,#b91c1c)",padding:"1rem 1.5rem",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div>
                  <div style={{fontWeight:"800",color:"#fff",fontSize:"1rem"}}>⚠️ Novedades del Registro</div>
                  <div style={{color:"rgba(255,255,255,0.8)",fontSize:"0.78rem"}}>{editNovOp.fechaStr} · {editNovOp.cuadrillaNombre||editNovOp.cuadrilla} · {editNovOp.servicioNombre}</div>
                </div>
                <button onClick={()=>{setShowEditNovModal(false);setEditNovOp(null);}} style={{background:"rgba(255,255,255,0.15)",border:"none",borderRadius:"8px",padding:"0.4rem",cursor:"pointer",color:"#fff"}}><X size={18}/></button>
              </div>
              <div style={{padding:"1rem 1.5rem",maxHeight:"60vh",overflowY:"auto"}}>
                <NovEditList todos={todos} novedades={novedades} onGuardar={guardarNovedades} onCancelar={()=>{setShowEditNovModal(false);setEditNovOp(null);}} puedeEditar={puedeEditarMatriz}/>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══ PANEL REGISTRAR NOVEDAD PURA ══ */}
      {showRegNovForm && clienteActivo==="spia" && (
        <div style={{margin:"0 0.75rem 1rem",background:"#fff",borderRadius:"12px",border:"2px solid #fecdd3",overflow:"hidden"}}>
          <div style={{background:"#fff1f2",padding:"0.55rem 1rem",fontWeight:"800",color:"#dc2626",fontSize:"0.85rem",borderBottom:"1px solid #fecdd3",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <span>📋 Registrar Novedad (sin producción)</span>
            <button onClick={()=>setShowRegNovForm(false)} style={{background:"none",border:"none",cursor:"pointer",color:"#94a3b8"}}><X size={16}/></button>
          </div>
          <div style={{padding:"1rem",display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0.75rem",alignItems:"end"}}>
            <div>
              <label style={{display:"block",fontSize:"0.72rem",fontWeight:"700",color:"#374151",marginBottom:"0.2rem"}}>👤 Trabajador</label>
              <select value={regNovForm.trabajadorId} onChange={e=>{
                const t=listaTrabajadores.find(x=>x.id===e.target.value)||{};
                setRegNovForm(p=>({...p,trabajadorId:e.target.value,trabajadorNombre:t.nombre||""}));
              }} style={{width:"100%",border:"1px solid #fecdd3",borderRadius:"6px",padding:"0.38rem 0.6rem",fontSize:"0.82rem",outline:"none"}}>
                <option value="">— Seleccionar —</option>
                {listaTrabajadores.map(t=>(<option key={t.id} value={t.id}>{t.nombre}</option>))}
              </select>
            </div>
            <div>
              <label style={{display:"block",fontSize:"0.72rem",fontWeight:"700",color:"#374151",marginBottom:"0.2rem"}}>📅 Fecha</label>
              <input type="date" value={regNovForm.fecha} onChange={e=>setRegNovForm(p=>({...p,fecha:e.target.value}))}
                style={{width:"100%",border:"1px solid #fecdd3",borderRadius:"6px",padding:"0.38rem 0.6rem",fontSize:"0.82rem",outline:"none",boxSizing:"border-box"}}/>
            </div>
            <div>
              <label style={{display:"block",fontSize:"0.72rem",fontWeight:"700",color:"#374151",marginBottom:"0.2rem"}}>⚠️ Novedad</label>
              <select value={regNovForm.novedad} onChange={e=>setRegNovForm(p=>({...p,novedad:e.target.value}))}
                style={{width:"100%",border:"1px solid #fecdd3",borderRadius:"6px",padding:"0.38rem 0.6rem",fontSize:"0.82rem",outline:"none"}}>
                <option value="">— Tipo —</option>
                {novedades.map(n=>(<option key={n.codigo} value={n.codigo}>{n.emoji} {n.label}</option>))}
              </select>
            </div>
            <div style={{gridColumn:"1/-1"}}>
              <label style={{display:"block",fontSize:"0.72rem",fontWeight:"700",color:"#374151",marginBottom:"0.2rem"}}>📝 Observación</label>
              <input value={regNovForm.observacion} onChange={e=>setRegNovForm(p=>({...p,observacion:e.target.value}))}
                placeholder="Detalle de la novedad..."
                style={{width:"100%",border:"1px solid #fecdd3",borderRadius:"6px",padding:"0.38rem 0.6rem",fontSize:"0.82rem",outline:"none",boxSizing:"border-box"}}/>
            </div>
            <div style={{gridColumn:"1/-1",display:"flex",gap:"0.5rem"}}>
              <button onClick={async()=>{
                if(!regNovForm.trabajadorId||!regNovForm.fecha||!regNovForm.novedad){alert("Completa trabajador, fecha y novedad.");return;}
                const t=listaTrabajadores.find(x=>x.id===regNovForm.trabajadorId)||{};
                const nov=novedades.find(n=>n.codigo===regNovForm.novedad)||{};
                const {addDoc,collection:col,Timestamp}=await import("firebase/firestore");
                await addDoc(col(db,"nomina_operaciones"),{
                  periodoDesde,periodoHasta,clienteId:"spia",modoNovedad:true,modoCiamsa:false,
                  quincenaId:periodoDesde+" al "+periodoHasta,
                  quincenaLabel:periodoDesde+" al "+periodoHasta,
                  cuadrillaId:regNovForm.trabajadorId,
                  cuadrillaNombre:t.nombre||"",trabajadorId:regNovForm.trabajadorId,
                  trabajadorNombre:t.nombre||"",trabajadorCedula:String(t.cedula||""),
                  fecha:Timestamp.fromDate(new Date(regNovForm.fecha+"T12:00:00")),
                  fechaStr:regNovForm.fecha,servicioNombre:regNovForm.novedad,
                  novedad:regNovForm.novedad,novedadLabel:nov.label||"",
                  observacion:regNovForm.observacion,
                  netoAPagar:0,personas:1,cantidad:1,
                  trabajadoresAsisten:[{id:t.id,nombre:t.nombre,cedula:String(t.cedula||"")}],
                  trabajadoresAusentes:[{id:t.id,nombre:t.nombre,novedad:regNovForm.novedad}],
                  actualizadoEn:new Date(),creadoEn:new Date(),
                });
                setRegNovForm({fecha:"",trabajadorId:"",trabajadorNombre:"",novedad:"",observacion:""});
                setShowRegNovForm(false); await cargarOperaciones();
                alert("✅ Novedad registrada correctamente");
              }} style={{background:"#dc2626",border:"none",borderRadius:"7px",padding:"0.45rem 1.25rem",cursor:"pointer",color:"#fff",fontWeight:"800",fontSize:"0.82rem"}}>
                💾 Guardar Novedad
              </button>
              <button onClick={()=>setShowRegNovForm(false)} style={{background:"#f1f5f9",border:"1px solid #e2e8f0",borderRadius:"7px",padding:"0.45rem 0.75rem",cursor:"pointer",color:"#475569",fontWeight:"700",fontSize:"0.82rem"}}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL DETALLE POR TRABAJADOR ══ */}
      {showDetalleModal && (() => {
        const filas = [];
        operaciones.filter(op=>(op.clienteId||"spia")===clienteActivo).forEach(op => {
          const asisten = op.trabajadoresAsisten||[];
          if (asisten.length===0) {
            filas.push({nombre:op.trabajadorNombre||op.cuadrillaNombre||"",cedula:op.trabajadorCedula||"",fecha:op.fechaStr||"",hora:(()=>{try{const d=op.creadoEn?.toDate?op.creadoEn.toDate():new Date(op.creadoEn?.seconds*1000||op.creadoEn);return d.toLocaleTimeString("es-CO",{hour:"2-digit",minute:"2-digit"});}catch(e){return"";}})(),opId:op.id,cuadrilla:op.cuadrillaNombre||op.cuadrilla||"",servicio:op.servicioNombre||"",cantidad:op.cantidad||1,neto:op.netoAPagar||0});
          } else {
            asisten.forEach(w=>filas.push({nombre:w.nombre||"",cedula:w.cedula||"",fecha:op.fechaStr||"",hora:(()=>{try{const d=op.creadoEn?.toDate?op.creadoEn.toDate():new Date(op.creadoEn?.seconds*1000||op.creadoEn);return d.toLocaleTimeString("es-CO",{hour:"2-digit",minute:"2-digit"});}catch(e){return"";}})(),opId:op.id,cuadrilla:op.cuadrillaNombre||op.cuadrilla||"",servicio:op.servicioNombre||"",cantidad:op.cantidad||1,neto:op.netoAPagar||0}));
          }
        });
        const qN=filtroDetNombre.toLowerCase().trim();
        const qC=filtroDetCedula.trim();
        const qS=filtroDetServicio.toLowerCase().trim();
        const filasFilt=filas.filter(f=>(!qN||f.nombre.toLowerCase().includes(qN))&&(!qC||f.cedula.includes(qC))&&(!qS||f.servicio.toLowerCase().includes(qS))).sort((a,b)=>{const n=a.nombre.localeCompare(b.nombre,"es");return n!==0?n:a.fecha.localeCompare(b.fecha);});
        const totalFilt=filasFilt.reduce((s,f)=>s+f.neto,0);
        const serviciosUnicos=[...new Set(filas.map(f=>f.servicio).filter(Boolean))].sort();
        const exportarXLS=()=>{
          const hdr=['Trabajador','Cedula','Fecha','Cuadrilla','Servicio','Cantidad','Neto'];
          const esc=(v)=>String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
          const row=(vals,types)=>'<Row>'+vals.map((v,i)=>'<Cell><Data ss:Type="'+types[i]+'">'+( types[i]==='Number'?(+v||0):esc(v))+'</Data></Cell>').join('')+'</Row>';
          const rows=filasFilt.map(f=>row([f.nombre,f.cedula,f.fecha,f.cuadrilla,f.servicio,f.cantidad,f.neto],['String','String','String','String','String','Number','Number']));
          const xml='<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Detalle"><Table>'+row(hdr,hdr.map(()=>'String'))+rows.join('')+'</Table></Worksheet></Workbook>';
          const blob=new Blob([xml],{type:'application/vnd.ms-excel'});
          const url=URL.createObjectURL(blob);const a=document.createElement('a');
          a.href=url;a.download=`detalle_${periodoDesde}_${periodoHasta}.xls`;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
        };
        return (
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:9999,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"1.5rem",overflowY:"auto"}}
            onClick={e=>{if(e.target===e.currentTarget)setShowDetalleModal(false);}}>
            <div style={{background:"#fff",borderRadius:"16px",width:"100%",maxWidth:"1100px",boxShadow:"0 20px 60px rgba(0,0,0,0.3)",overflow:"hidden"}}>
              <div style={{background:`linear-gradient(135deg,${PRIMARY} 0%,#1a56c4 100%)`,padding:"1rem 1.5rem",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div>
                  <div style={{fontWeight:"800",color:"#fff",fontSize:"1.1rem"}}>📊 Detalle por Trabajador</div>
                  <div style={{color:"rgba(255,255,255,0.8)",fontSize:"0.8rem"}}>{periodoDesde} al {periodoHasta} · {filasFilt.length} registros · Total: {formatCOP(totalFilt)}</div>
                </div>
                <div style={{display:"flex",gap:"0.5rem"}}>
                  <button onClick={exportarXLS} style={{background:"#22c55e",border:"none",borderRadius:"8px",padding:"0.5rem 1rem",cursor:"pointer",color:"#fff",fontWeight:"700",fontSize:"0.82rem",display:"flex",alignItems:"center",gap:"0.4rem"}}>⬇️ Exportar XLS</button>
                  <button onClick={()=>setShowDetalleModal(false)} style={{background:"rgba(255,255,255,0.15)",border:"none",borderRadius:"8px",padding:"0.5rem",cursor:"pointer",color:"#fff"}}><X size={18}/></button>
                </div>
              </div>
              <div style={{padding:"0.85rem 1.5rem",background:"#f8fafc",borderBottom:"1px solid #e2e8f0",display:"flex",gap:"0.6rem",flexWrap:"wrap",alignItems:"center"}}>
                <div style={{position:"relative",flex:"1",minWidth:"170px"}}>
                  <Search size={13} style={{position:"absolute",left:"0.6rem",top:"50%",transform:"translateY(-50%)",color:"#94a3b8",pointerEvents:"none"}}/>
                  <input value={filtroDetNombre} onChange={e=>setFiltroDetNombre(e.target.value)} placeholder="Nombre..." style={{...inputSt,padding:"0.45rem 0.75rem 0.45rem 2rem"}}/>
                </div>
                <div style={{flex:"0 0 140px"}}>
                  <input value={filtroDetCedula} onChange={e=>setFiltroDetCedula(e.target.value)} placeholder="Cédula..." style={{...inputSt,padding:"0.45rem 0.75rem"}}/>
                </div>
                <div style={{position:"relative",flex:"1",minWidth:"200px"}}>
                  <select value={filtroDetServicio} onChange={e=>setFiltroDetServicio(e.target.value)} style={{...selectSt,padding:"0.45rem 2rem 0.45rem 0.75rem"}}>
                    <option value="">Todos los servicios</option>
                    {serviciosUnicos.map(s=>(<option key={s} value={s.toLowerCase()}>{s}</option>))}
                  </select>
                  <ChevronDown size={13} style={{position:"absolute",right:"0.65rem",top:"50%",transform:"translateY(-50%)",color:"#94a3b8",pointerEvents:"none"}}/>
                </div>
                {(filtroDetNombre||filtroDetCedula||filtroDetServicio)&&(
                  <button onClick={()=>{setFiltroDetNombre("");setFiltroDetCedula("");setFiltroDetServicio("");}} style={{background:"#fee2e2",border:"1px solid #fecaca",borderRadius:"8px",padding:"0.45rem 0.75rem",cursor:"pointer",color:"#dc2626",fontWeight:"700",fontSize:"0.78rem"}}>× Limpiar</button>
                )}
              </div>
              <div style={{overflowX:"auto",maxHeight:"62vh",overflowY:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:"0.83rem"}}>
                  <thead style={{position:"sticky",top:0,zIndex:2}}>
                    <tr style={{background:PRIMARY}}>
                      {["#","Trabajador","Cédula","Fecha","Hora","Cuadrilla","Servicio","Cant.","Neto","Acc."].map(h=>(
                        <th key={h} style={{padding:"0.7rem 0.8rem",textAlign:"left",color:"#fff",fontWeight:"700",fontSize:"0.75rem",whiteSpace:"nowrap"}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filasFilt.length===0?(<tr><td colSpan={10} style={{textAlign:"center",padding:"3rem",color:"#94a3b8"}}>Sin registros con los filtros actuales</td></tr>)
                    :filasFilt.map((f,i)=>(
                      <tr key={i} style={{borderBottom:"1px solid #f1f5f9",background:i%2===0?"#fff":"#f8fafc"}}
                        onMouseEnter={e=>e.currentTarget.style.background="#eff6ff"}
                        onMouseLeave={e=>e.currentTarget.style.background=i%2===0?"#fff":"#f8fafc"}>
                        <td style={{...tdSt,color:"#94a3b8",fontSize:"0.72rem"}}>{i+1}</td>
                        <td style={{...tdSt,fontWeight:"700",color:"#1e293b",whiteSpace:"nowrap"}}>{f.nombre}</td>
                        <td style={{...tdSt,fontFamily:"monospace",color:"#64748b",fontSize:"0.8rem"}}>{f.cedula||"—"}</td>
                        <td style={{...tdSt,color:"#475569",whiteSpace:"nowrap"}}>{f.fecha}</td>
                <td style={{...tdSt,fontFamily:"monospace",fontSize:"0.78rem",color:"#6366f1",whiteSpace:"nowrap",textAlign:"center"}}>{f.hora||"—"}</td>
                        <td style={{...tdSt}}><span style={{background:"#f0f9ff",color:"#0ea5e9",borderRadius:"6px",padding:"2px 8px",fontSize:"0.78rem",fontWeight:"700",whiteSpace:"nowrap"}}>{f.cuadrilla}</span></td>
                        <td style={{...tdSt,maxWidth:"200px"}}><div style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:"#374151"}}>{f.servicio}</div></td>
                        <td style={{...tdSt,textAlign:"center",fontWeight:"700"}}>{f.cantidad}</td>
                        <td style={{...tdSt,fontWeight:"900",color:SUCCESS,fontFamily:"monospace",whiteSpace:"nowrap",background:"#f0fdf4"}}>{formatCOP(f.neto)}</td>
                      </tr>
                    ))}
                  </tbody>
                  {filasFilt.length>0&&(
                    <tfoot style={{position:"sticky",bottom:0}}>
                      <tr style={{background:"#f0fdf4",borderTop:`2px solid ${SUCCESS}`}}>
                        <td colSpan={9} style={{padding:"0.75rem 0.8rem",fontWeight:"700",color:"#065f46"}}>TOTAL — {filasFilt.length} registros</td>
                        <td style={{padding:"0.75rem 0.8rem",fontWeight:"900",color:"#065f46",fontFamily:"monospace",fontSize:"1rem",whiteSpace:"nowrap"}}>{formatCOP(totalFilt)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>
        );
      })()}

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

      <style jsx global>{`
        @keyframes spin{to{transform:rotate(360deg);}}
        /* ── EXCEL THEME ── */
        body { font-family: Calibri, Arial, sans-serif; }
        .xl-wrap { background:#f0f0f0; min-height:100vh; }
        .xl-header { background:#217346; padding:0.4rem 0.75rem; display:flex; align-items:center; gap:0.75rem; border-bottom:2px solid #185a34; }
        .xl-header h1 { margin:0; color:#fff; font-size:1rem; font-weight:800; letter-spacing:0.01em; }
        .xl-header p  { margin:0; color:rgba(255,255,255,0.75); font-size:0.72rem; }
        .xl-ribbon { background:#e9efda; border-bottom:1px solid #b8ccad; padding:0.3rem 0.75rem; display:flex; gap:0.35rem; flex-wrap:wrap; align-items:center; }
        .xl-tab { padding:0.28rem 0.8rem; border-radius:3px; border:1px solid #b8ccad; background:#fff; color:#374151; font-weight:600; font-size:0.77rem; cursor:pointer; transition:all 0.1s; }
        .xl-tab.active { background:#217346; border-color:#217346; color:#fff; font-weight:800; box-shadow:0 1px 4px rgba(33,115,70,0.3); }
        .xl-sep { width:1px; height:18px; background:#b8ccad; margin:0 0.3rem; flex-shrink:0; }
        .xl-stats { background:#d4e9c7; border-bottom:1px solid #b8ccad; padding:0.25rem 0.75rem; display:flex; gap:1.25rem; align-items:center; font-size:0.76rem; flex-wrap:wrap; }
        .xl-stats span { color:#217346; font-weight:700; }
        .xl-stats .total { color:#065f46; font-weight:900; font-family:monospace; }
        /* Tabla Excel */
        .xl-table { border-collapse:collapse; width:100%; font-size:0.8rem; }
        .xl-table th { background:#217346; color:#fff; font-size:0.73rem; font-weight:700; padding:0.45rem 0.65rem; border:1px solid #185a34; white-space:nowrap; position:sticky; top:0; z-index:2; text-align:left; }
        .xl-table td { padding:0.35rem 0.6rem; border:1px solid #d0d7e0; vertical-align:middle; }
        .xl-table tr:nth-child(even) td { background:#eef4ea; }
        .xl-table tr:nth-child(odd) td { background:#ffffff; }
        .xl-table tr:hover td { background:#d4edda!important; }
        .xl-table .row-num td:first-child { background:#f2f2f2!important; color:#888; text-align:center; border-right:2px solid #d0d7e0; min-width:28px; font-size:0.72rem; }
        .xl-table tfoot td { background:#e2efda!important; border-top:2px solid #217346!important; font-weight:800; color:#065f46; }
        /* Sección nueva operación */
        .xl-newop { background:#fff; border:1px solid #b8ccad; border-top:3px solid #217346; margin:0.5rem 0.75rem 0; border-radius:3px; overflow:hidden; }
        .xl-newop-header { background:#e9efda; padding:0.3rem 0.75rem; font-size:0.73rem; font-weight:800; color:#217346; border-bottom:1px solid #b8ccad; text-transform:uppercase; letter-spacing:0.05em; display:flex; align-items:center; gap:0.5rem; }
        .xl-newop-body { padding:0.6rem 0.75rem; }
        .xl-table-wrap { margin:0 0.75rem 0.75rem; border:1px solid #d0d7e0; overflow:hidden; }
        .xl-toolbar { background:#f2f2f2; border:1px solid #d0d7e0; border-bottom:none; padding:0.3rem 0.6rem; display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap; }
        .xl-btn { padding:0.25rem 0.65rem; border:1px solid #b8ccad; border-radius:3px; background:#fff; color:#374151; font-size:0.75rem; font-weight:600; cursor:pointer; }
        .xl-btn:hover { background:#e9efda; border-color:#217346; }
        .xl-btn.primary { background:#217346; color:#fff; border-color:#217346; }
        .xl-btn.primary:hover { background:#185a34; }
        .xl-input { border:1px solid #b8ccad; border-radius:2px; padding:0.22rem 0.45rem; font-size:0.8rem; outline:none; background:#fff; font-family:inherit; }
        .xl-input:focus { border-color:#217346; box-shadow:0 0 0 2px rgba(33,115,70,0.15); }
      `}</style>
    </LayoutWithSidebar>
  );
}

const labelSt   = {display:"block",fontWeight:"700",color:"#374151",marginBottom:"0.35rem",fontSize:"0.82rem"};
