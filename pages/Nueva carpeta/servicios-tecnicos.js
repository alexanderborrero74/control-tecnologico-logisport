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
    observacion: ""
  });
  const [registros, setRegistros] = useState([]);
  const [editandoId, setEditandoId] = useState(null);
  const [mensaje, setMensaje] = useState("");
  const [filtroTexto, setFiltroTexto] = useState(""); // Nuevo estado para el filtro

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
      observacion: ""
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

  // Filtrar registros según el texto ingresado
  const registrosFiltrados = registros.filter(r =>
    (r.usuario?.toLowerCase().includes(filtroTexto) || r.equipo?.toLowerCase().includes(filtroTexto))
  );
  

  return (
    <div style={{ padding: 24, marginTop: "80px" }}>
      <div style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: -1,
        opacity: 0.05,
        backgroundImage: `url('/nexoti-logo.svg')`,
        backgroundRepeat: "no-repeat",
        backgroundSize: "contain",
        backgroundPosition: "center",
      }} />

      <h1 style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        backgroundColor: "white",
        fontSize: "28px",
        color: "#2c3e50",
        textShadow: "1px 1px 3px rgba(0,0,0,0.2)",
        fontWeight: "900",
        letterSpacing: "1px",
        textAlign: "center",
        padding: "16px 0",
        margin: 0,
        zIndex: 1000,
        borderBottom: "2px solid #ddd"
      }}>
        SERVICIOS TÉCNICOS REALIZADOS
      </h1>

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

        <div>
          <label>Servicio aplazado:</label><br />
          <label>
            <input type="radio" checked={formData.aplazado === "no"} onChange={() => handleChange("aplazado", "no")} /> No
          </label>
          <label style={{ marginLeft: 10 }}>
            <input type="radio" checked={formData.aplazado === "si"} onChange={() => handleChange("aplazado", "si")} /> Sí
          </label>
          {formData.aplazado === "si" && (
            <input
              type="text"
              placeholder="Motivo"
              value={formData.motivoAplazado}
              onChange={(e) => handleChange("motivoAplazado", e.target.value)}
              style={{ ...inputStyle, backgroundColor: "#fff3cd" }}
            />
          )}
        </div>

        <div>
          <label>Partes reemplazadas:</label><br />
          {partesOpciones.map(parte => (
            <label key={parte} style={{ display: "block" }}>
              <input
                type="checkbox"
                checked={formData.partes.includes(parte)}
                onChange={() => toggleParte(parte)}
              />
              {parte}
            </label>
          ))}
        </div>

        <div>
          <label>Servicios realizados:</label><br />
          {["limpieza", "mantenimiento", "cambioClave", "visitaPreventiva", "visitaCorrectiva"].map(key => (
            <label key={key} style={{ display: "block" }}>
              <input
                type="checkbox"
                checked={formData[key]}
                onChange={() => toggleCheckbox(key)}
              />
              {key.replace(/([A-Z])/g, " $1").replace(/^./, str => str.toUpperCase())}
            </label>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: "30px" }}>
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

      {/* Campo de filtro */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Filtrar por usuario, técnico, equipo, etc."
          value={filtroTexto}
          onChange={(e) => setFiltroTexto(e.target.value.toLowerCase())}
          style={{
            width: "100%",
            padding: 8,
            borderRadius: 4,
            border: "1px solid #ccc",
            backgroundColor: "#f0f8ff"
          }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "12px" }}>
        {registrosFiltrados.map((r) => (
          <div key={r.id} style={{ display: "flex", flexWrap: "wrap", gap: "12px", border: "1px solid #ccc", borderRadius: "8px", padding: "12px", backgroundColor: "#f9f9f9" }}>
            <div><strong>Usuario:</strong> {r.usuario}</div>
            <div><strong>Fecha:</strong> {r.fecha}</div>
            <div><strong>Cargo:</strong> {r.cargo}</div>
            <div><strong>Equipo:</strong> {r.equipo}</div>
            <div><strong>Falla:</strong> {r.falla}</div>
            <div><strong>Diagnóstico:</strong> {r.diagnostico}</div>
            <div><strong>Solución:</strong> {r.solucion}</div>
            <div><strong>Aplazado:</strong> {r.aplazado === "si" ? `Sí - ${r.motivoAplazado}` : "No"}</div>
            <div><strong>Partes:</strong> {r.partes?.join(", ")}</div>
            <div><strong>Servicios:</strong> {[r.limpieza && "Limpieza", r.mantenimiento && "Mantenimiento", r.cambioClave && "Cambio clave", r.visitaPreventiva && "Preventiva", r.visitaCorrectiva && "Correctiva"].filter(Boolean).join(", ")}</div>
            <div><strong>Técnico:</strong> {r.tecnico}</div>
            <div><strong>Observación:</strong> {r.observacion}</div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
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
          zIndex: 1000,
          padding: "12px 24px",
          backgroundColor: "#2980b9",
          color: "white",
          border: "none",
          borderRadius: "5px",
          cursor: "pointer",
          boxShadow: "0px 4px 6px rgba(0,0,0,0.2)"
        }}
        onClick={() => router.push("/")}
      >
        ⬅ Regresar
      </button>
    </div>
  );
}

