// pages/nomina/adelantos.js
// Gestión de adelantos de salario y comida — se descuentan en la liquidación

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, query, orderBy, where
} from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";
import { getUserRoleByUid } from "@/utils/getUserRole";
import LayoutWithSidebar from "@/components/LayoutWithSidebar";
import { formatCOP } from "@/utils/nominaCalculos";
import { CreditCard, Utensils, Plus, ArrowLeft, X, Save, Search, Trash2 } from "lucide-react";

const PRIMARY = "#0B3D91";
const ACCENT  = "#00AEEF";

// ─── Clientes disponibles ────────────────────────────────────────────────────
const CLIENTES_BASE = [
  { id: "spia",     nombre: "SPIA" },
  { id: "cliente1", nombre: "Cliente 1" },
  { id: "cliente2", nombre: "Cliente 2" },
  { id: "cliente3", nombre: "Cliente 3" },
];

export default function NominaAdelantos() {
  const router = useRouter();
  const [rol,    setRol]    = useState(null);
  const [tab,    setTab]    = useState("adelantos"); // "adelantos" | "comida"
  const [loading, setLoading] = useState(true);

  // ── Adelantos ──
  const [adelantos,      setAdelantos]      = useState([]);
  const [filtro,         setFiltro]         = useState("");
  const [filtroEstado,   setFiltroEstado]   = useState("todos");
  const [modalAbierto,   setModalAbierto]   = useState(false);
  const [formAd,         setFormAd]         = useState({ trabajadorNombre:"", cedula:"", monto:"", motivo:"", fecha: new Date().toISOString().split("T")[0] });
  const [guardandoAd,    setGuardandoAd]    = useState(false);
  const [busqTrabAd,     setBusqTrabAd]     = useState("");

  // ── Comida ──
  const [comidas,        setComidas]        = useState([]);
  const [filtroComida,   setFiltroComida]   = useState("");
  const [modalComida,    setModalComida]    = useState(false);
  const [formCom,        setFormCom]        = useState({ trabajadorNombre:"", cedula:"", clienteId:"spia", cantidad:"", valor:"", fecha: new Date().toISOString().split("T")[0] });
  const [guardandoCom,   setGuardandoCom]   = useState(false);
  const [busqTrabCom,    setBusqTrabCom]    = useState("");

  // ── Trabajadores compartidos ──
  const [trabajadores,   setTrabajadores]   = useState([]);
  const [clientes,       setClientes]       = useState(CLIENTES_BASE);

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/login"); return; }
      const r = await getUserRoleByUid(user.uid);
      setRol(r);
      if (!["admin","admin_nomina","rrhh","nomina"].includes(r)) { router.push("/nomina"); return; }
      await Promise.all([
        cargarAdelantos(), cargarComidas(), cargarTrabajadores(), cargarClientes()
      ]);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // ── Loaders ─────────────────────────────────────────────────────────────────
  const cargarAdelantos = async () => {
    const snap = await getDocs(query(collection(db,"nomina_adelantos"), orderBy("fecha","desc")));
    setAdelantos(snap.docs.map(d => ({ id:d.id, ...d.data() })));
  };

  const cargarComidas = async () => {
    const snap = await getDocs(query(collection(db,"nomina_comida"), orderBy("fecha","desc")));
    setComidas(snap.docs.map(d => ({ id:d.id, ...d.data() })));
  };

  const cargarTrabajadores = async () => {
    const snap = await getDocs(query(collection(db,"nomina_trabajadores"), orderBy("nombre")));
    setTrabajadores(snap.docs.map(d => ({ id:d.id, ...d.data() })));
  };

  const cargarClientes = async () => {
    try {
      const snap = await getDocs(collection(db,"nomina_clientes"));
      if (!snap.empty) {
        setClientes(CLIENTES_BASE.map(b => {
          const d = snap.docs.find(x => x.id === b.id);
          return d ? { ...b, nombre: d.data().nombre || b.nombre } : b;
        }));
      }
    } catch {}
  };

  // ════════════════════════════════════════════════════════════════════════════
  // ADELANTOS — CRUD
  // ════════════════════════════════════════════════════════════════════════════
  const trabFiltradosAd = trabajadores.filter(t =>
    !busqTrabAd ||
    t.nombre.toLowerCase().includes(busqTrabAd.toLowerCase()) ||
    String(t.cedula).includes(busqTrabAd)
  );

  const guardarAdelanto = async () => {
    if (!formAd.cedula || !formAd.monto || parseFloat(formAd.monto) <= 0) {
      alert("Seleccione trabajador y monto válido"); return;
    }
    setGuardandoAd(true);
    try {
      await addDoc(collection(db,"nomina_adelantos"), {
        trabajadorNombre: formAd.trabajadorNombre.trim().toUpperCase(),
        cedula:  formAd.cedula.trim(),
        monto:   parseFloat(formAd.monto),
        motivo:  formAd.motivo.trim(),
        fecha:   new Date(formAd.fecha + "T12:00:00"),
        estado:  "pendiente",
        creadoEn: new Date(),
      });
      await cargarAdelantos();
      setModalAbierto(false);
      setBusqTrabAd("");
      setFormAd({ trabajadorNombre:"", cedula:"", monto:"", motivo:"", fecha: new Date().toISOString().split("T")[0] });
    } catch (e) { alert("Error: " + e.message); }
    setGuardandoAd(false);
  };

  const cambiarEstadoAd = async (id, nuevoEstado) => {
    await updateDoc(doc(db,"nomina_adelantos",id), { estado:nuevoEstado, actualizadoEn:new Date() });
    await cargarAdelantos();
  };

  const eliminarAdelanto = async (id) => {
    if (!confirm("¿Eliminar este adelanto?")) return;
    await deleteDoc(doc(db,"nomina_adelantos",id));
    await cargarAdelantos();
  };

  const adelantosFiltrados = adelantos.filter(a => {
    const txtOk = !filtro || a.trabajadorNombre?.toLowerCase().includes(filtro.toLowerCase()) || a.cedula?.includes(filtro);
    const estOk = filtroEstado === "todos" || a.estado === filtroEstado;
    return txtOk && estOk;
  });

  const totalPendienteAd  = adelantos.filter(a => a.estado === "pendiente").reduce((s,a) => s + (a.monto||0), 0);
  const totalDescontadoAd = adelantos.filter(a => a.estado === "descontado").reduce((s,a) => s + (a.monto||0), 0);

  const estAdStyle = {
    pendiente:  { bg:"#fef3c7", color:"#92400e" },
    descontado: { bg:"#dcfce7", color:"#065f46" },
    cancelado:  { bg:"#fee2e2", color:"#991b1b" },
  };

  // ════════════════════════════════════════════════════════════════════════════
  // COMIDA — CRUD
  // ════════════════════════════════════════════════════════════════════════════
  const trabFiltradosCom = trabajadores.filter(t =>
    !busqTrabCom ||
    t.nombre.toLowerCase().includes(busqTrabCom.toLowerCase()) ||
    String(t.cedula).includes(busqTrabCom)
  );

  const guardarComida = async () => {
    if (!formCom.cedula || !formCom.cantidad || !formCom.valor || parseFloat(formCom.valor) <= 0) {
      alert("Seleccione trabajador, cantidad y valor válido"); return;
    }
    setGuardandoCom(true);
    try {
      await addDoc(collection(db,"nomina_comida"), {
        trabajadorNombre: formCom.trabajadorNombre.trim().toUpperCase(),
        cedula:    formCom.cedula.trim(),
        clienteId: formCom.clienteId,
        clienteNombre: clientes.find(c => c.id === formCom.clienteId)?.nombre || formCom.clienteId,
        cantidad:  parseInt(formCom.cantidad) || 1,
        valor:     parseFloat(formCom.valor),
        total:     (parseInt(formCom.cantidad)||1) * parseFloat(formCom.valor),
        fecha:     new Date(formCom.fecha + "T12:00:00"),
        estado:    "pendiente",
        creadoEn:  new Date(),
      });
      await cargarComidas();
      setModalComida(false);
      setBusqTrabCom("");
      setFormCom({ trabajadorNombre:"", cedula:"", clienteId:"spia", cantidad:"", valor:"", fecha: new Date().toISOString().split("T")[0] });
    } catch (e) { alert("Error: " + e.message); }
    setGuardandoCom(false);
  };

  const cambiarEstadoCom = async (id, nuevoEstado) => {
    await updateDoc(doc(db,"nomina_comida",id), { estado:nuevoEstado, actualizadoEn:new Date() });
    await cargarComidas();
  };

  const eliminarComida = async (id) => {
    if (!confirm("¿Eliminar este registro de comida?")) return;
    await deleteDoc(doc(db,"nomina_comida",id));
    await cargarComidas();
  };

  const comidasFiltradas = comidas.filter(c =>
    !filtroComida ||
    c.trabajadorNombre?.toLowerCase().includes(filtroComida.toLowerCase()) ||
    c.cedula?.includes(filtroComida)
  );

  const totalComidaPendiente  = comidas.filter(c => c.estado === "pendiente").reduce((s,c) => s + (c.total||0), 0);
  const totalComidaDescontada = comidas.filter(c => c.estado === "descontado").reduce((s,c) => s + (c.total||0), 0);

  if (loading) return (
    <LayoutWithSidebar>
      <div style={{ textAlign:"center", padding:"4rem", color:PRIMARY }}>
        <div style={{ fontSize:"2rem" }}>🍽️ Cargando...</div>
      </div>
    </LayoutWithSidebar>
  );

  return (
    <LayoutWithSidebar>
      <div style={{ maxWidth:"1300px", margin:"0 auto" }}>

        {/* ── Header ── */}
        <div style={{ display:"flex", alignItems:"center", gap:"1rem", marginBottom:"1.5rem", flexWrap:"wrap" }}>
          <button onClick={() => router.push("/nomina")}
            style={{ background:"none", border:"none", cursor:"pointer", color:PRIMARY }}>
            <ArrowLeft size={22} />
          </button>
          <div style={{ flex:1 }}>
            <h1 style={{ margin:0, color:PRIMARY, fontSize:"1.6rem", fontWeight:"800" }}>
              💳🍽️ Adelantos y Comida
            </h1>
            <p style={{ margin:0, color:"#64748b", fontSize:"0.9rem" }}>
              Adelantos pendientes: <strong style={{ color:"#f59e0b" }}>{formatCOP(totalPendienteAd)}</strong>
              {" · "}Comida pendiente: <strong style={{ color:"#ef4444" }}>{formatCOP(totalComidaPendiente)}</strong>
            </p>
          </div>
          {tab === "adelantos" ? (
            <button onClick={() => setModalAbierto(true)}
              style={btnStyle(PRIMARY)}>
              <Plus size={18} /> Nuevo Adelanto
            </button>
          ) : (
            <button onClick={() => setModalComida(true)}
              style={btnStyle("#ef4444")}>
              <Plus size={18} /> Registrar Comida
            </button>
          )}
        </div>

        {/* ── Tabs ── */}
        <div style={{ display:"flex", gap:"0.5rem", marginBottom:"1.5rem", borderBottom:"2px solid #e2e8f0", paddingBottom:"0" }}>
          {[
            { id:"adelantos", label:"💳 Adelantos", color:PRIMARY },
            { id:"comida",    label:"🍽️ Comida",    color:"#ef4444" },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                background: tab === t.id ? t.color : "transparent",
                border: `2px solid ${tab === t.id ? t.color : "#e2e8f0"}`,
                borderBottom: "none",
                borderRadius:"10px 10px 0 0",
                padding:"0.65rem 1.5rem",
                cursor:"pointer",
                fontWeight:"700",
                fontSize:"0.9rem",
                color: tab === t.id ? "#fff" : "#64748b",
                transition:"all 0.15s",
                marginBottom:"-2px",
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            TAB ADELANTOS
        ══════════════════════════════════════════════════════════════════ */}
        {tab === "adelantos" && (
          <>
            {/* Stats */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:"1rem", marginBottom:"1.25rem" }}>
              {[
                { label:"Pendientes",  value:adelantos.filter(a=>a.estado==="pendiente").length,  monto:totalPendienteAd,  color:"#f59e0b" },
                { label:"Descontados", value:adelantos.filter(a=>a.estado==="descontado").length, monto:totalDescontadoAd, color:"#10b981" },
                { label:"Cancelados",  value:adelantos.filter(a=>a.estado==="cancelado").length,  monto:0,                 color:"#ef4444" },
              ].map((s,i) => (
                <div key={i} style={{ background:"#fff", borderRadius:"10px", padding:"1rem 1.25rem", boxShadow:"0 2px 8px rgba(0,0,0,0.06)", borderLeft:`4px solid ${s.color}` }}>
                  <div style={{ fontWeight:"800", color:s.color, fontSize:"1.4rem" }}>{s.value}</div>
                  <div style={{ color:"#64748b", fontSize:"0.8rem" }}>{s.label}</div>
                  {s.monto > 0 && <div style={{ fontWeight:"700", color:s.color, fontSize:"0.85rem", marginTop:"2px" }}>{formatCOP(s.monto)}</div>}
                </div>
              ))}
            </div>

            {/* Filtros */}
            <div style={{ background:"#fff", borderRadius:"12px", padding:"0.85rem 1.25rem", marginBottom:"1.25rem", boxShadow:"0 2px 8px rgba(0,0,0,0.06)", display:"flex", gap:"1rem", flexWrap:"wrap", alignItems:"center" }}>
              <div style={{ display:"flex", alignItems:"center", gap:"0.5rem", flex:"1 1 200px" }}>
                <Search size={16} color="#94a3b8" />
                <input value={filtro} onChange={e => setFiltro(e.target.value)} placeholder="Buscar trabajador..."
                  style={{ flex:1, border:"none", outline:"none", fontSize:"0.9rem" }} />
              </div>
              <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
                style={{ border:"1.5px solid #e2e8f0", borderRadius:"8px", padding:"0.45rem 0.7rem", fontSize:"0.88rem", outline:"none" }}>
                <option value="todos">Todos los estados</option>
                <option value="pendiente">Pendientes</option>
                <option value="descontado">Descontados</option>
                <option value="cancelado">Cancelados</option>
              </select>
            </div>

            {/* Tabla adelantos */}
            <div style={{ background:"#fff", borderRadius:"12px", boxShadow:"0 2px 8px rgba(0,0,0,0.06)", overflow:"hidden" }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead>
                  <tr style={{ background:PRIMARY, color:"#fff" }}>
                    {["#","Trabajador","Cédula","Monto","Fecha","Motivo","Estado","Acciones"].map(h => (
                      <th key={h} style={{ padding:"0.85rem 1rem", textAlign:"left", fontSize:"0.82rem", fontWeight:"700" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {adelantosFiltrados.length === 0 ? (
                    <tr><td colSpan="8" style={{ textAlign:"center", padding:"3rem", color:"#94a3b8" }}>No hay adelantos registrados</td></tr>
                  ) : adelantosFiltrados.map((a, i) => {
                    const est = estAdStyle[a.estado] || { bg:"#f1f5f9", color:"#64748b" };
                    return (
                      <tr key={a.id} style={{ borderBottom:"1px solid #f1f5f9" }}
                        onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <td style={{ padding:"0.8rem 1rem", color:"#94a3b8", fontSize:"0.82rem" }}>{i+1}</td>
                        <td style={{ padding:"0.8rem 1rem", fontWeight:"600", fontSize:"0.88rem" }}>{a.trabajadorNombre}</td>
                        <td style={{ padding:"0.8rem 1rem", fontFamily:"monospace", color:"#475569" }}>{a.cedula}</td>
                        <td style={{ padding:"0.8rem 1rem", fontWeight:"700", color:"#ef4444", fontFamily:"monospace" }}>{formatCOP(a.monto)}</td>
                        <td style={{ padding:"0.8rem 1rem", color:"#475569", fontSize:"0.85rem" }}>
                          {a.fecha?.toDate ? a.fecha.toDate().toLocaleDateString("es-CO") : a.fecha?.split?.("T")?.[0] || "—"}
                        </td>
                        <td style={{ padding:"0.8rem 1rem", color:"#64748b", fontSize:"0.85rem" }}>{a.motivo || "—"}</td>
                        <td style={{ padding:"0.8rem 1rem" }}>
                          <span style={{ background:est.bg, color:est.color, borderRadius:"6px", padding:"3px 10px", fontSize:"0.78rem", fontWeight:"700" }}>
                            {a.estado}
                          </span>
                        </td>
                        <td style={{ padding:"0.8rem 1rem" }}>
                          <div style={{ display:"flex", gap:"0.4rem" }}>
                            {a.estado === "pendiente" && (
                              <>
                                <button onClick={() => cambiarEstadoAd(a.id,"descontado")}
                                  style={{ background:"#dcfce7", border:"none", borderRadius:"6px", padding:"0.3rem 0.55rem", cursor:"pointer", color:"#10b981", fontSize:"0.78rem", fontWeight:"600" }}>
                                  ✓ Descontar
                                </button>
                                <button onClick={() => cambiarEstadoAd(a.id,"cancelado")}
                                  style={{ background:"#fee2e2", border:"none", borderRadius:"6px", padding:"0.3rem 0.55rem", cursor:"pointer", color:"#ef4444", fontSize:"0.78rem", fontWeight:"600" }}>
                                  ✗ Cancelar
                                </button>
                              </>
                            )}
                            <button onClick={() => eliminarAdelanto(a.id)}
                              style={{ background:"#f1f5f9", border:"none", borderRadius:"6px", padding:"0.3rem 0.5rem", cursor:"pointer", color:"#94a3b8" }}>
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB COMIDA
        ══════════════════════════════════════════════════════════════════ */}
        {tab === "comida" && (
          <>
            {/* Stats comida */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:"1rem", marginBottom:"1.25rem" }}>
              {[
                { label:"Registros pendientes", value:comidas.filter(c=>c.estado==="pendiente").length,  monto:totalComidaPendiente,  color:"#ef4444" },
                { label:"Descontados",           value:comidas.filter(c=>c.estado==="descontado").length, monto:totalComidaDescontada, color:"#10b981" },
              ].map((s,i) => (
                <div key={i} style={{ background:"#fff", borderRadius:"10px", padding:"1rem 1.25rem", boxShadow:"0 2px 8px rgba(0,0,0,0.06)", borderLeft:`4px solid ${s.color}` }}>
                  <div style={{ fontWeight:"800", color:s.color, fontSize:"1.4rem" }}>{s.value}</div>
                  <div style={{ color:"#64748b", fontSize:"0.8rem" }}>{s.label}</div>
                  {s.monto > 0 && <div style={{ fontWeight:"700", color:s.color, fontSize:"0.85rem", marginTop:"2px" }}>{formatCOP(s.monto)}</div>}
                </div>
              ))}
            </div>

            {/* Filtro comida */}
            <div style={{ background:"#fff", borderRadius:"12px", padding:"0.85rem 1.25rem", marginBottom:"1.25rem", boxShadow:"0 2px 8px rgba(0,0,0,0.06)", display:"flex", gap:"1rem", alignItems:"center" }}>
              <Search size={16} color="#94a3b8" />
              <input value={filtroComida} onChange={e => setFiltroComida(e.target.value)}
                placeholder="Buscar trabajador o cédula..."
                style={{ flex:1, border:"none", outline:"none", fontSize:"0.9rem" }} />
            </div>

            {/* Tabla comida */}
            <div style={{ background:"#fff", borderRadius:"12px", boxShadow:"0 2px 8px rgba(0,0,0,0.06)", overflow:"hidden" }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead>
                  <tr style={{ background:"#ef4444", color:"#fff" }}>
                    {["#","Trabajador","Cédula","Cliente","Cantidad","Valor unit.","Total","Fecha","Estado","Acciones"].map(h => (
                      <th key={h} style={{ padding:"0.85rem 1rem", textAlign:"left", fontSize:"0.82rem", fontWeight:"700" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comidasFiltradas.length === 0 ? (
                    <tr><td colSpan="10" style={{ textAlign:"center", padding:"3rem", color:"#94a3b8" }}>No hay registros de comida</td></tr>
                  ) : comidasFiltradas.map((c, i) => {
                    const est = estAdStyle[c.estado] || { bg:"#f1f5f9", color:"#64748b" };
                    return (
                      <tr key={c.id} style={{ borderBottom:"1px solid #f1f5f9" }}
                        onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <td style={{ padding:"0.8rem 1rem", color:"#94a3b8", fontSize:"0.82rem" }}>{i+1}</td>
                        <td style={{ padding:"0.8rem 1rem", fontWeight:"600", fontSize:"0.88rem" }}>{c.trabajadorNombre}</td>
                        <td style={{ padding:"0.8rem 1rem", fontFamily:"monospace", color:"#475569" }}>{c.cedula}</td>
                        <td style={{ padding:"0.8rem 1rem", fontSize:"0.85rem" }}>
                          <span style={{ background:"#eff6ff", color:PRIMARY, borderRadius:"6px", padding:"2px 8px", fontSize:"0.78rem", fontWeight:"700" }}>
                            {c.clienteNombre || c.clienteId}
                          </span>
                        </td>
                        <td style={{ padding:"0.8rem 1rem", textAlign:"center", fontWeight:"700" }}>{c.cantidad}</td>
                        <td style={{ padding:"0.8rem 1rem", fontFamily:"monospace", color:"#64748b" }}>{formatCOP(c.valor)}</td>
                        <td style={{ padding:"0.8rem 1rem", fontWeight:"800", color:"#ef4444", fontFamily:"monospace" }}>{formatCOP(c.total || (c.cantidad * c.valor))}</td>
                        <td style={{ padding:"0.8rem 1rem", color:"#475569", fontSize:"0.85rem" }}>
                          {c.fecha?.toDate ? c.fecha.toDate().toLocaleDateString("es-CO") : c.fecha?.split?.("T")?.[0] || "—"}
                        </td>
                        <td style={{ padding:"0.8rem 1rem" }}>
                          <span style={{ background:est.bg, color:est.color, borderRadius:"6px", padding:"3px 10px", fontSize:"0.78rem", fontWeight:"700" }}>
                            {c.estado}
                          </span>
                        </td>
                        <td style={{ padding:"0.8rem 1rem" }}>
                          <div style={{ display:"flex", gap:"0.4rem" }}>
                            {c.estado === "pendiente" && (
                              <>
                                <button onClick={() => cambiarEstadoCom(c.id,"descontado")}
                                  style={{ background:"#dcfce7", border:"none", borderRadius:"6px", padding:"0.3rem 0.55rem", cursor:"pointer", color:"#10b981", fontSize:"0.78rem", fontWeight:"600" }}>
                                  ✓ Descontar
                                </button>
                              </>
                            )}
                            <button onClick={() => eliminarComida(c.id)}
                              style={{ background:"#f1f5f9", border:"none", borderRadius:"6px", padding:"0.3rem 0.5rem", cursor:"pointer", color:"#94a3b8" }}>
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          MODAL NUEVO ADELANTO
      ══════════════════════════════════════════════════════════════════ */}
      {modalAbierto && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }}
          onClick={e => { if (e.target === e.currentTarget) setModalAbierto(false); }}>
          <div style={{ background:"#fff", borderRadius:"16px", padding:"2rem", width:"100%", maxWidth:"480px", boxShadow:"0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.5rem" }}>
              <h2 style={{ margin:0, color:PRIMARY, fontWeight:"800" }}>💳 Nuevo Adelanto</h2>
              <button onClick={() => setModalAbierto(false)} style={{ background:"none", border:"none", cursor:"pointer" }}><X size={22} color="#94a3b8" /></button>
            </div>

            <ModalTrabajadorSelector
              trabajadores={trabajadores}
              busqueda={busqTrabAd}
              setBusqueda={setBusqTrabAd}
              cedulaSeleccionada={formAd.cedula}
              onSeleccionar={t => setFormAd(p => ({ ...p, trabajadorNombre:t.nombre, cedula:t.cedula }))}
              label="Trabajador *"
            />

            {[
              { label:"Monto *",              key:"monto",  type:"number", placeholder:"150000" },
              { label:"Fecha",                key:"fecha",  type:"date",   placeholder:"" },
              { label:"Motivo / Observación", key:"motivo", type:"text",   placeholder:"Urgencia, vivienda, etc." },
            ].map(f => (
              <div key={f.key} style={{ marginBottom:"1rem" }}>
                <label style={{ display:"block", fontWeight:"600", color:"#374151", marginBottom:"0.35rem", fontSize:"0.88rem" }}>{f.label}</label>
                <input type={f.type} value={formAd[f.key]}
                  onChange={e => setFormAd(p => ({ ...p, [f.key]:e.target.value }))}
                  placeholder={f.placeholder}
                  style={inputModalStyle} />
              </div>
            ))}

            <div style={{ background:"#fef3c7", borderRadius:"8px", padding:"0.75rem 1rem", marginBottom:"1.25rem", fontSize:"0.83rem", color:"#92400e" }}>
              ⚠️ Quedará como <strong>pendiente</strong> y se descontará en la liquidación.
            </div>

            <button onClick={guardarAdelanto} disabled={guardandoAd}
              style={{ ...btnStyle(PRIMARY, guardandoAd), width:"100%", justifyContent:"center", padding:"0.9rem" }}>
              <Save size={18} /> {guardandoAd ? "Guardando..." : "Registrar Adelanto"}
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL REGISTRAR COMIDA
      ══════════════════════════════════════════════════════════════════ */}
      {modalComida && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }}
          onClick={e => { if (e.target === e.currentTarget) setModalComida(false); }}>
          <div style={{ background:"#fff", borderRadius:"16px", padding:"2rem", width:"100%", maxWidth:"520px", boxShadow:"0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.5rem" }}>
              <h2 style={{ margin:0, color:"#ef4444", fontWeight:"800" }}>🍽️ Registrar Comida</h2>
              <button onClick={() => setModalComida(false)} style={{ background:"none", border:"none", cursor:"pointer" }}><X size={22} color="#94a3b8" /></button>
            </div>

            <ModalTrabajadorSelector
              trabajadores={trabajadores}
              busqueda={busqTrabCom}
              setBusqueda={setBusqTrabCom}
              cedulaSeleccionada={formCom.cedula}
              onSeleccionar={t => setFormCom(p => ({ ...p, trabajadorNombre:t.nombre, cedula:t.cedula }))}
              label="Trabajador *"
            />

            {/* Cliente */}
            <div style={{ marginBottom:"1rem" }}>
              <label style={{ display:"block", fontWeight:"600", color:"#374151", marginBottom:"0.35rem", fontSize:"0.88rem" }}>Cliente *</label>
              <select value={formCom.clienteId}
                onChange={e => setFormCom(p => ({ ...p, clienteId:e.target.value }))}
                style={{ ...inputModalStyle, background:"#fffbeb", cursor:"pointer" }}>
                {clientes.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>

            {/* Cantidad + Valor */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.75rem", marginBottom:"1rem" }}>
              <div>
                <label style={{ display:"block", fontWeight:"600", color:"#374151", marginBottom:"0.35rem", fontSize:"0.88rem" }}>Cantidad *</label>
                <input type="number" min="1" value={formCom.cantidad}
                  onChange={e => setFormCom(p => ({ ...p, cantidad:e.target.value }))}
                  placeholder="1"
                  style={inputModalStyle} />
              </div>
              <div>
                <label style={{ display:"block", fontWeight:"600", color:"#374151", marginBottom:"0.35rem", fontSize:"0.88rem" }}>Valor unitario *</label>
                <input type="number" min="0" value={formCom.valor}
                  onChange={e => setFormCom(p => ({ ...p, valor:e.target.value }))}
                  placeholder="5000"
                  style={inputModalStyle} />
              </div>
            </div>

            {/* Preview total */}
            {formCom.cantidad && formCom.valor && (
              <div style={{ background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:"8px", padding:"0.65rem 1rem", marginBottom:"1rem", fontSize:"0.88rem", color:"#b91c1c", fontWeight:"700" }}>
                Total a descontar: {formatCOP((parseInt(formCom.cantidad)||1) * parseFloat(formCom.valor||0))}
              </div>
            )}

            {/* Fecha */}
            <div style={{ marginBottom:"1.25rem" }}>
              <label style={{ display:"block", fontWeight:"600", color:"#374151", marginBottom:"0.35rem", fontSize:"0.88rem" }}>Fecha</label>
              <input type="date" value={formCom.fecha}
                onChange={e => setFormCom(p => ({ ...p, fecha:e.target.value }))}
                style={inputModalStyle} />
            </div>

            <button onClick={guardarComida} disabled={guardandoCom}
              style={{ ...btnStyle("#ef4444", guardandoCom), width:"100%", justifyContent:"center", padding:"0.9rem" }}>
              <Save size={18} /> {guardandoCom ? "Guardando..." : "Registrar Comida"}
            </button>
          </div>
        </div>
      )}
    </LayoutWithSidebar>
  );
}

// ─── Componente selector de trabajador reutilizable ──────────────────────────
function ModalTrabajadorSelector({ trabajadores, busqueda, setBusqueda, cedulaSeleccionada, onSeleccionar, label }) {
  const filtrados = trabajadores.filter(t =>
    !busqueda ||
    t.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    String(t.cedula).includes(busqueda)
  );

  return (
    <div style={{ marginBottom:"1rem" }}>
      <label style={{ display:"block", fontWeight:"600", color:"#374151", marginBottom:"0.35rem", fontSize:"0.88rem" }}>{label}</label>
      <div style={{ position:"relative", marginBottom:"0.4rem" }}>
        <Search size={14} style={{ position:"absolute", left:"0.65rem", top:"50%", transform:"translateY(-50%)", color:"#94a3b8", pointerEvents:"none" }} />
        <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
          placeholder="Filtrar por nombre o cédula..."
          style={{ ...inputModalStyle, paddingLeft:"2rem", background:"#eff6ff" }} />
      </div>
      <select value={cedulaSeleccionada}
        onChange={e => {
          const t = trabajadores.find(w => String(w.cedula) === e.target.value);
          if (t) onSeleccionar(t);
        }}
        style={{
          ...inputModalStyle,
          background: cedulaSeleccionada ? "#eff6ff" : "#fff",
          color: cedulaSeleccionada ? "#0B3D91" : "#374151",
          fontWeight: cedulaSeleccionada ? "700" : "400",
          cursor:"pointer",
        }}>
        <option value="">— Seleccionar ({filtrados.length}) —</option>
        {filtrados.map(t => (
          <option key={t.id} value={String(t.cedula)}>
            {t.nombre} — {t.cedula}{t.cargo ? ` — ${t.cargo}` : ""}
          </option>
        ))}
      </select>
      {cedulaSeleccionada && (
        <div style={{ marginTop:"0.3rem", fontSize:"0.8rem", color:"#059669", fontWeight:"600" }}>
          ✅ {trabajadores.find(t => String(t.cedula) === String(cedulaSeleccionada))?.nombre} — Céd. {cedulaSeleccionada}
        </div>
      )}
    </div>
  );
}

// ─── Estilos reutilizables ────────────────────────────────────────────────────
function btnStyle(color, disabled = false) {
  return {
    background: color, border:"none", borderRadius:"10px",
    padding:"0.72rem 1.1rem", color:"#fff",
    cursor: disabled ? "not-allowed" : "pointer",
    fontWeight:"700", fontSize:"0.88rem",
    display:"flex", alignItems:"center", gap:"0.4rem",
    opacity: disabled ? 0.6 : 1, transition:"opacity 0.15s", whiteSpace:"nowrap",
  };
}

const inputModalStyle = {
  width:"100%", padding:"0.7rem 0.9rem",
  border:"1.5px solid #e2e8f0", borderRadius:"8px",
  fontSize:"0.9rem", outline:"none", boxSizing:"border-box",
};
