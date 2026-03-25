// pages/nomina/cuadrillas.js
// Vista de Cuadrillas: muestra trabajadores agrupados por cuadrilla,
// permite reasignar trabajadores y ver resumen de producción por cuadrilla

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  collection, getDocs, updateDoc, doc, query, orderBy, where
} from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";
import { getUserRoleByUid } from "@/utils/getUserRole";
import LayoutWithSidebar from "@/components/LayoutWithSidebar";
import { formatCOP } from "@/utils/nominaCalculos";
import {
  ArrowLeft, Users, TrendingUp, Edit2, Save, X,
  ChevronDown, ChevronRight, RefreshCw, Calendar
} from "lucide-react";

const PRIMARY = "#0B3D91";
const ACCENT = "#00AEEF";

const CUADRILLAS_LISTA = ["1", "2", "3", "4", "5", "6", "ADM", "ADM-OPE", "CIAMSA", "OM", "AX"];

const COLORES_CUADRILLA = {
  "1": "#3b82f6",
  "2": "#10b981",
  "3": "#f59e0b",
  "4": "#8b5cf6",
  "5": "#ef4444",
  "6": "#06b6d4",
  "ADM": "#6366f1",
  "ADM-OPE": "#ec4899",
  "CIAMSA": "#84cc16",
  "OM": "#f97316",
  "AX": "#14b8a6",
};

function generarQuincenas() {
  const q = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    q.push({
      id: `${y}-${String(m + 1).padStart(2, "0")}-Q1`,
      label: `1-15 ${["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][m]} ${y}`,
    });
    q.push({
      id: `${y}-${String(m + 1).padStart(2, "0")}-Q2`,
      label: `16-${new Date(y, m + 1, 0).getDate()} ${["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][m]} ${y}`,
    });
  }
  return q;
}

const QUINCENAS = generarQuincenas();

export default function NominaCuadrillas() {
  const router = useRouter();
  const [rol, setRol] = useState(null);
  const [loading, setLoading] = useState(true);
  const [trabajadores, setTrabajadores] = useState([]);
  const [operaciones, setOperaciones] = useState([]);
  const [quincena, setQuincena] = useState(QUINCENAS[0].id);
  const [cargandoOps, setCargandoOps] = useState(false);
  const [expandidas, setExpandidas] = useState({});
  const [editandoTrabajador, setEditandoTrabajador] = useState(null);
  const [nuevaCuadrilla, setNuevaCuadrilla] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/login"); return; }
      const r = await getUserRoleByUid(user.uid);
      setRol(r);
      if (!["admin", "admin_nomina", "rrhh"].includes(r)) {
        router.push("/nomina"); return;
      }
      await cargarTrabajadores();
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!loading) cargarOperaciones();
  }, [quincena, loading]);

  const cargarTrabajadores = async () => {
    const snap = await getDocs(query(collection(db, "nomina_trabajadores"), orderBy("nombre")));
    setTrabajadores(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const cargarOperaciones = async () => {
    setCargandoOps(true);
    try {
      const snap = await getDocs(query(
        collection(db, "nomina_operaciones"),
        where("quincenaId", "==", quincena)
      ));
      setOperaciones(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      setOperaciones([]);
    } finally {
      setCargandoOps(false);
    }
  };

  // Agrupar trabajadores por cuadrilla
  const porCuadrilla = {};
  CUADRILLAS_LISTA.forEach(c => { porCuadrilla[c] = []; });
  porCuadrilla["Sin cuadrilla"] = [];

  trabajadores.forEach(t => {
    const c = t.cuadrilla?.trim() || "";
    if (porCuadrilla[c] !== undefined) {
      porCuadrilla[c].push(t);
    } else {
      porCuadrilla["Sin cuadrilla"].push(t);
    }
  });

  // Producción por cuadrilla en el período
  const produccionPorCuadrilla = {};
  operaciones.forEach(op => {
    const trabajador = trabajadores.find(t => t.cedula === op.trabajadorCedula);
    const cuad = op.cuadrilla || trabajador?.cuadrilla || "Sin cuadrilla";
    if (!produccionPorCuadrilla[cuad]) produccionPorCuadrilla[cuad] = 0;
    produccionPorCuadrilla[cuad] += op.netoAPagar || 0;
  });

  const toggleCuadrilla = (nombre) => {
    setExpandidas(prev => ({ ...prev, [nombre]: !prev[nombre] }));
  };

  const abrirCambiarCuadrilla = (trabajador) => {
    setEditandoTrabajador(trabajador);
    setNuevaCuadrilla(trabajador.cuadrilla || "");
  };

  const guardarCambio = async () => {
    if (!editandoTrabajador) return;
    setGuardando(true);
    try {
      await updateDoc(doc(db, "nomina_trabajadores", editandoTrabajador.id), {
        cuadrilla: nuevaCuadrilla,
        actualizadoEn: new Date(),
      });
      await cargarTrabajadores();
      setEditandoTrabajador(null);
    } catch (e) {
      alert("Error: " + e.message);
    }
    setGuardando(false);
  };

  // Totales generales
  const totalTrabajadores = trabajadores.length;
  const totalProduccion = operaciones.reduce((s, op) => s + (op.netoAPagar || 0), 0);
  const cuadrillasConTrabajadores = CUADRILLAS_LISTA.filter(c => porCuadrilla[c]?.length > 0);

  if (loading) return (
    <LayoutWithSidebar>
      <div style={{ textAlign: "center", padding: "4rem", color: PRIMARY }}>
        <div style={{ fontSize: "2rem" }}>👥 Cargando cuadrillas...</div>
      </div>
    </LayoutWithSidebar>
  );

  return (
    <LayoutWithSidebar>
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
          <button onClick={() => router.push("/nomina")}
            style={{ background: "none", border: "none", cursor: "pointer", color: PRIMARY }}>
            <ArrowLeft size={22} />
          </button>
          <div style={{ flex: 1, minWidth: "200px" }}>
            <h1 style={{ margin: 0, color: PRIMARY, fontSize: "1.6rem", fontWeight: "800" }}>
              👥 Cuadrillas
            </h1>
            <p style={{ margin: 0, color: "#64748b", fontSize: "0.9rem" }}>
              {cuadrillasConTrabajadores.length} cuadrillas activas — {totalTrabajadores} trabajadores
            </p>
          </div>
        </div>

        {/* Filtro quincena + stats */}
        <div style={{
          background: "#fff", borderRadius: "12px", padding: "1rem 1.25rem",
          marginBottom: "1.25rem", boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center",
        }}>
          <Calendar size={18} color="#94a3b8" />
          <select
            value={quincena}
            onChange={e => setQuincena(e.target.value)}
            style={{
              border: "1.5px solid #e2e8f0", borderRadius: "8px",
              padding: "0.5rem 0.8rem", fontSize: "0.9rem", outline: "none", flex: "1 1 240px",
            }}
          >
            {QUINCENAS.map(q => <option key={q.id} value={q.id}>{q.label}</option>)}
          </select>

          <button onClick={cargarOperaciones} disabled={cargandoOps} style={{
            background: "#f1f5f9", border: "none", borderRadius: "8px",
            padding: "0.5rem 0.8rem", cursor: "pointer",
            display: "flex", alignItems: "center", gap: "0.4rem",
            color: "#475569", fontSize: "0.88rem",
          }}>
            <RefreshCw size={15} style={{ animation: cargandoOps ? "spin 1s linear infinite" : "none" }} />
            Actualizar
          </button>

          <div style={{ marginLeft: "auto", display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: "800", color: "#10b981", fontSize: "1.1rem" }}>
                {formatCOP(totalProduccion)}
              </div>
              <div style={{ color: "#64748b", fontSize: "0.78rem" }}>producción total período</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: "800", color: PRIMARY, fontSize: "1.1rem" }}>
                {operaciones.length}
              </div>
              <div style={{ color: "#64748b", fontSize: "0.78rem" }}>operaciones registradas</div>
            </div>
          </div>
        </div>

        {/* Resumen de cuadrillas — tarjetas */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gap: "0.75rem",
          marginBottom: "1.5rem",
        }}>
          {CUADRILLAS_LISTA.map(nombre => {
            const trabjs = porCuadrilla[nombre] || [];
            const prod = produccionPorCuadrilla[nombre] || 0;
            const color = COLORES_CUADRILLA[nombre] || "#64748b";
            if (trabjs.length === 0) return null;
            return (
              <div
                key={nombre}
                onClick={() => {
                  toggleCuadrilla(nombre);
                  const el = document.getElementById(`cuadrilla-${nombre}`);
                  if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
                }}
                style={{
                  background: "#fff", borderRadius: "10px", padding: "0.9rem",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)", cursor: "pointer",
                  borderLeft: `4px solid ${color}`,
                  transition: "transform 0.15s, box-shadow 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.10)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)"; }}
              >
                <div style={{ fontWeight: "800", color, fontSize: "1rem", marginBottom: "0.15rem" }}>
                  Cuadrilla {nombre}
                </div>
                <div style={{ fontSize: "0.78rem", color: "#64748b" }}>
                  <span style={{ fontWeight: "700", color: "#374151" }}>{trabjs.length}</span> trabajadores
                </div>
                {prod > 0 && (
                  <div style={{ fontSize: "0.75rem", color: "#10b981", fontWeight: "700", marginTop: "0.2rem" }}>
                    {formatCOP(prod)}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Detalle por cuadrilla */}
        {CUADRILLAS_LISTA.map(nombre => {
          const trabjs = porCuadrilla[nombre] || [];
          if (trabjs.length === 0) return null;
          const prod = produccionPorCuadrilla[nombre] || 0;
          const color = COLORES_CUADRILLA[nombre] || "#64748b";
          const abierta = expandidas[nombre] !== false; // por defecto abierto

          return (
            <div
              key={nombre}
              id={`cuadrilla-${nombre}`}
              style={{
                background: "#fff", borderRadius: "12px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                marginBottom: "1rem", overflow: "hidden",
              }}
            >
              {/* Header cuadrilla */}
              <div
                onClick={() => toggleCuadrilla(nombre)}
                style={{
                  display: "flex", alignItems: "center", gap: "1rem",
                  padding: "1rem 1.25rem", cursor: "pointer",
                  borderLeft: `5px solid ${color}`,
                  background: abierta ? "#fafafa" : "#fff",
                  transition: "background 0.15s",
                }}
              >
                <div style={{
                  width: "40px", height: "40px", borderRadius: "10px",
                  background: `${color}18`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <Users size={20} color={color} />
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: "800", color: PRIMARY, fontSize: "1rem" }}>
                    Cuadrilla {nombre}
                  </div>
                  <div style={{ color: "#64748b", fontSize: "0.83rem" }}>
                    {trabjs.length} trabajador{trabjs.length !== 1 ? "es" : ""}
                  </div>
                </div>

                {prod > 0 && (
                  <div style={{ textAlign: "right", marginRight: "0.5rem" }}>
                    <div style={{ fontWeight: "800", color: "#10b981", fontSize: "0.95rem" }}>
                      {formatCOP(prod)}
                    </div>
                    <div style={{ color: "#64748b", fontSize: "0.75rem" }}>producción período</div>
                  </div>
                )}

                {abierta ? <ChevronDown size={18} color="#94a3b8" /> : <ChevronRight size={18} color="#94a3b8" />}
              </div>

              {/* Lista de trabajadores */}
              {abierta && (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                        {["#", "Nombre", "Cédula", "Cargo", "Producción período", ...(["admin", "admin_nomina"].includes(rol) ? ["Mover"] : [])].map(h => (
                          <th key={h} style={{
                            padding: "0.65rem 1rem", textAlign: "left",
                            fontSize: "0.78rem", fontWeight: "700",
                            color: "#64748b", whiteSpace: "nowrap",
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {trabjs.map((t, i) => {
                        const prodTrabajador = operaciones
                          .filter(op => op.trabajadorCedula === t.cedula)
                          .reduce((s, op) => s + (op.netoAPagar || 0), 0);
                        return (
                          <tr key={t.id}
                            style={{ borderBottom: "1px solid #f1f5f9", transition: "background 0.1s" }}
                            onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                          >
                            <td style={{ padding: "0.75rem 1rem", color: "#94a3b8", fontSize: "0.82rem" }}>{i + 1}</td>
                            <td style={{ padding: "0.75rem 1rem", fontWeight: "600", color: "#1e293b", fontSize: "0.9rem", whiteSpace: "nowrap" }}>
                              {t.nombre}
                            </td>
                            <td style={{ padding: "0.75rem 1rem", color: "#475569", fontFamily: "monospace", fontSize: "0.82rem" }}>
                              {t.cedula}
                            </td>
                            <td style={{ padding: "0.75rem 1rem" }}>
                              <span style={{
                                background: "#f0f9ff", color: ACCENT,
                                borderRadius: "5px", padding: "2px 7px",
                                fontSize: "0.75rem", fontWeight: "600",
                              }}>
                                {t.cargo || "—"}
                              </span>
                            </td>
                            <td style={{ padding: "0.75rem 1rem", fontWeight: "700", color: prodTrabajador > 0 ? "#10b981" : "#94a3b8", fontFamily: "monospace", fontSize: "0.85rem" }}>
                              {prodTrabajador > 0 ? formatCOP(prodTrabajador) : "—"}
                            </td>
                            {["admin", "admin_nomina"].includes(rol) && (
                              <td style={{ padding: "0.75rem 1rem" }}>
                                <button
                                  onClick={() => abrirCambiarCuadrilla(t)}
                                  style={{
                                    background: "#f0f9ff", border: "none", borderRadius: "6px",
                                    padding: "0.3rem 0.55rem", cursor: "pointer", color: ACCENT,
                                    display: "flex", alignItems: "center", gap: "0.3rem",
                                    fontSize: "0.78rem", fontWeight: "600",
                                  }}
                                >
                                  <Edit2 size={12} /> Cambiar
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}

        {/* Trabajadores sin cuadrilla */}
        {porCuadrilla["Sin cuadrilla"]?.length > 0 && (
          <div style={{
            background: "#fff", borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            marginBottom: "1rem", overflow: "hidden",
            borderLeft: "5px solid #94a3b8",
          }}>
            <div style={{ padding: "1rem 1.25rem", background: "#fafafa" }}>
              <div style={{ fontWeight: "700", color: "#64748b" }}>
                Sin cuadrilla asignada ({porCuadrilla["Sin cuadrilla"].length})
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  {porCuadrilla["Sin cuadrilla"].map((t, i) => (
                    <tr key={t.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "0.75rem 1rem", color: "#94a3b8", fontSize: "0.82rem", width: "50px" }}>{i + 1}</td>
                      <td style={{ padding: "0.75rem 1rem", fontWeight: "600", color: "#1e293b" }}>{t.nombre}</td>
                      <td style={{ padding: "0.75rem 1rem", color: "#475569", fontFamily: "monospace" }}>{t.cedula}</td>
                      {["admin", "admin_nomina"].includes(rol) && (
                        <td style={{ padding: "0.75rem 1rem" }}>
                          <button onClick={() => abrirCambiarCuadrilla(t)} style={{
                            background: "#f0f9ff", border: "none", borderRadius: "6px",
                            padding: "0.3rem 0.55rem", cursor: "pointer", color: ACCENT,
                            display: "flex", alignItems: "center", gap: "0.3rem",
                            fontSize: "0.78rem", fontWeight: "600",
                          }}>
                            <Edit2 size={12} /> Asignar cuadrilla
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal cambiar cuadrilla */}
      {editandoTrabajador && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
            zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center",
          }}
          onClick={e => { if (e.target === e.currentTarget) setEditandoTrabajador(null); }}
        >
          <div style={{
            background: "#fff", borderRadius: "16px", padding: "2rem",
            width: "100%", maxWidth: "420px", boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <h2 style={{ margin: 0, color: PRIMARY, fontWeight: "800", fontSize: "1.2rem" }}>
                Cambiar cuadrilla
              </h2>
              <button onClick={() => setEditandoTrabajador(null)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={20} color="#94a3b8" />
              </button>
            </div>

            <div style={{
              background: "#f8fafc", borderRadius: "8px", padding: "0.75rem 1rem",
              marginBottom: "1.25rem",
            }}>
              <div style={{ fontWeight: "700", color: "#1e293b" }}>{editandoTrabajador.nombre}</div>
              <div style={{ color: "#64748b", fontSize: "0.85rem" }}>{editandoTrabajador.cedula}</div>
            </div>

            <label style={{ display: "block", fontWeight: "600", color: "#374151", marginBottom: "0.4rem", fontSize: "0.88rem" }}>
              Nueva cuadrilla
            </label>
            <select
              value={nuevaCuadrilla}
              onChange={e => setNuevaCuadrilla(e.target.value)}
              style={{
                width: "100%", padding: "0.7rem 0.9rem",
                border: "1.5px solid #e2e8f0", borderRadius: "8px",
                fontSize: "0.95rem", outline: "none", marginBottom: "1.5rem",
              }}
            >
              <option value="">(Sin cuadrilla)</option>
              {CUADRILLAS_LISTA.map(c => (
                <option key={c} value={c}>Cuadrilla {c}</option>
              ))}
            </select>

            <button
              onClick={guardarCambio}
              disabled={guardando}
              style={{
                width: "100%", padding: "0.85rem", background: PRIMARY,
                border: "none", borderRadius: "10px", color: "#fff",
                fontWeight: "700", fontSize: "0.95rem",
                cursor: guardando ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                opacity: guardando ? 0.7 : 1,
              }}
            >
              <Save size={17} /> {guardando ? "Guardando..." : "Guardar cambio"}
            </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </LayoutWithSidebar>
  );
}
