// pages/solicitudserviciotecnico.js – RESET contador (Logisport)
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { db } from "@/firebase/firebaseConfig";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  runTransaction,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Contador separado por empresa/prefijo
const COUNTER_DOC_ID = "solicitudes_LOG";

// ====== Lista fija de usuarios (solo selección) ======
const USUARIOS_FIJOS = [
  "Gerencia",
  "Recepción",
  "Contabilidad",
  "sgomez",
  "pasanteibv",
  "expobun",
  "dgarcia",
  "eholguin",
  "expobun01",
  "yriascos",
  "impobun10",
  "impobun07",
  "impobun02",
  "impobun08",
];

// ====== Helper de correo a la API ======
async function enviarCorreo(to, subject, text) {
  try {
    const destinatario = String(to || "").trim();
    if (!destinatario) return;
    const res = await fetch("/api/enviarCorreoElectronico", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: destinatario, subject, text }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.error("Fallo al enviar correo:", data?.error || res.statusText);
    }
  } catch (e) {
    console.error("Error de red enviando correo:", e);
  }
}

// Código aleatorio 4 chars
function generarCodigoAleatorio() {
  const caracteres = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let codigo = "";
  for (let i = 0; i < 4; i++) {
    codigo += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
  }
  return codigo;
}

// Consecutivo: formatear como LOG0001, LOG0002, ...
function formatearConsecutivoLOG(n) {
  const num = Math.max(1, Number(n) || 1);
  const s = String(num);
  const width = Math.max(4, s.length);
  return "LOG" + s.padStart(width, "0");
}
function parseNumeroLOG(str) {
  const m = String(str || "").match(/LOG(\d+)/i);
  return m ? Number(m[1]) : 0;
}

export default function SolicitudServicioTecnico() {
  const router = useRouter();

  // Select fijo de usuarios
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(USUARIOS_FIJOS[0]);

  // Form
  const [formData, setFormData] = useState({
    nombre: USUARIOS_FIJOS[0], // se rellena desde el select
    correo: "",
    descripcion: "",
    fecha: new Date(),
    codigo: generarCodigoAleatorio(),
  });

  // Consecutivo visible
  const [previewConsecutivo, setPreviewConsecutivo] = useState("LOG0001"); // próximo visible
  const [ultimoAsignado, setUltimoAsignado] = useState(""); // último asignado tras guardar

  // Estado UI
  const [registros, setRegistros] = useState([]);
  const [mensaje, setMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Cargar registros para la lista inferior
  const cargarRegistros = async () => {
    try {
      const snap = await getDocs(collection(db, "solicitudes"));
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setRegistros(data);
    } catch (error) {
      console.error("Error cargando registros:", error);
    }
  };
  useEffect(() => {
    cargarRegistros();
  }, []);

  // Si no hay solicitudes, resetea el contador a 0 (próximo LOG0001)
  useEffect(() => {
    (async () => {
      try {
        if ((registros || []).length === 0) {
          const ref = doc(db, "contadores", COUNTER_DOC_ID);
          await setDoc(ref, { valor: 0 }, { merge: true });
          setPreviewConsecutivo(formatearConsecutivoLOG(1));
        }
      } catch (e) {
        console.error("No se pudo resetear el contador cuando no hay solicitudes:", e);
      }
    })();
  }, [registros]);

  // Calcular y mostrar el PRÓXIMO consecutivo desde el contador
  useEffect(() => {
    (async () => {
      try {
        const ref = doc(db, "contadores", COUNTER_DOC_ID);
        const snap = await getDoc(ref);
        const base = snap.exists() ? Number(snap.data()?.valor || 0) + 1 : 1;
        setPreviewConsecutivo(formatearConsecutivoLOG(base));
      } catch {
        setPreviewConsecutivo("LOG0001");
      }
    })();
  }, []);

  // Recalcula el contador según lo que haya en la colección "solicitudes"
  // - Si no queda ninguna, el próximo será LOG0001
  // - Si quedan, el próximo será MAX(LOGxxxx) + 1
  const recalcularContadorConsecutivos = async () => {
    try {
      const snap = await getDocs(collection(db, "solicitudes"));
      let max = 0;
      for (const d of snap.docs) {
        const cons = d.data()?.consecutivo || "";
        const n = parseNumeroLOG(cons);
        if (n > max) max = n;
      }
      const ref = doc(db, "contadores", COUNTER_DOC_ID);
      await setDoc(ref, { valor: max }, { merge: true });
      setPreviewConsecutivo(formatearConsecutivoLOG((max || 0) + 1));
    } catch (e) {
      console.error("No se pudo recalcular el contador:", e);
    }
  };

  // Al cambiar select
  const handleSelectUsuario = (e) => {
    const val = e.target.value;
    setUsuarioSeleccionado(val);
    setFormData((prev) => ({ ...prev, nombre: val }));
  };

  // Solo se edita correo y descripción (nombre queda bloqueado por select)
  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "nombre") return; // nombre proviene del select
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Obtener siguiente número vía transacción (contadores/solicitudes.valor)
  async function obtenerNumeroConsecutivo() {
    const ref = doc(db, "contadores", COUNTER_DOC_ID);
    const numero = await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) {
        tx.set(ref, { valor: 1 });
        return 1;
      }
      const actual = Number(snap.data().valor || 0);
      const nuevo = actual + 1;
      tx.update(ref, { valor: nuevo });
      return nuevo;
    });
    return numero;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setEnviando(true);
    setMensaje("");
    setUltimoAsignado("");

    // 1) Consecutivo con formato LOG0001...
    let consecutivo = "LOG0001";
    let numeroAsignado = 1;
    try {
      const numero = await obtenerNumeroConsecutivo();
      numeroAsignado = numero;
      consecutivo = formatearConsecutivoLOG(numero);
    } catch (e) {
      console.error("No se pudo asignar consecutivo por transacción:", e);
      const ts = Math.floor(Date.now() / 1000);
      consecutivo = "LOG" + String(ts);
      numeroAsignado = parseNumeroLOG(consecutivo);
    }

    // 2) Nuevo documento
    const auth = getAuth();
    const uid = auth.currentUser?.uid || "";

    const nuevoRegistro = {
      nombre: formData.nombre,
      correo: formData.correo,
      descripcion: formData.descripcion,
      fecha: formData.fecha.toISOString(),
      consecutivo, // LOG000X
      codigo: formData.codigo,
      uidCreador: uid,
    };

    try {
      await addDoc(collection(db, "solicitudes"), nuevoRegistro);

      // 3) Correos: SOPORTE (sin código) y USUARIO (con código)
      try {
        const asunto = `Solicitud de servicio técnico ${consecutivo}`;

        const cuerpoSoporte = [
          "Nueva solicitud de servicio técnico.",
          "Datos:",
          `- Consecutivo: ${nuevoRegistro.consecutivo}`,
          `- Fecha: ${new Date(nuevoRegistro.fecha).toLocaleString()}`,
          `- Solicitante: ${nuevoRegistro.nombre || ""}`,
          `- Descripción: ${nuevoRegistro.descripcion || ""}`,
          "",
          "SoporteIA.net",
        ].join("\n");

        const cuerpoUsuario = [
          `Hola ${nuevoRegistro.nombre || ""},`,
          "",
          "Hemos recibido tu solicitud de servicio técnico.",
          "Datos:",
          `- Consecutivo: ${nuevoRegistro.consecutivo}`,
          `- Código: ${nuevoRegistro.codigo}`,
          `- Fecha: ${new Date(nuevoRegistro.fecha).toLocaleString()}`,
          `- Descripción: ${nuevoRegistro.descripcion || ""}`,
          "",
          "Pronto te contactaremos.",
          "",
          "SoporteIA.net",
        ].join("\n");

        // Soporte → SIN código
        enviarCorreo("soportesistemas@soporteia.net", asunto, cuerpoSoporte);

        // Usuario (si el correo es válido) → CON código
        if (
          nuevoRegistro.correo &&
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(nuevoRegistro.correo).trim())
        ) {
          enviarCorreo(nuevoRegistro.correo, asunto, cuerpoUsuario);
        }
      } catch (e) {
        console.error("Aviso: no se pudo enviar el correo de notificación:", e);
      }

      // 4) Mostrar asignado y actualizar el preview al siguiente
      setUltimoAsignado(consecutivo);
      if (numeroAsignado > 0) {
        setPreviewConsecutivo(formatearConsecutivoLOG(numeroAsignado + 1));
      }

      // Reset parcial y recarga lista
      setMensaje("¡Solicitud enviada con éxito!");
      setFormData((prev) => ({
        nombre: usuarioSeleccionado, // se mantiene lo elegido
        correo: "",
        descripcion: "",
        fecha: new Date(),
        codigo: generarCodigoAleatorio(),
      }));
      cargarRegistros();
    } catch (error) {
      console.error("Error al enviar:", error);
      setMensaje("Error: " + error.message);
    } finally {
      setEnviando(false);
    }
  };

  const eliminarRegistro = async (id) => {
    const valor = prompt("Ingrese la clave de eliminación (formato 2025.2025):", "");
    if (valor === null) return; // canceló
    const clave = String(valor).trim();
    if (clave !== "2025.2025") {
      alert("Clave incorrecta. No se eliminó el registro.");
      return;
    }

    try {
      await deleteDoc(doc(db, "solicitudes", id));
      await cargarRegistros();
      await recalcularContadorConsecutivos(); // <- Ajusta el contador según lo que quedó
      alert("Registro eliminado correctamente.");
    } catch (error) {
      console.error("Error al eliminar:", error);
      alert("Error eliminando registro: " + error.message);
    }
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      {/* Encabezado */}
      <div
        style={{
          backgroundColor: "#007acc",
          color: "white",
          padding: "10px",
          borderRadius: "10px",
          boxShadow: "0 4px 10px rgba(0, 0, 0, 0.2)",
        }}
      >
        <h1
          style={{
            fontSize: "36px",
            color: "#2c3e50",
            textShadow: "2px 2px 4px rgba(0,0,0,0.3)",
            fontWeight: "900",
            letterSpacing: "1px",
            textAlign: "center",
            marginBottom: "12px",
          }}
        >
          Solicitud servicios técnicos
        </h1>

        {/* Barra informativa de consecutivo visible */}
        <div
          style={{
            background: "#fff",
            color: "#111827",
            borderRadius: 8,
            padding: "8px 12px",
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
          }}
        >
          <span style={{ fontWeight: 700 }}>Consecutivo:</span>
          {ultimoAsignado ? (
            <>
              <span style={{ color: "#059669", fontWeight: 800 }}>Asignado {ultimoAsignado}</span>
              <span style={{ color: "#6b7280" }}>• Próximo {previewConsecutivo}</span>
            </>
          ) : (
            <span style={{ color: "#1f2937" }}>Próximo {previewConsecutivo}</span>
          )}
        </div>
      </div>

      {/* Formulario */}
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: "16px", marginTop: "24px" }}>
        {/* Select de usuario (obligatorio) */}
        <div style={{ display: "grid", gap: 6 }}>
          <label style={{ fontWeight: 600 }}>Usuario solicitante</label>
          <select
            value={usuarioSeleccionado}
            onChange={handleSelectUsuario}
            style={{ padding: "10px", borderRadius: "8px", border: "1px solid #ccc" }}
          >
            {USUARIOS_FIJOS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>

        {/* Nombre (solo lectura, proviene del select) */}
        <input
          type="text"
          name="nombre"
          placeholder="Nombre"
          value={formData.nombre}
          onChange={handleChange}
          readOnly
          style={{
            padding: "10px",
            borderRadius: "8px",
            border: "1px solid #ccc",
            background: "#f3f4f6",
          }}
        />

        {/* Correo (editable) */}
        <input
          type="email"
          name="correo"
          placeholder="Correo electrónico del solicitante"
          value={formData.correo}
          onChange={handleChange}
          style={{ padding: "10px", borderRadius: "8px", border: "1px solid #ccc" }}
        />

        {/* Fecha */}
        <DatePicker
          selected={formData.fecha}
          onChange={(date) => setFormData((prev) => ({ ...prev, fecha: date }))}
          dateFormat="dd/MM/yyyy"
          customInput={<input style={{ padding: "10px", borderRadius: "8px", border: "1px solid #ccc" }} />}
        />

        {/* Código generado */}
        <input
          type="text"
          name="codigo"
          placeholder="Código generado automáticamente"
          value={formData.codigo}
          readOnly
          style={{
            padding: "10px",
            borderRadius: "8px",
            border: "1px solid #ccc",
            backgroundColor: "#e9ecef",
            color: "#495057",
            fontWeight: "bold",
          }}
        />

        {/* Consecutivo próximo (solo lectura dentro del formulario) */}
        <input
          type="text"
          name="consecutivo_preview"
          placeholder="Consecutivo (se asignará automáticamente)"
          value={ultimoAsignado ? `Asignado: ${ultimoAsignado}` : `Próximo: ${previewConsecutivo}`}
          readOnly
          style={{
            padding: "10px",
            borderRadius: "8px",
            border: "1px solid #ccc",
            color: "#374151",
            backgroundColor: "#f3f4f6",
            fontStyle: "italic",
          }}
        />

        {/* Descripción */}
        <textarea
          name="descripcion"
          placeholder="Descripción del problema"
          value={formData.descripcion}
          onChange={handleChange}
          rows={4}
          style={{ padding: "10px", borderRadius: "8px", border: "1px solid #ccc" }}
        />

        <button
          type="submit"
          disabled={enviando}
          style={{
            backgroundColor: enviando ? "#aaa" : "#007acc",
            color: "white",
            padding: "12px 20px",
            border: "none",
            borderRadius: "8px",
            cursor: enviando ? "not-allowed" : "pointer",
            fontWeight: "bold",
          }}
        >
          {enviando ? "Enviando..." : "Enviar solicitud"}
        </button>
      </form>

      {mensaje && (
        <p style={{ marginTop: "10px", color: mensaje.startsWith("Error") ? "red" : "green" }}>
          {mensaje}
        </p>
      )}

      {/* Listado simple */}
      <h2 style={{ marginTop: "32px", color: "#2c3e50" }}>Solicitudes registradas</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", marginTop: "10px" }}>
        {registros.map((reg) => (
          <div
            key={reg.id}
            style={{
              border: "1px solid #ccc",
              borderRadius: "10px",
              padding: "15px",
              width: "calc(33% - 16px)",
              boxSizing: "border-box",
              minWidth: "260px",
            }}
          >
            <p><strong>Consecutivo:</strong> {reg.consecutivo}</p>
            <p><strong>Código:</strong> {reg.codigo}</p>
            <p><strong>Nombre:</strong> {reg.nombre}</p>
            <p><strong>Correo:</strong> {reg.correo}</p>
            <p><strong>Fecha:</strong> {reg.fecha ? new Date(reg.fecha).toLocaleString() : ""}</p>
            <p><strong>Descripción:</strong> {reg.descripcion}</p>
            <button
              onClick={() => eliminarRegistro(reg.id)}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                border: "none",
                color: "white",
                cursor: "pointer",
                backgroundColor: "#dc3545",
              }}
            >
              Eliminar
            </button>
          </div>
        ))}
      </div>

      {/* Botón fijo Regresar */}
      <button
        onClick={() => router.push("/")}
        style={{
          position: "fixed",
          bottom: 20,
          left: 20,
          backgroundColor: "#6c757d",
          color: "white",
          padding: "10px 16px",
          border: "none",
          borderRadius: "8px",
          cursor: "pointer",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          zIndex: 1000,
        }}
      >
        ⬅ Regresar
      </button>
    </div>
  );
}
