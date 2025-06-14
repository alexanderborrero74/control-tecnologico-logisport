import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { db } from "@/firebase/firebaseConfig";
import { collection, addDoc, getDocs, deleteDoc, doc } from "firebase/firestore";

function generarCodigoAleatorio() {
  const caracteres = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let codigo = "";
  for (let i = 0; i < 4; i++) {
    codigo += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
  }
  return codigo;
}

export default function SolicitudServicios() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    nombre: "",
    correo: "",
    descripcion: "",
    fecha: new Date(),
    consecutivo: "",
    codigo: "",
  });
  const [registros, setRegistros] = useState([]);
  const [mensaje, setMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    cargarRegistros();
  }, []);

  const cargarRegistros = async () => {
    const snapshot = await getDocs(collection(db, "solicitudes"));
    const datos = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    setRegistros(datos);

    const ultimo = datos
      .map((r) => r.consecutivo)
      .filter(Boolean)
      .map((c) => parseInt(c.replace("LOG", "")))
      .sort((a, b) => b - a)[0] || 0;

    const siguienteConsecutivo = `LOG${String(ultimo + 1).padStart(4, "0")}`;
    const nuevoCodigo = generarCodigoAleatorio();
    setFormData((prev) => ({ ...prev, consecutivo: siguienteConsecutivo, codigo: nuevoCodigo }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDateChange = (date) => {
    setFormData((prev) => ({ ...prev, fecha: date }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setEnviando(true);
    setMensaje("");

    const nuevoRegistro = {
      nombre: formData.nombre,
      correo: formData.correo,
      descripcion: formData.descripcion,
      fecha: formData.fecha.toISOString(),
      consecutivo: formData.consecutivo,
      codigo: formData.codigo,
    };

    try {
      await addDoc(collection(db, "solicitudes"), nuevoRegistro);

      await fetch("/api/enviarCorreoElectronico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: "soportesistemas@soporteia.net",
          subject: "Nueva Solicitud de Servicio",
          text: `
Consecutivo: ${formData.consecutivo}
Nombre: ${formData.nombre}
Fecha: ${formData.fecha.toLocaleDateString()}
Descripción: ${formData.descripcion}
          `,
        }),
      });

      await fetch("/api/enviarCorreoElectronico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: formData.correo,
          subject: "Código de seguimiento de su solicitud",
          text: `
Gracias por registrar su solicitud.

Código de seguimiento: ${formData.codigo}

Sin este código el técnico no podrá finalizar el servicio sin su consentimiento de aprobación de servicio terminado con éxito.
          `,
        }),
      });

      setMensaje("¡Solicitud enviada con éxito!");
      setFormData({ nombre: "", correo: "", descripcion: "", fecha: new Date(), consecutivo: "", codigo: "" });
      cargarRegistros();
    } catch (error) {
      console.error("Error al enviar:", error);
      setMensaje("Error: " + error.message);
    } finally {
      setEnviando(false);
    }
  };

  const eliminarRegistro = async (id) => {
    try {
      await deleteDoc(doc(db, "solicitudes", id));
      setRegistros((prev) => prev.filter((r) => r.id !== id));
    } catch (error) {
      console.error("Error al eliminar:", error);
    }
  };

  const formularioCompleto = formData.nombre && formData.correo && formData.descripcion;

  return (
    <div style={{ maxWidth: 900, margin: "auto", padding: "20px", paddingBottom: "100px" }}>
      <div style={{
        position: "sticky",
        top: 0,
        backgroundColor: "#fff",
        padding: "16px",
        zIndex: 1000,
        borderBottom: "2px solid #007acc",
        textAlign: "center"
      }}>
       <h1 style={{
        fontSize: "36px",
        color: "#2c3e50",
        textShadow: "2px 2px 4px rgba(0,0,0,0.3)",
        fontWeight: "900",
        letterSpacing: "1px",
        textAlign: "center",
        marginBottom: "24px"
      }}>
        Solicitud servicios tecnicos
      </h1>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: "20px", marginTop: "30px" }}>
        <input
          type="text"
          name="consecutivo"
          placeholder="Consecutivo"
          value={formData.consecutivo}
          readOnly
          style={{ ...inputEstilo, backgroundColor: "#e9ecef", color: "#495057", fontWeight: "bold" }}
        />

        <input
          type="text"
          name="codigo"
          placeholder="Código generado"
          value={formData.codigo}
          readOnly
          style={{ ...inputEstilo, backgroundColor: "#f0f0f0", fontWeight: "bold" }}
        />

        <input
          type="text"
          name="nombre"
          placeholder="Nombre"
          value={formData.nombre}
          onChange={handleChange}
          required
          style={inputEstilo}
        />

        <input
          type="email"
          name="correo"
          placeholder="Correo electrónico"
          value={formData.correo}
          onChange={handleChange}
          required
          style={inputEstilo}
        />

        <DatePicker
          selected={formData.fecha}
          onChange={handleDateChange}
          dateFormat="dd/MM/yyyy"
          className="custom-datepicker"
          style={inputEstilo}
        />

        <textarea
          name="descripcion"
          placeholder="Descripción del problema"
          value={formData.descripcion}
          onChange={handleChange}
          required
          rows={4}
          style={inputEstilo}
        />

        <button
          type="submit"
          disabled={!formularioCompleto || enviando}
          style={{
            padding: "12px",
            fontWeight: "bold",
            fontSize: "16px",
            border: "none",
            borderRadius: "8px",
            backgroundColor: formularioCompleto ? "#007acc" : "#ccc",
            color: "#fff",
            cursor: formularioCompleto ? "pointer" : "not-allowed",
          }}
        >
          {enviando ? "Enviando..." : "Enviar solicitud"}
        </button>
      </form>

      {mensaje && <p style={{ marginTop: "20px", fontWeight: "bold", color: "green" }}>{mensaje}</p>}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "20px", marginTop: "40px" }}>
        {registros.map((registro) => (
          <div key={registro.id} style={bloqueEstilo}>
            <p><strong>Consecutivo:</strong> {registro.consecutivo}</p>
            <p><strong>Nombre:</strong> {registro.nombre}</p>
            <p><strong>Correo:</strong> {registro.correo}</p>
            <p><strong>Código:</strong> {registro.codigo}</p>
            <p><strong>Fecha:</strong> {new Date(registro.fecha).toLocaleDateString()}</p>
            <p><strong>Descripción:</strong> {registro.descripcion}</p>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px" }}>
              <button
                style={{ ...btnEstilo, backgroundColor: "#e74c3c" }}
                onClick={() => eliminarRegistro(registro.id)}
              >
                Eliminar
              </button>
              <button
                style={{ ...btnEstilo, backgroundColor: "#3498db" }}
                onClick={() => alert("Funcionalidad de edición no implementada")}
              >
                Editar
              </button>
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
          cursor: "pointer",
          zIndex: 1000,
        }}
        onClick={() => router.push("/")}
      >
        Regresar
      </button>
    </div>
  );
}

const inputEstilo = {
  width: "100%",
  padding: "10px",
  borderRadius: "8px",
  border: "1px solid #ccc",
  fontSize: "16px",
};

const bloqueEstilo = {
  backgroundColor: "#f4f4f4",
  border: "1px solid #ccc",
  borderRadius: "10px",
  padding: "15px",
  width: "calc(33% - 20px)",
  boxSizing: "border-box",
  minWidth: "250px"
};

const btnEstilo = {
  padding: "6px 12px",
  borderRadius: "6px",
  border: "none",
  color: "white",
  cursor: "pointer",
};

