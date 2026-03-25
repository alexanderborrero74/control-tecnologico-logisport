// pages/solicitudserviciotecnico.js — LOGISPORT (actualizado con usuarios dinámicos)
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
  serverTimestamp,
  query,
  where,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { BRAND } from "@/utils/branding";
import LayoutWithSidebar from "@/components/LayoutWithSidebar";
import PageHeader from "@/components/PageHeader";
import { useUsuarios } from "@/utils/useUsuarios";

/* ==================== HELPERS ==================== */
// Prefijo por marca
function formatearConsecutivo(n) {
  const pref = BRAND?.codePrefix || "LOGI";
  const num = Math.max(1, Number(n) || 1);
  const s = String(num);
  const width = Math.max(4, s.length);
  return pref + s.padStart(width, "0");
}

// Solo LOGI0001, LOGI0002,...
function formatearConsecutivoLOGI(n) {
  const num = Math.max(1, Number(n) || 1);
  const s = String(num);
  const width = Math.max(4, s.length);
  return "LOGI" + s.padStart(width, "0");
}

/** Extrae números de cadenas tipo:
 *  "LOGI0001" → 1
 *  "LOGI1694200000" → 1694200000
 *  "cualquier 123" → 123
 */
function parseNumero(str) {
  const s = String(str || "");
  const mLogi = s.match(/LOGI\s*(\d+)/i);
  if (mLogi) return Number(mLogi[1]);
  const mAny = s.match(/(\d+)/);
  return mAny ? Number(mAny[1]) : 0;
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

// Pedir clave para eliminar
async function pedirClave() {
  const valor = prompt("Ingrese la clave de eliminación (formato 2025.2025):", "");
  if (valor === null) return null;
  return valor;
}

// Obtener siguiente número vía transacción (contadores/solicitudes_<PREF>)
async function obtenerNumeroConsecutivo() {
  const ref = doc(db, "contadores", `solicitudes_${BRAND?.codePrefix || "LOGI"}`);
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

/* ==================== ENVÍO DE CORREOS ==================== */
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

/* ==================== COMPONENTE PRINCIPAL ==================== */
const SolicitudServicioTecnico = () => {
  const router = useRouter();

  // Cargar usuarios desde Firestore usando el hook
  const { usuarios, loading: loadingUsuarios, recargar: recargarUsuarios } = useUsuarios();

  // Filtrar solo usuarios activos
  const usuariosActivos = usuarios.filter((u) => u.activo !== false);

  // Select de usuario
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState("");

  // Form
  const [formData, setFormData] = useState({
    nombre: "",
    correo: "",
    descripcion: "",
    fecha: new Date(),
    codigo: generarCodigoAleatorio(),
  });

  // Consecutivo visible
  const [previewConsecutivo, setPreviewConsecutivo] = useState("LOGI0001");
  const [ultimoAsignado, setUltimoAsignado] = useState("");

  // Estado UI
  const [registros, setRegistros] = useState([]);
  const [mensaje, setMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Inicializar usuario seleccionado cuando carguen los usuarios
  useEffect(() => {
    if (usuariosActivos.length > 0 && !usuarioSeleccionado) {
      const primerUsuario = usuariosActivos[0].nombre;
      setUsuarioSeleccionado(primerUsuario);
      setFormData((prev) => ({ ...prev, nombre: primerUsuario }));
    }
  }, [usuariosActivos, usuarioSeleccionado]);

  // Cargar registros del usuario autenticado
  const cargarRegistros = async () => {
    try {
      const auth = getAuth();
      const uid = auth.currentUser?.uid || "__none__";
      const qUser = query(collection(db, "solicitudes"), where("uid", "==", uid));
      const snap = await getDocs(qUser);
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setRegistros(data);
    } catch (error) {
      console.error("Error cargando registros:", error);
    }
  };

  useEffect(() => {
    cargarRegistros();
  }, []);

  // Calcular próximo consecutivo
  useEffect(() => {
    (async () => {
      try {
        const ref = doc(db, "contadores", `solicitudes_${BRAND?.codePrefix || "LOGI"}`);
        const snap = await getDoc(ref);
        const base = snap.exists() ? Number(snap.data()?.valor || 0) + 1 : 1;
        setPreviewConsecutivo(formatearConsecutivoLOGI(base));
      } catch {
        setPreviewConsecutivo("LOGI0001");
      }
    })();
  }, []);

  // Handlers
  const handleSelectUsuario = (e) => {
    const val = e.target.value;
    setUsuarioSeleccionado(val);
    
    // Buscar el usuario seleccionado para obtener su email
    const usuarioEncontrado = usuariosActivos.find((u) => u.nombre === val);
    
    setFormData((prev) => ({ 
      ...prev, 
      nombre: val,
      correo: usuarioEncontrado?.email || prev.correo
    }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "nombre") return; // nombre proviene del select
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setEnviando(true);
    setMensaje("");
    setUltimoAsignado("");

    // 1) Consecutivo LOGI0001...
    let consecutivo = "LOGI0001";
    let numeroAsignado = 1;
    try {
      const numero = await obtenerNumeroConsecutivo();
      numeroAsignado = numero;
      consecutivo = formatearConsecutivoLOGI(numero);
    } catch (e) {
      console.error("No se pudo asignar consecutivo por transacción (usando fallback):", e);
      const ts = Math.floor(Date.now() / 1000);
      consecutivo = (BRAND?.codePrefix || "LOGI") + String(ts);
      numeroAsignado = parseNumero(consecutivo);
    }

    // 2) Nuevo documento (incluye uid para reglas)
    const auth = getAuth();
    const u = auth.currentUser;
    if (!u) {
      setEnviando(false);
      setMensaje("Error: no hay sesión activa.");
      return;
    }

    const nuevoRegistro = {
      uid: u.uid,
      email: u.email || "",
      uidCreador: u.uid,
      nombre: formData.nombre,
      correo: formData.correo,
      descripcion: formData.descripcion,
      fecha: formData.fecha.toISOString(),
      consecutivo,
      codigo: formData.codigo,
      finalizado: false,
      createdAt: serverTimestamp(),
    };

    try {
      await addDoc(collection(db, "solicitudes"), nuevoRegistro);

      // 3) Correos
      try {
        const asunto = `Solicitud de servicio técnico ${consecutivo}`;

        const cuerpoSoporte = [
          `Nueva solicitud de servicio técnico.`,
          `Datos:`,
          `- Consecutivo: ${nuevoRegistro.consecutivo}`,
          `- Fecha: ${new Date(formData.fecha).toLocaleString()}`,
          `- Solicitante: ${nuevoRegistro.nombre || ""}`,
          `- Descripción: ${nuevoRegistro.descripcion || ""}`,
          ``,
          `SoporteIA.net`,
        ].join("\n");

        const cuerpoUsuario = [
          `Hola ${nuevoRegistro.nombre || ""},`,
          ``,
          `Hemos recibido tu solicitud de servicio técnico.`,
          `Datos:`,
          `- Consecutivo: ${nuevoRegistro.consecutivo}`,
          `- Código: ${nuevoRegistro.codigo}`,
          `- Fecha: ${new Date(formData.fecha).toLocaleString()}`,
          `- Descripción: ${nuevoRegistro.descripcion || ""}`,
          ``,
          `Pronto te contactaremos.`,
          ``,
          `SoporteIA.net`,
        ].join("\n");

        enviarCorreo("soportesistemas@soporteia.net", asunto, cuerpoSoporte);

        if (
          nuevoRegistro.correo &&
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(nuevoRegistro.correo).trim())
        ) {
          enviarCorreo(nuevoRegistro.correo, asunto, cuerpoUsuario);
        }
      } catch (e) {
        console.error("Aviso: no se pudo enviar el correo de notificación:", e);
      }

      // 4) UI
      setUltimoAsignado(consecutivo);
      if (numeroAsignado > 0) {
        setPreviewConsecutivo(formatearConsecutivoLOGI(numeroAsignado + 1));
      }
      setMensaje("¡Solicitud enviada con éxito!");
      
      // Resetear formulario manteniendo el usuario seleccionado
      setFormData({
        nombre: usuarioSeleccionado,
        correo: usuariosActivos.find((u) => u.nombre === usuarioSeleccionado)?.email || "",
        descripcion: "",
        fecha: new Date(),
        codigo: generarCodigoAleatorio(),
      });
      
      cargarRegistros();
    } catch (error) {
      console.error("Error al enviar:", error);
      setMensaje("Error: " + error.message);
    } finally {
      setEnviando(false);
    }
  };

  const eliminarRegistro = async (id) => {
    const claveIngresada = await pedirClave();
    if (claveIngresada == null) return;

    const clave = String(claveIngresada).trim();
    if (clave !== "2025.2025") {
      alert("Clave incorrecta. No se eliminó el registro.");
      return;
    }

    try {
      await deleteDoc(doc(db, "solicitudes", id));
      setRegistros((prev) => prev.filter((r) => r.id !== id));
      alert("Registro eliminado correctamente.");
    } catch (error) {
      console.error("Error al eliminar:", error);
      alert("Error eliminando registro: " + error.message);
    }
  };

  return (
    <LayoutWithSidebar>
      <PageHeader titulo="Solicitud de Servicio Técnico" />
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
          {/* Select de usuario (dinámico desde Firestore) */}
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontWeight: 600 }}>Usuario solicitante</label>
            {loadingUsuarios ? (
              <div style={{ padding: "10px", color: "#6b7280" }}>Cargando usuarios...</div>
            ) : usuariosActivos.length === 0 ? (
              <div style={{ padding: "10px", color: "#ef4444" }}>
                No hay usuarios disponibles. Por favor, cree usuarios en Admin de Usuarios.
              </div>
            ) : (
              <select
                value={usuarioSeleccionado}
                onChange={handleSelectUsuario}
                style={{ padding: "10px", borderRadius: "8px", border: "1px solid #ccc" }}
                required
              >
                <option value="">-- Seleccione un usuario --</option>
                {usuariosActivos.map((u) => (
                  <option key={u.id} value={u.nombre}>
                    {u.nombre} {u.cargo ? `(${u.cargo})` : ""}
                  </option>
                ))}
              </select>
            )}
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

          {/* Correo (editable, se autocompleta desde usuario) */}
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
            customInput={
              <input style={{ padding: "10px", borderRadius: "8px", border: "1px solid #ccc" }} />
            }
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

          {/* Consecutivo próximo */}
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
            required
          />

          <button
            type="submit"
            disabled={enviando || usuariosActivos.length === 0}
            style={{
              backgroundColor: enviando || usuariosActivos.length === 0 ? "#aaa" : "#007acc",
              color: "white",
              padding: "12px 20px",
              border: "none",
              borderRadius: "8px",
              cursor: enviando || usuariosActivos.length === 0 ? "not-allowed" : "pointer",
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
      </div>
    </LayoutWithSidebar>
  );
};

export default SolicitudServicioTecnico;
