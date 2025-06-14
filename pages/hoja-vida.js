import React from "react";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import { db } from "@/firebase/firebaseConfig";
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc
} from "firebase/firestore";

export default function HojaVidaEquipos() {
  const router = useRouter();
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
    apps: Array(10).fill("")
  });
  const [mensaje, setMensaje] = useState("");
  const [tipoMensaje, setTipoMensaje] = useState("");
  const [registros, setRegistros] = useState([]);
  const [editandoId, setEditandoId] = useState(null);

  const cargarRegistros = async () => {
    const querySnapshot = await getDocs(collection(db, "hojaVidaEquipos"));
    const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setRegistros(docs);
  };

  useEffect(() => {
    cargarRegistros();
  }, []);

  const handleChange = (key, value) => {
    setFormData({ ...formData, [key]: value });
  };

  const handleAppChange = (index, value) => {
    const updatedApps = [...formData.apps];
    updatedApps[index] = value;
    setFormData({ ...formData, apps: updatedApps });
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
      apps: Array(10).fill("")
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
    setFormData(rest);
    setEditandoId(id);
  };

  const inputStyle = {
    backgroundColor: "#fff8dc",
    padding: "4px",
    border: "1px solid #ccc",
    borderRadius: "4px",
    width: "100%"
  };

  const formularioValido = Object.values(formData).every(value => {
    if (Array.isArray(value)) {
      return value.every(app => app.trim() !== "");
    }
    return value.trim() !== "";
  });

  return (
    <div style={{ padding: "24px" }}>
      {/* Título */}
    <h1 style={{
        fontSize: "36px",
        color: "#2c3e50",
        textShadow: "2px 2px 4px rgba(0,0,0,0.3)",
        fontWeight: "900",
        letterSpacing: "1px",
        textAlign: "center",
        marginBottom: "24px"
      }}>
        Hoja de vida equipos
      </h1>

      <table border="1" cellPadding="8" style={{ borderCollapse: "collapse", width: "100%", backgroundColor: "#f0f8ff", marginTop: "80px" }}>
        <thead style={{ backgroundColor: "#007acc", color: "white" }}>
          <tr>
            <th>Cargo</th>
            <th>Nombre PC</th>
            <th>Procesador</th>
            <th>IP</th>
            <th>Memoria RAM</th>
            <th>Disco</th>
            <th>Windows</th>
            <th>Office</th>
            <th>Apps instaladas</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><input type="text" style={inputStyle} value={formData.cargo} onChange={(e) => handleChange("cargo", e.target.value)} /></td>
            <td><input type="text" style={inputStyle} value={formData.nombrePC} onChange={(e) => handleChange("nombrePC", e.target.value)} /></td>
            <td><input type="text" style={inputStyle} value={formData.procesador} onChange={(e) => handleChange("procesador", e.target.value)} /></td>
            <td><input type="text" style={inputStyle} value={formData.ip} onChange={(e) => handleChange("ip", e.target.value)} /></td>
            <td><input type="text" style={inputStyle} value={formData.ram} onChange={(e) => handleChange("ram", e.target.value)} /></td>
            <td>
              <label><input type="radio" name="discoTipo" value="solido" checked={formData.discoTipo === "solido"} onChange={(e) => handleChange("discoTipo", e.target.value)} /> Sólido</label>
              {formData.discoTipo === "solido" && (
                <input type="text" style={inputStyle} placeholder="Tamaño" value={formData.discoSolido} onChange={(e) => handleChange("discoSolido", e.target.value)} />
              )}<br />
              <label><input type="radio" name="discoTipo" value="mecanico" checked={formData.discoTipo === "mecanico"} onChange={(e) => handleChange("discoTipo", e.target.value)} /> Mecánico</label>
              {formData.discoTipo === "mecanico" && (
                <input type="text" style={inputStyle} placeholder="Tamaño" value={formData.discoMecanico} onChange={(e) => handleChange("discoMecanico", e.target.value)} />
              )}
            </td>
            <td>
              <input type="text" style={inputStyle} placeholder="Versión" value={formData.windowsVersion} onChange={(e) => handleChange("windowsVersion", e.target.value)} /><br />
              <input type="text" style={inputStyle} placeholder="# Serie" value={formData.windowsSerie} onChange={(e) => handleChange("windowsSerie", e.target.value)} />
            </td>
            <td>
              <input type="text" style={inputStyle} placeholder="Versión" value={formData.officeVersion} onChange={(e) => handleChange("officeVersion", e.target.value)} /><br />
              <input type="text" style={inputStyle} placeholder="# Serie" value={formData.officeSerie} onChange={(e) => handleChange("officeSerie", e.target.value)} />
            </td>
            <td>
              {formData.apps.map((app, index) => (
                <input
                  key={index}
                  type="text"
                  style={{ ...inputStyle, marginBottom: "4px" }}
                  placeholder={`App ${index + 1}`}
                  value={app}
                  onChange={(e) => handleAppChange(index, e.target.value)}
                />
              ))}
            </td>
          </tr>
        </tbody>
      </table>

      {mensaje && (
        <div style={{ marginTop: "16px", color: tipoMensaje === "success" ? "green" : "red", fontWeight: "bold", textAlign: "center" }}>
          {mensaje}
        </div>
      )}

      <div style={{ marginTop: "16px", textAlign: "center" }}>
        <button
          onClick={handleSave}
          disabled={!formularioValido}
          style={{
            padding: "10px 20px",
            backgroundColor: formularioValido ? "#27ae60" : "#ccc",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: formularioValido ? "pointer" : "not-allowed"
          }}
        >
          {editandoId ? "ACTUALIZAR" : "GUARDAR"}
        </button>
      </div>

      <h2 style={{ marginTop: "32px", textAlign: "center" }}>Registros Guardados</h2>

<div style={{
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: "16px",
  marginTop: "16px"
}}>
  {registros.map((registro) => (
    <div
      key={registro.id}
      style={{
        border: "1px solid #ccc",
        borderRadius: "10px",
        padding: "16px",
        backgroundColor: "#fdfdfd",
        boxShadow: "0 4px 8px rgba(0,0,0,0.1)"
      }}
    >
      <p><strong>Cargo:</strong> {registro.cargo}</p>
      <p><strong>Nombre PC:</strong> {registro.nombrePC}</p>
      <p><strong>Procesador:</strong> {registro.procesador}</p>
      <p><strong>IP:</strong> {registro.ip}</p>
      <p><strong>RAM:</strong> {registro.ram}</p>
      <p><strong>Disco:</strong> {registro.discoTipo === "solido" ? `Sólido - ${registro.discoSolido}` : `Mecánico - ${registro.discoMecanico}`}</p>
      <p><strong>Windows:</strong> {registro.windowsVersion} / {registro.windowsSerie}</p>
      <p><strong>Office:</strong> {registro.officeVersion} / {registro.officeSerie}</p>
      <p><strong>Apps:</strong> {registro.apps.filter(app => app).join(", ") || "Ninguna"}</p>

      <div style={{ marginTop: "12px", display: "flex", justifyContent: "space-between" }}>
        <button
          onClick={() => handleEdit(registro)}
          style={{
            padding: "6px 12px",
            backgroundColor: "#f39c12",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer"
          }}
        >
          Editar
        </button>
        <button
          onClick={() => handleDelete(registro.id)}
          style={{
            padding: "6px 12px",
            backgroundColor: "#c0392b",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer"
          }}
        >
          Eliminar
        </button>
      </div>
    </div>
  ))}
</div>


      {/* Botón Regresar Fijo */}
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
          cursor: "pointer",
          zIndex: 1000
        }}
        onClick={() => router.push("/")}
      >
        Regresar
      </button>
    </div>
  );
}










