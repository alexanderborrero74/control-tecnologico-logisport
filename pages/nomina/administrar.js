// pages/nomina/administrar.js
// Administración de catálogos del módulo de nómina:
// Cargos (con sueldo básico), Novedades

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, orderBy, query, writeBatch, setDoc
} from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";
import { getUserRoleByUid } from "@/utils/getUserRole";
import LayoutWithSidebar from "@/components/LayoutWithSidebar";
import {
  Settings, Plus, Edit2, Trash2, Save, X, ArrowLeft,
  Briefcase, Users, AlertCircle, MessageSquare, UserCheck,
  ClipboardList, ArrowRight, Check, DollarSign, Smile, Building2
} from "lucide-react";
import { formatCOP } from "@/utils/nominaCalculos";

const PRIMARY = "#0B3D91";
const ACCENT = "#00AEEF";

// Clientes que tienen cargos diferenciados
const CLIENTES_CARGOS = [
  { id: "spia",     label: "SPIA",     color: "#0B3D91", emoji: "🏭" },
  { id: "cliente2", label: "CIAMSA 2", color: "#8b5cf6", emoji: "🏗️" },
  { id: "cliente3", label: "CIAMSA 3", color: "#f59e0b", emoji: "🏭" },
];

// Valores iniciales para cargos con su sueldo básico mensual
const CARGOS_INICIALES = [
  { nombre: "ASISTENTE DE OPERACIONES",               basicoMensual: 1977000  },
  { nombre: "AUXILIAR ADMINISTRATIVA",                basicoMensual: 1930000  },
  { nombre: "AUXILIAR DE OPERACIONES",                basicoMensual: 1787405  },
  { nombre: "AUXILIAR SISO",                          basicoMensual: 1787405  },
  { nombre: "AUXILIAR CONTABLE",                      basicoMensual: 1750905  },
  { nombre: "AUXILIAR GESTION HUMANA",                basicoMensual: 1750905  },
  { nombre: "AUXILIAR COMPRAS",                       basicoMensual: 1750905  },
  { nombre: "COORDINADOR OPERACIONES",                basicoMensual: 2500000  },
  { nombre: "COORDINADOR SGST",                       basicoMensual: 2207000  },
  { nombre: "COORDINADORA DE RECURSOS HUMANOS",       basicoMensual: 2500000  },
  { nombre: "DIRECTOR DE OPERACIONES",                basicoMensual: 4046350  },
  { nombre: "ESTIBADOR",                              basicoMensual: 1750905  },
  { nombre: "GERENTE",                                basicoMensual: 6000000  },
  { nombre: "CONTADOR",                               basicoMensual: 3500000  },
  { nombre: "LIDER SISTEMA DE GESTION SGST",          basicoMensual: 2207000  },
  { nombre: "LIDER DE RESPONSABILIDAD SOCIAL Y BIENESTAR", basicoMensual: 2207000 },
  { nombre: "LIQUIDADOR DE SERVICIOS",                basicoMensual: 1977000  },
  { nombre: "OPERADOR DE MONTACARGA",                 basicoMensual: 2050000  },
  { nombre: "LIDER SOCIAL",                           basicoMensual: 2050000  },
];

const CUADRILLAS_INICIALES = [
  { nombre: "1",       descripcion: "Cuadrilla operativa 1" },
  { nombre: "2",       descripcion: "Cuadrilla operativa 2" },
  { nombre: "3",       descripcion: "Cuadrilla operativa 3" },
  { nombre: "4",       descripcion: "Cuadrilla operativa 4" },
  { nombre: "5",       descripcion: "Cuadrilla operativa 5" },
  { nombre: "6",       descripcion: "Cuadrilla operativa 6" },
  { nombre: "ADM",     descripcion: "Cuadrilla administrativa" },
  { nombre: "ADM-OPE", descripcion: "Cuadrilla administrativo-operativa" },
  { nombre: "CIAMSA",  descripcion: "Cuadrilla CIAMSA" },
  { nombre: "OM",      descripcion: "Cuadrilla OM" },
  { nombre: "AX",      descripcion: "Cuadrilla AX" },
];

// Novedades predefinidas — fuente única de verdad, se cargan a Firestore desde aquí
const NOVEDADES_INICIALES = [
  { codigo:"D",       label:"Descanso",                     emoji:"😴", color:"#64748b", bg:"#f1f5f9", orden:1,
    paga:"—",         porcentaje:"0%",     info:"Día de descanso programado · sin descuento ni pago adicional" },
  { codigo:"I",       label:"Inasistencia",                 emoji:"❌", color:"#dc2626", bg:"#fee2e2", orden:2,
    paga:"Nadie",     porcentaje:"-100%",  info:"No asistió sin justificación · descuento total del día (art. 58 CST)" },
  { codigo:"INC-EG",  label:"Incap. Enf. General",         emoji:"🥴", color:"#ea580c", bg:"#fff7ed", orden:3,
    paga:"EPS",       porcentaje:"66.67%", info:"Días 1-2: empleador 100% · Día 3+: EPS paga 66.67% del IBC (art. 227 CST)" },
  { codigo:"INC-AT",  label:"Incap. Accidente Trabajo",    emoji:"🩼", color:"#b91c1c", bg:"#fef2f2", orden:4,
    paga:"ARL",       porcentaje:"100%",   info:"ARL paga 100% del IBC desde el día 1 (Decreto 1295/94)" },
  { codigo:"INC-EL",  label:"Incap. Enf. Laboral",        emoji:"🦴", color:"#9333ea", bg:"#faf5ff", orden:5,
    paga:"ARL",       porcentaje:"100%",   info:"ARL paga 100% del IBC desde el día 1 (Decreto 1295/94)" },
  { codigo:"INC-MAT", label:"Licencia Maternidad",         emoji:"🤱", color:"#db2777", bg:"#fdf2f8", orden:6,
    paga:"EPS",       porcentaje:"100%",   info:"EPS paga 100% del IBC · 18 semanas (art. 236 CST · Ley 1822/17)" },
  { codigo:"INC-PAT", label:"Licencia Paternidad",         emoji:"👨‍👶", color:"#0369a1", bg:"#f0f9ff", orden:7,
    paga:"EPS",       porcentaje:"100%",   info:"EPS paga 100% del IBC · 2 semanas (art. 236 CST)" },
  { codigo:"IR",      label:"Incap. Remunerada (empleador)",emoji:"💊", color:"#0891b2", bg:"#e0f2fe", orden:8,
    paga:"Empleador", porcentaje:"66.67%", info:"Empleador paga 66.67% del salario diario · desde día 3 de EG o política interna (art. 227 CST)" },
  { codigo:"IR-100", label:"Incap. Remunerada 100% (días 1-2)",emoji:"🏥", color:"#047857", bg:"#d1fae5", orden:9,
    paga:"Empleador", porcentaje:"100%",   info:"Empleador paga 100% del salario diario en los primeros 2 días de enfermedad general (art. 227 CST)" },
  { codigo:"S",       label:"Suspensión disciplinaria",    emoji:"🚫", color:"#991b1b", bg:"#fef2f2", orden:10,
    paga:"Nadie",     porcentaje:"-100%",  info:"Suspensión por justa causa · sin salario durante el período (art. 112 CST)" },
  { codigo:"B",       label:"Bloqueado muelle",            emoji:"⛔", color:"#1d4ed8", bg:"#dbeafe", orden:11,
    paga:"Empleador", porcentaje:"100%",   info:"Fuerza mayor ajena al trabajador · empleador debe salario (art. 140 CST)" },
  { codigo:"PNR",     label:"Permiso no remunerado",       emoji:"📋", color:"#b45309", bg:"#fef9c3", orden:12,
    paga:"Nadie",     porcentaje:"-100%",  info:"Permiso sin goce de sueldo · descuento total del día (art. 57 CST)" },
  { codigo:"CAL",     label:"Calamidad doméstica",         emoji:"🏠", color:"#7c3aed", bg:"#f5f3ff", orden:13,
    paga:"Empleador", porcentaje:"100%",   info:"Empleador paga 100% · máx. 5 días hábiles remunerados (art. 57 CST)" },
  { codigo:"ADV",     label:"Adventista",                  emoji:"⛪", color:"#4d7c0f", bg:"#f0fdf4", orden:14,
    paga:"Acuerdo",   porcentaje:"100%",   info:"Permiso religioso · remunerado si compensa horas (Ley 133/94)" },
  { codigo:"L",       label:"Luto",                        emoji:"🖤", color:"#374151", bg:"#f9fafb", orden:15,
    paga:"Empleador", porcentaje:"100%",   info:"Empleador paga 100% · 5 días hábiles remunerados (Ley 1280/09)" },
];

const TABS = [
  { id: "cargos",    label: "Cargos",    icon: Briefcase, color: "#3b82f6", desc: "Cargos, posiciones y sueldo básico mensual" },
  { id: "novedades", label: "Novedades", icon: Smile,     color: "#8b5cf6", desc: "Tipos de novedad disponibles en el registro de asistencia" },
  { id: "clientes",  label: "Clientes",  icon: Building2, color: "#6366f1", desc: "Clientes del sistema y asociación de trabajadores" },
];

// Clientes predeterminados del sistema
const CLIENTES_DEFAULT = [
  { id:"spia",     nombre:"SPIA",     color:"#0B3D91", emoji:"🏭", descripcion:"Cliente principal — Puerto SPIA",       codContable:"CC110206" },
  { id:"cliente1", nombre:"Cliente 1",color:"#10b981", emoji:"🏢", descripcion:"Sin datos aún",                         codContable:"" },
  { id:"cliente2", nombre:"CIAMSA 2", color:"#8b5cf6", emoji:"🏗️", descripcion:"CIAMSA — Terminal 2",                  codContable:"CC110203" },
  { id:"cliente3", nombre:"CIAMSA 3", color:"#f59e0b", emoji:"🏭", descripcion:"CIAMSA — Terminal 3",                  codContable:"CC110203" },
  { id:"admon",    nombre:"ADMON SPIA",color:"#6366f1", emoji:"🏛️", descripcion:"Personal administrativo y operativo", codContable:"CC110205" },
];

const COLECCION = {
  cargos:        "nomina_cargos",
  cuadrillas:    "nomina_cuadrillas_config",
  motivos:       "nomina_motivos",
  observaciones: "nomina_observaciones",
  novedades:     "nomina_novedades",
  clientes:      "nomina_clientes",
};

function CargoClienteBadge({ clienteId }) {
  const cl = CLIENTES_CARGOS.find(c => c.id === (clienteId || "spia")) || CLIENTES_CARGOS[0];
  return (
    <span style={{ background:`${cl.color}18`, color:cl.color,
      borderRadius:"20px", padding:"2px 10px",
      fontSize:"0.72rem", fontWeight:"700", whiteSpace:"nowrap" }}>
      {cl.emoji} {cl.label}
    </span>
  );
}

export default function NominaAdministrar() {
  const router = useRouter();
  const [rol, setRol] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tabActiva, setTabActiva] = useState("cargos");

  const [datos, setDatos] = useState({ cargos: [], cuadrillas: [], motivos: [], observaciones: [], novedades: [] });
  const [cargando, setCargando] = useState(false);

  const [editandoId, setEditandoId] = useState(null);
  const [formNombre, setFormNombre] = useState("");
  const [formDesc,   setFormDesc]   = useState("");
  const [formBasico, setFormBasico] = useState("");
  // Campos extra para novedades
  const [formCodigo,     setFormCodigo]     = useState("");
  const [formEmoji,      setFormEmoji]      = useState("");
  const [formColor,      setFormColor]      = useState("#64748b");
  const [formBg,         setFormBg]         = useState("#f1f5f9");
  const [formPaga,       setFormPaga]       = useState("");
  const [formPorcentaje, setFormPorcentaje] = useState("");
  const [formInfo,       setFormInfo]       = useState("");
  const [formClienteId, setFormClienteId] = useState("spia");
  const [filtroClienteCargo, setFiltroClienteCargo] = useState("spia");
  // Campos extra para clientes
  const [formCodContable, setFormCodContable] = useState("");
  const [formClienteDocId, setFormClienteDocId] = useState(""); // ID Firestore para nuevo cliente
  const [clientesTrabCount, setClientesTrabCount] = useState({}); // clienteId → count
  const [agregando, setAgregando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/login"); return; }
      const r = await getUserRoleByUid(user.uid);
      setRol(r);
      if (!["admin", "admin_nomina", "nomina"].includes(r)) {
        router.push("/nomina"); return;
      }
      await cargarTodo();
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const cargarTodo = async () => {
    setCargando(true);
    try {
      const [cargosSnap, novSnap, clientesSnap, trabSnap] = await Promise.all([
        getDocs(query(collection(db, "nomina_cargos"),    orderBy("nombre"))),
        getDocs(query(collection(db, "nomina_novedades"), orderBy("orden"))),
        getDocs(collection(db, "nomina_clientes")),
        getDocs(collection(db, "nomina_trabajadores")),
      ]);
      // Asegurar que todos los clientes por defecto existan en Firestore
      const existIds = new Set(clientesSnap.docs.map(d => d.id));
      const faltantes = CLIENTES_DEFAULT.filter(c => !existIds.has(c.id));
      if (faltantes.length > 0) {
        const batchInit = writeBatch(db);
        faltantes.forEach(c => batchInit.set(doc(db, "nomina_clientes", c.id), {
          nombre:c.nombre, descripcion:c.descripcion, color:c.color,
          emoji:c.emoji, codContable:c.codContable||"" , activo:true, creadoEn:new Date()
        }));
        await batchInit.commit();
      }
      // Cargar clientes actualizados — deduplicar por ID
      const clientesMap = new Map();
      clientesSnap.docs.forEach(d => clientesMap.set(d.id, { id:d.id, ...d.data() }));
      faltantes.forEach(c => { if (!clientesMap.has(c.id)) clientesMap.set(c.id, { ...c }); });
      const clientesData = Array.from(clientesMap.values());
      const orden = ["spia","cliente1","cliente2","cliente3","admon"];
      clientesData.sort((a,b) => {
        const ia = orden.indexOf(a.id); const ib = orden.indexOf(b.id);
        if (ia === -1 && ib === -1) return (a.nombre||'').localeCompare(b.nombre||'');
        if (ia === -1) return 1; if (ib === -1) return -1;
        return ia - ib;
      });
      // Contar trabajadores por cliente
      const counts = {};
      trabSnap.docs.forEach(d => {
        const ids = d.data().clienteIds || ["spia"];
        ids.forEach(id => { counts[id] = (counts[id]||0)+1; });
      });
      setClientesTrabCount(counts);
      setDatos({
        cargos:    cargosSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        novedades: novSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        clientes:  clientesData,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setCargando(false);
    }
  };

  const cargarTab = async (tab) => {
    if (tab === "clientes") { await cargarTodo(); return; }
    const col = COLECCION[tab];
    const field = tab === "observaciones" ? "texto" : tab === "novedades" ? "orden" : "nombre";
    try {
      const snap = await getDocs(query(collection(db, col), orderBy(field)));
      setDatos(prev => ({ ...prev, [tab]: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
    } catch (e) {
      console.error(e);
    }
  };

  const poblarIniciales = async (tab) => {
    const msg = tab === "novedades" && datos.novedades?.length > 0
      ? `¿Reemplazar TODAS las novedades actuales (${datos.novedades.length}) con el catálogo completo predefinido?\n\nEsto eliminará las antiguas y cargará las 14 novedades oficiales con campos Paga, % e Info legal.`
      : `¿Poblar ${tab} con los valores predefinidos del sistema?`;
    if (!confirm(msg)) return;
    setCargando(true);
    try {
      if (tab === "cargos") {
        await Promise.all(CARGOS_INICIALES.map(c =>
          addDoc(collection(db, "nomina_cargos"), {
            nombre:        c.nombre,
            basicoMensual: c.basicoMensual,
            creadoEn:      new Date()
          })
        ));
      } else if (tab === "cuadrillas") {
        await Promise.all(CUADRILLAS_INICIALES.map(c =>
          addDoc(collection(db, "nomina_cuadrillas_config"), {
            nombre: c.nombre, descripcion: c.descripcion, creadoEn: new Date()
          })
        ));
      } else if (tab === "novedades") {
        // Eliminar duplicados primero
        const existSnap = await getDocs(collection(db, "nomina_novedades"));
        const batchDel = writeBatch(db);
        existSnap.docs.forEach(d => batchDel.delete(d.ref));
        await batchDel.commit();
        // Insertar valores iniciales limpios
        await Promise.all(NOVEDADES_INICIALES.map(n =>
          addDoc(collection(db, "nomina_novedades"), { ...n, creadoEn: new Date() })
        ));
      }
      await cargarTab(tab);
    } catch (e) {
      alert("Error: " + e.message);
    }
    setCargando(false);
  };

  // ── CRUD ──
  const iniciarAgregar = () => {
    setEditandoId(null);
    setFormNombre(""); setFormDesc(""); setFormBasico("");
    setFormCodigo(""); setFormEmoji("🏢"); setFormColor("#10b981"); setFormBg("#f1f5f9");
    setFormPaga(""); setFormPorcentaje(""); setFormInfo("");
    setFormCodContable(""); setFormClienteDocId("");
    setFormClienteId(tabActiva === "cargos" ? filtroClienteCargo : "spia");
    setAgregando(true);
  };

  const iniciarEditar = (item) => {
    setAgregando(false);
    setEditandoId(item.id);
    setFormNombre(item.nombre || item.label || item.texto || "");
    setFormDesc(item.descripcion || "");
    setFormBasico(item.basicoMensual != null ? String(item.basicoMensual) : "");
    setFormCodigo(item.codigo || "");
    setFormEmoji(item.emoji || "");
    setFormColor(item.color || "#64748b");
    setFormBg(item.bg || "#f1f5f9");
    setFormPaga(item.paga || "");
    setFormPorcentaje(item.porcentaje || "");
    setFormInfo(item.info || "");
    setFormCodContable(item.codContable || "");
    setFormClienteId(item.clienteId || "spia");
  };

  const cancelar = () => {
    setEditandoId(null); setAgregando(false);
    setFormNombre(""); setFormDesc(""); setFormBasico("");
    setFormCodigo(""); setFormEmoji(""); setFormColor("#64748b"); setFormBg("#f1f5f9");
    setFormPaga(""); setFormPorcentaje(""); setFormInfo("");
    setFormCodContable(""); setFormClienteDocId("");
    setFormClienteId(filtroClienteCargo);
  };

  const guardar = async () => {
    if (!formNombre.trim()) return;
    if (tabActiva === "novedades" && !formCodigo.trim()) { alert("El código es obligatorio."); return; }
    setGuardando(true);
    const col  = COLECCION[tabActiva];
    const esObs      = tabActiva === "observaciones";
    const esCargo    = tabActiva === "cargos";
    const esCuad     = tabActiva === "cuadrillas";
    const esNovedad  = tabActiva === "novedades";

    const esCliente = tabActiva === "clientes";
    let data = {};
    if (esCliente) {
      data = {
        nombre:       formNombre.trim().toUpperCase(),
        descripcion:  formDesc.trim(),
        color:        formColor,
        emoji:        formEmoji.trim() || "🏢",
        codContable:  formCodContable.trim().toUpperCase(),
        activo:       true,
      };
      try {
        if (editandoId) {
          await updateDoc(doc(db, "nomina_clientes", editandoId), { ...data, actualizadoEn: new Date() });
        } else {
          const slugId = (formClienteDocId.trim() || formNombre.trim()).toLowerCase()
            .replace(/[^a-z0-9]/g, "-").replace(/-+/g,"-").replace(/^-|-$/g,"").slice(0,30);
          if (!slugId) { alert("Ingresa un nombre válido."); setGuardando(false); return; }
          await setDoc(doc(db, "nomina_clientes", slugId), { ...data, creadoEn: new Date() });
        }
        await cargarTodo();
        cancelar();
      } catch(e) { alert("Error: " + e.message); }
      setGuardando(false);
      return;
    }
    if (esObs) {
      data = { texto: formNombre.trim() };
    } else if (esCargo) {
      data = {
        nombre:        formNombre.trim().toUpperCase(),
        basicoMensual: parseFloat(formBasico) || 0,
        clienteId:     formClienteId || "spia",
      };
    } else if (esCuad) {
      data = {
        nombre:      formNombre.trim(),
        descripcion: formDesc.trim(),
      };
    } else if (esNovedad) {
    const maxOrden = Math.max(0, ...(datos.novedades.map(n => n.orden || 0)));
    data = {
    codigo:      formCodigo.trim().toUpperCase(),
    label:       formNombre.trim(),
    emoji:       formEmoji.trim() || "📌",
    color:       formColor,
    bg:          formBg,
    paga:        formPaga.trim(),
    porcentaje:  formPorcentaje.trim(),
    info:        formInfo.trim(),
      orden:  editandoId
            ? (datos.novedades.find(n => n.id === editandoId)?.orden || maxOrden + 1)
            : maxOrden + 1,
        };
    } else {
      data = { nombre: formNombre.trim().toUpperCase() };
    }

    try {
      if (editandoId) {
        await updateDoc(doc(db, col, editandoId), { ...data, actualizadoEn: new Date() });

        // Si es un cargo y cambió el básico mensual → propagar a trabajadores del mismo cargo y cliente
        if (esCargo && data.basicoMensual) {
          const trabSnap = await getDocs(collection(db, "nomina_trabajadores"));
          const aMiCargo = trabSnap.docs.filter(d => {
            const mismoNombre = String(d.data().cargo || "").trim().toUpperCase() === data.nombre.trim().toUpperCase();
            const mismoCliente = (d.data().clienteIds || ["spia"]).includes(data.clienteId || "spia");
            return mismoNombre && mismoCliente;
          });
          if (aMiCargo.length > 0) {
            const batch = writeBatch(db);
            aMiCargo.forEach(d => batch.update(d.ref, { basicoMensual: data.basicoMensual, actualizadoEn: new Date() }));
            await batch.commit();
          }
        }
      } else {
        await addDoc(collection(db, col), { ...data, creadoEn: new Date() });
      }
      await cargarTab(tabActiva);
      cancelar();
    } catch (e) {
      alert("Error: " + e.message);
    }
    setGuardando(false);
  };

  const eliminar = async (item) => {
    const nombre = item.nombre || item.texto || item.label || "";
    if (tabActiva === "clientes" && item.id === "spia") {
      alert("No se puede eliminar el cliente SPIA (cliente principal del sistema)."); return;
    }
    if (!confirm(`¿Eliminar "${nombre}"?`)) return;
    await deleteDoc(doc(db, COLECCION[tabActiva], item.id));
    await cargarTab(tabActiva);
  };

  const cambiarTab = (tab) => {
    setTabActiva(tab);
    cancelar();
  };

  // Para cargos filtramos por cliente activo; el resto sin filtro
  const itemsActuales = tabActiva === "cargos"
    ? (datos.cargos || []).filter(c => (c.clienteId || "spia") === filtroClienteCargo)
    : (datos[tabActiva] || []);
  const esCliente = tabActiva === "clientes";
  const tabInfo    = TABS.find(t => t.id === tabActiva);
  const esObs      = tabActiva === "observaciones";
  const esCuad     = tabActiva === "cuadrillas";
  const esCargo    = tabActiva === "cargos";
  const esNovedad  = tabActiva === "novedades";

  if (loading) return (
    <LayoutWithSidebar>
      <div style={{ textAlign: "center", padding: "4rem", color: PRIMARY }}>
        <div style={{ fontSize: "2rem" }}>⚙️ Cargando administración...</div>
      </div>
    </LayoutWithSidebar>
  );

  return (
    <LayoutWithSidebar>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
          <button onClick={() => router.push("/nomina")}
            style={{ background: "none", border: "none", cursor: "pointer", color: PRIMARY }}>
            <ArrowLeft size={22} />
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, color: PRIMARY, fontSize: "1.6rem", fontWeight: "800" }}>
              ⚙️ Administrar Módulo de Nómina
            </h1>
            <p style={{ margin: 0, color: "#64748b", fontSize: "0.9rem" }}>
              Gestiona los catálogos base — incluye cargos y sueldos básicos mensuales
            </p>
          </div>
        </div>

        {/* Accesos rápidos */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "0.75rem", marginBottom: "1.5rem",
        }}>
          {[
            { label: "Trabajadores",       desc: "Gestionar empleados",   path: "/nomina/trabajadores", icon: UserCheck,    color: "#3b82f6" },
            { label: "Servicios y Tarifas", desc: "Catálogo de servicios", path: "/nomina/servicios",    icon: ClipboardList, color: "#8b5cf6" },
          ].map((m, i) => (
            <div key={i} onClick={() => router.push(m.path)} style={{
              background: "#fff", borderRadius: "10px", padding: "0.9rem 1rem",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)", cursor: "pointer",
              border: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: "0.75rem",
              transition: "all 0.15s",
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = m.color; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.transform = "none"; }}
            >
              <div style={{ width: "36px", height: "36px", background: `${m.color}18`, borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <m.icon size={18} color={m.color} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: "700", color: "#1e293b", fontSize: "0.88rem" }}>{m.label}</div>
                <div style={{ color: "#94a3b8", fontSize: "0.75rem" }}>{m.desc}</div>
              </div>
              <ArrowRight size={14} color="#94a3b8" />
            </div>
          ))}
        </div>

        {/* Pestañas */}
        <div style={{
          display: "flex", gap: "0.4rem", marginBottom: "0",
          borderBottom: "2px solid #e2e8f0", flexWrap: "wrap",
        }}>
          {TABS.map(tab => {
            const activa = tabActiva === tab.id;
            return (
              <button key={tab.id} onClick={() => cambiarTab(tab.id)} style={{
                padding: "0.7rem 1.2rem", border: "none",
                borderBottom: activa ? `2px solid ${tab.color}` : "2px solid transparent",
                marginBottom: "-2px",
                background: activa ? `${tab.color}10` : "transparent",
                color: activa ? tab.color : "#64748b",
                fontWeight: activa ? "800" : "600",
                cursor: "pointer", fontSize: "0.88rem",
                borderRadius: "8px 8px 0 0",
                display: "flex", alignItems: "center", gap: "0.4rem",
                transition: "all 0.15s",
              }}>
                <tab.icon size={15} />
                {tab.label}
                <span style={{
                  background: activa ? tab.color : "#e2e8f0",
                  color: activa ? "#fff" : "#64748b",
                  borderRadius: "20px", padding: "1px 7px",
                  fontSize: "0.72rem", fontWeight: "700",
                }}>
                  {datos[tab.id]?.length || 0}
                </span>
              </button>
            );
          })}
        </div>

        {/* Contenido */}
        <div style={{
          background: "#fff", borderRadius: "0 0 12px 12px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          border: "1px solid #e2e8f0", borderTop: "none",
        }}>
          {/* Sub-header */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "1rem 1.25rem", borderBottom: "1px solid #f1f5f9",
            flexWrap: "wrap", gap: "0.75rem",
          }}>
            <div>
              <div style={{ fontWeight: "700", color: PRIMARY, fontSize: "1rem" }}>
                {tabInfo?.label}
              </div>
              <div style={{ color: "#64748b", fontSize: "0.82rem" }}>{tabInfo?.desc}</div>
            </div>
            {/* Filtro de cliente — solo en pestaña Cargos */}
          {esCargo && (
            <div style={{ display:"flex", gap:"0.4rem", flexWrap:"wrap", alignItems:"center", marginBottom:"0.1rem" }}>
              <span style={{ fontSize:"0.75rem", color:"#64748b", fontWeight:"700" }}>🏢 Cliente:</span>
              {CLIENTES_CARGOS.map(cl => {
                const activo = filtroClienteCargo === cl.id;
                const countCl = (datos.cargos||[]).filter(c=>(c.clienteId||"spia")===cl.id).length;
                return (
                  <button key={cl.id} onClick={()=>{ setFiltroClienteCargo(cl.id); cancelar(); }}
                    style={{ padding:"0.3rem 0.85rem", borderRadius:"20px",
                      border:`2px solid ${activo?cl.color:"#e2e8f0"}`,
                      background:activo?cl.color:"#fff",
                      color:activo?"#fff":"#64748b",
                      fontWeight:"700", fontSize:"0.78rem", cursor:"pointer",
                      display:"flex", alignItems:"center", gap:"0.3rem" }}>
                    {cl.emoji} {cl.label}
                    <span style={{ background:activo?"rgba(255,255,255,0.25)":"#e2e8f0",
                      color:activo?"#fff":"#64748b",
                      borderRadius:"20px", padding:"0 5px", fontSize:"0.68rem", fontWeight:"800" }}>
                      {countCl}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div style={{ display: "flex", gap: "0.5rem" }}>
              {(tabActiva === "cargos" || tabActiva === "cuadrillas" || tabActiva === "novedades") && itemsActuales.length === 0 && (
                <button onClick={() => poblarIniciales(tabActiva)} style={{
                  background: "#f0fdf4", border: "1.5px solid #10b981",
                  borderRadius: "8px", padding: "0.5rem 0.9rem",
                  color: "#059669", cursor: "pointer",
                  fontSize: "0.82rem", fontWeight: "700",
                  display: "flex", alignItems: "center", gap: "0.4rem",
                }}>
                  ✨ Cargar valores predefinidos
                </button>
              )}
              {/* Botón siempre visible para novedades: permite repoblar aunque ya existan datos viejos */}
              {tabActiva === "novedades" && itemsActuales.length > 0 && (
                <button onClick={() => poblarIniciales("novedades")} style={{
                  background: "#fffbeb", border: "1.5px solid #f59e0b",
                  borderRadius: "8px", padding: "0.5rem 0.9rem",
                  color: "#b45309", cursor: "pointer",
                  fontSize: "0.82rem", fontWeight: "700",
                  display: "flex", alignItems: "center", gap: "0.4rem",
                }}>
                  🔄 Repoblar catálogo completo
                </button>
              )}
              <button onClick={iniciarAgregar} disabled={agregando} style={{
                background: PRIMARY, border: "none", borderRadius: "8px",
                padding: "0.5rem 1rem", color: "#fff", cursor: "pointer",
                fontWeight: "700", fontSize: "0.88rem",
                display: "flex", alignItems: "center", gap: "0.4rem",
                opacity: agregando ? 0.5 : 1,
              }}>
                <Plus size={15} /> Nuevo
              </button>
            </div>
          </div>

          {/* Tabla — oculta en pestaña Clientes (usa cards propias) */}
          <div style={{ overflowX: "auto", display: esCliente ? "none" : "block" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
            <th style={thStyle}>#</th>
            {esNovedad && <th style={{ ...thStyle, width: "50px", textAlign:"center" }}>Vista</th>}
            {esNovedad && <th style={thStyle}>Código</th>}
            <th style={thStyle}>{esObs ? "Texto de observación" : esNovedad ? "Nombre" : "Nombre / Cargo"}</th>
            {esCargo  && <th style={{ ...thStyle, textAlign: "right" }}>💰 Básico Mensual</th>}
            {esCargo  && <th style={{ ...thStyle, textAlign: "center" }}>Cliente</th>}
              {esCuad   && <th style={thStyle}>Descripción</th>}
                {esNovedad && <th style={{ ...thStyle, textAlign:"center" }}>Emoji</th>}
                {esNovedad && <th style={{ ...thStyle, textAlign:"center" }}>Color</th>}
              {esNovedad && <th style={{ ...thStyle, textAlign:"center" }}>Fondo</th>}
              {esNovedad && <th style={thStyle}>Paga</th>}
              {esNovedad && <th style={{ ...thStyle, textAlign:"center" }}>%</th>}
              {esNovedad && <th style={{ ...thStyle, minWidth:"200px" }}>Info legal</th>}
              <th style={{ ...thStyle, width: "100px" }}>Acciones</th>
            </tr>
            </thead>
            <tbody>
            {/* Fila de nuevo item */}
            {agregando && (
            <tr style={{ background: "#f0f9ff", borderBottom: "1px solid #bae6fd" }}>
            <td style={tdStyle}><span style={{ color: "#94a3b8", fontSize: "0.8rem" }}>nuevo</span></td>
            {/* Columna cliente en fila nueva — solo cargos */}
            {esNovedad && (
            <td style={{ ...tdStyle, textAlign:"center", fontSize:"1.4rem" }}>
            <span style={{ background: formBg, borderRadius:"8px", padding:"4px 8px", border:`1px solid ${formColor}40` }}>
              {formEmoji || "📌"}
            </span>
            </td>
            )}
            {esNovedad && (
            <td style={tdStyle}>
            <input autoFocus value={formCodigo}
            onChange={e => setFormCodigo(e.target.value.toUpperCase())}
            onKeyDown={e => { if(e.key==="Enter")guardar(); if(e.key==="Escape")cancelar(); }}
            placeholder="D, INC, S..."
            style={{ ...inputInlineStyle, width:"90px", fontFamily:"monospace", fontWeight:"700" }}/>
            </td>
            )}
            <td style={tdStyle}>
            <input
                autoFocus={!esNovedad}
                value={formNombre}
              onChange={e => setFormNombre(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") guardar(); if (e.key === "Escape") cancelar(); }}
            placeholder={esObs ? "Texto de observación..." : esNovedad ? "Nombre de la novedad..." : "Nombre del cargo..."}
            style={inputInlineStyle}
            />
            </td>
            {esCargo && (
            <td style={tdStyle}>
              <input type="number" value={formBasico}
                  onChange={e => setFormBasico(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") guardar(); if (e.key === "Escape") cancelar(); }}
                placeholder="Ej: 1750905"
              style={{ ...inputInlineStyle, textAlign: "right", maxWidth: "180px" }}/>
            </td>
            )}
            {esCargo && (
            <td style={{ ...tdStyle, textAlign:"center" }}>
              <select value={formClienteId} onChange={e=>setFormClienteId(e.target.value)}
                style={{ ...inputInlineStyle, width:"auto", fontSize:"0.78rem", padding:"0.3rem 0.5rem" }}>
                {CLIENTES_CARGOS.map(cl=>(
                  <option key={cl.id} value={cl.id}>{cl.emoji} {cl.label}</option>
                ))}
              </select>
            </td>
            )}
            {esCuad && (
            <td style={tdStyle}>
            <input value={formDesc}
                onChange={e => setFormDesc(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") guardar(); if (e.key === "Escape") cancelar(); }}
                    placeholder="Descripción opcional..."
                      style={inputInlineStyle}/>
                      </td>
                )}
                {esNovedad && (
                <td style={{ ...tdStyle, textAlign:"center" }}>
                <input value={formEmoji} onChange={e => setFormEmoji(e.target.value)}
                placeholder="📌" style={{ ...inputInlineStyle, width:"60px", textAlign:"center", fontSize:"1.2rem" }}/>
              </td>
              )}
                {esNovedad && (
                <td style={{ ...tdStyle, textAlign:"center" }}>
                <input type="color" value={formColor} onChange={e => setFormColor(e.target.value)}
                style={{ width:"36px", height:"32px", border:"none", borderRadius:"6px", cursor:"pointer", padding:0 }}/>
            </td>
            )}
            {esNovedad && (
            <td style={{ ...tdStyle, textAlign:"center" }}>
            <input type="color" value={formBg} onChange={e => setFormBg(e.target.value)}
                style={{ width:"36px", height:"32px", border:"none", borderRadius:"6px", cursor:"pointer", padding:0 }}/>
              </td>
              )}
                <td style={tdStyle}>
                <div style={{ display: "flex", gap: "0.35rem" }}>
                  <button onClick={guardar} disabled={guardando || !formNombre.trim()} style={btnGuardarStyle}><Check size={13}/></button>
                  <button onClick={cancelar} style={btnCancelarStyle}><X size={13}/></button>
              </div>
            </td>
            </tr>
            )}

            {/* Items existentes */}
            {cargando ? (
            <tr>
            <td colSpan={esNovedad ? 8 : esCargo ? 4 : esCuad ? 4 : 3} style={{ textAlign: "center", padding: "2rem", color: "#94a3b8" }}>Cargando...</td>
            </tr>
            ) : itemsActuales.length === 0 && !agregando ? (
            <tr>
            <td colSpan={esNovedad ? 8 : esCargo ? 4 : esCuad ? 4 : 3} style={{ textAlign: "center", padding: "2.5rem", color: "#94a3b8" }}>
            <div style={{ fontSize: "1.8rem", marginBottom: "0.5rem" }}>📋</div>
            <div>No hay {tabInfo?.label.toLowerCase()} registradas.</div>
            <div style={{ fontSize: "0.82rem", marginTop: "0.25rem" }}>Usa el botón "Cargar valores predefinidos" para poblar con los datos del sistema.</div>
            </td>
            </tr>
            ) : itemsActuales.map((item, i) => {
                  const enEdicion = editandoId === item.id;
            const texto = item.nombre || item.label || item.texto || "";
            return (
            <tr key={item.id}
            style={{ borderBottom: "1px solid #f1f5f9", background: enEdicion ? "#fffbeb" : "transparent", transition: "background 0.1s" }}
            onMouseEnter={e => { if (!enEdicion) e.currentTarget.style.background = "#f8fafc"; }}
            onMouseLeave={e => { if (!enEdicion) e.currentTarget.style.background = "transparent"; }}
            >
            <td style={{ ...tdStyle, color: "#94a3b8", fontSize: "0.8rem", width: "50px" }}>{i + 1}</td>

            {/* Vista previa novedad */}
            {esNovedad && (
            <td style={{ ...tdStyle, textAlign:"center" }}>
            <span style={{ fontSize:"1.3rem", background: enEdicion?formBg:item.bg,
            borderRadius:"8px", padding:"3px 8px",
            border:`1px solid ${enEdicion?formColor:item.color}40`, display:"inline-block" }}>
            {enEdicion ? (formEmoji||item.emoji) : item.emoji}
            </span>
            </td>
            )}

            {/* Código novedad */}
            {esNovedad && (
            <td style={tdStyle}>
            {enEdicion ? (
            <input autoFocus value={formCodigo}
            onChange={e => setFormCodigo(e.target.value.toUpperCase())}
            onKeyDown={e => { if(e.key==="Enter")guardar(); if(e.key==="Escape")cancelar(); }}
              style={{ ...inputInlineStyle, width:"90px", fontFamily:"monospace", fontWeight:"700" }}/>
            ) : (
                <span style={{ fontFamily:"monospace", fontWeight:"800", fontSize:"0.85rem",
                    background: item.bg, color: item.color,
                              borderRadius:"6px", padding:"2px 8px", border:`1px solid ${item.color}30` }}>
                    {item.codigo}
                  </span>
              )}
            </td>
            )}

            {/* Nombre */}
            <td style={tdStyle}>
            {enEdicion ? (
            <input
            autoFocus={!esNovedad}
              value={formNombre}
            onChange={e => setFormNombre(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") guardar(); if (e.key === "Escape") cancelar(); }}
                style={inputInlineStyle}
                />
                        ) : (
                <span style={{ fontWeight: "600", color: "#1e293b", fontSize: "0.9rem" }}>{texto}</span>
            )}
            </td>

            {/* Básico Mensual (solo cargos) */}
            {esCargo && (
            <td style={{ ...tdStyle, textAlign: "right" }}>
            {enEdicion ? (
            <input type="number" value={formBasico}
                onChange={e => setFormBasico(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") guardar(); if (e.key === "Escape") cancelar(); }}
                placeholder="Básico mensual..."
              style={{ ...inputInlineStyle, textAlign: "right", maxWidth: "180px" }}/>
            ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.5rem" }}>
              {item.basicoMensual ? (
              <span style={{ background: "#f0fdf4", color: "#059669", borderRadius: "6px", padding: "3px 8px", fontSize: "0.82rem", fontWeight: "700", fontFamily: "monospace" }}>
                  {formatCOP(item.basicoMensual)}
                </span>
            ) : (
              <span style={{ color: "#fbbf24", fontSize: "0.78rem", fontStyle: "italic" }}>⚠️ Sin sueldo definido</span>
              )}
            </div>
            )}
            </td>
            )}

            {/* Cliente (solo cargos) */}
            {esCargo && (
            <td style={{ ...tdStyle, textAlign:"center" }}>
            {enEdicion ? (
              <select value={formClienteId} onChange={e=>setFormClienteId(e.target.value)}
                style={{ ...inputInlineStyle, width:"auto", fontSize:"0.78rem", padding:"0.3rem 0.5rem" }}>
                {CLIENTES_CARGOS.map(cl=>(
                  <option key={cl.id} value={cl.id}>{cl.emoji} {cl.label}</option>
                ))}
              </select>
            ) : (
              <CargoClienteBadge clienteId={item.clienteId} />
            )}
            </td>
            )}

              {/* Descripción (solo cuadrillas) */}
                {esCuad && (
                    <td style={tdStyle}>
                        {enEdicion ? (
                            <input value={formDesc}
                              onChange={e => setFormDesc(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter") guardar(); if (e.key === "Escape") cancelar(); }}
                              placeholder="Descripción..."
                              style={inputInlineStyle}/>
                          ) : (
                            <span style={{ color: "#64748b", fontSize: "0.85rem" }}>{item.descripcion || "—"}</span>
                          )}
                        </td>
                      )}

                      {/* Emoji (solo novedades) */}
                      {esNovedad && (
                        <td style={{ ...tdStyle, textAlign:"center" }}>
                          {enEdicion ? (
                            <input value={formEmoji} onChange={e => setFormEmoji(e.target.value)}
                              style={{ ...inputInlineStyle, width:"60px", textAlign:"center", fontSize:"1.2rem" }}/>
                          ) : (
                            <span style={{ fontSize:"1.2rem" }}>{item.emoji}</span>
                          )}
                        </td>
                      )}

                      {/* Color (solo novedades) */}
                      {esNovedad && (
                        <td style={{ ...tdStyle, textAlign:"center" }}>
                          {enEdicion ? (
                            <input type="color" value={formColor} onChange={e => setFormColor(e.target.value)}
                              style={{ width:"36px", height:"32px", border:"none", borderRadius:"6px", cursor:"pointer", padding:0 }}/>
                          ) : (
                            <span style={{ display:"inline-block", width:"24px", height:"24px",
                              borderRadius:"50%", background:item.color,
                              boxShadow:`0 0 0 2px ${item.color}30` }}/>
                          )}
                        </td>
                      )}

                      {/* Fondo (solo novedades) */}
                      {esNovedad && (
                        <td style={{ ...tdStyle, textAlign:"center" }}>
                          {enEdicion ? (
                            <input type="color" value={formBg} onChange={e => setFormBg(e.target.value)}
                              style={{ width:"36px", height:"32px", border:"none", borderRadius:"6px", cursor:"pointer", padding:0 }}/>
                          ) : (
                            <span style={{ display:"inline-block", width:"24px", height:"24px",
                              borderRadius:"6px", background:item.bg,
                              border:`1px solid ${item.color}40` }}/>
                          )}
                        </td>
                      )}

                      {/* Paga */}
                      {esNovedad && (
                        <td style={tdStyle}>
                          {enEdicion ? (
                            <input value={formPaga} onChange={e=>setFormPaga(e.target.value)}
                              placeholder="EPS / ARL / Empleador..."
                              style={{ ...inputInlineStyle, minWidth:"120px" }}/>
                          ) : (
                            <span style={{ fontSize:"0.8rem", fontWeight:"700", color:"#475569" }}>
                              {item.paga || <span style={{color:"#cbd5e1"}}>—</span>}
                            </span>
                          )}
                        </td>
                      )}

                      {/* Porcentaje */}
                      {esNovedad && (
                        <td style={{ ...tdStyle, textAlign:"center" }}>
                          {enEdicion ? (
                            <input value={formPorcentaje} onChange={e=>setFormPorcentaje(e.target.value)}
                              placeholder="100%"
                              style={{ ...inputInlineStyle, width:"70px", textAlign:"center", fontFamily:"monospace", fontWeight:"700" }}/>
                          ) : (
                            item.porcentaje ? (
                              <span style={{
                                fontFamily:"monospace", fontWeight:"900", fontSize:"0.82rem",
                                background: item.porcentaje.startsWith("-") ? "#fee2e2" : "#f0fdf4",
                                color:      item.porcentaje.startsWith("-") ? "#dc2626" : "#059669",
                                borderRadius:"6px", padding:"2px 7px"
                              }}>{item.porcentaje}</span>
                            ) : <span style={{color:"#cbd5e1"}}>—</span>
                          )}
                        </td>
                      )}

                      {/* Info legal */}
                      {esNovedad && (
                        <td style={tdStyle}>
                          {enEdicion ? (
                            <input value={formInfo} onChange={e=>setFormInfo(e.target.value)}
                              placeholder="Descripción legal..."
                              style={{ ...inputInlineStyle, minWidth:"200px" }}/>
                          ) : (
                            <span style={{ fontSize:"0.75rem", color:"#64748b", lineHeight:1.4 }}>
                              {item.info || <span style={{color:"#e2e8f0"}}>sin descripción</span>}
                            </span>
                          )}
                        </td>
                      )}

                      <td style={tdStyle}>
                        {enEdicion ? (
                          <div style={{ display: "flex", gap: "0.35rem" }}>
                            <button onClick={guardar} disabled={guardando || !formNombre.trim()} style={btnGuardarStyle}><Check size={13}/></button>
                            <button onClick={cancelar} style={btnCancelarStyle}><X size={13}/></button>
                          </div>
                        ) : (
                          <div style={{ display: "flex", gap: "0.35rem" }}>
                            <button onClick={() => iniciarEditar(item)} style={{ background: "#f0f9ff", border: "none", borderRadius: "6px", padding: "0.3rem 0.45rem", cursor: "pointer", color: ACCENT }}><Edit2 size={13}/></button>
                            <button onClick={() => eliminar(item)} style={{ background: "#fff1f2", border: "none", borderRadius: "6px", padding: "0.3rem 0.45rem", cursor: "pointer", color: "#ef4444" }}><Trash2 size={13}/></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── RENDER ESPECIAL: CLIENTES ── */}
          {esCliente && (
            <div style={{ padding:"1.25rem" }}>
              {/* Fila nueva cliente */}
              {agregando && (
                <div style={{ background:"#f0f4ff", borderRadius:"14px", padding:"1.25rem", marginBottom:"1rem", border:"2px solid #a5b4fc" }}>
                  <div style={{ fontWeight:"800", color:"#4f46e5", marginBottom:"0.85rem", fontSize:"0.95rem" }}>➕ Nuevo Cliente</div>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:"0.75rem", marginBottom:"0.75rem" }}>
                    <div>
                      <label style={{ fontSize:"0.75rem", color:"#64748b", fontWeight:"700" }}>Nombre *</label>
                      <input autoFocus value={formNombre} onChange={e=>setFormNombre(e.target.value)}
                        placeholder="Ej: NUEVO CLIENTE"
                        style={{ width:"100%", border:"1.5px solid #a5b4fc", borderRadius:"8px", padding:"0.4rem 0.7rem", fontSize:"0.88rem", boxSizing:"border-box", marginTop:"3px" }}/>
                    </div>
                    <div>
                      <label style={{ fontSize:"0.75rem", color:"#64748b", fontWeight:"700" }}>ID Corto (slug) *</label>
                      <input value={formClienteDocId} onChange={e=>setFormClienteDocId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,"-"))}
                        placeholder="Ej: nuevo-cliente"
                        style={{ width:"100%", border:"1.5px solid #a5b4fc", borderRadius:"8px", padding:"0.4rem 0.7rem", fontSize:"0.88rem", fontFamily:"monospace", boxSizing:"border-box", marginTop:"3px" }}/>
                      <div style={{ fontSize:"0.68rem", color:"#94a3b8", marginTop:"2px" }}>Se usa para filtrar trabajadores. No se puede cambiar después.</div>
                    </div>
                    <div>
                      <label style={{ fontSize:"0.75rem", color:"#64748b", fontWeight:"700" }}>Emoji</label>
                      <input value={formEmoji} onChange={e=>setFormEmoji(e.target.value)}
                        placeholder="🏢" style={{ width:"100%", border:"1.5px solid #e2e8f0", borderRadius:"8px", padding:"0.4rem 0.7rem", fontSize:"1.1rem", textAlign:"center", boxSizing:"border-box", marginTop:"3px" }}/>
                    </div>
                    <div>
                      <label style={{ fontSize:"0.75rem", color:"#64748b", fontWeight:"700" }}>Color</label>
                      <input type="color" value={formColor} onChange={e=>setFormColor(e.target.value)}
                        style={{ display:"block", width:"100%", height:"36px", border:"1.5px solid #e2e8f0", borderRadius:"8px", cursor:"pointer", padding:"2px", marginTop:"3px" }}/>
                    </div>
                    <div>
                      <label style={{ fontSize:"0.75rem", color:"#64748b", fontWeight:"700" }}>Código Contable (DataX)</label>
                      <input value={formCodContable} onChange={e=>setFormCodContable(e.target.value.toUpperCase())}
                        placeholder="Ej: CC110206"
                        style={{ width:"100%", border:"1.5px solid #e2e8f0", borderRadius:"8px", padding:"0.4rem 0.7rem", fontSize:"0.88rem", fontFamily:"monospace", boxSizing:"border-box", marginTop:"3px" }}/>
                    </div>
                    <div style={{ gridColumn:"1/-1" }}>
                      <label style={{ fontSize:"0.75rem", color:"#64748b", fontWeight:"700" }}>Descripción</label>
                      <input value={formDesc} onChange={e=>setFormDesc(e.target.value)}
                        placeholder="Descripción del cliente..."
                        style={{ width:"100%", border:"1.5px solid #e2e8f0", borderRadius:"8px", padding:"0.4rem 0.7rem", fontSize:"0.88rem", boxSizing:"border-box", marginTop:"3px" }}/>
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:"0.5rem" }}>
                    <button onClick={guardar} disabled={guardando||!formNombre.trim()} style={{ background:"#4f46e5", border:"none", borderRadius:"8px", padding:"0.5rem 1.25rem", color:"#fff", fontWeight:"700", cursor:"pointer", opacity:guardando?0.6:1, display:"flex", alignItems:"center", gap:"0.4rem" }}><Check size={14}/> Guardar</button>
                    <button onClick={cancelar} style={{ background:"#f1f5f9", border:"none", borderRadius:"8px", padding:"0.5rem 1rem", color:"#64748b", fontWeight:"700", cursor:"pointer", display:"flex", alignItems:"center", gap:"0.4rem" }}><X size={14}/> Cancelar</button>
                  </div>
                </div>
              )}
              {/* Grid de tarjetas de clientes */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))", gap:"1rem" }}>
                {itemsActuales.map(c => {
                  const enEdicion = editandoId === c.id;
                  const count = clientesTrabCount[c.id] || 0;
                  return (
                    <div key={c.id} style={{ background:"#fff", borderRadius:"14px", padding:"1.25rem",
                      boxShadow:"0 2px 8px rgba(0,0,0,0.07)",
                      border:`2px solid ${enEdicion ? (c.color||"#6366f1") : "#f1f5f9"}`,
                      transition:"border-color 0.2s" }}>
                      {/* Header tarjeta */}
                      <div style={{ display:"flex", alignItems:"flex-start", gap:"0.85rem", marginBottom:enEdicion?"1rem":"0.75rem" }}>
                        <div style={{ width:"48px", height:"48px", borderRadius:"12px",
                          background:`${c.color||"#6366f1"}18`,
                          display:"flex", alignItems:"center", justifyContent:"center",
                          fontSize:"1.4rem", flexShrink:0 }}>
                          {enEdicion ? (formEmoji||c.emoji||"🏢") : (c.emoji||"🏢")}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          {enEdicion ? (
                            <input value={formNombre} onChange={e=>setFormNombre(e.target.value)}
                              autoFocus
                              style={{ width:"100%", fontSize:"1rem", fontWeight:"700", border:"1.5px solid #a5b4fc", borderRadius:"8px", padding:"0.4rem 0.7rem", boxSizing:"border-box" }}/>
                          ) : (
                            <div style={{ fontWeight:"800", fontSize:"1rem", color:c.color||"#4f46e5" }}>{c.nombre}</div>
                          )}
                          <div style={{ fontSize:"0.7rem", color:"#94a3b8", fontFamily:"monospace", marginTop:"2px" }}>ID: {c.id}</div>
                        </div>
                        <div style={{ display:"flex", gap:"0.35rem", flexShrink:0 }}>
                          {enEdicion ? (
                            <>
                              <button onClick={cancelar} style={{ background:"#f1f5f9", border:"none", borderRadius:"7px", padding:"0.35rem 0.5rem", cursor:"pointer" }}><X size={14} color="#64748b"/></button>
                              <button onClick={guardar} disabled={guardando} style={{ background:c.color||"#4f46e5", border:"none", borderRadius:"7px", padding:"0.35rem 0.7rem", color:"#fff", fontWeight:"700", fontSize:"0.8rem", cursor:"pointer", display:"flex", alignItems:"center", gap:"0.3rem" }}>
                                <Check size={13}/> {guardando?"...":"OK"}
                              </button>
                            </>
                          ) : (
                            <>
                              <button onClick={()=>iniciarEditar(c)} style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:"7px", padding:"0.35rem 0.5rem", cursor:"pointer" }}><Edit2 size={13} color="#64748b"/></button>
                              {c.id !== "spia" && <button onClick={()=>eliminar(c)} style={{ background:"#fff1f2", border:"none", borderRadius:"7px", padding:"0.35rem 0.5rem", cursor:"pointer" }}><Trash2 size={13} color="#ef4444"/></button>}
                            </>
                          )}
                        </div>
                      </div>
                      {/* Campos edición */}
                      {enEdicion && (
                        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.65rem", marginBottom:"0.75rem" }}>
                          <div>
                            <label style={{ fontSize:"0.72rem", color:"#64748b", fontWeight:"700" }}>Emoji</label>
                            <input value={formEmoji} onChange={e=>setFormEmoji(e.target.value)}
                              style={{ width:"100%", border:"1.5px solid #e2e8f0", borderRadius:"7px", padding:"0.35rem 0.6rem", fontSize:"1.1rem", textAlign:"center", boxSizing:"border-box", marginTop:"3px" }}/>
                          </div>
                          <div>
                            <label style={{ fontSize:"0.72rem", color:"#64748b", fontWeight:"700" }}>Color</label>
                            <input type="color" value={formColor} onChange={e=>setFormColor(e.target.value)}
                              style={{ display:"block", width:"100%", height:"34px", border:"1.5px solid #e2e8f0", borderRadius:"7px", cursor:"pointer", padding:"2px", marginTop:"3px" }}/>
                          </div>
                          <div style={{ gridColumn:"1/-1" }}>
                            <label style={{ fontSize:"0.72rem", color:"#64748b", fontWeight:"700" }}>Código Contable (DataX)</label>
                            <input value={formCodContable} onChange={e=>setFormCodContable(e.target.value.toUpperCase())}
                              placeholder="CC110206"
                              style={{ width:"100%", border:"1.5px solid #e2e8f0", borderRadius:"7px", padding:"0.35rem 0.6rem", fontSize:"0.84rem", fontFamily:"monospace", boxSizing:"border-box", marginTop:"3px" }}/>
                          </div>
                          <div style={{ gridColumn:"1/-1" }}>
                            <label style={{ fontSize:"0.72rem", color:"#64748b", fontWeight:"700" }}>Descripción</label>
                            <input value={formDesc} onChange={e=>setFormDesc(e.target.value)}
                              placeholder="Descripción..."
                              style={{ width:"100%", border:"1.5px solid #e2e8f0", borderRadius:"7px", padding:"0.35rem 0.6rem", fontSize:"0.84rem", boxSizing:"border-box", marginTop:"3px" }}/>
                          </div>
                        </div>
                      )}
                      {/* Info */}
                      {!enEdicion && c.descripcion && (
                        <div style={{ fontSize:"0.81rem", color:"#64748b", marginBottom:"0.75rem" }}>{c.descripcion}</div>
                      )}
                      {!enEdicion && c.codContable && (
                        <div style={{ marginBottom:"0.75rem" }}>
                          <span style={{ background:"#f5f3ff", color:"#7c3aed", borderRadius:"6px", padding:"2px 8px", fontSize:"0.73rem", fontWeight:"800", fontFamily:"monospace" }}>{c.codContable}</span>
                          <span style={{ fontSize:"0.7rem", color:"#94a3b8", marginLeft:"0.4rem" }}>DataX</span>
                        </div>
                      )}
                      {/* Stats */}
                      <div style={{ display:"flex", gap:"0.6rem" }}>
                        <div style={{ flex:1, background:`${c.color||"#6366f1"}12`, borderRadius:"8px", padding:"0.5rem 0.75rem", textAlign:"center" }}>
                          <div style={{ fontWeight:"900", fontSize:"1.2rem", color:c.color||"#4f46e5" }}>{count}</div>
                          <div style={{ fontSize:"0.7rem", color:"#64748b" }}>Trabajadores</div>
                        </div>
                        <div style={{ flex:1, background:"#f0f9ff", borderRadius:"8px", padding:"0.5rem 0.75rem", textAlign:"center", cursor:"pointer" }}
                          onClick={()=>router.push(`/nomina/trabajadores`)}
                          title="Ver trabajadores de este cliente">
                          <div style={{ fontSize:"0.75rem", fontWeight:"700", color:"#0ea5e9", lineHeight:1.3 }}>Ver en<br/>Trabajadores →</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {itemsActuales.length === 0 && (
                <div style={{ textAlign:"center", padding:"3rem", color:"#94a3b8" }}>Cargando clientes...</div>
              )}
            </div>
          )}

          {/* Footer */}
          <div style={{ padding: "0.75rem 1.25rem", borderTop: "1px solid #f1f5f9", color: "#94a3b8", fontSize: "0.78rem" }}>
            {esCargo
              ? "💡 Al editar el Básico Mensual de un cargo, se actualiza automáticamente en todos los trabajadores que tienen ese cargo asignado. Presiona Enter para guardar, Esc para cancelar."
              : "💡 Puedes editar directamente en la tabla. Presiona Enter para guardar, Esc para cancelar."}
          </div>
        </div>
      </div>
    </LayoutWithSidebar>
  );
}

const thStyle = {
  padding: "0.65rem 1rem", textAlign: "left",
  fontSize: "0.78rem", fontWeight: "700",
  color: "#64748b", whiteSpace: "nowrap",
};
const tdStyle = {
  padding: "0.7rem 1rem", verticalAlign: "middle",
};
const inputInlineStyle = {
  width: "100%", padding: "0.4rem 0.7rem",
  border: "1.5px solid #0B3D91", borderRadius: "6px",
  fontSize: "0.88rem", outline: "none", boxSizing: "border-box",
};
const btnGuardarStyle = {
  background: "#f0fdf4", border: "1.5px solid #10b981",
  borderRadius: "6px", padding: "0.3rem 0.45rem",
  cursor: "pointer", color: "#10b981",
};
const btnCancelarStyle = {
  background: "#fff1f2", border: "1.5px solid #fca5a5",
  borderRadius: "6px", padding: "0.3rem 0.45rem",
  cursor: "pointer", color: "#ef4444",
};
