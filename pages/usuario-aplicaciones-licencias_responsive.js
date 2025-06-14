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

  const handleFilterChange = (e, key) => {
    const newFilters = { ...filters, [key]: e.target.value };
    setFilters(newFilters);
    aplicarFiltros(newFilters);
  };

  const aplicarFiltros = (newFilters) => {
    const filtrados = registros.filter((registro) =>
      Object.entries(newFilters).every(([key, value]) =>
        value === "" || (registro[key] || "").toLowerCase().includes(value.toLowerCase())
      )
    );
    setFilteredRegistros(filtrados);
  };

  const limpiarFiltros = () => {
    setFilters({});
    setFilteredRegistros(registros);
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

      {/* Filtros */}
      <h2 style={{ fontSize: "20px", marginBottom: "10px", color: "#34495e" }}>Registros guardados</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
        {headers.map((header) => (
          <div key={header} style={{ flex: "1 1 200px" }}>
            <input
              type="text"
              placeholder={`Filtrar ${header}`}
              value={filters[header] || ""}
              onChange={(e) => handleFilterChange(e, header)}
              style={{ width: "100%", padding: "4px", fontSize: "12px" }}
            />
          </div>
        ))}
        <button onClick={limpiarFiltros} style={{
          padding: "6px 12px", backgroundColor: "#7f8c8d",
          color: "white", border: "none", borderRadius: "4px", cursor: "pointer"
        }}>
          Limpiar filtros
        </button>
      </div>

      {/* Lista de registros como bloques separados */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {filteredRegistros.map((registro) => (
          <div key={registro.id} style={{ border: "1px solid #ccc", borderRadius: "8px", padding: "16px", backgroundColor: "#fdfdfd", boxShadow: "0 2px 6px rgba(0,0,0,0.05)" }}>
            {headers.map((key) => (
              <div key={key} style={{ marginBottom: "6px", fontSize: "13px" }}>
                <strong>{key}:</strong> {registro[key] || ""}
              </div>
            ))}
            <div style={{ marginTop: "12px" }}>
              <button
                style={{
                  padding: "6px 12px", backgroundColor: "#f39c12", color: "white",
                  border: "none", borderRadius: "4px", cursor: "pointer", marginRight: "8px"
                }}
                onClick={() => handleEdit(registro)}
              >
                Editar
              </button>
              <button
                style={{
                  padding: "6px 12px", backgroundColor: "#e74c3c", color: "white",
                  border: "none", borderRadius: "4px", cursor: "pointer"
                }}
                onClick={() => handleDelete(registro.id)}
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



