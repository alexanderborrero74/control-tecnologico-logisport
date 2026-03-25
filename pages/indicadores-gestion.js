import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { db } from "@/firebase/firebaseConfig";
import { collection, getDocs } from "firebase/firestore";
import LayoutWithSidebar from "@/components/LayoutWithSidebar";
import PageHeader from "@/components/PageHeader";

export default function IndicadoresGestion() {
  const router = useRouter();
  const [servicios, setServicios] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const snapshot = await getDocs(collection(db, "serviciosTecnicos"));
        const datos = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setServicios(datos);
      } catch (error) {
        console.error("Error cargando servicios:", error);
      } finally {
        setLoading(false);
      }
    };

    cargarDatos();
  }, []);

  // Función auxiliar para verificar si un servicio es interno
  const esServicioInterno = (servicio) => {
    return servicio.esInterno || !servicio.consecutivo;
  };

  // Función auxiliar MEJORADA para verificar si un servicio está finalizado
  const estaFinalizado = (servicio) => {
    // Obtener valores y normalizarlos
    const finalizado = String(servicio.finalizado || "").toLowerCase().trim();
    const servicioFinalizado = String(servicio.servicioFinalizado || "").toLowerCase().trim();
    const estado = String(servicio.estado || "").toLowerCase().trim();
    
    // Lista completa de valores que indican finalización
    const valoresFinalizados = ["si", "sí", "yes", "finalizado", "completado", "terminado", "true", "1"];
    
    // Verificar strings
    const esFinalizadoString = valoresFinalizados.includes(finalizado) ||
                                valoresFinalizados.includes(servicioFinalizado) ||
                                valoresFinalizados.includes(estado);
    
    // Verificar booleanos
    const esFinalizadoBoolean = servicio.finalizado === true ||
                                 servicio.servicioFinalizado === true ||
                                 servicio.estado === true;
    
    return esFinalizadoString || esFinalizadoBoolean;
  };

  // Cálculos de indicadores
  const totalServicios = servicios.length;
  const serviciosFinalizados = servicios.filter(estaFinalizado).length;
  
  // CAMBIO: Servicios pendientes NO incluyen servicios internos
  const serviciosPendientes = servicios.filter(s => 
    !estaFinalizado(s) && !esServicioInterno(s)
  ).length;

  const tasaFinalizacion = totalServicios > 0 
    ? ((serviciosFinalizados / totalServicios) * 100).toFixed(1)
    : 0;

  // Por tipo de soporte
  const virtuales = servicios.filter(
    (s) => s.tipoSoporte === "virtual" || s.modalidad === "virtual"
  ).length;
  const presenciales = servicios.filter(
    (s) => s.tipoSoporte === "presencial" || s.modalidad === "presencial"
  ).length;

  // Servicios internos preventivos
  const internosPreventivos = servicios.filter(esServicioInterno).length;
  const externos = totalServicios - internosPreventivos;

  return (
    <LayoutWithSidebar>
      <PageHeader titulo="Indicadores de Gestión" />
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Indicadores de Gestión</h1>
          <p style={styles.subtitle}>Panel de métricas y estadísticas de servicios técnicos</p>
        </div>

        {loading ? (
          <div style={styles.loading}>
            <p>Cargando datos...</p>
          </div>
        ) : (
          <>
            <div style={styles.kpiGrid}>
              <MiniKpi
                titulo="Total de Servicios"
                valor={totalServicios}
                color="#0ea5e9"
                icono="📊"
              />
              <MiniKpi
                titulo="Servicios Finalizados"
                valor={serviciosFinalizados}
                color="#22c55e"
                icono="✅"
              />
              <MiniKpi
                titulo="Servicios Pendientes"
                valor={serviciosPendientes}
                color="#f59e0b"
                icono="⏳"
                subtitle="(Externos sin finalizar)"
              />
              <MiniKpi
                titulo="Tasa de Finalización"
                valor={`${tasaFinalizacion}%`}
                color="#8b5cf6"
                icono="📈"
              />
            </div>

            <div style={styles.grid}>
              <div style={styles.card}>
                <h3 style={styles.cardTitle}>Por Tipo de Soporte</h3>
                <div style={styles.statRow}>
                  <span style={styles.statLabel}>Virtual:</span>
                  <span style={styles.statValue}>{virtuales}</span>
                </div>
                <div style={styles.statRow}>
                  <span style={styles.statLabel}>Presencial:</span>
                  <span style={styles.statValue}>{presenciales}</span>
                </div>
                <div style={styles.progressBar}>
                  <div
                    style={{
                      ...styles.progressFill,
                      width: `${totalServicios > 0 ? (virtuales / totalServicios) * 100 : 0}%`,
                      background: "#0ea5e9",
                    }}
                  />
                </div>
              </div>

              <div style={styles.card}>
                <h3 style={styles.cardTitle}>Servicios Internos Preventivos vs Externos</h3>
                <div style={styles.statRow}>
                  <span style={styles.statLabel}>Internos Preventivos:</span>
                  <span style={styles.statValue}>{internosPreventivos}</span>
                </div>
                <div style={styles.statRow}>
                  <span style={styles.statLabel}>Externos:</span>
                  <span style={styles.statValue}>{externos}</span>
                </div>
                <div style={styles.progressBar}>
                  <div
                    style={{
                      ...styles.progressFill,
                      width: `${totalServicios > 0 ? (internosPreventivos / totalServicios) * 100 : 0}%`,
                      background: "#22c55e",
                    }}
                  />
                </div>
              </div>
            </div>

            <div style={styles.card}>
              <h3 style={styles.cardTitle}>Servicios por Técnico</h3>
              <ServiciosPorTecnico servicios={servicios} />
            </div>

            <div style={styles.card}>
              <h3 style={styles.cardTitle}>Top 10 Equipos con Más Servicios</h3>
              <TopEquipos servicios={servicios} />
            </div>
          </>
        )}
      </div>
    </LayoutWithSidebar>
  );
}

function MiniKpi({ titulo, valor, color, icono, subtitle }) {
  return (
    <div style={{ ...styles.miniKpi, borderLeft: `4px solid ${color}` }}>
      <div style={styles.miniKpiIcon}>{icono}</div>
      <div>
        <div style={styles.miniKpiTitulo}>{titulo}</div>
        <div style={{ ...styles.miniKpiValor, color }}>{valor}</div>
        {subtitle && (
          <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}

function ServiciosPorTecnico({ servicios }) {
  // Misma función auxiliar mejorada
  const estaFinalizado = (servicio) => {
    const finalizado = String(servicio.finalizado || "").toLowerCase().trim();
    const servicioFinalizado = String(servicio.servicioFinalizado || "").toLowerCase().trim();
    const estado = String(servicio.estado || "").toLowerCase().trim();
    
    const valoresFinalizados = ["si", "sí", "yes", "finalizado", "completado", "terminado", "true", "1"];
    
    return valoresFinalizados.includes(finalizado) ||
           valoresFinalizados.includes(servicioFinalizado) ||
           valoresFinalizados.includes(estado) ||
           servicio.finalizado === true ||
           servicio.servicioFinalizado === true ||
           servicio.estado === true;
  };
  
  const tecnicos = {};
  
  servicios.forEach((s) => {
    const tecnico = s.tecnico || "Sin asignar";
    if (!tecnicos[tecnico]) {
      tecnicos[tecnico] = { total: 0, finalizados: 0 };
    }
    tecnicos[tecnico].total++;
    if (estaFinalizado(s)) {
      tecnicos[tecnico].finalizados++;
    }
  });

  const sorted = Object.entries(tecnicos).sort((a, b) => b[1].total - a[1].total);

  return (
    <div style={styles.table}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#f9fafb" }}>
            <th style={styles.th}>Técnico</th>
            <th style={styles.th}>Total</th>
            <th style={styles.th}>Finalizados</th>
            <th style={styles.th}>Pendientes</th>
            <th style={styles.th}>% Finalización</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(([tecnico, stats]) => {
            const pendientes = stats.total - stats.finalizados;
            const porcentaje = stats.total > 0 
              ? ((stats.finalizados / stats.total) * 100).toFixed(1)
              : 0;

            return (
              <tr key={tecnico} style={{ borderTop: "1px solid #e5e7eb" }}>
                <td style={styles.td}>{tecnico}</td>
                <td style={styles.td}>{stats.total}</td>
                <td style={styles.td}>{stats.finalizados}</td>
                <td style={styles.td}>{pendientes}</td>
                <td style={styles.td}>{porcentaje}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TopEquipos({ servicios }) {
  const equipos = {};
  
  servicios.forEach((s) => {
    const equipo = s.equipo || "Sin especificar";
    equipos[equipo] = (equipos[equipo] || 0) + 1;
  });

  const sorted = Object.entries(equipos)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  return (
    <div style={styles.table}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#f9fafb" }}>
            <th style={styles.th}>Equipo</th>
            <th style={styles.th}>Servicios</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(([equipo, cantidad]) => (
            <tr key={equipo} style={{ borderTop: "1px solid #e5e7eb" }}>
              <td style={styles.td}>{equipo}</td>
              <td style={styles.td}>{cantidad}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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
  loading: {
    textAlign: "center",
    padding: 40,
    fontSize: 18,
    color: "#6b7280",
  },
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    gap: 16,
    marginBottom: 20,
  },
  miniKpi: {
    background: "white",
    padding: 16,
    borderRadius: 10,
    boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  miniKpiIcon: {
    fontSize: 32,
  },
  miniKpiTitulo: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: 600,
    marginBottom: 4,
  },
  miniKpiValor: {
    fontSize: 28,
    fontWeight: 800,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: 16,
    marginBottom: 20,
  },
  card: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 16,
    background: "white",
    boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: "#111827",
    marginBottom: 12,
    borderBottom: "2px solid #f3f4f6",
    paddingBottom: 8,
  },
  statRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "8px 0",
    borderBottom: "1px solid #f3f4f6",
  },
  statLabel: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: 600,
  },
  statValue: {
    fontSize: 16,
    color: "#111827",
    fontWeight: 700,
  },
  progressBar: {
    width: "100%",
    height: 8,
    background: "#f3f4f6",
    borderRadius: 999,
    marginTop: 12,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    transition: "width 0.3s ease",
  },
  table: {
    overflowX: "auto",
  },
  th: {
    textAlign: "left",
    padding: "10px 12px",
    fontWeight: 700,
    color: "#111827",
    fontSize: 13,
  },
  td: {
    padding: "10px 12px",
    color: "#374151",
    fontSize: 14,
  },
};
