// pages/nomina/desprendibles.js
// Generación y gestión de desprendibles de pago por quincena
// v2 — detalle completo por día desde la matriz (todos los clientes)

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  collection, getDocs, getDoc, setDoc, deleteDoc, doc,
  query, orderBy, where, Timestamp
} from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";
import { getUserRoleByUid } from "@/utils/getUserRole";
import LayoutWithSidebar from "@/components/LayoutWithSidebar";
import { formatCOP } from "@/utils/nominaCalculos";
import {
  ArrowLeft, RefreshCw, FileText, Users, DollarSign,
  Calendar, Download, Eye, Trash2, CheckCircle, Send, Search
} from "lucide-react";

const PRIMARY = "#0B3D91";
const SUCCESS = "#10b981";
const DANGER  = "#ef4444";
const ACCENT  = "#00AEEF";
const tdSt    = {padding:"0.75rem 0.9rem",verticalAlign:"middle"};

const hoy          = () => new Date().toISOString().split("T")[0];
const primerDiaMes = () => { const d=new Date(); return new Date(d.getFullYear(),d.getMonth(),1).toISOString().split("T")[0]; };

const generarToken = (cedula, desde, hasta) => {
  const raw = `${cedula}_${desde}_${hasta}`;
  if (typeof btoa !== "undefined") return btoa(raw).replace(/[+/=]/g, c => ({"+":"-","/":"_","=":""}[c]));
  return raw.replace(/[^a-z0-9]/gi,"_");
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

// Fórmula detallada para cada tipo
const formulaOp = (dia, fmtFn) => {
  const fmt = fmtFn || ((n) => `$${Number(n||0).toLocaleString("es-CO")}`);
  if (dia.modoHorasExtras) {
    const tarifa = dia.servicioValorUnitario || dia.tarifaUnitaria || 0;
    return `${fmt(tarifa)}/hr × ${dia.horasExtras}h`;
  }
  if (dia.modoCliente2) {
    const tarifa = dia.tarifaUnitaria || 0;
    const dias   = dia.cantidadDias || dia.per || 0;
    return `${dias} día(s) × ${fmt(tarifa)}/día`;
  }
  if (dia.modoCiamsa && dia.cantidadTons != null) {
    const tons   = parseFloat(dia.cantidadTons) || 0;
    const nPer   = dia.nPersonas || 1;
    const per    = dia.per || (tons / nPer);
    const tarifa = dia.tarifaUnitaria || 0;
    const u      = dia.unidad || "ton";
    return `${tons.toFixed(2)} ${u} ÷ ${nPer} pers. = ${Number(per).toFixed(4)} × ${fmt(tarifa)}`;
  }
  // SPIA cuadrilla normal
  const cant     = parseInt(dia.cantidad)  || 1;
  const personas = parseInt(dia.personas)  || 1;
  const val      = dia.servicioValorUnitario || 0;
  if (val > 0) return `(${fmt(val)} × ${cant}) ÷ ${personas} pers.`;
  return `${cant} und. ÷ ${personas} pers.`;
};

export default function Desprendibles() {
  const router = useRouter();
  const [rol, setRol]         = useState(null);
  const [loading, setLoading] = useState(true);

  const [desde, setDesde] = useState(primerDiaMes());
  const [hasta, setHasta] = useState(hoy());

  const [operaciones,    setOperaciones]    = useState([]);
  const [desprendibles,  setDesprendibles]  = useState([]);
  const [trabajadoresMap,setTrabajadoresMap]= useState({});
  const [clientes,       setClientes]       = useState([]);
  const [cargando,       setCargando]       = useState(false);
  const [generando,      setGenerando]      = useState(false);
  const [generadoOk,     setGeneradoOk]     = useState(false);

  const [busqueda,   setBusqueda]   = useState("");
  const [vistaPrevia,setVistaPrevia]= useState(null);

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
  }, [desde, hasta, loading]);

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
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setClientes(lista);
    } catch {}
  };

  const cargarOperaciones = async () => {
    setCargando(true);
    try {
      const ini  = Timestamp.fromDate(new Date(desde + "T00:00:00"));
      const fin  = Timestamp.fromDate(new Date(hasta  + "T23:59:59"));
      const snap = await getDocs(query(
        collection(db, "nomina_operaciones"),
        where("fecha",">=",ini), where("fecha","<=",fin), orderBy("fecha")
      ));
      setOperaciones(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch(e) { console.error(e); }
    setCargando(false);
  };

  const cargarDesprendibles = async () => {
    try {
      const snap = await getDocs(query(
        collection(db, "nomina_desprendibles"),
        where("quincenaDesde","==",desde),
        where("quincenaHasta","==",hasta)
      ));
      setDesprendibles(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch(e) { console.error(e); }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // CALCULAR RESUMEN POR TRABAJADOR — todos los clientes
  // Captura todos los campos de cada operación de la matriz
  // ─────────────────────────────────────────────────────────────────────────
  const calcularResumen = () => {
    const mapa = {};

    operaciones.forEach(op => {
      const asisten = op.trabajadoresAsisten || [];
      if (!asisten.length) return;

      // Para operaciones CIAMSA (individual) o horas extras individuales,
      // netoAPagar ya es por persona. Para cuadrillas SPIA se divide.
      const esIndividual = op.modoCiamsa || op.modoHorasExtras;
      const parte = esIndividual
        ? (op.netoAPagar || 0)
        : (op.netoAPagar || 0) / asisten.length;

      const nomCliente = clientes.find(c => c.id === (op.clienteId || "spia"))?.nombre
        || op.clienteId || "SPIA";

      asisten.forEach(w => {
        const cargoWorker = trabajadoresMap[w.id]?.cargo || "";
        if (!mapa[w.id]) {
          mapa[w.id] = {
            id: w.id,
            nombre: w.nombre,
            cedula: w.cedula || "",
            cargo: cargoWorker,
            cuadrillaNombre: op.cuadrillaNombre || op.cuadrilla || "",
            cuadrillaId: op.cuadrillaId || "",
            clienteId: op.clienteId || "spia",
            clienteNombre: nomCliente,
            dias: [],
            totalDevengado: 0,
          };
        }

        // Enriquecer cuadrilla si ya existe el trabajador en otro cliente
        if (!mapa[w.id].cuadrillaNombre && (op.cuadrillaNombre || op.cuadrilla)) {
          mapa[w.id].cuadrillaNombre = op.cuadrillaNombre || op.cuadrilla;
        }

        mapa[w.id].dias.push({
          fecha:              op.fechaStr,
          servicio:           op.servicioNombre,
          clienteId:          op.clienteId || "spia",
          clienteNombre:      nomCliente,
          // Cuadrilla
          cuadrillaNombre:    op.cuadrillaNombre || op.cuadrilla || "",
          personas:           op.personas,
          cantidad:           op.cantidad || 1,
          // Modo horas extras (SPIA individual)
          modoHorasExtras:    op.modoHorasExtras || false,
          horasExtras:        op.horasExtras   ?? null,
          servicioValorUnitario: op.servicioValorUnitario || 0,
          // Campos destajo CIAMSA3
          modoCiamsa:         op.modoCiamsa    || false,
          cantidadTons:       op.cantidadTons  ?? null,
          per:                op.per           ?? null,
          tarifaUnitaria:     op.tarifaUnitaria ?? null,
          unidad:             op.unidad        ?? null,
          nPersonas:          op.nPersonas     ?? null,
          // CIAMSA2 (por días)
          modoCliente2:       op.modoCliente2  || false,
          cantidadDias:       op.cantidadDias  ?? null,
          netoPersona:        parte,
        });
        mapa[w.id].totalDevengado += parte;
      });
    });

    return Object.values(mapa).sort((a,b) => a.nombre.localeCompare(b.nombre,"es"));
  };

  // ─────────────────────────────────────────────────────────────────────────
  // GENERAR / ACTUALIZAR DESPRENDIBLES EN FIRESTORE
  // ─────────────────────────────────────────────────────────────────────────
  const generarDesprendibles = async () => {
    const resumen = calcularResumen();
    if (!resumen.length) { alert("No hay operaciones con asistencia en este período."); return; }
    setGenerando(true);
    try {
      const auth = getAuth();
      const uid  = auth.currentUser?.uid || "";

      // Nómina guardada (liquidar.js → nomina_periodos)
      const periodoDocId = `${desde}_${hasta}`;
      let salarioMap = {};
      try {
        const nomSnap = await getDoc(doc(db, "nomina_periodos", periodoDocId));
        if (nomSnap.exists()) {
          (nomSnap.data().empleados || []).forEach(e => {
            const ced = String(e.cedula || "").trim();
            if (ced) salarioMap[ced] = e;
          });
        }
      } catch (_) {}

      // Adelantos del período
      const adelantosMap = {};
      try {
        const ini = Timestamp.fromDate(new Date(desde + "T00:00:00"));
        const fin = Timestamp.fromDate(new Date(hasta  + "T23:59:59"));
        const adelSnap = await getDocs(query(
          collection(db, "nomina_adelantos"),
          where("fecha",">=",ini), where("fecha","<=",fin)
        ));
        adelSnap.docs.forEach(d => {
          const ad  = d.data();
          const ced = String(ad.cedula || ad.trabajadorCedula || "").trim();
          if (ced) adelantosMap[ced] = (adelantosMap[ced] || 0) + (ad.monto || 0);
        });
      } catch (_) {}

      await Promise.all(resumen.map(t => {
        const token   = generarToken(t.cedula || t.id, desde, hasta);
        const ced     = String(t.cedula || "").trim();
        const salario = salarioMap[ced] || null;
        const adelanto = adelantosMap[ced] || 0;
        const cargoFinal = salario?.cargo || t.cargo || trabajadoresMap[t.id]?.cargo || "";

        const deducciones = [];
        if (salario) {
          if ((salario.salud   || 0) > 0) deducciones.push({ concepto:"Salud (4%)",   valor: salario.salud });
          if ((salario.pension || 0) > 0) deducciones.push({ concepto:"Pensión (4%)", valor: salario.pension });
        }
        if (adelanto > 0) deducciones.push({ concepto:"Adelanto / Préstamo", valor: adelanto });

        const data = {
          token,
          cedula:           t.cedula,
          nombre:           t.nombre,
          cuadrillaNombre:  t.cuadrillaNombre,
          cuadrillaId:      t.cuadrillaId,
          clienteId:        t.clienteId,
          clienteNombre:    t.clienteNombre,
          quincenaDesde:    desde,
          quincenaHasta:    hasta,
          quincenaLabel:    `${desde} al ${hasta}`,
          // Detalle completo de operaciones día a día
          dias:             t.dias,
          totalDevengado:   Math.round(t.totalDevengado * 100) / 100,
          ...(salario ? {
            cargo:                   cargoFinal,
            basicoMensual:           salario.basicoMensual           || 0,
            diasTrabajados:          salario.diasTrabajados          || 0,
            salarioBasicoQuincena:   salario.salarioBasicoQuincena   || 0,
            productividad:           salario.productividad           || 0,
            complementoSalario:      salario.complementoSalario      || 0,
            produccionEfectiva:      salario.produccionEfectiva      || 0,
            baseCotizacion:          salario.baseCotizacion          || 0,
            salud:                   salario.salud                   || 0,
            pension:                 salario.pension                 || 0,
            salarioMenosDeducciones: salario.salarioMenosDeducciones || 0,
            subsidioTransporte:      salario.subsidioTransporte      || 0,
            retroactivo:             salario.retroactivo             || 0,
            netoAPagar:              Math.max(0, (salario.netoAPagar || 0) - adelanto),
            observacion:             salario.observacion             || "",
            tieneDatosNomina:        true,
          } : {
            cargo:            cargoFinal,
            tieneDatosNomina: false,
            netoAPagar:       Math.round(t.totalDevengado * 100) / 100,
          }),
          adelantosDeducidos: adelanto,
          deducciones,
          generadoEn:   new Date(),
          generadoPor:  uid,
          empresa:      "LOGISPORT S.A.S.",
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
            <p style={{margin:0,color:"#64748b",fontSize:"0.88rem"}}>Todos los clientes · Detalle completo por día desde la Matriz</p>
          </div>
          {/* Selector período */}
          <div style={{display:"flex",alignItems:"center",gap:"0.6rem",background:"#fff",border:`1.5px solid ${PRIMARY}30`,borderRadius:"12px",padding:"0.6rem 1rem",flexWrap:"wrap",boxShadow:"0 2px 8px rgba(11,61,145,0.08)"}}>
            <Calendar size={16} color={PRIMARY}/>
            {[{label:"Desde",val:desde,set:setDesde},{label:"Hasta",val:hasta,set:setHasta}].map((f,i)=>(
              <div key={i} style={{display:"flex",flexDirection:"column"}}>
                <span style={{fontSize:"0.68rem",color:"#94a3b8",fontWeight:"700",textTransform:"uppercase",letterSpacing:"0.05em"}}>{f.label}</span>
                <input type="date" value={f.val} onChange={e=>f.set(e.target.value)}
                  style={{border:"none",outline:"none",fontSize:"0.9rem",fontWeight:"700",color:PRIMARY,cursor:"pointer",background:"transparent",padding:0}}/>
              </div>
            ))}
            <button onClick={()=>{cargarOperaciones();cargarDesprendibles();}} title="Recargar"
              style={{background:`${PRIMARY}10`,border:"none",borderRadius:"8px",padding:"0.35rem 0.5rem",cursor:"pointer",color:PRIMARY}}>
              <RefreshCw size={14} style={{animation:cargando?"spin 1s linear infinite":"none"}}/>
            </button>
          </div>
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
            El trabajador ingresa su cédula y descarga su desprendible sin crear cuenta.
          </div>
        </div>

        {/* STATS */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:"1rem",marginBottom:"1.5rem"}}>
          {[
            {icon:<Users size={20}/>,label:"Trabajadores detectados",value:resumen.length,color:PRIMARY},
            {icon:<FileText size={20}/>,label:"Desprendibles generados",value:desprendibles.length,color:"#8b5cf6"},
            {icon:<DollarSign size={20}/>,label:"Total producción",value:formatCOP(totalNeto),color:SUCCESS},
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
                ? `${resumen.length} trabajadores encontrados — todos los clientes`
                : "Sin operaciones en este período"}
            </div>
            <div style={{color:"#64748b",fontSize:"0.82rem",marginTop:"0.2rem"}}>
              {desprendibles.length>0
                ? `Ya existen ${desprendibles.length} desprendibles — al regenerar se actualizan`
                : "Genera los desprendibles para que los trabajadores puedan acceder"}
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
                🔗 Desprendibles generados — {desde} al {hasta}
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
                    {["#","Trabajador","Cédula","Cliente","Días","Producción","Neto","Enlace","Acc."].map(h=>(
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
                          <span style={{background:"#f0f9ff",color:ACCENT,borderRadius:"6px",padding:"2px 8px",fontSize:"0.75rem",fontWeight:"700"}}>
                            {d.clienteNombre || d.clienteId || "SPIA"}
                          </span>
                        </td>
                        <td style={{...tdSt,textAlign:"center",fontWeight:"700",color:"#374151"}}>
                          {Array.isArray(d.dias) ? d.dias.length : (d.diasTrabajados ?? "—")}
                        </td>
                        <td style={{...tdSt,fontFamily:"monospace",color:"#475569",fontSize:"0.85rem"}}>
                          {formatCOP(d.totalDevengado || 0)}
                        </td>
                        <td style={{...tdSt,fontWeight:"900",color:SUCCESS,fontFamily:"monospace"}}>{formatCOP(d.netoAPagar)}</td>
                        <td style={tdSt}>
                          <div style={{display:"flex",alignItems:"center",gap:"0.4rem"}}>
                            <span style={{fontFamily:"monospace",fontSize:"0.65rem",color:"#94a3b8",background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:"5px",padding:"2px 6px",maxWidth:"150px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                              token={tk.slice(-10)}
                            </span>
                            <button onClick={()=>navigator.clipboard?.writeText(urlPublica(tk))}
                              style={{background:"#f0f9ff",border:"none",borderRadius:"6px",padding:"0.3rem 0.5rem",cursor:"pointer",color:ACCENT,fontSize:"0.72rem",fontWeight:"700",whiteSpace:"nowrap"}}>
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
                  style={{background:PRIMARY,border:"none",borderRadius:"8px",padding:"0.5rem 1rem",color:"#fff",fontWeight:"700",fontSize:"0.82rem",cursor:"pointer",display:"flex",alignItems:"center",gap:"0.4rem"}}>
                  <Download size={14}/> Abrir para descargar
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
   COMPONENTE PRINCIPAL DE VISTA PREVIA
   Muestra uno o dos tabs: Nómina completa + Detalle de producción por día
══════════════════════════════════════════════════════════════════════════════ */
export function DesprendiblePreview({ d, modoImpresion = false }) {
  const tieneCuadrilla = Array.isArray(d.dias) && d.dias.length > 0;
  const tieneNomina    = !!(d.tieneDatosNomina || d.salud || d.pension);
  const [vista, setVista] = useState(() => (!tieneNomina && tieneCuadrilla) ? "produccion" : "nomina");

  const totalDeducciones = (d.deducciones || []).reduce((s,x) => s + (x.valor||0), 0);
  const neto = d.netoAPagar || ((d.totalDevengado||0) - totalDeducciones);

  return (
    <div style={{fontFamily:"Arial,Helvetica,sans-serif"}}>
      {/* Tabs */}
      {!modoImpresion && (tieneCuadrilla || tieneNomina) && (
        <div style={{display:"flex",gap:"0.5rem",marginBottom:"1rem",background:"#fff",borderRadius:12,padding:"0.4rem",boxShadow:"0 2px 8px rgba(11,61,145,0.1)",border:"1.5px solid rgba(11,61,145,0.12)"}}>
          {tieneNomina && (
            <button onClick={()=>setVista("nomina")}
              style={{flex:1,padding:"0.65rem 1rem",borderRadius:9,border:"none",cursor:"pointer",fontWeight:700,fontSize:"0.88rem",background:vista==="nomina"?"#0B3D91":"transparent",color:vista==="nomina"?"#fff":"#475569",transition:"all 0.2s"}}>
              📋 Desprendible de Nómina
              <div style={{fontSize:"0.68rem",fontWeight:400,opacity:0.8,marginTop:"1px"}}>Salario completo + deducciones legales</div>
            </button>
          )}
          {tieneCuadrilla && (
            <button onClick={()=>setVista("produccion")}
              style={{flex:1,padding:"0.65rem 1rem",borderRadius:9,border:"none",cursor:"pointer",fontWeight:700,fontSize:"0.88rem",background:vista==="produccion"?"#0369a1":"transparent",color:vista==="produccion"?"#fff":"#475569",transition:"all 0.2s"}}>
              📅 Detalle de Producción
              <div style={{fontSize:"0.68rem",fontWeight:400,opacity:0.8,marginTop:"1px"}}>Día a día · {d.dias?.length || 0} registro(s) de la matriz</div>
            </button>
          )}
        </div>
      )}

      {(modoImpresion || vista === "nomina") && tieneNomina && <DespPrevNomina d={d} />}
      {(modoImpresion || vista === "produccion") && tieneCuadrilla && (
        <div style={{marginTop: modoImpresion ? "2rem" : 0}}>
          <DespPrevProduccion d={d} />
        </div>
      )}

      {!tieneNomina && !tieneCuadrilla && (
        <div style={{fontFamily:"Arial,sans-serif",maxWidth:"700px",margin:"0 auto",background:"#fff",border:"2px solid #0B3D91",borderRadius:"14px",overflow:"hidden",boxShadow:"0 4px 20px rgba(11,61,145,0.15)"}}>
          <div style={{background:"linear-gradient(135deg,#0B3D91 0%,#1a56c4 100%)",padding:"1.25rem 1.5rem",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div style={{color:"#fff",fontWeight:"900",fontSize:"1.3rem"}}>LOGISPORT</div>
            <div style={{color:"#fff",fontWeight:"800",fontSize:"1rem"}}>COMPROBANTE DE PAGO</div>
          </div>
          <div style={{padding:"1.25rem 1.5rem",background:"#f0fdf4",borderTop:"3px solid #10b981",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{fontWeight:"900",color:"#065f46",fontSize:"1.1rem"}}>NETO A PAGAR</div>
            <div style={{fontWeight:"900",color:"#065f46",fontSize:"1.8rem",fontFamily:"monospace"}}>{formatCOP(neto)}</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   DESPRENDIBLE DE NÓMINA COMPLETA
══════════════════════════════════════════════════════════════════════════════ */
function DespPrevNomina({ d }) {
  const S = "#059669"; const D = "#DC2626"; const W = "#B45309"; const G = "#475569"; const P = "#0B3D91";

  const totalProd    = d.totalProduccion ?? d.totalDevengado ?? 0;
  const complemento  = d.complementoSalario ?? 0;
  const prodEfectiva = d.produccionEfectiva ?? totalProd;
  const retroactivo  = d.retroactivo ?? 0;
  const baseCotiz    = d.baseCotizacion ?? prodEfectiva;
  const salud        = d.salud    ?? Math.round(baseCotiz * 0.04);
  const pension      = d.pension  ?? Math.round(baseCotiz * 0.04);
  const salMinDed    = d.salarioMenosDeducciones ?? (baseCotiz - salud - pension);
  const subsidio     = d.subsidioTransporte ?? 0;
  const adelanto     = d.adelantosDeducidos ?? 0;
  const neto         = d.netoAPagar ?? (salMinDed + subsidio - adelanto);
  const dias         = d.diasTrabajados ?? d.dias?.length ?? "—";
  const totalDed     = salud + pension + adelanto;
  const fmt = (n) => formatCOP(n || 0);

  const Row = ({ label, valor, color, bold, bg, signo, note, italic }) => (
    <tr style={{background:bg||"transparent"}}>
      <td style={{padding:"0.5rem 0.75rem",color:italic?"#64748B":"#374151",fontStyle:italic?"italic":"normal",fontSize:"0.85rem",borderBottom:"1px solid #F1F5F9",lineHeight:1.3}}>
        <div style={{fontWeight:bold?700:400}}>{label}</div>
        {note&&<div style={{fontSize:"0.68rem",color:"#94A3B8",marginTop:"1px"}}>{note}</div>}
      </td>
      <td style={{padding:"0.5rem 0.75rem",textAlign:"right",whiteSpace:"nowrap",fontFamily:"monospace",fontWeight:bold?800:600,color:color||"#374151",fontSize:bold?"0.95rem":"0.88rem",borderBottom:"1px solid #F1F5F9"}}>
        {signo==="−"?<span>({fmt(valor)})</span>:<span>{signo==="+"?"+":""}{fmt(valor)}</span>}
      </td>
    </tr>
  );
  const Sec = ({label}) => (
    <tr><td colSpan={2} style={{padding:"0.55rem 0.75rem 0.2rem",fontSize:"0.65rem",fontWeight:800,color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.08em",borderTop:"1px dashed #E2E8F0"}}>{label}</td></tr>
  );

  return (
    <div style={{fontFamily:"Arial,Helvetica,sans-serif",background:"#fff",border:`2px solid ${P}`,borderRadius:16,overflow:"hidden",boxShadow:"0 6px 30px rgba(11,61,145,0.15)",maxWidth:800,margin:"0 auto"}}>
      <div style={{background:`linear-gradient(135deg,${P} 0%,#1a56c4 100%)`,padding:"1.35rem 1.75rem",display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:"0.75rem"}}>
        <div>
          <div style={{color:"#fff",fontWeight:900,fontSize:"1.55rem",letterSpacing:"0.04em"}}>LOGISPORT S.A.S.</div>
          <div style={{color:"rgba(255,255,255,0.72)",fontSize:"0.75rem"}}>logisport.vercel.app · Sistema de Gestión de Nómina</div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{display:"inline-block",background:"rgba(255,255,255,0.18)",border:"1px solid rgba(255,255,255,0.35)",borderRadius:8,padding:"3px 12px",color:"#fff",fontSize:"0.68rem",fontWeight:800,letterSpacing:"0.08em",marginBottom:"0.4rem"}}>📋 DESPRENDIBLE DE NÓMINA</div>
          <div style={{color:"#fff",fontWeight:800,fontSize:"1rem"}}>{d.quincenaLabel||`${d.quincenaDesde} al ${d.quincenaHasta}`}</div>
        </div>
      </div>

      <div style={{padding:"1rem 1.75rem",background:"#F8FAFC",borderBottom:"1px solid #E2E8F0"}}>
        <div style={{fontSize:"0.65rem",fontWeight:800,color:P,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"0.85rem"}}>📋 Datos del Trabajador</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:"0.9rem"}}>
          {[
            {label:"NOMBRE COMPLETO",valor:d.nombre||"—"},
            {label:"CÉDULA",valor:d.cedula||"—"},
            {label:"CARGO",valor:d.cargo||"—"},
            {label:"CLIENTE",valor:d.clienteNombre||d.clienteId||"SPIA"},
            {label:"PERÍODO",valor:`${d.quincenaDesde} al ${d.quincenaHasta}`},
            {label:"DÍAS LIQUIDADOS",valor:`${dias} días`},
          ].map((f,i)=>(
            <div key={i}>
              <div style={{fontSize:"0.6rem",fontWeight:800,color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.07em"}}>{f.label}</div>
              <div style={{fontSize:"0.88rem",fontWeight:700,color:"#1E293B",marginTop:"0.15rem"}}>{f.valor}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{padding:"1rem 1.75rem",borderBottom:"1px solid #E2E8F0"}}>
        <div style={{fontSize:"0.65rem",fontWeight:800,color:P,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"0.85rem"}}>💰 Liquidación de Nómina — Detalle completo</div>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"0.88rem"}}>
          <tbody>
            <Sec label="DEVENGADO"/>
            <Row label="Total Producción (operaciones período)" valor={totalProd} color={totalProd>0?S:G} bold/>
            {complemento>0&&<Row label="+ Complemento al Salario Mínimo (empresa)" valor={complemento} color={W} note="La empresa completa la diferencia al SMMLV proporcional" italic/>}
            {complemento>0&&<Row label="= Producción efectiva (base liquidación)" valor={prodEfectiva} color={S} bold bg="#F0FDF4"/>}
            {retroactivo>0&&<Row label="+ Retroactivo (ajuste período anterior)" valor={retroactivo} color="#1D4ED8" italic signo="+"/>}
            <Sec label="DEDUCCIONES LEGALES (a cargo del trabajador)"/>
            <Row label="Base de cotización (seguridad social)" valor={baseCotiz} color={G} note={complemento>0?"Elevada al mínimo proporcional":""}/>
            <Row label="− Salud (4% del trabajador)"   valor={salud}   color={D} signo="−" note="Aporte obligatorio EPS"/>
            <Row label="− Pensión (4% del trabajador)" valor={pension} color={D} signo="−" note="Aporte obligatorio fondo de pensiones"/>
            {adelanto>0&&<Row label="− Adelanto / Préstamo" valor={adelanto} color={D} signo="−" note="Valor recibido en avance"/>}
            <tr style={{background:"#FFF1F2"}}>
              <td style={{padding:"0.5rem 0.75rem",color:D,fontWeight:700,fontSize:"0.85rem",borderBottom:"2px solid #FECDD3"}}>Total deducciones</td>
              <td style={{padding:"0.5rem 0.75rem",textAlign:"right",fontFamily:"monospace",fontWeight:800,color:D,fontSize:"0.9rem",borderBottom:"2px solid #FECDD3"}}>({fmt(totalDed)})</td>
            </tr>
            <Row label="= Subtotal (después de deducciones)" valor={salMinDed} color={P} bold bg="#EFF6FF"/>
            {subsidio>0&&<><Sec label="AUXILIO DE TRANSPORTE"/><Row label={`Subsidio proporcional (${dias} días)`} valor={subsidio} color={S} signo="+"/></>}
            {d.observacion&&<><Sec label="OBSERVACIONES"/><tr><td colSpan={2} style={{padding:"0.5rem 0.75rem",color:"#374151",fontStyle:"italic",fontSize:"0.83rem",background:"#FEFCE8",border:"1px solid #FDE68A"}}>{d.observacion}</td></tr></>}
          </tbody>
        </table>
      </div>

      <div style={{padding:"1.25rem 1.75rem",background:"linear-gradient(135deg,#F0FDF4 0%,#DCFCE7 100%)",borderTop:`3px solid ${S}`,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:"0.5rem"}}>
        <div>
          <div style={{fontWeight:900,color:"#065F46",fontSize:"1.15rem",textTransform:"uppercase",letterSpacing:"0.04em"}}>NETO A PAGAR</div>
          <div style={{color:"#4ADE80",fontSize:"0.78rem",fontWeight:700,marginTop:"0.15rem"}}>Período: {d.quincenaDesde} al {d.quincenaHasta}</div>
        </div>
        <div style={{fontWeight:900,color:"#065F46",fontSize:"2.2rem",fontFamily:"monospace"}}>{fmt(neto)}</div>
      </div>

      <div style={{padding:"0.75rem 1.75rem",background:"#F8FAFC",borderTop:"1px solid #E2E8F0",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:"0.75rem"}}>
        {[{label:"Salud",valor:salud,color:D},{label:"Pensión",valor:pension,color:D},...(adelanto>0?[{label:"Adelanto",valor:adelanto,color:W}]:[]),{label:"Subsidio transp.",valor:subsidio,color:S}].map((item,i)=>(
          <div key={i} style={{textAlign:"center",padding:"0.5rem",background:"#fff",borderRadius:8,border:"1px solid #E2E8F0"}}>
            <div style={{fontSize:"0.65rem",color:"#94A3B8",fontWeight:700,textTransform:"uppercase"}}>{item.label}</div>
            <div style={{fontSize:"0.9rem",fontWeight:800,color:item.color,fontFamily:"monospace",marginTop:"0.1rem"}}>{fmt(item.valor)}</div>
          </div>
        ))}
      </div>

      <div style={{padding:"1.25rem 1.75rem",display:"grid",gridTemplateColumns:"1fr 1fr",gap:"3rem",borderTop:"1px solid #E2E8F0"}}>
        {["Firma y C.C. del Trabajador","Firma y Sello de la Empresa"].map(f=>(
          <div key={f} style={{textAlign:"center"}}><div style={{borderBottom:"2px solid #475569",marginBottom:"0.6rem",height:52}}/><div style={{fontSize:"0.74rem",color:G,fontWeight:700}}>{f}</div></div>
        ))}
      </div>
      <div style={{padding:"0.6rem 1.75rem",background:"#F8FAFC",borderTop:"1px solid #E2E8F0",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap"}}>
        <div style={{fontSize:"0.62rem",color:"#94A3B8"}}>Generado: {new Date().toLocaleDateString("es-CO")} · logisport.vercel.app</div>
        <div style={{fontSize:"0.62rem",color:"#94A3B8",fontFamily:"monospace"}}>Ref: {String(d.token||d.id||"").slice(-14).toUpperCase()}</div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   DESPRENDIBLE DE PRODUCCIÓN — DÍA A DÍA (TODOS LOS TIPOS DE OPERACIÓN)
   Muestra cada fila de la matriz con su fórmula completa desglosada
══════════════════════════════════════════════════════════════════════════════ */
function DespPrevProduccion({ d }) {
  const fmt = (n) => formatCOP(n || 0);

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

  const BLUE = "#0369a1";
  const S    = "#059669";
  const DG   = "#DC2626";
  const W    = "#B45309";

  const fmtFecha = (f) => {
    if (!f) return "—";
    const p = f.split("-");
    return p.length===3 ? `${p[2]}/${p[1]}/${p[0].slice(2)}` : f;
  };

  // Detalle de cantidad legible para cada tipo
  const cantidadLabel = (dia) => {
    if (dia.modoHorasExtras) {
      return <span style={{fontWeight:800,color:"#92400e"}}>{dia.horasExtras} <span style={{fontSize:"0.65rem"}}>hr</span></span>;
    }
    if (dia.modoCliente2 && dia.cantidadDias != null) {
      return <span style={{fontWeight:800,color:"#5b21b6"}}>{dia.cantidadDias} <span style={{fontSize:"0.65rem"}}>días</span></span>;
    }
    if (dia.modoCiamsa && dia.cantidadTons != null) {
      return <span style={{fontWeight:800,color:BLUE}}>{parseFloat(dia.cantidadTons).toFixed(2)} <span style={{fontSize:"0.65rem"}}>{dia.unidad||"ton"}</span></span>;
    }
    const cant = parseInt(dia.cantidad) || 1;
    return <span style={{fontWeight:700,color:"#374151"}}>{cant}</span>;
  };

  // Columna "personas" o N°Per para mostrar el divisor
  const personasLabel = (dia) => {
    if (dia.modoHorasExtras || dia.modoCliente2) return <span style={{color:"#94a3b8"}}>—</span>;
    if (dia.modoCiamsa && dia.nPersonas) return <span style={{fontWeight:700,color:BLUE}}>{dia.nPersonas}</span>;
    const p = parseInt(dia.personas) || 1;
    return <span style={{fontWeight:700,color:"#374151"}}>{p}</span>;
  };

  // Tarifa unitaria del servicio
  const tarifaLabel = (dia) => {
    const t = dia.tarifaUnitaria || dia.servicioValorUnitario || 0;
    if (!t) return <span style={{color:"#cbd5e1"}}>—</span>;
    if (dia.modoHorasExtras) return <span style={{fontFamily:"monospace",fontSize:"0.78rem",color:"#92400e"}}>{fmt(t)}<span style={{opacity:0.7}}>/hr</span></span>;
    if (dia.modoCliente2)     return <span style={{fontFamily:"monospace",fontSize:"0.78rem",color:"#5b21b6"}}>{fmt(t)}<span style={{opacity:0.7}}>/día</span></span>;
    if (dia.modoCiamsa)       return <span style={{fontFamily:"monospace",fontSize:"0.78rem",color:BLUE}}>{fmt(t)}<span style={{opacity:0.7}}>/{dia.unidad||"ton"}</span></span>;
    return <span style={{fontFamily:"monospace",fontSize:"0.78rem",color:"#374151"}}>{fmt(t)}</span>;
  };

  // Fórmula completa como texto
  const formulaTexto = (dia) => {
    if (dia.modoHorasExtras) {
      const t = dia.servicioValorUnitario || dia.tarifaUnitaria || 0;
      return `${fmt(t)}/hr × ${dia.horasExtras}h = ${fmt(dia.netoPersona)}`;
    }
    if (dia.modoCliente2) {
      const t = dia.tarifaUnitaria || 0;
      return `${dia.cantidadDias} día(s) × ${fmt(t)} = ${fmt(dia.netoPersona)}`;
    }
    if (dia.modoCiamsa && dia.cantidadTons != null) {
      const tons = parseFloat(dia.cantidadTons) || 0;
      const nP   = dia.nPersonas || 1;
      const per  = dia.per || (tons / nP);
      const t    = dia.tarifaUnitaria || 0;
      return `${tons.toFixed(2)} ÷ ${nP} = ${Number(per).toFixed(4)} × ${fmt(t)}`;
    }
    const cant = parseInt(dia.cantidad) || 1;
    const pers = parseInt(dia.personas) || 1;
    const val  = dia.servicioValorUnitario || 0;
    if (val > 0) return `(${fmt(val)} × ${cant}) ÷ ${pers} pers.`;
    return `${cant} und. ÷ ${pers} pers.`;
  };

  return (
    <div style={{fontFamily:"Arial,Helvetica,sans-serif",background:"#fff",border:"2px solid #0369a1",borderRadius:16,overflow:"hidden",boxShadow:"0 6px 30px rgba(3,105,161,0.15)",maxWidth:900,margin:"0 auto"}}>

      {/* CABECERA */}
      <div style={{background:"linear-gradient(135deg,#0369a1 0%,#0284c7 100%)",padding:"1.25rem 1.5rem",display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:"0.5rem"}}>
        <div>
          <div style={{color:"#fff",fontWeight:900,fontSize:"1.5rem",letterSpacing:"0.04em"}}>LOGISPORT S.A.S.</div>
          <div style={{color:"rgba(255,255,255,0.72)",fontSize:"0.72rem",marginTop:"0.2rem"}}>logisport.vercel.app · Control de Operaciones y Producción</div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{display:"inline-block",background:"rgba(255,255,255,0.2)",border:"1px solid rgba(255,255,255,0.4)",borderRadius:8,padding:"3px 14px",color:"#fff",fontSize:"0.68rem",fontWeight:800,letterSpacing:"0.08em",marginBottom:"0.4rem"}}>
            📅 DETALLE DE PRODUCCIÓN — DÍA A DÍA
          </div>
          <div style={{color:"#fff",fontWeight:800,fontSize:"0.95rem"}}>{d.quincenaLabel||`${d.quincenaDesde} al ${d.quincenaHasta}`}</div>
        </div>
      </div>

      {/* DATOS DEL TRABAJADOR */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:0,background:"#F0F9FF",borderBottom:"2px solid #BAE6FD"}}>
        {[
          {icon:"👤",label:"TRABAJADOR",       valor: d.nombre||"—"},
          {icon:"🪪",label:"CÉDULA",           valor: d.cedula||"—"},
          {icon:"⛏️",label:"CARGO / CUADRILLA",valor: [d.cargo, d.cuadrillaNombre?`Cua. ${d.cuadrillaNombre}`:null].filter(Boolean).join(" · ") || "—"},
          {icon:"🏢",label:"CLIENTE",           valor: d.clienteNombre||d.clienteId||"SPIA"},
          {icon:"📅",label:"PERÍODO",           valor: `${d.quincenaDesde} al ${d.quincenaHasta}`},
          {icon:"📆",label:"REGISTROS",         valor: `${dias.length} operación(es)`},
        ].map((f,i)=>(
          <div key={i} style={{padding:"0.7rem 1rem",borderRight:i<5?"1px solid #BAE6FD":"none"}}>
            <div style={{fontSize:"0.58rem",fontWeight:800,color:"#7DD3FC",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"0.25rem"}}>{f.icon} {f.label}</div>
            <div style={{fontSize:"0.82rem",fontWeight:700,color:"#0C4A6E",lineHeight:1.3}}>{f.valor}</div>
          </div>
        ))}
      </div>

      {/* LEYENDA DE TIPOS */}
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
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"0.6rem",flexWrap:"wrap",gap:"0.5rem"}}>
          <div style={{fontSize:"0.68rem",fontWeight:800,color:BLUE,textTransform:"uppercase",letterSpacing:"0.08em"}}>
            📅 Producción diaria — {dias.length} registro(s) de la matriz
          </div>
        </div>

        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:"0.8rem",minWidth:700}}>
            <thead>
              <tr style={{background:BLUE}}>
                {["#","FECHA","TIPO","OPERACIÓN / SERVICIO","CANTIDAD","N°PER","TARIFA","FÓRMULA DETALLADA","SU VALOR","ACUMULADO"].map(h=>(
                  <th key={h} style={{padding:"0.55rem 0.6rem",textAlign:["CANTIDAD","TARIFA","SU VALOR","ACUMULADO","N°PER"].includes(h)?"right":"left",fontSize:"0.63rem",fontWeight:800,color:"#fff",whiteSpace:"nowrap",letterSpacing:"0.03em"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dias.length === 0 ? (
                <tr><td colSpan={10} style={{textAlign:"center",padding:"2rem",color:"#94a3b8"}}>Sin registros de producción</td></tr>
              ) : dias.map((dia, i) => {
                const tipo = tipoOp(dia);
                return (
                  <tr key={i} style={{borderBottom:"1px solid #e2e8f0",background:i%2===0?"#fff":"#F0F9FF"}}>
                    <td style={{padding:"0.55rem 0.6rem",color:"#94a3b8",fontSize:"0.72rem",width:24}}>{i+1}</td>
                    <td style={{padding:"0.55rem 0.6rem",color:"#374151",fontWeight:700,whiteSpace:"nowrap",fontSize:"0.8rem"}}>{fmtFecha(dia.fecha)}</td>
                    <td style={{padding:"0.55rem 0.6rem"}}>
                      <span style={{fontSize:"0.68rem",fontWeight:800,color:tipo.color,background:tipo.bg,border:`1px solid ${tipo.color}30`,borderRadius:20,padding:"2px 7px",whiteSpace:"nowrap"}}>
                        {tipo.emoji} {tipo.label}
                      </span>
                    </td>
                    <td style={{padding:"0.55rem 0.6rem",maxWidth:170}}>
                      <div style={{fontWeight:700,fontSize:"0.8rem",color:"#1e293b",lineHeight:1.3}}>{dia.servicio||"—"}</div>
                      {dia.clienteNombre && (
                        <div style={{fontSize:"0.6rem",color:"#94a3b8",marginTop:"1px"}}>{dia.clienteNombre}</div>
                      )}
                      {dia.cuadrillaNombre && !dia.modoCiamsa && !dia.modoHorasExtras && (
                        <div style={{fontSize:"0.6rem",color:BLUE,marginTop:"1px"}}>Cua. {dia.cuadrillaNombre}</div>
                      )}
                    </td>
                    <td style={{padding:"0.55rem 0.6rem",textAlign:"right"}}>{cantidadLabel(dia)}</td>
                    <td style={{padding:"0.55rem 0.6rem",textAlign:"right"}}>{personasLabel(dia)}</td>
                    <td style={{padding:"0.55rem 0.6rem",textAlign:"right"}}>{tarifaLabel(dia)}</td>
                    <td style={{padding:"0.55rem 0.6rem",maxWidth:190}}>
                      <span style={{fontSize:"0.63rem",color:BLUE,fontFamily:"monospace",background:"#e0f2fe",borderRadius:4,padding:"2px 6px",display:"inline-block",lineHeight:1.4,wordBreak:"break-all"}}>
                        {formulaTexto(dia)}
                      </span>
                    </td>
                    <td style={{padding:"0.55rem 0.6rem",textAlign:"right",fontWeight:800,color:S,fontFamily:"monospace",fontSize:"0.9rem",whiteSpace:"nowrap"}}>
                      {fmt(dia.netoPersona)}
                    </td>
                    <td style={{padding:"0.55rem 0.6rem",textAlign:"right",fontFamily:"monospace",fontSize:"0.78rem",fontWeight:600,color:BLUE,whiteSpace:"nowrap",background:i%2===0?"#EFF6FF":"#DBEAFE"}}>
                      {fmt(dia.acumulado)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{background:`linear-gradient(90deg,${BLUE},#0284c7)`,borderTop:`3px solid ${BLUE}`}}>
                <td colSpan={8} style={{padding:"0.75rem 0.9rem",fontWeight:800,color:"#fff",fontSize:"0.88rem"}}>
                  ✅ TOTAL PRODUCCIÓN — {dias.length} operación(es)
                </td>
                <td style={{padding:"0.75rem 0.9rem",textAlign:"right",fontWeight:900,color:"#fff",fontFamily:"monospace",fontSize:"1.05rem",whiteSpace:"nowrap"}}>
                  {fmt(totalProd)}
                </td>
                <td style={{padding:"0.75rem 0.9rem",textAlign:"right",fontWeight:900,color:"rgba(255,255,255,0.7)",fontFamily:"monospace",fontSize:"0.85rem"}}>⬆</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* RESUMEN FINANCIERO */}
      <div style={{margin:"0 1.25rem 1.25rem",borderRadius:12,border:"1.5px solid #BAE6FD",overflow:"hidden"}}>
        <div style={{background:"#F0F9FF",padding:"0.6rem 1rem",fontSize:"0.65rem",fontWeight:800,color:BLUE,textTransform:"uppercase",letterSpacing:"0.08em",borderBottom:"1px solid #BAE6FD"}}>
          💰 Resumen de Liquidación
        </div>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"0.88rem"}}>
          <tbody>
            <tr style={{background:"#F0FDF4",borderBottom:"1px solid #D1FAE5"}}>
              <td style={{padding:"0.65rem 1rem",color:"#065f46",fontWeight:700}}>
                ✅ Total producción ({dias.length} operación(es) en el período)
              </td>
              <td style={{padding:"0.65rem 1rem",textAlign:"right",fontWeight:900,color:S,fontFamily:"monospace",fontSize:"1rem"}}>
                {fmt(totalProd)}
              </td>
            </tr>
            {dedsOp.map((ded,i)=>(
              <tr key={i} style={{background:i%2===0?"#FFF9F9":"#fff",borderBottom:"1px solid #FEE2E2"}}>
                <td style={{padding:"0.55rem 1rem 0.55rem 1.75rem",color:DG}}>➖ {ded.concepto}</td>
                <td style={{padding:"0.55rem 1rem",textAlign:"right",fontWeight:700,color:DG,fontFamily:"monospace"}}>({fmt(ded.valor)})</td>
              </tr>
            ))}
            {adelanto>0&&(
              <tr style={{background:"#FFFBEB",borderBottom:"1px solid #FDE68A"}}>
                <td style={{padding:"0.55rem 1rem 0.55rem 1.75rem",color:W,fontWeight:600}}>➖ Adelanto / Préstamo descontado</td>
                <td style={{padding:"0.55rem 1rem",textAlign:"right",fontWeight:700,color:W,fontFamily:"monospace"}}>({fmt(adelanto)})</td>
              </tr>
            )}
            {totalDedOp>0&&(
              <tr style={{background:"#FFF1F2",borderBottom:"2px solid #FECDD3"}}>
                <td style={{padding:"0.55rem 1rem",color:DG,fontWeight:700,fontSize:"0.82rem"}}>Total descuentos</td>
                <td style={{padding:"0.55rem 1rem",textAlign:"right",fontWeight:800,color:DG,fontFamily:"monospace"}}>({fmt(totalDedOp)})</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* NETO A RECIBIR */}
      <div style={{margin:"0 1.25rem 1.25rem",background:"linear-gradient(135deg,#F0FDF4 0%,#DCFCE7 100%)",border:"2px solid #6EE7B7",borderRadius:14,padding:"1.25rem 1.5rem",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:"0.5rem"}}>
        <div>
          <div style={{fontWeight:900,color:"#065F46",fontSize:"1.2rem",textTransform:"uppercase",letterSpacing:"0.04em"}}>💵 TOTAL A RECIBIR POR PRODUCCIÓN</div>
          <div style={{color:"#059669",fontSize:"0.78rem",fontWeight:700,marginTop:"0.25rem"}}>Período: {d.quincenaDesde} al {d.quincenaHasta}</div>
          {totalDedOp>0&&<div style={{fontSize:"0.72rem",color:"#6B7280",marginTop:"0.2rem"}}>Producción {fmt(totalProd)} − Descuentos {fmt(totalDedOp)}</div>}
          {d.tieneDatosNomina&&<div style={{fontSize:"0.72rem",color:"#1d4ed8",marginTop:"0.2rem",fontWeight:700}}>ℹ️ Ver tab "Nómina" para el neto total con salario base y deducciones legales</div>}
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
