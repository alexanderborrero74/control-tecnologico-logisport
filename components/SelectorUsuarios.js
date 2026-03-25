// components/SelectorUsuarios.js
import { useEffect, useState } from "react";
import { db } from "@/firebase/firebaseConfig";
import { collection, getDocs, query, orderBy } from "firebase/firestore";

export default function SelectorUsuarios({ 
  value, 
  onChange, 
  placeholder = "Seleccione un usuario",
  required = false,
  style = {}
}) {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cargarUsuarios = async () => {
      try {
        const q = query(
          collection(db, "usuariosCatalogo"),
          orderBy("nombre", "asc")
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setUsuarios(data.filter(u => u.activo !== false));
      } catch (error) {
        console.error("Error cargando usuarios:", error);
      } finally {
        setLoading(false);
      }
    };

    cargarUsuarios();
  }, []);

  const handleChange = (e) => {
    const selectedValue = e.target.value;
    if (onChange) {
      onChange(selectedValue);
    }
  };

  if (loading) {
    return (
      <select disabled style={style}>
        <option>Cargando usuarios...</option>
      </select>
    );
  }

  return (
    <select
      value={value}
      onChange={handleChange}
      required={required}
      style={{
        padding: "10px 12px",
        borderRadius: "8px",
        border: "1.5px solid #d9e2f1",
        background: "#fff",
        fontSize: "0.95rem",
        width: "100%",
        ...style,
      }}
    >
      <option value="">{placeholder}</option>
      {usuarios.map((usuario) => (
        <option key={usuario.id} value={usuario.nombre}>
          {usuario.nombre}
          {usuario.cargo ? ` - ${usuario.cargo}` : ""}
        </option>
      ))}
    </select>
  );
}
