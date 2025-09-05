// pages/estadisticas.js
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

/* Paleta para los pasteles */
const COLORS = [
  "#0ea5e9", "#22c55e", "#f59e0b", "#ef4444",
  "#8b5cf6", "#06b6d4", "#84cc16", "#f97316",
];

export default function Estadisticas() {
  const router = useRouter();

  /* ---- Filtros ---- */
  const [fechaInicio, setFechaInicio] = useState(null);
  const [fechaFin, setFechaFin] = useState(null);
  const [filtros, setFiltros] = useState({
    cargo: "",
    equipo: "",
    falla: "",
    diagnostico: "",
    parte: "",
    tipoSoporte: "",
    usuario: "",
  });

  /* Datos */
  const [base, setBase] = useState([]);       // solo filtrado por fechas
  const [filtrados, setFiltrados] = useState([]); // filtrado por todos los filtros
  const [resumen, setResumen] = useState({});
  const [filtrosTablas, setFiltrosTablas] = useState({}); // buscador por tabla

  /* ---- Utilidades ---- */
  const startOfDay = (d) => (d ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0) : null);
  const endOfDay   = (d) => (d ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999) : null);

  const actualizarFiltroTabla = (clave, valor) =>
    setFiltrosTablas((prev) => ({ ...prev, [clave]: valor }));

  const agruparPorMes = (servicios) => {
    const map = new Map(); // "YYYY-MM" -> count
    servicios.forEach(({ fecha }) => {
      const k = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
      map.set(k, (map.get(k) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([mes, cantidad]) => ({ mes, cantidad }))
      .sort((a, b) => a.mes.localeCompare(b.mes));
  };

  const agruparPorAnio = (servicios) => {
    const map = new Map(); // "YYYY" -> count
    servicios.forEach(({ fecha }) => {
      const k = String(fecha.getFullYear());
      map.set(k, (map.get(k) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([anio, cantidad]) => ({ anio, cantidad }))
      .sort((a, b) => a.anio.localeCompare(b.anio));
  };

  const contarPorCampo = (arr, campo) => {
    const cont = new Map();
    arr.forEach((s) => {
      const bruto = (s[campo] ?? "Sin especificar").toString().trim();
      const clave = bruto.toLowerCase();
      const nombre = bruto.charAt(0).toUpperCase() + bruto.slice(1);
      cont.set(clave, { nombre, cantidad: (cont.get(clave)?.cantidad || 0) + 1 });
    });
    return Array.from(cont.values()).sort((a, b) => b.cantidad - a.cantidad);
  };

  const contarPartes = (arr) => {
    const cont = new Map();
    arr.forEach((s) => {
      (Array.isArray(s.partes) ? s.partes : []).forEach((p) => {
        const bruto = (p ?? "Sin especificar").toString().trim();
        const clave = bruto.toLowerCase();
        const nombre = bruto.charAt(0).toUpperCase() + bruto.slice(1);
        cont.set(clave, { nombre, cantidad: (cont.get(clave)?.cantidad || 0) + 1 });
      });
    });
    return Array.from(cont.values()).sort((a, b) => b.cantidad - a.cantidad);
  };

  /* ---- Cargar de Firestore ---- */
  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, "serviciosTecnicos"));
      const todos = snap.docs
        .map((d) => d.data())
        .filter((d) => d?.fecha)
        .map((d) => ({
          ...d,
          fecha: new Date(d.fecha),
          partes: Array.isArray(d.partes) ? d.partes : [],
        }));

      // Filtrado por rango de fechas (solo para construir opciones base)
      const ini = startOfDay(fechaInicio);
      const fin = endOfDay(fechaFin);
      const fechaOk = (f) =>
        (!ini || f >= ini) && (!fin || f <= fin);

      const baseFiltrada = todos.filter((s) => fechaOk(s.fecha));
      setBase(baseFiltrada);
    })();
  }, [fechaInicio, fechaFin]);

  /* ---- Aplicar filtros y calcular resumen ---- */
  useEffect(() => {
    // Aplica filtros seleccionados sobre "base"
    const out = base.filter((s) => {
      if (filtros.cargo && (s.cargo || "").trim() !== filtros.cargo) return false;
      if (filtros.equipo && (s.equipo || "").trim() !== filtros.equipo) return false;
      if (filtros.falla && (s.falla || "").trim() !== filtros.falla) return false;
      if (filtros.diagnostico && (s.diagnostico || "").trim() !== filtros.diagnostico) return false;
      if (filtros.tipoSoporte && (s.tipoSoporte || "").trim() !== filtros.tipoSoporte) return false;
      if (filtros.usuario && (s.usuario || "").trim() !== filtros.usuario) return false;
      if (filtros.parte) {
        const has = (Array.isArray(s.partes) ? s.partes : []).some((p) => (p || "").trim() === filtros.parte);
        if (!has) return false;
      }
      return true;
    });

    setFiltrados(out);

    setResumen({
      total: out.length,
      porMes: agruparPorMes(out),
      porAnio: agruparPorAnio(out),
      porUsuario: contarPorCampo(out, "usuario"),
      porCargo: contarPorCampo(out, "cargo"),
      porEquipo: contarPorCampo(out, "equipo"),
      porFalla: contarPorCampo(out, "falla"),
      porDiagnostico: contarPorCampo(out, "diagnostico"),
      porTipoSoporte: contarPorCampo(out, "tipoSoporte"),
      porPartes: contarPartes(out),
    });
  }, [base, filtros]);

  /* ---- Opciones para selects (siempre desde "base" para no autolimitar) ---- */
  const opciones = useMemo(() => {
    const uniq = (arr) => Array.from(new Set(arr.map((x) => (x || "").toString().trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, "es", { sensitivity: "base" })
    );
    return {
      cargo: uniq(base.map((s) => s.cargo)),
      equipo: uniq(base.map((s) => s.equipo)),
      falla: uniq(base.map((s) => s.falla)),
      diagnostico: uniq(base.map((s) => s.diagnostico)),
      tipoSoporte: uniq(base.map((s) => s.tipoSoporte)),
      usuario: uniq(base.map((s) => s.usuario)),
      parte: uniq(base.flatMap((s) => (Array.isArray(s.partes) ? s.partes : []))),
    };
  }, [base]);

  /* ---- Render helpers ---- */
  const renderPieSection = (titulo, data, clave) => {
    const q = (filtrosTablas[clave] || "").toLowerCase();
    const total = resumen.total || 1;
    const lista = (data || []).filter((x) => x.nombre.toLowerCase().includes(q));

    return (
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <h3 style={{ margin: 0, fontSize: 18, color: "#111827" }}>{titulo}</h3>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={lista} dataKey="cantidad" nameKey="nombre" cx="50%" cy="50%" outerRadius={90} label>
                  {lista.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div>
            <input
              type="text"
              placeholder="Filtrar nombres…"
              value={filtrosTablas[clave] || ""}
              onChange={(e) => actualizarFiltroTabla(clave, e.target.value)}
              style={{ ...styles.input, marginBottom: 8 }}
            />
            <div style={{ maxHeight: 260, overflow: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f9fafb" }}>
                    <th style={styles.th}>Nombre</th>
                    <th style={styles.th}>Cantidad</th>
                    <th style={styles.th}>%</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((it, i) => (
                    <tr key={i} style={{ borderTop: "1px solid #eee" }}>
                      <td style={styles.td}>{it.nombre}</td>
                      <td style={styles.td}>{it.cantidad}</td>
                      <td style={styles.td}>{((it.cantidad / total) * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderDetalleFiltro = (clave, etiqueta) => {
    const valor = filtros[clave];
    if (!valor) return null;

    const lista = filtrados; // ya está filtrado por ese valor
    const porMes = agruparPorMes(lista);
    const porAnio = agruparPorAnio(lista);

    return (
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <h3 style={{ margin: 0, fontSize: 18, color: "#111827" }}>
            Detalle: {etiqueta} = <span style={{ color: "#0b3b5e" }}>{valor}</span>
          </h3>
          <span style={styles.badge}>{lista.length} atenciones</span>
        </div>

        {/* Conteos */}
        <div style={styles.rowGrid2}>
          <div style={{ height: 220, padding: 8, border: "1px solid #e5e7eb", borderRadius: 8 }}>
            <strong style={{ color: "#111827" }}>Tendencia mensual</strong>
            <ResponsiveContainer width="100%" height="85%">
              <LineChart data={porMes}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="cantidad" stroke="#0ea5e9" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ padding: 8, border: "1px solid #e5e7eb", borderRadius: 8 }}>
            <strong style={{ color: "#111827" }}>Conteo por año</strong>
            <div style={{ marginTop: 6, display: "grid", gap: 6 }}>
              {porAnio.map((r) => (
                <div key={r.anio} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{r.anio}</span>
                  <span style={{ fontWeight: 700 }}>{r.cantidad}</span>
                </div>
              ))}
              {porAnio.length === 0 && <span style={{ color: "#6b7280" }}>Sin datos</span>}
            </div>
          </div>
        </div>

        {/* Tabla detalle */}
        <div style={{ marginTop: 12 }}>
          <div style={{ maxHeight: 360, overflow: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  <th style={styles.th}>Fecha</th>
                  <th style={styles.th}>Usuario</th>
                  <th style={styles.th}>Cargo</th>
                  <th style={styles.th}>Equipo</th>
                  <th style={styles.th}>Falla</th>
                  <th style={styles.th}>Diagnóstico</th>
                  <th style={styles.th}>Piezas</th>
                  <th style={styles.th}>Tipo soporte</th>
                  <th style={styles.th}>Técnico</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((s, i) => (
                  <tr key={i} style={{ borderTop: "1px solid #eee" }}>
                    <td style={styles.td}>{s.fecha.toISOString().slice(0, 10)}</td>
                    <td style={styles.td}>{s.usuario || "—"}</td>
                    <td style={styles.td}>{s.cargo || "—"}</td>
                    <td style={styles.td}>{s.equipo || "—"}</td>
                    <td style={styles.td}>{s.falla || "—"}</td>
                    <td style={styles.td}>{s.diagnostico || "—"}</td>
                    <td style={styles.td}>{(s.partes || []).join(", ") || "—"}</td>
                    <td style={styles.td}>{s.tipoSoporte || "—"}</td>
                    <td style={styles.td}>{s.tecnico || "—"}</td>
                  </tr>
                ))}
                {lista.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ ...styles.td, textAlign: "center", color: "#6b7280" }}>
                      Sin registros para este filtro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  /* ---- UI ---- */
  return (
    <div style={{ padding: 20, fontFamily: "Arial, sans-serif" }}>
      {/* Encabezado */}
      <div
        style={{
          backgroundColor: "#007acc",
          color: "white",
          padding: 10,
          borderRadius: 10,
          boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
          display: "grid",
          justifyItems: "center",
          gap: 12,
        }}
      >
        <h1
          style={{
            fontSize: 36,
            color: "#111827",
            fontWeight: 900,
            letterSpacing: 1,
            margin: 0,
            textAlign: "center",
          }}
        >
          Estadística de Servicios Técnicos
        </h1>

        {/* Tarjeta de filtros */}
        <div style={{ ...styles.card, width: "100%" }}>
          <div style={styles.cardHeader}>
            <h3 style={{ margin: 0, fontSize: 18, color: "#111827" }}>Filtros</h3>
            <button
              type="button"
              onClick={() =>
                setFiltros({
                  cargo: "",
                  equipo: "",
                  falla: "",
                  diagnostico: "",
                  parte: "",
                  tipoSoporte: "",
                  usuario: "",
                })
              }
              style={styles.secondaryBtn}
            >
              Limpiar filtros
            </button>
          </div>

          <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
            {/* Fechas */}
            <div style={styles.rowGrid3}>
              <div>
                <label style={styles.label}>Fecha inicio</label>
                <DatePicker
                  selected={fechaInicio}
                  onChange={setFechaInicio}
                  placeholderText="Seleccione fecha"
                  dateFormat="yyyy-MM-dd"
                  customInput={<input style={styles.input} />}
                />
              </div>
              <div>
                <label style={styles.label}>Fecha fin</label>
                <DatePicker
                  selected={fechaFin}
                  onChange={setFechaFin}
                  placeholderText="Seleccione fecha"
                  dateFormat="yyyy-MM-dd"
                  customInput={<input style={styles.input} />}
                />
              </div>
              <div>
                <label style={styles.label}>Usuario solicitante</label>
                <select
                  value={filtros.usuario}
                  onChange={(e) => setFiltros((f) => ({ ...f, usuario: e.target.value }))}
                  style={styles.input}
                >
                  <option value="">Todos</option>
                  {opciones.usuario.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={styles.rowGrid3}>
              <div>
                <label style={styles.label}>Cargo</label>
                <select
                  value={filtros.cargo}
                  onChange={(e) => setFiltros((f) => ({ ...f, cargo: e.target.value }))}
                  style={styles.input}
                >
                  <option value="">Todos</option>
                  {opciones.cargo.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={styles.label}>Equipo</label>
                <select
                  value={filtros.equipo}
                  onChange={(e) => setFiltros((f) => ({ ...f, equipo: e.target.value }))}
                  style={styles.input}
                >
                  <option value="">Todos</option>
                  {opciones.equipo.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={styles.label}>Tipo de soporte</label>
                <select
                  value={filtros.tipoSoporte}
                  onChange={(e) => setFiltros((f) => ({ ...f, tipoSoporte: e.target.value }))}
                  style={styles.input}
                >
                  <option value="">Todos</option>
                  {opciones.tipoSoporte.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={styles.rowGrid3}>
              <div>
                <label style={styles.label}>Falla</label>
                <select
                  value={filtros.falla}
                  onChange={(e) => setFiltros((f) => ({ ...f, falla: e.target.value }))}
                  style={styles.input}
                >
                  <option value="">Todas</option>
                  {opciones.falla.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={styles.label}>Diagnóstico</label>
                <select
                  value={filtros.diagnostico}
                  onChange={(e) => setFiltros((f) => ({ ...f, diagnostico: e.target.value }))}
                  style={styles.input}
                >
                  <option value="">Todos</option>
                  {opciones.diagnostico.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={styles.label}>Pieza reemplazada</label>
                <select
                  value={filtros.parte}
                  onChange={(e) => setFiltros((f) => ({ ...f, parte: e.target.value }))}
                  style={styles.input}
                >
                  <option value="">Todas</option>
                  {opciones.parte.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Total */}
      <div style={{ ...styles.card, marginTop: 12 }}>
        <div style={styles.cardHeader}>
          <h3 style={{ margin: 0, fontSize: 18, color: "#111827" }}>Resultado del período</h3>
          <span style={styles.badge}>{resumen.total || 0} servicios</span>
        </div>

        {resumen.porMes && (
          <div style={{ height: 260, marginTop: 8 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={resumen.porMes}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="cantidad" stroke="#0ea5e9" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Secciones de resumen (pastel + tabla) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))", gap: 12, marginTop: 12 }}>
        {resumen.porUsuario && renderPieSection("Por usuario solicitante", resumen.porUsuario, "usuario")}
        {resumen.porCargo && renderPieSection("Por cargo", resumen.porCargo, "cargo")}
        {resumen.porEquipo && renderPieSection("Por equipo", resumen.porEquipo, "equipo")}
        {resumen.porFalla && renderPieSection("Por tipo de falla", resumen.porFalla, "falla")}
        {resumen.porDiagnostico && renderPieSection("Por diagnóstico", resumen.porDiagnostico, "diagnostico")}
        {resumen.porTipoSoporte && renderPieSection("Por tipo de soporte", resumen.porTipoSoporte, "tipoSoporte")}
        {resumen.porPartes && renderPieSection("Piezas reemplazadas", resumen.porPartes, "parte")}
      </div>

      {/* Detalles según filtros activos */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, marginTop: 12 }}>
        {renderDetalleFiltro("usuario", "Usuario")}
        {renderDetalleFiltro("cargo", "Cargo")}
        {renderDetalleFiltro("equipo", "Equipo")}
        {renderDetalleFiltro("falla", "Falla")}
        {renderDetalleFiltro("diagnostico", "Diagnóstico")}
        {renderDetalleFiltro("tipoSoporte", "Tipo de soporte")}
        {renderDetalleFiltro("parte", "Pieza")}
      </div>

      {/* Botón Regresar */}
      <button onClick={() => router.push("/")} style={styles.backBtn} title="Volver al inicio">
        ⬅ Regresar
      </button>
    </div>
  );
}

/* ---------------- Estilos compartidos (mismo look & feel) ---------------- */
const styles = {
  card: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 12,
    background: "white",
    boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: "1px solid #f3f4f6",
    paddingBottom: 6,
    marginBottom: 8,
  },
  label: {
    display: "block",
    fontSize: 12,
    color: "#6b7280",
    fontWeight: 700,
    marginBottom: 6,
  },
  input: {
    width: "100%",
    padding: "10px 10px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    outline: "none",
    background: "#ffffff",
    color: "#0f172a",
  },
  th: {
    textAlign: "left",
    padding: "8px 10px",
    fontWeight: 700,
    color: "#111827",
    borderBottom: "1px solid #e5e7eb",
    position: "sticky",
    top: 0,
    background: "#f9fafb",
  },
  td: {
    padding: "8px 10px",
    color: "#111827",
  },
  badge: {
    padding: "4px 8px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    background: "#e0f2fe",
    color: "#075985",
  },
  secondaryBtn: {
    background: "#334155",
    color: "white",
    padding: "8px 12px",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 700,
  },
  rowGrid2: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
    gap: 12,
  },
  rowGrid3: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
    gap: 12,
  },
  backBtn: {
    position: "fixed",
    bottom: 20,
    left: 20,
    backgroundColor: "#007acc",
    color: "white",
    padding: "10px 16px",
    borderRadius: 8,
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    zIndex: 1000,
    textDecoration: "none",
    fontWeight: 700,
    border: "none",
    cursor: "pointer",
  },
};
