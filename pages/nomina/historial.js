// pages/nomina/historial.js
// Historial de nóminas guardadas — consulta de períodos anteriores

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, updateDoc, deleteDoc, doc, query, orderBy } from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";
import { getUserRoleByUid } from "@/utils/getUserRole";
import LayoutWithSidebar from "@/components/LayoutWithSidebar";
import { formatCOP } from "@/utils/nominaCalculos";
import { CalendarDays, ArrowLeft, Eye, Download, CheckCircle, Clock, ChevronDown, ChevronUp, Search, Trash2, FileSpreadsheet, Settings2, X } from "lucide-react";

const PRIMARY = "#0B3D91";
const ACCENT  = "#00AEEF";
const DANGER  = "#ef4444";
const SUCCESS = "#10b981";

export default function NominaHistorial() {
  const router = useRouter();
  const [rol,       setRol]       = useState(null);
  const [periodos,  setPeriodos]  = useState([]);
  const [expandido, setExpandido] = useState(null);
  const [filtro,    setFiltro]    = useState("");
  const [loading,   setLoading]   = useState(true);

  // Modal eliminar
  const [modalElim,    setModalElim]    = useState(null);
  const [textoConfirm, setTextoConfirm] = useState("");
  const [eliminando,   setEliminando]   = useState(false);

  // Modal DataX export
  const [modalDataX,   setModalDataX]   = useState(null); // objeto período
  const [colsDataX,    setColsDataX]    = useState(null); // se inicializa al abrir

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/login"); return; }
      const r = await getUserRoleByUid(user.uid);
      setRol(r);
      if (!["admin", "admin_nomina", "nomina"].includes(r)) { router.push("/nomina"); return; }
      await cargar();
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const cargar = async () => {
    const snap = await getDocs(query(collection(db, "nomina_periodos"), orderBy("actualizadoEn", "desc")));
    setPeriodos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const marcarAprobada = async (id) => {
    if (!confirm("¿Marcar esta nómina como APROBADA? No podrá ser editada.")) return;
    await updateDoc(doc(db, "nomina_periodos", id), { estado: "aprobada", aprobadaEn: new Date() });
    await cargar();
  };

  /* ── Eliminar ── */
  const abrirModalElim  = (p) => { setModalElim(p); setTextoConfirm(""); };
  const cerrarModalElim = () => { setModalElim(null); setTextoConfirm(""); };

  const eliminarNomina = async () => {
    if (textoConfirm !== "ELIMINAR") return;
    setEliminando(true);
    try {
      // 1. Eliminar período principal
      await deleteDoc(doc(db, "nomina_periodos", modalElim.id));
      // 2. Eliminar comprobantes públicos del mismo período
      const despSnap = await getDocs(collection(db, "nomina_desprendibles"));
      const relacionados = despSnap.docs.filter(d => d.data().quincenaId === modalElim.id);
      await Promise.all(relacionados.map(d => deleteDoc(doc(db, "nomina_desprendibles", d.id))));
      setPeriodos(prev => prev.filter(p => p.id !== modalElim.id));
      cerrarModalElim();
    } catch (e) { alert("Error al eliminar: " + e.message); }
    setEliminando(false);
  };

  /* ── Centro de Utilidad por clienteId ── */
  const centroUtilidad = (clienteId) => {
    const cu = { spia:"06", cliente1:"06", cliente2:"04", cliente3:"04" };
    return cu[clienteId] || "";
  };

  /* ── Definición de columnas disponibles para DataX ── */
  const COLS_DATAX = [
    // Identificación
    { key:"centroUtilidad",      label:"Centro Utilidad",        grupo:"Identificación",  datax:true  },
    { key:"centroCostos",        label:"Centro Costo",            grupo:"Identificación",  datax:true  },
    { key:"cedula",              label:"Cédula",                  grupo:"Identificación",  datax:true  },
    { key:"nombre",              label:"Nombre",                  grupo:"Identificación",  datax:true  },
    { key:"cargo",               label:"Cargo",                   grupo:"Identificación",  datax:false },
    // Período
    { key:"fechaInicio",         label:"Fecha Inicio",            grupo:"Período",         datax:false },
    { key:"fechaFin",            label:"Fecha Fin",               grupo:"Período",         datax:false },
    { key:"diasTrabajados",      label:"Días Trabajados",         grupo:"Período",         datax:true  },
    // Devengos
    { key:"basicoMensual",       label:"Básico Mensual",          grupo:"Devengos",        datax:false },
    { key:"salarioBasicoQuincena",label:"Básico Quincena",        grupo:"Devengos",        datax:true  },
    { key:"totalProduccion",     label:"Total Producción",        grupo:"Devengos",        datax:true  },
    { key:"productividad",       label:"Productividad",           grupo:"Devengos",        datax:true  },
    { key:"complementoSalario",  label:"Complemento SMMLV",       grupo:"Devengos",        datax:true  },
    { key:"subsidioTransporte",  label:"Subsidio Transporte",     grupo:"Devengos",        datax:true  },
    { key:"retroactivo",         label:"Retroactivo",             grupo:"Devengos",        datax:false },
    // Deducciones
    { key:"salud",               label:"Salud 4%",                grupo:"Deducciones",     datax:true  },
    { key:"pension",             label:"Pensión 4%",              grupo:"Deducciones",     datax:true  },
    // Resultado
    { key:"baseCotizacion",      label:"Base Cotización",         grupo:"Resultado",       datax:false },
    { key:"salarioMenosDeducciones",label:"Sal. Menos Deducc.",   grupo:"Resultado",       datax:false },
    { key:"netoAPagar",          label:"Neto a Pagar",            grupo:"Resultado",       datax:true  },
    // Adicional
    { key:"observacion",         label:"Observación",             grupo:"Adicional",       datax:false },
  ];

  const PRESET_DATAX   = COLS_DATAX.filter(c => c.datax).map(c => c.key);
  const PRESET_NETO    = ["centroUtilidad","centroCostos","cedula","nombre","netoAPagar"];
  const PRESET_CONTAB  = ["centroUtilidad","centroCostos","cedula","nombre","diasTrabajados","salarioBasicoQuincena","salud","pension","subsidioTransporte","netoAPagar"];

  const abrirDataX = (p) => {
    setColsDataX(new Set(PRESET_DATAX));
    setModalDataX(p);
  };

  const toggleCol = (key) => {
    setColsDataX(prev => {
      const s = new Set(prev);
      s.has(key) ? s.delete(key) : s.add(key);
      return s;
    });
  };

  const exportarDataX = async () => {
    const p = modalDataX;
    try {
      const XLSX = await import("https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs");
      const wb   = XLSX.utils.book_new();
      // Columnas activas en el orden definido
      const activas = COLS_DATAX.filter(c => colsDataX.has(c.key));
      const rows = [];
      // Info header
      rows.push([`DATAX — ${p.nombre}`]);
      rows.push([`Período: ${p.fechaInicio || ""} al ${p.fechaFin || ""}  ·  Empleados: ${(p.empleados||[]).length}`]);
      rows.push([]);
      // Encabezados
      rows.push(activas.map(c => c.label.toUpperCase()));
      // Filas
      (p.empleados || []).forEach(e => {
        const fila = activas.map(c => {
          if (c.key === "centroUtilidad")  return centroUtilidad(e.clienteId || p.clienteId || "");
          if (c.key === "centroCostos")    return e.centroCostos ? e.centroCostos.split(" ")[0] : "";
          if (c.key === "cedula")          return String(e.cedula || "");
          if (c.key === "fechaInicio")     return p.fechaInicio || "";
          if (c.key === "fechaFin")        return p.fechaFin || "";
          const v = e[c.key];
          return (v !== undefined && v !== null) ? v : 0;
        });
        rows.push(fila);
      });
      // Fila de totales numéricos
      const totales = activas.map(c => {
        if (["centroUtilidad","centroCostos","cedula","nombre","cargo","fechaInicio","fechaFin","observacion"].includes(c.key)) return c.key === "nombre" ? "TOTAL" : "";
        const sum = (p.empleados||[]).reduce((a,e) => a + (parseFloat(e[c.key])||0), 0);
        return sum;
      });
      rows.push(totales);
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = activas.map(c => ({
        wch: ["nombre"].includes(c.key) ? 35 : ["centroCostos","cargo"].includes(c.key) ? 22 : ["cedula"].includes(c.key) ? 14 : 16
      }));
      XLSX.utils.book_append_sheet(wb, ws, "DATAX");
      XLSX.writeFile(wb, `datax_${p.id}.xlsx`);
    } catch(err) { alert("Error exportando: " + err.message); }
  };

  /* ── Exportar Excel ── */
  const exportarExcel = async (p) => {
    try {
      const XLSX = await import("https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs");
      const wb   = XLSX.utils.book_new();
      const rows = [];

      // Cabecera informativa
      rows.push([`NÓMINA — ${p.nombre}`]);
      rows.push([`Período: ${p.fechaInicio || ""} al ${p.fechaFin || ""}`]);
      rows.push([`Empleados: ${p.cantidadEmpleados || 0}  ·  Total Neto: ${p.totalGeneral || 0}`]);
      rows.push([]);

      // Encabezados de columna
      rows.push([
        "#","NOMBRE","CÉDULA","CARGO",
        "BÁSICO MENSUAL","TOTAL PRODUCCIÓN","COMPLEMENTO SMMLV","DÍAS",
        "SAL. BÁSICO Q.","PRODUCTIVIDAD","BASE COTIZACIÓN",
        "SALUD 4%","PENSIÓN 4%","RETROACTIVO",
        "SAL. MENOS DEDUCC.","SUBS. TRANSPORTE","NETO A PAGAR","OBSERVACIÓN",
      ]);

      // Filas de empleados
      (p.empleados || []).forEach((e, i) => {
        rows.push([
          i + 1,
          e.nombre,
          String(e.cedula || ""),
          e.cargo,
          e.basicoMensual           || 0,
          e.totalProduccion         || 0,
          e.complementoSalario      || 0,
          e.diasTrabajados          || 0,
          e.salarioBasicoQuincena   || 0,
          e.productividad           || 0,
          e.baseCotizacion          || 0,
          e.salud                   || 0,
          e.pension                 || 0,
          e.retroactivo             || 0,
          e.salarioMenosDeducciones || 0,
          e.subsidioTransporte      || 0,
          e.netoAPagar              || 0,
          e.observacion             || "",
        ]);
      });

      // Fila de totales
      rows.push([
        "TOTAL", "", "", "",
        "", p.totalProduccion  || 0,
        p.totalComplemento     || 0, "",
        "", "", "",
        p.totalSalud           || 0,
        p.totalPension         || 0, "",
        "", p.totalSubsidio    || 0,
        p.totalGeneral         || 0, "",
      ]);

      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = [
        {wch:4},{wch:35},{wch:14},{wch:30},{wch:14},{wch:16},
        {wch:16},{wch:6},{wch:14},{wch:13},{wch:15},
        {wch:11},{wch:11},{wch:12},{wch:18},{wch:16},{wch:15},{wch:28},
      ];
      XLSX.utils.book_append_sheet(wb, ws, "NÓMINA");
      XLSX.writeFile(wb, `nomina_${p.id}.xlsx`);
    } catch (err) { alert("Error exportando Excel: " + err.message); }
  };

  /* ── Exportar CSV (legacy) ── */
  const exportarCSV = (p) => {
    let csv = `NÓMINA — ${p.nombre}\n\n`;
    csv += "NOMBRE,CÉDULA,CARGO,BÁSICO MENSUAL,TOTAL PROD.,DÍAS,SAL. BÁSICO Q.,PRODUCTIV.,SALUD,PENSIÓN,SUBS. TRANSP.,RETROACTIVO,NETO A PAGAR\n";
    (p.empleados || []).forEach(e => {
      csv += `"${e.nombre}","${e.cedula}","${e.cargo}",${e.basicoMensual||0},${e.totalProduccion||0},${e.diasTrabajados||0},${e.salarioBasicoQuincena||0},${e.productividad||0},${e.salud||0},${e.pension||0},${e.subsidioTransporte||0},${e.retroactivo||0},${e.netoAPagar||0}\n`;
    });
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `nomina_${p.id}.csv`;
    a.click();
  };

  const filtrados = periodos.filter(p =>
    !filtro || p.nombre?.toLowerCase().includes(filtro.toLowerCase())
  );

  if (loading) return (
    <LayoutWithSidebar>
      <div style={{ textAlign: "center", padding: "4rem", color: PRIMARY }}>
        <div style={{ fontSize: "2rem" }}>📅 Cargando historial...</div>
      </div>
    </LayoutWithSidebar>
  );

  return (
    <LayoutWithSidebar>
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
          <button onClick={() => router.push("/nomina")}
            style={{ background: "none", border: "none", cursor: "pointer", color: PRIMARY }}>
            <ArrowLeft size={22} />
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, color: PRIMARY, fontSize: "1.6rem", fontWeight: "800" }}>📅 Historial de Nóminas</h1>
            <p style={{ margin: 0, color: "#64748b", fontSize: "0.9rem" }}>{filtrados.length} períodos registrados</p>
          </div>
          <button onClick={() => router.push("/nomina/liquidar")} style={{
            background: PRIMARY, border: "none", borderRadius: "10px",
            padding: "0.75rem 1.25rem", color: "#fff", cursor: "pointer",
            fontWeight: "700", display: "flex", alignItems: "center", gap: "0.5rem",
          }}>
            <CalendarDays size={18} /> Nueva Quincena
          </button>
        </div>

        {/* ── Buscador ── */}
        <div style={{ background: "#fff", borderRadius: "12px", padding: "0.85rem 1.25rem", marginBottom: "1.25rem", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Search size={18} color="#94a3b8" />
          <input value={filtro} onChange={e => setFiltro(e.target.value)} placeholder="Buscar período..."
            style={{ flex: 1, border: "none", outline: "none", fontSize: "0.95rem" }} />
          {filtro && <button onClick={() => setFiltro("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: "1.2rem" }}>×</button>}
        </div>

        {/* ── Lista ── */}
        {filtrados.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: "12px", padding: "3rem", textAlign: "center", color: "#94a3b8", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📅</div>
            <div style={{ fontWeight: "600" }}>No hay nóminas guardadas</div>
            <div style={{ fontSize: "0.85rem", marginTop: "0.5rem" }}>Genera y guarda tu primera nómina desde "Liquidar Nómina"</div>
          </div>
        ) : filtrados.map(p => {
          const isExp      = expandido === p.id;
          const esAprobada = p.estado === "aprobada";
          return (
            <div key={p.id} style={{ background: "#fff", borderRadius: "12px", marginBottom: "1rem", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", overflow: "hidden", border: `1px solid ${esAprobada ? SUCCESS : "#e2e8f0"}` }}>

              {/* Cabecera de la tarjeta */}
              <div style={{ padding: "1.25rem 1.5rem", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>

                {/* Ícono estado */}
                <div style={{ width: "44px", height: "44px", borderRadius: "10px", background: esAprobada ? "#dcfce7" : "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {esAprobada ? <CheckCircle size={22} color={SUCCESS} /> : <Clock size={22} color="#f59e0b" />}
                </div>

                {/* Nombre y estado */}
                <div style={{ flex: 1, minWidth: "150px" }}>
                  <div style={{ fontWeight: "800", color: "#1e293b", fontSize: "1rem" }}>{p.nombre}</div>
                  <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "2px" }}>
                    {p.cantidadEmpleados || 0} empleados ·
                    <span style={{ color: esAprobada ? SUCCESS : "#f59e0b", fontWeight: "600", marginLeft: "4px" }}>
                      {esAprobada ? "✅ Aprobada" : "⏳ Borrador"}
                    </span>
                  </div>
                </div>

                {/* Neto total */}
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: "800", color: PRIMARY, fontSize: "1.1rem" }}>{formatCOP(p.totalGeneral)}</div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Neto total</div>
                </div>

                {/* Botones de acción */}
                <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>

                  {/* DataX */}
                  <button onClick={() => abrirDataX(p)} title="Exportar para DataX"
                    style={{ background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:"8px", padding:"0.5rem 0.75rem", cursor:"pointer", color:"#1d4ed8", fontWeight:"700", fontSize:"0.82rem", display:"flex", alignItems:"center", gap:"0.4rem" }}>
                    <Settings2 size={15}/> DataX
                  </button>

                  {/* Excel */}
                  <button onClick={() => exportarExcel(p)} title="Exportar a Excel (.xlsx)"
                    style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "0.5rem 0.75rem", cursor: "pointer", color: SUCCESS, fontWeight: "700", fontSize: "0.82rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <FileSpreadsheet size={15} /> Excel
                  </button>

                  {/* CSV */}
                  <button onClick={() => exportarCSV(p)} title="Exportar a CSV"
                    style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "0.5rem 0.75rem", cursor: "pointer", color: "#64748b", fontWeight: "600", fontSize: "0.82rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <Download size={15} /> CSV
                  </button>

                  {/* Aprobar */}
                  {!esAprobada && ["admin", "admin_nomina"].includes(rol) && (
                    <button onClick={() => marcarAprobada(p.id)}
                      style={{ background: "#dcfce7", border: "1px solid #86efac", borderRadius: "8px", padding: "0.5rem 0.75rem", cursor: "pointer", color: "#065f46", fontWeight: "700", fontSize: "0.82rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <CheckCircle size={15} /> Aprobar
                    </button>
                  )}

                  {/* Ver en liquidar */}
                  <button onClick={() => router.push(`/nomina/liquidar?q=${p.id}`)}
                    style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: "8px", padding: "0.5rem 0.75rem", cursor: "pointer", color: ACCENT, fontWeight: "700", fontSize: "0.82rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <Eye size={15} /> Ver
                  </button>

                  {/* Eliminar — admin y admin_nomina */}
                  {["admin", "admin_nomina"].includes(rol) && (
                    <button onClick={() => abrirModalElim(p)} title="Eliminar nómina"
                      style={{ background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: "8px", padding: "0.5rem 0.6rem", cursor: "pointer", color: DANGER }}>
                      <Trash2 size={16} />
                    </button>
                  )}

                  {/* Expandir */}
                  <button onClick={() => setExpandido(isExp ? null : p.id)}
                    style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "0.5rem 0.6rem", cursor: "pointer", color: "#64748b" }}>
                    {isExp ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                </div>
              </div>

              {/* Detalle expandido */}
              {isExp && (
                <div style={{ borderTop: "1px solid #f1f5f9", overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                    <thead>
                      <tr style={{ background: "#f8fafc" }}>
                        {["#","Nombre","Cédula","Cargo","Total Prod.","Días","Básico Q.","Salud","Pensión","Subs.Transp.","Neto a Pagar"].map(h => (
                          <th key={h} style={{ padding: "0.6rem 0.8rem", textAlign: ["Nombre","#","Cédula","Cargo"].includes(h) ? "left" : "right", color: "#374151", fontWeight: "700", fontSize: "0.75rem", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(p.empleados || []).map((e, i) => (
                        <tr key={e.cedula || i} style={{ borderBottom: "1px solid #f1f5f9" }}
                          onMouseEnter={el => el.currentTarget.style.background = "#fafafa"}
                          onMouseLeave={el => el.currentTarget.style.background = "transparent"}>
                          <td style={{ padding: "0.55rem 0.8rem", color: "#94a3b8" }}>{i + 1}</td>
                          <td style={{ padding: "0.55rem 0.8rem", fontWeight: "600", whiteSpace: "nowrap" }}>{e.nombre}</td>
                          <td style={{ padding: "0.55rem 0.8rem", fontFamily: "monospace", color: "#64748b" }}>{e.cedula}</td>
                          <td style={{ padding: "0.55rem 0.8rem", color: "#64748b", whiteSpace: "nowrap", fontSize: "0.72rem" }}>{e.cargo}</td>
                          <td style={{ padding: "0.55rem 0.8rem", textAlign: "right", color: SUCCESS, fontFamily: "monospace", fontWeight: "700" }}>{formatCOP(e.totalProduccion)}</td>
                          <td style={{ padding: "0.55rem 0.8rem", textAlign: "center", fontWeight: "700", color: PRIMARY }}>{e.diasTrabajados}</td>
                          <td style={{ padding: "0.55rem 0.8rem", textAlign: "right", fontFamily: "monospace" }}>{formatCOP(e.salarioBasicoQuincena)}</td>
                          <td style={{ padding: "0.55rem 0.8rem", textAlign: "right", fontFamily: "monospace", color: DANGER }}>{formatCOP(e.salud)}</td>
                          <td style={{ padding: "0.55rem 0.8rem", textAlign: "right", fontFamily: "monospace", color: DANGER }}>{formatCOP(e.pension)}</td>
                          <td style={{ padding: "0.55rem 0.8rem", textAlign: "right", fontFamily: "monospace" }}>{formatCOP(e.subsidioTransporte)}</td>
                          <td style={{ padding: "0.55rem 0.8rem", textAlign: "right", fontWeight: "800", color: "#065f46", fontFamily: "monospace", background: "#f0fdf4" }}>{formatCOP(e.netoAPagar)}</td>
                        </tr>
                      ))}
                      <tr style={{ background: "#f0fdf4", borderTop: `2px solid ${SUCCESS}` }}>
                        <td colSpan="4" style={{ padding: "0.7rem 0.8rem", fontWeight: "800", color: "#065f46", fontSize: "0.82rem" }}>TOTALES</td>
                        <td style={{ padding: "0.7rem 0.8rem", textAlign: "right", fontWeight: "800", color: "#065f46", fontFamily: "monospace" }}>{formatCOP(p.totalProduccion)}</td>
                        <td /><td />
                        <td style={{ padding: "0.7rem 0.8rem", textAlign: "right", fontWeight: "800", color: DANGER, fontFamily: "monospace" }}>{formatCOP(p.totalSalud)}</td>
                        <td style={{ padding: "0.7rem 0.8rem", textAlign: "right", fontWeight: "800", color: DANGER, fontFamily: "monospace" }}>{formatCOP(p.totalPension)}</td>
                        <td style={{ padding: "0.7rem 0.8rem", textAlign: "right", fontWeight: "800", color: "#065f46", fontFamily: "monospace" }}>{formatCOP(p.totalSubsidio)}</td>
                        <td style={{ padding: "0.7rem 0.8rem", textAlign: "right", fontWeight: "900", color: "#065f46", fontFamily: "monospace", fontSize: "0.95rem" }}>{formatCOP(p.totalGeneral)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ══════════ MODAL ELIMINAR ══════════ */}
      {modalElim && (
        <div
          onClick={e => { if (e.target === e.currentTarget && !eliminando) cerrarModalElim(); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.62)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ background: "#fff", borderRadius: "18px", padding: "2rem", maxWidth: "460px", width: "100%", boxShadow: "0 30px 70px rgba(0,0,0,0.35)", animation: "fadeUp 0.25s ease" }}>

            {/* Ícono + título */}
            <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
              <div style={{ fontSize: "3.5rem", lineHeight: 1, marginBottom: "0.6rem" }}>🚨</div>
              <h2 style={{ margin: 0, color: "#be123c", fontSize: "1.3rem", fontWeight: "900" }}>Eliminar Nómina</h2>
              <p style={{ margin: "0.35rem 0 0", color: "#64748b", fontSize: "0.88rem" }}>Esta acción <strong>no se puede deshacer</strong></p>
            </div>

            {/* Resumen del período */}
            <div style={{ background: "#fff1f2", border: "1.5px solid #fecdd3", borderRadius: "12px", padding: "1rem 1.1rem", marginBottom: "1.25rem", fontSize: "0.88rem", color: "#374151", lineHeight: 1.7 }}>
              <div><strong>📋 Período:</strong> {modalElim.nombre}</div>
              <div><strong>👷 Empleados:</strong> {modalElim.cantidadEmpleados || 0}</div>
              <div><strong>💰 Total neto:</strong> {formatCOP(modalElim.totalGeneral)}</div>
              <div style={{ marginTop: "0.6rem", padding: "0.5rem 0.75rem", background: "#fff1f2", borderRadius: "8px", color: "#be123c", fontWeight: "700", fontSize: "0.82rem", borderLeft: "3px solid #ef4444" }}>
                ⚠️ También se eliminarán <strong>todos los comprobantes públicos</strong> de este período (página /mi-pago).
              </div>
            </div>

            {/* Input de confirmación */}
            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "700", color: "#374151", marginBottom: "0.5rem" }}>
                Para confirmar escribe{" "}
                <span style={{ fontFamily: "monospace", background: "#f1f5f9", color: "#be123c", padding: "2px 8px", borderRadius: "5px", fontWeight: "900", fontSize: "0.88rem" }}>ELIMINAR</span>:
              </label>
              <input
                autoFocus
                value={textoConfirm}
                onChange={e => setTextoConfirm(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") eliminarNomina(); }}
                disabled={eliminando}
                placeholder="ELIMINAR"
                style={{
                  width: "100%", padding: "0.85rem", boxSizing: "border-box",
                  border: `2px solid ${textoConfirm === "ELIMINAR" ? DANGER : "#e2e8f0"}`,
                  borderRadius: "10px", fontSize: "1rem", fontFamily: "monospace",
                  fontWeight: "700", outline: "none", transition: "border-color 0.2s",
                  background: textoConfirm === "ELIMINAR" ? "#fff1f2" : "#fff",
                }}
              />
            </div>

            {/* Botones */}
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button onClick={cerrarModalElim} disabled={eliminando}
                style={{ flex: 1, padding: "0.85rem", background: "#f1f5f9", border: "none", borderRadius: "10px", color: "#475569", fontWeight: "700", cursor: "pointer", fontSize: "0.92rem" }}>
                Cancelar
              </button>
              <button
                onClick={eliminarNomina}
                disabled={eliminando || textoConfirm !== "ELIMINAR"}
                style={{
                  flex: 2, padding: "0.85rem", border: "none", borderRadius: "10px",
                  color: "#fff", fontWeight: "800", fontSize: "0.92rem",
                  cursor: textoConfirm === "ELIMINAR" ? "pointer" : "not-allowed",
                  background: textoConfirm === "ELIMINAR" ? DANGER : "#94a3b8",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                  transition: "background 0.2s",
                }}>
                {eliminando
                  ? "Eliminando..."
                  : <><Trash2 size={17} /> Confirmar eliminación</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ MODAL DATAX ══════════ */}
      {modalDataX && colsDataX && (() => {
        const grupos = [...new Set(COLS_DATAX.map(c => c.grupo))];
        const p = modalDataX;
        return (
          <div onClick={e => { if (e.target===e.currentTarget) setModalDataX(null); }}
            style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem" }}>
            <div style={{ background:"#fff",borderRadius:"16px",width:"100%",maxWidth:"640px",maxHeight:"92vh",display:"flex",flexDirection:"column",boxShadow:"0 24px 64px rgba(0,0,0,0.3)" }}>

              {/* Header */}
              <div style={{ background:"linear-gradient(135deg,#1d4ed8 0%,#2563eb 100%)",padding:"1.25rem 1.5rem",borderRadius:"16px 16px 0 0",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
                <div>
                  <div style={{ color:"#fff",fontWeight:"800",fontSize:"1.05rem" }}>📊 Exportar para DataX</div>
                  <div style={{ color:"rgba(255,255,255,0.75)",fontSize:"0.8rem",marginTop:"2px" }}>{p.nombre} · {(p.empleados||[]).length} empleados</div>
                </div>
                <button onClick={() => setModalDataX(null)}
                  style={{ background:"rgba(255,255,255,0.15)",border:"none",borderRadius:"8px",padding:"0.5rem",cursor:"pointer",color:"#fff",display:"flex" }}>
                  <X size={18}/>
                </button>
              </div>

              {/* Presets */}
              <div style={{ padding:"1rem 1.5rem 0.5rem",borderBottom:"1px solid #f1f5f9" }}>
                <div style={{ fontSize:"0.74rem",fontWeight:"700",color:"#64748b",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"0.5rem" }}>Presets rápidos</div>
                <div style={{ display:"flex",gap:"0.5rem",flexWrap:"wrap" }}>
                  {[
                    { label:"DataX Estándar",   cols:PRESET_DATAX,  color:"#1d4ed8" },
                    { label:"Sólo Neto",         cols:PRESET_NETO,   color:"#065f46" },
                    { label:"Contabilidad",      cols:PRESET_CONTAB, color:"#7c3aed" },
                    { label:"Todas",             cols:COLS_DATAX.map(c=>c.key), color:"#374151" },
                  ].map(pr => (
                    <button key={pr.label} onClick={() => setColsDataX(new Set(pr.cols))}
                      style={{ padding:"0.35rem 0.9rem",borderRadius:"20px",border:`2px solid ${pr.color}`,background:`${pr.color}12`,color:pr.color,fontWeight:"700",fontSize:"0.78rem",cursor:"pointer" }}>
                      {pr.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Columnas */}
              <div style={{ flex:1,overflowY:"auto",padding:"1rem 1.5rem" }}>
                {grupos.map(grupo => (
                  <div key={grupo} style={{ marginBottom:"1.25rem" }}>
                    <div style={{ fontSize:"0.73rem",fontWeight:"800",color:"#1d4ed8",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"0.5rem",paddingBottom:"0.3rem",borderBottom:"2px solid #dbeafe" }}>
                      {grupo}
                    </div>
                    <div style={{ display:"flex",flexWrap:"wrap",gap:"0.4rem" }}>
                      {COLS_DATAX.filter(c => c.grupo===grupo).map(col => {
                        const activa = colsDataX.has(col.key);
                        return (
                          <button key={col.key} onClick={() => toggleCol(col.key)}
                            style={{ padding:"0.35rem 0.85rem",borderRadius:"8px",border:`1.5px solid ${activa?"#1d4ed8":"#e2e8f0"}`,background:activa?"#eff6ff":"#f8fafc",color:activa?"#1d4ed8":"#94a3b8",fontWeight:activa?"700":"500",fontSize:"0.8rem",cursor:"pointer",display:"flex",alignItems:"center",gap:"0.35rem",transition:"all 0.15s" }}>
                            <span style={{ fontSize:"0.9rem" }}>{activa?"✓":"○"}</span>
                            {col.label}
                            {col.datax && <span style={{ background:"#dbeafe",color:"#1d4ed8",borderRadius:"4px",padding:"0 4px",fontSize:"0.65rem",fontWeight:"800" }}>DX</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <div style={{ background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:"8px",padding:"0.65rem 0.9rem",fontSize:"0.78rem",color:"#1e40af" }}>
                  <strong>ℹ️ Centro Utilidad:</strong> SPIA / Cliente 1 → <strong>06</strong> · Cliente 2 / Cliente 3 → <strong>04</strong> (CIAMSA)<br/>
                  <strong>Centro Costo:</strong> tomado del perfil del trabajador (CC110203, CC110204…)
                </div>
              </div>

              {/* Footer */}
              <div style={{ padding:"1rem 1.5rem",borderTop:"1px solid #f1f5f9",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"0.75rem" }}>
                <div style={{ fontSize:"0.82rem",color:"#64748b" }}>
                  <strong style={{ color:"#1d4ed8" }}>{colsDataX.size}</strong> columnas seleccionadas · {(p.empleados||[]).length} filas
                </div>
                <div style={{ display:"flex",gap:"0.6rem" }}>
                  <button onClick={() => setModalDataX(null)}
                    style={{ padding:"0.7rem 1.1rem",background:"#f1f5f9",border:"none",borderRadius:"10px",color:"#475569",fontWeight:"700",cursor:"pointer",fontSize:"0.88rem" }}>
                    Cancelar
                  </button>
                  <button onClick={exportarDataX} disabled={colsDataX.size===0}
                    style={{ padding:"0.7rem 1.4rem",background:colsDataX.size>0?"#1d4ed8":"#94a3b8",border:"none",borderRadius:"10px",color:"#fff",fontWeight:"800",cursor:colsDataX.size>0?"pointer":"not-allowed",fontSize:"0.88rem",display:"flex",alignItems:"center",gap:"0.5rem" }}>
                    <FileSpreadsheet size={16}/> Exportar DataX (.xlsx)
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      <style jsx global>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
    </LayoutWithSidebar>
  );
}
