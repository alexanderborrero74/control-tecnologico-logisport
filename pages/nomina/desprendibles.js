// pages/nomina/desprendibles.js
// Generación y gestión de desprendibles de pago
// v3 — UN solo desprendible por trabajador con TODOS sus movimientos consolidados
//      (todos los clientes, todo el historial, sin filtro de fechas)

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  collection, getDocs, getDoc, setDoc, deleteDoc, doc,
  query, orderBy, where, Timestamp, writeBatch
} from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";
import { getUserRoleByUid } from "@/utils/getUserRole";
import LayoutWithSidebar from "@/components/LayoutWithSidebar";
import { formatCOP } from "@/utils/nominaCalculos";
import {
  ArrowLeft, RefreshCw, FileText, Users, DollarSign,
  Eye, Trash2, CheckCircle, Send, Search
} from "lucide-react";

const PRIMARY = "#0B3D91";
const SUCCESS = "#10b981";
const DANGER  = "#ef4444";
const ACCENT  = "#00AEEF";
const tdSt    = {padding:"0.75rem 0.9rem",verticalAlign:"middle"};

// Token único por trabajador (basado solo en cédula)
const generarToken = (cedula) => {
  const raw = `ced_${cedula}`;
  if (typeof btoa !== "undefined") return btoa(raw).replace(/[+/=]/g, c => ({"+":"-","/":"_","=":""}[c]));
  return `ced_${String(cedula).replace(/[^a-z0-9]/gi,"_")}`;
};

// ─────────────────────────────────────────────────────────────────────────
// Detecta el tipo de operación y devuelve etiqueta + color
// ─────────────────────────────────────────────────────────────────────────
const tipoOp = (dia) => {
  if (dia.modoHorasExtras)  return { label:"Horas Extras",  emoji:"⏰", color:"#92400e", bg:"#fffbeb" };
  if (dia.modoCliente2)     return { label:"Por Días",       emoji:"📅", color:"#5b21b6", bg:"#f5f3ff" };
  if (dia.modoCiamsa)       return { label:"Destajo",        emoji:"⚖️", color:"#0369a1", bg:"#e0f2fe" };
  return                          { label:"Cuadrilla",       emoji:"👥", color:"#0B3D91", bg:"#eff6ff" };
};

export default function Desprendibles() {
  const router = useRouter();
  const [rol, setRol]         = useState(null);
  const [loading, setLoading] = useState(true);

  const [operaciones,    setOperaciones]    = useState([]);
  const [desprendibles,  setDesprendibles]  = useState([]);
  const [trabajadoresMap,setTrabajadoresMap]= useState({});
  const [clientes,       setClientes]       = useState([]);
  const [cargando,       setCargando]       = useState(false);
  const [generando,      setGenerando]      = useState(false);
  const [generadoOk,     setGeneradoOk]     = useState(false);

  const [busqueda,    setBusqueda]    = useState("");
  const [vistaPrevia, setVistaPrevia] = useState(null);

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/login"); return; }
      const r = await getUserRoleByUid(user.uid);
      setRol(r);
      if (!["admin","admin_nomina","nomina"].includes(r)) { router.push("/nomina"); return; }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!loading) {
      cargarTrabajadores();
      cargarClientes();
      cargarOperaciones();
      cargarDesprendibles();
    }
  }, [loading]);

  const cargarTrabajadores = async () => {
    try {
      const snap = await getDocs(collection(db, "nomina_trabajadores"));
      const mapa = {};
      snap.docs.forEach(d => {
        mapa[d.id] = { cargo: d.data().cargo || "", cedula: d.data().cedula || "", nombre: d.data().nombre || "" };
      });
      setTrabajadoresMap(mapa);
    } catch (e) { console.error(e); }
  };

  const cargarClientes = async () => {
    try {
      const snap = await getDocs(collection(db, "nomina_clientes"));
      setClientes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch {}
  };

  // Carga TODAS las operaciones sin filtro de fecha
  const cargarOperaciones = async () => {
    setCargando(true);
    try {
      const snap = await getDocs(query(
        collection(db, "nomina_operaciones"),
        orderBy("fecha")
      ));
      setOperaciones(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch(e) { console.error(e); }
    setCargando(false);
  };

  const cargarDesprendibles = async () => {
    try {
      const snap = await getDocs(collection(db, "nomina_desprendibles"));
      const todos = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Deduplicar por cédula: conservar solo el más reciente por trabajador
      const porCedula = {};
      todos.forEach(d => {
        const ced = String(d.cedula || "").trim();
        if (!ced) return;
        const t = d.generadoEn?.toDate?.()?.getTime?.() || 0;
        if (!porCedula[ced] || t > (porCedula[ced]._t || 0)) {
          porCedula[ced] = { ...d, _t: t };
        }
      });
      setDesprendibles(Object.values(porCedula).sort((a,b) => (a.nombre||"").localeCompare(b.nombre||"","es")));
    } catch(e) { console.error(e); }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // CALCULAR RESUMEN — consolida TODO el historial de cada trabajador
  // Un solo registro por trabajador con todos sus días de todos los clientes
  // ─────────────────────────────────────────────────────────────────────────
  const calcularResumen = () => {
    const mapa = {};

    operaciones.forEach(op => {
      // Construir lista de asistentes — para operaciones individuales puede estar
      // en trabajadoresAsisten O solo en los campos trabajadorId/trabajadorNombre/trabajadorCedula
      let asisten = op.trabajadoresAsisten || [];

      // Fallback: si no hay trabajadoresAsisten pero sí trabajadorId (CIAMSA/horas extras antiguas)
      if (!asisten.length && op.trabajadorId) {
        asisten = [{
          id:     op.trabajadorId,
          nombre: op.trabajadorNombre || op.cuadrillaNombre || "",
          cedula: String(op.trabajadorCedula || ""),
        }];
      }

      if (!asisten.length) return;

      const esIndividual = op.modoCiamsa || op.modoHorasExtras || op.modoCliente2;
      const parte = esIndividual
        ? (op.netoAPagar || 0)
        : (op.netoAPagar || 0) / asisten.length;

      const nomCliente = clientes.find(c => c.id === (op.clienteId || "spia"))?.nombre
        || op.clienteId || "SPIA";

      asisten.forEach(w => {
        // Usar cédula como clave única (más confiable que el doc ID en operaciones individuales)
        const cedula = String(w.cedula || trabajadoresMap[w.id]?.cedula || "").trim();
        const key    = cedula || w.id;  // fallback a doc ID si no hay cédula

        if (!mapa[key]) {
          mapa[key] = {
            id: w.id,
            nombre: w.nombre,
            cedula,
            cargo: trabajadoresMap[w.id]?.cargo || "",
            cuadrillaNombre: op.cuadrillaNombre || op.cuadrilla || "",
            cuadrillaId: op.cuadrillaId || "",
            clienteId: op.clienteId || "spia",
            clienteNombre: nomCliente,
            clientes: new Set(),
            dias: [],
            totalDevengado: 0,
          };
        }

        mapa[key].clientes.add(nomCliente);

        mapa[key].dias.push({
          fecha:              op.fechaStr,
          servicio:           op.servicioNombre,
          clienteId:          op.clienteId || "spia",
          clienteNombre:      nomCliente,
          cuadrillaNombre:    op.cuadrillaNombre || op.cuadrilla || "",
          personas:           op.personas,
          cantidad:           op.cantidad || 1,
          modoHorasExtras:    op.modoHorasExtras || false,
          horasExtras:        op.horasExtras   ?? null,
          servicioValorUnitario: op.servicioValorUnitario || 0,
          modoCiamsa:         op.modoCiamsa    || false,
          cantidadTons:       op.cantidadTons  ?? null,
          per:                op.per           ?? null,
          tarifaUnitaria:     op.tarifaUnitaria ?? null,
          unidad:             op.unidad        ?? null,
          nPersonas:          op.nPersonas     ?? null,
          modoCliente2:       op.modoCliente2  || false,
          cantidadDias:       op.cantidadDias  ?? null,
          netoPersona:        parte,
        });
        mapa[key].totalDevengado += parte;
      });
    });

    return Object.values(mapa)
      .map(t => ({
        ...t,
        clientes: Array.from(t.clientes),
        // Rango de fechas automático
        fechaInicio: t.dias[0]?.fecha || "",
        fechaFin:    t.dias[t.dias.length - 1]?.fecha || "",
      }))
      .sort((a,b) => a.nombre.localeCompare(b.nombre,"es"));
  };

  // ─────────────────────────────────────────────────────────────────────────
  // GENERAR / ACTUALIZAR DESPRENDIBLES EN FIRESTORE
  // Un único documento por trabajador (token basado en cédula)
  // ─────────────────────────────────────────────────────────────────────────
  const generarDesprendibles = async () => {
    const resumen = calcularResumen();
    if (!resumen.length) { alert("No hay operaciones con asistencia registradas."); return; }
    setGenerando(true);
    try {
      const auth = getAuth();
      const uid  = auth.currentUser?.uid || "";

      // Adelantos (todos, sin filtro de fecha)
      const adelantosMap = {};
      try {
        const adelSnap = await getDocs(collection(db, "nomina_adelantos"));
        adelSnap.docs.forEach(d => {
          const ad  = d.data();
          const ced = String(ad.cedula || ad.trabajadorCedula || "").trim();
          if (ced) adelantosMap[ced] = (adelantosMap[ced] || 0) + (ad.monto || 0);
        });
      } catch (_) {}

      // Limpiar TODOS los desprendibles anteriores antes de regenerar
      // Así solo quedan los trabajadores que tienen movimientos reales en las operaciones
      try {
        const todosSnap = await getDocs(collection(db, "nomina_desprendibles"));
        const docsAEliminar = todosSnap.docs.map(d => d.id);
        for (let i = 0; i < docsAEliminar.length; i += 490) {
          const batch = writeBatch(db);
          docsAEliminar.slice(i, i+490).forEach(tk => batch.delete(doc(db,"nomina_desprendibles",tk)));
          await batch.commit();
        }
      } catch (_) {}

      await Promise.all(resumen.map(t => {
        const token    = generarToken(t.cedula || t.id);
        const ced      = String(t.cedula || "").trim();
        const adelanto = adelantosMap[ced] || 0;

        const deducciones = [];
        if (adelanto > 0) deducciones.push({ concepto:"Adelanto / Préstamo", valor: adelanto });

        const data = {
          token,
          cedula:          t.cedula,
          nombre:          t.nombre,
          cargo:           t.cargo || trabajadoresMap[t.id]?.cargo || "",
          cuadrillaNombre: t.cuadrillaNombre,
          cuadrillaId:     t.cuadrillaId,
          clienteId:       t.clienteId,
          clienteNombre:   t.clienteNombre,
          clientes:        t.clientes,                       // todos los clientes del trabajador
          fechaInicio:     t.fechaInicio,
          fechaFin:        t.fechaFin,
          periodoLabel:    t.fechaInicio && t.fechaFin
                             ? `${t.fechaInicio} al ${t.fechaFin}`
                             : "Historial completo",
          dias:            t.dias,
          totalDevengado:  Math.round(t.totalDevengado * 100) / 100,
          netoAPagar:      Math.round((t.totalDevengado - adelanto) * 100) / 100,
          adelantosDeducidos: adelanto,
          deducciones,
          tieneDatosNomina: false,
          generadoEn:      new Date(),
          generadoPor:     uid,
          empresa:         "LOGISPORT S.A.S.",
        };
        return setDoc(doc(db, "nomina_desprendibles", token), data);
      }));

      await cargarDesprendibles();
      setGeneradoOk(true);
      setTimeout(() => setGeneradoOk(false), 3000);
    } catch(e) { alert("Error al generar: " + e.message); }
    setGenerando(false);
  };

  const eliminar = async (tk) => {
    if (!confirm("¿Eliminar este desprendible?")) return;
    await deleteDoc(doc(db,"nomina_desprendibles",tk));
    setDesprendibles(prev=>prev.filter(d=>(d.token||d.id)!==tk));
    if ((vistaPrevia?.token||vistaPrevia?.id)===tk) setVistaPrevia(null);
  };

  const resumen   = calcularResumen();
  const totalNeto = resumen.reduce((s,t)=>s+t.totalDevengado,0);
  const despFilt  = desprendibles.filter(d =>
    !busqueda ||
    d.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    d.cedula?.includes(busqueda)
  );

  const urlPublica = (token) => {
    if (typeof window !== "undefined") return `${window.location.origin}/mi-pago?token=${token}`;
    return `/mi-pago?token=${token}`;
  };

  if (loading) return (
    <LayoutWithSidebar>
      <div style={{textAlign:"center",padding:"4rem",color:PRIMARY}}>
        <RefreshCw size={32} style={{animation:"spin 1s linear infinite"}}/>
        <div style={{marginTop:"1rem",fontWeight:"600"}}>Cargando...</div>
      </div>
    </LayoutWithSidebar>
  );

  return (
    <LayoutWithSidebar>
      <div style={{maxWidth:"1400px",margin:"0 auto",padding:"0 0 3rem"}}>

        {/* HEADER */}
        <div style={{display:"flex",alignItems:"center",gap:"1rem",marginBottom:"1.5rem",flexWrap:"wrap"}}>
          <button onClick={()=>router.push("/nomina")} style={{background:"none",border:"none",cursor:"pointer",color:PRIMARY}}>
            <ArrowLeft size={22}/>
          </button>
          <div style={{flex:1}}>
            <h1 style={{margin:0,color:PRIMARY,fontSize:"1.6rem",fontWeight:"800"}}>📄 Desprendibles de Pago</h1>
            <p style={{margin:0,color:"#64748b",fontSize:"0.88rem"}}>
              Historial completo por trabajador · Todos los clientes · Todos los movimientos
            </p>
          </div>
          <button onClick={()=>{cargarOperaciones();cargarDesprendibles();}} title="Recargar"
            style={{background:`${PRIMARY}10`,border:`1px solid ${PRIMARY}30`,borderRadius:"10px",padding:"0.55rem 0.9rem",cursor:"pointer",color:PRIMARY,display:"flex",alignItems:"center",gap:"0.5rem",fontWeight:"700",fontSize:"0.85rem"}}>
            <RefreshCw size={14} style={{animation:cargando?"spin 1s linear infinite":"none"}}/>
            Recargar
          </button>
        </div>

        {/* BANNER ENLACE PÚBLICO */}
        <div style={{background:"linear-gradient(135deg,#f0fdf4 0%,#dcfce7 100%)",border:"2px solid #86efac",borderRadius:"14px",padding:"1rem 1.35rem",marginBottom:"1.25rem",display:"flex",alignItems:"center",gap:"1rem",flexWrap:"wrap",boxShadow:"0 2px 10px rgba(16,185,129,0.1)"}}>
          <div style={{width:"42px",height:"42px",background:"#10b981",borderRadius:"12px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.3rem",flexShrink:0}}>🔗</div>
          <div style={{flex:1}}>
            <div style={{fontWeight:"800",color:"#065f46",fontSize:"0.88rem",marginBottom:"0.2rem"}}>Enlace público para trabajadores — comparte este link:</div>
            <div style={{display:"flex",alignItems:"center",gap:"0.6rem",flexWrap:"wrap"}}>
              <a href="https://logisport.vercel.app/mi-pago" target="_blank" rel="noreferrer"
                style={{fontFamily:"monospace",fontWeight:"800",fontSize:"0.95rem",color:"#0B3D91",background:"#fff",border:"1.5px solid #0B3D91",borderRadius:"8px",padding:"0.3rem 0.8rem",textDecoration:"none"}}>
                https://logisport.vercel.app/mi-pago
              </a>
              <button onClick={()=>navigator.clipboard?.writeText("https://logisport.vercel.app/mi-pago").then(()=>alert("✅ Enlace copiado"))}
                style={{background:"#0B3D91",border:"none",borderRadius:"8px",padding:"0.3rem 0.9rem",color:"#fff",fontWeight:"700",fontSize:"0.78rem",cursor:"pointer"}}>
                📋 Copiar
              </button>
            </div>
          </div>
          <div style={{fontSize:"0.75rem",color:"#059669",fontWeight:"600",maxWidth:"200px",lineHeight:1.4}}>
            El trabajador ingresa su cédula y ve todo su historial completo en un solo desprendible.
          </div>
        </div>

        {/* STATS */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:"1rem",marginBottom:"1.5rem"}}>
          {[
            {icon:<Users size={20}/>,label:"Trabajadores con movimientos",value:resumen.length,color:PRIMARY},
            {icon:<FileText size={20}/>,label:"Desprendibles generados",value:desprendibles.length,color:"#8b5cf6"},
            {icon:<DollarSign size={20}/>,label:"Total producción acumulada",value:formatCOP(totalNeto),color:SUCCESS},
          ].map((s,i)=>(
            <div key={i} style={{background:"#fff",borderRadius:"12px",padding:"1rem 1.1rem",boxShadow:"0 2px 8px rgba(0,0,0,0.06)",borderLeft:`4px solid ${s.color}`,display:"flex",alignItems:"center",gap:"0.7rem"}}>
              <div style={{width:"40px",height:"40px",background:`${s.color}18`,borderRadius:"10px",display:"flex",alignItems:"center",justifyContent:"center",color:s.color,flexShrink:0}}>{s.icon}</div>
              <div>
                <div style={{fontWeight:"800",color:s.color,fontSize:i===2?"0.9rem":"1.3rem",lineHeight:1.2}}>{s.value}</div>
                <div style={{color:"#64748b",fontSize:"0.72rem"}}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* BOTÓN GENERAR */}
        <div style={{background:"#fff",borderRadius:"14px",border:`2px solid ${PRIMARY}20`,padding:"1.25rem 1.5rem",marginBottom:"1.5rem",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:"1rem",boxShadow:"0 2px 8px rgba(11,61,145,0.07)"}}>
          <div>
            <div style={{fontWeight:"700",color:PRIMARY,fontSize:"1rem"}}>
              {resumen.length>0
                ? `${resumen.length} trabajadores encontrados — historial completo de todos los clientes`
                : "Sin operaciones registradas"}
            </div>
            <div style={{color:"#64748b",fontSize:"0.82rem",marginTop:"0.2rem"}}>
              Cada desprendible consolida TODOS los movimientos del trabajador en un solo documento.
              {desprendibles.length>0 && ` Ya existen ${desprendibles.length} desprendibles — al regenerar se actualizan.`}
            </div>
          </div>
          <button onClick={generarDesprendibles} disabled={generando||resumen.length===0}
            style={{background:resumen.length===0?"#94a3b8":generadoOk?SUCCESS:PRIMARY,border:"none",borderRadius:"10px",padding:"0.85rem 1.75rem",color:"#fff",fontWeight:"800",fontSize:"0.95rem",cursor:resumen.length===0?"not-allowed":"pointer",display:"flex",alignItems:"center",gap:"0.6rem",boxShadow:"0 4px 12px rgba(11,61,145,0.25)",transition:"background 0.2s"}}>
            {generando
              ? <><RefreshCw size={18} style={{animation:"spin 1s linear infinite"}}/> Generando...</>
              : generadoOk
              ? <><CheckCircle size={18}/> ¡Generados!</>
              : <><FileText size={18}/> Generar desprendibles</>}
          </button>
        </div>

        {/* LISTA DESPRENDIBLES */}
        {desprendibles.length > 0 && (
          <div style={{background:"#fff",borderRadius:"14px",boxShadow:"0 2px 12px rgba(0,0,0,0.07)",overflow:"hidden",marginBottom:"1.5rem"}}>
            <div style={{padding:"0.85rem 1.1rem",background:`${PRIMARY}06`,borderBottom:"1px solid #e2e8f0",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"1rem",flexWrap:"wrap"}}>
              <h2 style={{margin:0,color:PRIMARY,fontSize:"1rem",fontWeight:"800"}}>
                🔗 Desprendibles generados — {desprendibles.length} trabajadores
              </h2>
              <div style={{position:"relative"}}>
                <Search size={13} style={{position:"absolute",left:"0.6rem",top:"50%",transform:"translateY(-50%)",color:"#94a3b8"}}/>
                <input value={busqueda} onChange={e=>setBusqueda(e.target.value)} placeholder="Buscar por nombre o cédula..."
                  style={{border:"1.5px solid #e2e8f0",borderRadius:"8px",padding:"0.45rem 0.75rem 0.45rem 2rem",fontSize:"0.85rem",outline:"none",background:"#fff",width:"240px"}}/>
              </div>
            </div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead>
                  <tr style={{background:PRIMARY}}>
                    {["#","Trabajador","Cédula","Clientes","Movimientos","Total producción","Enlace","Acc."].map(h=>(
                      <th key={h} style={{padding:"0.75rem 0.9rem",textAlign:"left",fontSize:"0.78rem",fontWeight:"700",color:"#fff",whiteSpace:"nowrap"}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {despFilt.map((d,i) => {
                    const tk = d.token || d.id;
                    return (
                      <tr key={tk} style={{borderBottom:"1px solid #f1f5f9",background:i%2===0?"#fff":"#f8fafc"}}
                        onMouseEnter={e=>e.currentTarget.style.background="#eff6ff"}
                        onMouseLeave={e=>e.currentTarget.style.background=i%2===0?"#fff":"#f8fafc"}>
                        <td style={{...tdSt,color:"#cbd5e1",fontSize:"0.78rem"}}>{i+1}</td>
                        <td style={{...tdSt,fontWeight:"700",color:"#1e293b"}}>{d.nombre}</td>
                        <td style={{...tdSt,fontFamily:"monospace",color:"#64748b",fontSize:"0.82rem"}}>{d.cedula||"—"}</td>
                        <td style={tdSt}>
                          <div style={{display:"flex",gap:"3px",flexWrap:"wrap"}}>
                            {(d.clientes||[d.clienteNombre||d.clienteId||"SPIA"]).map((c,ci)=>(
                              <span key={ci} style={{background:"#f0f9ff",color:ACCENT,borderRadius:"6px",padding:"1px 7px",fontSize:"0.72rem",fontWeight:"700"}}>
                                {c}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td style={{...tdSt,textAlign:"center",fontWeight:"700",color:"#374151"}}>
                          {Array.isArray(d.dias) ? d.dias.length : "—"}
                        </td>
                        <td style={{...tdSt,fontWeight:"900",color:SUCCESS,fontFamily:"monospace"}}>
                          {formatCOP(d.totalDevengado||0)}
                        </td>
                        <td style={tdSt}>
                          <div style={{display:"flex",alignItems:"center",gap:"0.4rem"}}>
                            <span style={{fontFamily:"monospace",fontSize:"0.65rem",color:"#94a3b8",background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:"5px",padding:"2px 6px",maxWidth:"150px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                              ...{tk.slice(-8)}
                            </span>
                            <button onClick={()=>navigator.clipboard?.writeText(urlPublica(tk))}
                              style={{background:"#f0f9ff",border:"none",borderRadius:"6px",padding:"0.3rem 0.5rem",cursor:"pointer",color:ACCENT,fontSize:"0.72rem",fontWeight:"700"}}>
                              📋
                            </button>
                          </div>
                        </td>
                        <td style={tdSt}>
                          <div style={{display:"flex",gap:"0.4rem"}}>
                            <button onClick={()=>setVistaPrevia(d)} title="Ver desprendible"
                              style={{background:"#f0f9ff",border:"none",borderRadius:"6px",padding:"0.3rem 0.45rem",cursor:"pointer",color:ACCENT}}>
                              <Eye size={14}/>
                            </button>
                            <button onClick={()=>window.open(`/mi-pago?token=${tk}`,"_blank")}
                              style={{background:"#f0fdf4",border:"none",borderRadius:"6px",padding:"0.3rem 0.45rem",cursor:"pointer",color:SUCCESS}}>
                              <Send size={14}/>
                            </button>
                            <button onClick={()=>eliminar(tk)}
                              style={{background:"#fff1f2",border:"none",borderRadius:"6px",padding:"0.3rem 0.45rem",cursor:"pointer",color:DANGER}}>
                              <Trash2 size={14}/>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VISTA PREVIA */}
        {vistaPrevia && (
          <div style={{marginTop:"1.5rem"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"0.75rem"}}>
              <h2 style={{margin:0,color:PRIMARY,fontSize:"1rem",fontWeight:"800"}}>
                👁️ Vista previa — {vistaPrevia.nombre}
              </h2>
              <div style={{display:"flex",gap:"0.5rem"}}>
                <button onClick={()=>window.open(`/mi-pago?token=${vistaPrevia.token||vistaPrevia.id}`,"_blank")}
                  style={{background:PRIMARY,border:"none",borderRadius:"8px",padding:"0.5rem 1rem",color:"#fff",fontWeight:"700",fontSize:"0.82rem",cursor:"pointer"}}>
                  Abrir para imprimir
                </button>
                <button onClick={()=>setVistaPrevia(null)}
                  style={{background:"#f1f5f9",border:"none",borderRadius:"8px",padding:"0.5rem 1rem",color:"#475569",fontWeight:"700",fontSize:"0.82rem",cursor:"pointer"}}>
                  Cerrar
                </button>
              </div>
            </div>
            <DesprendiblePreview d={vistaPrevia}/>
          </div>
        )}

      </div>
      <style jsx global>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
    </LayoutWithSidebar>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   COMPONENTE DE VISTA PREVIA — un solo desprendible con todo el historial
══════════════════════════════════════════════════════════════════════════════ */
export function DesprendiblePreview({ d, modoImpresion = false }) {
  return <DespPrevProduccion d={d} />;
}

/* ══════════════════════════════════════════════════════════════════════════════
   DESPRENDIBLE ÚNICO — historial completo de producción del trabajador
   Todos los clientes · Todos los movimientos · Una sola tabla consolidada
══════════════════════════════════════════════════════════════════════════════ */
export function DespPrevProduccion({ d }) {
  const fmt = (n) => formatCOP(n || 0);
  const BLUE = "#0369a1";
  const S    = "#059669";
  const DR   = "#DC2626";
  const W    = "#B45309";

  const adelanto   = d.adelantosDeducidos ?? 0;
  const dedsOp     = (d.deducciones || []).filter(x =>
    !x.concepto?.toLowerCase().includes("salud") &&
    !x.concepto?.toLowerCase().includes("pensión") &&
    !x.concepto?.toLowerCase().includes("pension")
  );
  const totalDedOp = dedsOp.reduce((s,x) => s + (x.valor||0), 0) + adelanto;
  const totalProd  = d.totalDevengado ?? d.totalProduccion ?? 0;
  const neto       = totalProd - totalDedOp;

  // Acumulado
  let acum = 0;
  const dias = (d.dias || []).map(dia => {
    acum += (dia.netoPersona || 0);
    return { ...dia, acumulado: acum };
  });

  const fmtFecha = (f) => {
    if (!f) return "—";
    const p = f.split("-");
    return p.length===3 ? `${p[2]}/${p[1]}/${p[0].slice(2)}` : f;
  };

  const cantidadLabel = (dia) => {
    if (dia.modoHorasExtras) return <span style={{fontWeight:800,color:"#92400e"}}>{dia.horasExtras} <span style={{fontSize:"0.65rem"}}>hr</span></span>;
    if (dia.modoCliente2 && dia.cantidadDias != null) return <span style={{fontWeight:800,color:"#5b21b6"}}>{dia.cantidadDias} <span style={{fontSize:"0.65rem"}}>días</span></span>;
    if (dia.modoCiamsa && dia.cantidadTons != null) return <span style={{fontWeight:800,color:BLUE}}>{parseFloat(dia.cantidadTons).toFixed(2)} <span style={{fontSize:"0.65rem"}}>{dia.unidad||"ton"}</span></span>;
    return <span style={{fontWeight:700,color:"#374151"}}>{parseInt(dia.cantidad)||1}</span>;
  };

  const personasLabel = (dia) => {
    if (dia.modoHorasExtras || dia.modoCliente2) return <span style={{color:"#94a3b8"}}>—</span>;
    if (dia.modoCiamsa && dia.nPersonas) return <span style={{fontWeight:700,color:BLUE}}>{dia.nPersonas}</span>;
    return <span style={{fontWeight:700,color:"#374151"}}>{parseInt(dia.personas)||1}</span>;
  };

  const tarifaLabel = (dia) => {
    const t = dia.tarifaUnitaria || dia.servicioValorUnitario || 0;
    if (!t) return <span style={{color:"#cbd5e1"}}>—</span>;
    if (dia.modoHorasExtras) return <span style={{fontFamily:"monospace",fontSize:"0.78rem",color:"#92400e"}}>{fmt(t)}<span style={{opacity:0.7}}>/hr</span></span>;
    if (dia.modoCliente2)     return <span style={{fontFamily:"monospace",fontSize:"0.78rem",color:"#5b21b6"}}>{fmt(t)}<span style={{opacity:0.7}}>/día</span></span>;
    if (dia.modoCiamsa)       return <span style={{fontFamily:"monospace",fontSize:"0.78rem",color:BLUE}}>{fmt(t)}<span style={{opacity:0.7}}>/{dia.unidad||"ton"}</span></span>;
    return <span style={{fontFamily:"monospace",fontSize:"0.78rem",color:"#374151"}}>{fmt(t)}</span>;
  };

  const formulaTexto = (dia) => {
    if (dia.modoHorasExtras) {
      const t = dia.servicioValorUnitario || dia.tarifaUnitaria || 0;
      return `${fmt(t)}/hr × ${dia.horasExtras}h`;
    }
    if (dia.modoCliente2) {
      const t = dia.tarifaUnitaria || 0;
      return `${dia.cantidadDias} día(s) × ${fmt(t)}`;
    }
    if (dia.modoCiamsa && dia.cantidadTons != null) {
      const tons = parseFloat(dia.cantidadTons) || 0;
      const nP   = dia.nPersonas || 1;
      const per  = dia.per || (tons / nP);
      const t    = dia.tarifaUnitaria || 0;
      return `${tons.toFixed(2)} ÷ ${nP}p = ${Number(per).toFixed(4)} × ${fmt(t)}`;
    }
    const cant = parseInt(dia.cantidad) || 1;
    const pers = parseInt(dia.personas) || 1;
    const val  = dia.servicioValorUnitario || 0;
    if (val > 0) return `(${fmt(val)} × ${cant}) ÷ ${pers}p`;
    return `${cant} und. ÷ ${pers}p`;
  };

  // Agrupar por cliente para el resumen final
  const resumenPorCliente = {};
  dias.forEach(dia => {
    const cNom = dia.clienteNombre || dia.clienteId || "SPIA";
    if (!resumenPorCliente[cNom]) resumenPorCliente[cNom] = { total: 0, ops: 0 };
    resumenPorCliente[cNom].total += dia.netoPersona || 0;
    resumenPorCliente[cNom].ops++;
  });

  const clientesLabel = d.clientes?.length > 0
    ? d.clientes.join(" · ")
    : (d.clienteNombre || "SPIA");

  return (
    <div style={{fontFamily:"Arial,Helvetica,sans-serif",background:"#fff",border:"2px solid #0369a1",borderRadius:16,overflow:"hidden",boxShadow:"0 6px 30px rgba(3,105,161,0.15)",maxWidth:960,margin:"0 auto"}}>

      {/* CABECERA */}
      <div style={{background:"linear-gradient(135deg,#0369a1 0%,#0284c7 100%)",padding:"1.25rem 1.5rem",display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:"0.5rem"}}>
        <div>
          <div style={{color:"#fff",fontWeight:900,fontSize:"1.5rem",letterSpacing:"0.04em"}}>LOGISPORT S.A.S.</div>
          <div style={{color:"rgba(255,255,255,0.72)",fontSize:"0.72rem",marginTop:"0.2rem"}}>logisport.vercel.app · Control de Operaciones y Producción</div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{display:"inline-block",background:"rgba(255,255,255,0.2)",border:"1px solid rgba(255,255,255,0.4)",borderRadius:8,padding:"3px 14px",color:"#fff",fontSize:"0.68rem",fontWeight:800,letterSpacing:"0.08em",marginBottom:"0.4rem"}}>
            📅 HISTORIAL COMPLETO DE PRODUCCIÓN
          </div>
          <div style={{color:"#fff",fontWeight:800,fontSize:"0.95rem"}}>
            {d.periodoLabel || "Todos los movimientos"}
          </div>
        </div>
      </div>

      {/* DATOS DEL TRABAJADOR */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",background:"#F0F9FF",borderBottom:"2px solid #BAE6FD"}}>
        {[
          {icon:"👤",label:"TRABAJADOR",       valor: d.nombre||"—"},
          {icon:"🪪",label:"CÉDULA",           valor: d.cedula||"—"},
          {icon:"⛏️",label:"CARGO / CUADRILLA",valor: [d.cargo, d.cuadrillaNombre?`Cua. ${d.cuadrillaNombre}`:null].filter(Boolean).join(" · ") || "—"},
          {icon:"🏢",label:"CLIENTE(S)",        valor: clientesLabel},
          {icon:"📅",label:"PERÍODO",           valor: d.periodoLabel||"Historial completo"},
          {icon:"📆",label:"TOTAL REGISTROS",   valor: `${dias.length} movimiento(s)`},
        ].map((f,i)=>(
          <div key={i} style={{padding:"0.7rem 1rem",borderRight:i<5?"1px solid #BAE6FD":"none"}}>
            <div style={{fontSize:"0.58rem",fontWeight:800,color:"#7DD3FC",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"0.25rem"}}>{f.icon} {f.label}</div>
            <div style={{fontSize:"0.82rem",fontWeight:700,color:"#0C4A6E",lineHeight:1.3}}>{f.valor}</div>
          </div>
        ))}
      </div>

      {/* LEYENDA */}
      <div style={{padding:"0.6rem 1.25rem",background:"#F8FAFC",borderBottom:"1px solid #E2E8F0",display:"flex",gap:"0.6rem",flexWrap:"wrap",alignItems:"center"}}>
        <span style={{fontSize:"0.65rem",fontWeight:800,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.06em"}}>Tipos:</span>
        {[
          {emoji:"👥",label:"Cuadrilla SPIA",    color:"#0B3D91",bg:"#eff6ff"},
          {emoji:"⏰",label:"Horas Extras",       color:"#92400e",bg:"#fffbeb"},
          {emoji:"📅",label:"Por Días (CIAMSA2)", color:"#5b21b6",bg:"#f5f3ff"},
          {emoji:"⚖️",label:"Destajo (CIAMSA3)", color:"#0369a1",bg:"#e0f2fe"},
        ].map((t,i)=>(
          <span key={i} style={{fontSize:"0.7rem",fontWeight:700,color:t.color,background:t.bg,border:`1px solid ${t.color}30`,borderRadius:20,padding:"2px 10px"}}>
            {t.emoji} {t.label}
          </span>
        ))}
      </div>

      {/* TABLA DÍA A DÍA */}
      <div style={{padding:"1rem 1.25rem"}}>
        <div style={{fontSize:"0.68rem",fontWeight:800,color:BLUE,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"0.6rem"}}>
          📅 Todos los movimientos — {dias.length} registro(s)
        </div>

        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:"0.8rem",minWidth:750}}>
            <thead>
              <tr style={{background:BLUE}}>
                {["#","FECHA","TIPO","OPERACIÓN / SERVICIO","CLIENTE","CANTIDAD","N°PER","TARIFA","FÓRMULA","SU VALOR","ACUMULADO"].map(h=>(
                  <th key={h} style={{padding:"0.55rem 0.5rem",textAlign:["CANTIDAD","TARIFA","SU VALOR","ACUMULADO","N°PER"].includes(h)?"right":"left",fontSize:"0.62rem",fontWeight:800,color:"#fff",whiteSpace:"nowrap",letterSpacing:"0.03em"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dias.length === 0 ? (
                <tr><td colSpan={11} style={{textAlign:"center",padding:"2rem",color:"#94a3b8"}}>Sin registros de producción</td></tr>
              ) : dias.map((dia, i) => {
                const tipo = tipoOp(dia);
                // Color de fila según cliente para distinguir visualmente
                const bgRow = i%2===0 ? "#fff" : "#F0F9FF";
                return (
                  <tr key={i} style={{borderBottom:"1px solid #e2e8f0",background:bgRow}}>
                    <td style={{padding:"0.5rem 0.5rem",color:"#94a3b8",fontSize:"0.72rem"}}>{i+1}</td>
                    <td style={{padding:"0.5rem 0.5rem",color:"#374151",fontWeight:700,whiteSpace:"nowrap",fontSize:"0.78rem"}}>{fmtFecha(dia.fecha)}</td>
                    <td style={{padding:"0.5rem 0.5rem"}}>
                      <span style={{fontSize:"0.65rem",fontWeight:800,color:tipo.color,background:tipo.bg,border:`1px solid ${tipo.color}30`,borderRadius:20,padding:"2px 6px",whiteSpace:"nowrap"}}>
                        {tipo.emoji} {tipo.label}
                      </span>
                    </td>
                    <td style={{padding:"0.5rem 0.5rem",maxWidth:160}}>
                      <div style={{fontWeight:700,fontSize:"0.78rem",color:"#1e293b",lineHeight:1.3}}>{dia.servicio||"—"}</div>
                      {dia.cuadrillaNombre && !dia.modoCiamsa && !dia.modoHorasExtras && (
                        <div style={{fontSize:"0.6rem",color:BLUE,marginTop:"1px"}}>Cua. {dia.cuadrillaNombre}</div>
                      )}
                    </td>
                    <td style={{padding:"0.5rem 0.5rem"}}>
                      <span style={{fontSize:"0.68rem",fontWeight:700,color:"#0369a1",background:"#e0f2fe",borderRadius:5,padding:"1px 6px",whiteSpace:"nowrap"}}>
                        {dia.clienteNombre||dia.clienteId||"SPIA"}
                      </span>
                    </td>
                    <td style={{padding:"0.5rem 0.5rem",textAlign:"right"}}>{cantidadLabel(dia)}</td>
                    <td style={{padding:"0.5rem 0.5rem",textAlign:"right"}}>{personasLabel(dia)}</td>
                    <td style={{padding:"0.5rem 0.5rem",textAlign:"right"}}>{tarifaLabel(dia)}</td>
                    <td style={{padding:"0.5rem 0.5rem",maxWidth:150}}>
                      <span style={{fontSize:"0.62rem",color:BLUE,fontFamily:"monospace",background:"#e0f2fe",borderRadius:4,padding:"2px 5px",display:"inline-block",lineHeight:1.4,wordBreak:"break-all"}}>
                        {formulaTexto(dia)}
                      </span>
                    </td>
                    <td style={{padding:"0.5rem 0.5rem",textAlign:"right",fontWeight:800,color:S,fontFamily:"monospace",fontSize:"0.88rem",whiteSpace:"nowrap"}}>
                      {fmt(dia.netoPersona)}
                    </td>
                    <td style={{padding:"0.5rem 0.5rem",textAlign:"right",fontFamily:"monospace",fontSize:"0.78rem",fontWeight:600,color:BLUE,whiteSpace:"nowrap",background:i%2===0?"#EFF6FF":"#DBEAFE"}}>
                      {fmt(dia.acumulado)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{background:`linear-gradient(90deg,${BLUE},#0284c7)`,borderTop:`3px solid ${BLUE}`}}>
                <td colSpan={9} style={{padding:"0.75rem 0.9rem",fontWeight:800,color:"#fff",fontSize:"0.88rem"}}>
                  ✅ TOTAL — {dias.length} movimiento(s)
                </td>
                <td style={{padding:"0.75rem 0.9rem",textAlign:"right",fontWeight:900,color:"#fff",fontFamily:"monospace",fontSize:"1.05rem",whiteSpace:"nowrap"}}>
                  {fmt(totalProd)}
                </td>
                <td style={{padding:"0.75rem 0.9rem",textAlign:"right",color:"rgba(255,255,255,0.7)",fontSize:"0.85rem"}}>⬆</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* RESUMEN POR CLIENTE */}
      {Object.keys(resumenPorCliente).length > 1 && (
        <div style={{margin:"0 1.25rem 1rem",borderRadius:10,border:"1.5px solid #BAE6FD",overflow:"hidden"}}>
          <div style={{background:"#F0F9FF",padding:"0.5rem 1rem",fontSize:"0.65rem",fontWeight:800,color:BLUE,textTransform:"uppercase",letterSpacing:"0.08em",borderBottom:"1px solid #BAE6FD"}}>
            📊 Desglose por cliente
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))"}}>
            {Object.entries(resumenPorCliente).map(([cNom,val],i)=>(
              <div key={i} style={{padding:"0.6rem 1rem",borderRight:"1px solid #E0F2FE",borderBottom:"1px solid #E0F2FE"}}>
                <div style={{fontSize:"0.68rem",fontWeight:700,color:BLUE,marginBottom:"0.2rem"}}>{cNom}</div>
                <div style={{fontFamily:"monospace",fontWeight:800,color:S,fontSize:"0.92rem"}}>{fmt(val.total)}</div>
                <div style={{fontSize:"0.62rem",color:"#94a3b8"}}>{val.ops} operación(es)</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* RESUMEN FINANCIERO */}
      <div style={{margin:"0 1.25rem 1.25rem",borderRadius:12,border:"1.5px solid #BAE6FD",overflow:"hidden"}}>
        <div style={{background:"#F0F9FF",padding:"0.6rem 1rem",fontSize:"0.65rem",fontWeight:800,color:BLUE,textTransform:"uppercase",letterSpacing:"0.08em",borderBottom:"1px solid #BAE6FD"}}>
          💰 Resumen de Liquidación
        </div>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"0.88rem"}}>
          <tbody>
            <tr style={{background:"#F0FDF4",borderBottom:"1px solid #D1FAE5"}}>
              <td style={{padding:"0.65rem 1rem",color:"#065f46",fontWeight:700}}>
                ✅ Total producción acumulada ({dias.length} movimiento(s))
              </td>
              <td style={{padding:"0.65rem 1rem",textAlign:"right",fontWeight:900,color:S,fontFamily:"monospace",fontSize:"1rem"}}>
                {fmt(totalProd)}
              </td>
            </tr>
            {dedsOp.map((ded,i)=>(
              <tr key={i} style={{background:"#FFF9F9",borderBottom:"1px solid #FEE2E2"}}>
                <td style={{padding:"0.55rem 1rem 0.55rem 1.75rem",color:DR}}>➖ {ded.concepto}</td>
                <td style={{padding:"0.55rem 1rem",textAlign:"right",fontWeight:700,color:DR,fontFamily:"monospace"}}>({fmt(ded.valor)})</td>
              </tr>
            ))}
            {adelanto>0&&(
              <tr style={{background:"#FFFBEB",borderBottom:"1px solid #FDE68A"}}>
                <td style={{padding:"0.55rem 1rem 0.55rem 1.75rem",color:W,fontWeight:600}}>➖ Adelanto / Préstamo descontado</td>
                <td style={{padding:"0.55rem 1rem",textAlign:"right",fontWeight:700,color:W,fontFamily:"monospace"}}>({fmt(adelanto)})</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* NETO TOTAL */}
      <div style={{margin:"0 1.25rem 1.25rem",background:"linear-gradient(135deg,#F0FDF4 0%,#DCFCE7 100%)",border:"2px solid #6EE7B7",borderRadius:14,padding:"1.25rem 1.5rem",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:"0.5rem"}}>
        <div>
          <div style={{fontWeight:900,color:"#065F46",fontSize:"1.2rem",textTransform:"uppercase",letterSpacing:"0.04em"}}>💵 TOTAL A RECIBIR</div>
          <div style={{color:"#059669",fontSize:"0.78rem",fontWeight:700,marginTop:"0.25rem"}}>
            {d.periodoLabel || "Historial completo"} · {dias.length} movimiento(s)
          </div>
          {totalDedOp>0&&<div style={{fontSize:"0.72rem",color:"#6B7280",marginTop:"0.2rem"}}>Producción {fmt(totalProd)} − Descuentos {fmt(totalDedOp)}</div>}
        </div>
        <div style={{fontWeight:900,color:"#065F46",fontSize:"2.2rem",fontFamily:"monospace",letterSpacing:"-0.02em",lineHeight:1}}>
          {fmt(neto)}
        </div>
      </div>

      {/* FIRMAS */}
      <div style={{padding:"1.25rem 1.75rem",display:"grid",gridTemplateColumns:"1fr 1fr",gap:"3rem",borderTop:"1px solid #E2E8F0"}}>
        {["Firma y C.C. del Trabajador","Firma y Sello de la Empresa"].map(f=>(
          <div key={f} style={{textAlign:"center"}}>
            <div style={{borderBottom:"2px solid #475569",marginBottom:"0.6rem",height:52}}/>
            <div style={{fontSize:"0.74rem",color:"#475569",fontWeight:700}}>{f}</div>
          </div>
        ))}
      </div>
      <div style={{padding:"0.6rem 1.75rem",background:"#F0F9FF",borderTop:"1px solid #BAE6FD",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap"}}>
        <div style={{fontSize:"0.62rem",color:"#94A3B8"}}>Generado: {new Date().toLocaleDateString("es-CO")} · logisport.vercel.app</div>
        <div style={{fontSize:"0.62rem",color:"#94A3B8",fontFamily:"monospace"}}>Ref: {String(d.token||d.id||"").slice(-14).toUpperCase()}</div>
      </div>
    </div>
  );
}
