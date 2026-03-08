// pages/nomina/trabajadores.js
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, orderBy, query, writeBatch
} from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";
import { getUserRoleByUid } from "@/utils/getUserRole";
import LayoutWithSidebar from "@/components/LayoutWithSidebar";
import { Users, Plus, Edit2, Trash2, Search, ArrowLeft, X, Save, Upload, FileSpreadsheet, AlertTriangle, CheckCircle, RefreshCw, Download } from "lucide-react";

const PRIMARY = "#0B3D91";
const ACCENT  = "#00AEEF";
const SUCCESS = "#10b981";
const DANGER  = "#ef4444";
const WARN    = "#f59e0b";

const CARGOS_DEFAULT     = ["ESTIBADOR","ASISTENTE DE OPERACIONES","AUXILIAR DE OPERACIONES"];
const CUADRILLAS_DEFAULT = ["1","2","3","4","5","6","ADM","ADM-OPE","CIAMSA","OM","AX"];

// Centros de costo del programa contable DataX
// Código → descripción interna (guardado completo en Firestore para que DataX lo lea exacto)
const CENTROS_COSTO = [
  { codigo:"CC110203", label:"CC110203 — CIAMSA"                   },
  { codigo:"CC110204", label:"CC110204 — SPIA ESTIBADORES"         },
  { codigo:"CC110205", label:"CC110205 — SPIA ADMON"               },
  { codigo:"CC110206", label:"CC110206 — SPIA OPERADORES EQUIP"    },
  { codigo:"CC110207", label:"CC110207 — SPIA ESTIBADOR - 1"       },
];
function centroCostoLabel(valor) {
  if (!valor) return "—";
  const cc = CENTROS_COSTO.find(c => valor.startsWith(c.codigo));
  return cc ? cc.label : valor;
}

/**
 * Detecta el formato BASE_DATOS_PERSONAL.xlsx:
 * Cols: CC | apellido | nombre | CENTRO UTILIDAD | CENTRO COSTO | SALARIO | CARGO
 * Retorna array de { cedula, basicoMensual, centroCostos, nombre, cargo } o null
 */
function detectarFormatoBD(raw) {
  if (!raw || raw.length < 2) return null;
  const header = raw[0].map(h => String(h || "").toUpperCase().trim());
  const ccIdx      = header.findIndex(h => h === "CC");
  const salIdx     = header.findIndex(h => h.includes("SALARIO"));
  const ccostoIdx  = header.findIndex(h => h.includes("CENTRO COSTO") || h.includes("CENTRO_COSTO"));
  const apellidoIdx= header.findIndex(h => h.includes("APELLIDO"));
  const nombreIdx  = header.findIndex(h => h === "NOMBRE");
  const cargoIdx   = header.findIndex(h => h === "CARGO");
  if (ccIdx === -1 || salIdx === -1) return null;
  const trabajadores = [];
  for (let i = 1; i < raw.length; i++) {
    const row = raw[i];
    const cedula = String(row[ccIdx] || "").trim();
    const salario = parseFloat(row[salIdx]) || 0;
    if (!cedula || !salario) continue;
    const centroCostos = ccostoIdx  >= 0 ? String(row[ccostoIdx]  || "").trim() : "";
    const apellido     = apellidoIdx >= 0 ? String(row[apellidoIdx]|| "").trim() : "";
    const nombre       = nombreIdx   >= 0 ? String(row[nombreIdx]  || "").trim() : "";
    const cargo        = cargoIdx    >= 0 ? String(row[cargoIdx]   || "").trim().toUpperCase() : "";
    trabajadores.push({ cedula, basicoMensual: salario, centroCostos, nombreCompleto: `${apellido} ${nombre}`.trim(), cargo });
  }
  return trabajadores.length > 5 ? { esBD: true, trabajadores } : null;
}

const CLIENTES_BASE = [
  { id:"spia",     nombre:"SPIA",     color:"#0B3D91", emoji:"🏭" },
  { id:"cliente1", nombre:"Cliente 1",color:"#10b981", emoji:"🏢" },
  { id:"cliente2", nombre:"Cliente 2",color:"#8b5cf6", emoji:"🏗️" },
  { id:"cliente3", nombre:"Cliente 3",color:"#f59e0b", emoji:"🏭" },
];

/* ── Mapeo flexible de columnas Excel → campos internos ── */
const COLUMNAS_MAP = {
  nombre:        ["nombre","name","trabajador","empleado","apellido","apellidos y nombres","nombres"],
  cedula:        ["cedula","cédula","cc","documento","nit","identificacion","identificación"],
  cargo:         ["cargo","posicion","posición","rol","puesto"],
  cuadrilla:     ["cuadrilla","grupo","team","equipo"],
  basicoMensual: ["basico","básico","salario","sueldo","salario base","basico mensual","básico mensual"],
};

function detectarColumna(header) {
  const h = header?.toString().toLowerCase().trim();
  for (const [campo, variantes] of Object.entries(COLUMNAS_MAP)) {
    if (variantes.some(v => h?.includes(v))) return campo;
  }
  return null;
}

/**
 * Detecta si el Excel tiene el formato LOGISPORT especial:
 * cols 0-3: nombre, cedula, cargo, cuadrilla
 * cols 6+: tabla cargo→salario embebida
 * Retorna { esLogisport, cargoSalario, trabajadores } o null
 */
function detectarFormatoLogisport(raw) {
  if (!raw || raw.length < 5) return null;
  const fila0 = raw[0] || [];
  // Verificar encabezados típicos del formato LOGISPORT
  const col0 = String(fila0[0] || "").toUpperCase();
  const col1 = String(fila0[1] || "").toUpperCase();
  const col2 = String(fila0[2] || "").toUpperCase();
  if (!col0.includes("TRABAJADOR") && !col0.includes("NOMBRE")) return null;
  if (!col1.includes("CED")) return null;
  if (!col2.includes("CARGO")) return null;

  // Buscar tabla cargo→salario en cols 6-8
  const cargoSalario = {};
  for (const row of raw) {
    const c6 = row[6]; const c7 = row[7];
    if (c6 && c7 && typeof c7 === "number" && c7 > 100000 && c7 < 10000000
        && typeof c6 === "string" && c6.trim() && !c6.toUpperCase().includes("TOTAL") && !c6.toUpperCase().includes("SALARIO")) {
      cargoSalario[c6.trim().toUpperCase()] = Math.round(c7);
    }
  }
  if (Object.keys(cargoSalario).length < 3) return null;

  // Extraer trabajadores (cols 0-3) con salario cruzado por cargo
  const trabajadores = [];
  for (let i = 1; i < raw.length; i++) {
    const row = raw[i];
    const nombre   = row[0];
    const cedula   = row[1];
    const cargo    = row[2];
    const cuadrilla = row[3];
    if (!nombre || !cedula || typeof cedula !== "number") continue;
    const cargoUp  = String(cargo || "").trim().toUpperCase();
    let salario    = cargoSalario[cargoUp] || 0;
    // fallback: si contiene ESTIBADOR
    if (!salario && cargoUp.includes("ESTIBADOR")) salario = cargoSalario["ESTIBADOR"] || 1750905;
    trabajadores.push({
      nombre:        String(nombre).trim().toUpperCase(),
      cedula:        String(Math.round(cedula)),
      cargo:         cargoUp,
      cuadrilla:     String(cuadrilla || "").trim(),
      basicoMensual: salario,
    });
  }
  return { esLogisport: true, cargoSalario, trabajadores };
}

export default function NominaTrabajadores() {
  const router = useRouter();
  const [rol,          setRol]          = useState(null);
  const [trabajadores, setTrabajadores] = useState([]);
  const [filtro,       setFiltro]       = useState("");
  const [loading,      setLoading]      = useState(true);
  const [listaCargos,      setListaCargos]      = useState(CARGOS_DEFAULT);
  const [listaCuadrillas,  setListaCuadrillas]  = useState(CUADRILLAS_DEFAULT);
  const [cargosMap,        setCargosMap]         = useState({}); // cargo.nombre → basicoMensual

  const [clientes,     setClientes]     = useState(CLIENTES_BASE);
  const [clienteFiltro,setClienteFiltro]= useState("todos");

  // Cuadrillas reales desde nomina_asistencia (fuente de verdad)
  const [cuadrillasAsistencia, setCuadrillasAsistencia] = useState([]);
  // Mapa inverso: workerId → nombre de cuadrilla
  const [workerCuadrillaMap,   setWorkerCuadrillaMap]   = useState({});

  /* Modal trabajador */
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando,     setEditando]     = useState(null);
  const [form,         setForm]         = useState({ nombre:"", cedula:"", cargo:"", cuadrilla:"", basicoMensual:"", clienteIds:["spia"], centroCostos:"" });
  const [mostrarInactivos, setMostrarInactivos] = useState(false);
  const [guardando,    setGuardando]    = useState(false);

  /* Modal importar Excel */
  const [modalExcel,      setModalExcel]      = useState(false);
  const [excelRows,       setExcelRows]       = useState([]);   // filas parseadas
  const [excelCols,       setExcelCols]       = useState({});   // { campo: indexColumna }
  const [excelHeaders,    setExcelHeaders]    = useState([]);
  const [eliminarAntes,   setEliminarAntes]   = useState(false);
  const [importando,      setImportando]      = useState(false);
  const [importResult,    setImportResult]    = useState(null); // { ok, errores }
  const [excelNombre,     setExcelNombre]     = useState("");
  const [importarClienteId, setImportarClienteId] = useState("spia"); // cliente destino
  const fileRef    = useRef(null);

  /* Modal actualizar salarios */
  const [modalSalarios,    setModalSalarios]    = useState(false);
  const [salariosResult,   setSalariosResult]   = useState(null);
  const [actualizandoSal,  setActualizandoSal]  = useState(false);
  const [salCargoMap,      setSalCargoMap]       = useState({});     // cargo → salario (formato viejo)
  const [salCedulaMap,     setSalCedulaMap]      = useState({});     // cedula → {basicoMensual,centroCostos,nombre,cargo}
  const [salFormatoBase,   setSalFormatoBase]   = useState(false);  // true = formato BASE_DATOS_PERSONAL
  const [salNombreArchivo, setSalNombreArchivo]  = useState("");
  const fileRefSal = useRef(null);

  /* ── Auth ── */
  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/login"); return; }
      const r = await getUserRoleByUid(user.uid);
      setRol(r);
      if (!["admin","admin_nomina","rrhh","nomina"].includes(r)) { router.push("/"); return; }
      await Promise.all([cargar(), cargarCatalogos(), cargarClientes(), cargarAsistenciaCuadrillas()]);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const cargar = async () => {
    const snap = await getDocs(query(collection(db, "nomina_trabajadores"), orderBy("nombre")));
    setTrabajadores(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const cargarClientes = async () => {
    try {
      const snap = await getDocs(collection(db, "nomina_clientes"));
      if (!snap.empty) {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const orden = ["spia","cliente1","cliente2","cliente3","admon"];
        data.sort((a,b) => {
          const ia = orden.indexOf(a.id); const ib = orden.indexOf(b.id);
          if (ia===-1 && ib===-1) return (a.nombre||'').localeCompare(b.nombre||'');
          if (ia===-1) return 1; if (ib===-1) return -1;
          return ia - ib;
        });
        // merge con CLIENTES_BASE para fallback de color/emoji + deduplicar por nombre
        const seenNombres = new Set();
        const merged = data
          .map(c => { const base = CLIENTES_BASE.find(b => b.id === c.id); return { color:"#6366f1", emoji:"🏢", ...base, ...c }; })
          .filter(c => {
            const key = (c.nombre||'').toUpperCase().trim();
            if (seenNombres.has(key)) return false;
            seenNombres.add(key);
            return true;
          });
        setClientes(merged.filter(c => c.id !== "admon").length > 0 ? merged.filter(c => c.id !== "admon") : CLIENTES_BASE);
      }
    } catch {}
  };

  const cargarCatalogos = async () => {
    try {
      const cSnap = await getDocs(query(collection(db, "nomina_cargos"), orderBy("nombre")));
      if (!cSnap.empty) {
        setListaCargos(cSnap.docs.map(d => d.data().nombre));
        const mapa = {};
        cSnap.docs.forEach(d => {
          const nombre = String(d.data().nombre || "").trim().toUpperCase();
          if (nombre && d.data().basicoMensual) mapa[nombre] = d.data().basicoMensual;
        });
        setCargosMap(mapa);
      }
    } catch {}
  };

  // Carga cuadrillas desde nomina_asistencia y construye mapa workerId → cuadrilla
  const cargarAsistenciaCuadrillas = async () => {
    try {
      const snap = await getDocs(collection(db, "nomina_asistencia"));
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      lista.sort((a, b) => (a.orden || 99) - (b.orden || 99));
      setCuadrillasAsistencia(lista);
      // Construir mapa inverso: workerId → nombre cuadrilla
      const mapa = {};
      lista.forEach(c => {
        (c.miembros || []).forEach(m => {
          mapa[m.id] = c.nombre;
        });
      });
      setWorkerCuadrillaMap(mapa);
    } catch (e) {
      console.error("Error cargando cuadrillas de asistencia:", e);
    }
  };

  /* ── CRUD individual ── */
  const abrirNuevo = () => {
    setEditando(null);
    setForm({ nombre:"", cedula:"", cargo:"ESTIBADOR", cuadrilla:"1", basicoMensual:"1750905", clienteIds:["spia"], centroCostos:"" });
    setModalAbierto(true);
  };
  const abrirEditar = (t) => {
    setEditando(t);
    const cuadrillaReal = workerCuadrillaMap[t.id] || "";
    setForm({ nombre: t.nombre||"", cedula: t.cedula||"", cargo: t.cargo||"", cuadrilla: cuadrillaReal, basicoMensual: t.basicoMensual||"", clienteIds: t.clienteIds || ["spia"], centroCostos: t.centroCostos||"" });
    setModalAbierto(true);
  };
  const guardar = async () => {
    if (!form.nombre.trim() || !form.cedula.trim()) return;
    setGuardando(true);
    const data = {
      nombre:        form.nombre.trim().toUpperCase(),
      cedula:        form.cedula.trim(),
      cargo:         form.cargo.trim().toUpperCase(),
      basicoMensual: parseFloat(form.basicoMensual) || 0,
      clienteIds:    Array.isArray(form.clienteIds) && form.clienteIds.length > 0 ? form.clienteIds : ["spia"],
      centroCostos:  form.centroCostos?.trim() || "",
      activo:        true,
      actualizadoEn: new Date(),
    };
    try {
      let workerId;
      if (editando) {
        await updateDoc(doc(db, "nomina_trabajadores", editando.id), data);
        workerId = editando.id;
      } else {
        const ref = await addDoc(collection(db, "nomina_trabajadores"), { ...data, creadoEn: new Date() });
        workerId = ref.id;
      }

      // ── Sincronizar cuadrilla en nomina_asistencia ──────────────────────
      const cuadrillaAnterior = workerCuadrillaMap[workerId] || "";
      const cuadrillaNueva    = form.cuadrilla.trim();

      if (cuadrillaAnterior !== cuadrillaNueva) {
        // Quitar de la cuadrilla anterior
        if (cuadrillaAnterior) {
          const cuadDoc = cuadrillasAsistencia.find(c => c.nombre === cuadrillaAnterior);
          if (cuadDoc) {
            const miembrosActualizados = (cuadDoc.miembros || []).filter(m => m.id !== workerId);
            await updateDoc(doc(db, "nomina_asistencia", cuadDoc.id), {
              miembros:      miembrosActualizados,
              totalPersonas: miembrosActualizados.length,
              actualizadoEn: new Date(),
            });
          }
        }
        // Agregar a la nueva cuadrilla
        if (cuadrillaNueva) {
          const cuadDoc = cuadrillasAsistencia.find(c => c.nombre === cuadrillaNueva);
          if (cuadDoc) {
            const sinDuplicado = (cuadDoc.miembros || []).filter(m => m.id !== workerId);
            const miembrosActualizados = [
              ...sinDuplicado,
              { id: workerId, nombre: data.nombre, cedula: data.cedula },
            ];
            await updateDoc(doc(db, "nomina_asistencia", cuadDoc.id), {
              miembros:      miembrosActualizados,
              totalPersonas: miembrosActualizados.length,
              actualizadoEn: new Date(),
            });
          }
        }
        // Recargar mapa de cuadrillas para reflejar el cambio
        await cargarAsistenciaCuadrillas();
      }
      // ───────────────────────────────────────────────────────────────────

      await cargar();
      setModalAbierto(false);
    } catch (e) { alert("Error: " + e.message); }
    setGuardando(false);
  };
  const eliminar = async (t) => {
    if (!confirm(`¿Eliminar a ${t.nombre}?`)) return;
    await deleteDoc(doc(db, "nomina_trabajadores", t.id));
    await cargar();
  };

  /* ── Toggle activo/inactivo de un trabajador ── */
  const toggleActivo = async (t) => {
    const nuevoEstado = t.activo === false ? true : false;
    try {
      await updateDoc(doc(db, "nomina_trabajadores", t.id), {
        activo: nuevoEstado,
        actualizadoEn: new Date(),
      });
      await cargar();
    } catch (e) {
      alert("Error al cambiar estado: " + e.message);
    }
  };

  /* ── Leer Excel ── */
  const [formatoLogisport, setFormatoLogisport] = useState(null); // { cargoSalario, ... }

  const leerExcel = async (file) => {
    setExcelNombre(file.name);
    setImportResult(null);
    setFormatoLogisport(null);
    const XLSX = await import("xlsx");
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type:"array" });

    // Buscar hoja TRABAJADORES primero (formato LOGISPORT), si no existe usar la primera
    const sheetName = wb.SheetNames.find(n => n.toUpperCase().includes("TRABAJADOR")) || wb.SheetNames[0];
    const ws  = wb.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_json(ws, { header:1, defval:"" });
    if (raw.length < 2) { alert("El archivo no tiene datos."); return; }

    // ╔ DETECTAR FORMATO LOGISPORT ═
    const logisport = detectarFormatoLogisport(raw);
    if (logisport) {
      setFormatoLogisport(logisport);
      setExcelRows(logisport.trabajadores);
      setExcelHeaders(["TRABAJADOR", "CÉDULA", "CARGO", "CUADRILLA", "BÁSICO MENSUAL"]);
      setExcelCols({ nombre:0, cedula:1, cargo:2, cuadrilla:3, basicoMensual:4 });
      setModalExcel(true);
      return;
    }

    // ╔ FORMATO ESTÁNDAR ═
    const headers = raw[0].map(h => h?.toString() || "");
    setExcelHeaders(headers);
    const cols = {};
    headers.forEach((h, i) => {
      const campo = detectarColumna(h);
      if (campo && !(campo in cols)) cols[campo] = i;
    });
    setExcelCols(cols);
    const rows = raw.slice(1).filter(r => r.some(c => c !== "")).map(r => ({
      nombre:        r[cols.nombre]        ?? "",
      cedula:        r[cols.cedula]        ?? "",
      cargo:         r[cols.cargo]         ?? "",
      cuadrilla:     r[cols.cuadrilla]     ?? "",
      basicoMensual: r[cols.basicoMensual] ?? "",
    }));
    setExcelRows(rows);
    setModalExcel(true);
  };

  /* ── Descargar plantilla Excel ── */
  const descargarPlantilla = async () => {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const datos = [
      ["NOMBRE", "CEDULA", "CARGO", "SALARIO"],
      ["GARCIA LOPEZ JUAN", "1000000001", "ESTIBADOR", 1750905],
      ["MARTINEZ RUIZ PEDRO", "1000000002", "TARJADOR", 1750905],
      ["LOPEZ CASTRO MARIA", "1000000003", "AUXILIAR DE OPERACIONES", 1787405],
    ];
    const ws = XLSX.utils.aoa_to_sheet(datos);
    ws['!cols'] = [{wch:35},{wch:14},{wch:28},{wch:14}];
    XLSX.utils.book_append_sheet(wb, ws, "Trabajadores");
    XLSX.writeFile(wb, "plantilla_trabajadores.xlsx");
  };

  /* ── Importar a Firestore ── */
  const importar = async () => {
    setImportando(true);
    const clienteDestino = importarClienteId || "spia";
    try {
      // 0. Si es formato LOGISPORT, actualizar también nomina_cargos
      if (formatoLogisport?.cargoSalario) {
        const cargosSnap = await getDocs(collection(db, "nomina_cargos"));
        const cargosBatch = writeBatch(db);
        cargosSnap.docs.forEach(d => cargosBatch.delete(d.ref));
        for (const [nombre, basicoMensual] of Object.entries(formatoLogisport.cargoSalario)) {
          const ref = doc(collection(db, "nomina_cargos"));
          cargosBatch.set(ref, { nombre, basicoMensual, actualizadoEn: new Date() });
        }
        await cargosBatch.commit();
      }

      // 1. Si se pidió eliminar, solo eliminar los del cliente destino
      if (eliminarAntes) {
        const snap = await getDocs(collection(db, "nomina_trabajadores"));
        const batchDel = writeBatch(db);
        snap.docs.forEach(d => {
          const ids = d.data().clienteIds || ["spia"];
          if (ids.includes(clienteDestino)) batchDel.delete(d.ref);
        });
        await batchDel.commit();
      }

      // 2. Cargar cédulas existentes para detectar duplicados
      const existSnap = await getDocs(collection(db, "nomina_trabajadores"));
      const existMap = new Map(); // cedula → { id, clienteIds }
      existSnap.docs.forEach(d => {
        const ced = String(d.data().cedula || "").trim();
        if (ced) existMap.set(ced, { id: d.id, clienteIds: d.data().clienteIds || ["spia"] });
      });

      // 3. Importar trabajadores en lotes de 400
      let ok = 0; let actualizados = 0; const errores = [];
      let batch = writeBatch(db);
      let count = 0;
      for (const row of excelRows) {
        const nombre = row.nombre?.toString().trim().toUpperCase();
        const cedula = row.cedula?.toString().trim();
        if (!nombre || !cedula) { errores.push(`Fila sin nombre/cédula`); continue; }
        const existing = existMap.get(cedula);
        if (existing) {
          // Ya existe — agregar el cliente a su lista si no está
          const newIds = Array.from(new Set([...existing.clienteIds, clienteDestino]));
          batch.update(doc(db, "nomina_trabajadores", existing.id), {
            clienteIds:    newIds,
            activo:        true,
            actualizadoEn: new Date(),
          });
          actualizados++;
        } else {
          // Nuevo trabajador
          const ref = doc(collection(db, "nomina_trabajadores"));
          batch.set(ref, {
            nombre,
            cedula,
            cargo:         row.cargo?.toString().trim().toUpperCase() || "",
            basicoMensual: parseFloat(row.basicoMensual) || 0,
            clienteIds:    [clienteDestino],
            centroCostos:  row.centroCostos?.toString().trim() || "",
            activo:        true,
            creadoEn:      new Date(),
            actualizadoEn: new Date(),
          });
          ok++;
        }
        count++;
        if (count === 400) { await batch.commit(); batch = writeBatch(db); count = 0; }
      }
      if (count > 0) await batch.commit();

      await cargar();
      setImportResult({ ok, actualizados, errores, cargosActualizados: formatoLogisport ? Object.keys(formatoLogisport.cargoSalario).length : 0, clienteNombre: clientes.find(c=>c.id===clienteDestino)?.nombre || clienteDestino });
    } catch (e) {
      alert("Error al importar: " + e.message);
    }
    setImportando(false);
  };

  /* ── Leer Excel solo para salarios ── */
  /* Soporta DOS formatos:
     1) Formato LOGISPORT  (tabla cargo→salario en cols G/H)
     2) Formato BASE_DATOS_PERSONAL v2:
        Fila 1: header fusionado "centro de costos"
        Fila 2: CC | apellido | nombre | CENTRO UTILIDAD | ciamsa3 | admon | spia | SALARIO | CARGO | sw
        Datos desde fila 3. Centro de costo en cols 4,5 ó 6 (solo una tiene valor por trabajador)
  */
  const leerExcelSalarios = async (file) => {
    setSalNombreArchivo(file.name);
    setSalariosResult(null);
    setSalFormatoBase(false);
    setSalCedulaMap({});
    setSalCargoMap({});
    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const sheetName = wb.SheetNames.find(n => n.toUpperCase().includes("EMPLEADO") || n.toUpperCase().includes("PERSONAL") || n.toUpperCase().includes("TRABAJADOR") || n.toUpperCase().includes("DATOS")) || wb.SheetNames[0];
      const ws  = wb.Sheets[sheetName];
      const raw = XLSX.utils.sheet_to_json(ws, { header:1, defval:"" });

      // ── DETECTAR FORMATO BASE_DATOS_PERSONAL v2 ──
      // La fila de encabezados REALES puede estar en raw[0] o raw[1]
      // (raw[0] puede ser una fila de título fusionado "centro de costos")
      // Buscamos la fila que tenga CC en col0 y APELLIDO en col1
      let headerRowIdx = -1;
      for (let i = 0; i < Math.min(raw.length, 3); i++) {
        const h = raw[i];
        if (String(h[0]||"" ).toUpperCase().trim() === "CC" &&
            String(h[1]||"" ).toUpperCase().includes("APELLIDO")) {
          headerRowIdx = i;
          break;
        }
      }

      if (headerRowIdx >= 0) {
        const hRow = raw[headerRowIdx].map(h => String(h||"" ).toUpperCase().trim());
        // Índices de columnas
        const ccIdx    = hRow.findIndex(h => h === "CC");
        const apellIdx = hRow.findIndex(h => h.includes("APELLIDO"));
        const nomIdx   = hRow.findIndex(h => h === "NOMBRE");
        const salIdx   = hRow.findIndex(h => h.includes("SALARIO"));
        const cargoIdx = hRow.findIndex(h => h === "CARGO");
        // Centro de costo en cols 4, 5, 6 (ciamsa3 | admon | spia)
        // Tomamos el que tenga valor
        const ccostoIdxList = [4, 5, 6];

        const cedulaMap = {};
        for (let i = headerRowIdx + 1; i < raw.length; i++) {
          const row = raw[i];
          const cedula  = String(row[ccIdx]    || "").trim();
          const apell   = String(row[apellIdx] || "").trim().toUpperCase();
          const nomb    = String(row[nomIdx]   || "").trim().toUpperCase();
          const salario = parseFloat(row[salIdx]) || 0;
          const cargo   = cargoIdx >= 0 ? String(row[cargoIdx] || "").trim().toUpperCase() : "";
          if (!cedula || !salario) continue;
          // Centro de costo: tomar la primera columna (4, 5, 6) que tenga valor
          let centroCostos = "";
          for (const ci of ccostoIdxList) {
            const val = String(row[ci] || "").trim();
            if (val) { centroCostos = val; break; }
          }
          const nombreCompleto = apell && nomb ? `${apell} ${nomb}` : (apell || nomb);
          cedulaMap[cedula] = { basicoMensual: salario, centroCostos, nombre: nombreCompleto, cargo };
        }
        if (Object.keys(cedulaMap).length === 0) {
          alert("El archivo no tiene filas válidas (cédula + salario requeridos).");
          if (fileRefSal.current) fileRefSal.current.value = "";
          return;
        }
        setSalCedulaMap(cedulaMap);
        setSalFormatoBase(true);
        setModalSalarios(true);
        if (fileRefSal.current) fileRefSal.current.value = "";
        return;
      }

      // ── FORMATO LOGISPORT (tabla cargo→salario) ──
      const logisport = detectarFormatoLogisport(raw);
      if (logisport && Object.keys(logisport.cargoSalario).length > 0) {
        setSalCargoMap(logisport.cargoSalario);
        setSalFormatoBase(false);
        setModalSalarios(true);
      } else {
        alert("Formato no reconocido.\nUsa el archivo BASE_DATOS_PERSONAL (CC|apellido|nombre|CentroUtilidad|CentroCosto|Salario|Cargo) o el formato LOGISPORT.");
      }
    } catch (e) {
      alert("Error al leer el Excel: " + e.message);
    }
    if (fileRefSal.current) fileRefSal.current.value = "";
  };

  /* ── Aplicar actualización de salarios ── */
  const aplicarActualizacionSalarios = async () => {
    setActualizandoSal(true);
    setSalariosResult(null);
    try {
      const trabSnap = await getDocs(collection(db, "nomina_trabajadores"));

      // ══ FORMATO BASE_DATOS_PERSONAL ══
      // Cédula → {basicoMensual, centroCostos, cargo} — también marca inactivos
      if (salFormatoBase) {
        let actualizados = 0; let inactivados = 0; let sinEncontrar = 0;
        let batch = writeBatch(db); let count = 0;
        for (const d of trabSnap.docs) {
          const cedula = String(d.data().cedula || "").trim();
          const entrada = salCedulaMap[cedula];
          if (entrada) {
            batch.update(d.ref, {
              basicoMensual: entrada.basicoMensual,
              centroCostos:  entrada.centroCostos,
              activo:        true,
              actualizadoEn: new Date(),
            });
            actualizados++;
          } else {
            // No aparece en el archivo → marcar inactivo
            batch.update(d.ref, { activo: false, actualizadoEn: new Date() });
            inactivados++;
          }
          count++;
          if (count === 400) { await batch.commit(); batch = writeBatch(db); count = 0; }
        }
        if (count > 0) await batch.commit();
        await cargar();
        setSalariosResult({ actualizados, inactivados, sinEncontrar, modo: "base" });
        return;
      }

      // ══ FORMATO LOGISPORT (por cargo) ══
      // 1. Actualizar nomina_cargos
      const cargosSnap = await getDocs(collection(db, "nomina_cargos"));
      const batchCargos = writeBatch(db);
      cargosSnap.docs.forEach(d => batchCargos.delete(d.ref));
      for (const [nombre, basicoMensual] of Object.entries(salCargoMap)) {
        const ref = doc(collection(db, "nomina_cargos"));
        batchCargos.set(ref, { nombre, basicoMensual, actualizadoEn: new Date() });
      }
      await batchCargos.commit();

      // 2. Actualizar basicoMensual de cada trabajador por cargo
      let actualizados = 0; let sinCargo = 0;
      let batch = writeBatch(db); let count = 0;
      for (const d of trabSnap.docs) {
        const cargo = String(d.data().cargo || "").trim().toUpperCase();
        const nuevoSalario = salCargoMap[cargo];
        if (nuevoSalario) {
          batch.update(d.ref, { basicoMensual: nuevoSalario, actualizadoEn: new Date() });
          actualizados++; count++;
          if (count === 400) { await batch.commit(); batch = writeBatch(db); count = 0; }
        } else {
          sinCargo++;
        }
      }
      if (count > 0) await batch.commit();
      await cargar();
      setSalariosResult({ actualizados, sinCargo, cargos: Object.keys(salCargoMap).length, modo: "logisport" });
    } catch (e) {
      alert("Error al actualizar: " + e.message);
    }
    setActualizandoSal(false);
  };

  const cerrarModalSalarios = () => {
    setModalSalarios(false);
    setSalariosResult(null);
    setSalCargoMap({});
    setSalNombreArchivo("");
  };

  /* ── Eliminar TODOS los trabajadores + limpiar cuadrillas ── */
  const eliminarTodosTrabajadores = async () => {
    if (trabajadores.length === 0) { alert("No hay trabajadores para eliminar."); return; }

    // Primera advertencia
    const ok1 = confirm(
      `⚠️ ADVERTENCIA — ACCIÓN IRREVERSIBLE\n\n` +
      `Estás a punto de eliminar los ${trabajadores.length} trabajadores de la base de datos.\n\n` +
      `Esta acción también limpiará los miembros de todas las cuadrillas (nomina_asistencia) ` +
      `para evitar IDs huérfanos al importar de nuevo.\n\n` +
      `¿Deseas continuar?`
    );
    if (!ok1) return;

    // Segunda confirmación — escribe el número exacto
    const confirmacion = window.prompt(
      `🔴 CONFIRMACIÓN FINAL\n\n` +
      `Para confirmar, escribe el número exacto de trabajadores a eliminar:\n\n` +
      `→ Escribe: ${trabajadores.length}`
    );
    if (String(confirmacion).trim() !== String(trabajadores.length)) {
      alert("Cancelado. El número no coincide.");
      return;
    }

    setLoading(true);
    try {
      // 1. Eliminar todos los trabajadores en batches de 400
      const trabSnap = await getDocs(collection(db, "nomina_trabajadores"));
      let batch = writeBatch(db);
      let count = 0;
      for (const d of trabSnap.docs) {
        batch.delete(d.ref);
        count++;
        if (count === 400) { await batch.commit(); batch = writeBatch(db); count = 0; }
      }
      if (count > 0) await batch.commit();

      // 2. Limpiar miembros de todas las cuadrillas en nomina_asistencia
      const cuadSnap = await getDocs(collection(db, "nomina_asistencia"));
      if (!cuadSnap.empty) {
        const batchCuad = writeBatch(db);
        cuadSnap.docs.forEach(d => {
          batchCuad.update(d.ref, {
            miembros:      [],
            totalPersonas: 0,
            actualizadoEn: new Date(),
          });
        });
        await batchCuad.commit();
      }

      // 3. Refrescar estado local
      setTrabajadores([]);
      setWorkerCuadrillaMap({});
      await cargarAsistenciaCuadrillas();
      alert(`✅ ${trabSnap.size} trabajadores eliminados.\n✅ ${cuadSnap.size} cuadrillas limpiadas.\n\nYa puedes importar desde Excel sin traumatismos.`);
    } catch (e) {
      alert("Error al eliminar: " + e.message);
    }
    setLoading(false);
  };

  /* ── Exportar trabajadores a Excel ── */
  const exportarExcel = async () => {
    if (filtrados.length === 0) { alert("No hay trabajadores para exportar."); return; }
    try {
      const XLSX = await import("xlsx");
      const wb   = XLSX.utils.book_new();

      // Nombre del cliente activo para el título
      const clienteLabel = clienteFiltro === "todos"
        ? "Todos los clientes"
        : (clientes.find(c => c.id === clienteFiltro)?.nombre || clienteFiltro);

      const rows = [];
      // Fila título
      rows.push([`LISTADO DE TRABAJADORES — ${clienteLabel}`, "", "", "", "", "", ""]);
      rows.push([`Generado: ${new Date().toLocaleString("es-CO")}   |   LOGISPORT S.A.S.`, "", "", "", "", "", ""]);
      rows.push([]);
      // Encabezados
      rows.push(["#", "NOMBRE", "CÉDULA", "CARGO", "CUADRILLA", "BÁSICO MENSUAL", "CLIENTES"]);

      filtrados.forEach((t, i) => {
        const cargoKey     = String(t.cargo || "").trim().toUpperCase();
        const basico       = cargosMap[cargoKey] || t.basicoMensual || 0;
        const cuadrilla    = workerCuadrillaMap[t.id] || "";
        const clientesNom  = (t.clienteIds || ["spia"])
          .map(id => clientes.find(c => c.id === id)?.nombre || id)
          .join(" / ");
        rows.push([
          i + 1,
          t.nombre || "",
          String(t.cedula || ""),
          t.cargo  || "",
          cuadrilla ? `Cuadrilla ${cuadrilla}` : "",
          basico || 0,
          clientesNom,
        ]);
      });

      // Fila total
      rows.push(["", `TOTAL: ${filtrados.length} trabajadores`, "", "", "", "", ""]);

      const ws = XLSX.utils.aoa_to_sheet(rows);
      // Combinar celdas del título
      ws["!merges"] = [
        { s:{ r:0, c:0 }, e:{ r:0, c:6 } },
        { s:{ r:1, c:0 }, e:{ r:1, c:6 } },
      ];
      ws["!cols"] = [
        { wch:5 }, { wch:38 }, { wch:14 }, { wch:32 },
        { wch:14 }, { wch:16 }, { wch:25 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, "TRABAJADORES");

      // Nombre del archivo
      const fecha     = new Date().toISOString().split("T")[0];
      const sufijo    = clienteFiltro === "todos" ? "todos" : clienteFiltro;
      XLSX.writeFile(wb, `trabajadores_${sufijo}_${fecha}.xlsx`);
    } catch (err) {
      alert("Error exportando: " + err.message);
    }
  };

  const cerrarModalExcel = () => {
    setModalExcel(false);
    setExcelRows([]);
    setExcelHeaders([]);
    setExcelCols({});
    setEliminarAntes(false);
    setImportResult(null);
    setExcelNombre("");
    setFormatoLogisport(null);
    setImportarClienteId("spia");
    if (fileRef.current) fileRef.current.value = "";
  };

  const trabajadoresFiltradosCliente = clienteFiltro === "todos"
    ? trabajadores
    : trabajadores.filter(t => (t.clienteIds || ["spia"]).includes(clienteFiltro));

  const matchFiltro = (t) =>
    t.nombre?.toLowerCase().includes(filtro.toLowerCase()) ||
    t.cedula?.includes(filtro) ||
    t.cargo?.toLowerCase().includes(filtro.toLowerCase());

  // Separar activos e inactivos
  const filtradosActivos   = trabajadoresFiltradosCliente.filter(t => t.activo !== false).filter(matchFiltro);
  const filtradosInactivos = trabajadoresFiltradosCliente.filter(t => t.activo === false).filter(matchFiltro);
  const filtrados          = filtradosActivos; // alias para compatibilidad

  const totalInactivos = trabajadoresFiltradosCliente.filter(t => t.activo === false).length;

  const puedeEditar = ["admin","admin_nomina"].includes(rol);

  if (loading) return (
    <LayoutWithSidebar>
      <div style={{ textAlign:"center", padding:"4rem", color:PRIMARY }}>
        <div style={{ fontSize:"2rem" }}>👷 Cargando trabajadores...</div>
      </div>
    </LayoutWithSidebar>
  );

  return (
    <LayoutWithSidebar>
      <div style={{ maxWidth:"1400px", margin:"0 auto" }}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", gap:"1rem", marginBottom:"1.5rem", flexWrap:"wrap" }}>
          <button onClick={() => router.push("/nomina")}
            style={{ background:"none", border:"none", cursor:"pointer", color:PRIMARY }}>
            <ArrowLeft size={22}/>
          </button>
          <div style={{ flex:1 }}>
            <h1 style={{ margin:0, color:PRIMARY, fontSize:"1.6rem", fontWeight:"800" }}>👷 Trabajadores</h1>
            <p style={{ margin:0, color:"#64748b", fontSize:"0.9rem" }}>
              <span style={{color:SUCCESS,fontWeight:"700"}}>{filtradosActivos.length} activos</span>
              {totalInactivos > 0 && <span style={{color:DANGER,fontWeight:"700"}}> · {totalInactivos} inactivos</span>}
              <span> · {trabajadores.length} total en BD</span>
            </p>
          </div>
          <div style={{ display:"flex", gap:"0.75rem", flexWrap:"wrap" }}>
            {/* Exportar Excel — visible para todos los roles */}
            <button onClick={exportarExcel}
              style={{ background:"#f0fdf4", border:`1.5px solid ${SUCCESS}`, borderRadius:"10px", padding:"0.7rem 1.1rem", color:SUCCESS, cursor:"pointer", fontWeight:"700", fontSize:"0.9rem", display:"flex", alignItems:"center", gap:"0.5rem" }}>
              <Download size={18}/> Exportar Excel
            </button>
          {puedeEditar && (
            <>
                {/* Botón eliminar todos */}
              <button onClick={eliminarTodosTrabajadores}
                style={{ background:"#fff1f2", border:`1.5px solid ${DANGER}`, borderRadius:"10px", padding:"0.7rem 1.1rem", color:DANGER, cursor:"pointer", fontWeight:"700", fontSize:"0.9rem", display:"flex", alignItems:"center", gap:"0.5rem" }}>
                <Trash2 size={18}/> Eliminar todos
              </button>
              {/* Botón actualizar salarios desde Excel */}
              <label title="Sube el Excel de nómina LOGISPORT para actualizar solo los salarios (basicoMensual) por cargo" style={{ background:"#fffbeb", border:"1.5px solid #f59e0b", borderRadius:"10px", padding:"0.7rem 1.1rem", color:"#92400e", cursor:"pointer", fontWeight:"700", fontSize:"0.9rem", display:"flex", alignItems:"center", gap:"0.5rem" }}>
                💰 Actualizar Salarios
                <input ref={fileRefSal} type="file" accept=".xlsx,.xls" style={{ display:"none" }}
                  onChange={e => { if (e.target.files[0]) leerExcelSalarios(e.target.files[0]); }}/>
              </label>
              {/* Botón descargar plantilla */}
              <button onClick={descargarPlantilla}
                title="Descarga la plantilla Excel con el formato correcto para importar trabajadores"
                style={{ background:"#f5f3ff", border:"1.5px solid #8b5cf6", borderRadius:"10px", padding:"0.7rem 1.1rem", color:"#7c3aed", cursor:"pointer", fontWeight:"700", fontSize:"0.9rem", display:"flex", alignItems:"center", gap:"0.5rem" }}>
                <Download size={18}/> Plantilla
              </button>
              {/* Botón importar Excel completo */}
              <label style={{ background:"#f0fdf4", border:`1.5px solid ${SUCCESS}`, borderRadius:"10px", padding:"0.7rem 1.1rem", color:SUCCESS, cursor:"pointer", fontWeight:"700", fontSize:"0.9rem", display:"flex", alignItems:"center", gap:"0.5rem" }}>
                <FileSpreadsheet size={18}/> Importar Excel
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display:"none" }}
                  onChange={e => { if (e.target.files[0]) leerExcel(e.target.files[0]); }}/>
              </label>
              <button onClick={abrirNuevo}
                style={{ background:PRIMARY, border:"none", borderRadius:"10px", padding:"0.75rem 1.25rem", color:"#fff", cursor:"pointer", fontWeight:"700", display:"flex", alignItems:"center", gap:"0.5rem" }}>
                <Plus size={18}/> Nuevo Trabajador
              </button>
            </>
          )}
          </div>
        </div>

        {/* Selector de cliente */}
        <div style={{ display:"flex", gap:"0.5rem", marginBottom:"1rem", flexWrap:"wrap" }}>
          <button
            onClick={() => setClienteFiltro("todos")}
            style={{ padding:"0.45rem 1rem", borderRadius:"20px", border:"2px solid", borderColor: clienteFiltro==="todos"?PRIMARY:"#e2e8f0", background: clienteFiltro==="todos"?`${PRIMARY}15`:"#f8fafc", color: clienteFiltro==="todos"?PRIMARY:"#64748b", fontWeight: clienteFiltro==="todos"?"700":"500", cursor:"pointer", fontSize:"0.84rem" }}>
            🌐 Todos ({trabajadores.length})
          </button>
          {clientes.map(c => (
            <button key={c.id}
              onClick={() => setClienteFiltro(c.id)}
              style={{ padding:"0.45rem 1rem", borderRadius:"20px", border:"2px solid", borderColor: clienteFiltro===c.id?(c.color||PRIMARY):"#e2e8f0", background: clienteFiltro===c.id?`${c.color||PRIMARY}15`:"#f8fafc", color: clienteFiltro===c.id?(c.color||PRIMARY):"#64748b", fontWeight: clienteFiltro===c.id?"700":"500", cursor:"pointer", fontSize:"0.84rem", display:"flex", alignItems:"center", gap:"0.3rem" }}>
              {c.emoji||"🏭"} {c.nombre} ({trabajadores.filter(t=>(t.clienteIds||["spia"]).includes(c.id)).length})
            </button>
          ))}
        </div>

        {/* Buscador */}
        <div style={{ background:"#fff", borderRadius:"12px", padding:"1rem 1.25rem", marginBottom:"1.25rem", boxShadow:"0 2px 8px rgba(0,0,0,0.06)", display:"flex", alignItems:"center", gap:"0.75rem" }}>
          <Search size={18} color="#94a3b8"/>
          <input value={filtro} onChange={e => setFiltro(e.target.value)}
            placeholder="Buscar por nombre, cédula o cargo..."
            style={{ flex:1, border:"none", outline:"none", fontSize:"0.95rem", color:"#1e293b", background:"transparent" }}/>
          {filtro && <button onClick={() => setFiltro("")} style={{ background:"none", border:"none", cursor:"pointer" }}><X size={16} color="#94a3b8"/></button>}
        </div>

        {/* Info banner inactivos */}
        {totalInactivos > 0 && (
          <div style={{ marginBottom:"0.75rem", display:"flex", alignItems:"center", gap:"0.5rem", background:"#fef2f2", border:"1.5px solid #fca5a5", borderRadius:"10px", padding:"0.5rem 1rem" }}>
            <span style={{ fontSize:"1rem" }}>🔴</span>
            <span style={{ fontSize:"0.82rem", fontWeight:"700", color:DANGER }}>{totalInactivos} trabajadores inactivos</span>
            <span style={{ fontSize:"0.78rem", color:"#94a3b8", marginLeft:"0.25rem" }}>— No aparecen en liquidar nómina ni en la matriz</span>
          </div>
        )}

        {/* Tabla */}
        <div style={{ background:"#fff", borderRadius:"12px", boxShadow:"0 2px 8px rgba(0,0,0,0.06)", overflow:"hidden" }}>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ background:PRIMARY, color:"#fff" }}>
                  {["#","Nombre","Cédula","Cargo","Centro Costo","Cuadrilla","Básico Mensual",...(puedeEditar?["Acciones"]:[])].map(h => (
                    <th key={h} style={{ padding:"0.9rem 1rem", textAlign:"left", fontSize:"0.85rem", fontWeight:"700", whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtradosActivos.map((t, i) => (
                  <tr key={t.id} style={{ borderBottom:"1px solid #f1f5f9" }}
                    onMouseEnter={e => e.currentTarget.style.background="#f8fafc"}
                    onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                    <td style={{ padding:"0.85rem 1rem", color:"#94a3b8", fontSize:"0.85rem" }}>{i+1}</td>
                    <td style={{ padding:"0.85rem 1rem", fontWeight:"600", color:"#1e293b" }}>{t.nombre}</td>
                    <td style={{ padding:"0.85rem 1rem", color:"#475569", fontFamily:"monospace" }}>{t.cedula}</td>
                    <td style={{ padding:"0.85rem 1rem" }}>
                      <span style={{ background:"#f0f9ff", color:ACCENT, borderRadius:"6px", padding:"2px 8px", fontSize:"0.78rem", fontWeight:"600" }}>{t.cargo}</span>
                    </td>
                    {/* Centro de Costos */}
                    <td style={{ padding:"0.85rem 1rem" }}>
                      {t.centroCostos
                        ? <span style={{ background:"#f5f3ff", color:"#7c3aed", borderRadius:"6px", padding:"2px 8px", fontSize:"0.74rem", fontWeight:"700", fontFamily:"monospace", whiteSpace:"nowrap" }}>
                            {t.centroCostos.split(" ")[0]}
                          </span>
                        : <span style={{ color:"#cbd5e1" }}>—</span>}
                    </td>
                    <td style={{ padding:"0.85rem 1rem", color:"#475569" }}>
                      {workerCuadrillaMap[t.id]
                        ? <span style={{ background:"#eff6ff", color:"#1d4ed8", borderRadius:"6px", padding:"2px 10px", fontSize:"0.82rem", fontWeight:"700" }}>C{workerCuadrillaMap[t.id]}</span>
                        : <span style={{ color:"#cbd5e1" }}>—</span>}
                    </td>
                    <td style={{ padding:"0.85rem 1rem", fontWeight:"700" }}>
                    {(() => {
                    const cargoKey       = String(t.cargo || "").trim().toUpperCase();
                    const basicoCatalogo = cargosMap[cargoKey];
                    const basicoPropio   = t.basicoMensual ? Number(t.basicoMensual) : null;
                    // Editado manualmente = tiene valor propio distinto al catálogo (o no hay catálogo)
                    const editado = basicoPropio && (basicoCatalogo
                    ? basicoPropio !== Number(basicoCatalogo)
                    : true);
                    const basico  = basicoCatalogo || basicoPropio || 0;
                    return basico
                        ? <span
                              style={{ color: editado ? "#f59e0b" : SUCCESS }}
                              title={editado
                                ? `Editado manualmente: $${Number(basicoPropio).toLocaleString("es-CO")}${basicoCatalogo ? ` (catálogo: $${Number(basicoCatalogo).toLocaleString("es-CO")})` : " (cargo sin tarifa en catálogo)"}`
                                : "Valor del catálogo de cargos"}>
                              {editado && <span style={{ fontSize:"0.72rem", marginRight:"3px" }}>⚠️</span>}
                              ${Number(basico).toLocaleString("es-CO")}
                            </span>
                          : <span style={{ color:"#94a3b8" }}>—</span>;
                      })()}
                    </td>
                    {puedeEditar && (
                      <td style={{ padding:"0.85rem 1rem" }}>
                        <div style={{ display:"flex", gap:"0.5rem" }}>
                          <button onClick={() => abrirEditar(t)} style={{ background:"#f0f9ff", border:"none", borderRadius:"6px", padding:"0.35rem 0.5rem", cursor:"pointer", color:ACCENT }}><Edit2 size={14}/></button>
                          <button onClick={() => toggleActivo(t)} title="Marcar inactivo"
                            style={{ background:"#fff7ed", border:"1.5px solid #fdba74", borderRadius:"6px", padding:"0.35rem 0.5rem", cursor:"pointer", color:"#ea580c" }}>
                            <RefreshCw size={13}/>
                          </button>
                          <button onClick={() => eliminar(t)} style={{ background:"#fff1f2", border:"none", borderRadius:"6px", padding:"0.35rem 0.5rem", cursor:"pointer", color:DANGER }}><Trash2 size={14}/></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {filtradosActivos.length === 0 && (
                  <tr><td colSpan="9" style={{ textAlign:"center", padding:"3rem", color:"#94a3b8" }}>No se encontraron trabajadores activos</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── SECCIÓN INACTIVOS ── */}
        {filtradosInactivos.length > 0 && (
          <div style={{ marginTop:"2rem" }}>
            {/* Header sección inactivos */}
            <div style={{ display:"flex", alignItems:"center", gap:"0.75rem", marginBottom:"0.75rem", padding:"0.75rem 1.25rem", background:"#fef2f2", border:"2px solid #fca5a5", borderRadius:"12px" }}>
              <span style={{ fontSize:"1.1rem" }}>🔴</span>
              <div>
                <div style={{ fontWeight:"800", color:DANGER, fontSize:"1rem" }}>Trabajadores Inactivos ({filtradosInactivos.length})</div>
                <div style={{ fontSize:"0.78rem", color:"#9f1239" }}>Estos trabajadores NO aparecen en liquidación, matriz ni asistencia. Usa el botón ↺ para reactivar.</div>
              </div>
            </div>
            <div style={{ background:"#fff", borderRadius:"12px", boxShadow:"0 2px 8px rgba(239,68,68,0.15)", overflow:"hidden", border:"2px solid #fca5a5" }}>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead>
                    <tr style={{ background:DANGER, color:"#fff" }}>
                      {["#","Nombre","Cédula","Cargo","Centro Costo","Básico Mensual",...(puedeEditar?["Acciones"]:[])].map(h => (
                        <th key={h} style={{ padding:"0.75rem 1rem", textAlign:"left", fontSize:"0.83rem", fontWeight:"700", whiteSpace:"nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtradosInactivos.map((t, i) => (
                      <tr key={t.id} style={{ borderBottom:"1px solid #fee2e2", background: i%2===0 ? "#fff5f5" : "#fff" }}
                        onMouseEnter={e => e.currentTarget.style.background="#fee2e2"}
                        onMouseLeave={e => e.currentTarget.style.background= i%2===0 ? "#fff5f5" : "#fff"}>
                        <td style={{ padding:"0.75rem 1rem", color:"#fca5a5", fontSize:"0.85rem" }}>{i+1}</td>
                        <td style={{ padding:"0.75rem 1rem", fontWeight:"600", color:"#991b1b", display:"flex", alignItems:"center", gap:"0.5rem" }}>
                          <span style={{ background:"#fef2f2", color:DANGER, borderRadius:"5px", padding:"2px 6px", fontSize:"0.65rem", fontWeight:"800", whiteSpace:"nowrap" }}>🔴 Inactivo</span>
                          {t.nombre}
                        </td>
                        <td style={{ padding:"0.75rem 1rem", color:"#b91c1c", fontFamily:"monospace", fontSize:"0.88rem" }}>{t.cedula}</td>
                        <td style={{ padding:"0.75rem 1rem" }}>
                          <span style={{ background:"#fef2f2", color:"#dc2626", borderRadius:"6px", padding:"2px 8px", fontSize:"0.78rem", fontWeight:"600" }}>{t.cargo}</span>
                        </td>
                        <td style={{ padding:"0.75rem 1rem" }}>
                          {t.centroCostos
                            ? <span style={{ background:"#fef2f2", color:"#dc2626", borderRadius:"6px", padding:"2px 8px", fontSize:"0.74rem", fontWeight:"700", fontFamily:"monospace", whiteSpace:"nowrap" }}>
                                {t.centroCostos.split(" ")[0]}
                              </span>
                            : <span style={{ color:"#fca5a5" }}>—</span>}
                        </td>
                        <td style={{ padding:"0.75rem 1rem", fontWeight:"700", color:"#b91c1c" }}>
                          {t.basicoMensual ? `${Number(t.basicoMensual).toLocaleString("es-CO")}` : <span style={{color:"#fca5a5"}}>--</span>}
                        </td>
                        {puedeEditar && (
                          <td style={{ padding:"0.75rem 1rem" }}>
                            <div style={{ display:"flex", gap:"0.5rem" }}>
                              <button onClick={() => toggleActivo(t)} title="Reactivar trabajador"
                                style={{ background:"#f0fdf4", border:"1.5px solid #86efac", borderRadius:"6px", padding:"0.35rem 0.6rem", cursor:"pointer", color:SUCCESS, display:"flex", alignItems:"center", gap:"0.3rem", fontSize:"0.78rem", fontWeight:"700" }}>
                                <RefreshCw size={13}/> Reactivar
                              </button>
                              <button onClick={() => eliminar(t)} style={{ background:"#fff1f2", border:"none", borderRadius:"6px", padding:"0.35rem 0.5rem", cursor:"pointer", color:DANGER }}><Trash2 size={14}/></button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══ MODAL TRABAJADOR INDIVIDUAL ══ */}
      {modalAbierto && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center" }}
          onClick={e => { if (e.target===e.currentTarget) setModalAbierto(false); }}>
          <div style={{ background:"#fff", borderRadius:"16px", padding:"2rem", width:"100%", maxWidth:"520px", boxShadow:"0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.5rem" }}>
              <h2 style={{ margin:0, color:PRIMARY, fontWeight:"800" }}>{editando?"✏️ Editar":"➕ Nuevo"} Trabajador</h2>
              <button onClick={() => setModalAbierto(false)} style={{ background:"none", border:"none", cursor:"pointer" }}><X size={22} color="#94a3b8"/></button>
            </div>
            {[
              { label:"Nombre completo *", key:"nombre",        type:"text",   placeholder:"APELLIDO NOMBRE" },
              { label:"Cédula *",          key:"cedula",        type:"text",   placeholder:"1234567890" },
              { label:"Básico mensual",    key:"basicoMensual", type:"number", placeholder:"1750905" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom:"1rem" }}>
                <label style={{ display:"block", fontWeight:"600", color:"#374151", marginBottom:"0.35rem", fontSize:"0.88rem" }}>{f.label}</label>
                <input type={f.type} value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} placeholder={f.placeholder}
                  style={{ width:"100%", padding:"0.7rem 0.9rem", border:"1.5px solid #e2e8f0", borderRadius:"8px", fontSize:"0.95rem", boxSizing:"border-box", outline:"none" }}/>
              </div>
            ))}
            <div style={{ marginBottom:"1rem" }}>
              <label style={{ display:"block", fontWeight:"600", color:"#374151", marginBottom:"0.35rem", fontSize:"0.88rem" }}>Cargo</label>
              <select value={form.cargo} onChange={e => {
                const cargoSel = e.target.value;
                const basico   = cargosMap[cargoSel.trim().toUpperCase()];
                setForm(prev => ({ ...prev, cargo: cargoSel, ...(basico ? { basicoMensual: String(basico) } : {}) }));
              }}
                style={{ width:"100%", padding:"0.7rem 0.9rem", border:"1.5px solid #e2e8f0", borderRadius:"8px", fontSize:"0.95rem" }}>
                {listaCargos.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            {/* Centro de Costo */}
            <div style={{ marginBottom:"1rem" }}>
              <label style={{ display:"block", fontWeight:"600", color:"#374151", marginBottom:"0.35rem", fontSize:"0.88rem" }}>Centro de Costos (DataX)</label>
              <select value={form.centroCostos} onChange={e => setForm({ ...form, centroCostos: e.target.value })}
                style={{ width:"100%", padding:"0.7rem 0.9rem", border:"1.5px solid #e2e8f0", borderRadius:"8px", fontSize:"0.9rem", fontFamily:"monospace" }}>
                <option value="">(Sin asignar)</option>
                {CENTROS_COSTO.map(cc => <option key={cc.codigo} value={`${cc.codigo} ${cc.label.split(' — ')[1]}`}>{cc.label}</option>)}
              </select>
            </div>
            <div style={{ marginBottom:"1.5rem" }}>
              <label style={{ display:"block", fontWeight:"600", color:"#374151", marginBottom:"0.35rem", fontSize:"0.88rem" }}>Cuadrilla</label>
              {cuadrillasAsistencia.length > 0 ? (
                <select value={form.cuadrilla} onChange={e => setForm({ ...form, cuadrilla: e.target.value })}
                  style={{ width:"100%", padding:"0.7rem 0.9rem", border:"1.5px solid #e2e8f0", borderRadius:"8px", fontSize:"0.95rem" }}>
                  <option value="">(Sin cuadrilla)</option>
                  {cuadrillasAsistencia.map(c => (
                    <option key={c.id} value={c.nombre}>Cuadrilla {c.nombre} ({c.totalPersonas || 0} personas)</option>
                  ))}
                </select>
              ) : (
                <div style={{ padding:"0.7rem 0.9rem", border:"1.5px solid #fde68a", borderRadius:"8px", background:"#fffbeb", fontSize:"0.85rem", color:"#92400e" }}>
                  ⚠️ No hay cuadrillas creadas. Créalas primero en <strong>Listado de Asistencia</strong>.
                </div>
              )}
            </div>
            <button onClick={guardar} disabled={guardando}
              style={{ width:"100%", padding:"0.9rem", background:PRIMARY, border:"none", borderRadius:"10px", color:"#fff", fontWeight:"700", fontSize:"1rem", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:"0.5rem", opacity: guardando?0.7:1 }}>
              <Save size={18}/> {guardando?"Guardando...":"Guardar"}
            </button>
          </div>
        </div>
      )}

      {/* ══ MODAL IMPORTAR EXCEL ══ */}
      {modalExcel && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }}
          onClick={e => { if (e.target===e.currentTarget && !importando) cerrarModalExcel(); }}>
          <div style={{ background:"#fff", borderRadius:"16px", width:"100%", maxWidth:"760px", maxHeight:"92vh", display:"flex", flexDirection:"column", boxShadow:"0 20px 60px rgba(0,0,0,0.3)" }}>

            {/* Header */}
            <div style={{ padding:"1.25rem 1.5rem", borderBottom:"1px solid #f1f5f9", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ flex:1 }}>
                <h2 style={{ margin:0, color:PRIMARY, fontWeight:"800", fontSize:"1.1rem" }}>📊 Importar desde Excel</h2>
                <div style={{ color:"#64748b", fontSize:"0.82rem", marginTop:"0.2rem" }}>
                  {excelNombre} — <strong>{excelRows.length}</strong> filas detectadas
                </div>
                {/* Selector de cliente */}
                <div style={{ marginTop:"0.75rem", display:"flex", alignItems:"center", gap:"0.6rem", flexWrap:"wrap" }}>
                  <span style={{ fontSize:"0.82rem", fontWeight:"700", color:"#374151" }}>📂 Importar para cliente:</span>
                  <div style={{ display:"flex", gap:"0.4rem", flexWrap:"wrap" }}>
                    {clientes.map(c => (
                      <button key={c.id} onClick={() => setImportarClienteId(c.id)}
                        style={{ padding:"0.3rem 0.85rem", borderRadius:"20px", fontSize:"0.78rem", fontWeight:"700", cursor:"pointer", border:`2px solid ${importarClienteId===c.id ? c.color||PRIMARY : "#e2e8f0"}`, background: importarClienteId===c.id ? c.color||PRIMARY : "#f8fafc", color: importarClienteId===c.id ? "#fff" : "#64748b", transition:"all 0.15s" }}>
                        {c.emoji} {c.nombre}
                      </button>
                    ))}
                  </div>
                </div>
                {formatoLogisport && (
                  <div style={{ marginTop:"0.4rem", display:"inline-flex", alignItems:"center", gap:"0.4rem", background:"#f0fdf4", border:"1.5px solid #86efac", borderRadius:"20px", padding:"2px 10px", fontSize:"0.76rem", fontWeight:"700", color:"#065f46" }}>
                    ✨ Formato LOGISPORT detectado — salarios cruzados por cargo automáticamente · {Object.keys(formatoLogisport.cargoSalario).length} cargos con tarifa
                  </div>
                )}
              </div>
              {!importando && <button onClick={cerrarModalExcel} style={{ background:"none", border:"none", cursor:"pointer" }}><X size={20} color="#94a3b8"/></button>}
            </div>

            {/* Columnas detectadas */}
            <div style={{ padding:"0.85rem 1.5rem", borderBottom:"1px solid #f1f5f9", background:"#f8fafc" }}>
              <div style={{ fontSize:"0.78rem", fontWeight:"700", color:"#64748b", marginBottom:"0.4rem", textTransform:"uppercase", letterSpacing:"0.06em" }}>Columnas detectadas</div>
              <div style={{ display:"flex", gap:"0.5rem", flexWrap:"wrap" }}>
                {Object.entries(COLUMNAS_MAP).map(([campo]) => {
                  const detectado = campo in excelCols;
                  return (
                    <span key={campo} style={{ padding:"0.25rem 0.7rem", borderRadius:"20px", fontSize:"0.75rem", fontWeight:"700",
                      background: detectado ? "#f0fdf4" : "#fef2f2",
                      color:      detectado ? SUCCESS   : DANGER,
                      border:     `1px solid ${detectado ? "#86efac" : "#fca5a5"}` }}>
                      {detectado ? "✓" : "✗"} {campo}
                      {detectado && <span style={{ opacity:0.6, marginLeft:"0.3rem" }}>({excelHeaders[excelCols[campo]]})</span>}
                    </span>
                  );
                })}
              </div>
              {!("nombre" in excelCols) && (
                <div style={{ marginTop:"0.5rem", color:DANGER, fontSize:"0.8rem", fontWeight:"600" }}>
                  ⚠️ No se detectó columna "Nombre". Verifica que el encabezado diga: nombre, trabajador, empleado, etc.
                </div>
              )}
            </div>

            {/* Preview tabla */}
            <div style={{ flex:1, overflowY:"auto", padding:"0.75rem 1.5rem" }}>
              <div style={{ fontSize:"0.78rem", fontWeight:"700", color:"#64748b", marginBottom:"0.5rem", textTransform:"uppercase" }}>
                Vista previa — primeros 10 registros
              </div>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"0.82rem" }}>
                  <thead>
                    <tr style={{ background:"#f8fafc" }}>
                      {["#","Nombre","Cédula","Cargo","Cuadrilla","Básico"].map(h => (
                        <th key={h} style={{ padding:"0.5rem 0.75rem", textAlign:"left", fontWeight:"700", color:"#64748b", whiteSpace:"nowrap", borderBottom:"1px solid #e2e8f0" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {excelRows.slice(0, 10).map((r, i) => (
                      <tr key={i} style={{ borderBottom:"1px solid #f1f5f9" }}>
                        <td style={{ padding:"0.45rem 0.75rem", color:"#94a3b8" }}>{i+1}</td>
                        <td style={{ padding:"0.45rem 0.75rem", fontWeight:"600", color: r.nombre?"#1e293b":DANGER }}>
                          {r.nombre?.toString().toUpperCase() || <span style={{color:DANGER}}>⚠️ vacío</span>}
                        </td>
                        <td style={{ padding:"0.45rem 0.75rem", fontFamily:"monospace", color: r.cedula?"#475569":DANGER }}>
                          {r.cedula?.toString() || <span style={{color:DANGER}}>⚠️ vacío</span>}
                        </td>
                        <td style={{ padding:"0.45rem 0.75rem", color:"#475569" }}>{r.cargo?.toString()||"—"}</td>
                        <td style={{ padding:"0.45rem 0.75rem", color:"#475569" }}>{r.cuadrilla?.toString()||"—"}</td>
                        <td style={{ padding:"0.45rem 0.75rem", color:SUCCESS }}>
                          {r.basicoMensual ? `$${Number(r.basicoMensual).toLocaleString("es-CO")}` : "—"}
                        </td>
                      </tr>
                    ))}
                    {excelRows.length > 10 && (
                      <tr><td colSpan="6" style={{ padding:"0.5rem 0.75rem", color:"#94a3b8", fontSize:"0.78rem", textAlign:"center" }}>
                        ... y {excelRows.length - 10} filas más
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Opción eliminar + resultado */}
            <div style={{ padding:"1rem 1.5rem", borderTop:"1px solid #f1f5f9" }}>

              {/* Resultado importación */}
              {importResult && (
                <div style={{ marginBottom:"1rem", background: importResult.errores.length ? "#fffbeb" : "#f0fdf4", border:`1px solid ${importResult.errores.length?"#fcd34d":"#86efac"}`, borderRadius:"10px", padding:"0.75rem 1rem" }}>
                  <div style={{ fontWeight:"800", color:"#065f46", marginBottom:"0.4rem", fontSize:"0.95rem" }}>
                    ✅ Importación completada para <strong>{importResult.clienteNombre}</strong>
                  </div>
                  <div style={{ fontSize:"0.83rem", color:"#374151", lineHeight:"1.7" }}>
                    {importResult.ok > 0 && <div>👤 <strong>{importResult.ok}</strong> trabajadores nuevos creados</div>}
                    {importResult.actualizados > 0 && <div>🔄 <strong>{importResult.actualizados}</strong> trabajadores existentes vinculados al cliente</div>}
                    {importResult.cargosActualizados > 0 && <div>📋 <strong>{importResult.cargosActualizados}</strong> cargos actualizados en catálogo</div>}
                    {importResult.errores.length > 0 && <div style={{color:"#92400e"}}>⚠️ {importResult.errores.length} fila(s) sin nombre/cédula ignoradas</div>}
                  </div>
                </div>
              )}

              {/* Toggle eliminar existentes */}
              {!importResult && (
                <div
                  onClick={() => setEliminarAntes(!eliminarAntes)}
                  style={{ display:"flex", alignItems:"flex-start", gap:"0.75rem", padding:"0.85rem 1rem", borderRadius:"10px", border:`1.5px solid ${eliminarAntes?"#fca5a5":"#e2e8f0"}`, background: eliminarAntes?"#fff1f2":"#f8fafc", cursor:"pointer", marginBottom:"1rem", userSelect:"none" }}>
                  <div style={{ width:"20px", height:"20px", borderRadius:"5px", border:`2px solid ${eliminarAntes?DANGER:"#cbd5e1"}`, background: eliminarAntes?DANGER:"#fff", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:"1px" }}>
                    {eliminarAntes && <X size={12} color="#fff"/>}
                  </div>
                  <div>
                    <div style={{ fontWeight:"700", color: eliminarAntes?DANGER:"#374151", fontSize:"0.88rem" }}>
                      Eliminar trabajadores existentes antes de importar
                    </div>
                    <div style={{ fontSize:"0.78rem", color:"#64748b", marginTop:"0.15rem" }}>
                      {eliminarAntes
                        ? `⚠️ Se eliminarán los ${trabajadores.length} trabajadores actuales y se reemplazarán con los ${excelRows.length} del Excel.`
                        : "Los nuevos registros se agregarán a los existentes sin borrar nada."}
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display:"flex", gap:"0.75rem" }}>
                {!importResult ? (
                  <>
                    <button onClick={cerrarModalExcel} disabled={importando}
                      style={{ flex:1, padding:"0.75rem", background:"#f1f5f9", border:"none", borderRadius:"10px", color:"#475569", fontWeight:"700", cursor:"pointer" }}>
                      Cancelar
                    </button>
                    <button onClick={importar}
                      disabled={importando || !("nombre" in excelCols) || !("cedula" in excelCols)}
                      style={{ flex:2, padding:"0.75rem", background: ("nombre" in excelCols && "cedula" in excelCols) ? (eliminarAntes?DANGER:PRIMARY) : "#94a3b8", border:"none", borderRadius:"10px", color:"#fff", fontWeight:"700", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:"0.5rem", transition:"background 0.15s" }}>
                      {importando
                        ? <><RefreshCw size={16} style={{animation:"spin 1s linear infinite"}}/> Importando...</>
                        : <><Upload size={16}/> {eliminarAntes ? `Reemplazar todo (${excelRows.length} registros)` : `Importar ${excelRows.length} registros`}</>}
                    </button>
                  </>
                ) : (
                  <button onClick={cerrarModalExcel}
                    style={{ flex:1, padding:"0.75rem", background:PRIMARY, border:"none", borderRadius:"10px", color:"#fff", fontWeight:"700", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:"0.5rem" }}>
                    <CheckCircle size={16}/> Cerrar
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL ACTUALIZAR SALARIOS ══ */}
      {modalSalarios && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }}
          onClick={e => { if (e.target===e.currentTarget && !actualizandoSal) cerrarModalSalarios(); }}>
          <div style={{ background:"#fff", borderRadius:"16px", width:"100%", maxWidth:"580px", boxShadow:"0 20px 60px rgba(0,0,0,0.3)" }}>

            {/* Header */}
            <div style={{ padding:"1.25rem 1.5rem", borderBottom:"1px solid #f1f5f9", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div>
                <h2 style={{ margin:0, color:"#92400e", fontWeight:"800", fontSize:"1.1rem" }}>💰 Actualizar Salarios desde Excel</h2>
                <div style={{ color:"#64748b", fontSize:"0.82rem", marginTop:"0.2rem" }}>{salNombreArchivo}</div>
              </div>
              {!actualizandoSal && <button onClick={cerrarModalSalarios} style={{ background:"none", border:"none", cursor:"pointer" }}><X size={20} color="#94a3b8"/></button>}
            </div>

            {/* Contenido dinámico según formato */}
            <div style={{ padding:"1rem 1.5rem", maxHeight:"45vh", overflowY:"auto" }}>
              {salFormatoBase ? (
                /* Formato BASE_DATOS_PERSONAL */
                <>
                  <div style={{ background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:"8px", padding:"0.75rem 1rem", fontSize:"0.83rem", color:"#1e40af", marginBottom:"0.75rem" }}>
                    <strong>Formato BASE_DATOS_PERSONAL detectado</strong><br/>
                    • Se actualizará el <strong>salario</strong> y el <strong>Centro de Costo</strong> de cada trabajador por cédula.<br/>
                    • Trabajadores que no aparezcan en el archivo serán marcados <strong style={{color:DANGER}}>Inactivos</strong>.<br/>
                    • Los inactivos NO aparecerán en la nómina ni en el listado (hasta que se reactiven).
                  </div>
                  <div style={{ display:"flex", gap:"1rem", flexWrap:"wrap" }}>
                    <div style={{ background:"#f0fdf4", border:"1px solid #86efac", borderRadius:"8px", padding:"0.6rem 1rem", textAlign:"center", flex:1 }}>
                      <div style={{ fontWeight:"800", fontSize:"1.2rem", color:SUCCESS }}>{Object.keys(salCedulaMap).length}</div>
                      <div style={{ fontSize:"0.75rem", color:"#64748b" }}>Trabajadores en archivo</div>
                    </div>
                    <div style={{ background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:"8px", padding:"0.6rem 1rem", textAlign:"center", flex:1 }}>
                      <div style={{ fontWeight:"800", fontSize:"1.2rem", color:DANGER }}>{trabajadores.length - Object.keys(salCedulaMap).length > 0 ? trabajadores.length - Object.keys(salCedulaMap).length : 0}</div>
                      <div style={{ fontSize:"0.75rem", color:"#64748b" }}>Se marcarán inactivos</div>
                    </div>
                    <div style={{ background:"#fffbeb", border:"1px solid #fde68a", borderRadius:"8px", padding:"0.6rem 1rem", textAlign:"center", flex:1 }}>
                      <div style={{ fontWeight:"800", fontSize:"1.2rem", color:"#92400e" }}>{trabajadores.length}</div>
                      <div style={{ fontSize:"0.75rem", color:"#64748b" }}>Total en BD</div>
                    </div>
                  </div>
                </>
              ) : (
                /* Formato LOGISPORT */
                <>
                  <div style={{ fontSize:"0.78rem", fontWeight:"700", color:"#64748b", marginBottom:"0.6rem", textTransform:"uppercase" }}>
                    {Object.keys(salCargoMap).length} tarifas por cargo detectadas
                  </div>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"0.84rem" }}>
                    <thead>
                      <tr style={{ background:"#fffbeb" }}>
                        <th style={{ padding:"0.5rem 0.75rem", textAlign:"left", fontWeight:"700", color:"#92400e", borderBottom:"1px solid #fde68a" }}>Cargo</th>
                        <th style={{ padding:"0.5rem 0.75rem", textAlign:"right", fontWeight:"700", color:"#92400e", borderBottom:"1px solid #fde68a" }}>Básico Mensual</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(salCargoMap).sort((a,b)=>a[0].localeCompare(b[0])).map(([cargo, sal]) => (
                        <tr key={cargo} style={{ borderBottom:"1px solid #fef3c7" }}>
                          <td style={{ padding:"0.45rem 0.75rem", color:"#374151" }}>{cargo}</td>
                          <td style={{ padding:"0.45rem 0.75rem", textAlign:"right", fontFamily:"monospace", fontWeight:"700", color:SUCCESS }}>
                            ${Number(sal).toLocaleString("es-CO")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:"8px", padding:"0.7rem 1rem", fontSize:"0.82rem", color:"#1e40af", marginTop:"0.75rem" }}>
                    ℹ️ Actualiza el campo Salario Básico por cargo. También actualiza el catálogo de cargos.
                  </div>
                </>
              )}
            </div>

            {/* Resultado */}
            {salariosResult && (
              <div style={{ margin:"0 1.5rem 1rem", background:"#f0fdf4", border:"1px solid #86efac", borderRadius:"10px", padding:"0.85rem 1rem" }}>
                <div style={{ fontWeight:"700", color:"#065f46", marginBottom:"0.3rem" }}>
                  ✅ ¡Actualización completada!
                </div>
                {salariosResult.modo === "base" ? (
                  <div style={{ fontSize:"0.83rem", color:"#374151", lineHeight:"1.6" }}>
                    👷 <strong>{salariosResult.actualizados}</strong> trabajadores actualizados (salario + centro costo)<br/>
                    {salariosResult.inactivados > 0 && <><span style={{ color:DANGER }}>🔴 <strong>{salariosResult.inactivados}</strong> trabajadores marcados como inactivos (no estaban en el archivo)</span><br/></>}
                  </div>
                ) : (
                  <div style={{ fontSize:"0.83rem", color:"#374151", lineHeight:"1.6" }}>
                    📄 <strong>{salariosResult.cargos}</strong> cargos actualizados en catálogo<br/>
                    👷 <strong>{salariosResult.actualizados}</strong> trabajadores actualizados<br/>
                    {salariosResult.sinCargo > 0 && <><span style={{ color:"#92400e" }}>⚠️ {salariosResult.sinCargo} trabajadores sin cargo en la tabla (no modificados)</span><br/></>}
                  </div>
                )}
              </div>
            )}

            {/* Botones */}
            <div style={{ padding:"0 1.5rem 1.5rem", display:"flex", gap:"0.75rem" }}>
              {!salariosResult ? (
                <>
                  <button onClick={cerrarModalSalarios} disabled={actualizandoSal}
                    style={{ flex:1, padding:"0.75rem", background:"#f1f5f9", border:"none", borderRadius:"10px", color:"#475569", fontWeight:"700", cursor:"pointer" }}>
                    Cancelar
                  </button>
                  <button onClick={aplicarActualizacionSalarios} disabled={actualizandoSal}
                    style={{ flex:2, padding:"0.75rem", background: salFormatoBase?DANGER:"#f59e0b", border:"none", borderRadius:"10px", color:"#fff", fontWeight:"700", cursor:actualizandoSal?"not-allowed":"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:"0.5rem", opacity: actualizandoSal?0.7:1 }}>
                    {actualizandoSal
                      ? <><RefreshCw size={16} style={{animation:"spin 1s linear infinite"}}/> Actualizando...</>
                      : salFormatoBase
                        ? <>🔄 Actualizar {trabajadores.length} trabajadores + marcar inactivos</>
                        : <>💰 Actualizar {trabajadores.length} trabajadores por cargo</>}
                  </button>
                </>
              ) : (
                <button onClick={cerrarModalSalarios}
                  style={{ flex:1, padding:"0.75rem", background:PRIMARY, border:"none", borderRadius:"10px", color:"#fff", fontWeight:"700", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:"0.5rem" }}>
                  <CheckCircle size={16}/> Cerrar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </LayoutWithSidebar>
  );
}
