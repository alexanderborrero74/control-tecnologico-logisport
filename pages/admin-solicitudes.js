// pages/admin-solicitudes.js - Panel para ver y limpiar todas las solicitudes
import { useEffect, useState } from "react";
import { db } from "@/firebase/firebaseConfig";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import LayoutWithSidebar from "@/components/LayoutWithSidebar";
import PageHeader from "@/components/PageHeader";
import { Trash2, AlertCircle, CheckCircle } from "lucide-react";

export default function AdminSolicitudes() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState("");

  const cargarSolicitudes = async () => {
    try {
      setLoading(true);
      const snap = await getDocs(collection(db, "solicitudes"));
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setSolicitudes(data);
    } catch (error) {
      console.error("Error cargando solicitudes:", error);
      setMensaje("Error cargando solicitudes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarSolicitudes();
  }, []);

  const eliminarSolicitud = async (id, consecutivo) => {
    if (!confirm(`¿Eliminar solicitud ${consecutivo}? Esta acción no se puede deshacer.`)) return;

    try {
      await deleteDoc(doc(db, "solicitudes", id));
      setMensaje(`✅ Solicitud ${consecutivo} eliminada`);
      cargarSolicitudes();
      setTimeout(() => setMensaje(""), 3000);
    } catch (error) {
      console.error("Error eliminando:", error);
      setMensaje(`❌ Error: ${error.message}`);
    }
  };

  const pendientes = solicitudes.filter((s) => {
    const finalizado = String(s.finalizado || "").toLowerCase().trim();
    return finalizado !== "si" && finalizado !== "sí";
  });

  const finalizadas = solicitudes.filter((s) => {
    const finalizado = String(s.finalizado || "").toLowerCase().trim();
    return finalizado === "si" || finalizado === "sí";
  });

  if (loading) {
    return (
      <LayoutWithSidebar>
        <PageHeader titulo="Admin Solicitudes" />
        <div style={{ padding: "20px", textAlign: "center" }}>
          <p>Cargando...</p>
        </div>
      </LayoutWithSidebar>
    );
  }

  return (
    <LayoutWithSidebar>
      <PageHeader titulo="Administración de Solicitudes" subtitulo="Ver y gestionar todas las solicitudes del sistema" />
      
      <div style={{ padding: "20px", maxWidth: "1400px", margin: "0 auto" }}>
        {/* Resumen */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
          marginBottom: "32px"
        }}>
          <div style={{
            background: "#fef3c7",
            border: "2px solid #f59e0b",
            borderRadius: "12px",
            padding: "20px",
            textAlign: "center"
          }}>
            <AlertCircle size={32} style={{ color: "#f59e0b", margin: "0 auto 12px" }} />
            <div style={{ fontSize: "32px", fontWeight: "800", color: "#92400e" }}>
              {pendientes.length}
            </div>
            <div style={{ color: "#78350f", fontWeight: "600" }}>Pendientes</div>
          </div>

          <div style={{
            background: "#d1fae5",
            border: "2px solid #10b981",
            borderRadius: "12px",
            padding: "20px",
            textAlign: "center"
          }}>
            <CheckCircle size={32} style={{ color: "#10b981", margin: "0 auto 12px" }} />
            <div style={{ fontSize: "32px", fontWeight: "800", color: "#065f46" }}>
              {finalizadas.length}
            </div>
            <div style={{ color: "#047857", fontWeight: "600" }}>Finalizadas</div>
          </div>

          <div style={{
            background: "#e0f2fe",
            border: "2px solid #0284c7",
            borderRadius: "12px",
            padding: "20px",
            textAlign: "center"
          }}>
            <div style={{ fontSize: "32px", fontWeight: "800", color: "#075985" }}>
              {solicitudes.length}
            </div>
            <div style={{ color: "#0369a1", fontWeight: "600" }}>Total</div>
          </div>
        </div>

        {mensaje && (
          <div style={{
            padding: "12px 16px",
            background: mensaje.includes("❌") ? "#fee2e2" : "#d1fae5",
            border: `2px solid ${mensaje.includes("❌") ? "#ef4444" : "#10b981"}`,
            borderRadius: "8px",
            marginBottom: "20px",
            fontWeight: "600",
            color: mensaje.includes("❌") ? "#991b1b" : "#065f46"
          }}>
            {mensaje}
          </div>
        )}

        {/* Tabla de solicitudes */}
        <div style={{
          background: "white",
          border: "1px solid #e5e7eb",
          borderRadius: "12px",
          overflow: "auto",
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          maxHeight: "calc(100vh - 400px)"
        }}>
          <table style={{ width: "100%", minWidth: "1200px", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
                <th style={styles.th}>Consecutivo</th>
                <th style={styles.th}>Código</th>
                <th style={styles.th}>Nombre</th>
                <th style={styles.th}>Correo</th>
                <th style={styles.th}>Descripción</th>
                <th style={styles.th}>Fecha</th>
                <th style={styles.th}>Finalizado</th>
                <th style={styles.th}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {solicitudes.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>
                    No hay solicitudes registradas
                  </td>
                </tr>
              ) : (
                solicitudes.map((sol) => {
                  const esPendiente = !["si", "sí"].includes(String(sol.finalizado || "").toLowerCase().trim());
                  return (
                    <tr key={sol.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={styles.td}>
                        <span style={{
                          background: esPendiente ? "#fef3c7" : "#d1fae5",
                          color: esPendiente ? "#92400e" : "#065f46",
                          padding: "4px 12px",
                          borderRadius: "6px",
                          fontWeight: "700",
                          fontSize: "14px"
                        }}>
                          {sol.consecutivo || "—"}
                        </span>
                      </td>
                      <td style={styles.td}>{sol.codigo || "—"}</td>
                      <td style={styles.td}>{sol.nombre || "—"}</td>
                      <td style={styles.td}>{sol.correo || "—"}</td>
                      <td style={styles.td}>
                        <div style={{ maxWidth: "300px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {sol.descripcion || "—"}
                        </div>
                      </td>
                      <td style={styles.td}>
                        {sol.fecha ? new Date(sol.fecha).toLocaleDateString() : "—"}
                      </td>
                      <td style={styles.td}>
                        <span style={{
                          background: esPendiente ? "#fee2e2" : "#d1fae5",
                          color: esPendiente ? "#991b1b" : "#065f46",
                          padding: "4px 8px",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: "700"
                        }}>
                          {esPendiente ? "NO" : "SÍ"}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <button
                          onClick={() => eliminarSolicitud(sol.id, sol.consecutivo)}
                          style={{
                            background: "#ef4444",
                            color: "white",
                            border: "none",
                            padding: "8px 16px",
                            borderRadius: "8px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            fontWeight: "600",
                            fontSize: "14px"
                          }}
                          onMouseEnter={(e) => e.target.style.background = "#dc2626"}
                          onMouseLeave={(e) => e.target.style.background = "#ef4444"}
                        >
                          <Trash2 size={16} />
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </LayoutWithSidebar>
  );
}

const styles = {
  th: {
    padding: "12px 16px",
    textAlign: "left",
    fontSize: "13px",
    fontWeight: "700",
    color: "#374151",
    textTransform: "uppercase",
    letterSpacing: "0.5px"
  },
  td: {
    padding: "16px",
    fontSize: "14px",
    color: "#1f2937"
  }
};
