// pages/claves-usuarios.js — LOGISPORT — Trazabilidad de claves (solo admin)
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { db } from "@/firebase/firebaseConfig";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { getUserRoleByUid } from "@/utils/getUserRole";
import LayoutWithSidebar from "@/components/LayoutWithSidebar";
import PageHeader from "@/components/PageHeader";

const EVENTOS = {
  creacion:         { label: "Creación",           color: "#2563eb", bg: "#dbeafe" },
  cambio_usuario:   { label: "Cambio por usuario",  color: "#059669", bg: "#d1fae5" },
  renovacion_admin: { label: "Renovación admin",    color: "#7c3aed", bg: "#ede9fe" },
};

function diasRestantes(fechaCaducidad) {
  if (!fechaCaducidad) return null;
  return Math.round((new Date(fechaCaducidad) - new Date()) / (1000 * 60 * 60 * 24));
}

export default function ClavesUsuarios() {
  const router = useRouter();
  const [historial, setHistorial]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [filtro, setFiltro]         = useState("");
  const [filtroEvento, setFiltroEvento] = useState("todos");

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.replace("/login"); return; }
      const rol = await getUserRoleByUid(u.uid).catch(() => "usuario");
      if (rol !== "admin") { router.replace("/"); return; }
      cargarHistorial();
    });
    return () => unsub();
  }, [router]);

  const cargarHistorial = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, "historialClaves"), orderBy("creadoEn", "desc"));
      const snap = await getDocs(q);
      setHistorial(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const filtrados = historial.filter(r => {
    const texto = [r.nombre, r.email, r.cargo].join(" ").toLowerCase();
    return (filtro === "" || texto.includes(filtro.toLowerCase()))
      && (filtroEvento === "todos" || r.evento === filtroEvento);
  });

  const resumen = Object.values(historial.reduce((acc, r) => {
    const key = r.email || r.usuarioId;
    if (!acc[key]) acc[key] = { nombre: r.nombre, email: r.email, cargo: r.cargo, registros: [] };
    acc[key].registros.push(r);
    return acc;
  }, {}));

  return (
    <LayoutWithSidebar>
      <PageHeader titulo="Trazabilidad de Claves" />
      <div style={{ fontFamily: "Arial, sans-serif" }}>

        {/* Tarjetas resumen */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12, marginBottom: 24 }}>
          {resumen.map((u, i) => {
            const ultimo = u.registros[0];
            const dias = diasRestantes(ultimo?.fechaCaducidad);
            return (
              <div key={i} style={{ background: "white", borderRadius: 10, padding: 14, border: "1px solid #e5e7eb", borderLeft: `4px solid ${dias !== null && dias <= 0 ? "#dc2626" : dias !== null && dias <= 7 ? "#f59e0b" : "#10b981"}`, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <div style={{ fontWeight: 700, color: "#1f2937" }}>{u.nombre}</div>
                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>{u.email}</div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: "#6b7280" }}>Cambios: <strong>{u.registros.length}</strong></span>
                  {dias !== null && (
                    <span style={{ padding: "2px 8px", borderRadius: 6, fontWeight: 700, fontSize: 11, background: dias <= 0 ? "#fee2e2" : dias <= 7 ? "#fef3c7" : "#d1fae5", color: dias <= 0 ? "#991b1b" : dias <= 7 ? "#78350f" : "#065f46" }}>
                      {dias <= 0 ? "⚠ Vencida" : `Vence en ${dias}d`}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Filtros */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <input type="text" placeholder="🔍 Buscar por nombre, correo o cargo..." value={filtro} onChange={e => setFiltro(e.target.value)}
            style={{ flex: 1, minWidth: 200, padding: "9px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, outline: "none" }} />
          <select value={filtroEvento} onChange={e => setFiltroEvento(e.target.value)}
            style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, outline: "none", background: "white" }}>
            <option value="todos">Todos los eventos</option>
            <option value="creacion">Creación</option>
            <option value="cambio_usuario">Cambio por usuario</option>
            <option value="renovacion_admin">Renovación admin</option>
          </select>
          <button onClick={cargarHistorial} style={{ padding: "9px 16px", borderRadius: 8, background: "#0B3D91", color: "white", border: "none", fontWeight: 600, cursor: "pointer", fontSize: 14 }}>
            🔄 Actualizar
          </button>
        </div>

        {/* Tabla */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>Cargando historial...</div>
        ) : filtrados.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>No hay registros.</div>
        ) : (
          <div style={{ background: "white", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "auto", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {["Usuario", "Correo", "Cargo", "Evento", "Fecha creación clave", "Fecha caducidad", "Días", "Duración"].map(h => (
                    <th key={h} style={{ padding: "11px 14px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#6b7280", borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.map((r, i) => {
                  const ev = EVENTOS[r.evento] || { label: r.evento, color: "#6b7280", bg: "#f3f4f6" };
                  const dias = diasRestantes(r.fechaCaducidad);
                  const esUltimo = historial.findIndex(x => x.email === r.email) === historial.indexOf(r);
                  return (
                    <tr key={r.id} style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? "white" : "#fafafa" }}>
                      <td style={{ padding: "10px 14px", fontSize: 14, fontWeight: 600, color: "#1f2937" }}>
                        {r.nombre}
                        {esUltimo && <span style={{ marginLeft: 6, fontSize: 10, background: "#dbeafe", color: "#1e40af", padding: "1px 5px", borderRadius: 4, fontWeight: 700 }}>ACTUAL</span>}
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 13, color: "#6b7280" }}>{r.email || "—"}</td>
                      <td style={{ padding: "10px 14px", fontSize: 13, color: "#6b7280" }}>{r.cargo || "—"}</td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700, background: ev.bg, color: ev.color }}>{ev.label}</span>
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 13, color: "#374151", whiteSpace: "nowrap" }}>
                        {r.fechaCreacion ? new Date(r.fechaCreacion).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" }) : "—"}
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 13, color: "#374151", whiteSpace: "nowrap" }}>
                        {r.fechaCaducidad ? new Date(r.fechaCaducidad).toLocaleDateString("es-CO") : "—"}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        {dias !== null ? (
                          <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 12, fontWeight: 700, background: dias <= 0 ? "#fee2e2" : dias <= 7 ? "#fef3c7" : "#d1fae5", color: dias <= 0 ? "#991b1b" : dias <= 7 ? "#78350f" : "#065f46" }}>
                            {dias <= 0 ? "Vencida" : `${dias}d`}
                          </span>
                        ) : "—"}
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 13, color: "#6b7280" }}>{r.diasCaducidad ? `${r.diasCaducidad} días` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: 14, fontSize: 13, color: "#9ca3af", textAlign: "center" }}>
          {filtrados.length} registro{filtrados.length !== 1 ? "s" : ""} · Solo visible para administradores
        </div>
      </div>
    </LayoutWithSidebar>
  );
}
