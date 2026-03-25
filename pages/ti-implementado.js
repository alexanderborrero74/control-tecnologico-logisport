import { useRouter } from "next/router";
import { useState, useEffect, useMemo, useRef } from "react";
import { db } from "@/firebase/firebaseConfig";
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc } from "firebase/firestore";
import LayoutWithSidebar from "@/components/LayoutWithSidebar";
import PageHeader from "@/components/PageHeader";
import { useUsuarios } from "@/utils/useUsuarios";
import { useCargos } from "@/utils/useCargos";

// Nombres de PC para LOGISPORT
const NOMBRE_PC_PRESETS = Array.from({ length: 100 }, (_, i) => `LOGISPORT${String(i + 1).padStart(3, '0')}`);

export default function TIImplementado() {
  const router = useRouter();
  const [formData, setFormData] = useState({});
  const [registros, setRegistros] = useState([]);
  const [filteredRegistros, setFilteredRegistros] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [mensaje, setMensaje] = useState("");
  const [tipoMensaje, setTipoMensaje] = useState("");

  // Cargar usuarios y cargos desde Firestore
  const { usuarios: usuariosDisponibles } = useUsuarios();
  const { cargos: cargosDisponibles } = useCargos();

  // Soporte de importación
  const fileInputRef = useRef(null);
  const [importedRows, setImportedRows] = useState([]);
  const [importIndex, setImportIndex] = useState(0);

  // Claves tal como las guardas en Firestore
  const headers = [
    "Usuario",
    "Nombre PC",
    "Cargo",
    "Direccion MAC",
    "Clave Equipo",
    "Clave Servidor ",
    "Licencia Office",
    "# Asigncion en Correo",
    "Coreo Licencias Office",
    "Clave Correo",
    "Licencia Free",
    "Licencias Windows",
    "Licencia Antivirus",
    "Clave Basc Antivirus",
    "Control web",
    "Bloqueo USB",
    "Copia seguridad",
    "Observaciones",
  ];

  const mostrarMensaje = (texto, tipo) => {
    setMensaje(texto);
    setTipoMensaje(tipo);
    setTimeout(() => setMensaje(""), 4000);
  };

  const setVal = (key, value) => setFormData((f) => ({ ...f, [key]: value }));

  const handleSave = async () => {
    try {
      if (editingId) {
        await updateDoc(doc(db, "licencias", editingId), formData);
        mostrarMensaje("Registro actualizado correctamente", "success");
        setEditingId(null);
      } else {
        await addDoc(collection(db, "licencias"), formData);
        mostrarMensaje("Datos guardados correctamente", "success");
      }
      setFormData({});
      fetchRegistros();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      console.error("Error al guardar en Firebase:", error);
      mostrarMensaje("Error al guardar los datos", "error");
    }
  };

  const fetchRegistros = async () => {
    try {
      const snapshot = await getDocs(collection(db, "licencias"));
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setRegistros(data);
      setFilteredRegistros(data);
    } catch (error) {
      console.error("Error al obtener datos:", error);
    }
  };

  const handleEdit = (registro) => {
    const { id, ...data } = registro;
    setFormData(data);
    setEditingId(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id) => {
    const confirmDel = window.confirm("¿Estás seguro de que deseas eliminar este registro?");
    if (!confirmDel) return;
    try {
      await deleteDoc(doc(db, "licencias", id));
      mostrarMensaje("Registro eliminado correctamente", "success");
      fetchRegistros();
    } catch (error) {
      console.error("Error al eliminar registro:", error);
      mostrarMensaje("Error al eliminar el registro", "error");
    }
  };

  useEffect(() => {
    fetchRegistros();
  }, []);

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

  // Catálogos (datalist): unimos lo guardado + presets
  const options = useMemo(() => {
    const uniq = (arr) => Array.from(new Set(arr.filter(Boolean).map((s) => String(s).trim())));

    const usuariosGuardados = uniq(registros.map((r) => r["Usuario"]));
    const cargosGuardados = uniq(registros.map((r) => r["Cargo"]));
    const pcsGuardados = uniq(registros.map((r) => r["Nombre PC"]));

    return {
      usuarios: uniq([...opcionesUsuarios, ...usuariosGuardados]),
      cargos: uniq([...opcionesCargos, ...cargosGuardados]),
      pcs: uniq([...NOMBRE_PC_PRESETS, ...pcsGuardados]),
    };
  }, [registros, opcionesUsuarios, opcionesCargos]);

  // Reglas: todos los campos obligatorios
  const todosLosCamposCompletos = headers.every((key) => formData[key] && String(formData[key]).trim() !== "");

  // Utilidades de importación
  const normalizeKey = (s) =>
    String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  const canonicalMap = useMemo(() => {
    const m = new Map();
    headers.forEach((h) => m.set(normalizeKey(h), h));
    return m;
  }, [headers]);

  const applyRowToForm = (row) =>
    setFormData((prev) => {
      const next = { ...prev };
      headers.forEach((h) => {
        if (Object.prototype.hasOwnProperty.call(row, h)) next[h] = row[h];
      });
      return next;
    });

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;

      const mod = await import("xlsx/dist/xlsx.full.min.js");
      const XLSX = mod?.default || mod;

      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheetName = wb.SheetNames[0];
      if (!sheetName) throw new Error("No se encontró ninguna hoja en el archivo.");
      const ws = wb.Sheets[sheetName];

      const rawRows = XLSX.utils.sheet_to_json(ws, { defval: "" });
      if (!rawRows.length) {
        mostrarMensaje("El archivo no contiene filas.", "error");
        return;
      }

      const mapped = rawRows.map((r) => {
        const out = {};
        Object.entries(r).forEach(([k, v]) => {
          const canon = canonicalMap.get(normalizeKey(k));
          if (canon) out[canon] = v;
        });
        return out;
      });

      setImportedRows(mapped);
      setImportIndex(0);
      applyRowToForm(mapped[0] || {});
      mostrarMensaje(
        mapped.length > 1
          ? `Se importaron ${mapped.length} filas. Aplicada la fila 1.`
          : `Archivo importado. Formulario rellenado.`,
        "success"
      );

      e.target.value = "";
    } catch (err) {
      console.error("[Importar Excel]", err);
      mostrarMensaje("No se pudo leer el archivo. Revisa que sea .xlsx con encabezados correctos.", "error");
    }
  };

  const goPrevRow = () => {
    if (!importedRows.length) return;
    const next = Math.max(0, importIndex - 1);
    setImportIndex(next);
    applyRowToForm(importedRows[next] || {});
  };

  const goNextRow = () => {
    if (!importedRows.length) return;
    const next = Math.min(importedRows.length - 1, importIndex + 1);
    setImportIndex(next);
    applyRowToForm(importedRows[next] || {});
  };

  const isRowComplete = (row) => headers.every((h) => row[h] && String(row[h]).trim() !== "");
  const completeCount = useMemo(() => importedRows.filter(isRowComplete).length, [importedRows]);

  const handleSaveAll = async () => {
    try {
      if (!importedRows.length) {
        mostrarMensaje("No hay filas importadas para guardar.", "error");
        return;
      }

      const rowsToSave = importedRows.filter(isRowComplete);
      if (!rowsToSave.length) {
        mostrarMensaje("Ninguna fila está completa según los campos requeridos.", "error");
        return;
      }

      for (const row of rowsToSave) {
        await addDoc(collection(db, "licencias"), row);
      }

      mostrarMensaje(`Se guardaron ${rowsToSave.length} registros desde el Excel.`, "success");
      setImportedRows([]);
      setImportIndex(0);
      setFormData({});
      fetchRegistros();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      console.error("[Guardar todas las filas]", error);
      mostrarMensaje("Ocurrió un error guardando el lote.", "error");
    }
  };

  return (
    <LayoutWithSidebar>
      <PageHeader titulo="TI Implementado" />
      
      <div style={{ padding: 20, fontFamily: "Arial, sans-serif" }}>
        {/* Encabezado */}
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 1100,
            backgroundColor: "#007acc",
            color: "white",
            padding: 10,
            borderRadius: 10,
            boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
            display: "grid",
            justifyItems: "center",
            gap: 12,
            marginBottom: 12,
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
            Implementación usuarios · equipos · aplicaciones · licencias
          </h1>

          {mensaje && (
            <div
              style={{
                ...styles.alert,
                background: tipoMensaje === "success" ? "#ecfccb" : "#fee2e2",
                color: tipoMensaje === "success" ? "#3f6212" : "#991b1b",
                borderColor: tipoMensaje === "success" ? "#a3e635" : "#fca5a5",
                width: "100%",
              }}
            >
              {mensaje}
            </div>
          )}
        </div>

        {/* Formulario en tarjeta */}
        <div style={{ marginTop: 16 }}>
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <h3 style={{ margin: 0, fontSize: 20, color: "#111827" }}>
                {editingId ? "Editar registro" : "Nuevo registro"}
              </h3>

              {/* Acciones de importación/guardado masivo */}
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {importedRows.length > 0 && (
                  <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 700 }}>
                    {importedRows.length} filas importadas · {completeCount} completas
                  </span>
                )}
                <button onClick={handleImportClick} style={styles.secondaryBtn} title="Importar desde Excel">
                  IMPORTAR EXCEL
                </button>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileChange} style={{ display: "none" }} />
                <button
                  onClick={handleSaveAll}
                  style={{ ...styles.primaryBtn, opacity: completeCount ? 1 : 0.5, cursor: completeCount ? "pointer" : "not-allowed" }}
                  disabled={!completeCount}
                  title={completeCount ? "Guardar todas las filas completas" : "No hay filas completas para guardar"}
                >
                  GUARDAR TODO
                </button>
              </div>
            </div>

            {/* Controles compactos si hay varias filas importadas */}
            {importedRows.length > 1 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, justifyContent: "flex-end" }}>
                <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 700 }}>
                  Fila importada: {importIndex + 1} / {importedRows.length}
                </span>
                <button onClick={goPrevRow} style={styles.secondaryBtn} title="Aplicar fila anterior">
                  ◀ Anterior
                </button>
                <button onClick={goNextRow} style={styles.secondaryBtn} title="Aplicar fila siguiente">
                  Siguiente ▶
                </button>
              </div>
            )}

            <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
              {/* Fila 1 */}
              <div style={styles.rowGrid3}>
                <Field label="Usuario" value={formData["Usuario"] || ""} onChange={(v) => setVal("Usuario", v)} listId="usuarioOptions" />
                <Field label="Nombre PC" value={formData["Nombre PC"] || ""} onChange={(v) => setVal("Nombre PC", v)} listId="pcOptions" />
                <Field label="Cargo" value={formData["Cargo"] || ""} onChange={(v) => setVal("Cargo", v)} listId="cargoOptions" />
              </div>

              {/* Fila 2 */}
              <div style={styles.rowGrid3}>
                <Field label="Direccion MAC" value={formData["Direccion MAC"] || ""} onChange={(v) => setVal("Direccion MAC", v)} />
                <Field label="Clave Equipo" value={formData["Clave Equipo"] || ""} onChange={(v) => setVal("Clave Equipo", v)} />
                <Field label="Clave Servidor " value={formData["Clave Servidor "] || ""} onChange={(v) => setVal("Clave Servidor ", v)} />
              </div>

              {/* Fila 3 */}
              <div style={styles.rowGrid3}>
                <Field label="Licencia Office" value={formData["Licencia Office"] || ""} onChange={(v) => setVal("Licencia Office", v)} />
                <Field label="# Asigncion en Correo" value={formData["# Asigncion en Correo"] || ""} onChange={(v) => setVal("# Asigncion en Correo", v)} />
                <Field label="Coreo Licencias Office" value={formData["Coreo Licencias Office"] || ""} onChange={(v) => setVal("Coreo Licencias Office", v)} />
              </div>

              {/* Fila 4 */}
              <div style={styles.rowGrid3}>
                <Field label="Clave Correo" value={formData["Clave Correo"] || ""} onChange={(v) => setVal("Clave Correo", v)} />
                <Field label="Licencia Free" value={formData["Licencia Free"] || ""} onChange={(v) => setVal("Licencia Free", v)} />
                <Field label="Licencias Windows" value={formData["Licencias Windows"] || ""} onChange={(v) => setVal("Licencias Windows", v)} />
              </div>

              {/* Fila 5 */}
              <div style={styles.rowGrid3}>
                <Field label="Licencia Antivirus" value={formData["Licencia Antivirus"] || ""} onChange={(v) => setVal("Licencia Antivirus", v)} />
                <Field label="Clave Basc Antivirus" value={formData["Clave Basc Antivirus"] || ""} onChange={(v) => setVal("Clave Basc Antivirus", v)} />
                <Field label="Observaciones" value={formData["Observaciones"] || ""} onChange={(v) => setVal("Observaciones", v)} />
              </div>

              {/* Fila 6: selectores */}
              <div style={styles.rowGrid3}>
                <Field label="Control web" value={formData["Control web"] || ""} onChange={(v) => setVal("Control web", v)} type="select" options={["", "Sí", "No"]} />
                <Field label="Bloqueo USB" value={formData["Bloqueo USB"] || ""} onChange={(v) => setVal("Bloqueo USB", v)} type="select" options={["", "Sí", "No"]} />
                <Field label="Copia seguridad" value={formData["Copia seguridad"] || ""} onChange={(v) => setVal("Copia seguridad", v)} type="select" options={["", "Google Drive", "One Drive", "Nube Privada", "Otras"]} />
              </div>

              {/* Botón Guardar individual */}
              <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 4 }}>
                <button
                  onClick={handleSave}
                  disabled={!todosLosCamposCompletos}
                  style={{
                    ...styles.primaryBtn,
                    opacity: todosLosCamposCompletos ? 1 : 0.5,
                    cursor: todosLosCamposCompletos ? "pointer" : "not-allowed",
                  }}
                >
                  {editingId ? "ACTUALIZAR" : "GUARDAR"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* datalist – catálogos unificados */}
        <datalist id="usuarioOptions">
          {options.usuarios.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
        <datalist id="pcOptions">
          {options.pcs.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
        <datalist id="cargoOptions">
          {options.cargos.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>

        {/* Registros guardados (cards) */}
        <h2 style={{ marginTop: 24, textAlign: "center", color: "#111827" }}>Registros Guardados</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 16,
            marginTop: 12,
          }}
        >
          {filteredRegistros.map((registro) => (
            <div key={registro.id} style={styles.card}>
              <div style={styles.cardHeader}>
                <h3 style={{ margin: 0, fontSize: 18, color: "#111827" }}>{registro["Usuario"] || "Usuario"}</h3>
                <span style={{ ...styles.badge, background: "#e0f2fe", color: "#075985" }}>
                  {registro["Nombre PC"] || "Equipo"}
                </span>
              </div>

              <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                {headers.map((key) => (
                  <Row key={key} label={key} value={registro[key]} />
                ))}
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
          ))}
        </div>
      </div>
    </LayoutWithSidebar>
  );
}

/* ---------- Subcomponentes ---------- */
function Field({ label, value, onChange, type = "text", listId, options = [] }) {
  return (
    <div>
      <label style={styles.label}>{label}</label>
      {type === "select" ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} style={styles.input}>
          {options.map((opt, i) => (
            <option key={i} value={opt}>
              {opt || "Selecciona"}
            </option>
          ))}
        </select>
      ) : (
        <input type="text" list={listId} value={value} onChange={(e) => onChange(e.target.value)} style={styles.input} />
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 8 }}>
      <div style={{ color: "#6b7280", fontWeight: 700 }}>{label}:</div>
      <div style={{ color: "#111827" }}>{value || "—"}</div>
    </div>
  );
}

/* ------------------------ Estilos ------------------------ */
const styles = {
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
    padding: "12px 12px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    outline: "none",
    background: "#ffffff",
    color: "#0f172a",
    minWidth: 0,
  },
  rowGrid3: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
    gap: 12,
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
};
