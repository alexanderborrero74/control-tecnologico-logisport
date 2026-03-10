// pages/nomina/servicios.js
// Catálogo de servicios y tarifas — con filtro por cliente
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, orderBy, query } from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";
import { getUserRoleByUid } from "@/utils/getUserRole";
import LayoutWithSidebar from "@/components/LayoutWithSidebar";
import { formatCOP } from "@/utils/nominaCalculos";
import { ClipboardList, Plus, Edit2, Trash2, Search, ArrowLeft, X, Save, Upload, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";
import * as XLSX from "xlsx";

const PRIMARY = "#0B3D91";

const CLIENTES_BASE = [
  { id: "spia",     nombre: "SPIA",     color: "#0B3D91", emoji: "🏭" },
  { id: "cliente1", nombre: "Cliente 1",color: "#10b981", emoji: "🏢" },
  { id: "cliente2", nombre: "Cliente 2",color: "#8b5cf6", emoji: "🏗️" },
  { id: "cliente3", nombre: "Cliente 3",color: "#f59e0b", emoji: "🏭" },
];

export default function NominaServicios() {
  const router = useRouter();
  const [rol,          setRol]          = useState(null);
  const [servicios,    setServicios]    = useState([]);
  const [filtro,       setFiltro]       = useState("");
  const [clienteActivo,setClienteActivo]= useState("spia");
  const [clientes,     setClientes]     = useState(CLIENTES_BASE);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando,     setEditando]     = useState(null);
  const [form,         setForm]         = useState({ nombre: "", valor: "", clienteId: "spia" });
  const [guardando,    setGuardando]    = useState(false);
  const [loading,      setLoading]      = useState(true);

  // ── Importación Excel ──
  const [modalImport,    setModalImport]    = useState(false);
  const [importParsed,   setImportParsed]   = useState(null);  // { nuevos, actualizados, sinCambio }
  const [importFile,     setImportFile]     = useState(null);
  const [importando,     setImportando]     = useState(false);
  const [importOk,       setImportOk]       = useState(null);  // { nuevos, actualizados }
  const [importError,    setImportError]    = useState("");

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/login"); return; }
      const r = await getUserRoleByUid(user.uid);
      setRol(r);
      if (!["admin", "admin_nomina", "nomina"].includes(r)) { router.push("/nomina"); return; }
      await Promise.all([cargar(), cargarClientes()]);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const cargar = async () => {
    const snap = await getDocs(query(collection(db, "nomina_servicios"), orderBy("nombre")));
    setServicios(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const cargarClientes = async () => {
    try {
      const snap = await getDocs(collection(db, "nomina_clientes"));
      if (!snap.empty) {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const orden = ["spia","cliente1","cliente2","cliente3"];
        data.sort((a,b) => orden.indexOf(a.id) - orden.indexOf(b.id));
        // Combinar con CLIENTES_BASE para emoji/color por defecto
        const merged = data
          .filter(c => c.id !== "admon") // Excluir ADMON SPIA de servicios
          .map(c => {
            const base = CLIENTES_BASE.find(b => b.id === c.id);
            return { ...base, ...c };
          });
        setClientes(merged.length > 0 ? merged : CLIENTES_BASE);
      }
    } catch {}
  };

  const abrirNuevo = () => {
    setEditando(null);
    setForm({ nombre: "", valor: "", clienteId: clienteActivo });
    setModalAbierto(true);
  };

  const abrirEditar = (s) => {
    setEditando(s);
    setForm({ nombre: s.nombre || "", valor: s.valor || "", clienteId: s.clienteId || "spia" });
    setModalAbierto(true);
  };

  const guardar = async () => {
    if (!form.nombre.trim() || !form.valor) return;
    setGuardando(true);
    const data = {
      nombre:       form.nombre.trim().toUpperCase(),
      valor:        parseFloat(form.valor),
      clienteId:    form.clienteId || "spia",
      actualizadoEn: new Date(),
    };
    try {
      if (editando) {
        await updateDoc(doc(db, "nomina_servicios", editando.id), data);
      } else {
        await addDoc(collection(db, "nomina_servicios"), { ...data, creadoEn: new Date() });
      }
      await cargar();
      setModalAbierto(false);
    } catch (e) {
      alert("Error: " + e.message);
    }
    setGuardando(false);
  };

  const eliminar = async (s) => {
    if (!confirm(`¿Eliminar servicio "${s.nombre}"?`)) return;
    await deleteDoc(doc(db, "nomina_servicios", s.id));
    await cargar();
  };

  // ── Parsear Excel con SheetJS ──
  const parsearExcel = async (file) => {
    setImportError("");
    setImportParsed(null);
    try {
      const buf  = await file.arrayBuffer();
      const wb   = XLSX.read(new Uint8Array(buf), { type: "array" });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

      // Fila 1 = encabezado, desde fila 2 en adelante son datos
      const serviciosExcel = [];
      for (let i = 1; i < rows.length; i++) {
        const nombre = String(rows[i][0] || "").trim().toUpperCase();
        const valor  = parseFloat(rows[i][1]) || 0;
        if (nombre && valor > 0) serviciosExcel.push({ nombre, valor });
      }

      if (!serviciosExcel.length) {
        setImportError("No se encontraron servicios válidos en el archivo.");
        return;
      }

      // Comparar con los servicios existentes del cliente activo
      const existentes = servicios.filter(s => (s.clienteId || "spia") === clienteActivo);
      const mapaExistente = {};
      existentes.forEach(s => { mapaExistente[(s.nombre || "").trim().toUpperCase()] = s; });

      const nuevos       = [];
      const actualizados = [];
      const sinCambio    = [];

      serviciosExcel.forEach(({ nombre, valor }) => {
        const existe = mapaExistente[nombre];
        if (!existe) {
          nuevos.push({ nombre, valor });
        } else if (Math.round(existe.valor) !== Math.round(valor)) {
          actualizados.push({ nombre, valor, valorAnterior: existe.valor, id: existe.id });
        } else {
          sinCambio.push({ nombre, valor });
        }
      });

      setImportParsed({ nuevos, actualizados, sinCambio, total: serviciosExcel.length });
    } catch (e) {
      setImportError("Error al leer el archivo: " + e.message);
    }
  };

  const onFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    await parsearExcel(file);
  };

  const confirmarImportacion = async () => {
    if (!importParsed) return;
    setImportando(true);
    try {
      const { writeBatch } = await import("firebase/firestore");
      let totalNuevos = 0;
      let totalActualizados = 0;

      // Actualizar tarifas existentes en lote
      if (importParsed.actualizados.length) {
        const batch = writeBatch(db);
        importParsed.actualizados.forEach(s => {
          batch.update(doc(db, "nomina_servicios", s.id), {
            valor: Math.round(s.valor * 100) / 100,
            actualizadoEn: new Date(),
          });
        });
        await batch.commit();
        totalActualizados = importParsed.actualizados.length;
      }

      // Agregar nuevos servicios
      for (const s of importParsed.nuevos) {
        await addDoc(collection(db, "nomina_servicios"), {
          nombre:       s.nombre,
          valor:        Math.round(s.valor * 100) / 100,
          clienteId:    clienteActivo,
          creadoEn:     new Date(),
          actualizadoEn: new Date(),
        });
        totalNuevos++;
      }

      await cargar();
      setImportOk({ nuevos: totalNuevos, actualizados: totalActualizados });
      setImportParsed(null);
      setImportFile(null);
      setTimeout(() => { setImportOk(null); setModalImport(false); }, 3000);
    } catch (e) {
      setImportError("Error al guardar: " + e.message);
    }
    setImportando(false);
  };

  const abrirModalImport = () => {
    setImportParsed(null);
    setImportFile(null);
    setImportError("");
    setImportOk(null);
    setModalImport(true);
  };

  const limpiarDuplicados = async () => {
    // Detectar duplicados: mismo nombre (trim+upper) + mismo clienteId
    const grupos = {};
    servicios.forEach(s => {
      const key = `${(s.clienteId || "spia")}__${(s.nombre || "").trim().toUpperCase()}`;
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(s);
    });
    // Quedar solo con los que tienen más de 1
    const duplicados = [];
    Object.values(grupos).forEach(arr => {
      if (arr.length > 1) {
        // Ordenar por creadoEn para conservar el más antiguo
        arr.sort((a, b) => {
          const fa = a.creadoEn?.toDate?.() || new Date(0);
          const fb = b.creadoEn?.toDate?.() || new Date(0);
          return fa - fb;
        });
        // Los que sobran (todos menos el primero) se eliminan
        duplicados.push(...arr.slice(1));
      }
    });
    if (duplicados.length === 0) {
      alert("✅ No hay duplicados en ningún cliente.");
      return;
    }
    // Resumen por cliente antes de confirmar
    const resumen = {};
    duplicados.forEach(s => {
      const cli = clientes.find(c => c.id === (s.clienteId || "spia"))?.nombre || s.clienteId || "spia";
      resumen[cli] = (resumen[cli] || 0) + 1;
    });
    const resumenTexto = Object.entries(resumen)
      .map(([cli, n]) => `• ${cli}: ${n} duplicados`).join("\n");
    if (!confirm(`Se encontraron ${duplicados.length} servicios duplicados:\n\n${resumenTexto}\n\n¿Eliminar los duplicados? (se conserva el registro más antiguo de cada uno)`)) return;
    // Eliminar en batch
    const { writeBatch } = await import("firebase/firestore");
    const batch = writeBatch(db);
    duplicados.forEach(s => batch.delete(doc(db, "nomina_servicios", s.id)));
    await batch.commit();
    await cargar();
    alert(`✅ ${duplicados.length} duplicados eliminados correctamente.`);
  };

  // Filtrar por cliente activo (sin clienteId → asumir spia)
  const serviciosFiltradosCliente = servicios.filter(s => (s.clienteId || "spia") === clienteActivo);
  const filtrados = serviciosFiltradosCliente.filter(s =>
    s.nombre?.toLowerCase().includes(filtro.toLowerCase())
  );

  const clienteInfo = clientes.find(c => c.id === clienteActivo) || CLIENTES_BASE[0];

  if (loading) return (
    <LayoutWithSidebar>
      <div style={{ textAlign: "center", padding: "4rem", color: PRIMARY }}>
        <div style={{ fontSize: "2rem" }}>📋 Cargando servicios...</div>
      </div>
    </LayoutWithSidebar>
  );

  return (
    <LayoutWithSidebar>
      <div style={{ maxWidth: "1000px", margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem", flexWrap:"wrap" }}>
          <button onClick={() => router.push("/nomina")} style={{ background: "none", border: "none", cursor: "pointer", color: PRIMARY }}>
            <ArrowLeft size={22} />
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, color: PRIMARY, fontSize: "1.6rem", fontWeight: "800" }}>📋 Servicios y Tarifas</h1>
            <p style={{ margin: 0, color: "#64748b", fontSize: "0.9rem" }}>
              {filtrados.length} servicios · {clienteInfo.emoji} {clienteInfo.nombre}
            </p>
          </div>
          <div style={{ display:"flex", gap:"0.5rem", flexWrap:"wrap" }}>
            <button onClick={limpiarDuplicados} style={{
              background: "#fff7ed", border: "1.5px solid #f59e0b", borderRadius: "10px",
              padding: "0.75rem 1.1rem", color: "#b45309", cursor: "pointer",
              fontWeight: "700", display: "flex", alignItems: "center", gap: "0.5rem", fontSize:"0.88rem",
            }}>
              🧹 Limpiar duplicados
            </button>
            <button onClick={abrirModalImport} style={{
              background: "#f0fdf4", border: "1.5px solid #10b981", borderRadius: "10px",
              padding: "0.75rem 1.1rem", color: "#065f46", cursor: "pointer",
              fontWeight: "700", display: "flex", alignItems: "center", gap: "0.5rem", fontSize:"0.88rem",
            }}>
              <Upload size={16}/> Importar Excel
            </button>
            <button onClick={abrirNuevo} style={{
              background: clienteInfo.color || PRIMARY, border: "none", borderRadius: "10px",
              padding: "0.75rem 1.25rem", color: "#fff", cursor: "pointer",
              fontWeight: "700", display: "flex", alignItems: "center", gap: "0.5rem",
            }}>
              <Plus size={18} /> Nuevo Servicio
            </button>
          </div>
        </div>

        {/* Selector de cliente */}
        <div style={{ display:"flex", gap:"0.5rem", marginBottom:"1.25rem", flexWrap:"wrap" }}>
          {clientes.map(c => (
            <button key={c.id}
              onClick={() => { setClienteActivo(c.id); setFiltro(""); }}
              style={{
                padding:"0.5rem 1.1rem", borderRadius:"20px", border:"2px solid",
                borderColor: clienteActivo === c.id ? (c.color || PRIMARY) : "#e2e8f0",
                background:  clienteActivo === c.id ? `${c.color || PRIMARY}15` : "#f8fafc",
                color:       clienteActivo === c.id ? (c.color || PRIMARY) : "#64748b",
                fontWeight:  clienteActivo === c.id ? "700" : "500",
                cursor:"pointer", fontSize:"0.87rem", transition:"all 0.15s",
                display:"flex", alignItems:"center", gap:"0.35rem",
              }}>
              {c.emoji || "🏭"} {c.nombre}
              <span style={{
                background: clienteActivo === c.id ? (c.color || PRIMARY) : "#e2e8f0",
                color: clienteActivo === c.id ? "#fff" : "#64748b",
                borderRadius:"10px", padding:"0 6px", fontSize:"0.72rem", fontWeight:"700",
              }}>
                {servicios.filter(s => (s.clienteId || "spia") === c.id).length}
              </span>
            </button>
          ))}
        </div>

        {/* Buscador */}
        <div style={{
          background: "#fff", borderRadius: "12px", padding: "1rem 1.25rem",
          marginBottom: "1.25rem", boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          display: "flex", alignItems: "center", gap: "0.75rem",
        }}>
          <Search size={18} color="#94a3b8" />
          <input value={filtro} onChange={e => setFiltro(e.target.value)}
            placeholder={`Buscar en servicios de ${clienteInfo.nombre}...`}
            style={{ flex: 1, border: "none", outline: "none", fontSize: "0.95rem", background: "transparent" }}
          />
          {filtro && <button onClick={() => setFiltro("")} style={{ background: "none", border: "none", cursor: "pointer" }}>
            <X size={16} color="#94a3b8" />
          </button>}
        </div>

        {/* Tabla */}
        <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: clienteInfo.color || PRIMARY, color: "#fff" }}>
                {["#", "Nombre del Servicio", "Valor (COP)", "Acciones"].map(h => (
                  <th key={h} style={{ padding: "0.9rem 1rem", textAlign: "left", fontSize: "0.85rem", fontWeight: "700" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((s, i) => (
                <tr key={s.id} style={{ borderBottom: "1px solid #f1f5f9" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ padding: "0.85rem 1rem", color: "#94a3b8", fontSize: "0.85rem" }}>{i + 1}</td>
                  <td style={{ padding: "0.85rem 1rem", fontWeight: "600", color: "#1e293b" }}>{s.nombre}</td>
                  <td style={{ padding: "0.85rem 1rem", color: "#10b981", fontWeight: "700", fontFamily: "monospace" }}>
                    {formatCOP(s.valor)}
                  </td>
                  <td style={{ padding: "0.85rem 1rem" }}>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button onClick={() => abrirEditar(s)} style={{
                        background: "#f0f9ff", border: "none", borderRadius: "6px",
                        padding: "0.35rem 0.5rem", cursor: "pointer", color: "#00AEEF",
                      }}>
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => eliminar(s)} style={{
                        background: "#fff1f2", border: "none", borderRadius: "6px",
                        padding: "0.35rem 0.5rem", cursor: "pointer", color: "#ef4444",
                      }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan="4" style={{ textAlign: "center", padding: "3rem", color: "#94a3b8" }}>
                    {serviciosFiltradosCliente.length === 0
                      ? `Sin servicios para ${clienteInfo.nombre}. Usa "⚡ Inicializar Datos" en la sección Clientes.`
                      : "No se encontraron servicios con ese filtro"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal Importar Excel ── */}
      {modalImport && (
        <div style={{
          position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",
          zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem",
        }} onClick={e => { if(e.target===e.currentTarget && !importando) setModalImport(false); }}>
          <div style={{
            background:"#fff",borderRadius:"16px",padding:"2rem",
            width:"100%",maxWidth:"600px",boxShadow:"0 20px 60px rgba(0,0,0,0.25)",
            maxHeight:"90vh",overflowY:"auto",
          }}>
            {/* Cabecera */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.25rem"}}>
              <div>
                <h2 style={{margin:0,color:PRIMARY,fontWeight:"800",fontSize:"1.25rem"}}>
                  📥 Importar Tarifas desde Excel
                </h2>
                <p style={{margin:"0.2rem 0 0",color:"#64748b",fontSize:"0.85rem"}}>
                  Cliente: {clienteInfo.emoji} <strong>{clienteInfo.nombre}</strong>
                </p>
              </div>
              {!importando && (
                <button onClick={()=>setModalImport(false)} style={{background:"none",border:"none",cursor:"pointer"}}>
                  <X size={22} color="#94a3b8"/>
                </button>
              )}
            </div>

            {/* Instrucciones */}
            <div style={{
              background:"#f0f9ff",border:"1.5px solid #bae6fd",borderRadius:"10px",
              padding:"0.85rem 1rem",marginBottom:"1.25rem",fontSize:"0.83rem",color:"#0369a1",lineHeight:1.5
            }}>
              📋 <strong>Formato esperado:</strong> columna A = nombre del servicio, columna B = valor tarifa.<br/>
              La fila 1 se toma como encabezado y se omite. Los nombres se comparan sin importar mayúsculas/espacios.
            </div>

            {/* Selector archivo */}
            <label style={{
              display:"flex",alignItems:"center",gap:"0.75rem",
              border:"2px dashed #cbd5e1",borderRadius:"12px",
              padding:"1.25rem",cursor:"pointer",marginBottom:"1rem",
              background: importFile ? "#f0fdf4" : "#f8fafc",
              borderColor: importFile ? "#10b981" : "#cbd5e1",
              transition:"all 0.15s",
            }}>
              <input type="file" accept=".xlsx,.xls" onChange={onFileChange}
                style={{display:"none"}} disabled={importando}/>
              <Upload size={22} color={importFile ? "#10b981" : "#94a3b8"}/>
              <div>
                <div style={{fontWeight:"700",color: importFile ? "#065f46" : "#374151",fontSize:"0.9rem"}}>
                  {importFile ? importFile.name : "Seleccionar archivo Excel (.xlsx)"}
                </div>
                <div style={{color:"#94a3b8",fontSize:"0.78rem"}}>
                  {importFile ? "Clic para cambiar archivo" : "Arrastra o haz clic aquí"}
                </div>
              </div>
            </label>

            {/* Error */}
            {importError && (
              <div style={{
                background:"#fef2f2",border:"1.5px solid #fca5a5",borderRadius:"10px",
                padding:"0.75rem 1rem",marginBottom:"1rem",color:"#991b1b",
                display:"flex",alignItems:"center",gap:"0.5rem",fontSize:"0.88rem",
              }}>
                <AlertCircle size={16}/> {importError}
              </div>
            )}

            {/* Preview resultados */}
            {importParsed && (
              <div style={{marginBottom:"1.25rem"}}>
                {/* Resumen en tarjetas */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0.75rem",marginBottom:"1.1rem"}}>
                  <div style={{background:"#f0fdf4",border:"1.5px solid #86efac",borderRadius:"10px",padding:"0.85rem",textAlign:"center"}}>
                    <div style={{fontSize:"1.6rem",fontWeight:"900",color:"#15803d"}}>{importParsed.nuevos.length}</div>
                    <div style={{fontSize:"0.78rem",color:"#166534",fontWeight:"700"}}>✨ Nuevos</div>
                  </div>
                  <div style={{background:"#fffbeb",border:"1.5px solid #fcd34d",borderRadius:"10px",padding:"0.85rem",textAlign:"center"}}>
                    <div style={{fontSize:"1.6rem",fontWeight:"900",color:"#b45309"}}>{importParsed.actualizados.length}</div>
                    <div style={{fontSize:"0.78rem",color:"#92400e",fontWeight:"700"}}>🔄 Actualizados</div>
                  </div>
                  <div style={{background:"#f8fafc",border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"0.85rem",textAlign:"center"}}>
                    <div style={{fontSize:"1.6rem",fontWeight:"900",color:"#64748b"}}>{importParsed.sinCambio.length}</div>
                    <div style={{fontSize:"0.78rem",color:"#475569",fontWeight:"700"}}>✅ Sin cambio</div>
                  </div>
                </div>

                {/* Tabla detalle actualizados */}
                {importParsed.actualizados.length > 0 && (
                  <div style={{marginBottom:"0.75rem"}}>
                    <div style={{fontWeight:"700",color:"#92400e",fontSize:"0.83rem",marginBottom:"0.4rem"}}>🔄 Cambios de tarifa:</div>
                    <div style={{maxHeight:"160px",overflowY:"auto",border:"1px solid #fcd34d",borderRadius:"8px",overflow:"hidden"}}>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:"0.78rem"}}>
                        <thead>
                          <tr style={{background:"#fffbeb"}}>
                            <th style={{padding:"0.4rem 0.6rem",textAlign:"left",color:"#92400e",fontWeight:"700"}}>Servicio</th>
                            <th style={{padding:"0.4rem 0.6rem",textAlign:"right",color:"#92400e",fontWeight:"700"}}>Antes</th>
                            <th style={{padding:"0.4rem 0.6rem",textAlign:"right",color:"#92400e",fontWeight:"700"}}>Nuevo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importParsed.actualizados.map((s,i)=>(
                            <tr key={i} style={{borderTop:"1px solid #fef9c3",background:i%2===0?"#fff":"#fffbeb"}}>
                              <td style={{padding:"0.35rem 0.6rem",color:"#1e293b",fontWeight:"600",maxWidth:"220px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={s.nombre}>{s.nombre}</td>
                              <td style={{padding:"0.35rem 0.6rem",textAlign:"right",color:"#94a3b8",fontFamily:"monospace",textDecoration:"line-through"}}>{formatCOP(s.valorAnterior)}</td>
                              <td style={{padding:"0.35rem 0.6rem",textAlign:"right",color:"#15803d",fontFamily:"monospace",fontWeight:"800"}}>{formatCOP(s.valor)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Tabla detalle nuevos */}
                {importParsed.nuevos.length > 0 && (
                  <div style={{marginBottom:"0.75rem"}}>
                    <div style={{fontWeight:"700",color:"#15803d",fontSize:"0.83rem",marginBottom:"0.4rem"}}>✨ Servicios nuevos a agregar:</div>
                    <div style={{maxHeight:"120px",overflowY:"auto",border:"1px solid #86efac",borderRadius:"8px",overflow:"hidden"}}>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:"0.78rem"}}>
                        <tbody>
                          {importParsed.nuevos.map((s,i)=>(
                            <tr key={i} style={{borderTop:i?"1px solid #dcfce7":"none",background:i%2===0?"#fff":"#f0fdf4"}}>
                              <td style={{padding:"0.35rem 0.75rem",color:"#1e293b",fontWeight:"600"}}>{s.nombre}</td>
                              <td style={{padding:"0.35rem 0.75rem",textAlign:"right",color:"#15803d",fontFamily:"monospace",fontWeight:"800"}}>{formatCOP(s.valor)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Éxito */}
            {importOk && (
              <div style={{
                background:"#f0fdf4",border:"1.5px solid #86efac",borderRadius:"10px",
                padding:"1rem",marginBottom:"1rem",textAlign:"center",
              }}>
                <CheckCircle size={28} color="#15803d" style={{marginBottom:"0.35rem"}}/>
                <div style={{fontWeight:"800",color:"#15803d",fontSize:"1rem"}}>¡Importación exitosa!</div>
                <div style={{color:"#166534",fontSize:"0.85rem",marginTop:"0.2rem"}}>
                  {importOk.nuevos} nuevos · {importOk.actualizados} actualizados
                </div>
              </div>
            )}

            {/* Botón confirmar */}
            {importParsed && !importOk && (
              <button onClick={confirmarImportacion} disabled={importando
                || (importParsed.nuevos.length === 0 && importParsed.actualizados.length === 0)}
                style={{
                  width:"100%",padding:"0.9rem",
                  background: (importParsed.nuevos.length + importParsed.actualizados.length) === 0
                    ? "#e2e8f0" : "#10b981",
                  border:"none",borderRadius:"10px",color:"#fff",
                  fontWeight:"700",fontSize:"1rem",cursor:"pointer",
                  display:"flex",alignItems:"center",justifyContent:"center",gap:"0.5rem",
                  opacity: importando ? 0.7 : 1,
                }}>
                {importando
                  ? <><RefreshCw size={18} className="spin"/> Guardando...</>
                  : (importParsed.nuevos.length + importParsed.actualizados.length) === 0
                    ? "✅ Todo está actualizado, nada que cambiar"
                    : `✅ Confirmar — ${importParsed.nuevos.length + importParsed.actualizados.length} cambios`
                }
              </button>
            )}
          </div>
        </div>
      )}

      {/* Modal crear/editar */}
      {modalAbierto && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={e => { if (e.target === e.currentTarget) setModalAbierto(false); }}>
          <div style={{
            background: "#fff", borderRadius: "16px", padding: "2rem",
            width: "100%", maxWidth: "460px", boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <h2 style={{ margin: 0, color: PRIMARY, fontWeight: "800" }}>
                {editando ? "✏️ Editar Servicio" : "➕ Nuevo Servicio"}
              </h2>
              <button onClick={() => setModalAbierto(false)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={22} color="#94a3b8" />
              </button>
            </div>

            {/* Selector cliente en modal */}
            <div style={{ marginBottom:"1rem" }}>
              <label style={{ display:"block", fontWeight:"600", color:"#374151", marginBottom:"0.35rem", fontSize:"0.88rem" }}>
                Cliente
              </label>
              <select value={form.clienteId} onChange={e => setForm({...form, clienteId: e.target.value})}
                style={{ width:"100%", padding:"0.7rem 0.9rem", border:"1.5px solid #e2e8f0", borderRadius:"8px", fontSize:"0.95rem" }}>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.nombre}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontWeight: "600", color: "#374151", marginBottom: "0.35rem", fontSize: "0.88rem" }}>
                Nombre del servicio *
              </label>
              <input type="text" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })}
                placeholder="DIAN 40 (ORDINARIO)"
                style={{ width: "100%", padding: "0.7rem 0.9rem", border: "1.5px solid #e2e8f0", borderRadius: "8px", fontSize: "0.95rem", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ display: "block", fontWeight: "600", color: "#374151", marginBottom: "0.35rem", fontSize: "0.88rem" }}>
                Valor del servicio (COP) *
              </label>
              <input type="number" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })}
                placeholder="90750"
                style={{ width: "100%", padding: "0.7rem 0.9rem", border: "1.5px solid #e2e8f0", borderRadius: "8px", fontSize: "0.95rem", boxSizing: "border-box" }}
              />
            </div>

            <button onClick={guardar} disabled={guardando} style={{
              width: "100%", padding: "0.9rem", background: PRIMARY, border: "none",
              borderRadius: "10px", color: "#fff", fontWeight: "700", fontSize: "1rem",
              cursor: guardando ? "not-allowed" : "pointer", display: "flex",
              alignItems: "center", justifyContent: "center", gap: "0.5rem",
              opacity: guardando ? 0.7 : 1,
            }}>
              <Save size={18} /> {guardando ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      )}
    </LayoutWithSidebar>
  );
}
