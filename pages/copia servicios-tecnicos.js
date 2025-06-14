import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { db } from "@/firebase/firebaseConfig";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc
} from "firebase/firestore";

export default function ServiciosTecnicos() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    usuario: "",
    fecha: "",
    cargo: "",
    equipo: "",
    falla: "",
    diagnostico: "",
    solucion: "",
    aplazado: "no",
    motivoAplazado: "",
    partes: [],
    limpieza: false,
    mantenimiento: false,
    cambioClave: false,
    visitaPreventiva: false,
    visitaCorrectiva: false,
    tecnico: "",
    observacion: "",
    visitaTecnica: "" // ✅ NUEVO CAMPO
  });

  const [registros, setRegistros] = useState([]);
  const [editandoId, setEditandoId] = useState(null);
  const [mensaje, setMensaje] = useState("");
  const [filtroTexto, setFiltroTexto] = useState("");

  const partesOpciones = ["Disco duro", "Board", "Memoria RAM", "Pantalla", "Equipo", "Teclado"];

  const cargarRegistros = async () => {
    const snapshot = await getDocs(collection(db, "serviciosTecnicos"));
    setRegistros(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  useEffect(() => {
    cargarRegistros();
  }, []);

  const handleChange = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const toggleParte = (parte) => {
    setFormData(prev => {
      const partes = prev.partes.includes(parte)
        ? prev.partes.filter(p => p !== parte)
        : [...prev.partes, parte];
      return { ...prev, partes };
    });
  };

  const toggleCheckbox = (key) => {
    setFormData(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const resetForm = () => {
    setFormData({
      usuario: "",
      fecha: "",
      cargo: "",
      equipo: "",
      falla: "",
      diagnostico: "",
      solucion: "",
      aplazado: "no",
      motivoAplazado: "",
      partes: [],
      limpieza: false,
      mantenimiento: false,
      cambioClave: false,
      visitaPreventiva: false,
      visitaCorrectiva: false,
      tecnico: "",
      observacion: "",
      visitaTecnica: "" // ✅ RESETEADO
    });
    setEditandoId(null);
  };

  const camposRequeridos = ["usuario", "fecha", "cargo", "equipo", "falla", "diagnostico", "solucion", "tecnico"];
  const formValido = camposRequeridos.every(key => formData[key]?.trim() !== "");

  const handleSave = async () => {
    const data = { ...formData };
    try {
      if (editandoId) {
        await updateDoc(doc(db, "serviciosTecnicos", editandoId), data);
        setMensaje("Registro actualizado");
      } else {
        await addDoc(collection(db, "serviciosTecnicos"), data);
        setMensaje("Registro guardado");
      }
      resetForm();
      await cargarRegistros();
    } catch (err) {
      console.error(err);
      setMensaje("Error al guardar");
    }
    setTimeout(() => setMensaje(""), 3000);
  };

  const handleEdit = (registro) => {
    setFormData({ ...registro });
    setEditandoId(registro.id);
  };

  const handleDelete = async (id) => {
    await deleteDoc(doc(db, "serviciosTecnicos", id));
    if (editandoId === id) resetForm();
    await cargarRegistros();
  };

  const inputStyle = {
    backgroundColor: "#e0f7fa",
    padding: 4,
    margin: 4
  };

  const botonAccionStyle = {
    backgroundColor: "#2c3e50",
    color: "white",
    border: "none",
    padding: "6px 10px",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "bold",
    margin: "2px"
  };

  const registrosFiltrados = registros.filter(r =>
    (r.usuario?.toLowerCase().includes(filtroTexto) || r.equipo?.toLowerCase().includes(filtroTexto))
  );

  return (
    <div style={{ padding: 24, marginTop: "80px" }}>
      <h1 style={{ textAlign: "center", fontWeight: "900" }}>SERVICIOS TÉCNICOS REALIZADOS</h1>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        {["usuario", "fecha", "cargo", "equipo", "falla", "diagnostico", "solucion", "tecnico", "observacion"].map(key => (
          <div key={key}>
            <label>{key.charAt(0).toUpperCase() + key.slice(1)}</label>
            <input
              type={key === "fecha" ? "date" : "text"}
              value={formData[key]}
              onChange={(e) => handleChange(key, e.target.value)}
              style={inputStyle}
            />
          </div>
        ))}

        {/* ✅ NUEVA CASILLA VISITA TÉCNICA */}
        <div>
          <label>Visita Técnica:</label><br />
          <label>
            <input
              type="radio"
              name="visitaTecnica"
              value="virtual"
              checked={formData.visitaTecnica === "virtual"}
              onChange={(e) => handleChange("visitaTecnica", e.target.value)}
            /> Virtual
          </label><br />
          <label>
            <input
              type="radio"
              name="visitaTecnica"
              value="presencial"
              checked={formData.visitaTecnica === "presencial"}
              onChange={(e) => handleChange("visitaTecnica", e.target.value)}
            /> Presencial
          </label>
        </div>
      </div>

      <div style={{ marginTop: "20px" }}>
        <button
          onClick={handleSave}
          disabled={!formValido}
          style={{
            padding: "10px 20px",
            backgroundColor: formValido ? "#27ae60" : "#ccc",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: formValido ? "pointer" : "not-allowed"
          }}
        >
          Guardar
        </button>
      </div>

      <h2 style={{ marginTop: 32 }}>Registros guardados</h2>

      <input
        type="text"
        placeholder="Filtrar por usuario o equipo"
        value={filtroTexto}
        onChange={(e) => setFiltroTexto(e.target.value.toLowerCase())}
        style={{
          width: "100%",
          padding: 8,
          borderRadius: 4,
          border: "1px solid #ccc",
          backgroundColor: "#f0f8ff",
          marginBottom: 16
        }}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "12px" }}>
        {registrosFiltrados.map((r) => (
          <div key={r.id} style={{ border: "1px solid #ccc", borderRadius: "8px", padding: "12px", backgroundColor: "#f9f9f9" }}>
            <div><strong>Usuario:</strong> {r.usuario}</div>
            <div><strong>Fecha:</strong> {r.fecha}</div>
            <div><strong>Equipo:</strong> {r.equipo}</div>
            <div><strong>Diagnóstico:</strong> {r.diagnostico}</div>
            <div><strong>Solución:</strong> {r.solucion}</div>
            <div><strong>Visita Técnica:</strong> {r.visitaTecnica}</div> {/* ✅ VISUALIZACIÓN */}
            <div style={{ marginTop: "8px" }}>
              <button onClick={() => handleEdit(r)} style={{ ...botonAccionStyle, backgroundColor: "#f39c12" }}>Editar</button>
              <button onClick={() => handleDelete(r.id)} style={{ ...botonAccionStyle, backgroundColor: "#c0392b" }}>Eliminar</button>
            </div>
          </div>
        ))}
      </div>

      <button
        style={{
          position: "fixed",
          bottom: "20px",
          left: "20px",
          padding: "10px 20px",
          backgroundColor: "#2980b9",
          color: "white",
          border: "none",
          borderRadius: "5px",
          cursor: "pointer"
        }}
        onClick={() => router.push("/")}
      >
        ⬅ Regresar
      </button>
    </div>
  );
}
