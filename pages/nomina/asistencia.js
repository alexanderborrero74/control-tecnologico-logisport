// pages/nomina/asistencia.js
// Gestión de cuadrillas + registro diario de novedades

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  collection, getDocs, doc, setDoc, deleteDoc, getDoc, addDoc,
  query, orderBy, writeBatch
} from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";
import { getUserRoleByUid } from "@/utils/getUserRole";
import LayoutWithSidebar from "@/components/LayoutWithSidebar";
import {
  ArrowLeft, Plus, Save, Trash2, X, Users, Edit2,
  CheckCircle, RefreshCw, ChevronLeft, ChevronRight,
  Calendar, Download, AlertCircle
} from "lucide-react";

const PRIMARY = "#0B3D91";
const DANGER  = "#ef4444";
const SUCCESS = "#10b981";
const COLORES = ["#3b82f6","#10b981","#f59e0b","#8b5cf6","#ef4444","#06b6d4"];
// Sin límite de cuadrillas

// ── Novedades (fallback si Firestore está vacío) ─────────────────────────────
const NOVEDADES_DEFAULT = [
  { codigo:"D", label:"Descanso",    emoji:"😴", color:"#64748b", bg:"#f1f5f9", orden:1 },
  { codigo:"I", label:"Inasistencia",emoji:"❌", color:"#dc2626", bg:"#fee2e2", orden:2 },
  // Fuente real: Firestore → nomina_novedades (administrar.js)
  // Usa "✨ Cargar valores predefinidos" en Administrar para poblar el catálogo completo
];

// ── Utilidades ────────────────────────────────────────────────────────────────
const diasEnMes  = (a,m) => new Date(a,m,0).getDate();
const diaSemana  = (a,m,d) => ["Do","Lu","Ma","Mi","Ju","Vi","Sa"][new Date(a,m-1,d).getDay()];
const diaLetra   = (a,m,d) => ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"][new Date(a,m-1,d).getDay()];
const esDomingo  = (a,m,d) => new Date(a,m-1,d).getDay() === 0;
const primerDia  = (a,m) => new Date(a,m-1,1).getDay(); // 0=Dom
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
               "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const mesLabel = (a,m) => `${MESES[m-1]} ${a}`;

// ID del documento en Firestore
const docId = (cId,a,m) => `${cId}_${a}_${String(m).padStart(2,"0")}`;

// ── Helpers de datos ──────────────────────────────────────────────────────────
// Retorna el map de novedades del día para una cuadrilla
// Estructura: { [trabajadorId]: "D" | "I" | "INC" | ... }  (ausentes de la cuadrilla ese día)
function diasVacios(totalDias) {
  // Retorna objeto { "1":{}, "2":{}, ... } — cada día = mapa de novedades
  const obj = {};
  for (let d=1; d<=totalDias; d++) obj[String(d)] = {};
  return obj;
}

function asistentesDelDia(miembros, novedadesDia) {
  // novedadesDia = { [workerId]: "D"|"I"|... }
  return miembros.filter(m => !novedadesDia?.[m.id]);
}

function ausentesDelDia(miembros, novedadesDia) {
  return miembros.filter(m => !!novedadesDia?.[m.id]);
}

// ════════════════════════════════════════════════════════════════════════════
export default function AsistenciaPage() {
  const router  = useRouter();
  const [rol,     setRol]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [vista,   setVista]   = useState("cuadrillas"); // "cuadrillas" | "diario" | "mensual"

  // ── Cuadrillas ────────────────────────────────────────────────────────────
  const [cuadrillas,   setCuadrillas]   = useState([]);
  const [expandidas,   setExpandidas]   = useState({});
  const [trabajadores, setTrabajadores] = useState([]);
  const [guardando,    setGuardando]    = useState(false);

  // ── Novedades dinámicas desde Firestore ──────────────────────────────
  const [novedades, setNovedades] = useState(NOVEDADES_DEFAULT);
  const [novMap,    setNovMap]    = useState(Object.fromEntries(NOVEDADES_DEFAULT.map(n=>[n.codigo,n])));

  const [modalNueva,  setModalNueva]  = useState(false);
  const [nombreNueva, setNombreNueva] = useState("");
  const [errNombre,   setErrNombre]   = useState("");

  const [cuadrillaEditar, setCuadrillaEditar] = useState(null);
  const [busquedaWorker,  setBusquedaWorker]  = useState("");
  const [guardandoEdit,   setGuardandoEdit]   = useState(false);

  // ── Registro diario / mensual ─────────────────────────────────────────────
  const hoy = new Date();
  const [anio,            setAnio]            = useState(hoy.getFullYear());
  const [mes,             setMes]             = useState(hoy.getMonth()+1);
  const [diaSelec,        setDiaSelec]        = useState(hoy.getDate());
  const [cuadrillaActiva, setCuadrillaActiva] = useState(null);

  // registro = { [dia]: { [workerId]: "D"|"I"|... } }
  const [registro,     setRegistro]     = useState({});
  const [modificado,   setModificado]   = useState(false);
  const [cargandoReg,  setCargandoReg]  = useState(false);
  const [guardandoReg, setGuardandoReg] = useState(false);

  // Popover novedad (en vista diaria)
  const [popover, setPopover] = useState(null); // { workerId, x, y, abrirArriba }
  const popRef = useRef(null);

  // ── Clientes ──────────────────────────────────────────────────────────────
  const [clientes, setClientes] = useState([
    { id:"spia",     nombre:"SPIA",      color:"#0B3D91", emoji:"🏭" },
    { id:"cliente1", nombre:"Cliente 1", color:"#10b981", emoji:"🏢" },
    { id:"cliente2", nombre:"Cliente 2", color:"#8b5cf6", emoji:"🏗️" },
    { id:"cliente3", nombre:"Cliente 3", color:"#f59e0b", emoji:"🏭" },
  ]);

  // ── Llamado a Lista ───────────────────────────────────────────────────────
  const hoyStr = new Date().toISOString().split("T")[0];
  const [llamadoFecha,         setLlamadoFecha]         = useState(hoyStr);
  const [llamadoClienteId,     setLlamadoClienteId]     = useState("spia");
  const [llamadoNovedades,     setLlamadoNovedades]     = useState({}); // { workerId: cod | null }
  const [llamadoGuardadoOk,    setLlamadoGuardadoOk]    = useState(false); // banner éxito
  const [cargandoLlamado,      setCargandoLlamado]      = useState(false); // cargando estado previo
  const [guardandoLlamado,     setGuardandoLlamado]     = useState(false);
  const [llamadoPopover,       setLlamadoPopover]       = useState(null);
  const llamadoPopRef = useRef(null);
  const [modalNuevaLlamadoNov, setModalNuevaLlamadoNov] = useState(false);
  const [formNuevaNov,         setFormNuevaNov]         = useState({ label:"", emoji:"", codigo:"" });
  const [errNuevaNov,          setErrNuevaNov]          = useState("");
  const [creandoNov,           setCreandoNov]           = useState(false);

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(()=>{
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async(user)=>{
      if(!user){router.push("/login");return;}
      const r = await getUserRoleByUid(user.uid);
      setRol(r);
      if(!["admin","admin_nomina","nomina"].includes(r)){router.push("/nomina");return;}
      await Promise.all([cargarTrabajadores(), cargarCuadrillas(), cargarNovedades(), cargarClientes()]);
      setLoading(false);
    });
    return ()=>unsub();
  },[]);

  useEffect(()=>{
    const h=(e)=>{
      if(popRef.current&&!popRef.current.contains(e.target))setPopover(null);
      if(llamadoPopRef.current&&!llamadoPopRef.current.contains(e.target))setLlamadoPopover(null);
    };
    document.addEventListener("mousedown",h);
    return ()=>document.removeEventListener("mousedown",h);
  },[]);

  // Ref para saber qué cuadrilla/mes/año está cargado actualmente
  // Evita recargar desde Firestore cuando solo cambia la vista (diario ↔ mensual)
  // lo que borraba los cambios no guardados del usuario
  const registroCargadoRef = useRef({ cuadrillaId: null, anio: null, mes: null });

  // Cargar estado del llamado a lista cuando cambia fecha, cliente o se entra a la vista
  useEffect(()=>{
    if(vista !== "llamado") return;
    const wDelCliente = trabajadores.filter(t=>(t.clienteIds||["spia"]).includes(llamadoClienteId));
    cargarEstadoLlamado(llamadoFecha, llamadoClienteId, wDelCliente, cuadrillas);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[vista, llamadoFecha, llamadoClienteId]);

  // Recargar registro SOLO cuando cambia cuadrilla, mes o año — nunca por cambio de vista
  useEffect(()=>{
    if(!cuadrillaActiva) return;
    if(vista !== "diario" && vista !== "mensual") return;
    const ultimo = registroCargadoRef.current;
    const mismoDato = ultimo.cuadrillaId === cuadrillaActiva.id
                   && ultimo.anio        === anio
                   && ultimo.mes         === mes;
    if(mismoDato) return; // misma cuadrilla/mes/año → no recargar (preserva cambios no guardados)
    registroCargadoRef.current = { cuadrillaId: cuadrillaActiva.id, anio, mes };
    cargarRegistro(cuadrillaActiva, anio, mes);
  },[cuadrillaActiva, anio, mes, vista]);

  // ── Datos base ────────────────────────────────────────────────────────────
  // Novedades: fuente única = Firestore (administrar.js)
  // ⚠️ NO usar orderBy en Firestore: excluye docs sin campo "orden".
  //    Se ordena en cliente para incluir todas las novedades del catálogo.
  const cargarClientes = async () => {
    const BASE = [
      { id:"spia",     nombre:"SPIA",      color:"#0B3D91", emoji:"🏭" },
      { id:"cliente1", nombre:"Cliente 1", color:"#10b981", emoji:"🏢" },
      { id:"cliente2", nombre:"Cliente 2", color:"#8b5cf6", emoji:"🏗️" },
      { id:"cliente3", nombre:"Cliente 3", color:"#f59e0b", emoji:"🏭" },
    ];
    try {
      const snap = await getDocs(collection(db,"nomina_clientes"));
      if(snap.empty){setClientes(BASE);return;}
      setClientes(BASE.map(b=>{
        const d=snap.docs.find(x=>x.id===b.id);
        return d?{...b,nombre:d.data().nombre||b.nombre}:b;
      }));
    }catch{setClientes(BASE);}
  };

  const cargarNovedades = async () => {
    try {
      const snap = await getDocs(collection(db, "nomina_novedades"));
      const lista = snap.empty
        ? NOVEDADES_DEFAULT   // fallback mínimo si Firestore aún no está poblado
        : snap.docs.map(d => ({ id: d.id, ...d.data() }));
      lista.sort((a,b) => (a.orden||99) - (b.orden||99));
      setNovedades(lista);
      setNovMap(Object.fromEntries(lista.map(n => [n.codigo, n])));
    } catch(e) {
      console.error("Error cargando novedades:", e);
      setNovedades(NOVEDADES_DEFAULT);
      setNovMap(Object.fromEntries(NOVEDADES_DEFAULT.map(n => [n.codigo, n])));
    }
  };

  const cargarTrabajadores = async()=>{
    const snap = await getDocs(query(collection(db,"nomina_trabajadores"),orderBy("nombre")));
    // Solo trabajadores ACTIVOS en el selector de cuadrillas
    setTrabajadores(snap.docs.map(d=>({id:d.id,...d.data()})).filter(t => t.activo !== false));
  };

  const cargarCuadrillas = async()=>{
    const snap = await getDocs(collection(db,"nomina_asistencia"));
    const lista = snap.docs.map(d=>({id:d.id,...d.data()}));
    lista.sort((a,b)=>(a.orden||99)-(b.orden||99));
    setCuadrillas(lista);
    const exp={};
    lista.forEach(c=>{exp[c.id]=true;});
    setExpandidas(exp);
    setCuadrillaActiva(prev=>prev||lista[0]||null);
  };

  // ── CRUD cuadrillas ───────────────────────────────────────────────────────
  const crearCuadrilla = async()=>{
    const nombre=nombreNueva.trim().toUpperCase();
    if(!nombre){setErrNombre("Ingresa un nombre.");return;}
    if(cuadrillas.find(c=>c.nombre===nombre)){setErrNombre("Ya existe esa cuadrilla.");return;}

    setGuardando(true);
    const id=`cuadrilla_${nombre.toLowerCase().replace(/\s+/g,"_")}`;
    await setDoc(doc(db,"nomina_asistencia",id),{
      nombre, miembros:[], totalPersonas:0,
      orden:cuadrillas.length+1,
      creadoEn:new Date(), actualizadoEn:new Date(),
    });
    setNombreNueva(""); setErrNombre(""); setModalNueva(false);
    await cargarCuadrillas();
    setGuardando(false);
  };

  const eliminarCuadrilla = async(c)=>{
    if(!confirm(`¿Eliminar la cuadrilla "${c.nombre}"?\n\nTambién se eliminarán todos los registros de asistencia y novedades de esta cuadrilla.`))return;
    try{
      // 1. Eliminar el documento de la cuadrilla
      await deleteDoc(doc(db,"nomina_asistencia",c.id));
      // 2. Eliminar TODOS los registros de asistencia de esta cuadrilla
      //    Filtramos por prefijo del ID ("cuadrilla_X_YYYY_MM") para no depender
      //    de índices Firestore con where(), que pueden no existir y fallar en silencio.
      const todosSnap = await getDocs(collection(db,"nomina_asistencia_registro"));
      const prefijo   = c.id + "_";
      const aEliminar = todosSnap.docs.filter(d => d.id.startsWith(prefijo));
      if(aEliminar.length > 0){
        const batch = writeBatch(db);
        aEliminar.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
    }catch(e){
      alert("Error al eliminar: "+e.message);
    }
    await cargarCuadrillas();
  };

  const abrirEditar=(c)=>{
    setCuadrillaEditar({...c,miembros:[...(c.miembros||[])]});
    setBusquedaWorker("");
  };

  const toggleMiembro=(t)=>{
    setCuadrillaEditar(prev=>{
      const existe=prev.miembros.find(m=>m.id===t.id);
      if(existe) return{...prev,miembros:prev.miembros.filter(m=>m.id!==t.id)};
      return{...prev,miembros:[...prev.miembros,{id:t.id,nombre:t.nombre,cedula:t.cedula}]};
    });
  };

  const guardarMiembros=async()=>{
    setGuardandoEdit(true);
    await setDoc(doc(db,"nomina_asistencia",cuadrillaEditar.id),{
      nombre:cuadrillaEditar.nombre,
      miembros:cuadrillaEditar.miembros,
      totalPersonas:cuadrillaEditar.miembros.length,
      orden:cuadrillaEditar.orden||1,
      actualizadoEn:new Date(),
      creadoEn:cuadrillaEditar.creadoEn||new Date(),
    });
    await cargarCuadrillas();
    setCuadrillaEditar(null);
    setGuardandoEdit(false);
  };

  // ── Registro mensual ──────────────────────────────────────────────────────
  const cargarRegistro = async(cuadrilla,a,m)=>{
    setCargandoReg(true);
    const id=docId(cuadrilla.id,a,m);
    try{
      const snap=await getDoc(doc(db,"nomina_asistencia_registro",id));
      if(snap.exists()){
        setRegistro(snap.data().registro||{});
      } else {
        setRegistro({});
      }
    }catch{setRegistro({});}
    setModificado(false);
    setCargandoReg(false);
  };

  const setNovedad=(workerId,codigo)=>{
    const dia=String(diaSelec);
    setRegistro(prev=>{
      const diaData={...(prev[dia]||{})};
      if(codigo===null){
        delete diaData[workerId]; // quitar novedad → asistió
      } else {
        diaData[workerId]=codigo;
      }
      return{...prev,[dia]:diaData};
    });
    setModificado(true);
    setPopover(null);
  };

  const guardarRegistro=async()=>{
    if(!cuadrillaActiva)return;
    setGuardandoReg(true);
    try{
      const id=docId(cuadrillaActiva.id,anio,mes);
      await setDoc(doc(db,"nomina_asistencia_registro",id),{
        cuadrillaId:cuadrillaActiva.id,
        cuadrillaNombre:cuadrillaActiva.nombre,
        anio, mes,
        registro,
        actualizadoEn:new Date(),
      });
      setModificado(false);
    }catch(e){
      console.error("Error guardando registro:",e);
      alert("Error al guardar. Revisa la conexión e intenta de nuevo.");
    }finally{
      setGuardandoReg(false);
    }
  };

  // ── Guardar Llamado a Lista → nomina_asistencia_registro ────────────────
  const guardarLlamadoLista = async () => {
    const novCount = Object.values(llamadoNovedades).filter(v => v !== null && v !== undefined && v !== "").length;
    if(!confirm(`¿Guardar llamado a lista del ${llamadoFecha}?\n${novCount} novedad(es) marcada(s). Los trabajadores sin marcar quedan sin cambios.`))return;
    setGuardandoLlamado(true);
    try{
      const [yStr,mStr,dStr] = llamadoFecha.split("-");
      const year  = parseInt(yStr);
      const month = parseInt(mStr);
      const dia   = String(parseInt(dStr));

      // Mapa workerId → [cuadrillaId]
      const workerCuadMap = {};
      cuadrillas.forEach(c=>{
        (c.miembros||[]).forEach(m=>{
          if(!workerCuadMap[m.id])workerCuadMap[m.id]=[];
          workerCuadMap[m.id].push(c.id);
        });
      });

      // Trabajadores del cliente seleccionado en el llamado
      const wDelLlamado = trabajadores.filter(t=>(t.clienteIds||["spia"]).includes(llamadoClienteId));
      const wIds = new Set(wDelLlamado.map(t=>t.id));

      // Cuadrillas afectadas
      const cuadIdsNeeded = new Set();
      wDelLlamado.forEach(t=>{
        (workerCuadMap[t.id]||[]).forEach(cId=>cuadIdsNeeded.add(cId));
      });

      if(cuadIdsNeeded.size===0){
        alert("⚠️ Los trabajadores seleccionados no pertenecen a ninguna cuadrilla.\nAgrega los trabajadores a una cuadrilla primero.");
        setGuardandoLlamado(false); return;
      }

      for(const cId of cuadIdsNeeded){
        const regId = docId(cId,year,month);
        const snap  = await getDoc(doc(db,"nomina_asistencia_registro",regId));
        const regExiste = snap.exists()?(snap.data().registro||{}):{};
        const diaData   = {...(regExiste[dia]||{})};

        const cuadrilla = cuadrillas.find(c=>c.id===cId);
        (cuadrilla?.miembros||[]).forEach(m=>{
          if(!wIds.has(m.id))return; // no es del cliente seleccionado
          const cod = llamadoNovedades[m.id];
          if(cod===null){
            delete diaData[m.id]; // asistió → quitar novedad
          }else if(cod){
            diaData[m.id]=cod;    // novedad marcada
          }
          // undefined → sin marcar → no tocar
        });

        await setDoc(doc(db,"nomina_asistencia_registro",regId),{
          cuadrillaId:cId,
          cuadrillaNombre:cuadrilla?.nombre||cId,
          anio:year, mes:month,
          registro:{...regExiste,[dia]:diaData},
          actualizadoEn:new Date(),
        });
      }

      // Forzar recarga del registro diario/mensual al volver a esa vista
      registroCargadoRef.current = { cuadrillaId: null, anio: null, mes: null };
      // Recargar el estado visual desde Firestore para mostrar lo guardado
      const wDelClienteParaRecargar = trabajadores.filter(t=>(t.clienteIds||["spia"]).includes(llamadoClienteId));
      await cargarEstadoLlamado(llamadoFecha, llamadoClienteId, wDelClienteParaRecargar, cuadrillas);
      setLlamadoGuardadoOk(true);
      setTimeout(()=>setLlamadoGuardadoOk(false), 5000);
    }catch(e){alert("Error al guardar: "+e.message);}
    setGuardandoLlamado(false);
  };

  // ── Cargar estado actual del llamado (desde Firestore) ─────────────────
  const cargarEstadoLlamado = useCallback(async (fecha, clienteId, workersDelCliente, cuadrillasList) => {
    if(!fecha || !clienteId || !workersDelCliente?.length) return;
    setCargandoLlamado(true);
    setLlamadoNovedades({});
    try {
      const [yStr,mStr,dStr] = fecha.split("-");
      const year  = parseInt(yStr);
      const month = parseInt(mStr);
      const dia   = String(parseInt(dStr));

      // Mapa workerId → [cuadrillaId]
      const workerCuadMap = {};
      (cuadrillasList||[]).forEach(c=>{
        (c.miembros||[]).forEach(m=>{
          if(!workerCuadMap[m.id])workerCuadMap[m.id]=[];
          workerCuadMap[m.id].push(c.id);
        });
      });

      // Cuadrillas afectadas por estos workers
      const cuadIdsNeeded = new Set();
      workersDelCliente.forEach(t=>{
        (workerCuadMap[t.id]||[]).forEach(cId=>cuadIdsNeeded.add(cId));
      });
      // Agregar doc especial llamado_${clienteId}
      cuadIdsNeeded.add(`llamado_${clienteId}`);

      const estadoCargado = {};
      for(const cId of cuadIdsNeeded){
        const regId = cId.startsWith("llamado_")
          ? `${cId}_${year}_${String(month).padStart(2,"0")}`
          : docId(cId, year, month);
        try {
          const snap = await getDoc(doc(db,"nomina_asistencia_registro",regId));
          if(!snap.exists()) continue;
          const diaData = (snap.data().registro||{})[dia]||{};
          workersDelCliente.forEach(t=>{
            if(t.id in diaData){
              estadoCargado[t.id] = diaData[t.id]; // código novedad
            }
          });
        } catch{}
      }
      // Trabajadores no encontrados en ningún registro = asistió (null) si el doc existe
      // Solo marcamos los que tienen novedad explícita; los demás quedan undefined (sin tocar)
      setLlamadoNovedades(estadoCargado);
    } catch(e){ console.error("Error cargando estado llamado:",e); }
    setCargandoLlamado(false);
  }, []);

  // ── Crear nueva novedad desde el llamado a lista ─────────────────────────
  const crearNovedadDesdeCallada = async () => {
    const label  = formNuevaNov.label.trim();
    if(!label){setErrNuevaNov("El nombre es requerido.");return;}
    const codigo = (formNuevaNov.codigo.trim()||label).toUpperCase().replace(/[^A-Z0-9-]/g,"").substring(0,8);
    if(novedades.find(n=>n.codigo===codigo)){setErrNuevaNov(`El código "${codigo}" ya existe.`);return;}
    setCreandoNov(true);
    try{
      await addDoc(collection(db,"nomina_novedades"),{
        codigo,
        label,
        emoji: formNuevaNov.emoji.trim()||"📋",
        color:"#6366f1", bg:"#eef2ff",
        orden: novedades.length+1,
        paga:"SÍ", porcentaje:"0%", info:"",
        creadoEn:new Date(),
      });
      await cargarNovedades();
      setModalNuevaLlamadoNov(false);
      setFormNuevaNov({label:"",emoji:"",codigo:""});
      setErrNuevaNov("");
    }catch(e){setErrNuevaNov("Error: "+e.message);}
    setCreandoNov(false);
  };

  const exportarCSV=()=>{
    const td=diasEnMes(anio,mes);
    const miembros=cuadrillaActiva?.miembros||[];
    let csv=`REPORTE ASISTENCIA,Cuadrilla ${cuadrillaActiva?.nombre},${mesLabel(anio,mes)}\n\n`;
    csv+=`Nº,Nombre,Cédula,`;
    for(let d=1;d<=td;d++) csv+=`${d},`;
    csv+=`NOVEDADES\n`;
    miembros.forEach((m,i)=>{
      let novTotal=0;
      let dias="";
      for(let d=1;d<=td;d++){
        const nov=registro[String(d)]?.[m.id];
        if(nov){novTotal++;dias+=`${nov},`;}
        else dias+=`A,`;
      }
      csv+=`${i+1},"${m.nombre}","${m.cedula}",${dias}${novTotal}\n`;
    });
    csv+=`\nLEYENDA: A=Asistió (suma en pago), D=Descanso, I=Inasistencia, INC=Incapacidad, S=Suspensión, B=Bloqueado muelle, PNR=Permiso no rem., CAL=Calamidad, ADV=Adventista, L=Luto\n`;
    const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob);
    a.download=`asistencia_c${cuadrillaActiva?.nombre}_${anio}_${String(mes).padStart(2,"0")}.csv`;
    a.click();
  };

  // ── Computed ──────────────────────────────────────────────────────────────
  const trabajadoresFiltrados = busquedaWorker.trim()
    ? trabajadores.filter(t=>t.nombre?.toLowerCase().includes(busquedaWorker.toLowerCase())||t.cedula?.includes(busquedaWorker))
    : trabajadores;

  const totalDias = diasEnMes(anio,mes);
  const diasArr   = Array.from({length:totalDias},(_,i)=>i+1);
  const miembros  = cuadrillaActiva?.miembros||[];
  const novedadesHoy = registro[String(diaSelec)]||{};
  const asistentesHoy = asistentesDelDia(miembros,novedadesHoy);
  const ausentesHoy   = ausentesDelDia(miembros,novedadesHoy);

  // ════════════════════════════════════════════════════════════════════════
  if(loading) return(
    <LayoutWithSidebar>
      <div style={{textAlign:"center",padding:"5rem",color:PRIMARY}}>
        <RefreshCw size={32} style={{animation:"spin 1s linear infinite"}}/>
        <div style={{marginTop:"1rem",fontWeight:"600"}}>Cargando...</div>
      </div>
    </LayoutWithSidebar>
  );

  return(
    <LayoutWithSidebar>
      <div style={{maxWidth:"100%",paddingBottom:"4rem"}}>

        {/* ── HEADER ── */}
        <div style={{display:"flex",alignItems:"center",gap:"0.75rem",marginBottom:"1.5rem",flexWrap:"wrap"}}>
          <button onClick={()=>router.push("/nomina")}
            style={{background:"none",border:"none",cursor:"pointer",color:PRIMARY,display:"flex"}}>
            <ArrowLeft size={22}/>
          </button>
          <div style={{flex:1}}>
            <h1 style={{margin:0,color:PRIMARY,fontSize:"1.5rem",fontWeight:"800"}}>📋 Asistencia y Cuadrillas</h1>
            <p style={{margin:0,color:"#64748b",fontSize:"0.82rem"}}>
              {cuadrillas.length} cuadrilla(s) · {cuadrillas.reduce((s,c)=>s+(c.totalPersonas||0),0)} trabajadores
            </p>
          </div>
          {/* Tabs */}
          <div style={{display:"flex",background:"#f1f5f9",borderRadius:"12px",padding:"4px",gap:"3px"}}>
            {[
              {key:"cuadrillas",icon:<Users size={14}/>,  label:"Cuadrillas"},
              {key:"diario",    icon:<Calendar size={14}/>,label:"Registro diario"},
              {key:"mensual",   icon:<span style={{fontSize:"0.9rem"}}>📊</span>,label:"Vista mensual"},
            ].map(v=>(
              <button key={v.key} onClick={()=>setVista(v.key)}
                style={{padding:"0.48rem 0.9rem",borderRadius:"9px",border:"none",cursor:"pointer",
                  fontWeight:"700",fontSize:"0.8rem",display:"flex",alignItems:"center",gap:"0.35rem",
                  transition:"all 0.15s",
                  background:vista===v.key?"#fff":"transparent",
                  color:vista===v.key?PRIMARY:"#94a3b8",
                  boxShadow:vista===v.key?"0 2px 8px rgba(0,0,0,0.1)":"none"}}>
                {v.icon}{v.label}
              </button>
            ))}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════
            VISTA 1: CUADRILLAS — crear / editar / ver miembros
        ══════════════════════════════════════════════════════════ */}
        {vista==="cuadrillas" && (
          <>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",
              marginBottom:"1.25rem",gap:"0.75rem",flexWrap:"wrap"}}>
              <p style={{margin:0,color:"#64748b",fontSize:"0.85rem",maxWidth:"560px"}}>
                Crea las cuadrillas con sus miembros permanentes. Luego en <strong>Registro diario</strong> indica día a día quién tuvo novedad.
              </p>
              <div style={{display:"flex",gap:"0.6rem",flexWrap:"wrap"}}>
                <button
                  onClick={()=>setVista("llamado")}
                  style={{...sty.btnPrimary,background:"#f59e0b",boxShadow:"0 4px 12px rgba(245,158,11,0.3)"}}>
                  📣 Llamado a lista
                </button>
                <button onClick={()=>{setModalNueva(true);setNombreNueva("");setErrNombre("");}}
                  style={sty.btnPrimary}>
                  <Plus size={15}/> Nueva cuadrilla
                </button>
              </div>
            </div>

            {cuadrillas.length===0 ? (
              <EmptyState icon="👥" title="No hay cuadrillas" desc="Crea la primera con el botón de arriba."/>
            ) : cuadrillas.map((c,idx)=>{
              const color=COLORES[idx%COLORES.length];
              const abierta=expandidas[c.id]!==false;
              return(
                <div key={c.id} style={{background:"#fff",borderRadius:"14px",
                  boxShadow:"0 2px 10px rgba(0,0,0,0.06)",marginBottom:"0.85rem",
                  overflow:"hidden",borderLeft:`5px solid ${color}`}}>

                  <div style={{display:"flex",alignItems:"center",gap:"0.85rem",
                    padding:"1rem 1.1rem",cursor:"pointer"}}
                    onClick={()=>setExpandidas(p=>({...p,[c.id]:!abierta}))}>
                    <div style={{width:"42px",height:"42px",borderRadius:"10px",
                      background:`${color}15`,display:"flex",alignItems:"center",
                      justifyContent:"center",flexShrink:0}}>
                      <Users size={20} color={color}/>
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:"800",color:PRIMARY,fontSize:"1rem"}}>
                        Cuadrilla {c.nombre}
                      </div>
                      <div style={{color:"#64748b",fontSize:"0.8rem"}}>
                        <span style={{fontWeight:"700",color}}>{c.totalPersonas||0}</span> miembro(s)
                      </div>
                    </div>
                    <div style={{display:"flex",gap:"0.4rem",alignItems:"center"}}>
                      <button onClick={e=>{e.stopPropagation();abrirEditar(c);}}
                        style={{...sty.btnSec,color,background:`${color}12`}}>
                        <Edit2 size={12}/> Editar miembros
                      </button>
                      <button onClick={e=>{e.stopPropagation();setCuadrillaActiva(c);setVista("diario");}}
                        style={{...sty.btnSec,color:PRIMARY,background:`${PRIMARY}10`}}>
                        <Calendar size={12}/> Ver asistencia
                      </button>
                      <button onClick={e=>{e.stopPropagation();eliminarCuadrilla(c);}}
                        style={{background:"#fff1f2",border:"none",borderRadius:"8px",
                          padding:"0.4rem 0.5rem",cursor:"pointer",color:DANGER,display:"flex"}}>
                        <Trash2 size={13}/>
                      </button>
                      <span style={{color:"#cbd5e1"}}>{abierta?"▲":"▼"}</span>
                    </div>
                  </div>

                  {abierta&&(
                    <div style={{borderTop:`1px solid ${color}20`}}>
                      {(!c.miembros||c.miembros.length===0) ? (
                        <div style={{padding:"1.5rem",textAlign:"center",color:"#94a3b8",fontSize:"0.85rem"}}>
                          Sin miembros. Haz clic en <strong>Editar miembros</strong>.
                        </div>
                      ) : (
                        <table style={{width:"100%",borderCollapse:"collapse"}}>
                          <thead>
                            <tr style={{background:"#f8fafc"}}>
                              {["#","Nombre","Cédula"].map(h=>(
                                <th key={h} style={{padding:"0.55rem 1rem",textAlign:"left",
                                  fontSize:"0.72rem",fontWeight:"700",color:"#94a3b8"}}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {c.miembros.map((m,i)=>(
                              <tr key={m.id} style={{borderBottom:"1px solid #f8fafc"}}
                                onMouseEnter={e=>e.currentTarget.style.background="#f8fafc"}
                                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                                <td style={{padding:"0.55rem 1rem",color:"#cbd5e1",fontSize:"0.75rem",width:"35px"}}>{i+1}</td>
                                <td style={{padding:"0.55rem 1rem",fontWeight:"600",color:"#1e293b",fontSize:"0.87rem"}}>{m.nombre}</td>
                                <td style={{padding:"0.55rem 1rem",fontFamily:"monospace",color:"#64748b",fontSize:"0.8rem"}}>{m.cedula}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* ══════════════════════════════════════════════════════════
            VISTA LLAMADO A LISTA
        ══════════════════════════════════════════════════════════ */}
        {vista==="llamado" && (()=>{
          const clienteActivo = clientes.find(c=>c.id===llamadoClienteId)||clientes[0];
          const workersDelCliente = trabajadores
            .filter(t=>(t.clienteIds||["spia"]).includes(llamadoClienteId))
            .sort((a,b)=>{
              const ca=(a.cargo||"").toLowerCase();
              const cb=(b.cargo||"").toLowerCase();
              if(ca!==cb)return ca.localeCompare(cb);
              return (a.nombre||"").localeCompare(b.nombre||"");
            });
          const gruposPorCargo={};
          workersDelCliente.forEach(t=>{
            const c=t.cargo||("(Sin cargo)");
            if(!gruposPorCargo[c])gruposPorCargo[c]=[];
            gruposPorCargo[c].push(t);
          });
          const cargosOrdenados=Object.keys(gruposPorCargo).sort((a,b)=>a.localeCompare(b));
          const totalConNovedad = Object.values(llamadoNovedades).filter(v=>v!==null&&v!==undefined&&v!=="").length;
          const totalAsistio    = Object.values(llamadoNovedades).filter(v=>v===null).length;
          const totalSinMarcar  = workersDelCliente.length - totalConNovedad - totalAsistio;
          return (
          <>
            {/* Header llamado */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
              marginBottom:"1.25rem",flexWrap:"wrap",gap:"0.75rem"}}>
              <div>
                <h2 style={{margin:0,color:PRIMARY,fontSize:"1.2rem",fontWeight:"800"}}>📣 Llamado a Lista</h2>
                <p style={{margin:0,color:"#64748b",fontSize:"0.83rem"}}>
                  Marca novedad por trabajador para el día seleccionado. Se guarda en Asistencia automáticamente.
                </p>
              </div>
              <div style={{display:"flex",gap:"0.5rem",flexWrap:"wrap"}}>
                <button
                  onClick={()=>setModalNuevaLlamadoNov(true)}
                  style={{...sty.btnSec,color:"#7c3aed",background:"#ede9fe",border:"1.5px solid #c4b5fd",padding:"0.55rem 0.9rem"}}>
                  <Plus size={13}/> Nueva novedad
                </button>
                <button
                  onClick={guardarLlamadoLista}
                  disabled={guardandoLlamado||totalConNovedad+totalAsistio===0}
                  style={{...sty.btnPrimary,background:totalConNovedad+totalAsistio>0?"#059669":"#e2e8f0",
                    color:totalConNovedad+totalAsistio>0?"#fff":"#94a3b8",
                    cursor:totalConNovedad+totalAsistio>0?"pointer":"not-allowed"}}>
                  {guardandoLlamado?<RefreshCw size={15} style={{animation:"spin 1s linear infinite"}}/>:<Save size={15}/>}
                  {guardandoLlamado?"Guardando...":"Guardar llamado"}
                </button>
                <button onClick={()=>{setVista("cuadrillas");setLlamadoNovedades({});}} style={{...sty.btnSec,color:"#64748b"}}>
                  <X size={14}/> Cerrar
                </button>
              </div>
            </div>

            {/* Barra: fecha + cliente + contadores */}
            <div style={{display:"flex",gap:"1rem",marginBottom:"1.25rem",flexWrap:"wrap",alignItems:"flex-end"}}>
              {/* Fecha */}
              <div>
                <div style={{fontSize:"0.72rem",color:"#94a3b8",fontWeight:"700",marginBottom:"0.3rem"}}>📅 FECHA</div>
                <input type="date" value={llamadoFecha}
                  onChange={e=>{setLlamadoFecha(e.target.value);setLlamadoNovedades({});}}
                  style={{border:`1.5px solid ${PRIMARY}40`,borderRadius:"10px",padding:"0.5rem 0.8rem",
                    fontSize:"0.92rem",color:PRIMARY,fontWeight:"700",outline:"none",background:"#eff6ff",cursor:"pointer"}}/>
              </div>
              {/* Selector de cliente */}
              <div style={{flex:1}}>
                <div style={{fontSize:"0.72rem",color:"#94a3b8",fontWeight:"700",marginBottom:"0.3rem"}}>🏢 CLIENTE</div>
                <div style={{display:"flex",gap:"0.4rem",flexWrap:"wrap"}}>
                  {clientes.map(c=>(
                    <button key={c.id}
                      onClick={()=>{setLlamadoClienteId(c.id);setLlamadoNovedades({});}}
                      style={{padding:"0.45rem 1rem",borderRadius:"20px",fontWeight:"700",fontSize:"0.83rem",
                        cursor:"pointer",border:`2px solid ${llamadoClienteId===c.id?c.color:"#e2e8f0"}`,
                        background:llamadoClienteId===c.id?`${c.color}15`:"#f8fafc",
                        color:llamadoClienteId===c.id?c.color:"#64748b",
                        boxShadow:llamadoClienteId===c.id?`0 3px 10px ${c.color}30`:"none"}}>
                      {c.emoji} {c.nombre} ({trabajadores.filter(t=>(t.clienteIds||["spia"]).includes(c.id)).length})
                    </button>
                  ))}
                </div>
              </div>
              {/* Contadores */}
              <div style={{display:"flex",gap:"0.6rem"}}>
                <div style={{background:"#d1fae5",borderRadius:"10px",padding:"0.5rem 0.9rem",textAlign:"center"}}>
                  <div style={{fontWeight:"900",color:"#059669",fontSize:"1.1rem"}}>{totalAsistio}</div>
                  <div style={{fontSize:"0.65rem",color:"#059669",fontWeight:"700"}}>Asistió ✅</div>
                </div>
                <div style={{background:"#fee2e2",borderRadius:"10px",padding:"0.5rem 0.9rem",textAlign:"center"}}>
                  <div style={{fontWeight:"900",color:"#dc2626",fontSize:"1.1rem"}}>{totalConNovedad}</div>
                  <div style={{fontSize:"0.65rem",color:"#dc2626",fontWeight:"700"}}>Con novedad ❌</div>
                </div>
                <div style={{background:"#f8fafc",borderRadius:"10px",padding:"0.5rem 0.9rem",textAlign:"center"}}>
                  <div style={{fontWeight:"900",color:"#94a3b8",fontSize:"1.1rem"}}>{totalSinMarcar}</div>
                  <div style={{fontSize:"0.65rem",color:"#94a3b8",fontWeight:"700"}}>Sin marcar</div>
                </div>
              </div>
            </div>

            {/* Banner guardado exitosamente */}
            {llamadoGuardadoOk&&(
              <div style={{background:"#d1fae5",border:"1.5px solid #6ee7b7",borderRadius:"12px",
                padding:"0.7rem 1.1rem",marginBottom:"1rem",
                display:"flex",alignItems:"center",gap:"0.6rem",
                boxShadow:"0 2px 8px rgba(16,185,129,0.15)"}}>
                <span style={{fontSize:"1.2rem"}}>✅</span>
                <span style={{fontWeight:"700",color:"#065f46",fontSize:"0.88rem"}}>
                  Llamado guardado en Firestore. Las novedades marcadas se ven en Registro Diario.
                </span>
              </div>
            )}
            {cargandoLlamado&&(
              <div style={{textAlign:"center",padding:"1.5rem",color:"#64748b",fontSize:"0.85rem"}}>
                <RefreshCw size={18} style={{animation:"spin 1s linear infinite",marginRight:"0.4rem"}}/>
                Cargando estado del día...
              </div>
            )}

            {workersDelCliente.length===0?(
              <EmptyState icon="👷" title="Sin trabajadores" desc={`No hay trabajadores activos para ${clienteActivo.nombre}.`}/>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:"1.25rem"}}>
                {cargosOrdenados.map(cargo=>{
                  const workers = gruposPorCargo[cargo];
                  return(
                    <div key={cargo} style={{background:"#fff",borderRadius:"14px",overflow:"hidden",
                      boxShadow:"0 2px 10px rgba(0,0,0,0.06)",
                      border:`2px solid ${clienteActivo.color}20`}}>
                      {/* Encabezado cargo */}
                      <div style={{padding:"0.65rem 1rem",background:`${clienteActivo.color}10`,
                        borderBottom:`1px solid ${clienteActivo.color}25`,
                        display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                        <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
                          <span style={{background:clienteActivo.color,color:"#fff",
                            borderRadius:"6px",padding:"2px 10px",fontSize:"0.75rem",fontWeight:"800"}}>
                            👷 {cargo}
                          </span>
                          <span style={{fontSize:"0.73rem",color:"#64748b"}}>{workers.length} trabajador(es)</span>
                        </div>
                        <button
                          onClick={()=>{
                            const allAsistio = workers.every(w=>llamadoNovedades[w.id]===null);
                            setLlamadoNovedades(prev=>{
                              const next={...prev};
                              workers.forEach(w=>{
                                if(allAsistio)delete next[w.id];
                                else next[w.id]=null;
                              });
                              return next;
                            });
                          }}
                          style={{...sty.btnSec,color:"#059669",background:"#d1fae5",fontSize:"0.73rem",padding:"0.3rem 0.7rem"}}>
                          ✅ Todos asistieron
                        </button>
                      </div>
                      {/* Trabajadores del cargo */}
                      <div style={{padding:"0.5rem"}}>
                        {workers.map((w,idx)=>{
                          const cod     = llamadoNovedades[w.id];
                          const novInfo = (cod && cod !== null) ? novMap[cod] : null;
                          const asistio = cod === null;
                          const sinMark = cod === undefined;
                          return(
                            <div key={w.id}
                              style={{display:"flex",alignItems:"center",gap:"0.75rem",
                                padding:"0.6rem 0.75rem",borderRadius:"10px",
                                background:asistio?"#f0fdf4":novInfo?`${novInfo.color}08`:sinMark?"#fafafa":"transparent",
                                border:`1.5px solid ${asistio?"#86efac":novInfo?novInfo.color+"30":"transparent"}`,
                                marginBottom:idx<workers.length-1?"0.35rem":0,
                                transition:"all 0.12s"}}>

                              {/* Número */}
                              <span style={{color:"#cbd5e1",fontSize:"0.72rem",fontWeight:"700",width:"20px",flexShrink:0}}>
                                {idx+1}
                              </span>

                              {/* Estado icono */}
                              <div style={{width:"36px",height:"36px",borderRadius:"9px",flexShrink:0,
                                background:asistio?"#d1fae5":novInfo?.bg||"#f1f5f9",
                                display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.1rem"}}>
                                {asistio?"✅":novInfo?novInfo.emoji:"⬜"}
                              </div>

                              {/* Info trabajador */}
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontWeight:"700",color:"#1e293b",fontSize:"0.9rem",
                                  overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                                  {w.nombre}
                                </div>
                                <div style={{fontSize:"0.71rem",fontFamily:"monospace",color:"#94a3b8"}}>
                                  {w.cedula}
                                </div>
                                {novInfo&&(
                                  <div style={{fontSize:"0.72rem",color:novInfo.color,fontWeight:"700",marginTop:"1px"}}>
                                    {novInfo.emoji} {novInfo.label}
                                  </div>
                                )}
                              </div>

                              {/* Botones de acción */}
                              <div style={{display:"flex",gap:"0.35rem",flexShrink:0}}>
                                {!asistio&&(
                                  <button
                                    onClick={()=>setLlamadoNovedades(p=>({...p,[w.id]:null}))}
                                    style={{padding:"0.38rem 0.65rem",borderRadius:"8px",
                                      border:"2px solid #86efac",background:"#d1fae5",cursor:"pointer",
                                      fontSize:"0.75rem",fontWeight:"700",color:"#059669"}}>
                                    ✓ Asistió
                                  </button>
                                )}
                                <button
                                  onClick={e=>{
                                    const r=e.currentTarget.getBoundingClientRect();
                                    const alturaPopover=Math.min(novedades.length*46+90,480);
                                    const abrirArriba=r.bottom+alturaPopover>window.innerHeight-20;
                                    setLlamadoPopover({workerId:w.id,x:r.right,y:r.bottom,yTop:r.top,abrirArriba});
                                  }}
                                  style={{padding:"0.38rem 0.65rem",borderRadius:"8px",
                                    border:`2px solid ${novInfo?novInfo.color+"40":"#e2e8f0"}`,
                                    background:novInfo?novInfo.bg:"#f8fafc",cursor:"pointer",
                                    fontSize:"0.75rem",fontWeight:"700",
                                    color:novInfo?novInfo.color:"#64748b",
                                    display:"flex",alignItems:"center",gap:"0.3rem"}}>
                                  {novInfo?<Edit2 size={12}/>:<AlertCircle size={12}/>}
                                  {novInfo?"Cambiar":"Novedad"}
                                </button>
                                {(asistio||novInfo)&&(
                                  <button
                                    onClick={()=>setLlamadoNovedades(p=>{const n={...p};delete n[w.id];return n;})}
                                    title="Quitar marca"
                                    style={{padding:"0.38rem 0.5rem",borderRadius:"8px",
                                      border:"1.5px solid #e2e8f0",background:"#fff",cursor:"pointer",
                                      color:"#94a3b8",display:"flex"}}>
                                    <X size={12}/>
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {/* Botón guardar al final */}
                <div style={{display:"flex",justifyContent:"flex-end",gap:"0.75rem",paddingTop:"0.5rem"}}>
                  <button onClick={()=>{setVista("cuadrillas");setLlamadoNovedades({});}} style={{...sty.btnSec,color:"#64748b",padding:"0.65rem 1.25rem"}}>
                    Cancelar
                  </button>
                  <button
                    onClick={guardarLlamadoLista}
                    disabled={guardandoLlamado||totalConNovedad+totalAsistio===0}
                    style={{...sty.btnPrimary,background:totalConNovedad+totalAsistio>0?"#059669":"#e2e8f0",
                      color:totalConNovedad+totalAsistio>0?"#fff":"#94a3b8",
                      cursor:totalConNovedad+totalAsistio>0?"pointer":"not-allowed",
                      padding:"0.65rem 1.5rem",fontSize:"0.92rem"}}>
                    {guardandoLlamado?<RefreshCw size={16} style={{animation:"spin 1s linear infinite"}}/>:<Save size={16}/>}
                    {guardandoLlamado?"Guardando...":`Guardar llamado (${totalConNovedad+totalAsistio} marcados)`}
                  </button>
                </div>
              </div>
            )}
          </>
          );
        })()}

        {/* ══════════════════════════════════════════════════════════
            VISTA 2: REGISTRO DIARIO
            Izquierda: mini-calendario  |  Derecha: trabajadores del día
        ══════════════════════════════════════════════════════════ */}
        {vista==="diario" && (
          <>
            {cuadrillas.length===0 ? (
              <EmptyState icon="👥" title="No hay cuadrillas" desc="Primero crea cuadrillas."
                action={<button onClick={()=>setVista("cuadrillas")} style={sty.btnPrimary}>Ir a Cuadrillas</button>}/>
            ) : (
              <div style={{display:"grid",gridTemplateColumns:"320px 1fr",gap:"1.25rem",alignItems:"start"}}>

                {/* ── COLUMNA IZQUIERDA: calendario + selector cuadrilla ── */}
                <div>
                  {/* Selector cuadrilla */}
                  <div style={{marginBottom:"1rem"}}>
                    <label style={{display:"block",fontSize:"0.75rem",fontWeight:"700",
                      color:"#94a3b8",marginBottom:"0.4rem",textTransform:"uppercase",letterSpacing:"0.05em"}}>
                      Cuadrilla
                    </label>
                    <div style={{display:"flex",flexDirection:"column",gap:"0.35rem"}}>
                      {cuadrillas.map((c,idx)=>{
                        const activa=cuadrillaActiva?.id===c.id;
                        const color=COLORES[idx%COLORES.length];
                        return(
                          <button key={c.id} onClick={()=>setCuadrillaActiva(c)}
                            style={{padding:"0.65rem 1rem",borderRadius:"10px",
                              fontWeight:"700",fontSize:"0.85rem",cursor:"pointer",textAlign:"left",
                              border:`2px solid ${activa?color:"#e2e8f0"}`,
                              background:activa?`${color}12`:"#fff",
                              color:activa?color:"#475569",
                              boxShadow:activa?`0 3px 10px ${color}25`:"none",
                              transition:"all 0.13s",
                              display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                            <span>Cuadrilla {c.nombre}</span>
                            <span style={{fontSize:"0.73rem",opacity:0.7,fontWeight:"600"}}>
                              {c.totalPersonas||0} personas
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Mini calendario */}
                  <div style={{background:"#fff",borderRadius:"16px",
                    boxShadow:"0 2px 12px rgba(0,0,0,0.08)",border:"1px solid #f1f5f9",
                    overflow:"hidden"}}>
                    {/* Nav mes */}
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                      padding:"0.9rem 1rem",background:PRIMARY}}>
                      <button onClick={()=>{const d=new Date(anio,mes-2);setAnio(d.getFullYear());setMes(d.getMonth()+1);setDiaSelec(1);}}
                        style={{background:"rgba(255,255,255,0.15)",border:"none",borderRadius:"8px",
                          padding:"0.3rem 0.5rem",cursor:"pointer",color:"#fff",display:"flex"}}>
                        <ChevronLeft size={16}/>
                      </button>
                      <span style={{color:"#fff",fontWeight:"800",fontSize:"0.92rem"}}>
                        {mesLabel(anio,mes)}
                      </span>
                      <button onClick={()=>{const d=new Date(anio,mes);setAnio(d.getFullYear());setMes(d.getMonth()+1);setDiaSelec(1);}}
                        style={{background:"rgba(255,255,255,0.15)",border:"none",borderRadius:"8px",
                          padding:"0.3rem 0.5rem",cursor:"pointer",color:"#fff",display:"flex"}}>
                        <ChevronRight size={16}/>
                      </button>
                    </div>

                    {/* Días de la semana */}
                    <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",
                      background:`${PRIMARY}08`,borderBottom:"1px solid #f1f5f9"}}>
                      {["Do","Lu","Ma","Mi","Ju","Vi","Sa"].map(d=>(
                        <div key={d} style={{textAlign:"center",padding:"0.45rem 0",
                          fontSize:"0.65rem",fontWeight:"700",
                          color:d==="Do"?"#dc2626":"#94a3b8"}}>
                          {d}
                        </div>
                      ))}
                    </div>

                    {/* Grilla días */}
                    <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",padding:"0.4rem"}}>
                      {/* Espacios vacíos al inicio */}
                      {Array.from({length:primerDia(anio,mes)},(_,i)=>(
                        <div key={`e${i}`}/>
                      ))}
                      {diasArr.map(d=>{
                        const esSel     = d===diaSelec;
                        const esHoy     = d===hoy.getDate()&&mes===hoy.getMonth()+1&&anio===hoy.getFullYear();
                        const esDom     = esDomingo(anio,mes,d);
                        const novDia    = registro[String(d)]||{};
                        const conNov    = Object.keys(novDia).length;
                        const totalMiem = miembros.length;
                        return(
                          <button key={d} onClick={()=>setDiaSelec(d)}
                            style={{
                              position:"relative",
                              width:"100%",aspectRatio:"1",borderRadius:"10px",
                              border:"none",cursor:"pointer",
                              fontWeight:esSel||esHoy?"800":"500",
                              fontSize:"0.82rem",
                              background:esSel?PRIMARY:esHoy?`${PRIMARY}15`:"transparent",
                              color:esSel?"#fff":esDom?"#dc2626":esHoy?PRIMARY:"#374151",
                              transition:"all 0.12s",
                              display:"flex",flexDirection:"column",
                              alignItems:"center",justifyContent:"center",gap:"1px",
                            }}
                            onMouseEnter={e=>{if(!esSel)e.currentTarget.style.background=`${PRIMARY}10`;}}
                            onMouseLeave={e=>{if(!esSel)e.currentTarget.style.background=esHoy?`${PRIMARY}15`:"transparent";}}>
                            {d}
                            {/* Indicador de novedades */}
                            {totalMiem>0&&(
                              <span style={{
                                display:"block",width:"5px",height:"5px",borderRadius:"50%",
                                background:conNov>0?"#dc2626":esSel?"rgba(255,255,255,0.5)":"#d1fae5",
                              }}/>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Leyenda mini */}
                    <div style={{padding:"0.6rem 1rem",borderTop:"1px solid #f1f5f9",
                      display:"flex",gap:"0.75rem",fontSize:"0.68rem",color:"#94a3b8"}}>
                      <span>🔴 Con novedades</span>
                      <span>🟢 Todos asisten</span>
                    </div>
                  </div>

                  {/* Botones guardar/exportar */}
                  <div style={{marginTop:"0.85rem",display:"flex",flexDirection:"column",gap:"0.5rem"}}>
                    <button onClick={guardarRegistro} disabled={!modificado||guardandoReg}
                      style={{...sty.btnPrimary,justifyContent:"center",
                        background:modificado?PRIMARY:"#e2e8f0",
                        color:modificado?"#fff":"#94a3b8",
                        boxShadow:modificado?"0 4px 12px rgba(11,61,145,0.25)":"none",
                        cursor:modificado?"pointer":"not-allowed"}}>
                      {guardandoReg?<RefreshCw size={15} style={{animation:"spin 1s linear infinite"}}/>:<Save size={15}/>}
                      {guardandoReg?"Guardando...":"Guardar registro del mes"}
                    </button>
                    <button onClick={exportarCSV} disabled={!cuadrillaActiva||miembros.length===0}
                      style={{...sty.btnSec,justifyContent:"center",color:"#059669",
                        background:"#d1fae5",padding:"0.6rem",fontSize:"0.82rem"}}>
                      <Download size={14}/> Exportar CSV del mes
                    </button>
                  </div>
                </div>

                {/* ── COLUMNA DERECHA: trabajadores del día seleccionado ── */}
                <div>
                  {cargandoReg ? (
                    <div style={{textAlign:"center",padding:"3rem",color:PRIMARY}}>
                      <RefreshCw size={24} style={{animation:"spin 1s linear infinite"}}/>
                      <div style={{marginTop:"0.5rem",fontSize:"0.85rem"}}>Cargando...</div>
                    </div>
                  ) : !cuadrillaActiva ? (
                    <EmptyState icon="👆" title="Selecciona una cuadrilla" desc=""/>
                  ) : miembros.length===0 ? (
                    <EmptyState icon="👷" title={`Cuadrilla ${cuadrillaActiva.nombre} sin miembros`}
                      desc="Agrega trabajadores desde la pestaña Cuadrillas."
                      action={<button onClick={()=>{abrirEditar(cuadrillaActiva);setVista("cuadrillas");}} style={sty.btnPrimary}>Agregar miembros</button>}/>
                  ) : (
                    <>
                      {/* Encabezado del día */}
                      <div style={{marginBottom:"1rem"}}>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:"0.5rem"}}>
                          <div>
                            <div style={{fontWeight:"800",color:PRIMARY,fontSize:"1.1rem"}}>
                              {diaLetra(anio,mes,diaSelec)}, {diaSelec} de {MESES[mes-1]} {anio}
                            </div>
                            <div style={{color:"#64748b",fontSize:"0.82rem",marginTop:"0.15rem"}}>
                              Cuadrilla <strong>{cuadrillaActiva.nombre}</strong> · {miembros.length} miembro(s)
                            </div>
                          </div>
                          {modificado&&(
                            <span style={{background:"#fef9c3",border:"1px solid #fbbf24",
                              borderRadius:"8px",padding:"0.35rem 0.75rem",
                              fontSize:"0.75rem",color:"#92400e",fontWeight:"700"}}>
                              ⚠️ Sin guardar
                            </span>
                          )}
                        </div>

                        {/* Resumen del día */}
                        <div style={{display:"flex",gap:"0.6rem",marginTop:"0.85rem"}}>
                          <div style={{flex:1,background:"#d1fae5",borderRadius:"10px",
                            padding:"0.65rem 0.9rem",textAlign:"center"}}>
                            <div style={{fontSize:"1.5rem",fontWeight:"900",color:"#059669"}}>
                              {asistentesHoy.length}
                            </div>
                            <div style={{fontSize:"0.72rem",color:"#059669",fontWeight:"700"}}>
                              Asisten hoy
                            </div>
                            <div style={{fontSize:"0.65rem",color:"#6ee7b7",marginTop:"0.1rem"}}>
                              Suman en el pago
                            </div>
                          </div>
                          <div style={{flex:1,background:ausentesHoy.length>0?"#fee2e2":"#f8fafc",
                            borderRadius:"10px",padding:"0.65rem 0.9rem",textAlign:"center"}}>
                            <div style={{fontSize:"1.5rem",fontWeight:"900",
                              color:ausentesHoy.length>0?"#dc2626":"#cbd5e1"}}>
                              {ausentesHoy.length}
                            </div>
                            <div style={{fontSize:"0.72rem",
                              color:ausentesHoy.length>0?"#dc2626":"#94a3b8",fontWeight:"700"}}>
                              Con novedad
                            </div>
                            <div style={{fontSize:"0.65rem",
                              color:ausentesHoy.length>0?"#fca5a5":"#e2e8f0",marginTop:"0.1rem"}}>
                              No suman en el pago
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Lista de trabajadores */}
                      <div style={{display:"flex",flexDirection:"column",gap:"0.5rem"}}>
                        {miembros.map(m=>{
                          const codNov  = novedadesHoy[m.id]||null;
                          const novInfo = codNov ? novMap[codNov] : null;
                          const asiste  = !codNov;
                          return(
                            <div key={m.id} style={{
                              background:"#fff",borderRadius:"12px",
                              border:`2px solid ${asiste?"#d1fae5":novInfo?.color+"40"||"#fee2e2"}`,
                              padding:"0.85rem 1rem",
                              display:"flex",alignItems:"center",gap:"0.85rem",
                              boxShadow:"0 2px 8px rgba(0,0,0,0.05)",
                              transition:"all 0.15s",
                            }}>
                              {/* Icono estado */}
                              <div style={{
                                width:"44px",height:"44px",borderRadius:"12px",flexShrink:0,
                                background:asiste?"#d1fae5":novInfo?.bg||"#fee2e2",
                                display:"flex",alignItems:"center",justifyContent:"center",
                                fontSize:"1.3rem",
                              }}>
                                {asiste ? "✅" : novInfo?.emoji||"❓"}
                              </div>

                              {/* Info trabajador */}
                              <div style={{flex:1}}>
                                <div style={{fontWeight:"700",color:"#1e293b",fontSize:"0.92rem"}}>
                                  {m.nombre}
                                </div>
                                <div style={{fontSize:"0.73rem",fontFamily:"monospace",color:"#94a3b8"}}>
                                  {m.cedula}
                                </div>
                                {!asiste&&(
                                  <div style={{marginTop:"0.25rem",fontSize:"0.75rem",
                                    fontWeight:"700",color:novInfo?.color||"#dc2626"}}>
                                    {novInfo?.emoji} {novInfo?.label}
                                    <span style={{marginLeft:"0.35rem",fontSize:"0.68rem",
                                      opacity:0.7,fontWeight:"500"}}>— no suma en el pago de hoy</span>
                                  </div>
                                )}
                                {asiste&&(
                                  <div style={{marginTop:"0.2rem",fontSize:"0.72rem",color:"#6ee7b7",fontWeight:"600"}}>
                                    Asiste · suma en la división del pago
                                  </div>
                                )}
                              </div>

                              {/* Botón acción */}
                              <div style={{position:"relative"}}>
                                {asiste ? (
                                  <button
                                    onClick={e=>{
                                      const r=e.currentTarget.getBoundingClientRect();
                                      const alturaPopover = Math.min(novedades.length * 46 + 90, 480);
                                      const abrirArriba = r.bottom + alturaPopover > window.innerHeight - 20;
                                      setPopover({workerId:m.id,x:r.right,y:r.bottom,yTop:r.top,abrirArriba});
                                    }}
                                    style={{padding:"0.5rem 0.85rem",borderRadius:"9px",border:"2px solid #e2e8f0",
                                      background:"#fff",cursor:"pointer",fontSize:"0.78rem",fontWeight:"700",
                                      color:"#64748b",display:"flex",alignItems:"center",gap:"0.35rem",
                                      transition:"all 0.12s"}}
                                    onMouseEnter={e=>{e.currentTarget.style.borderColor="#ef4444";e.currentTarget.style.color="#ef4444";}}
                                    onMouseLeave={e=>{e.currentTarget.style.borderColor="#e2e8f0";e.currentTarget.style.color="#64748b";}}>
                                    <AlertCircle size={13}/> Registrar novedad
                                  </button>
                                ) : (
                                  <div style={{display:"flex",gap:"0.4rem"}}>
                                    <button
                                      onClick={e=>{
                                        const r=e.currentTarget.getBoundingClientRect();
                                        const alturaPopover = Math.min(novedades.length * 46 + 90, 480);
                                        const abrirArriba = r.bottom + alturaPopover > window.innerHeight - 20;
                                        setPopover({workerId:m.id,x:r.right,y:r.bottom,yTop:r.top,abrirArriba});
                                      }}
                                      style={{padding:"0.5rem 0.75rem",borderRadius:"9px",
                                        border:`2px solid ${novInfo?.color}40`,
                                        background:novInfo?.bg,cursor:"pointer",
                                        fontSize:"0.75rem",fontWeight:"700",
                                        color:novInfo?.color,display:"flex",alignItems:"center",gap:"0.3rem"}}>
                                      <Edit2 size={12}/> Cambiar
                                    </button>
                                    <button onClick={()=>setNovedad(m.id,null)}
                                      style={{padding:"0.5rem 0.75rem",borderRadius:"9px",
                                        border:"2px solid #d1fae5",background:"#d1fae5",cursor:"pointer",
                                        fontSize:"0.75rem",fontWeight:"700",color:"#059669",
                                        display:"flex",alignItems:"center",gap:"0.3rem"}}>
                                      ✓ Asistió
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════════
            VISTA 3: MENSUAL — grilla completa del mes
        ══════════════════════════════════════════════════════════ */}
        {vista==="mensual" && (
          <>
            {cuadrillas.length===0 ? (
              <EmptyState icon="👥" title="No hay cuadrillas" desc=""
                action={<button onClick={()=>setVista("cuadrillas")} style={sty.btnPrimary}>Ir a Cuadrillas</button>}/>
            ) : (
              <>
                {/* Controles */}
                <div style={{display:"flex",gap:"0.6rem",flexWrap:"wrap",alignItems:"center",marginBottom:"1rem"}}>
                  {/* Nav mes */}
                  <div style={{display:"flex",alignItems:"center",gap:"0.4rem",
                    background:"#fff",borderRadius:"10px",padding:"0.4rem 0.7rem",
                    boxShadow:"0 2px 8px rgba(0,0,0,0.07)",border:"1px solid #e2e8f0"}}>
                    <button onClick={()=>{const d=new Date(anio,mes-2);setAnio(d.getFullYear());setMes(d.getMonth()+1);}}
                      style={{background:"none",border:"none",cursor:"pointer",color:PRIMARY,display:"flex"}}>
                      <ChevronLeft size={18}/>
                    </button>
                    <span style={{color:PRIMARY,fontWeight:"800",fontSize:"0.9rem",minWidth:"135px",textAlign:"center"}}>
                      {mesLabel(anio,mes)}
                    </span>
                    <button onClick={()=>{const d=new Date(anio,mes);setAnio(d.getFullYear());setMes(d.getMonth()+1);}}
                      style={{background:"none",border:"none",cursor:"pointer",color:PRIMARY,display:"flex"}}>
                      <ChevronRight size={18}/>
                    </button>
                  </div>

                  {/* Selector cuadrilla */}
                  <div style={{display:"flex",gap:"0.35rem",flexWrap:"wrap",flex:1}}>
                    {cuadrillas.map((c,idx)=>{
                      const activa=cuadrillaActiva?.id===c.id;
                      const color=COLORES[idx%COLORES.length];
                      return(
                        <button key={c.id} onClick={()=>setCuadrillaActiva(c)}
                          style={{padding:"0.42rem 0.9rem",borderRadius:"9px",fontWeight:"700",
                            fontSize:"0.8rem",cursor:"pointer",
                            border:`2px solid ${activa?color:"#e2e8f0"}`,
                            background:activa?`${color}15`:"#fff",
                            color:activa?color:"#94a3b8",
                            boxShadow:activa?`0 3px 10px ${color}30`:"none",
                            transition:"all 0.13s"}}>
                          Cuadrilla {c.nombre}
                        </button>
                      );
                    })}
                  </div>

                  <button onClick={exportarCSV} disabled={!cuadrillaActiva||miembros.length===0}
                    style={{...sty.btnSec,color:"#059669",background:"#d1fae5"}}>
                    <Download size={14}/> CSV
                  </button>
                </div>

                {cargandoReg ? (
                  <div style={{textAlign:"center",padding:"3rem"}}>
                    <RefreshCw size={24} style={{animation:"spin 1s linear infinite",color:PRIMARY}}/>
                  </div>
                ) : !cuadrillaActiva||miembros.length===0 ? (
                  <EmptyState icon="👷" title="Sin datos" desc="Selecciona una cuadrilla con miembros."/>
                ) : (
                  <div style={{overflowX:"auto",borderRadius:"14px",
                    boxShadow:"0 4px 20px rgba(0,0,0,0.08)",
                    border:"1px solid #e2e8f0",background:"#fff"}}>
                    <table style={{borderCollapse:"collapse",minWidth:"100%",fontSize:"0.72rem"}}>
                      <thead>
                        <tr style={{background:PRIMARY}}>
                          <th style={sty.thH(PRIMARY,"#bfdbfe",2)} colSpan={2}>TRABAJADOR</th>
                          {diasArr.map(d=>(
                            <th key={d} style={{
                              ...sty.thH(esDomingo(anio,mes,d)?"#78350f":PRIMARY,
                                         esDomingo(anio,mes,d)?"#fcd34d":"#93c5fd"),
                              minWidth:"32px",padding:"4px 2px",textAlign:"center",cursor:"pointer"
                            }}
                            onClick={()=>{setDiaSelec(d);setVista("diario");}}>
                              <div style={{fontSize:"0.52rem",opacity:0.8}}>{diaSemana(anio,mes,d)}</div>
                              <div style={{fontWeight:"900"}}>{d}</div>
                            </th>
                          ))}

                        </tr>
                      </thead>
                      <tbody>
                        {miembros.map((m,rowIdx)=>{
                          let totalNov=0;
                          return(
                            <tr key={m.id}
                              style={{borderBottom:"1px solid #f1f5f9",
                                background:rowIdx%2===0?"#fff":"#f8fafc"}}
                              onMouseEnter={e=>e.currentTarget.style.background="#eff6ff"}
                              onMouseLeave={e=>e.currentTarget.style.background=rowIdx%2===0?"#fff":"#f8fafc"}>
                              <td style={{...sty.tdB,width:"28px",textAlign:"center",color:"#cbd5e1"}}>
                                {rowIdx+1}
                              </td>
                              <td style={{...sty.tdB,minWidth:"160px"}}>
                                <div style={{fontWeight:"700",color:"#1e293b"}}>{m.nombre}</div>
                                <div style={{color:"#94a3b8",fontSize:"0.63rem",fontFamily:"monospace"}}>{m.cedula}</div>
                              </td>
                              {diasArr.map(dia=>{
                                const cod=registro[String(dia)]?.[m.id]||null;
                                const nov=cod?novMap[cod]:null;
                                if(cod)totalNov++;
                                return(
                                  <td key={dia}
                                    onClick={()=>{setDiaSelec(dia);setVista("diario");}}
                                    title={cod?`${nov?.emoji} ${nov?.label}`:"✅ Asistió"}
                                    style={{
                                      padding:0,textAlign:"center",cursor:"pointer",
                                      background:cod?nov?.bg:"transparent",
                                      borderRight:"1px solid #f1f5f9",
                                      minWidth:"32px",height:"36px",
                                      userSelect:"none",transition:"filter 0.1s",
                                    }}
                                    onMouseEnter={e=>e.currentTarget.style.filter="brightness(0.85)"}
                                    onMouseLeave={e=>e.currentTarget.style.filter="none"}>
                                    {cod?(
                                      <span style={{display:"flex",alignItems:"center",justifyContent:"center",
                                        height:"100%",fontWeight:"900",fontSize:"0.58rem",color:nov?.color}}>
                                        {cod}
                                      </span>
                                    ):(
                                      <span style={{display:"flex",alignItems:"center",justifyContent:"center",
                                        height:"100%",color:"#d1fae5",fontSize:"0.8rem"}}>✓</span>
                                    )}
                                  </td>
                                );
                              })}

                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr style={{background:"#f0f9ff",borderTop:`2px solid ${PRIMARY}`}}>
                          <td colSpan={2} style={{padding:"0.55rem 0.75rem",
                            fontWeight:"800",color:PRIMARY,fontSize:"0.74rem"}}>
                            Asistentes por día →
                          </td>
                          {diasArr.map(dia=>{
                            const novDia=registro[String(dia)]||{};
                            const conNov=Object.keys(novDia).length;
                            const asist=miembros.length-conNov;
                            return(
                              <td key={dia} style={{padding:"3px 1px",textAlign:"center"}}>
                                <div style={{fontWeight:"800",fontSize:"0.62rem",
                                  color:"#059669",lineHeight:1.2}}>{asist}</div>
                                {conNov>0&&<div style={{fontWeight:"700",fontSize:"0.55rem",
                                  color:"#dc2626",lineHeight:1}}>{conNov}↓</div>}
                              </td>
                            );
                          })}

                        </tr>
                      </tfoot>
                    </table>
                    <div style={{padding:"0.6rem 1rem",fontSize:"0.72rem",color:"#94a3b8",
                      borderTop:"1px solid #f1f5f9"}}>
                      💡 Haz clic en cualquier día para ir al Registro diario de ese día
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* ══ POPOVER LLAMADO A LISTA ══ */}
      {llamadoPopover&&(
        <div ref={llamadoPopRef} style={{
          position:"fixed",
          right:typeof window!=="undefined"?Math.max(8,window.innerWidth-llamadoPopover.x):0,
          ...(llamadoPopover.abrirArriba
            ?{bottom:typeof window!=="undefined"?window.innerHeight-llamadoPopover.yTop+8:0}
            :{top:llamadoPopover.y+8}),
          zIndex:99999,
          background:"#fff",borderRadius:"16px",
          boxShadow:"0 12px 40px rgba(0,0,0,0.18),0 0 0 1px rgba(0,0,0,0.05)",
          padding:"0.75rem",minWidth:"260px",maxWidth:"300px",
          maxHeight:"480px",overflowY:"auto",
          animation:"popIn 0.13s ease",
        }}>
          <div style={{fontWeight:"800",color:PRIMARY,fontSize:"0.82rem",marginBottom:"0.3rem",padding:"0 0.25rem"}}>Registrar novedad</div>
          <div style={{height:"1px",background:"#f1f5f9",marginBottom:"0.45rem"}}/>
          {novedades.map(n=>(
            <button key={n.codigo}
              onClick={()=>{
                setLlamadoNovedades(p=>({...p,[llamadoPopover.workerId]:n.codigo}));
                setLlamadoPopover(null);
              }}
              style={{display:"flex",alignItems:"center",gap:"0.6rem",
                width:"100%",padding:"0.48rem 0.55rem",
                background:"transparent",border:"1.5px solid transparent",
                borderRadius:"9px",cursor:"pointer",marginBottom:"2px",textAlign:"left"}}
              onMouseEnter={e=>{e.currentTarget.style.background=n.bg;e.currentTarget.style.borderColor=n.color+"50";}}
              onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.borderColor="transparent";}}>
              <span style={{fontSize:"1rem",lineHeight:1,flexShrink:0}}>{n.emoji}</span>
              <span style={{flex:1,fontSize:"0.8rem",fontWeight:"600",color:"#374151"}}>{n.label}</span>
              {n.porcentaje&&(
                <span style={{fontSize:"0.65rem",fontFamily:"monospace",fontWeight:"900",
                  background:n.porcentaje.startsWith("-")?"#fee2e2":n.bg,
                  color:n.porcentaje.startsWith("-")?"#dc2626":n.color,
                  borderRadius:"4px",padding:"0px 5px",border:`1px solid ${n.color}30`}}>
                  {n.porcentaje}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* ══ MODAL NUEVA NOVEDAD DESDE LLAMADO ══ */}
      {modalNuevaLlamadoNov&&(
        <Modal onClose={()=>{setModalNuevaLlamadoNov(false);setErrNuevaNov("");setFormNuevaNov({label:"",emoji:"",codigo:""})}}
          title="➕ Nueva Novedad">
          <div style={{marginBottom:"1rem"}}>
            <label style={sty.label}>Emoji (opcional)</label>
            <input value={formNuevaNov.emoji} onChange={e=>setFormNuevaNov(p=>({...p,emoji:e.target.value}))}
              placeholder="📋" maxLength={2} style={{...sty.inputM,width:"64px",textAlign:"center",fontSize:"1.4rem",marginBottom:0}}/>
          </div>
          <div style={{marginBottom:"1rem"}}>
            <label style={sty.label}>Nombre de la novedad *</label>
            <input autoFocus value={formNuevaNov.label}
              onChange={e=>{setFormNuevaNov(p=>({...p,label:e.target.value}));setErrNuevaNov("");}}
              placeholder="Ej: Licencia de estudio..."
              style={{...sty.inputM,marginBottom:0,borderColor:errNuevaNov?"#ef4444":"#e2e8f0"}}/>
          </div>
          <div style={{marginBottom:"1rem"}}>
            <label style={sty.label}>Código (auto si vacío)</label>
            <input value={formNuevaNov.codigo}
              onChange={e=>{setFormNuevaNov(p=>({...p,codigo:e.target.value.toUpperCase()}));setErrNuevaNov("");}}
              placeholder="Ej: LE (máx 8 chars)" maxLength={8}
              style={{...sty.inputM,fontFamily:"monospace",marginBottom:0}}/>
          </div>
          {errNuevaNov&&<p style={{color:"#ef4444",fontSize:"0.8rem",margin:"0 0 0.75rem"}}>{errNuevaNov}</p>}
          <p style={{color:"#94a3b8",fontSize:"0.77rem",margin:"0 0 1.25rem"}}>
            La novedad se agrega al catálogo de Administrar y estará disponible inmediatamente.
          </p>
          <button onClick={crearNovedadDesdeCallada} disabled={creandoNov||!formNuevaNov.label.trim()}
            style={{...sty.btnPrimary,width:"100%",justifyContent:"center",
              background:formNuevaNov.label.trim()?"#7c3aed":"#94a3b8",
              cursor:formNuevaNov.label.trim()?"pointer":"not-allowed"}}>
            {creandoNov?<RefreshCw size={15} style={{animation:"spin 1s linear infinite"}}/>:<Plus size={15}/>}
            {creandoNov?"Creando...":"Crear novedad"}
          </button>
        </Modal>
      )}

      {/* ══ POPOVER DE NOVEDAD ══ */}
      {popover&&(
        <div ref={popRef} style={{
          position:"fixed",
          right:typeof window!=="undefined"?Math.max(8, window.innerWidth-popover.x):0,
          ...(popover.abrirArriba
            ? { bottom: typeof window!=="undefined" ? window.innerHeight - popover.yTop + 8 : 0 }
            : { top:    popover.y + 8 }
          ),
          zIndex:99999,
          background:"#fff",borderRadius:"16px",
          boxShadow:"0 12px 40px rgba(0,0,0,0.18),0 0 0 1px rgba(0,0,0,0.05)",
          padding:"0.75rem",minWidth:"260px",maxWidth:"300px",
          maxHeight:"480px",overflowY:"auto",
          animation:"popIn 0.13s ease",
        }}>
          <div style={{fontWeight:"800",color:PRIMARY,fontSize:"0.82rem",
            marginBottom:"0.3rem",padding:"0 0.25rem"}}>
            Registrar novedad
          </div>
          <div style={{fontSize:"0.7rem",color:"#94a3b8",marginBottom:"0.5rem",padding:"0 0.25rem"}}>
            {diaLetra(anio,mes,diaSelec)}, {diaSelec} de {MESES[mes-1]}
          </div>
          <div style={{height:"1px",background:"#f1f5f9",marginBottom:"0.45rem"}}/>
          {novedades.map(n=>(
            <button key={n.codigo}
              onClick={()=>setNovedad(popover.workerId,n.codigo)}
              style={{display:"flex",alignItems:"center",gap:"0.6rem",
                width:"100%",padding:"0.48rem 0.55rem",
                background:"transparent",
                border:"1.5px solid transparent",
                borderRadius:"9px",cursor:"pointer",marginBottom:"2px",
                transition:"all 0.08s",textAlign:"left"}}
              onMouseEnter={e=>{
                e.currentTarget.style.background=n.bg;
                e.currentTarget.style.borderColor=n.color+"50";
                const tip=e.currentTarget.querySelector(".nov-tip");
                if(tip)tip.style.display="block";
              }}
              onMouseLeave={e=>{
                e.currentTarget.style.background="transparent";
                e.currentTarget.style.borderColor="transparent";
                const tip=e.currentTarget.querySelector(".nov-tip");
                if(tip)tip.style.display="none";
              }}>
              <span style={{fontSize:"1rem",lineHeight:1,flexShrink:0}}>{n.emoji}</span>
              <span style={{flex:1,fontSize:"0.8rem",fontWeight:"600",color:"#374151"}}>
                {n.label}
                <span className="nov-tip" style={{
                  display:"none",fontSize:"0.62rem",color:n.color,
                  fontWeight:"500",marginTop:"1px"
                }}>
                  <br/>ℹ️ {n.info}
                </span>
              </span>
              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:"2px",flexShrink:0}}>
                {n.porcentaje && (
                  <span style={{
                    fontSize:"0.65rem",fontFamily:"monospace",fontWeight:"900",
                    background:n.porcentaje.startsWith("-")?"#fee2e2":n.bg,
                    color:n.porcentaje.startsWith("-")?"#dc2626":n.color,
                    borderRadius:"4px",padding:"0px 5px",border:`1px solid ${n.color}30`
                  }}>
                    {n.porcentaje}
                  </span>
                )}
                {n.paga && (
                  <span style={{fontSize:"0.58rem",color:"#94a3b8",fontWeight:"600"}}>
                    {n.paga}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ══ MODAL NUEVA CUADRILLA ══ */}
      {modalNueva&&(
        <Modal onClose={()=>setModalNueva(false)} title="Nueva cuadrilla">
          <label style={sty.label}>Nombre o número de cuadrilla</label>
          <input autoFocus value={nombreNueva}
            onChange={e=>{setNombreNueva(e.target.value);setErrNombre("");}}
            onKeyDown={e=>{if(e.key==="Enter")crearCuadrilla();}}
            placeholder="Ej: 1, 2, A, NORTE..."
            style={{...sty.inputM,borderColor:errNombre?"#ef4444":"#e2e8f0"}}/>
          {errNombre&&<p style={{color:"#ef4444",fontSize:"0.8rem",margin:"0.25rem 0 0"}}>{errNombre}</p>}
          <p style={{color:"#94a3b8",fontSize:"0.77rem",margin:"0.5rem 0 1.25rem"}}>
            {cuadrillas.length} cuadrilla(s) creada(s)
          </p>
          <button onClick={crearCuadrilla} disabled={guardando}
            style={{...sty.btnPrimary,width:"100%",justifyContent:"center"}}>
            {guardando?<RefreshCw size={15} style={{animation:"spin 1s linear infinite"}}/>:<Plus size={15}/>}
            {guardando?"Creando...":"Crear cuadrilla"}
          </button>
        </Modal>
      )}

      {/* ══ MODAL EDITAR MIEMBROS ══ */}
      {cuadrillaEditar&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:9999,
          display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}}
          onClick={e=>{if(e.target===e.currentTarget&&!guardandoEdit)setCuadrillaEditar(null);}}>
          <div style={{background:"#fff",borderRadius:"18px",width:"100%",maxWidth:"560px",
            maxHeight:"90vh",display:"flex",flexDirection:"column",
            boxShadow:"0 24px 60px rgba(0,0,0,0.2)"}}>

            <div style={{padding:"1.1rem 1.5rem",borderBottom:"1px solid #f1f5f9",
              display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div>
                <div style={{fontWeight:"800",color:PRIMARY,fontSize:"1rem"}}>
                  Cuadrilla {cuadrillaEditar.nombre} — Miembros
                </div>
                <div style={{color:"#64748b",fontSize:"0.78rem",marginTop:"0.1rem"}}>
                  {cuadrillaEditar.miembros.length} seleccionado(s) · Las novedades se registran en el calendario
                </div>
              </div>
              <button onClick={()=>setCuadrillaEditar(null)}
                style={{background:"none",border:"none",cursor:"pointer",display:"flex"}}>
                <X size={20} color="#94a3b8"/>
              </button>
            </div>

            {/* Chips */}
            {cuadrillaEditar.miembros.length>0&&(
              <div style={{padding:"0.7rem 1.5rem",borderBottom:"1px solid #f1f5f9",
                display:"flex",flexWrap:"wrap",gap:"0.35rem"}}>
                {cuadrillaEditar.miembros.map(m=>(
                  <span key={m.id} style={{background:`${PRIMARY}12`,color:PRIMARY,
                    borderRadius:"20px",padding:"0.22rem 0.5rem 0.22rem 0.8rem",
                    fontSize:"0.75rem",fontWeight:"700",display:"flex",alignItems:"center",gap:"0.3rem"}}>
                    {m.nombre}
                    <button onClick={()=>toggleMiembro(m)}
                      style={{background:"none",border:"none",cursor:"pointer",
                        color:"#94a3b8",padding:0,display:"flex"}}>
                      <X size={11}/>
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Buscador */}
            <div style={{padding:"0.7rem 1.5rem",borderBottom:"1px solid #f1f5f9"}}>
              <input value={busquedaWorker} onChange={e=>setBusquedaWorker(e.target.value)}
                placeholder="🔍 Buscar por nombre o cédula..."
                style={sty.inputM}/>
            </div>

            {/* Lista trabajadores */}
            <div style={{flex:1,overflowY:"auto",padding:"0.5rem 1.5rem"}}>
              {trabajadoresFiltrados.map(t=>{
                const sel=!!cuadrillaEditar.miembros.find(m=>m.id===t.id);
                return(
                  <div key={t.id}
                    onClick={()=>toggleMiembro(t)}
                    style={{display:"flex",alignItems:"center",gap:"0.7rem",
                      padding:"0.6rem 0.5rem",cursor:"pointer",borderRadius:"9px",
                      background:sel?`${SUCCESS}10`:"transparent",
                      marginBottom:"0.2rem",transition:"background 0.1s"}}
                    onMouseEnter={e=>{if(!sel)e.currentTarget.style.background="#f8fafc";}}
                    onMouseLeave={e=>{if(!sel)e.currentTarget.style.background=sel?`${SUCCESS}10`:"transparent";}}>
                    <div style={{width:"22px",height:"22px",borderRadius:"6px",flexShrink:0,
                      border:`2px solid ${sel?SUCCESS:"#e2e8f0"}`,
                      background:sel?SUCCESS:"#fff",
                      display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {sel&&<CheckCircle size={13} color="#fff"/>}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:"600",color:"#1e293b",fontSize:"0.87rem"}}>{t.nombre}</div>
                      <div style={{color:"#94a3b8",fontSize:"0.73rem",fontFamily:"monospace"}}>{t.cedula}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{padding:"1rem 1.5rem",borderTop:"1px solid #f1f5f9",display:"flex",gap:"0.65rem"}}>
              <button onClick={()=>setCuadrillaEditar(null)} disabled={guardandoEdit}
                style={{flex:1,padding:"0.75rem",background:"#f1f5f9",border:"none",
                  borderRadius:"10px",color:"#475569",fontWeight:"700",cursor:"pointer"}}>
                Cancelar
              </button>
              <button onClick={guardarMiembros} disabled={guardandoEdit}
                style={{...sty.btnPrimary,flex:2,justifyContent:"center"}}>
                {guardandoEdit?<RefreshCw size={14} style={{animation:"spin 1s linear infinite"}}/>:<Save size={14}/>}
                {guardandoEdit?"Guardando...":`Guardar (${cuadrillaEditar.miembros.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes popIn {
          from { opacity:0; transform:scale(0.92) translateY(-5px); }
          to   { opacity:1; transform:scale(1) translateY(0); }
        }
      `}</style>
    </LayoutWithSidebar>
  );
}

// ── Helpers de UI ─────────────────────────────────────────────────────────────
function EmptyState({icon,title,desc,action}){
  return(
    <div style={{textAlign:"center",padding:"4rem 2rem",color:"#94a3b8",
      background:"#fff",borderRadius:"16px",border:"1px dashed #e2e8f0"}}>
      <div style={{fontSize:"3rem",marginBottom:"0.75rem"}}>{icon}</div>
      <div style={{fontWeight:"800",fontSize:"1rem",color:"#475569",marginBottom:"0.5rem"}}>{title}</div>
      {desc&&<div style={{fontSize:"0.85rem",marginBottom:"1rem"}}>{desc}</div>}
      {action}
    </div>
  );
}

function Modal({children,onClose,title}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:9999,
      display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{background:"#fff",borderRadius:"18px",padding:"2rem",
        maxWidth:"420px",width:"100%",boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.5rem"}}>
          <h2 style={{margin:0,color:PRIMARY,fontWeight:"800",fontSize:"1.1rem"}}>{title}</h2>
          <button onClick={onClose}
            style={{background:"none",border:"none",cursor:"pointer",display:"flex"}}>
            <X size={20} color="#94a3b8"/>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Estilos compartidos ───────────────────────────────────────────────────────
const sty = {
  btnPrimary:{
    background:PRIMARY,border:"none",borderRadius:"10px",
    padding:"0.65rem 1.1rem",color:"#fff",fontWeight:"700",fontSize:"0.85rem",
    cursor:"pointer",display:"flex",alignItems:"center",gap:"0.4rem",
    boxShadow:"0 4px 12px rgba(11,61,145,0.25)",
  },
  btnSec:{
    border:"none",borderRadius:"8px",padding:"0.45rem 0.85rem",
    fontWeight:"700",fontSize:"0.8rem",cursor:"pointer",
    display:"flex",alignItems:"center",gap:"0.35rem",
  },
  thH:(bg,color)=>({
    padding:"5px 4px",textAlign:"center",background:bg,color,
    fontWeight:"700",fontSize:"0.65rem",
    borderRight:"1px solid rgba(255,255,255,0.08)",whiteSpace:"nowrap",
  }),
  tdB:{
    padding:"4px 6px",color:"#1e293b",verticalAlign:"middle",
    borderRight:"1px solid #f1f5f9",fontSize:"0.73rem",
  },
  label:{
    display:"block",fontWeight:"700",color:"#374151",
    marginBottom:"0.4rem",fontSize:"0.82rem",
  },
  inputM:{
    width:"100%",padding:"0.7rem 0.9rem",border:"1.5px solid #e2e8f0",
    borderRadius:"10px",fontSize:"0.9rem",outline:"none",
    boxSizing:"border-box",fontFamily:"inherit",marginBottom:"0",
  },
};
