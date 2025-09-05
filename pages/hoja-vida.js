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
} from "firebase/firestore";
import * as XLSX from "xlsx";
import { addManyToCatalog, watchCatalogs } from "@/utils/catalogs";

/* ==================== PRESETS solicitados ==================== */
const CARGO_PRESETS = [
  "gerencia",
  "asistente administrativa",
  "auxiliar contable",
  "auxiliar comercio exterior",
  "analista comercio exterior",
  "jefe de exportacion",
  "jefe de importacion",
  "Tramitadores",
  "Analista importacion",
  "Revisora importacion",
  "Auxiliar aduanero",
  "Auxiliar de comercio exterior",
  "Aprendiz sena",
  "Auxiliar operativo",
  "Auxiliar administrativo y coserje",
  "Archivo",
];

const NOMBRE_PC_PRESETS = Array.from({ length: 100 }, (_, i) => {
  const n = String(i + 1).padStart(3, "0");
  return `SIDECOMEX${n}`;
});

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

/* ============ Filtro genérico con autocompletado (una casilla) ============ */
const AutoFilter = memo(function AutoFilter({ label, options, value, onChange, placeholder = "Escribe para filtrar…" }) {
  const [query, setQuery] = useState(value || "");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const boxRef = useRef(null);

  useEffect(() => { setQuery(value || ""); }, [value]);

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
    return filtered.sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" })).slice(0, 25);
  }, [options, query]);

  const pick = (v) => { onChange(v); setQuery(v); setOpen(false); };
  const clear = () => { onChange(""); setQuery(""); setOpen(false); setHi(0); };

  const onKeyDown = (e) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) { setOpen(true); return; }
    if (!open && e.key === "Enter") {
      const exact = (options || []).find((o) => o?.toLowerCase() === (query || "").trim().toLowerCase());
      pick(exact || "");
      return;
    }
    if (open) {
      if (e.key === "ArrowDown") { e.preventDefault(); setHi((i) => Math.min(i + 1, Math.max(0, list.length - 1))); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setHi((i) => Math.max(i - 1, 0)); }
      else if (e.key === "Enter") { e.preventDefault(); pick(list[hi] || ""); }
      else if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
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
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setHi(0); }}
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
              position: "absolute", right: 8, top: 8,
              background: "transparent", border: 0, cursor: "pointer", fontSize: 16, color: "#111827"
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
                  onMouseDown={(e) => { e.preventDefault(); pick(opt); }}
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
        <div style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={styles.chip}>{value}</span>
          <button type="button" style={{ ...styles.btn, background: "#6b7280" }} onClick={clear}>
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
    apps: Array(10).fill(""),
  });
  const [mensaje, setMensaje] = useState("");
  const [tipoMensaje, setTipoMensaje] = useState("");
  const [registros, setRegistros] = useState([]);
  const [editandoId, setEditandoId] = useState(null);

  // Catálogos compartidos
  const [catCargos, setCatCargos] = useState([]);
  const [catPCs, setCatPCs] = useState([]);

  useEffect(() => {
    const unsub = watchCatalogs({
      onCargos: setCatCargos,
      onPcs: setCatPCs,
    });
    return () => unsub && unsub();
  }, []);

  // ------ Carga de datos ------
  const cargarRegistros = async () => {
    const querySnapshot = await getDocs(collection(db, "hojaVidaEquipos"));
    const docs = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    setRegistros(docs);
  };
  useEffect(() => { cargarRegistros(); }, []);

  const handleChange = (key, value) => setFormData({ ...formData, [key]: value });
  const handleAppChange = (index, value) => {
    const updatedApps = [...formData.apps];
    updatedApps[index] = value;
    setFormData({ ...formData, apps: updatedApps });
  };
  const resetForm = () => {
    setFormData({
      cargo: "", nombrePC: "", procesador: "", ip: "", ram: "",
      discoTipo: "", discoSolido: "", discoMecanico: "",
      windowsVersion: "", windowsSerie: "",
      officeVersion: "", officeSerie: "",
      serial: "", numeroActivo: "",
      marca: "", modelo: "",
      dadoDeBaja: false,
      apps: Array(10).fill(""),
    });
    setEditandoId(null);
  };

  const handleSave = async () => {
    const dataToSave = { ...formData };
    delete dataToSave.id;
    try {
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
        await addDoc(collection(db, "hojaVidaEquipos"), dataToSave);
        setMensaje("Datos guardados exitosamente.");
      }

      // Alimentar catálogos compartidos
      await addManyToCatalog({
        cargo: formData.cargo,
        pc: formData.nombrePC,
        usuario: "", // Hoja de vida no maneja usuario aquí
      });

      setTipoMensaje("success");
      resetForm();
      await cargarRegistros();
    } catch (error) {
      console.error("Error al guardar/actualizar:", error);
      setMensaje("Error al guardar los datos.");
      setTipoMensaje("error");
    }
    setTimeout(() => setMensaje(""), 3000);
  };

  const handleDelete = async (id) => {
    const confirmacion = window.confirm("¿Estás seguro de que deseas eliminar este registro?");
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

      // alimentar catálogos importados
      await addManyToCatalog({
        cargo: registro.cargo,
        pc: registro.nombrePC,
        usuario: "",
      });
    }
    cargarRegistros();
    alert("Importación completada");
    e.target.value = "";
  };

  // Validación: todos los campos string no vacíos + apps no vacías + disco seleccionado correctamente
  const formularioValido = useMemo(() => {
    const requiredKeys = [
      "cargo","nombrePC","procesador","ip","ram",
      "windowsVersion","windowsSerie","officeVersion","officeSerie",
      "serial","numeroActivo","marca","modelo",
    ];
    for (const k of requiredKeys) {
      if (!String(formData[k] || "").trim()) return false;
    }
    if (!formData.discoTipo) return false;
    if (formData.discoTipo === "solido" && !String(formData.discoSolido || "").trim()) return false;
    if (formData.discoTipo === "mecanico" && !String(formData.discoMecanico || "").trim()) return false;

    // Apps: (si quieres exigir todas, descomenta)
    // if (!formData.apps.every((a) => String(a || "").trim())) return false;

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
  const merge = (...arrs) => Array.from(new Set(arrs.flat().filter(Boolean)));

  const options = useMemo(() => {
    return {
      numeroActivo: uniq(registros.map((r) => r.numeroActivo?.trim()).filter(Boolean)),
      nombrePC: merge(
        uniq(registros.map((r) => r.nombrePC?.trim()).filter(Boolean)),
        NOMBRE_PC_PRESETS,
        catPCs
      ),
    };
  }, [registros, catPCs]);

  const anyFilterActive = useMemo(
    () => Object.values(filters).some((v) => v && v.trim() !== ""),
    [filters]
  );

  const contains = (src, f) => {
    if (!f) return true;
    return String(src || "").toLowerCase().includes(String(f).toLowerCase());
  };

  const filteredRegistros = useMemo(() => {
    // filtra por vista (activos o baja) y por filtros de cabecera
    const base = registros.filter((r) => (vista === "activos" ? !r.dadoDeBaja : !!r.dadoDeBaja));
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
      disco: r.discoTipo === "solido" ? `Sólido - ${r.discoSolido || ""}` : `Mecánico - ${r.discoMecanico || ""}`,
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
    XLSX.utils.book_append_sheet(wb, ws, vista === "activos" ? "Activos" : "Baja");
    XLSX.writeFile(wb, `equipos_${vista}.xlsx`);
  };

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
            <h3 style={{ margin: 0, fontSize: 18, color: "#111827" }}>Importar desde Excel</h3>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
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
            <AutoFilter label="Número de activo" options={options.numeroActivo} value={filters.numeroActivo} onChange={(v) => setFilter("numeroActivo", v)} />
            <AutoFilter label="Nombre PC" options={options.nombrePC} value={filters.nombrePC} onChange={(v) => setFilter("nombrePC", v)} />
          </div>

          {!anyFilterActive && (
            <div style={{ ...styles.alert, background: "#fff", borderColor: "#e5e7eb", color: "#6b7280" }}>
              Puedes filtrar por número de activo o nombre del PC.
            </div>
          )}
        </div>
      </div>

      {/* Formulario en tarjeta */}
      <div style={{ marginTop: 16 }}>
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={{ margin: 0, fontSize: 20, color: "#111827" }}>{editandoId ? "Editar equipo" : "Nuevo equipo"}</h3>
          </div>

          <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
            <div style={styles.rowGrid3}>
              <div>
                <label style={styles.label}>Cargo</label>
                <input
                  type="text"
                  list="cargoOptions"
                  style={styles.input}
                  value={formData.cargo}
                  onChange={(e) => handleChange("cargo", e.target.value)}
                />
              </div>
              <div>
                <label style={styles.label}>Nombre PC</label>
                <input
                  type="text"
                  list="pcOptions"
                  style={styles.input}
                  value={formData.nombrePC}
                  onChange={(e) => handleChange("nombrePC", e.target.value)}
                />
              </div>
              <div>
                <label style={styles.label}>Procesador</label>
                <input type="text" style={styles.input} value={formData.procesador} onChange={(e) => handleChange("procesador", e.target.value)} />
              </div>
            </div>

            <div style={styles.rowGrid3}>
              <div>
                <label style={styles.label}>IP</label>
                <input type="text" style={styles.input} value={formData.ip} onChange={(e) => handleChange("ip", e.target.value)} />
              </div>
              <div>
                <label style={styles.label}>Memoria RAM</label>
                <input type="text" style={styles.input} value={formData.ram} onChange={(e) => handleChange("ram", e.target.value)} />
              </div>
              <div>
                <label style={styles.label}>Disco</label>
                <div style={{ display: "grid", gap: 6 }}>
                  <label style={styles.radioLabel}>
                    <input type="radio" name="discoTipo" value="solido" checked={formData.discoTipo === "solido"} onChange={(e) => handleChange("discoTipo", e.target.value)} />
                    Sólido
                  </label>
                  {formData.discoTipo === "solido" && (
                    <input type="text" style={styles.input} placeholder="Tamaño" value={formData.discoSolido} onChange={(e) => handleChange("discoSolido", e.target.value)} />
                  )}

                  <label style={styles.radioLabel}>
                    <input type="radio" name="discoTipo" value="mecanico" checked={formData.discoTipo === "mecanico"} onChange={(e) => handleChange("discoTipo", e.target.value)} />
                    Mecánico
                  </label>
                  {formData.discoTipo === "mecanico" && (
                    <input type="text" style={styles.input} placeholder="Tamaño" value={formData.discoMecanico} onChange={(e) => handleChange("discoMecanico", e.target.value)} />
                  )}
                </div>
              </div>
            </div>

            {/* Serial / N° activo / Marca / Modelo / Dado de baja */}
            <div style={styles.rowGrid3}>
              <div>
                <label style={styles.label}>Serial</label>
                <input type="text" style={styles.input} value={formData.serial} onChange={(e) => handleChange("serial", e.target.value)} />
              </div>
              <div>
                <label style={styles.label}>Número de activo</label>
                <input type="text" style={styles.input} value={formData.numeroActivo} onChange={(e) => handleChange("numeroActivo", e.target.value)} />
              </div>
              <div>
                <label style={styles.label}>Marca</label>
                <input type="text" style={styles.input} value={formData.marca} onChange={(e) => handleChange("marca", e.target.value)} />
              </div>
            </div>
            <div style={styles.rowGrid3}>
              <div>
                <label style={styles.label}>Modelo</label>
                <input type="text" style={styles.input} value={formData.modelo} onChange={(e) => handleChange("modelo", e.target.value)} />
              </div>
              <div>
                <label style={styles.label}>Equipo dado de baja</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={!!formData.dadoDeBaja}
                    onChange={(e) => handleChange("dadoDeBaja", e.target.checked)}
                  />
                  <span style={{ color: formData.dadoDeBaja ? "#dc2626" : "#111827", fontWeight: 700 }}>
                    {formData.dadoDeBaja ? "Sí" : "No"}
                  </span>
                </div>
              </div>
            </div>

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
                    onChange={(e) => handleChange("windowsVersion", e.target.value)}
                  />
                  <input type="text" style={styles.input} placeholder="# Serie" value={formData.windowsSerie} onChange={(e) => handleChange("windowsSerie", e.target.value)} />
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
                    onChange={(e) => handleChange("officeVersion", e.target.value)}
                  />
                  <input type="text" style={styles.input} placeholder="# Serie" value={formData.officeSerie} onChange={(e) => handleChange("officeSerie", e.target.value)} />
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
                  background: tipoMensaje === "success" ? "#ecfccb" : "#fee2e2",
                  color: tipoMensaje === "success" ? "#3f6212" : "#991b1b",
                  borderColor: tipoMensaje === "success" ? "#a3e635" : "#fca5a5",
                }}
              >
                {mensaje}
              </div>
            )}

            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 4 }}>
              <button
                onClick={handleSave}
                disabled={!formularioValido}
                style={{
                  ...styles.primaryBtn,
                  opacity: formularioValido ? 1 : 0.5,
                  cursor: formularioValido ? "pointer" : "not-allowed",
                }}
              >
                {editandoId ? "ACTUALIZAR" : "GUARDAR"}
              </button>
              {editandoId && (
                <button type="button" onClick={resetForm} style={styles.secondaryBtn}>
                  Cancelar edición
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* datalist para sugerencias */}
      <datalist id="cargoOptions">
        {[...new Set([...CARGO_PRESETS, ...catCargos])].map((o) => <option key={o} value={o} />)}
      </datalist>
      <datalist id="pcOptions">
        {[...new Set([...NOMBRE_PC_PRESETS, ...catPCs])].map((o) => <option key={o} value={o} />)}
      </datalist>
      <datalist id="officeOptions">
        {OFFICE_PRESETS.map((o) => <option key={o} value={o} />)}
      </datalist>
      <datalist id="windowsOptions">
        {WINDOWS_PRESETS.map((o) => <option key={o} value={o} />)}
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
            {anyFilterActive ? "Sin resultados para los filtros seleccionados." : "No hay registros."}
          </div>
        ) : (
          filteredRegistros.map((registro) => (
            <div key={registro.id} style={{ ...styles.card, background: registro.dadoDeBaja ? "#fee2e2" : "white" }}>
              <div style={styles.cardHeader}>
                <h3 style={{ margin: 0, fontSize: 18, color: "#111827" }}>{registro.nombrePC || "Equipo"}</h3>
                <span
                  style={{
                    ...styles.badge,
                    background: registro.discoTipo === "solido" ? "#ecfccb" : "#e0f2fe",
                    color: registro.discoTipo === "solido" ? "#3f6212" : "#075985",
                  }}
                >
                  {registro.discoTipo === "solido" ? "Disco Sólido" : "Disco Mecánico"}
                </span>
              </div>

              <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                <Row label="Cargo" value={registro.cargo} />
                <Row label="Procesador" value={registro.procesador} />
                <Row label="IP" value={registro.ip} />
                <Row label="RAM" value={registro.ram} />
                <Row label="Serial" value={registro.serial} />
                <Row label="N° Activo" value={registro.numeroActivo} />
                <Row label="Marca" value={registro.marca} />
                <Row label="Modelo" value={registro.modelo} />
                <Row
                  label="Disco"
                  value={
                    registro.discoTipo === "solido"
                      ? `Sólido - ${registro.discoSolido || "—"}`
                      : `Mecánico - ${registro.discoMecanico || "—"}`
                  }
                />
                <Row label="Windows" value={`${registro.windowsVersion || "—"} / ${registro.windowsSerie || "—"}`} />
                <Row label="Office" value={`${registro.officeVersion || "—"} / ${registro.officeSerie || "—"}`} />
                <Row label="Apps" value={registro.apps?.filter((a) => a && a.trim()).join(", ") || "Ninguna"} />
                <Row label="Estado" value={registro.dadoDeBaja ? "Dado de baja" : "Activo"} />
              </div>

              <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between" }}>
                <button onClick={() => handleEdit(registro)} style={styles.warnBtn}>
                  Editar
                </button>
                <button onClick={() => handleDelete(registro.id)} style={styles.dangerBtn}>
                  Eliminar
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Botón fijo Regresar */}
      <button
        style={{ ...styles.backBtn, left: 40 }} // ← si quieres moverlo más a la derecha, aumenta este valor
        onClick={() => router.push("/")}
        title="Volver al inicio"
      >
        ⬅ Regresar
      </button>
    </div>
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
  filterBar: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: 12,
    display: "grid",
    gap: 6,
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
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
    background: "#1e40af",
    color: "#ffffff",
    borderRadius: 999,
    padding: "4px 10px",
    fontSize: 12,
    fontWeight: 800,
  },

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
  },

  label: {
    display: "block",
    fontSize: 12,
    color: "#6b7280",
    fontWeight: 700,
    marginBottom: 4,
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
    background: "#6b7280",
    color: "white",
    padding: "8px 12px",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 700,
  },
  warnBtn: {
    background: "#f39c12",
    color: "white",
    padding: "8px 12px",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 700,
  },
  dangerBtn: {
    background: "#c0392b",
    color: "white",
    padding: "8px 12px",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 700,
  },
  badge: {
    padding: "4px 8px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
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
    padding: "6px 10px",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 700,
  },
  backBtn: {
    position: "fixed",
    bottom: 20,
    left: 40,
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
