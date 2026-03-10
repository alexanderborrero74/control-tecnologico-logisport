// pages/nomina/control-roles.js
// Administración de permisos por usuario y módulo — solo rol "admin"
// Guarda en: nomina_permisos_usuario/{uid}  →  { uid, email, nombre, modulos: { [modId]: nivel } }
// Niveles: "ninguno" | "lectura" | "limitado" | "total"

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  collection, getDocs, doc, setDoc, getDoc, writeBatch,
} from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";
import { getUserRoleByUid } from "@/utils/getUserRole";
import LayoutWithSidebar from "@/components/LayoutWithSidebar";
import {
  ArrowLeft, Shield, Save, RefreshCw, CheckCircle,
  Users, Lock, Eye, EyeOff, Zap, Settings,
  ChevronDown, X, Info, AlertTriangle, UserPlus
} from "lucide-react";

const PRIMARY = "#0B3D91";
const SUCCESS = "#10b981";
const DANGER  = "#ef4444";
const WARN    = "#f59e0b";

// ═══════════════════════════════════════════════════════════════════════════
// DEFINICIÓN DE NIVELES
// ═══════════════════════════════════════════════════════════════════════════
const NIVELES = [
  {
    id:     "ninguno",
    label:  "Sin acceso",
    short:  "—",
    icon:   EyeOff,
    color:  "#ef4444",
    bg:     "#fef2f2",
    border: "#fca5a5",
    desc:   "No puede ver esta página. Tampoco aparece en el menú lateral.",
  },
  {
    id:     "lectura",
    label:  "Solo lectura",
    short:  "👁️",
    icon:   Eye,
    color:  "#64748b",
    bg:     "#f8fafc",
    border: "#cbd5e1",
    desc:   "Puede ver la información pero NO puede crear, editar ni eliminar nada.",
  },
  {
    id:     "limitado",
    label:  "Limitado",
    short:  "⚡",
    icon:   Zap,
    color:  "#f59e0b",
    bg:     "#fffbeb",
    border: "#fcd34d",
    desc:   "Puede registrar y editar datos, pero NO puede eliminar ni realizar acciones críticas.",
  },
  {
    id:     "total",
    label:  "Control total",
    short:  "✅",
    icon:   CheckCircle,
    color:  "#10b981",
    bg:     "#f0fdf4",
    border: "#86efac",
    desc:   "Acceso completo: crear, editar, eliminar y todas las acciones disponibles.",
  },
];

const NIVEL_BY_ID = Object.fromEntries(NIVELES.map(n => [n.id, n]));

// ═══════════════════════════════════════════════════════════════════════════
// DEFINICIÓN DE MÓDULOS
// ═══════════════════════════════════════════════════════════════════════════
const MODULOS = [
  {
    id: "trabajadores",
    label: "Trabajadores",
    icon: "👷",
    path: "/nomina/trabajadores",
    acciones: {
      lectura:  "Ver lista de trabajadores, exportar Excel",
      limitado: "Agregar y editar trabajadores (NO puede eliminar ni habilitar/deshabilitar)",
      total:    "Todo: agregar, editar, eliminar, habilitar/deshabilitar trabajadores",
    },
  },
  {
    id: "asistencia",
    label: "Listado de Asistencia",
    icon: "📋",
    path: "/nomina/asistencia",
    acciones: {
      lectura:  "Ver cuadrillas y registros de asistencia",
      limitado: "Registrar novedades diarias (NO puede crear/eliminar cuadrillas)",
      total:    "Todo: crear/editar/eliminar cuadrillas y registrar novedades",
    },
  },
  {
    id: "servicios",
    label: "Servicios y Tarifas",
    icon: "💼",
    path: "/nomina/servicios",
    acciones: {
      lectura:  "Consultar servicios y tarifas",
      limitado: "Crear y editar servicios",
      total:    "Todo: crear, editar y eliminar servicios",
    },
  },
  {
    id: "matriz",
    label: "Matriz",
    icon: "📊",
    path: "/nomina/matriz",
    acciones: {
      lectura:  "Ver la matriz de producción",
      limitado: "Registrar producción y novedades",
      total:    "Todo: registrar, corregir y eliminar registros",
    },
  },
  {
    id: "liquidar",
    label: "Liquidar Nómina",
    icon: "💰",
    path: "/nomina/liquidar",
    acciones: {
      lectura:  "Ver liquidaciones generadas",
      limitado: "Generar liquidaciones",
      total:    "Todo: generar, guardar y eliminar liquidaciones",
    },
  },
  {
    id: "liquidar_unificada",
    label: "Liquidación Unificada",
    icon: "📑",
    path: "/nomina/liquidar_unificada",
    acciones: {
      lectura:  "Ver liquidación consolidada",
      limitado: "Generar liquidación unificada",
      total:    "Todo: generar, exportar y gestionar liquidación unificada",
    },
  },
  {
    id: "historial",
    label: "Historial Nóminas",
    icon: "📅",
    path: "/nomina/historial",
    acciones: {
      lectura:  "Consultar historial de nóminas y exportar DataX",
      limitado: "Consultar historial de nóminas y exportar DataX",
      total:    "Todo: consultar, exportar y eliminar registros del historial",
    },
  },
  {
    id: "adelantos",
    label: "Adelantos y Restaurante",
    icon: "🍽️",
    path: "/nomina/adelantos",
    acciones: {
      lectura:  "Ver adelantos y registros de comida",
      limitado: "Registrar adelantos y comida",
      total:    "Todo: registrar, editar y eliminar adelantos/comida",
    },
  },
  {
    id: "desprendibles",
    label: "Desprendibles",
    icon: "🖨️",
    path: "/nomina/desprendibles",
    acciones: {
      lectura:  "Ver y generar desprendibles",
      limitado: "Generar e imprimir desprendibles",
      total:    "Todo: generar, imprimir y eliminar desprendibles",
    },
  },
  {
    id: "administrar",
    label: "Administrar",
    icon: "⚙️",
    path: "/nomina/administrar",
    acciones: {
      lectura:  "Ver catálogos y configuración",
      limitado: "Editar catálogos (novedades, cargos, cuadrillas)",
      total:    "Acceso total a toda la configuración del módulo",
    },
  },
];

// Datos seed del Excel del cliente
const SEED_USUARIOS = [
  { uid: "mXEwGPXVZWaOYuaIBUUcb1pwKSc2", email: "jamoca.0314@hotmail.com",
    modulos: { liquidar_unificada: "total", liquidar: "total" } },
  { uid: "t1MZoANNGmeDVEMcRr1vDcEvbms1", email: "compras@logisport.com.co",
    modulos: { adelantos: "total" } },
  { uid: "XSa3lSmOWIM7WFXB3r86pGzotpl2", email: "liquidacion@logisport.com.co",
    modulos: { matriz: "total" } },
  { uid: "LoTV5hJN0uNcvctBTpXqMG9yXe73", email: "facturacion@logisport.com.co",
    modulos: { adelantos: "total" } },
  { uid: "kK27zAYtOAb2Sc7phYtoJUBgH9T2", email: "operaciones@logisport.com.co",
    modulos: { liquidar_unificada: "total", liquidar: "total" } },
  { uid: "5lxjeobAmwVjF3j3FpupfV6rJit1", email: "gerencia@logisport.com.co",
    modulos: {
      liquidar_unificada: "total", liquidar: "total", trabajadores: "total",
      servicios: "lectura", matriz: "total", historial: "total",
      adelantos: "total", desprendibles: "total", administrar: "lectura",
    },
  },
  { uid: "Ljp2kDmtXxRUQtVwkEmhEocxdI52", email: "asistentedeoperaciones@logisport.com.co",
    modulos: { asistencia: "total", trabajadores: "total" } },
  { uid: "KfPNkpE615daPh1dyKKi2knCG152", email: "contabilidad@logisport.com.co",
    modulos: { liquidar_unificada: "total", liquidar: "total" } },
];

function modulosDefault() {
  return Object.fromEntries(MODULOS.map(m => [m.id, "ninguno"]));
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE SELECTOR DE NIVEL
// ═══════════════════════════════════════════════════════════════════════════
function NivelSelector({ valor, onChange, modulo }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!abierto) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [abierto]);

  const nivelActual = NIVEL_BY_ID[valor] || NIVEL_BY_ID["ninguno"];
  const Icono = nivelActual.icon;

  return (
    <div ref={ref} style={{ position: "relative", userSelect: "none" }}>
      {/* Botón trigger */}
      <button
        onClick={() => setAbierto(!abierto)}
        title={nivelActual.desc}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: "4px",
          padding: "5px 8px",
          borderRadius: "8px",
          border: `2px solid ${nivelActual.border}`,
          background: nivelActual.bg,
          color: nivelActual.color,
          cursor: "pointer",
          fontSize: "0.72rem",
          fontWeight: "700",
          minWidth: "90px",
          transition: "all 0.12s",
          whiteSpace: "nowrap",
        }}
      >
        <Icono size={12} />
        <span>{nivelActual.label}</span>
        <ChevronDown size={10} style={{ opacity: 0.6, transform: abierto ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
      </button>

      {/* Dropdown */}
      {abierto && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 4px)",
          left: "50%",
          transform: "translateX(-50%)",
          background: "#fff",
          borderRadius: "12px",
          boxShadow: "0 8px 30px rgba(0,0,0,0.18)",
          border: "1.5px solid #e2e8f0",
          zIndex: 9999,
          minWidth: "240px",
          overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{ padding: "0.6rem 0.9rem", background: "#f8fafc", borderBottom: "1px solid #f1f5f9", fontSize: "0.7rem", fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {modulo.icon} {modulo.label}
          </div>
          {NIVELES.map(n => {
            const NIcon = n.icon;
            const activo = n.id === valor;
            return (
              <button
                key={n.id}
                onClick={() => { onChange(n.id); setAbierto(false); }}
                style={{
                  width: "100%",
                  display: "flex", alignItems: "flex-start", gap: "0.65rem",
                  padding: "0.65rem 0.9rem",
                  background: activo ? n.bg : "#fff",
                  border: "none",
                  borderBottom: "1px solid #f1f5f9",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 0.1s",
                }}
                onMouseEnter={e => { if (!activo) e.currentTarget.style.background = "#f8fafc"; }}
                onMouseLeave={e => { if (!activo) e.currentTarget.style.background = "#fff"; }}
              >
                <div style={{
                  width: "28px", height: "28px", borderRadius: "8px",
                  background: activo ? n.color : "#f1f5f9",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <NIcon size={14} color={activo ? "#fff" : "#94a3b8"} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: "700", fontSize: "0.82rem", color: activo ? n.color : "#1e293b", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    {n.label}
                    {activo && <span style={{ background: n.color, color: "#fff", borderRadius: "4px", padding: "1px 5px", fontSize: "0.62rem" }}>ACTUAL</span>}
                  </div>
                  <div style={{ fontSize: "0.71rem", color: "#64748b", marginTop: "1px", lineHeight: "1.4" }}>
                    {modulo.acciones?.[n.id] || n.desc}
                  </div>
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
// PÁGINA PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════
export default function ControlRoles() {
  const router = useRouter();
  const [loading,   setLoading]   = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [toastMsg,  setToastMsg]  = useState("");

  // Array de usuarios con sus modulos
  const [usuarios, setUsuarios] = useState([]);
  // Conjunto de UIDs con cambios pendientes
  const [cambiosUids, setCambiosUids] = useState(new Set());

  // Vista compacta o expandida
  const [vistaCompacta, setVistaCompacta] = useState(false);
  // Módulo seleccionado para info lateral
  const [moduloInfo, setModuloInfo] = useState(null);
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
        .filter(d => {
          const r = String(d.data().rol || "").toLowerCase();
          return ["nomina","nómina","nominas","nóminas","payroll"].includes(r);
        })
        .map(d => ({
          uid:    d.id,
          email:  d.data().email  || d.data().correo || "",
          nombre: d.data().nombre || d.data().displayName || "",
        }));

      const base = lista.length > 0
        ? lista
        : SEED_USUARIOS.map(s => ({ uid: s.uid, email: s.email, nombre: "" }));

      const conModulos = await Promise.all(
        base.map(async (u) => {
          const snap2 = await getDoc(doc(db, "nomina_permisos_usuario", u.uid));
          const existente = snap2.exists() ? (snap2.data().modulos || {}) : {};
          // Completar módulos no configurados con "ninguno"
          const modulosCompletos = { ...modulosDefault(), ...existente };
          return { ...u, modulos: modulosCompletos };
        })
      );

      setUsuarios(conModulos);
    } catch (e) {
      toast("⚠️ Error: " + e.message, true);
    }
  };

  // ── Cambiar nivel ─────────────────────────────────────────────────────────
  const cambiarNivel = (uid, moduloId, nuevoNivel) => {
    setUsuarios(prev =>
      prev.map(u => {
        if (u.uid !== uid) return u;
        return { ...u, modulos: { ...u.modulos, [moduloId]: nuevoNivel } };
      })
    );
    setCambiosUids(prev => new Set([...prev, uid]));
  };

  // ── Aplicar mismo nivel a todos ────────────────────────────────────────
  const aplicarATodos = (moduloId, nivel) => {
    if (!confirm(`¿Establecer "${NIVEL_BY_ID[nivel].label}" para TODOS los usuarios en el módulo "${MODULOS.find(m=>m.id===moduloId)?.label}"?`)) return;
    setUsuarios(prev =>
      prev.map(u => ({ ...u, modulos: { ...u.modulos, [moduloId]: nivel } }))
    );
    setCambiosUids(new Set(usuarios.map(u => u.uid)));
  };

  // ── Presets por usuario ────────────────────────────────────────────────
  const presetTodo = (uid, nivel) => {
    setUsuarios(prev =>
      prev.map(u => {
        if (u.uid !== uid) return u;
        const modulos = Object.fromEntries(MODULOS.map(m => [m.id, nivel]));
        return { ...u, modulos };
      })
    );
    setCambiosUids(prev => new Set([...prev, uid]));
  };

  // ── Guardar ────────────────────────────────────────────────────────────
  const guardar = async () => {
    setGuardando(true);
    try {
      const batch = writeBatch(db);
      const aGuardar = usuarios.filter(u => cambiosUids.has(u.uid));
      for (const u of aGuardar) {
        const ref = doc(db, "nomina_permisos_usuario", u.uid);
        batch.set(ref, {
          uid:           u.uid,
          email:         u.email,
          nombre:        u.nombre || "",
          modulos:       u.modulos,
          actualizadoEn: new Date(),
        });
      }
      await batch.commit();
      setCambiosUids(new Set());
      toast(`✅ Permisos guardados — ${aGuardar.length} usuario${aGuardar.length !== 1 ? "s" : ""} actualizados`);
    } catch (e) {
      toast("❌ Error al guardar: " + e.message, true);
    }
    setGuardando(false);
  };

  // ── Agregar usuario manualmente ─────────────────────────────────────
  const agregarUsuario = () => {
    const uid   = nuevoUid.trim();
    const email = nuevoEmail.trim().toLowerCase();
    const nombre= nuevoNombre.trim();
    if (!uid)   { setErrAgregar("El UID es obligatorio."); return; }
    if (!email) { setErrAgregar("El email es obligatorio."); return; }
    if (usuarios.some(u => u.uid === uid)) {
      setErrAgregar("Ya existe un usuario con ese UID."); return;
    }
    const nuevoUser = { uid, email, nombre, modulos: modulosDefault() };
    setUsuarios(prev => [...prev, nuevoUser]);
    setCambiosUids(prev => new Set([...prev, uid]));
    setNuevoUid(""); setNuevoEmail(""); setNuevoNombre(""); setErrAgregar("");
    setModalAgregar(false);
    toast(`➕ ${email} agregado — configura sus permisos y guarda`);
  };

  // ── Sembrar datos ─────────────────────────────────────────────────────
  const sembrar = async () => {
    if (!confirm("🌱 Cargar configuración inicial del Excel entregado.\n¿Confirmar?")) return;
    setGuardando(true);
    try {
      const batch = writeBatch(db);
      for (const s of SEED_USUARIOS) {
        const ref = doc(db, "nomina_permisos_usuario", s.uid);
        batch.set(ref, {
          uid:           s.uid,
          email:         s.email,
          nombre:        "",
          modulos:       { ...modulosDefault(), ...s.modulos },
          actualizadoEn: new Date(),
        });
      }
      await batch.commit();
      await cargar();
      toast(`✅ Datos iniciales cargados — ${SEED_USUARIOS.length} usuarios`);
    } catch (e) {
      toast("❌ Error: " + e.message, true);
    }
    setGuardando(false);
  };

  // ── Toast ─────────────────────────────────────────────────────────────
  const toast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 4500);
  };

  // ── Helpers ───────────────────────────────────────────────────────────
  const contarNivel = (u, nivel) => MODULOS.filter(m => u.modulos[m.id] === nivel).length;

  const colorResumen = (u) => {
    const total   = contarNivel(u, "total");
    const limitado= contarNivel(u, "limitado");
    const lectura = contarNivel(u, "lectura");
    const ninguno = MODULOS.length - total - limitado - lectura;
    return { total, limitado, lectura, ninguno };
  };

  if (loading) return (
    <LayoutWithSidebar>
      <div style={{ textAlign: "center", padding: "4rem", color: PRIMARY }}>
        <div style={{ fontSize: "2rem" }}>🔐 Cargando control de roles...</div>
      </div>
    </LayoutWithSidebar>
  );

  return (
    <LayoutWithSidebar>
      <div style={{ maxWidth: "1700px", margin: "0 auto" }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
          <button onClick={() => router.push("/nomina")}
            style={{ background: "none", border: "none", cursor: "pointer", color: PRIMARY, marginTop: "4px" }}>
            <ArrowLeft size={22} />
          </button>
          <div style={{ flex: 1, minWidth: "280px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              <h1 style={{ margin: 0, color: PRIMARY, fontSize: "1.7rem", fontWeight: "800" }}>
                🔐 Control de Roles y Accesos
              </h1>
              <span style={{ background: "#fef2f2", color: DANGER, border: `1.5px solid ${DANGER}30`, borderRadius: "20px", padding: "3px 12px", fontSize: "0.7rem", fontWeight: "800" }}>
                SOLO ADMIN
              </span>
            </div>
            <p style={{ margin: "0.25rem 0 0", color: "#64748b", fontSize: "0.87rem" }}>
              Controla qué páginas puede ver cada usuario y con qué nivel de acceso.
              Los cambios aplican en tiempo real sin que el usuario recargue.
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap", alignItems: "center" }}>
            {/* Toggle vista compacta */}
            <button onClick={() => setVistaCompacta(!vistaCompacta)}
              style={{ background: vistaCompacta ? `${PRIMARY}15` : "#f8fafc", border: `1.5px solid ${vistaCompacta ? PRIMARY : "#e2e8f0"}`, borderRadius: "10px", padding: "0.6rem 1rem", color: vistaCompacta ? PRIMARY : "#64748b", cursor: "pointer", fontWeight: "700", fontSize: "0.82rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <Settings size={14} /> {vistaCompacta ? "Vista normal" : "Vista compacta"}
            </button>
            {/* Agregar usuario */}
            <button onClick={() => { setErrAgregar(""); setModalAgregar(true); }}
              style={{ background: "#f0fdf4", border: `1.5px solid #86efac`, borderRadius: "10px", padding: "0.6rem 1rem", color: "#065f46", cursor: "pointer", fontWeight: "700", fontSize: "0.82rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <UserPlus size={14} /> Agregar usuario
            </button>
            {/* Sembrar */}
            <button onClick={sembrar} disabled={guardando}
              style={{ background: "#fffbeb", border: `1.5px solid ${WARN}`, borderRadius: "10px", padding: "0.6rem 1rem", color: "#92400e", cursor: "pointer", fontWeight: "700", fontSize: "0.82rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
              🌱 Datos iniciales
            </button>
            {/* Badge cambios pendientes */}
            {cambiosUids.size > 0 && (
              <div style={{ background: "#fffbeb", border: "1.5px solid #fcd34d", borderRadius: "10px", padding: "0.5rem 0.85rem", fontSize: "0.8rem", color: "#92400e", fontWeight: "700" }}>
                ⚠️ {cambiosUids.size} sin guardar
              </div>
            )}
            {/* Guardar */}
            <button onClick={guardar} disabled={guardando || cambiosUids.size === 0}
              style={{ background: (guardando || cambiosUids.size === 0) ? "#94a3b8" : PRIMARY, border: "none", borderRadius: "10px", padding: "0.7rem 1.5rem", color: "#fff", cursor: (guardando || cambiosUids.size === 0) ? "not-allowed" : "pointer", fontWeight: "700", fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "0.5rem", opacity: guardando ? 0.8 : 1 }}>
              {guardando
                ? <><RefreshCw size={15} style={{ animation: "spin 1s linear infinite" }} /> Guardando...</>
                : <><Save size={16} /> Guardar cambios</>}
            </button>
          </div>
        </div>

        {/* ── Leyenda de niveles ── */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
          {NIVELES.map(n => {
            const NIcon = n.icon;
            return (
              <div key={n.id} style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: n.bg, border: `1.5px solid ${n.border}`, borderRadius: "8px", padding: "0.35rem 0.75rem", fontSize: "0.75rem", color: n.color, fontWeight: "700" }}>
                <NIcon size={12} /> {n.label}
                <span style={{ fontWeight: "400", color: "#64748b", marginLeft: "2px" }}>— {n.desc.split(".")[0]}</span>
              </div>
            );
          })}
        </div>

        {/* ── Tabla ── */}
        {usuarios.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: "16px", padding: "4rem", textAlign: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.07)", border: "2px dashed #e2e8f0" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>👥</div>
            <div style={{ fontWeight: "800", color: PRIMARY, fontSize: "1.2rem", marginBottom: "0.5rem" }}>Sin usuarios con rol nómina</div>
            <div style={{ color: "#64748b", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
              Usa "Datos iniciales" para cargar la configuración del Excel, o asigna rol <strong>nomina</strong> en Firestore.
            </div>
            <button onClick={sembrar} style={{ background: PRIMARY, border: "none", borderRadius: "10px", padding: "0.85rem 2rem", color: "#fff", cursor: "pointer", fontWeight: "700", fontSize: "1rem" }}>
              🌱 Cargar datos iniciales
            </button>
          </div>
        ) : (
          <div style={{ overflowX: "auto", borderRadius: "16px", boxShadow: "0 2px 12px rgba(0,0,0,0.08)", background: "#fff" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: vistaCompacta ? "900px" : "1300px" }}>

              {/* ── ENCABEZADOS ── */}
              <thead>
                <tr>
                  {/* Celda usuario */}
                  <th style={{
                    padding: "1rem 1.25rem",
                    background: PRIMARY, color: "#fff",
                    textAlign: "left", fontSize: "0.83rem", fontWeight: "800",
                    position: "sticky", left: 0, zIndex: 3,
                    minWidth: "240px",
                    borderRight: "2px solid rgba(255,255,255,0.15)",
                  }}>
                    <Users size={14} style={{ marginRight: "6px" }} />Usuario
                  </th>

                  {/* Celdas por módulo */}
                  {MODULOS.map(m => (
                    <th key={m.id} style={{
                      padding: "0.65rem 0.5rem",
                      background: PRIMARY, color: "#fff",
                      textAlign: "center", fontSize: "0.7rem", fontWeight: "700",
                      minWidth: vistaCompacta ? "88px" : "108px",
                      borderRight: "1px solid rgba(255,255,255,0.08)",
                      verticalAlign: "bottom",
                    }}>
                      <div
                        onClick={() => setModuloInfo(moduloInfo?.id === m.id ? null : m)}
                        style={{ cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}
                        title="Ver descripción de acciones">
                        <span style={{ fontSize: "1.1rem" }}>{m.icon}</span>
                        <span style={{ lineHeight: "1.25", textAlign: "center" }}>{m.label}</span>
                        <Info size={10} style={{ opacity: 0.6 }} />
                      </div>
                      {/* Mini botones "aplicar a todos" */}
                      {!vistaCompacta && (
                        <div style={{ display: "flex", justifyContent: "center", gap: "2px", marginTop: "4px" }}>
                          {NIVELES.map(n => (
                            <button key={n.id}
                              onClick={() => aplicarATodos(m.id, n.id)}
                              title={`Poner "${n.label}" para todos en ${m.label}`}
                              style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "4px", width: "20px", height: "14px", cursor: "pointer", color: "#fff", fontSize: "0.55rem", fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              {n.short}
                            </button>
                          ))}
                        </div>
                      )}
                    </th>
                  ))}

                  {/* Celda resumen */}
                  <th style={{ padding: "0.65rem 0.75rem", background: "#082d6b", color: "#fff", textAlign: "center", fontSize: "0.72rem", fontWeight: "700", minWidth: "120px", verticalAlign: "bottom" }}>
                    Resumen
                  </th>

                  {/* Celda acciones rápidas */}
                  <th style={{ padding: "0.65rem 0.75rem", background: "#082d6b", color: "#fff", textAlign: "center", fontSize: "0.72rem", fontWeight: "700", minWidth: "120px", verticalAlign: "bottom" }}>
                    Preset
                  </th>
                </tr>
              </thead>

              {/* ── FILAS POR USUARIO ── */}
              <tbody>
                {usuarios.map((u, idx) => {
                  const hayPendiente = cambiosUids.has(u.uid);
                  const res = colorResumen(u);
                  const bgFila = hayPendiente ? "#fffbeb" : (idx % 2 === 0 ? "#fff" : "#fafbfc");
                  return (
                    <tr key={u.uid} style={{ background: bgFila, borderBottom: "1px solid #f1f5f9" }}>

                      {/* Celda usuario */}
                      <td style={{
                        padding: "0.75rem 1.25rem",
                        position: "sticky", left: 0,
                        background: bgFila,
                        borderRight: "2px solid #e2e8f0",
                        zIndex: 1,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                          <div style={{ width: "34px", height: "34px", borderRadius: "50%", background: `${PRIMARY}15`, color: PRIMARY, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "800", fontSize: "0.95rem", flexShrink: 0 }}>
                            {(u.email || "?")[0].toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            {u.nombre && (
                              <div style={{ fontWeight: "700", color: "#1e293b", fontSize: "0.85rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {u.nombre}
                              </div>
                            )}
                            <div style={{ color: "#475569", fontSize: "0.75rem", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "200px" }}>
                              {u.email}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", marginTop: "2px" }}>
                              <span style={{ background: "#0ea5e915", color: "#0ea5e9", borderRadius: "5px", padding: "1px 6px", fontSize: "0.64rem", fontWeight: "800" }}>Nómina</span>
                              {hayPendiente && <span style={{ background: "#fffbeb", color: "#92400e", borderRadius: "5px", padding: "1px 6px", fontSize: "0.64rem", fontWeight: "800", border: "1px solid #fcd34d" }}>⚠️ pendiente</span>}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Celdas por módulo */}
                      {MODULOS.map(m => (
                        <td key={m.id} style={{ textAlign: "center", padding: "0.5rem 0.35rem", borderRight: "1px solid #f1f5f9" }}>
                          <NivelSelector
                            valor={u.modulos[m.id] || "ninguno"}
                            onChange={(nv) => cambiarNivel(u.uid, m.id, nv)}
                            modulo={m}
                          />
                        </td>
                      ))}

                      {/* Resumen visual */}
                      <td style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "3px", alignItems: "center" }}>
                          {res.total    > 0 && <div style={{ fontSize: "0.68rem", fontWeight: "800", color: SUCCESS, background: "#f0fdf4", borderRadius: "5px", padding: "2px 7px", width: "90px" }}>✅ {res.total} total</div>}
                          {res.limitado > 0 && <div style={{ fontSize: "0.68rem", fontWeight: "800", color: "#b45309", background: "#fffbeb", borderRadius: "5px", padding: "2px 7px", width: "90px" }}>⚡ {res.limitado} limitado</div>}
                          {res.lectura  > 0 && <div style={{ fontSize: "0.68rem", fontWeight: "800", color: "#475569", background: "#f8fafc", borderRadius: "5px", padding: "2px 7px", width: "90px" }}>👁️ {res.lectura} lectura</div>}
                          {res.ninguno  > 0 && <div style={{ fontSize: "0.68rem", fontWeight: "700", color: "#ef4444", background: "#fef2f2", borderRadius: "5px", padding: "2px 7px", width: "90px" }}>— {res.ninguno} oculto</div>}
                        </div>
                      </td>

                      {/* Preset rápido */}
                      <td style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                          <button onClick={() => presetTodo(u.uid, "total")}
                            style={{ background: "#f0fdf4", border: "1.5px solid #86efac", borderRadius: "6px", padding: "3px 0", color: SUCCESS, cursor: "pointer", fontWeight: "700", fontSize: "0.67rem", width: "100%" }}>
                            ✅ Todo total
                          </button>
                          <button onClick={() => presetTodo(u.uid, "lectura")}
                            style={{ background: "#f8fafc", border: "1.5px solid #cbd5e1", borderRadius: "6px", padding: "3px 0", color: "#64748b", cursor: "pointer", fontWeight: "700", fontSize: "0.67rem", width: "100%" }}>
                            👁️ Todo lectura
                          </button>
                          <button onClick={() => presetTodo(u.uid, "ninguno")}
                            style={{ background: "#fef2f2", border: "1.5px solid #fca5a5", borderRadius: "6px", padding: "3px 0", color: DANGER, cursor: "pointer", fontWeight: "700", fontSize: "0.67rem", width: "100%" }}>
                            — Todo oculto
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Panel lateral de información del módulo ── */}
        {moduloInfo && (
          <div style={{ marginTop: "1.5rem", background: "#fff", borderRadius: "14px", padding: "1.25rem 1.5rem", boxShadow: "0 2px 12px rgba(0,0,0,0.07)", border: `2px solid ${PRIMARY}30` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
              <div style={{ fontWeight: "800", color: PRIMARY, fontSize: "1rem" }}>
                {moduloInfo.icon} {moduloInfo.label} — detalle de accesos
              </div>
              <button onClick={() => setModuloInfo(null)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={18} color="#94a3b8" />
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem" }}>
              {NIVELES.filter(n => n.id !== "ninguno").map(n => {
                const NIcon = n.icon;
                return (
                  <div key={n.id} style={{ background: n.bg, border: `1.5px solid ${n.border}`, borderRadius: "10px", padding: "0.85rem 1rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: "800", color: n.color, marginBottom: "0.4rem", fontSize: "0.88rem" }}>
                      <NIcon size={14} /> {n.label}
                    </div>
                    <div style={{ color: "#475569", fontSize: "0.8rem", lineHeight: "1.5" }}>
                      {moduloInfo.acciones?.[n.id] || n.desc}
                    </div>
                  </div>
                );
              })}
              <div style={{ background: "#fef2f2", border: "1.5px solid #fca5a5", borderRadius: "10px", padding: "0.85rem 1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: "800", color: DANGER, marginBottom: "0.4rem", fontSize: "0.88rem" }}>
                  <EyeOff size={14} /> Sin acceso
                </div>
                <div style={{ color: "#475569", fontSize: "0.8rem", lineHeight: "1.5" }}>
                  La página NO aparece en el menú lateral. Si el usuario intenta acceder por URL directa, es redirigido al dashboard de nómina.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Modal agregar usuario ── */}
        {modalAgregar && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
            onClick={e => { if (e.target === e.currentTarget) setModalAgregar(false); }}>
            <div style={{ background: "#fff", borderRadius: "18px", padding: "2rem", maxWidth: "460px", width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>

              {/* Header modal */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                <div>
                  <div style={{ fontWeight: "800", color: PRIMARY, fontSize: "1.1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <UserPlus size={18} /> Agregar usuario
                  </div>
                  <div style={{ color: "#64748b", fontSize: "0.78rem", marginTop: "2px" }}>Los permisos inician todos en "Sin acceso".</div>
                </div>
                <button onClick={() => setModalAgregar(false)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                  <X size={20} color="#94a3b8" />
                </button>
              </div>

              {/* Campo UID */}
              <label style={{ display: "block", fontWeight: "700", color: "#374151", fontSize: "0.82rem", marginBottom: "0.3rem" }}>
                UID de Firebase Auth <span style={{ color: DANGER }}>*</span>
              </label>
              <input
                autoFocus
                value={nuevoUid}
                onChange={e => { setNuevoUid(e.target.value); setErrAgregar(""); }}
                placeholder="Ej: AbCdEfGhIjKlMnOpQrSt12345678"
                style={{ width: "100%", padding: "0.65rem 0.9rem", border: `1.5px solid ${errAgregar && !nuevoUid.trim() ? DANGER : "#e2e8f0"}`, borderRadius: "10px", fontSize: "0.87rem", outline: "none", boxSizing: "border-box", marginBottom: "0.85rem", fontFamily: "monospace" }}
              />

              {/* Campo Email */}
              <label style={{ display: "block", fontWeight: "700", color: "#374151", fontSize: "0.82rem", marginBottom: "0.3rem" }}>
                Email <span style={{ color: DANGER }}>*</span>
              </label>
              <input
                value={nuevoEmail}
                onChange={e => { setNuevoEmail(e.target.value); setErrAgregar(""); }}
                placeholder="usuario@logisport.com.co"
                style={{ width: "100%", padding: "0.65rem 0.9rem", border: `1.5px solid ${errAgregar && !nuevoEmail.trim() ? DANGER : "#e2e8f0"}`, borderRadius: "10px", fontSize: "0.87rem", outline: "none", boxSizing: "border-box", marginBottom: "0.85rem" }}
              />

              {/* Campo Nombre */}
              <label style={{ display: "block", fontWeight: "700", color: "#374151", fontSize: "0.82rem", marginBottom: "0.3rem" }}>
                Nombre (opcional)
              </label>
              <input
                value={nuevoNombre}
                onChange={e => setNuevoNombre(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") agregarUsuario(); }}
                placeholder="Ej: Juan Pérez"
                style={{ width: "100%", padding: "0.65rem 0.9rem", border: "1.5px solid #e2e8f0", borderRadius: "10px", fontSize: "0.87rem", outline: "none", boxSizing: "border-box", marginBottom: errAgregar ? "0.5rem" : "1.25rem" }}
              />

              {/* Error */}
              {errAgregar && (
                <div style={{ color: DANGER, fontSize: "0.8rem", fontWeight: "600", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <AlertTriangle size={13} /> {errAgregar}
                </div>
              )}

              {/* Nota UID */}
              <div style={{ background: "#f0f9ff", border: "1.5px solid #93c5fd", borderRadius: "10px", padding: "0.75rem 1rem", fontSize: "0.75rem", color: "#1e40af", lineHeight: "1.6", marginBottom: "1.25rem" }}>
                <strong>¿Cómo obtener el UID?</strong> Ve a Firebase Console → Authentication → busca el usuario por email → copia el User UID de la columna correspondiente.
              </div>

              {/* Botones */}
              <div style={{ display: "flex", gap: "0.65rem" }}>
                <button onClick={() => setModalAgregar(false)}
                  style={{ flex: 1, padding: "0.75rem", background: "#f1f5f9", border: "none", borderRadius: "10px", color: "#475569", fontWeight: "700", cursor: "pointer", fontSize: "0.9rem" }}>
                  Cancelar
                </button>
                <button onClick={agregarUsuario}
                  style={{ flex: 2, padding: "0.75rem", background: PRIMARY, border: "none", borderRadius: "10px", color: "#fff", fontWeight: "700", cursor: "pointer", fontSize: "0.9rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                  <UserPlus size={16} /> Agregar usuario
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Nota informativa ── */}
        <div style={{ marginTop: "1.5rem", background: "#f0f9ff", border: "1.5px solid #93c5fd", borderRadius: "12px", padding: "1rem 1.25rem", display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
          <AlertTriangle size={18} color={PRIMARY} style={{ flexShrink: 0, marginTop: "2px" }} />
          <div style={{ fontSize: "0.82rem", color: "#1e40af", lineHeight: "1.7" }}>
            <strong>Importante:</strong> Los usuarios con rol <strong>admin</strong> siempre tienen acceso total y no aparecen en esta tabla.
            Los módulos marcados como <strong>"Sin acceso"</strong> desaparecen del menú lateral del usuario.
            Los cambios se guardan en Firestore y aplican en tiempo real sin que el usuario tenga que recargar la página.
          </div>
        </div>

        {/* ── Toast ── */}
        {toastMsg && (
          <div style={{
            position: "fixed", bottom: "2rem", right: "2rem",
            background: toastMsg.startsWith("❌") ? "#fef2f2" : "#f0fdf4",
            border: `2px solid ${toastMsg.startsWith("❌") ? DANGER : SUCCESS}`,
            borderRadius: "12px", padding: "0.85rem 1.5rem",
            color: toastMsg.startsWith("❌") ? DANGER : "#065f46",
            fontWeight: "700", fontSize: "0.9rem",
            boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
            zIndex: 99999, display: "flex", alignItems: "center", gap: "0.5rem",
            animation: "slideIn 0.3s ease",
          }}>
            {toastMsg}
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes slideIn { from { opacity:0; transform: translateY(20px); } to { opacity:1; transform: translateY(0); } }
      `}</style>
    </LayoutWithSidebar>
  );
}
