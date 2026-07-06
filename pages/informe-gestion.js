import { useState, useEffect, useMemo } from "react";
import { db } from "@/firebase/firebaseConfig";
import { collection, getDocs } from "firebase/firestore";
import LayoutWithSidebar from "@/components/LayoutWithSidebar";
import PageHeader from "@/components/PageHeader";
import { BarChart, Bar, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { BRAND } from "@/utils/branding";

export default function InformeGestion() {
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState('mes');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [servicios, setServicios] = useState([]);
  const [solicitudes, setSolicitudes] = useState([]);
  const [equipos, setEquipos] = useState([]);

  useEffect(() => {
    const hoy = new Date();
    const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    setFechaInicio(primerDia.toISOString().split('T')[0]);
    setFechaFin(ultimoDia.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (fechaInicio && fechaFin) cargarDatos();
  }, [fechaInicio, fechaFin]);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const inicio = new Date(fechaInicio + "T00:00:00");
      const fin = new Date(fechaFin + "T23:59:59");

      // Servicios técnicos
      const srvSnap = await getDocs(collection(db, "serviciosTecnicos"));
      const srvData = srvSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => {
        if (!s.fecha) return true; // si no tiene fecha incluir de todas formas
        try {
          const f = s.fecha.toDate ? s.fecha.toDate() : new Date(s.fecha);
          return f >= inicio && f <= fin;
        } catch { return true; }
      });
      setServicios(srvData);

      // Solicitudes (colección correcta: "solicitudes")
      const solSnap = await getDocs(collection(db, "solicitudes"));
      const solData = solSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => {
        if (!s.fecha) return true;
        try {
          const f = s.fecha.toDate ? s.fecha.toDate() : new Date(s.fecha);
          return f >= inicio && f <= fin;
        } catch { return true; }
      });
      setSolicitudes(solData);

      // Equipos (sin filtro de fecha)
      const eqSnap = await getDocs(collection(db, "hojaVidaEquipos"));
      setEquipos(eqSnap.docs.map(d => ({ id: d.id, ...d.data() })));

    } catch (error) {
      console.error("Error cargando informe:", error);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    // Usar servicioFinalizado y finalizado que son los campos reales
    const resueltos = servicios.filter(s => 
      s.servicioFinalizado === "si" || s.finalizado === "si" || 
      s.estado === "Resuelto" || s.estado === "finalizado"
    ).length;
    const pendientes = servicios.filter(s => 
      (s.servicioFinalizado === "no" || s.finalizado === "no" || !s.servicioFinalizado) &&
      s.estado !== "Resuelto" && s.estado !== "finalizado" && s.estado !== "En proceso"
    ).length;
    const enProceso = servicios.filter(s => s.estado === "En proceso").length;
    const total = servicios.length;
    const tasa = total > 0 ? ((resueltos / total) * 100).toFixed(1) : 0;
    
    const solPendientes = solicitudes.filter(s => !s.atendida).length;
    const solAtendidas = solicitudes.filter(s => s.atendida).length;
    
    const eqBaja = equipos.filter(e =>
      e.estado === "Baja" || e.estado === "Dado de baja" ||
      e.estado === "baja" || e.dadoDeBaja === true
    ).length;
    const eqActivos = equipos.length - eqBaja;
    const totalEquipos = equipos.length;

    return {
      totalServicios: total,
      pendientes,
      resueltos,
      enProceso,
      tasaResolucion: tasa,
      totalSolicitudes: solicitudes.length,
      solPendientes,
      solAtendidas,
      totalEquipos: equipos.length,
      eqActivos,
      eqBaja
    };
  }, [servicios, solicitudes, equipos]);

  const cambiarPeriodo = (p) => {
    setPeriodo(p);
    const hoy = new Date();
    let inicio, fin;
    if (p === 'mes') {
      inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    } else if (p === 'trimestre') {
      const t = Math.floor(hoy.getMonth() / 3);
      inicio = new Date(hoy.getFullYear(), t * 3, 1);
      fin = new Date(hoy.getFullYear(), (t + 1) * 3, 0);
    } else {
      inicio = new Date(hoy.getFullYear(), 0, 1);
      fin = new Date(hoy.getFullYear(), 11, 31);
    }
    setFechaInicio(inicio.toISOString().split('T')[0]);
    setFechaFin(fin.toISOString().split('T')[0]);
  };

  const exportPDF = async () => {
    try {
      const { default: html2pdf } = await import('html2pdf.js');
      const elem = document.getElementById('informe');
      html2pdf().from(elem).save(`Informe_${BRAND.clientName}_${fechaInicio}.pdf`);
    } catch (e) {
      alert("Error al exportar PDF");
    }
  };

  const dataServicios = [
    { name: 'Pendientes', value: stats.pendientes, color: '#ff8042' },
    { name: 'En Proceso', value: stats.enProceso, color: '#ffbb28' },
    { name: 'Resueltos', value: stats.resueltos, color: '#00c49f' }
  ].filter(d => d.value > 0);

  const dataEquipos = [
    { name: 'Activos', value: stats.eqActivos || stats.totalEquipos, color: '#007acc' },
    ...(stats.eqBaja > 0 ? [{ name: 'Baja', value: stats.eqBaja, color: '#dc2626' }] : [])
  ].filter(d => d.value > 0);

  if (loading) {
    return (
      <LayoutWithSidebar>
        <PageHeader titulo="Informe de Gestión TI" />
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <div style={{ width: 40, height: 40, border: '4px solid #e5e7eb', borderTopColor: '#007acc', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#6b7280' }}>Generando informe...</p>
        </div>
        <style jsx>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </LayoutWithSidebar>
    );
  }

  return (
    <LayoutWithSidebar>
      <PageHeader titulo="Informe de Gestión TI" />
      <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ background: 'white', padding: 24, borderRadius: 12, marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: '#111827', marginBottom: 8 }}>
            📊 Informe de Gestión TI - {BRAND.clientName}
          </h2>
          <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 16 }}>
            Período: {new Date(fechaInicio).toLocaleDateString()} - {new Date(fechaFin).toLocaleDateString()}
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <button onClick={() => cambiarPeriodo('mes')} style={{ padding: '10px 18px', border: '2px solid', borderColor: periodo === 'mes' ? '#007acc' : '#e5e7eb', borderRadius: 8, background: periodo === 'mes' ? '#007acc' : 'white', color: periodo === 'mes' ? 'white' : '#6b7280', cursor: 'pointer', fontWeight: 600 }}>
              📅 Mes Actual
            </button>
            <button onClick={() => cambiarPeriodo('trimestre')} style={{ padding: '10px 18px', border: '2px solid', borderColor: periodo === 'trimestre' ? '#007acc' : '#e5e7eb', borderRadius: 8, background: periodo === 'trimestre' ? '#007acc' : 'white', color: periodo === 'trimestre' ? 'white' : '#6b7280', cursor: 'pointer', fontWeight: 600 }}>
              📅 Trimestre
            </button>
            <button onClick={() => cambiarPeriodo('año')} style={{ padding: '10px 18px', border: '2px solid', borderColor: periodo === 'año' ? '#007acc' : '#e5e7eb', borderRadius: 8, background: periodo === 'año' ? '#007acc' : 'white', color: periodo === 'año' ? 'white' : '#6b7280', cursor: 'pointer', fontWeight: 600 }}>
              📅 Año Actual
            </button>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 4 }}>Desde:</label>
              <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} style={{ padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 4 }}>Hasta:</label>
              <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} style={{ padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
            </div>
            <button onClick={exportPDF} style={{ padding: '10px 20px', background: '#10b981', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
              📄 Exportar PDF
            </button>
          </div>
        </div>

        <div id="informe">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
            {[
              { titulo: 'Total Servicios Técnicos', valor: stats.totalServicios, icono: '🔧', color: '#007acc', sub: `${stats.tasaResolucion}% resueltos` },
              { titulo: 'Solicitudes de Servicio', valor: stats.totalSolicitudes, icono: '📋', color: '#00c49f', sub: `${stats.solAtendidas} atendidas` },
              { titulo: 'Tasa de Resolución', valor: `${stats.tasaResolucion}%`, icono: '✅', color: '#ffbb28', sub: 'Servicios técnicos' },
              { titulo: 'Equipos en Inventario', valor: stats.totalEquipos, icono: '💻', color: '#8884d8', sub: `${stats.eqActivos} activos / ${stats.eqBaja} baja` },
            ].map((kpi, i) => (
              <div key={i} style={{ background: 'white', padding: 24, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb', borderTop: `4px solid ${kpi.color}`, display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ fontSize: 40 }}>{kpi.icono}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>{kpi.titulo}</div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: kpi.color, lineHeight: 1 }}>{kpi.valor}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{kpi.sub}</div>
                </div>
              </div>
            ))}
          </div>

          <h3 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginTop: 32, marginBottom: 16, paddingBottom: 12, borderBottom: '2px solid #e5e7eb' }}>
            🔧 Servicios Técnicos
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 16, marginBottom: 24 }}>
            <div style={{ background: 'white', padding: 20, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb' }}>
              <h4 style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 16 }}>Estado de Servicios</h4>
              {dataServicios.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={dataServicios} cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name}: ${value}`} outerRadius={80} dataKey="value">
                      {dataServicios.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div style={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 14 }}>Sin datos</div>}
            </div>

            <div style={{ background: 'white', padding: 20, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb' }}>
              <h4 style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 16 }}>Resumen Servicios</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { icono: '✅', label: 'Resueltos', valor: stats.resueltos, color: '#00c49f' },
                  { icono: '🔄', label: 'En Proceso', valor: stats.enProceso, color: '#ffbb28' },
                  { icono: '⏳', label: 'Pendientes', valor: stats.pendientes, color: '#ff8042' },
                  { icono: '📊', label: 'Total', valor: stats.totalServicios, color: '#007acc' }
                ].map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                    <span style={{ fontSize: 28 }}>{r.icono}</span>
                    <div>
                      <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>{r.label}</div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: r.color }}>{r.valor}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <h3 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginTop: 32, marginBottom: 16, paddingBottom: 12, borderBottom: '2px solid #e5e7eb' }}>
            💻 Inventario de Equipos
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 16, marginBottom: 24 }}>
            <div style={{ background: 'white', padding: 20, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb' }}>
              <h4 style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 16 }}>Estado de Equipos</h4>
              {dataEquipos.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={dataEquipos} cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name}: ${value}`} outerRadius={80} dataKey="value">
                      {dataEquipos.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div style={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 14 }}>Sin equipos</div>}
            </div>
          </div>

          <div style={{ background: '#f9fafb', padding: 24, borderRadius: 12, border: '1px solid #e5e7eb', marginTop: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827' }}>{BRAND.clientName}</p>
                <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#6b7280' }}>{BRAND.subtitle}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>Generado: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</p>
                <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#6b7280' }}>Período: {new Date(fechaInicio).toLocaleDateString()} - {new Date(fechaFin).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <style jsx>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </LayoutWithSidebar>
  );
}
