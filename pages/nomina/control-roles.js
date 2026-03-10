// pages/nomina/control-roles.js
// Administración de permisos por usuario y módulo — solo rol "admin"
// Guarda en: nomina_permisos_usuario/{uid}
// Estructura: { uid, email, nombre, modulos: { [modId]: { nivel, acciones: { accionId: bool } } } }

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, doc, setDoc, getDoc, writeBatch } from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";
import { getUserRoleByUid } from "@/utils/getUserRole";
import { PERMISOS_MODULOS, normalizarPermiso, accionesPorNivel } from "@/utils/permisosConfig";
import LayoutWithSidebar from "@/components/LayoutWithSidebar";
import {
  ArrowLeft, Shield, Save, RefreshCw, CheckCircle,
  Users, Eye, EyeOff, Zap, Settings, ChevronDown,
  ChevronRight, X, Info, AlertTriangle, UserPlus, ToggleLeft, ToggleRight
} from "lucide-react";

const PRIMARY = "#0B3D91";
const SUCCESS = "#10b981";
const DANGER  = "#ef4444";
const WARN    = "#f59e0b";

// ═══════════════════════════════════════════════════════════════════════════
// NIVELES
// ═══════════════════════════════════════════════════════════════════════════
const NIVELES = [
  { id:"ninguno",  label:"Sin acceso",    short:"—",  icon:EyeOff,      color:"#ef4444", bg:"#fef2f2", border:"#fca5a5",
    desc:"No puede ver esta página. Tampoco aparece en el menú lateral." },
  { id:"lectura",  label:"Solo lectura",  short:"👁️", icon:Eye,         color:"#64748b", bg:"#f8fafc", border:"#cbd5e1",
    desc:"Puede ver la información pero NO puede crear, editar ni eliminar." },
  { id:"limitado", label:"Limitado",      short:"⚡",  icon:Zap,         color:"#f59e0b", bg:"#fffbeb", border:"#fcd34d",
    desc:"Puede registrar y editar, pero NO puede eliminar ni acciones críticas." },
  { id:"total",    label:"Control total", short:"✅",  icon:CheckCircle, color:"#10b981", bg:"#f0fdf4", border:"#86efac",
    desc:"Acceso completo: crear, editar, eliminar y todas las acciones." },
];
const NIVEL_BY_ID = Object.fromEntries(NIVELES.map(n => [n.id, n]));

// ═══════════════════════════════════════════════════════════════════════════
// MÓDULOS (orden en la tabla)
// ═══════════════════════════════════════════════════════════════════════════
const MODULOS = [
  { id:"trabajadores",     label:"Trabajadores",        icon:"👷" },
  { id:"asistencia",       label:"Asistencia",           icon:"📋" },
  { id:"servicios",        label:"Servicios",            icon:"💼" },
  { id:"matriz",           label:"Matriz",               icon:"📊" },
  { id:"liquidar",         label:"Liquidar",             icon:"💰" },
  { id:"liquidar_unificada",label:"Liq. Unificada",     icon:"📑" },
  { id:"historial",        label:"Historial",            icon:"📅" },
  { id:"adelantos",        label:"Adelantos",            icon:"💳" },
  { id:"desprendibles",    label:"Desprendibles",        icon:"🧾" },
  { id:"administrar",      label:"Administrar",          icon:"⚙️" },
  { id:"clientes",         label:"Clientes",             icon:"🏢" },
];

// Datos seed
const SEED_USUARIOS = [
  { uid:"mXEwGPXVZWaOYuaIBUUcb1pwKSc2", email:"jamoca.0314@hotmail.com",
    modulos:{ liquidar_unificada:"total", liquidar:"total" } },
  { uid:"t1MZoANNGmeDVEMcRr1vDcEvbms1", email:"compras@logisport.com.co",
    modulos:{ adelantos:"total" } },
  { uid:"XSa3lSmOWIM7WFXB3r86pGzotpl2", email:"liquidacion@logisport.com.co",
    modulos:{ matriz:"total" } },
  { uid:"LoTV5hJN0uNcvctBTpXqMG9yXe73", email:"facturacion@logisport.com.co",
    modulos:{ adelantos:"total" } },
  { uid:"kK27zAYtOAb2Sc7phYtoJUBgH9T2", email:"operaciones@logisport.com.co",
    modulos:{ liquidar_unificada:"total", liquidar:"total" } },
  { uid:"5lxjeobAmwVjF3j3FpupfV6rJit1", email:"gerencia@logisport.com.co",
    modulos:{ liquidar_unificada:"total", liquidar:"total", trabajadores:"total",
              servicios:"lectura", matriz:"total", historial:"total",
              adelantos:"total", desprendibles:"total", administrar:"lectura" } },
  { uid:"Ljp2kDmtXxRUQtVwkEmhEocxdI52", email:"asistentedeoperaciones@logisport.com.co",
    modulos:{ asistencia:"total", trabajadores:"total" } },
  { uid:"KfPNkpE615daPh1dyKKi2knCG152", email:"contabilidad@logisport.com.co",
    modulos:{ liquidar_unificada:"total", liquidar:"total" } },
];

// Estructura base de módulos (nivel:"ninguno", acciones vacías)
function modulosDefault() {
  return Object.fromEntries(
    MODULOS.map(m => [m.id, normalizarPermiso(m.id, "ninguno")])
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SELECTOR DE NIVEL (dropdown)
// ═══════════════════════════════════════════════════════════════════════════
function NivelSelector({ valor, onChange, moduloId }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);
  const nivelActual = NIVEL_BY_ID[valor] || NIVEL_BY_ID["ninguno"];
  const Icono = nivelActual.icon;

  useEffect(() => {
    if (!abierto) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [abierto]);

  return (
    <div ref={ref} style={{ position:"relative", userSelect:"none" }}>
      <button onClick={() => setAbierto(!abierto)} style={{
        display:"flex", alignItems:"center", justifyContent:"center", gap:"4px",
        padding:"5px 7px", borderRadius:"8px",
        border:`2px solid ${nivelActual.border}`, background:nivelActual.bg,
        color:nivelActual.color, cursor:"pointer",
        fontSize:"0.68rem", fontWeight:"700", minWidth:"86px",
        transition:"all 0.12s", whiteSpace:"nowrap",
      }}>
        <Icono size={11} />
        <span>{nivelActual.label}</span>
        <ChevronDown size={9} style={{ opacity:0.6, transform:abierto?"rotate(180deg)":"none", transition:"transform 0.15s" }} />
      </button>

      {abierto && (
        <div style={{
          position:"absolute", top:"calc(100% + 4px)", left:"50%",
          transform:"translateX(-50%)", background:"#fff",
          borderRadius:"12px", boxShadow:"0 8px 30px rgba(0,0,0,0.18)",
          border:"1.5px solid #e2e8f0", zIndex:9999, minWidth:"230px", overflow:"hidden",
        }}>
          {NIVELES.map(n => {
            const NIcon = n.icon;
            const activo = n.id === valor;
            return (
              <button key={n.id} onClick={() => { onChange(n.id); setAbierto(false); }} style={{
                width:"100%", display:"flex", alignItems:"flex-start", gap:"0.6rem",
                padding:"0.6rem 0.85rem", background:activo ? n.bg : "#fff",
                border:"none", borderBottom:"1px solid #f1f5f9",
                cursor:"pointer", textAlign:"left",
              }}
              onMouseEnter={e => { if (!activo) e.currentTarget.style.background = "#f8fafc"; }}
              onMouseLeave={e => { if (!activo) e.currentTarget.style.background = "#fff"; }}>
                <div style={{ width:"26px", height:"26px", borderRadius:"7px",
                  background:activo ? n.color : "#f1f5f9",
                  display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <NIcon size={13} color={activo ? "#fff" : "#94a3b8"} />
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:"700", fontSize:"0.8rem", color:activo ? n.color : "#1e293b" }}>
                    {n.label} {activo && <span style={{ background:n.color, color:"#fff", borderRadius:"4px", padding:"1px 4px", fontSize:"0.6rem" }}>ACTUAL</span>}
                  </div>
                  <div style={{ fontSize:"0.69rem", color:"#64748b", marginTop:"1px", lineHeight:"1.4" }}>{n.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PANEL DE ACCIONES GRANULARES (expandido debajo de una fila)
// ═══════════════════════════════════════════════════════════════════════════
function AccionesPanel({ usuario, onCambiarAccion, totalColumnas }) {
  const [moduloTab, setModuloTab] = useState(null);

  // Módulos que el usuario tiene acceso (nivel != "ninguno")
  const modulosConAcceso = MODULOS.filter(m => {
    const p = usuario.modulos[m.id];
    const niv = typeof p === "string" ? p : (p?.nivel || "ninguno");
    return niv !== "ninguno";
  });

  useEffect(() => {
    if (!moduloTab && modulosConAcceso.length > 0) {
      setModuloTab(modulosConAcceso[0].id);
    }
  }, []);

  if (modulosConAcceso.length === 0) {
    return (
      <tr>
        <td colSpan={totalColumnas} style={{ background:"#fef2f2", padding:"0.75rem 1.5rem", borderBottom:"2px solid #fca5a5" }}>
          <div style={{ fontSize:"0.82rem", color:"#ef4444", fontWeight:"700" }}>
            ⚠️ Este usuario no tiene acceso a ningún módulo. Primero asigna al menos nivel "Lectura" en algún módulo.
          </div>
        </td>
      </tr>
    );
  }

  const tabActual = PERMISOS_MODULOS[moduloTab];
  const permiso   = usuario.modulos[moduloTab] || { nivel:"lectura", acciones:{} };
  const acciones  = typeof permiso === "string" ? accionesPorNivel(moduloTab, permiso) : (permiso.acciones || {});

  // Agrupar acciones por grupo (si tiene grupo definido)
  const grupos = {};
  (tabActual?.acciones || []).forEach(a => {
    const g = a.grupo || "General";
    if (!grupos[g]) grupos[g] = [];
    grupos[g].push(a);
  });

  return (
    <tr>
      <td colSpan={totalColumnas} style={{
        background:"#f8fafc",
        borderBottom:"3px solid #0B3D91",
        padding:"0",
      }}>
        <div style={{ padding:"1rem 1.5rem" }}>

          {/* Título */}
          <div style={{ fontWeight:"800", color:PRIMARY, fontSize:"0.88rem", marginBottom:"0.75rem", display:"flex", alignItems:"center", gap:"0.5rem" }}>
            <Settings size={14} /> Acciones detalladas para <em style={{ fontStyle:"normal", color:"#475569" }}>{usuario.email}</em>
          </div>

          {/* Tabs de módulos */}
          <div style={{ display:"flex", gap:"0.4rem", flexWrap:"wrap", marginBottom:"1rem" }}>
            {modulosConAcceso.map(m => {
              const activo = m.id === moduloTab;
              return (
                <button key={m.id} onClick={() => setModuloTab(m.id)} style={{
                  padding:"0.4rem 0.85rem", borderRadius:"8px", fontSize:"0.75rem", fontWeight:"700",
                  border:`2px solid ${activo ? PRIMARY : "#e2e8f0"}`,
                  background:activo ? PRIMARY : "#fff",
                  color:activo ? "#fff" : "#475569",
                  cursor:"pointer", display:"flex", alignItems:"center", gap:"0.3rem",
                  transition:"all 0.15s",
                }}>
                  {MODULOS.find(x=>x.id===m.id)?.icon} {m.label}
                </button>
              );
            })}
          </div>

          {/* Acciones del módulo seleccionado */}
          {tabActual ? (
            <div style={{ background:"#fff", borderRadius:"12px", padding:"1rem 1.25rem", border:"1.5px solid #e2e8f0" }}>

              {/* Info del nivel actual */}
              <div style={{ marginBottom:"0.85rem", display:"flex", alignItems:"center", gap:"0.5rem", flexWrap:"wrap" }}>
                <div style={{ fontSize:"0.78rem", color:"#64748b", fontWeight:"600" }}>
                  Nivel actual:
                </div>
                {(() => {
                  const niv = typeof permiso === "string" ? permiso : (permiso.nivel || "lectura");
                  const nd  = NIVEL_BY_ID[niv] || NIVEL_BY_ID["lectura"];
                  const NI  = nd.icon;
                  return (
                    <span style={{ display:"inline-flex", alignItems:"center", gap:"4px", background:nd.bg, border:`1.5px solid ${nd.border}`, borderRadius:"7px", padding:"2px 9px", fontSize:"0.75rem", fontWeight:"800", color:nd.color }}>
                      <NI size={11}/> {nd.label}
                    </span>
                  );
                })()}
                <div style={{ fontSize:"0.75rem", color:"#94a3b8", marginLeft:"0.25rem" }}>
                  — Activa o desactiva acciones específicas independientemente del nivel
                </div>
              </div>

              {/* Toggles de acciones agrupados */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(260px, 1fr))", gap:"0.5rem" }}>
                {Object.entries(grupos).map(([grupo, items]) => (
                  <div key={grupo} style={{ background:"#f8fafc", borderRadius:"10px", padding:"0.75rem 0.9rem", border:"1px solid #f1f5f9" }}>
                    {Object.keys(grupos).length > 1 && (
                      <div style={{ fontSize:"0.65rem", fontWeight:"800", color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:"0.5rem" }}>
                        {grupo}
                      </div>
                    )}
                    {items.map(a => {
                      const activa = acciones[a.id] !== false &&
                        (acciones[a.id] === true || (() => {
                          const niv = typeof permiso === "string" ? permiso : (permiso.nivel || "lectura");
                          return ["limitado","total"].includes(niv);
                        })());

                      return (
                        <div key={a.id} style={{
                          display:"flex", alignItems:"center", justifyContent:"space-between",
                          padding:"0.4rem 0",
                          borderBottom:"1px solid #f1f5f9",
                        }}>
                          <div style={{ display:"flex", alignItems:"center", gap:"0.5rem", flex:1 }}>
                            <span style={{ fontSize:"0.9rem" }}>{a.emoji}</span>
                            <span style={{ fontSize:"0.78rem", fontWeight:"600", color:"#374151" }}>{a.label}</span>
                          </div>
                          <button
                            onClick={() => onCambiarAccion(usuario.uid, moduloTab, a.id, !activa)}
                            title={activa ? "Desactivar" : "Activar"}
                            style={{
                              background:"none", border:"none", cursor:"pointer",
                              display:"flex", alignItems:"center",
                              color:activa ? SUCCESS : "#cbd5e1",
                              transition:"color 0.15s",
                              flexShrink:0,
                            }}>
                            {activa
                              ? <ToggleRight size={28} />
                              : <ToggleLeft  size={28} />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Botones bulk */}
              <div style={{ display:"flex", gap:"0.5rem", marginTop:"0.85rem", flexWrap:"wrap" }}>
                <button onClick={() => {
                  (tabActual?.acciones || []).forEach(a => onCambiarAccion(usuario.uid, moduloTab, a.id, true));
                }} style={{ padding:"0.35rem 0.85rem", background:"#f0fdf4", border:"1.5px solid #86efac", borderRadius:"7px", color:SUCCESS, fontWeight:"700", fontSize:"0.73rem", cursor:"pointer" }}>
                  ✅ Activar todas
                </button>
                <button onClick={() => {
                  (tabActual?.acciones || []).forEach(a => onCambiarAccion(usuario.uid, moduloTab, a.id, false));
                }} style={{ padding:"0.35rem 0.85rem", background:"#fef2f2", border:"1.5px solid #fca5a5", borderRadius:"7px", color:DANGER, fontWeight:"700", fontSize:"0.73rem", cursor:"pointer" }}>
                  — Desactivar todas
                </button>
              </div>
            </div>
          ) : (
            <div style={{ color:"#94a3b8", fontSize:"0.82rem" }}>Este módulo no tiene acciones configurables.</div>
          )}
        </div>
      </td>
    </tr>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════
export default function ControlRoles() {
  const router = useRouter();
  const [loading,    setLoading]   = useState(true);
  const [guardando,  setGuardando] = useState(false);
  const [toastMsg,   setToastMsg]  = useState("");
  const [usuarios,   setUsuarios]  = useState([]);
  const [cambiosUids,setCambiosUids] = useState(new Set());

  // UID cuyo panel de acciones está expandido (null = ninguno)
  const [expandido,  setExpandido] = useState(null);

  // Modal agregar usuario
  const [modalAgregar, setModalAgregar] = useState(false);
  const [nuevoUid,     setNuevoUid]     = useState("");
  const [nuevoEmail,   setNuevoEmail]   = useState("");
  const [nuevoNombre,  setNuevoNombre]  = useState("");
  const [errAgregar,   setErrAgregar]   = useState("");

  // ── Auth ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/login"); return; }
      const r = await getUserRoleByUid(user.uid);
      if (r !== "admin") { router.push("/nomina"); return; }
      await cargar();
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // ── Cargar ────────────────────────────────────────────────────────────────
  const cargar = async () => {
    try {
      const snap = await getDocs(collection(db, "usuarios"));
      const lista = snap.docs
        .filter(d => ["nomina","nómina","nominas","nóminas","payroll"].includes(String(d.data().rol||"").toLowerCase()))
        .map(d => ({ uid:d.id, email:d.data().email||d.data().correo||"", nombre:d.data().nombre||d.data().displayName||"" }));

      const base = lista.length > 0
        ? lista
        : SEED_USUARIOS.map(s => ({ uid:s.uid, email:s.email, nombre:"" }));

      const conModulos = await Promise.all(base.map(async (u) => {
        const snap2 = await getDoc(doc(db, "nomina_permisos_usuario", u.uid));
        const existente = snap2.exists() ? (snap2.data().modulos || {}) : {};
        // Normalizar cada módulo al formato { nivel, acciones }
        const modulosCompletos = {
          ...modulosDefault(),
          ...Object.fromEntries(
            Object.entries(existente).map(([k, v]) => [k, normalizarPermiso(k, v)])
          ),
        };
        return { ...u, modulos: modulosCompletos };
      }));

      setUsuarios(conModulos);
    } catch (e) {
      toast("⚠️ Error: " + e.message);
    }
  };

  // ── Cambiar nivel de un módulo ────────────────────────────────────────────
  const cambiarNivel = (uid, moduloId, nuevoNivel) => {
    setUsuarios(prev => prev.map(u => {
      if (u.uid !== uid) return u;
      const permisoActual = u.modulos[moduloId] || normalizarPermiso(moduloId, "ninguno");
      const nv = normalizarPermiso(moduloId, {
        nivel:    nuevoNivel,
        // Resetear acciones al cambiar nivel (aplicar defaults del nuevo nivel)
        acciones: accionesPorNivel(moduloId, nuevoNivel),
      });
      return { ...u, modulos: { ...u.modulos, [moduloId]: nv } };
    }));
    setCambiosUids(prev => new Set([...prev, uid]));
  };

  // ── Cambiar acción granular ───────────────────────────────────────────────
  const cambiarAccion = (uid, moduloId, accionId, valor) => {
    setUsuarios(prev => prev.map(u => {
      if (u.uid !== uid) return u;
      const pActual = u.modulos[moduloId] || normalizarPermiso(moduloId, "ninguno");
      const np = {
        nivel:    pActual.nivel || "lectura",
        acciones: { ...(pActual.acciones || {}), [accionId]: valor },
      };
      return { ...u, modulos: { ...u.modulos, [moduloId]: np } };
    }));
    setCambiosUids(prev => new Set([...prev, uid]));
  };

  // ── Aplicar nivel a todos ─────────────────────────────────────────────────
  const aplicarATodos = (moduloId, nivel) => {
    if (!confirm(`¿Establecer "${NIVEL_BY_ID[nivel].label}" para TODOS en "${MODULOS.find(m=>m.id===moduloId)?.label}"?`)) return;
    setUsuarios(prev => prev.map(u => ({
      ...u,
      modulos: { ...u.modulos, [moduloId]: normalizarPermiso(moduloId, nivel) },
    })));
    setCambiosUids(new Set(usuarios.map(u => u.uid)));
  };

  // ── Preset usuario ────────────────────────────────────────────────────────
  const presetTodo = (uid, nivel) => {
    setUsuarios(prev => prev.map(u => {
      if (u.uid !== uid) return u;
      return { ...u, modulos: Object.fromEntries(MODULOS.map(m => [m.id, normalizarPermiso(m.id, nivel)])) };
    }));
    setCambiosUids(prev => new Set([...prev, uid]));
  };

  // ── Guardar ────────────────────────────────────────────────────────────────
  const guardar = async () => {
    setGuardando(true);
    try {
      const batch = writeBatch(db);
      const aGuardar = usuarios.filter(u => cambiosUids.has(u.uid));
      for (const u of aGuardar) {
        batch.set(doc(db, "nomina_permisos_usuario", u.uid), {
          uid:u.uid, email:u.email, nombre:u.nombre||"",
          modulos:u.modulos, actualizadoEn:new Date(),
        });
      }
      await batch.commit();
      setCambiosUids(new Set());
      toast(`✅ Guardado — ${aGuardar.length} usuario${aGuardar.length!==1?"s":""} actualizados`);
    } catch (e) {
      toast("❌ Error: " + e.message);
    }
    setGuardando(false);
  };

  // ── Agregar usuario ────────────────────────────────────────────────────────
  const agregarUsuario = () => {
    const uid = nuevoUid.trim(), email = nuevoEmail.trim().toLowerCase(), nombre = nuevoNombre.trim();
    if (!uid)   { setErrAgregar("El UID es obligatorio."); return; }
    if (!email) { setErrAgregar("El email es obligatorio."); return; }
    if (usuarios.some(u => u.uid === uid)) { setErrAgregar("Ya existe ese UID."); return; }
    setUsuarios(prev => [...prev, { uid, email, nombre, modulos:modulosDefault() }]);
    setCambiosUids(prev => new Set([...prev, uid]));
    setNuevoUid(""); setNuevoEmail(""); setNuevoNombre(""); setErrAgregar("");
    setModalAgregar(false);
    toast(`➕ ${email} agregado — configura sus permisos y guarda`);
  };

  // ── Sembrar ────────────────────────────────────────────────────────────────
  const sembrar = async () => {
    if (!confirm("🌱 Cargar configuración inicial. ¿Confirmar?")) return;
    setGuardando(true);
    try {
      const batch = writeBatch(db);
      for (const s of SEED_USUARIOS) {
        const modulos = {
          ...modulosDefault(),
          ...Object.fromEntries(Object.entries(s.modulos).map(([k,v]) => [k, normalizarPermiso(k, v)])),
        };
        batch.set(doc(db, "nomina_permisos_usuario", s.uid), {
          uid:s.uid, email:s.email, nombre:"", modulos, actualizadoEn:new Date(),
        });
      }
      await batch.commit();
      await cargar();
      toast(`✅ ${SEED_USUARIOS.length} usuarios cargados`);
    } catch (e) {
      toast("❌ Error: " + e.message);
    }
    setGuardando(false);
  };

  const toast = (msg) => { setToastMsg(msg); setTimeout(() => setToastMsg(""), 4500); };

  const resumen = (u) => {
    let total=0, limitado=0, lectura=0, ninguno=0;
    MODULOS.forEach(m => {
      const niv = u.modulos[m.id]?.nivel || "ninguno";
      if (niv==="total")    total++;
      else if (niv==="limitado") limitado++;
      else if (niv==="lectura")  lectura++;
      else ninguno++;
    });
    return { total, limitado, lectura, ninguno };
  };

  const TOTAL_COL = MODULOS.length + 4; // usuario + módulos + resumen + preset + acciones

  if (loading) return (
    <LayoutWithSidebar>
      <div style={{ textAlign:"center", padding:"4rem", color:PRIMARY }}>
        <div style={{ fontSize:"2rem" }}>🔐 Cargando control de roles...</div>
      </div>
    </LayoutWithSidebar>
  );

  return (
    <LayoutWithSidebar>
      <div style={{ maxWidth:"1800px", margin:"0 auto" }}>

        {/* ── HEADER ── */}
        <div style={{ display:"flex", alignItems:"flex-start", gap:"1rem", marginBottom:"1.5rem", flexWrap:"wrap" }}>
          <button onClick={() => router.push("/nomina")} style={{ background:"none", border:"none", cursor:"pointer", color:PRIMARY, marginTop:"4px" }}>
            <ArrowLeft size={22} />
          </button>
          <div style={{ flex:1, minWidth:"280px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"0.75rem", flexWrap:"wrap" }}>
              <h1 style={{ margin:0, color:PRIMARY, fontSize:"1.7rem", fontWeight:"800" }}>🔐 Control de Roles y Accesos</h1>
              <span style={{ background:"#fef2f2", color:DANGER, border:`1.5px solid ${DANGER}30`, borderRadius:"20px", padding:"3px 12px", fontSize:"0.7rem", fontWeight:"800" }}>SOLO ADMIN</span>
            </div>
            <p style={{ margin:"0.25rem 0 0", color:"#64748b", fontSize:"0.85rem" }}>
              Configura qué páginas ve cada usuario y qué acciones específicas puede realizar dentro de cada módulo.
            </p>
          </div>
          <div style={{ display:"flex", gap:"0.6rem", flexWrap:"wrap", alignItems:"center" }}>
            <button onClick={() => { setErrAgregar(""); setModalAgregar(true); }} style={{ background:"#f0fdf4", border:"1.5px solid #86efac", borderRadius:"10px", padding:"0.6rem 1rem", color:"#065f46", cursor:"pointer", fontWeight:"700", fontSize:"0.82rem", display:"flex", alignItems:"center", gap:"0.4rem" }}>
              <UserPlus size={14} /> Agregar usuario
            </button>
            <button onClick={sembrar} disabled={guardando} style={{ background:"#fffbeb", border:`1.5px solid ${WARN}`, borderRadius:"10px", padding:"0.6rem 1rem", color:"#92400e", cursor:"pointer", fontWeight:"700", fontSize:"0.82rem" }}>
              🌱 Datos iniciales
            </button>
            {cambiosUids.size > 0 && (
              <div style={{ background:"#fffbeb", border:"1.5px solid #fcd34d", borderRadius:"10px", padding:"0.5rem 0.85rem", fontSize:"0.8rem", color:"#92400e", fontWeight:"700" }}>
                ⚠️ {cambiosUids.size} sin guardar
              </div>
            )}
            <button onClick={guardar} disabled={guardando || cambiosUids.size === 0} style={{
              background:(guardando || cambiosUids.size===0) ? "#94a3b8" : PRIMARY,
              border:"none", borderRadius:"10px", padding:"0.7rem 1.5rem", color:"#fff",
              cursor:(guardando || cambiosUids.size===0) ? "not-allowed" : "pointer",
              fontWeight:"700", fontSize:"0.9rem", display:"flex", alignItems:"center", gap:"0.5rem",
            }}>
              {guardando
                ? <><RefreshCw size={15} style={{ animation:"spin 1s linear infinite" }} /> Guardando...</>
                : <><Save size={16} /> Guardar cambios</>}
            </button>
          </div>
        </div>

        {/* ── LEYENDA ── */}
        <div style={{ display:"flex", gap:"0.45rem", marginBottom:"1.25rem", flexWrap:"wrap", alignItems:"center" }}>
          {NIVELES.map(n => { const NI = n.icon; return (
            <div key={n.id} style={{ display:"flex", alignItems:"center", gap:"0.35rem", background:n.bg, border:`1.5px solid ${n.border}`, borderRadius:"8px", padding:"0.3rem 0.7rem", fontSize:"0.72rem", color:n.color, fontWeight:"700" }}>
              <NI size={11}/> {n.label}
            </div>
          ); })}
          <div style={{ marginLeft:"0.5rem", fontSize:"0.72rem", color:"#64748b", fontStyle:"italic" }}>
            💡 Haz clic en "⚙️ Acciones" para configurar permisos granulares dentro de cada módulo
          </div>
        </div>

        {/* ── TABLA ── */}
        {usuarios.length === 0 ? (
          <div style={{ background:"#fff", borderRadius:"16px", padding:"4rem", textAlign:"center", boxShadow:"0 2px 12px rgba(0,0,0,0.07)", border:"2px dashed #e2e8f0" }}>
            <div style={{ fontSize:"3rem", marginBottom:"1rem" }}>👥</div>
            <div style={{ fontWeight:"800", color:PRIMARY, fontSize:"1.2rem", marginBottom:"0.5rem" }}>Sin usuarios con rol nómina</div>
            <button onClick={sembrar} style={{ background:PRIMARY, border:"none", borderRadius:"10px", padding:"0.85rem 2rem", color:"#fff", cursor:"pointer", fontWeight:"700", fontSize:"1rem" }}>
              🌱 Cargar datos iniciales
            </button>
          </div>
        ) : (
          <div style={{ overflowX:"auto", borderRadius:"16px", boxShadow:"0 2px 12px rgba(0,0,0,0.08)", background:"#fff" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", minWidth:"1400px" }}>

              {/* ENCABEZADOS */}
              <thead>
                <tr>
                  <th style={{ padding:"0.9rem 1.25rem", background:PRIMARY, color:"#fff", textAlign:"left", fontSize:"0.8rem", fontWeight:"800", position:"sticky", left:0, zIndex:3, minWidth:"230px", borderRight:"2px solid rgba(255,255,255,0.15)" }}>
                    <Users size={13} style={{ marginRight:"5px" }}/>Usuario
                  </th>
                  {MODULOS.map(m => (
                    <th key={m.id} style={{ padding:"0.6rem 0.4rem", background:PRIMARY, color:"#fff", textAlign:"center", fontSize:"0.65rem", fontWeight:"700", minWidth:"96px", borderRight:"1px solid rgba(255,255,255,0.08)", verticalAlign:"bottom" }}>
                      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"2px" }}>
                        <span style={{ fontSize:"1rem" }}>{m.icon}</span>
                        <span style={{ lineHeight:"1.2", textAlign:"center" }}>{m.label}</span>
                      </div>
                      {/* Mini botones "aplicar a todos" */}
                      <div style={{ display:"flex", justifyContent:"center", gap:"2px", marginTop:"3px" }}>
                        {NIVELES.map(n => (
                          <button key={n.id} onClick={() => aplicarATodos(m.id, n.id)} title={`"${n.label}" para todos`}
                            style={{ background:"rgba(255,255,255,0.15)", border:"none", borderRadius:"3px", width:"18px", height:"13px", cursor:"pointer", color:"#fff", fontSize:"0.5rem", fontWeight:"800", display:"flex", alignItems:"center", justifyContent:"center" }}>
                            {n.short}
                          </button>
                        ))}
                      </div>
                    </th>
                  ))}
                  <th style={{ padding:"0.6rem 0.6rem", background:"#082d6b", color:"#fff", textAlign:"center", fontSize:"0.68rem", fontWeight:"700", minWidth:"110px", verticalAlign:"bottom" }}>Resumen</th>
                  <th style={{ padding:"0.6rem 0.6rem", background:"#082d6b", color:"#fff", textAlign:"center", fontSize:"0.68rem", fontWeight:"700", minWidth:"110px", verticalAlign:"bottom" }}>Preset</th>
                  <th style={{ padding:"0.6rem 0.6rem", background:"#082d6b", color:"#fff", textAlign:"center", fontSize:"0.68rem", fontWeight:"700", minWidth:"110px", verticalAlign:"bottom" }}>Acciones</th>
                </tr>
              </thead>

              {/* FILAS */}
              <tbody>
                {usuarios.map((u, idx) => {
                  const hayPendiente = cambiosUids.has(u.uid);
                  const expandiendoEste = expandido === u.uid;
                  const bgFila = hayPendiente ? "#fffbeb" : (idx%2===0 ? "#fff" : "#fafbfc");
                  const res = resumen(u);

                  return [
                    // Fila principal
                    <tr key={u.uid} style={{ background:bgFila, borderBottom: expandiendoEste ? "none" : "1px solid #f1f5f9" }}>

                      {/* Celda usuario */}
                      <td style={{ padding:"0.7rem 1.25rem", position:"sticky", left:0, background:bgFila, borderRight:"2px solid #e2e8f0", zIndex:1 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:"0.6rem" }}>
                          <div style={{ width:"32px", height:"32px", borderRadius:"50%", background:`${PRIMARY}15`, color:PRIMARY, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:"800", fontSize:"0.9rem", flexShrink:0 }}>
                            {(u.email||"?")[0].toUpperCase()}
                          </div>
                          <div style={{ minWidth:0 }}>
                            {u.nombre && <div style={{ fontWeight:"700", color:"#1e293b", fontSize:"0.82rem", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{u.nombre}</div>}
                            <div style={{ color:"#475569", fontSize:"0.72rem", fontFamily:"monospace", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:"185px" }}>{u.email}</div>
                            <div style={{ display:"flex", alignItems:"center", gap:"0.3rem", marginTop:"2px" }}>
                              <span style={{ background:"#0ea5e915", color:"#0ea5e9", borderRadius:"5px", padding:"1px 5px", fontSize:"0.6rem", fontWeight:"800" }}>Nómina</span>
                              {hayPendiente && <span style={{ background:"#fffbeb", color:"#92400e", borderRadius:"5px", padding:"1px 5px", fontSize:"0.6rem", fontWeight:"800", border:"1px solid #fcd34d" }}>⚠️ pendiente</span>}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Celdas por módulo */}
                      {MODULOS.map(m => (
                        <td key={m.id} style={{ textAlign:"center", padding:"0.45rem 0.3rem", borderRight:"1px solid #f1f5f9" }}>
                          <NivelSelector
                            valor={u.modulos[m.id]?.nivel || "ninguno"}
                            onChange={(nv) => cambiarNivel(u.uid, m.id, nv)}
                            moduloId={m.id}
                          />
                        </td>
                      ))}

                      {/* Resumen */}
                      <td style={{ padding:"0.45rem 0.6rem", textAlign:"center" }}>
                        <div style={{ display:"flex", flexDirection:"column", gap:"2px", alignItems:"center" }}>
                          {res.total    > 0 && <div style={{ fontSize:"0.64rem", fontWeight:"800", color:SUCCESS,   background:"#f0fdf4", borderRadius:"5px", padding:"2px 6px", width:"86px" }}>✅ {res.total} total</div>}
                          {res.limitado > 0 && <div style={{ fontSize:"0.64rem", fontWeight:"800", color:"#b45309", background:"#fffbeb", borderRadius:"5px", padding:"2px 6px", width:"86px" }}>⚡ {res.limitado} limit.</div>}
                          {res.lectura  > 0 && <div style={{ fontSize:"0.64rem", fontWeight:"800", color:"#475569", background:"#f8fafc", borderRadius:"5px", padding:"2px 6px", width:"86px" }}>👁️ {res.lectura} lect.</div>}
                          {res.ninguno  > 0 && <div style={{ fontSize:"0.64rem", fontWeight:"700", color:DANGER,    background:"#fef2f2", borderRadius:"5px", padding:"2px 6px", width:"86px" }}>— {res.ninguno} oculto</div>}
                        </div>
                      </td>

                      {/* Preset */}
                      <td style={{ padding:"0.45rem 0.6rem", textAlign:"center" }}>
                        <div style={{ display:"flex", flexDirection:"column", gap:"3px" }}>
                          <button onClick={() => presetTodo(u.uid,"total")}   style={{ background:"#f0fdf4", border:"1.5px solid #86efac", borderRadius:"6px", padding:"3px 0", color:SUCCESS,   cursor:"pointer", fontWeight:"700", fontSize:"0.62rem", width:"100%" }}>✅ Todo total</button>
                          <button onClick={() => presetTodo(u.uid,"lectura")} style={{ background:"#f8fafc", border:"1.5px solid #cbd5e1", borderRadius:"6px", padding:"3px 0", color:"#64748b", cursor:"pointer", fontWeight:"700", fontSize:"0.62rem", width:"100%" }}>👁️ Todo lectura</button>
                          <button onClick={() => presetTodo(u.uid,"ninguno")} style={{ background:"#fef2f2", border:"1.5px solid #fca5a5", borderRadius:"6px", padding:"3px 0", color:DANGER,    cursor:"pointer", fontWeight:"700", fontSize:"0.62rem", width:"100%" }}>— Todo oculto</button>
                        </div>
                      </td>

                      {/* Botón expandir acciones */}
                      <td style={{ padding:"0.45rem 0.6rem", textAlign:"center" }}>
                        <button onClick={() => setExpandido(expandiendoEste ? null : u.uid)} style={{
                          background: expandiendoEste ? PRIMARY : "#f8fafc",
                          border:`2px solid ${expandiendoEste ? PRIMARY : "#e2e8f0"}`,
                          borderRadius:"9px", padding:"0.5rem 0.7rem",
                          color: expandiendoEste ? "#fff" : "#475569",
                          cursor:"pointer", fontWeight:"700", fontSize:"0.72rem",
                          display:"flex", alignItems:"center", justifyContent:"center", gap:"0.35rem",
                          transition:"all 0.15s", whiteSpace:"nowrap",
                        }}>
                          <Settings size={12}/>
                          {expandiendoEste ? "Cerrar" : "⚙️ Acciones"}
                          {expandiendoEste ? <ChevronDown size={10}/> : <ChevronRight size={10}/>}
                        </button>
                      </td>
                    </tr>,

                    // Fila expandida de acciones granulares
                    expandiendoEste && (
                      <AccionesPanel
                        key={`${u.uid}-acciones`}
                        usuario={u}
                        onCambiarAccion={cambiarAccion}
                        totalColumnas={TOTAL_COL}
                      />
                    ),
                  ];
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Nota informativa ── */}
        <div style={{ marginTop:"1.5rem", background:"#f0f9ff", border:"1.5px solid #93c5fd", borderRadius:"12px", padding:"1rem 1.25rem", display:"flex", gap:"0.75rem", alignItems:"flex-start" }}>
          <Info size={17} color={PRIMARY} style={{ flexShrink:0, marginTop:"2px" }}/>
          <div style={{ fontSize:"0.8rem", color:"#1e40af", lineHeight:"1.7" }}>
            <strong>Sistema de dos capas:</strong> El nivel del módulo (Sin acceso / Lectura / Limitado / Total) controla si el usuario puede ver la página.
            Las <strong>acciones detalladas</strong> (⚙️) permiten activar o desactivar funciones específicas dentro de la página, como "Crear novedades" o "Eliminar registros", de forma independiente al nivel.
          </div>
        </div>

        {/* ── Modal agregar usuario ── */}
        {modalAgregar && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }}
            onClick={e => { if (e.target===e.currentTarget) setModalAgregar(false); }}>
            <div style={{ background:"#fff", borderRadius:"18px", padding:"2rem", maxWidth:"460px", width:"100%", boxShadow:"0 20px 60px rgba(0,0,0,0.2)" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.5rem" }}>
                <div>
                  <div style={{ fontWeight:"800", color:PRIMARY, fontSize:"1.1rem", display:"flex", alignItems:"center", gap:"0.5rem" }}><UserPlus size={18}/> Agregar usuario</div>
                  <div style={{ color:"#64748b", fontSize:"0.78rem", marginTop:"2px" }}>Los permisos inician todos en "Sin acceso".</div>
                </div>
                <button onClick={() => setModalAgregar(false)} style={{ background:"none", border:"none", cursor:"pointer" }}><X size={20} color="#94a3b8"/></button>
              </div>
              <label style={{ display:"block", fontWeight:"700", color:"#374151", fontSize:"0.82rem", marginBottom:"0.3rem" }}>UID de Firebase Auth <span style={{ color:DANGER }}>*</span></label>
              <input autoFocus value={nuevoUid} onChange={e=>{setNuevoUid(e.target.value);setErrAgregar("");}}
                placeholder="Ej: AbCdEfGhIjKlMnOpQrSt12345678"
                style={{ width:"100%", padding:"0.65rem 0.9rem", border:`1.5px solid ${errAgregar&&!nuevoUid.trim()?DANGER:"#e2e8f0"}`, borderRadius:"10px", fontSize:"0.87rem", outline:"none", boxSizing:"border-box", marginBottom:"0.85rem", fontFamily:"monospace" }}/>
              <label style={{ display:"block", fontWeight:"700", color:"#374151", fontSize:"0.82rem", marginBottom:"0.3rem" }}>Email <span style={{ color:DANGER }}>*</span></label>
              <input value={nuevoEmail} onChange={e=>{setNuevoEmail(e.target.value);setErrAgregar("");}}
                placeholder="usuario@logisport.com.co"
                style={{ width:"100%", padding:"0.65rem 0.9rem", border:"1.5px solid #e2e8f0", borderRadius:"10px", fontSize:"0.87rem", outline:"none", boxSizing:"border-box", marginBottom:"0.85rem" }}/>
              <label style={{ display:"block", fontWeight:"700", color:"#374151", fontSize:"0.82rem", marginBottom:"0.3rem" }}>Nombre (opcional)</label>
              <input value={nuevoNombre} onChange={e=>setNuevoNombre(e.target.value)}
                onKeyDown={e=>{ if(e.key==="Enter") agregarUsuario(); }}
                placeholder="Ej: Juan Pérez"
                style={{ width:"100%", padding:"0.65rem 0.9rem", border:"1.5px solid #e2e8f0", borderRadius:"10px", fontSize:"0.87rem", outline:"none", boxSizing:"border-box", marginBottom:errAgregar?"0.5rem":"1.25rem" }}/>
              {errAgregar && <div style={{ color:DANGER, fontSize:"0.8rem", fontWeight:"600", marginBottom:"1rem", display:"flex", alignItems:"center", gap:"0.4rem" }}><AlertTriangle size={13}/>{errAgregar}</div>}
              <div style={{ background:"#f0f9ff", border:"1.5px solid #93c5fd", borderRadius:"10px", padding:"0.75rem 1rem", fontSize:"0.75rem", color:"#1e40af", lineHeight:"1.6", marginBottom:"1.25rem" }}>
                <strong>¿Cómo obtener el UID?</strong> Firebase Console → Authentication → busca el usuario → copia el User UID.
              </div>
              <div style={{ display:"flex", gap:"0.65rem" }}>
                <button onClick={()=>setModalAgregar(false)} style={{ flex:1, padding:"0.75rem", background:"#f1f5f9", border:"none", borderRadius:"10px", color:"#475569", fontWeight:"700", cursor:"pointer" }}>Cancelar</button>
                <button onClick={agregarUsuario} style={{ flex:2, padding:"0.75rem", background:PRIMARY, border:"none", borderRadius:"10px", color:"#fff", fontWeight:"700", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:"0.5rem" }}>
                  <UserPlus size={16}/> Agregar usuario
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Toast ── */}
        {toastMsg && (
          <div style={{ position:"fixed", bottom:"2rem", right:"2rem", background:toastMsg.startsWith("❌")?"#fef2f2":"#f0fdf4", border:`2px solid ${toastMsg.startsWith("❌")?DANGER:SUCCESS}`, borderRadius:"12px", padding:"0.85rem 1.5rem", color:toastMsg.startsWith("❌")?DANGER:"#065f46", fontWeight:"700", fontSize:"0.9rem", boxShadow:"0 8px 30px rgba(0,0,0,0.15)", zIndex:99999, display:"flex", alignItems:"center", gap:"0.5rem", animation:"slideIn 0.3s ease" }}>
            {toastMsg}
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes spin    { to { transform:rotate(360deg); } }
        @keyframes slideIn { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
    </LayoutWithSidebar>
  );
}
