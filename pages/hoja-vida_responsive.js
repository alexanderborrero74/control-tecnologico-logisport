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
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        backgroundColor: "white",
        fontSize: "28px",
        color: "#2c3e50",
        fontWeight: "900",
        textAlign: "center",
        padding: "16px 0",
        zIndex: 1000,
        borderBottom: "2px solid #ddd"
      }}>
        HOJA DE VIDA EQUIPOS
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

      <table border="1" style={{ width: "100%", marginTop: "16px", borderCollapse: "collapse" }}>
        <thead style={{ backgroundColor: "#e0e0e0" }}>
          <tr>
            <th>Cargo</th>
            <th>Nombre PC</th>
            <th>Procesador</th>
            <th>IP</th>
            <th>RAM</th>
            <th>Disco</th>
            <th>Windows</th>
            <th>Office</th>
            <th>Apps</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {registros.map((registro, index) => (
            <React.Fragment key={registro.id}>
              <tr style={{ backgroundColor: index % 2 === 0 ? "#f9f9f9" : "#fff" }}>
                <td>{registro.cargo}</td>
                <td>{registro.nombrePC}</td>
                <td>{registro.procesador}</td>
                <td>{registro.ip}</td>
                <td>{registro.ram}</td>
                <td>{registro.discoTipo === "solido" ? registro.discoSolido : registro.discoMecanico}</td>
                <td>{registro.windowsVersion} / {registro.windowsSerie}</td>
                <td>{registro.officeVersion} / {registro.officeSerie}</td>
                <td>{registro.apps.filter(app => app).join(", ")}</td>
                <td>
                  <button onClick={() => handleEdit(registro)}>Editar</button>
                  <button onClick={() => handleDelete(registro.id)} style={{ marginLeft: "8px" }}>Eliminar</button>
                </td>
              </tr>
              <tr>
                <td colSpan="10" style={{ borderBottom: "5px solid #000" }}></td>
              </tr>
            </React.Fragment>
          ))}
        </tbody>
      </table>

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










