// pages/nomina/control-roles.js
// Página de administración de permisos por usuario y módulo.
// ACCESO: solo rol "admin"
// Guarda en Firestore: nomina_permisos_usuario/{uid}

import { useState, useEffect } from "react";
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
  Users, Lock, Unlock, Settings, AlertTriangle, ChevronRight
} from "lucide-react";

const PRIMARY = "#0B3D91";
const SUCCESS = "#10b981";
const DANGER  = "#ef4444";
const WARN    = "#f59e0b";

// ── Definición de módulos ─────────────────────────────────────────────────────
const MODULOS = [
  { id: "trabajadores",     label: "Trabajadores",           icon: "👷", desc: "Agregar, editar, habilitar/deshabilitar trabajadores" },
  { id: "asistencia",       label: "Listado de Asistencia",  icon: "📋", desc: "Gestionar cuadrillas y registrar asistencia" },
  { id: "servicios",        label: "Servicios y Tarifas",    icon: "💼", desc: "Crear y editar servicios y tarifas por cliente" },
  { id: "matriz",           label: "Matriz",                 icon: "📊", desc: "Registrar producción y novedades por trabajador" },
  { id: "liquidar",         label: "Liquidar Nómina",        icon: "💰", desc: "Generar y guardar liquidaciones de nómina" },
  { id: "liquidar_unificada", label: "Liquidación Unificada", icon: "📑", desc: "Liquidación consolidada multi-cuadrilla" },
  { id: "historial",        label: "Historial Nóminas",      icon: "📅", desc: "Consultar y exportar nóminas anteriores" },
  { id: "adelantos",        label: "Adelantos y Restaurante",icon: "🍽️", desc: "Registrar adelantos de salario y comida" },
  { id: "desprendibles",    label: "Desprendibles",          icon: "🖨️", desc: "Generar e imprimir desprendibles de pago" },
  { id: "administrar",      label: "Administrar",            icon: "⚙️", desc: "Catálogos, novedades y configuración del módulo" },
];

// ── Datos iniciales desde el archivo Excel entregado ─────────────────────────
const SEED_USUARIOS = [
  {
    uid:   "mXEwGPXVZWaOYuaIBUUcb1pwKSc2",
    email: "jamoca.0314@hotmail.com",
    permisos: { liquidar_unificada: true, liquidar: true },
  },
  {
    uid:   "t1MZoANNGmeDVEMcRr1vDcEvbms1",
    email: "compras@logisport.com.co",
    permisos: { adelantos: true },
  },
  {
    uid:   "XSa3lSmOWIM7WFXB3r86pGzotpl2",
    email: "liquidacion@logisport.com.co",
    permisos: { matriz: true },
  },
  {
    uid:   "LoTV5hJN0uNcvctBTpXqMG9yXe73",
    email: "facturacion@logisport.com.co",
    permisos: { adelantos: true },
  },
  {
    uid:   "kK27zAYtOAb2Sc7phYtoJUBgH9T2",
    email: "operaciones@logisport.com.co",
    permisos: { liquidar_unificada: true, liquidar: true },
  },
  {
    uid:   "5lxjeobAmwVjF3j3FpupfV6rJit1",
    email: "gerencia@logisport.com.co",
    permisos: {
      liquidar_unificada: true, liquidar: true, trabajadores: true,
      servicios: true, matriz: true, historial: true,
      adelantos: true, desprendibles: true, administrar: true,
    },
  },
  {
    uid:   "Ljp2kDmtXxRUQtVwkEmhEocxdI52",
    email: "asistentedeoperaciones@logisport.com.co",
    permisos: { asistencia: true, trabajadores: true },
  },
  {
    uid:   "KfPNkpE615daPh1dyKKi2knCG152",
    email: "contabilidad@logisport.com.co",
    permisos: { liquidar_unificada: true, liquidar: true },
  },
];

// Construye permiso vacío (todos en false)
function permisosVacios() {
  return Object.fromEntries(MODULOS.map(m => [m.id, false]));
}

// ════════════════════════════════════════════════════════════════════════════
export default function ControlRoles() {
  const router = useRouter();
  const [loading,   setLoading]   = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [sembrado,  setSembrado]  = useState(false);
  const [toastMsg,  setToastMsg]  = useState("");

  // Mapa uid → { email, nombre, permisos }
  const [usuarios,  setUsuarios]  = useState([]);
  // Cambios pendientes: uid → { permisos }
  const [cambios,   setCambios]   = useState({});

  // ── Auth: solo admin ────────────────────────────────────────────────────
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

  // ── Cargar usuarios y permisos ──────────────────────────────────────────
  const cargar = async () => {
    try {
      // 1. Cargar TODOS los usuarios con rol=nomina desde colección "usuarios"
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

      // 2. Si no hay usuarios en Firestore, usar seed como base de display
      const baseUsuarios = lista.length > 0
        ? lista
        : SEED_USUARIOS.map(s => ({ uid: s.uid, email: s.email, nombre: "" }));

      // 3. Cargar permisos existentes
      const conPermisos = await Promise.all(
        baseUsuarios.map(async (u) => {
          const snap2 = await getDoc(doc(db, "nomina_permisos_usuario", u.uid));
          const perms = snap2.exists() ? (snap2.data().permisos || {}) : {};
          // Rellenar con false los módulos que no tenga
          const permisosCompletos = { ...permisosVacios(), ...perms };
          return { ...u, permisos: permisosCompletos };
        })
      );

      setUsuarios(conPermisos);
    } catch (e) {
      console.error("Error cargando usuarios:", e);
      toast("⚠️ Error cargando usuarios: " + e.message, true);
    }
  };

  // ── Toggle de permiso ───────────────────────────────────────────────────
  const togglePermiso = (uid, moduloId) => {
    setUsuarios(prev =>
      prev.map(u => {
        if (u.uid !== uid) return u;
        const nuevoPermiso = !u.permisos[moduloId];
        const nuevosPermisos = { ...u.permisos, [moduloId]: nuevoPermiso };
        // Registrar cambio pendiente
        setCambios(c => ({
          ...c,
          [uid]: { ...(c[uid] || {}), [moduloId]: nuevoPermiso },
        }));
        return { ...u, permisos: nuevosPermisos };
      })
    );
  };

  // ── Guardar todo ────────────────────────────────────────────────────────
  const guardar = async () => {
    setGuardando(true);
    try {
      const batch = writeBatch(db);
      for (const u of usuarios) {
        const ref = doc(db, "nomina_permisos_usuario", u.uid);
        batch.set(ref, {
          uid:          u.uid,
          email:        u.email,
          nombre:       u.nombre || "",
          permisos:     u.permisos,
          actualizadoEn: new Date(),
        }, { merge: false });
      }
      await batch.commit();
      setCambios({});
      toast("✅ Permisos guardados correctamente");
    } catch (e) {
      console.error("Error guardando permisos:", e);
      toast("❌ Error al guardar: " + e.message, true);
    }
    setGuardando(false);
  };

  // ── Sembrar datos iniciales ─────────────────────────────────────────────
  const sembrarDatos = async () => {
    if (!confirm(
      "🌱 SEMBRAR DATOS INICIALES\n\n" +
      "Esto creará/actualizará los permisos en Firestore con la configuración del archivo Excel entregado.\n\n" +
      "¿Confirmar?"
    )) return;

    setGuardando(true);
    try {
      const batch = writeBatch(db);
      for (const s of SEED_USUARIOS) {
        const ref = doc(db, "nomina_permisos_usuario", s.uid);
        batch.set(ref, {
          uid:          s.uid,
          email:        s.email,
          nombre:       "",
          permisos:     { ...permisosVacios(), ...s.permisos },
          actualizadoEn: new Date(),
        }, { merge: false });
      }
      await batch.commit();
      setSembrado(true);
      await cargar();
      toast("✅ Datos iniciales sembrados — " + SEED_USUARIOS.length + " usuarios configurados");
    } catch (e) {
      toast("❌ Error al sembrar: " + e.message, true);
    }
    setGuardando(false);
  };

  // ── Toast ───────────────────────────────────────────────────────────────
  const toast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 4000);
  };

  // ── Contar cambios pendientes ───────────────────────────────────────────
  const numCambios = Object.keys(cambios).length;

  // ── Helpers de UI ───────────────────────────────────────────────────────
  const countPermisos = (u) => MODULOS.filter(m => u.permisos[m.id]).length;

  if (loading) return (
    <LayoutWithSidebar>
      <div style={{ textAlign: "center", padding: "4rem", color: PRIMARY }}>
        <div style={{ fontSize: "2rem" }}>🔐 Cargando control de roles...</div>
      </div>
    </LayoutWithSidebar>
  );

  return (
    <LayoutWithSidebar>
      <div style={{ maxWidth: "1600px", margin: "0 auto" }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem", marginBottom: "1.75rem", flexWrap: "wrap" }}>
          <button onClick={() => router.push("/nomina")}
            style={{ background: "none", border: "none", cursor: "pointer", color: PRIMARY, marginTop: "4px" }}>
            <ArrowLeft size={22} />
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              <h1 style={{ margin: 0, color: PRIMARY, fontSize: "1.7rem", fontWeight: "800" }}>
                🔐 Control de Roles y Accesos
              </h1>
              <span style={{ background: "#fef2f2", color: DANGER, border: `1.5px solid ${DANGER}30`, borderRadius: "20px", padding: "3px 12px", fontSize: "0.72rem", fontWeight: "800", textTransform: "uppercase" }}>
                🔑 Solo Admin
              </span>
            </div>
            <p style={{ margin: "0.25rem 0 0", color: "#64748b", fontSize: "0.9rem" }}>
              Define qué acciones puede realizar cada usuario del módulo Control Operativo. 
              Los usuarios con rol <strong>admin</strong> siempre tienen acceso total.
            </p>
          </div>

          {/* Botones de acción */}
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
            {!sembrado && (
              <button onClick={sembrarDatos} disabled={guardando}
                style={{ background: "#fffbeb", border: `1.5px solid ${WARN}`, borderRadius: "10px", padding: "0.7rem 1.1rem", color: "#92400e", cursor: "pointer", fontWeight: "700", fontSize: "0.88rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                🌱 Sembrar datos iniciales
              </button>
            )}
            {numCambios > 0 && (
              <div style={{ background: "#eff6ff", border: "1.5px solid #93c5fd", borderRadius: "10px", padding: "0.6rem 1rem", fontSize: "0.82rem", color: PRIMARY, fontWeight: "700" }}>
                ⚠️ {numCambios} usuario{numCambios > 1 ? "s" : ""} con cambios sin guardar
              </div>
            )}
            <button onClick={guardar} disabled={guardando}
              style={{ background: guardando ? "#94a3b8" : PRIMARY, border: "none", borderRadius: "10px", padding: "0.75rem 1.5rem", color: "#fff", cursor: guardando ? "not-allowed" : "pointer", fontWeight: "700", fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "0.5rem", opacity: guardando ? 0.8 : 1, transition: "all 0.2s" }}>
              {guardando
                ? <><RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} /> Guardando...</>
                : <><Save size={18} /> Guardar cambios</>}
            </button>
          </div>
        </div>

        {/* ── Leyenda ── */}
        <div style={{ display: "flex", gap: "1rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "#f0fdf4", border: "1.5px solid #86efac", borderRadius: "8px", padding: "0.45rem 0.85rem", fontSize: "0.8rem", color: "#065f46", fontWeight: "700" }}>
            <CheckCircle size={14} /> Control total activado
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: "8px", padding: "0.45rem 0.85rem", fontSize: "0.8rem", color: "#64748b", fontWeight: "600" }}>
            <Lock size={14} /> Solo lectura (sin permiso de edición)
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "#f0f9ff", border: "1.5px solid #93c5fd", borderRadius: "8px", padding: "0.45rem 0.85rem", fontSize: "0.8rem", color: PRIMARY, fontWeight: "600" }}>
            <Shield size={14} /> Todos los usuarios nomina pueden VER todos los módulos — los permisos aquí controlan solo las acciones de edición/creación/borrado
          </div>
        </div>

        {/* ── Tabla principal ── */}
        {usuarios.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: "16px", padding: "4rem", textAlign: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.07)", border: "2px dashed #e2e8f0" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>👥</div>
            <div style={{ fontWeight: "800", color: PRIMARY, fontSize: "1.2rem", marginBottom: "0.5rem" }}>No hay usuarios con rol nómina</div>
            <div style={{ color: "#64748b", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
              Asigna el rol <strong>nomina</strong> a usuarios en la colección <code>usuarios</code> de Firestore,
              o usa el botón "Sembrar datos iniciales" para cargar los usuarios del archivo Excel.
            </div>
            <button onClick={sembrarDatos} disabled={guardando}
              style={{ background: PRIMARY, border: "none", borderRadius: "10px", padding: "0.85rem 2rem", color: "#fff", cursor: "pointer", fontWeight: "700", fontSize: "1rem", display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
              🌱 Sembrar datos iniciales
            </button>
          </div>
        ) : (
          <div style={{ overflowX: "auto", borderRadius: "16px", boxShadow: "0 2px 12px rgba(0,0,0,0.08)", background: "#fff" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "1100px" }}>

              {/* Encabezado de módulos */}
              <thead>
                <tr>
                  {/* Columna usuario */}
                  <th style={{
                    padding: "1rem 1.25rem",
                    background: PRIMARY,
                    color: "#fff",
                    textAlign: "left",
                    fontSize: "0.85rem",
                    fontWeight: "800",
                    position: "sticky",
                    left: 0,
                    zIndex: 2,
                    minWidth: "260px",
                    borderRight: "2px solid rgba(255,255,255,0.2)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <Users size={16} /> Usuario
                    </div>
                  </th>
                  {/* Columna por módulo */}
                  {MODULOS.map(m => (
                    <th key={m.id} style={{
                      padding: "0.75rem 0.5rem",
                      background: PRIMARY,
                      color: "#fff",
                      textAlign: "center",
                      fontSize: "0.75rem",
                      fontWeight: "700",
                      minWidth: "100px",
                      maxWidth: "120px",
                      borderRight: "1px solid rgba(255,255,255,0.1)",
                    }}>
                      <div title={m.desc} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem", cursor: "help" }}>
                        <span style={{ fontSize: "1.2rem" }}>{m.icon}</span>
                        <span style={{ lineHeight: "1.3", textAlign: "center" }}>{m.label}</span>
                      </div>
                    </th>
                  ))}
                  {/* Columna resumen */}
                  <th style={{
                    padding: "0.75rem 1rem",
                    background: "#082d6b",
                    color: "#fff",
                    textAlign: "center",
                    fontSize: "0.78rem",
                    fontWeight: "700",
                    minWidth: "80px",
                  }}>
                    Permisos
                  </th>
                </tr>
              </thead>

              <tbody>
                {usuarios.map((u, idx) => {
                  const total = countPermisos(u);
                  const hayPendiente = !!cambios[u.uid];
                  return (
                    <tr key={u.uid}
                      style={{
                        background: hayPendiente ? "#fffbeb" : (idx % 2 === 0 ? "#fff" : "#fafbfc"),
                        borderBottom: "1px solid #f1f5f9",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={e => { if (!hayPendiente) e.currentTarget.style.background = "#f0f9ff"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = hayPendiente ? "#fffbeb" : (idx % 2 === 0 ? "#fff" : "#fafbfc"); }}>

                      {/* Celda usuario */}
                      <td style={{
                        padding: "1rem 1.25rem",
                        position: "sticky",
                        left: 0,
                        background: hayPendiente ? "#fffbeb" : (idx % 2 === 0 ? "#fff" : "#fafbfc"),
                        borderRight: "2px solid #e2e8f0",
                        zIndex: 1,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                          <div style={{
                            width: "38px", height: "38px", borderRadius: "50%",
                            background: `${PRIMARY}15`, color: PRIMARY,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontWeight: "800", fontSize: "1rem", flexShrink: 0,
                          }}>
                            {(u.email || "?")[0].toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            {u.nombre && (
                              <div style={{ fontWeight: "700", color: "#1e293b", fontSize: "0.88rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {u.nombre}
                              </div>
                            )}
                            <div style={{ color: "#475569", fontSize: "0.8rem", fontFamily: "monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {u.email}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.2rem" }}>
                              <span style={{ background: "#0ea5e915", color: "#0ea5e9", borderRadius: "6px", padding: "1px 7px", fontSize: "0.68rem", fontWeight: "800" }}>
                                📋 Nómina
                              </span>
                              {hayPendiente && (
                                <span style={{ background: "#fffbeb", color: "#92400e", borderRadius: "6px", padding: "1px 7px", fontSize: "0.68rem", fontWeight: "800", border: "1px solid #fcd34d" }}>
                                  ⚠️ sin guardar
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Celdas de permisos por módulo */}
                      {MODULOS.map(m => {
                        const activo = !!u.permisos[m.id];
                        return (
                          <td key={m.id} style={{ textAlign: "center", padding: "0.6rem 0.5rem", borderRight: "1px solid #f1f5f9" }}>
                            <button
                              onClick={() => togglePermiso(u.uid, m.id)}
                              title={activo
                                ? `Quitar acceso de edición a "${m.label}" para ${u.email}`
                                : `Dar acceso de edición a "${m.label}" para ${u.email}`}
                              style={{
                                width: "36px", height: "36px",
                                borderRadius: "8px",
                                border: activo ? `2px solid ${SUCCESS}` : "2px solid #e2e8f0",
                                background: activo ? `${SUCCESS}15` : "#f8fafc",
                                cursor: "pointer",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                margin: "0 auto",
                                transition: "all 0.15s",
                                transform: activo ? "scale(1.05)" : "scale(1)",
                              }}
                            >
                              {activo
                                ? <CheckCircle size={18} color={SUCCESS} />
                                : <Lock size={15} color="#cbd5e1" />}
                            </button>
                          </td>
                        );
                      })}

                      {/* Celda resumen */}
                      <td style={{ textAlign: "center", padding: "0.6rem 1rem" }}>
                        <div style={{
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          width: "44px", height: "44px", borderRadius: "50%",
                          background: total === 0 ? "#f1f5f9"
                            : total === MODULOS.length ? `${SUCCESS}15`
                            : `${PRIMARY}10`,
                          color: total === 0 ? "#94a3b8"
                            : total === MODULOS.length ? SUCCESS
                            : PRIMARY,
                          fontWeight: "800", fontSize: "0.95rem",
                          border: total === 0 ? "2px solid #e2e8f0"
                            : total === MODULOS.length ? `2px solid ${SUCCESS}`
                            : `2px solid ${PRIMARY}40`,
                        }}>
                          {total}/{MODULOS.length}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Información adicional ── */}
        <div style={{ marginTop: "2rem", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1rem" }}>

          {/* Nota sobre el sistema */}
          <div style={{ background: "#fff", borderRadius: "14px", padding: "1.25rem 1.5rem", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", border: "1.5px solid #f1f5f9" }}>
            <div style={{ fontWeight: "800", color: PRIMARY, marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.95rem" }}>
              <Shield size={16} /> Cómo funciona
            </div>
            <ul style={{ margin: 0, paddingLeft: "1.2rem", color: "#475569", fontSize: "0.83rem", lineHeight: "2" }}>
              <li><strong>Todos los usuarios nomina</strong> pueden ver todos los módulos</li>
              <li>Los permisos aquí controlan quién puede <strong>crear, editar o borrar</strong> datos</li>
              <li>Sin permiso, el usuario solo puede <strong>consultar</strong> la información</li>
              <li>Los cambios aplican <strong>en tiempo real</strong> sin recargar el navegador</li>
              <li>El rol <strong>admin</strong> siempre tiene acceso total (no aparece aquí)</li>
            </ul>
          </div>

          {/* Módulos y su descripción */}
          <div style={{ background: "#fff", borderRadius: "14px", padding: "1.25rem 1.5rem", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", border: "1.5px solid #f1f5f9" }}>
            <div style={{ fontWeight: "800", color: PRIMARY, marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.95rem" }}>
              <Settings size={16} /> Descripción de permisos
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              {MODULOS.map(m => (
                <div key={m.id} style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", fontSize: "0.8rem", color: "#475569" }}>
                  <span style={{ flexShrink: 0 }}>{m.icon}</span>
                  <span><strong style={{ color: "#1e293b" }}>{m.label}:</strong> {m.desc}</span>
                </div>
              ))}
            </div>
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
            zIndex: 9999, display: "flex", alignItems: "center", gap: "0.5rem",
            animation: "slideIn 0.3s ease",
          }}>
            {toastMsg}
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideIn { from { opacity:0; transform: translateY(20px); } to { opacity:1; transform: translateY(0); } }
      `}</style>
    </LayoutWithSidebar>
  );
}
