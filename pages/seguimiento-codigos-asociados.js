// pages/seguimiento-codigos-asociados.js
import { useRouter } from "next/router";
import { useEffect, useState, useMemo } from "react";
import { db } from "@/firebase/firebaseConfig";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import LayoutWithSidebar from "@/components/LayoutWithSidebar";
import PageHeader from "@/components/PageHeader";

export default function SeguimientoCodigosAsociados() {
  const router = useRouter();
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroTexto, setFiltroTexto] = useState("");
  const [mensaje, setMensaje] = useState("");

  // Cargar solicitudes
  useEffect(() => {
    const cargarSolicitudes = async () => {
      try {
        setLoading(true);
        const snapshot = await getDocs(
          query(collection(db, "solicitudes"), orderBy("consecutivo", "desc"))
        );
        const datos = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setSolicitudes(datos);
        setMensaje(`✅ ${datos.length} solicitudes cargadas correctamente`);
        setTimeout(() => setMensaje(""), 3000);
      } catch (error) {
        console.error("Error cargando solicitudes:", error);
        setMensaje("❌ Error al cargar las solicitudes");
      } finally {
        setLoading(false);
      }
    };

    cargarSolicitudes();
  }, []);

  // Filtrado
  const solicitudesFiltradas = useMemo(() => {
    const term = filtroTexto.trim().toLowerCase();
    if (!term) return solicitudes;

    return solicitudes.filter(
      (s) =>
        (s.consecutivo || "").toString().toLowerCase().includes(term) ||
        (s.codigo || "").toString().toLowerCase().includes(term) ||
        (s.usuario || "").toString().toLowerCase().includes(term) ||
        (s.nombre || "").toString().toLowerCase().includes(term) ||
        (s.correo || "").toString().toLowerCase().includes(term)
    );
  }, [solicitudes, filtroTexto]);

  // Copiar al portapapeles
  const copiarAlPortapapeles = (texto) => {
    navigator.clipboard.writeText(texto).then(
      () => {
        setMensaje(`✅ Copiado: ${texto}`);
        setTimeout(() => setMensaje(""), 2000);
      },
      () => {
        setMensaje("❌ No se pudo copiar");
        setTimeout(() => setMensaje(""), 2000);
      }
    );
  };

  // Exportar a CSV
  const exportarCSV = () => {
    const headers = ["Consecutivo", "Código", "Usuario", "Correo", "Fecha", "Estado"];
    const rows = solicitudesFiltradas.map((s) => [
      s.consecutivo || "",
      s.codigo || "",
      s.usuario || s.nombre || "",
      s.correo || "",
      s.fecha || "",
      s.finalizado === "si" ? "Finalizado" : "Pendiente",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `codigos-seguimiento-${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setMensaje("✅ CSV descargado correctamente");
    setTimeout(() => setMensaje(""), 3000);
  };

  return (
    <LayoutWithSidebar>
      <PageHeader titulo="Seguimiento Códigos Asociados" />
      <div style={styles.container}>
        {/* Encabezado */}
        <div style={styles.header}>
          <h1 style={styles.title}>Seguimiento de Códigos Asociados</h1>
          <p style={styles.subtitle}>
            Consolidado de consecutivos y códigos de seguimiento
          </p>
        </div>

        {/* Mensaje */}
        {mensaje && (
          <div
            style={{
              ...styles.alert,
              background: mensaje.startsWith("❌") ? "#fee2e2" : "#ecfccb",
              color: mensaje.startsWith("❌") ? "#991b1b" : "#3f6212",
              borderColor: mensaje.startsWith("❌") ? "#fca5a5" : "#a3e635",
            }}
          >
            {mensaje}
          </div>
        )}

        {/* Barra de herramientas */}
        <div style={styles.toolbar}>
          <input
            type="text"
            placeholder="Buscar por consecutivo, código, usuario o correo..."
            value={filtroTexto}
            onChange={(e) => setFiltroTexto(e.target.value)}
            style={styles.inputText}
          />
          <button onClick={exportarCSV} style={styles.exportBtn} disabled={loading}>
            📥 Exportar CSV
          </button>
          <div style={styles.counter}>
            {loading ? (
              <span>Cargando...</span>
            ) : (
              <span>
                Mostrando <strong>{solicitudesFiltradas.length}</strong> de{" "}
                <strong>{solicitudes.length}</strong> solicitudes
              </span>
            )}
          </div>
        </div>

        {/* Tabla principal */}
        {loading ? (
          <div style={styles.loading}>
            <p>Cargando datos...</p>
          </div>
        ) : solicitudesFiltradas.length === 0 ? (
          <div style={styles.empty}>
            <p>No se encontraron solicitudes con ese criterio de búsqueda.</p>
          </div>
        ) : (
          <div style={styles.tableContainer}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.headerRow}>
                  <th style={styles.th}>Consecutivo</th>
                  <th style={styles.th}>Código</th>
                  <th style={styles.th}>Usuario</th>
                  <th style={styles.th}>Correo</th>
                  <th style={styles.th}>Fecha</th>
                  <th style={styles.th}>Estado</th>
                  <th style={styles.th}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {solicitudesFiltradas.map((solicitud) => (
                  <tr key={solicitud.id} style={styles.row}>
                    <td style={styles.td}>
                      <span style={styles.consecutivo}>{solicitud.consecutivo || "—"}</span>
                    </td>
                    <td style={styles.td}>
                      <div style={styles.codigoCell}>
                        <code style={styles.codigo}>{solicitud.codigo || "—"}</code>
                        {solicitud.codigo && (
                          <button
                            onClick={() => copiarAlPortapapeles(solicitud.codigo)}
                            style={styles.copyBtn}
                            title="Copiar código"
                          >
                            📋
                          </button>
                        )}
                      </div>
                    </td>
                    <td style={styles.td}>{solicitud.usuario || solicitud.nombre || "—"}</td>
                    <td style={styles.td}>
                      <a href={`mailto:${solicitud.correo}`} style={styles.email}>
                        {solicitud.correo || "—"}
                      </a>
                    </td>
                    <td style={styles.td}>{solicitud.fecha || "—"}</td>
                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.badge,
                          background:
                            solicitud.finalizado === "si" ? "#d1fae5" : "#fef3c7",
                          color: solicitud.finalizado === "si" ? "#065f46" : "#92400e",
                        }}
                      >
                        {solicitud.finalizado === "si" ? "Finalizado" : "Pendiente"}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <button
                        onClick={() =>
                          copiarAlPortapapeles(
                            `Consecutivo: ${solicitud.consecutivo}\nCódigo: ${solicitud.codigo}`
                          )
                        }
                        style={styles.actionBtn}
                        title="Copiar ambos"
                      >
                        📋 Copiar todo
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Resumen estadístico */}
        {!loading && solicitudes.length > 0 && (
          <div style={styles.statsContainer}>
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>📊 Resumen</h3>
              <div style={styles.statsGrid}>
                <div style={styles.statItem}>
                  <span style={styles.statLabel}>Total solicitudes:</span>
                  <span style={styles.statValue}>{solicitudes.length}</span>
                </div>
                <div style={styles.statItem}>
                  <span style={styles.statLabel}>Finalizadas:</span>
                  <span style={{ ...styles.statValue, color: "#065f46" }}>
                    {solicitudes.filter((s) => s.finalizado === "si").length}
                  </span>
                </div>
                <div style={styles.statItem}>
                  <span style={styles.statLabel}>Pendientes:</span>
                  <span style={{ ...styles.statValue, color: "#92400e" }}>
                    {solicitudes.filter((s) => s.finalizado !== "si").length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </LayoutWithSidebar>
  );
}

// Estilos
const styles = {
  container: {
    padding: 20,
    fontFamily: "Arial, sans-serif",
  },
  header: {
    backgroundColor: "#007acc",
    color: "white",
    padding: 20,
    borderRadius: 10,
    boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
    marginBottom: 20,
  },
  title: {
    fontSize: 36,
    fontWeight: 900,
    letterSpacing: 1,
    margin: 0,
    textAlign: "center",
    color: "#111827",
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    margin: "8px 0 0 0",
    color: "#374151",
  },
  alert: {
    border: "1px solid",
    borderRadius: 8,
    padding: "12px 16px",
    marginBottom: 16,
    fontWeight: 700,
    textAlign: "center",
  },
  toolbar: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 20,
    padding: 16,
    background: "white",
    borderRadius: 10,
    boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
  },
  inputText: {
    flex: 1,
    minWidth: 250,
    padding: "10px 14px",
    border: "1px solid #d1d5db",
    borderRadius: 8,
    fontSize: 14,
    outline: "none",
  },
  exportBtn: {
    padding: "10px 16px",
    background: "#22c55e",
    color: "white",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 14,
  },
  counter: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: 600,
  },
  loading: {
    textAlign: "center",
    padding: 60,
    fontSize: 18,
    color: "#6b7280",
  },
  empty: {
    textAlign: "center",
    padding: 60,
    fontSize: 16,
    color: "#6b7280",
    background: "#f9fafb",
    borderRadius: 10,
  },
  tableContainer: {
    background: "white",
    borderRadius: 10,
    boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
    overflow: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  headerRow: {
    background: "#f9fafb",
    borderBottom: "2px solid #e5e7eb",
  },
  th: {
    textAlign: "left",
    padding: "12px 16px",
    fontWeight: 700,
    color: "#111827",
    fontSize: 13,
    whiteSpace: "nowrap",
  },
  row: {
    borderBottom: "1px solid #f3f4f6",
    transition: "background 0.2s",
    ":hover": {
      background: "#f9fafb",
    },
  },
  td: {
    padding: "12px 16px",
    color: "#374151",
    fontSize: 14,
  },
  consecutivo: {
    fontWeight: 700,
    color: "#0ea5e9",
    fontSize: 15,
  },
  codigoCell: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  codigo: {
    background: "#f3f4f6",
    padding: "4px 8px",
    borderRadius: 6,
    fontFamily: "monospace",
    fontSize: 13,
    color: "#111827",
    fontWeight: 600,
  },
  copyBtn: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: 16,
    padding: 4,
  },
  email: {
    color: "#0ea5e9",
    textDecoration: "none",
  },
  badge: {
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    display: "inline-block",
  },
  actionBtn: {
    padding: "6px 12px",
    background: "#6b7280",
    color: "white",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
  },
  statsContainer: {
    marginTop: 24,
  },
  card: {
    background: "white",
    borderRadius: 10,
    padding: 20,
    boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: "#111827",
    marginBottom: 16,
    borderBottom: "2px solid #f3f4f6",
    paddingBottom: 8,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 16,
  },
  statItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    background: "#f9fafb",
    borderRadius: 8,
  },
  statLabel: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: 600,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 800,
    color: "#111827",
  },
};
