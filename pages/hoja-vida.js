import React, { useEffect, useMemo, useRef, useState, memo } from "react";
import { useRouter } from "next/router";
import { db } from "@/firebase/firebaseConfig";
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  orderBy,
} from "firebase/firestore";
import * as XLSX from "xlsx";
import LayoutWithSidebar from "@/components/LayoutWithSidebar";
import PageHeader from "@/components/PageHeader";
import { useUsuarios } from "@/utils/useUsuarios";
import { useCargos } from "@/utils/useCargos";
import ImagenSegura from "@/components/ImagenSegura";
import { subirACloudinary } from "@/utils/cloudinaryUpload";

/* ==================== PRESETS ==================== */
const CARGO_PRESETS = [
  "GERENTE GENERAL",
];

// Nombres de PC para LOGISPORT
const NOMBRE_PC_PRESETS = [
  "GERENTEGENERAL",
];

const OFFICE_PRESETS = [
  "Office 2016",
  "Office 2019",
  "Office 365 → Microsoft 365 (suscripción)",
  "Office 2021",
  "Office 2024",
];

const WINDOWS_PRESETS = (() => {
  const out = [];
  const add = (ver, eds) => eds.forEach((e) => out.push(`${ver} ${e}`));
  const all = ["Home", "Pro", "Enterprise", "Education"];

  add("Windows 10 (1507)", all);
  add("Windows 10 (1511)", all);
  add("Windows 10 (1607)", all);
  add("Windows 10 (1703)", all);
  add("Windows 10 (1709)", all);
  add("Windows 10 (1803)", all);
  add("Windows 10 (1809)", all);
  add("Windows 10 (1903)", all);
  add("Windows 10 (1909)", all);
  add("Windows 10 (2004)", all);
  add("Windows 10 (20H2)", all);
  add("Windows 10 (21H1)", all);
  add("Windows 10 (21H2)", ["Enterprise LTSC"]);
  add("Windows 10 (22H2)", all);

  add("Windows 11 (21H2)", all);
  add("Windows 11 (22H2)", all);
  add("Windows 11 (23H2)", all);
  add("Windows 11 (24H2)", all);

  return out;
})();

/* ============ Hook: fotos de un equipo desde registroFotografico ============ */
function useFotosEquipo(nombrePC) {
  const [fotos, setFotos] = useState([]);
  useEffect(() => {
    if (!nombrePC) { setFotos([]); return; }
    const q = query(
      collection(db, "registroFotografico"),
      where("nombrePC", "==", nombrePC),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setFotos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {});
    return () => unsub();
  }, [nombrePC]);
  return fotos;
}

/* ============ Subcomponente: tarjeta de foto individual ============ */
function FotoEquipoCard({ foto }) {
  return (
    <div style={{ position: "relative" }}>
      <ImagenSegura
        url={foto.downloadURL}
        alt={foto.displayName || foto.originalName}
        style={{ width: "100%", height: 140, objectFit: "cover", borderRadius: 8, border: "2px solid #e5e7eb", cursor: "pointer" }}
        onClick={() => window.open(foto.downloadURL, "_blank")}
      />
      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {foto.displayName || foto.originalName || "—"}
      </div>
    </div>
  );
}

/* ============ Subcomponente: sección de fotos en tarjeta de equipo ============ */
function SeccionFotosEquipo({ nombrePC }) {
  const fotos = useFotosEquipo(nombrePC);
  const router = useRouter ? useRouter() : {};

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "2px solid #e5e7eb" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#374151" }}>
          📸 Fotos del equipo
          <span style={{ marginLeft: 8, fontSize: 11, background: fotos.length >= 3 ? "#fee2e2" : "#dbeafe", color: fotos.length >= 3 ? "#991b1b" : "#1e40af", padding: "2px 8px", borderRadius: 10, fontWeight: 700 }}>
            {fotos.length}/3
          </span>
        </div>
        <button
          onClick={() => window.location.href = "/registro-fotografico"}
          style={{ fontSize: 11, background: "#0B3D91", color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontWeight: 600 }}
        >
          + Agregar foto
        </button>
      </div>
      {fotos.length === 0 ? (
        <div style={{ textAlign: "center", padding: "16px 8px", color: "#9ca3af", fontSize: 13, background: "#f9fafb", borderRadius: 8, border: "1px dashed #d1d5db" }}>
          Sin fotos. Ve a Registro Fotográfico para agregar.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${fotos.length}, 1fr)`, gap: 10 }}>
          {fotos.map(foto => <FotoEquipoCard key={foto.id} foto={foto} />)}
        </div>
      )}
    </div>
  );
}

/* ============ Filtro genérico con autocompletado (una casilla) ============ */
const AutoFilter = memo(function AutoFilter({
  label,
  options,
  value,
  onChange,
  placeholder = "Escribe para filtrar…",
}) {
  const [query, setQuery] = useState(value || "");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const boxRef = useRef(null);

  useEffect(() => {
    setQuery(value || "");
  }, [value]);

  useEffect(() => {
    function onDocClick(e) {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const list = useMemo(() => {
    const q = (query || "").trim().toLowerCase();
    const base = Array.from(new Set((options || []).filter(Boolean)));
    const filtered = q ? base.filter((o) => o.toLowerCase().includes(q)) : base;
    return filtered
      .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }))
      .slice(0, 25);
  }, [options, query]);

  const pick = (v) => {
    onChange(v);
    setQuery(v);
    setOpen(false);
  };
  const clear = () => {
    onChange("");
    setQuery("");
    setOpen(false);
    setHi(0);
  };

  const onKeyDown = (e) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      return;
    }
    if (!open && e.key === "Enter") {
      const exact = (options || []).find(
        (o) => o?.toLowerCase() === (query || "").trim().toLowerCase()
      );
      pick(exact || "");
      return;
    }
    if (open) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHi((i) => Math.min(i + 1, Math.max(0, list.length - 1)));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHi((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        pick(list[hi] || "");
      } else if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    }
  };

  return (
    <div ref={boxRef} style={styles.filterBar}>
      <label style={styles.label}>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHi(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          style={{ ...styles.input, color: "#0f172a" }}
        />
        {query && (
          <button
            type="button"
            onClick={clear}
            title="Limpiar"
            style={{
              position: "absolute",
              right: 8,
              top: 8,
              background: "transparent",
              border: 0,
              cursor: "pointer",
              fontSize: 16,
              color: "#111827",
            }}
          >
            ×
          </button>
        )}

        {open && list.length > 0 && (
          <ul role="listbox" style={styles.suggestList}>
            {list.map((opt, idx) => {
              const active = idx === hi;
              return (
                <li
                  key={`opt_${opt}`}
                  role="option"
                  aria-selected={active}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(opt);
                  }}
                  onMouseEnter={() => setHi(idx)}
                  style={{
                    padding: "10px 12px",
                    cursor: "pointer",
                    background: active ? "#1d4ed8" : "#ffffff",
                    color: active ? "#ffffff" : "#111827",
                    borderBottom: "1px solid #e5e7eb",
                  }}
                >
                  {opt}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {value ? (
        <div
          style={{
            marginTop: 6,
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <span style={styles.chip}>{value}</span>
          <button
            type="button"
            style={{ ...styles.btn, background: "#6b7280" }}
            onClick={clear}
          >
            Quitar
          </button>
        </div>
      ) : (
        <small style={{ color: "#6b7280" }}>Sin filtro</small>
      )}
    </div>
  );
});

/* ============================ Página principal ============================ */
export default function HojaVidaEquipos() {
  const router = useRouter();

  // Cargar usuarios y cargos desde Firestore
  const { usuarios: usuariosDisponibles } = useUsuarios();
  const { cargos: cargosDisponibles } = useCargos();

  // Estado de pestaña (activos / baja)
  const [vista, setVista] = useState("activos"); // "activos" | "baja"

  const [formData, setFormData] = useState({
    cargo: "",
    nombrePC: "",
    procesador: "",
    ip: "",
    ram: "",
    discoTipo: "",
    discoSolido: "",
    discoMecanico: "",
    windowsVersion: "",
    windowsSerie: "",
    officeVersion: "",
    officeSerie: "",
    serial: "",
    numeroActivo: "",
    marca: "",
    modelo: "",
    dadoDeBaja: false,
    foto1URL: "",
    foto2URL: "",
    foto1Name: "",
    foto2Name: "",
    apps: Array(10).fill(""),
  });
  const [mensaje, setMensaje] = useState("");
  const [tipoMensaje, setTipoMensaje] = useState("");
  const [registros, setRegistros] = useState([]);
  const [editandoId, setEditandoId] = useState(null);
  
  // Estados para preview de fotos
  const [foto1Preview, setFoto1Preview] = useState(null);
  const [foto2Preview, setFoto2Preview] = useState(null);
  const [uploadingFoto1, setUploadingFoto1] = useState(false);
  const [uploadingFoto2, setUploadingFoto2] = useState(false);

  // Preparar opciones desde Firestore
  const opcionesUsuarios = useMemo(() => {
    return (usuariosDisponibles || [])
      .filter(u => u.activo !== false)
      .map(u => u.nombre)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }, [usuariosDisponibles]);

  const opcionesCargos = useMemo(() => {
    return (cargosDisponibles || [])
      .filter(c => c.activo !== false)
      .map(c => c.nombre)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }, [cargosDisponibles]);

  // ------ Carga de datos ------
  const cargarRegistros = async () => {
    const querySnapshot = await getDocs(collection(db, "hojaVidaEquipos"));
    const docs = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    setRegistros(docs);
  };
  useEffect(() => {
    cargarRegistros();
  }, []);

  const handleChange = (key, value) => setFormData({ ...formData, [key]: value });
  const handleAppChange = (index, value) => {
    const updatedApps = [...formData.apps];
    updatedApps[index] = value;
    setFormData({ ...formData, apps: updatedApps });
  };

  // Función para subir foto usando API
  const subirFoto = async (file) => {
    try {
      if (!file) return null;
      if (file.size > 5 * 1024 * 1024) throw new Error("La imagen no debe superar 5MB");
      if (!file.type.startsWith('image/')) throw new Error("Solo se permiten archivos de imagen");

      // Subir a Cloudinary directamente (mismo preset que registro-fotografico)
      const resultado = await subirACloudinary(file);
      return { url: resultado.url, name: file.name };
    } catch (error) {
      console.error("Error subiendo foto:", error);
      throw error;
    }
  };

  // Handler para seleccionar foto 1
  const handleFoto1Change = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      // Validar tamaño
      if (file.size > 5 * 1024 * 1024) {
        setMensaje("La imagen no debe superar 5MB");
        setTipoMensaje("error");
        setTimeout(() => setMensaje(""), 3000);
        return;
      }
      
      // Crear preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setFoto1Preview(reader.result);
      };
      reader.readAsDataURL(file);
      
      // Guardar archivo temporalmente
      setFormData({
        ...formData,
        _foto1File: file
      });
      
    } catch (error) {
      console.error("Error procesando foto 1:", error);
      setMensaje("Error procesando la imagen");
      setTipoMensaje("error");
      setTimeout(() => setMensaje(""), 3000);
    }
  };

  // Handler para seleccionar foto 2
  const handleFoto2Change = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      // Validar tamaño
      if (file.size > 5 * 1024 * 1024) {
        setMensaje("La imagen no debe superar 5MB");
        setTipoMensaje("error");
        setTimeout(() => setMensaje(""), 3000);
        return;
      }
      
      // Crear preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setFoto2Preview(reader.result);
      };
      reader.readAsDataURL(file);
      
      // Guardar archivo temporalmente
      setFormData({
        ...formData,
        _foto2File: file
      });
      
    } catch (error) {
      console.error("Error procesando foto 2:", error);
      setMensaje("Error procesando la imagen");
      setTipoMensaje("error");
      setTimeout(() => setMensaje(""), 3000);
    }
  };

  // Función para eliminar foto
  const eliminarFoto = (numeroFoto) => {
    if (numeroFoto === 1) {
      setFoto1Preview(null);
      setFormData({
        ...formData,
        foto1URL: "",
        foto1Name: "",
        _foto1File: null
      });
    } else {
      setFoto2Preview(null);
      setFormData({
        ...formData,
        foto2URL: "",
        foto2Name: "",
        _foto2File: null
      });
    }
  };
  const resetForm = () => {
    setFormData({
      cargo: "",
      nombrePC: "",
      procesador: "",
      ip: "",
      ram: "",
      discoTipo: "",
      discoSolido: "",
      discoMecanico: "",
      windowsVersion: "",
      windowsSerie: "",
      officeVersion: "",
      officeSerie: "",
      serial: "",
      numeroActivo: "",
      marca: "",
      modelo: "",
      dadoDeBaja: false,
      foto1URL: "",
      foto2URL: "",
      foto1Name: "",
      foto2Name: "",
      apps: Array(10).fill(""),
    });
    setEditandoId(null);
    setFoto1Preview(null);
    setFoto2Preview(null);
  };

  const handleSave = async () => {
    const dataToSave = { ...formData };
    delete dataToSave.id;
    delete dataToSave._foto1File;
    delete dataToSave._foto2File;
    
    try {
      let equipoId = editandoId;
      
      // Si es nuevo, crear primero para tener ID
      if (!editandoId) {
        const docRef = await addDoc(collection(db, "hojaVidaEquipos"), dataToSave);
        equipoId = docRef.id;
      }
      
      // Subir fotos si hay archivos nuevos
      if (formData._foto1File) {
      setUploadingFoto1(true);
      const resultado = await subirFoto(formData._foto1File);
      dataToSave.foto1URL = resultado.url;
      dataToSave.foto1Name = resultado.name;
      setUploadingFoto1(false);
      }

      if (formData._foto2File) {
      setUploadingFoto2(true);
      const resultado = await subirFoto(formData._foto2File);
      dataToSave.foto2URL = resultado.url;
      dataToSave.foto2Name = resultado.name;
      setUploadingFoto2(false);
      }
      
      // Actualizar documento con URLs de fotos
      if (editandoId) {
        const docRef = doc(db, "hojaVidaEquipos", editandoId);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
          setMensaje("El documento que intentas actualizar ya no existe.");
          setTipoMensaje("error");
          setEditandoId(null);
          return;
        }
        await updateDoc(docRef, dataToSave);
        setMensaje("Datos actualizados exitosamente.");
      } else {
        // Actualizar el documento recién creado con las URLs
        await updateDoc(doc(db, "hojaVidaEquipos", equipoId), dataToSave);
        setMensaje("Datos guardados exitosamente.");
      }

      // Catálogos ahora se gestionan desde Admin Usuarios
      // Ya no necesitamos alimentar catálogos compartidos aquí

      setTipoMensaje("success");
      resetForm();
      await cargarRegistros();
    } catch (error) {
      console.error("Error al guardar/actualizar:", error);
      setMensaje("Error al guardar los datos: " + error.message);
      setTipoMensaje("error");
      setUploadingFoto1(false);
      setUploadingFoto2(false);
    }
    setTimeout(() => setMensaje(""), 3000);
  };

  const handleDelete = async (id) => {
    const confirmacion = window.confirm(
      "¿Estás seguro de que deseas eliminar este registro?"
    );
    if (!confirmacion) return;
    try {
      await deleteDoc(doc(db, "hojaVidaEquipos", id));
      setMensaje("Registro eliminado.");
      setTipoMensaje("success");
      await cargarRegistros();
      if (editandoId === id) resetForm();
    } catch (error) {
      console.error("Error al eliminar:", error);
      setMensaje("Error al eliminar el registro.");
      setTipoMensaje("error");
    }
    setTimeout(() => setMensaje(""), 3000);
  };

  const handleEdit = (registro) => {
    const { id, ...rest } = registro;
    setFormData({ ...rest, dadoDeBaja: !!rest.dadoDeBaja });
    setEditandoId(id);
    
    // Cargar previews de fotos existentes
    if (rest.foto1URL) {
      setFoto1Preview(rest.foto1URL);
    }
    if (rest.foto2URL) {
      setFoto2Preview(rest.foto2URL);
    }
    
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleImportarExcel = async (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;
    const data = await archivo.arrayBuffer();
    const workbook = XLSX.read(data);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(worksheet);
    for (let row of json) {
      const apps = [];
      for (let i = 1; i <= 10; i++) apps.push(row[`app${i}`] || "");
      const registro = {
        cargo: row["cargo"] || "",
        nombrePC: row["nombrePC"] || "",
        procesador: row["procesador"] || "",
        ip: row["ip"] || "",
        ram: row["ram"] || "",
        discoTipo: row["discoTipo"] || "",
        discoSolido: row["discoSolido"] || "",
        discoMecanico: row["discoMecanico"] || "",
        windowsVersion: row["windowsVersion"] || "",
        windowsSerie: row["windowsSerie"] || "",
        officeVersion: row["officeVersion"] || "",
        officeSerie: row["officeSerie"] || "",
        serial: row["serial"] || "",
        numeroActivo: row["numeroActivo"] || "",
        marca: row["marca"] || "",
        modelo: row["modelo"] || "",
        dadoDeBaja: !!row["dadoDeBaja"],
        apps,
      };
      await addDoc(collection(db, "hojaVidaEquipos"), registro);

      // Catálogos ahora se gestionan desde Admin Usuarios
    }
    cargarRegistros();
    alert("Importación completada");
    e.target.value = "";
  };

  // Validación
  const formularioValido = useMemo(() => {
    const requiredKeys = [
      "cargo",
      "nombrePC",
      "procesador",
      "ip",
      "ram",
      "windowsVersion",
      "windowsSerie",
      "officeVersion",
      "officeSerie",
      "serial",
      "numeroActivo",
      "marca",
      "modelo",
    ];
    for (const k of requiredKeys) {
      if (!String(formData[k] || "").trim()) return false;
    }
    if (!formData.discoTipo) return false;
    if (
      formData.discoTipo === "solido" &&
      !String(formData.discoSolido || "").trim()
    )
      return false;
    if (
      formData.discoTipo === "mecanico" &&
      !String(formData.discoMecanico || "").trim()
    )
      return false;
    return true;
  }, [formData]);

  /* ---------------------- Filtros (solo N° activo y Nombre PC) ---------------------- */
  const [filters, setFilters] = useState({
    numeroActivo: "",
    nombrePC: "",
  });
  const setFilter = (k, v) => setFilters((f) => ({ ...f, [k]: v || "" }));
  const clearAllFilters = () => setFilters({ numeroActivo: "", nombrePC: "" });

  const uniq = (arr) => Array.from(new Set(arr.filter(Boolean)));

  // SOLO las 8 opciones fijas para Nombre PC (también en filtros)
  const options = useMemo(() => {
    return {
      numeroActivo: uniq(
        registros.map((r) => r.numeroActivo?.trim()).filter(Boolean)
      ),
      nombrePC: [...NOMBRE_PC_PRESETS],
    };
  }, [registros]);

  const anyFilterActive = useMemo(
    () => Object.values(filters).some((v) => v && v.trim() !== ""),
    [filters]
  );

  const contains = (src, f) => {
    if (!f) return true;
    return String(src || "")
      .toLowerCase()
      .includes(String(f).toLowerCase());
  };

  const filteredRegistros = useMemo(() => {
    const base = registros.filter((r) =>
      vista === "activos" ? !r.dadoDeBaja : !!r.dadoDeBaja
    );
    if (!anyFilterActive) return base;

    return base.filter((r) => {
      if (!contains(r.numeroActivo, filters.numeroActivo)) return false;
      if (!contains(r.nombrePC, filters.nombrePC)) return false;
      return true;
    });
  }, [registros, anyFilterActive, filters, vista]);

  // Exportar a Excel la vista actual
  const exportarExcel = () => {
    const data = filteredRegistros.map((r) => ({
      cargo: r.cargo || "",
      nombrePC: r.nombrePC || "",
      procesador: r.procesador || "",
      ip: r.ip || "",
      ram: r.ram || "",
      disco:
        r.discoTipo === "solido"
          ? `Sólido - ${r.discoSolido || ""}`
          : `Mecánico - ${r.discoMecanico || ""}`,
      windows: `${r.windowsVersion || ""} / ${r.windowsSerie || ""}`,
      office: `${r.officeVersion || ""} / ${r.officeSerie || ""}`,
      serial: r.serial || "",
      numeroActivo: r.numeroActivo || "",
      marca: r.marca || "",
      modelo: r.modelo || "",
      dadoDeBaja: r.dadoDeBaja ? "Sí" : "No",
      apps: (Array.isArray(r.apps) ? r.apps : []).filter(Boolean).join(", "),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      ws,
      vista === "activos" ? "Activos" : "Baja"
    );
    XLSX.writeFile(wb, `equipos_${vista}.xlsx`);
  };

  return (
    <LayoutWithSidebar>
      <PageHeader titulo="Hoja de Vida de Equipos" />
    <div style={{ fontFamily: "Arial, sans-serif" }}>
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
            lineHeight: 1.2,
            textAlign: "center",
          }}
        >
          Hoja de Vida de Equipos
        </h1>

        {/* Botones de vista */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setVista("activos")}
            style={{
              ...styles.primaryBtn,
              background: vista === "activos" ? "#16a34a" : "#6ee7b7",
            }}
          >
            Equipos activos
          </button>
          <button
            type="button"
            onClick={() => setVista("baja")}
            style={{
              ...styles.primaryBtn,
              background: vista === "baja" ? "#dc2626" : "#fecaca",
            }}
          >
            Equipos dados de baja
          </button>
          <button type="button" onClick={exportarExcel} style={styles.secondaryBtn}>
            Exportar a Excel (vista)
          </button>
        </div>

        {/* Tarjeta Importar Excel */}
        <div style={{ ...styles.card, width: "100%" }}>
          <div style={styles.cardHeader}>
            <h3 style={{ margin: 0, fontSize: 18, color: "#111827" }}>
              Importar desde Excel
            </h3>
          </div>
          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              marginTop: 8,
              flexWrap: "wrap",
            }}
          >
            <input type="file" accept=".xlsx,.xls" onChange={handleImportarExcel} />
          </div>
        </div>
      </div>

      {/* Filtros por casilla (solo N° Activo y Nombre PC) */}
      <div style={{ ...styles.card, marginTop: 12 }}>
        <div style={styles.cardHeader}>
          <h3 style={{ margin: 0, fontSize: 18, color: "#111827" }}>Filtros</h3>
          <button type="button" onClick={clearAllFilters} style={styles.secondaryBtn}>
            Limpiar todos
          </button>
        </div>

        <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
          <div style={styles.rowGrid3}>
            <AutoFilter
              label="Número de activo"
              options={options.numeroActivo}
              value={filters.numeroActivo}
              onChange={(v) => setFilter("numeroActivo", v)}
            />
            <AutoFilter
              label="Nombre PC"
              options={options.nombrePC}
              value={filters.nombrePC}
              onChange={(v) => setFilter("nombrePC", v)}
            />
          </div>

        {!anyFilterActive && (
          <div
            style={{
              ...styles.alert,
              background: "#fff",
              borderColor: "#e5e7eb",
              color: "#6b7280",
            }}
          >
            Puedes filtrar por número de activo o nombre del PC.
          </div>
        )}
        </div>
      </div>

      {/* Formulario en tarjeta */}
      <div style={{ marginTop: 16 }}>
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={{ margin: 0, fontSize: 20, color: "#111827" }}>
              {editandoId ? "Editar equipo" : "Nuevo equipo"}
            </h3>
          </div>

          <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
            <div style={styles.rowGrid3}>
              <div>
                <label style={styles.label}>Cargo</label>
                <select
                  style={styles.input}
                  value={formData.cargo}
                  onChange={(e) => handleChange("cargo", e.target.value)}
                >
                  <option value="">— Selecciona cargo —</option>
                  {opcionesCargos.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={styles.label}>Nombre PC</label>
                <input
                  type="text"
                  style={styles.input}
                  placeholder="Escribe el nombre del PC"
                  value={formData.nombrePC}
                  onChange={(e) => handleChange("nombrePC", e.target.value)}
                />
              </div>

              <div>
                <label style={styles.label}>Procesador</label>
                <input
                  type="text"
                  style={styles.input}
                  value={formData.procesador}
                  onChange={(e) => handleChange("procesador", e.target.value)}
                />
              </div>
            </div>

            <div style={styles.rowGrid3}>
              <div>
                <label style={styles.label}>IP</label>
                <input
                  type="text"
                  style={styles.input}
                  value={formData.ip}
                  onChange={(e) => handleChange("ip", e.target.value)}
                />
              </div>
              <div>
                <label style={styles.label}>Memoria RAM</label>
                <input
                  type="text"
                  style={styles.input}
                  value={formData.ram}
                  onChange={(e) => handleChange("ram", e.target.value)}
                />
              </div>
              <div>
                <label style={styles.label}>Disco</label>
                <div style={{ display: "grid", gap: 6 }}>
                  <label style={styles.radioLabel}>
                    <input
                      type="radio"
                      name="discoTipo"
                      value="solido"
                      checked={formData.discoTipo === "solido"}
                      onChange={(e) => handleChange("discoTipo", e.target.value)}
                    />
                    Sólido
                  </label>
                  {formData.discoTipo === "solido" && (
                    <input
                      type="text"
                      style={styles.input}
                      placeholder="Tamaño"
                      value={formData.discoSolido}
                      onChange={(e) =>
                        handleChange("discoSolido", e.target.value)
                      }
                    />
                  )}

                  <label style={styles.radioLabel}>
                    <input
                      type="radio"
                      name="discoTipo"
                      value="mecanico"
                      checked={formData.discoTipo === "mecanico"}
                      onChange={(e) => handleChange("discoTipo", e.target.value)}
                    />
                    Mecánico
                  </label>
                  {formData.discoTipo === "mecanico" && (
                    <input
                      type="text"
                      style={styles.input}
                      placeholder="Tamaño"
                      value={formData.discoMecanico}
                      onChange={(e) =>
                        handleChange("discoMecanico", e.target.value)
                      }
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Serial / N° activo / Marca / Modelo / Dado de baja */}
            <div style={styles.rowGrid3}>
              <div>
                <label style={styles.label}>Serial</label>
                <input
                  type="text"
                  style={styles.input}
                  value={formData.serial}
                  onChange={(e) => handleChange("serial", e.target.value)}
                />
              </div>
              <div>
                <label style={styles.label}>Número de activo</label>
                <input
                  type="text"
                  style={styles.input}
                  value={formData.numeroActivo}
                  onChange={(e) => handleChange("numeroActivo", e.target.value)}
                />
              </div>
              <div>
                <label style={styles.label}>Marca</label>
                <input
                  type="text"
                  style={styles.input}
                  value={formData.marca}
                  onChange={(e) => handleChange("marca", e.target.value)}
                />
              </div>
            </div>

            <div style={styles.rowGrid3}>
              <div>
                <label style={styles.label}>Modelo</label>
                <input
                  type="text"
                  style={styles.input}
                  value={formData.modelo}
                  onChange={(e) => handleChange("modelo", e.target.value)}
                />
              </div>
              <div>
                <label style={styles.label}>Equipo dado de baja</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={!!formData.dadoDeBaja}
                    onChange={(e) =>
                      handleChange("dadoDeBaja", e.target.checked)
                    }
                  />
                  <span
                    style={{
                      color: formData.dadoDeBaja ? "#dc2626" : "#111827",
                      fontWeight: 700,
                    }}
                  >
                    {formData.dadoDeBaja ? "Sí" : "No"}
                  </span>
                </div>
              </div>
            </div>

            {/* Windows / Office */}
            <div style={styles.rowGrid2}>
              <div>
                <label style={styles.label}>Windows</label>
                <div style={styles.inline2}>
                  <input
                    type="text"
                    list="windowsOptions"
                    style={styles.input}
                    placeholder="Versión"
                    value={formData.windowsVersion}
                    onChange={(e) =>
                      handleChange("windowsVersion", e.target.value)
                    }
                  />
                  <input
                    type="text"
                    style={styles.input}
                    placeholder="# Serie"
                    value={formData.windowsSerie}
                    onChange={(e) =>
                      handleChange("windowsSerie", e.target.value)
                    }
                  />
                </div>
              </div>
              <div>
                <label style={styles.label}>Office</label>
                <div style={styles.inline2}>
                  <input
                    type="text"
                    list="officeOptions"
                    style={styles.input}
                    placeholder="Versión"
                    value={formData.officeVersion}
                    onChange={(e) =>
                      handleChange("officeVersion", e.target.value)
                    }
                  />
                  <input
                    type="text"
                    style={styles.input}
                    placeholder="# Serie"
                    value={formData.officeSerie}
                    onChange={(e) =>
                      handleChange("officeSerie", e.target.value)
                    }
                  />
                </div>
              </div>
            </div>

            <div>
              <label style={styles.label}>Apps instaladas</label>
              <div style={styles.appsGrid}>
                {formData.apps.map((app, index) => (
                  <input
                    key={index}
                    type="text"
                    style={styles.input}
                    placeholder={`App ${index + 1}`}
                    value={app}
                    onChange={(e) => handleAppChange(index, e.target.value)}
                  />
                ))}
              </div>
            </div>

            {mensaje && (
              <div
                style={{
                  ...styles.alert,
                  background:
                    tipoMensaje === "success" ? "#ecfccb" : "#fee2e2",
                  color: tipoMensaje === "success" ? "#3f6212" : "#991b1b",
                  borderColor:
                    tipoMensaje === "success" ? "#a3e635" : "#fca5a5",
                }}
              >
                {mensaje}
              </div>
            )}

          {/* SECCIÓN DE FOTOS */}
          <div style={{
            gridColumn: "1 / -1",
            padding: "20px",
            background: "#f3f4f6",
            borderRadius: "8px",
            marginTop: "20px"
          }}>
            <h3 style={{
              fontSize: "18px",
              fontWeight: "700",
              color: "#111827",
              marginBottom: "16px",
              borderBottom: "2px solid #3b82f6",
              paddingBottom: "8px"
            }}>
              📸 Fotos del Equipo
            </h3>
            
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "20px"
            }}>
              {/* FOTO 1 */}
              <div style={{
                background: "white",
                padding: "16px",
                borderRadius: "8px",
                border: "2px dashed #d1d5db"
              }}>
                <label style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#374151",
                  marginBottom: "8px"
                }}>
                  Foto 1
                </label>
                
                {foto1Preview ? (
                  <div>
                    <img
                      src={foto1Preview}
                      alt="Preview Foto 1"
                      style={{
                        width: "100%",
                        height: "200px",
                        objectFit: "cover",
                        borderRadius: "8px",
                        marginBottom: "8px"
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => eliminarFoto(1)}
                      style={{
                        width: "100%",
                        padding: "8px",
                        background: "#ef4444",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontWeight: "600"
                      }}
                    >
                      ✕ Eliminar Foto 1
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFoto1Change}
                      disabled={uploadingFoto1}
                      style={{
                        width: "100%",
                        padding: "8px",
                        border: "1px solid #d1d5db",
                        borderRadius: "6px",
                        cursor: "pointer"
                      }}
                    />
                    {uploadingFoto1 && (
                      <p style={{ marginTop: "8px", color: "#3b82f6", fontSize: "14px" }}>
                        Subiendo foto 1...
                      </p>
                    )}
                    <p style={{ marginTop: "8px", fontSize: "12px", color: "#6b7280" }}>
                      Máximo 5MB • JPG, PNG, GIF
                    </p>
                  </div>
                )}
              </div>

              {/* FOTO 2 */}
              <div style={{
                background: "white",
                padding: "16px",
                borderRadius: "8px",
                border: "2px dashed #d1d5db"
              }}>
                <label style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#374151",
                  marginBottom: "8px"
                }}>
                  Foto 2
                </label>
                
                {foto2Preview ? (
                  <div>
                    <img
                      src={foto2Preview}
                      alt="Preview Foto 2"
                      style={{
                        width: "100%",
                        height: "200px",
                        objectFit: "cover",
                        borderRadius: "8px",
                        marginBottom: "8px"
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => eliminarFoto(2)}
                      style={{
                        width: "100%",
                        padding: "8px",
                        background: "#ef4444",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontWeight: "600"
                      }}
                    >
                      ✕ Eliminar Foto 2
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFoto2Change}
                      disabled={uploadingFoto2}
                      style={{
                        width: "100%",
                        padding: "8px",
                        border: "1px solid #d1d5db",
                        borderRadius: "6px",
                        cursor: "pointer"
                      }}
                    />
                    {uploadingFoto2 && (
                      <p style={{ marginTop: "8px", color: "#3b82f6", fontSize: "14px" }}>
                        Subiendo foto 2...
                      </p>
                    )}
                    <p style={{ marginTop: "8px", fontSize: "12px", color: "#6b7280" }}>
                      Máximo 5MB • JPG, PNG, GIF
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

            {/* Botones de acción */}
            <div style={{ 
              display: "flex", 
              gap: 8, 
              justifyContent: "flex-start",
              marginTop: 12 
            }}>
              <button
                onClick={handleSave}
                disabled={!formularioValido}
                style={{
                  background: "#007acc",
                  color: "white",
                  padding: "8px 16px",
                  border: "none",
                  borderRadius: 6,
                  cursor: formularioValido ? "pointer" : "not-allowed",
                  fontWeight: 600,
                  fontSize: 14,
                  opacity: formularioValido ? 1 : 0.5,
                  transition: "all 0.2s",
                  whiteSpace: "nowrap",
                }}
              >
                {editandoId ? "✓ Actualizar" : "💾 Guardar"}
              </button>
              {editandoId && (
                <button 
                  type="button" 
                  onClick={resetForm} 
                  style={{
                    background: "#64748b",
                    color: "white",
                    padding: "8px 16px",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: 14,
                    transition: "all 0.2s",
                    whiteSpace: "nowrap",
                  }}
                >
                  ❌ Cancelar
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* datalist para sugerencias */}
      {/* cargoOptions ya no necesario - ahora es select */}
      {/* PC ahora es <select>; no usamos datalist para PC */}
      <datalist id="officeOptions">
        {OFFICE_PRESETS.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
      <datalist id="windowsOptions">
        {WINDOWS_PRESETS.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>

      {/* Registros según vista */}
      <h2 style={{ marginTop: 24, textAlign: "center", color: "#111827" }}>
        {vista === "activos" ? "Equipos Activos" : "Equipos dados de Baja"}
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 16,
          marginTop: 12,
        }}
      >
        {filteredRegistros.length === 0 ? (
          <div style={{ ...styles.card, color: "#6b7280", fontWeight: 700 }}>
            {anyFilterActive
              ? "Sin resultados para los filtros seleccionados."
              : "No hay registros."}
          </div>
        ) : (
          filteredRegistros.map((registro) => (
            <div
              key={registro.id}
              style={{
                ...styles.equipoCard,
                background: registro.dadoDeBaja ? "#fef2f2" : "#ffffff",
                borderColor: registro.dadoDeBaja ? "#fca5a5" : "#e5e7eb",
              }}
            >
              {/* Header con nombre y estado */}
              <div style={{
                background: registro.dadoDeBaja ? "#dc2626" : "#007acc",
                padding: "16px",
                borderRadius: "12px 12px 0 0",
                marginBottom: "16px"
              }}>
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "8px"
                }}>
                  <h3 style={{ 
                    margin: 0, 
                    fontSize: 20, 
                    color: "#ffffff", 
                    fontWeight: 800,
                    letterSpacing: 0.5
                  }}>
                    🖥️ {registro.nombrePC || "Equipo"}
                  </h3>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span style={{
                      ...styles.badge,
                      background: "#ffffff",
                      color: registro.dadoDeBaja ? "#dc2626" : "#007acc",
                      borderColor: "#ffffff",
                    }}>
                      {registro.dadoDeBaja ? "❌ DADO DE BAJA" : "✅ ACTIVO"}
                    </span>
                    <span style={{
                      ...styles.badge,
                      background: registro.discoTipo === "solido" ? "#dcfce7" : "#dbeafe",
                      color: registro.discoTipo === "solido" ? "#166534" : "#1e40af",
                      borderColor: registro.discoTipo === "solido" ? "#86efac" : "#93c5fd",
                    }}>
                      {registro.discoTipo === "solido" ? "💾 SSD" : "💿 HDD"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Información del equipo en secciones */}
              <div style={{ padding: "0 16px 16px 16px" }}>
                {/* Sección: Información General */}
                <div style={styles.section}>
                  <div style={styles.sectionTitle}>📋 Información General</div>
                  <div style={styles.infoGrid}>
                    <Row label="👤 Cargo" value={registro.cargo} />
                    <Row label="🏢 N° Activo" value={registro.numeroActivo} />
                    <Row label="🔖 Marca" value={registro.marca} />
                    <Row label="📦 Modelo" value={registro.modelo} />
                  </div>
                </div>

                {/* Sección: Especificaciones Técnicas */}
                <div style={styles.section}>
                  <div style={styles.sectionTitle}>⚙️ Especificaciones Técnicas</div>
                  <div style={styles.infoGrid}>
                    <Row label="💻 Procesador" value={registro.procesador} />
                    <Row label="🧠 RAM" value={registro.ram} />
                    <Row 
                      label="💾 Disco" 
                      value={
                        registro.discoTipo === "solido"
                          ? `SSD - ${registro.discoSolido || "—"}`
                          : `HDD - ${registro.discoMecanico || "—"}`
                      }
                    />
                    <Row label="🌐 IP" value={registro.ip} />
                    <Row label="#️⃣ Serial" value={registro.serial} />
                  </div>
                </div>

                {/* Sección: Software */}
                <div style={styles.section}>
                  <div style={styles.sectionTitle}>💿 Software</div>
                  <div style={styles.infoGrid}>
                    <Row
                      label="🪟 Windows"
                      value={`${registro.windowsVersion || "—"} / ${registro.windowsSerie || "—"}`}
                    />
                    <Row
                      label="📊 Office"
                      value={`${registro.officeVersion || "—"} / ${registro.officeSerie || "—"}`}
                    />
                  </div>
                  {registro.apps?.filter((a) => a && a.trim()).length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 4 }}>Apps Instaladas:</div>
                      <div style={{ 
                        display: "flex", 
                        flexWrap: "wrap", 
                        gap: 4 
                      }}>
                        {registro.apps.filter((a) => a && a.trim()).map((app, idx) => (
                          <span key={idx} style={{
                            background: "#f3f4f6",
                            padding: "4px 8px",
                            borderRadius: 6,
                            fontSize: 11,
                            color: "#374151",
                            border: "1px solid #e5e7eb"
                          }}>
                            {app}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
              </div>

                {/* Sección: Fotos desde Registro Fotográfico */}
                <SeccionFotosEquipo nombrePC={registro.nombrePC} />

              </div>

              {/* Botones de acción */}
              <div style={{
                padding: "16px",
                display: "flex",
                gap: 12,
                borderTop: "2px solid #f3f4f6",
                background: "#fafafa",
                borderRadius: "0 0 12px 12px"
              }}>
                <button 
                  onClick={() => handleEdit(registro)} 
                  style={{
                    ...styles.warnBtn,
                    flex: 1,
                    padding: "12px",
                    fontSize: 14,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6
                  }}
                >
                  ✏️ Editar
                </button>
                <button 
                  onClick={() => handleDelete(registro.id)} 
                  style={{
                    ...styles.dangerBtn,
                    flex: 1,
                    padding: "12px",
                    fontSize: 14,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6
                  }}
                >
                  🗑️ Eliminar
                </button>
              </div>
            </div>
          ))
        )}
      </div>

    </div>
    </LayoutWithSidebar>
  );
}

/* ---------- Subcomponente para filas de datos ---------- */
function Row({ label, value }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 8 }}>
      <div style={{ color: "#6b7280", fontWeight: 700 }}>{label}:</div>
      <div style={{ color: "#111827" }}>{value || "—"}</div>
    </div>
  );
}

/* ------------------------ Estilos ------------------------ */
const styles = {
  equipoCard: {
    border: "2px solid",
    borderRadius: 12,
    background: "white",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
    overflow: "hidden",
    transition: "transform 0.2s, box-shadow 0.2s",
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 800,
    color: "#374151",
    marginBottom: 10,
    paddingBottom: 6,
    borderBottom: "2px solid #e5e7eb",
    letterSpacing: 0.3,
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 8,
  },
  filterBar: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 16,
    display: "grid",
    gap: 12,
    boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
  },
  suggestList: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    background: "white",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    marginTop: 6,
    maxHeight: 240,
    overflowY: "auto",
    boxShadow: "0 12px 24px rgba(0,0,0,0.12)",
    padding: 0,
    zIndex: 50,
  },
  chip: {
    background: "#007acc",
    color: "#ffffff",
    border: "none",
    borderRadius: 999,
    padding: "4px 8px",
    fontSize: 12,
    fontWeight: 800,
  },

  card: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 12,
    background: "white",
    boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
    overflow: "hidden",
  },
  cardHeader: {
    background: "transparent",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: "1px solid #f3f4f6",
    paddingBottom: 6,
    marginBottom: 12,
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
  radioLabel: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "#111827",
    fontWeight: 600,
  },
  inline2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
  },
  rowGrid2: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
    gap: 12,
  },
  rowGrid3: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
    gap: 12,
  },
  appsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
    gap: 8,
  },
  primaryBtn: {
    background: "#007acc",
    color: "white",
    padding: "10px 16px",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 700,
  },
  secondaryBtn: {
    background: "#64748b",
    color: "white",
    padding: "16px 32px",
    border: "2px solid #475569",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 16,
    transition: "all 0.3s ease",
  },
  warnBtn: {
    flex: 1,
    background: "#f39c12",
    color: "white",
    padding: "8px 12px",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 700,
  },
  dangerBtn: {
    flex: 1,
    background: "#dc2626",
    color: "white",
    padding: "12px 16px",
    border: "2px solid #b91c1c",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 14,
    transition: "all 0.3s ease",
  },
  badge: {
    padding: "6px 12px",
    border: "2px solid",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },
  alert: {
    border: "1px solid",
    borderRadius: 8,
    padding: "10px 12px",
    textAlign: "center",
    fontWeight: 700,
  },
  btn: {
    background: "#007acc",
    color: "white",
    padding: "8px 12px",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 700,
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

