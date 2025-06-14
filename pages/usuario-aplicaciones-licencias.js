import { useRouter } from "next/router";  
import { useState, useEffect } from "react";
import { db } from "@/firebase/firebaseConfig";
import {
  collection, addDoc, getDocs, updateDoc, deleteDoc, doc,
} from "firebase/firestore";

export default function UsuarioAplicacionesLicencias() {
  const router = useRouter();
  const [formData, setFormData] = useState({});
  const [registros, setRegistros] = useState([]);
  const [filteredRegistros, setFilteredRegistros] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [mensaje, setMensaje] = useState("");
  const [tipoMensaje, setTipoMensaje] = useState("");
  const [filters, setFilters] = useState({});

  const headers = [
    "Usuario", "Nombre PC", "Cargo", "Direccion MAC", "Clave Equipo",
    "Clave Servidor ", "Licencia Office", "# Asigncion en Correo", "Coreo Licencias Office",
    "Clave Correo", "Licencia Free", "Licencias Windows",
    "Licencia Antivirus", "Clave Basc Antivirus", "Control web", "Bloqueo USB",
    "Copia seguridad", "Observaciones"
  ];

  const mostrarMensaje = (texto, tipo) => {
    setMensaje(texto);
    setTipoMensaje(tipo);
    setTimeout(() => setMensaje(""), 4000);
  };

  const handleChange = (e, key) => {
    setFormData({ ...formData, [key]: e.target.value });
  };

  const handleSave = async () => {
    try {
      if (editingId) {
        const docRef = doc(db, "licencias", editingId);
        await updateDoc(docRef, formData);
        mostrarMensaje("Registro actualizado correctamente", "success");
        setEditingId(null);
      } else {
        await addDoc(collection(db, "licencias"), formData);
        mostrarMensaje("Datos guardados correctamente", "success");
      }
      setFormData({});
      fetchRegistros();
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
  };

  const handleDelete = async (id) => {
    const confirm = window.confirm("¿Estás seguro de que deseas eliminar este registro?");
    if (!confirm) return;
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

  const todosLosCamposCompletos = headers.every((key) => formData[key] && formData[key].trim() !== "");

  return (
    <div style={{ padding: "24px", fontFamily: "Arial, sans-serif" }}>
      {/* ✅ LOGOS AGREGADOS */}
      <div style={{ position: "fixed", top: 10, left: 10, zIndex: 2000 }}>
        <img src="/img/logo1.png" alt="Logo Izquierdo" style={{ height: "60px" }} />
      </div>
      <div style={{ position: "fixed", top: 10, right: 10, zIndex: 2000 }}>
        <img src="/img/logo2.png" alt="Logo Derecho" style={{ height: "60px" }} />
      </div>

      <div style={{ position: "sticky", top: 0, backgroundColor: "white", zIndex: 10, paddingBottom: "10px" }}>
        <h1 style={{
          fontSize: "36px", color: "#2c3e50", textShadow: "2px 2px 4px rgba(0,0,0,0.3)",
          fontWeight: "900", letterSpacing: "1px", textAlign: "center", marginBottom: "24px"
        }}>
          Implementacion usuarios-equipos-aplicaciones-licencias
        </h1>
        {mensaje && (
          <div style={{
            marginBottom: "16px", padding: "12px", borderRadius: "4px",
            color: tipoMensaje === "success" ? "#155724" : "#721c24",
            backgroundColor: tipoMensaje === "success" ? "#d4edda" : "#f8d7da",
            border: `1px solid ${tipoMensaje === "success" ? "#c3e6cb" : "#f5c6cb"}`
          }}>
            {mensaje}
          </div>
        )}
      </div>

      {/* Formulario */}
      <div style={{ overflowX: "auto", marginBottom: "24px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {headers.map((key) => (
                <th key={key} style={{ border: "1px solid #ccc", padding: "4px", backgroundColor: "#eee" }}>{key}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {headers.map((key) => (
                <td key={key} style={{ border: "1px solid #ccc", padding: "4px" }}>
                  {key === "Control web" || key === "Bloqueo USB" ? (
                    <select
                      value={formData[key] || ""}
                      onChange={(e) => handleChange(e, key)}
                      style={{ width: "100%", padding: "4px", fontSize: "12px" }}
                    >
                      <option value="">Selecciona</option>
                      <option value="Sí">Sí</option>
                      <option value="No">No</option>
                    </select>
                  ) : key === "Copia seguridad" ? (
                    <select
                      value={formData[key] || ""}
                      onChange={(e) => handleChange(e, key)}
                      style={{ width: "100%", padding: "4px", fontSize: "12px" }}
                    >
                      <option value="">Selecciona</option>
                      <option value="Google Drive">Google Drive</option>
                      <option value="One Drive">One Drive</option>
                      <option value="Nube Privada">Nube Privada</option>
                      <option value="Otras">Otras</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={formData[key] || ""}
                      onChange={(e) => handleChange(e, key)}
                      style={{ width: "100%", padding: "4px", fontSize: "12px" }}
                    />
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        <div style={{ marginTop: "16px" }}>
          <button
            onClick={handleSave}
            disabled={!todosLosCamposCompletos}
            style={{
              padding: "10px 20px",
              backgroundColor: todosLosCamposCompletos ? "#27ae60" : "#95a5a6",
              color: "white", border: "none", borderRadius: "5px",
              cursor: todosLosCamposCompletos ? "pointer" : "not-allowed"
            }}
          >
            {editingId ? "ACTUALIZAR" : "GUARDAR"}
          </button>
        </div>
      </div>

      <h2 style={{ marginTop: "32px", textAlign: "center" }}>Registros Guardados</h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px", marginTop: "16px" }}>
        {filteredRegistros.map((registro) => (
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
            {headers.map((key) => (
              <p key={key}><strong>{key}:</strong> {registro[key] || ""}</p>
            ))}

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

      {/* Botón regresar */}
      <button
        style={{
          position: "fixed", bottom: "20px", left: "20px",
          padding: "10px 20px", backgroundColor: "#2980b9", color: "white",
          border: "none", borderRadius: "5px", cursor: "pointer",
          zIndex: 1000, boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)"
        }}
        onClick={() => router.push("/")}
      >
        Regresar
      </button>
    </div>
  );
}

