import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { db } from "@/firebase/firebaseConfig";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";

export default function ServiciosTecnicos() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    consecutivo: "",
    codigo: "",
    codigoservicio: "", // Este es el campo clave para validar
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
    tipoSoporte: "virtual",
    servicioFinalizado: "no",
  });

  const [registros, setRegistros] = useState([]);
  const [solicitudesDisponibles, setSolicitudesDisponibles] = useState([]);
  const [editandoId, setEditandoId] = useState(null);
  const [mensaje, setMensaje] = useState("");
  const [filtroTexto, setFiltroTexto] = useState("");
  const [solicitudUsada, setSolicitudUsada] = useState(null);
  const [codigosSolicitud, setCodigosSolicitud] = useState({});
  const [codigoValido, setCodigoValido] = useState(false); // Estado para verificar si el código ingresado es válido

  const partesOpciones = [
    "Disco duro",
    "Board",
    "Memoria RAM",
    "Pantalla",
    "Equipo",
    "Teclado",
  ];

  // Cargar registros de servicios técnicos
  const cargarRegistros = async () => {
    const snapshot = await getDocs(collection(db, "serviciosTecnicos"));
    setRegistros(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  };

  // Cargar solicitudes pendientes
  const cargarSolicitudes = async () => {
    const snapshot = await getDocs(collection(db, "solicitudes"));
    const usadosSnapshot = await getDocs(collection(db, "serviciosTecnicos"));
    const usados = usadosSnapshot.docs.map((d) => d.data().consecutivo);
    const disponibles = snapshot.docs
      .filter((doc) => !usados.includes(doc.data().consecutivo))
      .map((doc) => ({ id: doc.id, ...doc.data() }));

    const codigos = {};
    disponibles.forEach((item) => {
      codigos[item.consecutivo] = item.codigo; // Asignamos el código de cada solicitud
    });

    setCodigosSolicitud(codigos);
    setSolicitudesDisponibles(disponibles);
  };

  useEffect(() => {
    cargarRegistros();
    cargarSolicitudes();
  }, []);

  const handleChange = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));

    // Verificar si el código ingresado coincide con el de la solicitud
    if (key === "codigoservicio" && value === codigosSolicitud[formData.consecutivo]) {
      setCodigoValido(true);
    } else {
      setCodigoValido(false);
    }
  };

  const resetForm = () => {
    setFormData({
      consecutivo: "",
      codigo: "",
      codigoservicio: "",
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
      tipoSoporte: "virtual",
      servicioFinalizado: "no",
    });
    setEditandoId(null);
    setSolicitudUsada(null);
    setCodigoValido(false); // Resetear el estado de validación de código
  };

  const formValido = formData.servicioFinalizado === "no" || codigoValido; // Validar solo si el servicio está finalizado

  const handleSave = async () => {
    if (formData.servicioFinalizado === "si" && !codigoValido) {
      setMensaje(
        "⚠ El código ingresado no coincide con el generado en la solicitud. Sin este código el técnico no podrá finalizar el servicio sin su consentimiento de aprobación de servicio terminado con éxito."
      );
      setTimeout(() => setMensaje(""), 6000);
      return;
    }

    try {
      const ref = editandoId
        ? doc(db, "serviciosTecnicos", editandoId)
        : collection(db, "serviciosTecnicos");

      if (editandoId) {
        await updateDoc(ref, formData);
        setMensaje("✅ Registro actualizado");
      } else {
        await addDoc(ref, formData);
        setMensaje("✅ Registro guardado");
      }

      if (formData.servicioFinalizado === "si") {
        const snapshot = await getDocs(collection(db, "solicitudes"));
        const solicitudDoc = snapshot.docs.find(
          (doc) => doc.data().consecutivo === formData.consecutivo
        );
        if (solicitudDoc) {
          await updateDoc(doc(db, "solicitudes", solicitudDoc.id), {
            finalizado: "si",
          });
        }
      }

      resetForm();
      await cargarRegistros();
      await cargarSolicitudes();
    } catch (err) {
      console.error(err);
      setMensaje("❌ Error al guardar");
    }

    setTimeout(() => setMensaje(""), 4000);
  };

  const handleEdit = (registro) => {
    setFormData({ ...registro });
    setEditandoId(registro.id);
    setSolicitudUsada(null);
    if (registro.servicioFinalizado === "si") {
      setCodigoValido(true); // Si el servicio está finalizado, habilitar la validación del código
    }
  };

  const handleDelete = async (id) => {
    await deleteDoc(doc(db, "serviciosTecnicos", id));
    if (editandoId === id) resetForm();
    await cargarRegistros();
    await cargarSolicitudes();
  };

  const cargarDesdeSolicitud = (solicitud) => {
    const {
      consecutivo = "",
      usuario = "",
      codigoservicio = "", // Cargar el código de servicio desde la solicitud
      fecha = "",
      cargo = "",
      equipo = "",
      descripcion = "",
    } = solicitud;

    setFormData((prev) => ({
      ...prev,
      consecutivo,
      usuario,
      codigoservicio, // Asignamos el código de servicio aquí
      fecha,
      cargo,
      equipo,
      falla: descripcion || "",
    }));
    setSolicitudUsada(solicitud);
  };

  const inputStyle = {
    backgroundColor: "#e0f7fa",
    padding: 4,
    margin: 4,
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
    margin: "2px",
  };

  const registrosFiltrados = registros.filter((r) =>
    [r.usuario, r.equipo, r.tecnico, r.cargo, r.fecha]
      .join(" ")
      .toLowerCase()
      .includes(filtroTexto.toLowerCase())
  );

  return (
    <div style={{ padding: 24, marginTop: "80px" }}>
       <h1 style={{
        fontSize: "36px",
        color: "#2c3e50",
        textShadow: "2px 2px 4px rgba(0,0,0,0.3)",
        fontWeight: "900",
        letterSpacing: "1px",
        textAlign: "center",
        marginBottom: "24px"
      }}>
        Servicios tecnicos solicitados
      </h1>

      <h2>Solicitudes pendientes sin atender:</h2>
      {solicitudesDisponibles.length === 0 && <p>No hay solicitudes pendientes.</p>}
      {solicitudesDisponibles.map((s, i) => (
        <button
          key={i}
          onClick={() => cargarDesdeSolicitud(s)}
          style={{
            margin: 4,
            padding: "4px 10px",
            backgroundColor: "#ffc107",
            borderRadius: "4px",
          }}
        >
          Usar solicitud #{s.consecutivo} de {s.usuario}
        </button>
      ))}

      {solicitudUsada && (
        <div
          style={{
            marginTop: 10,
            padding: 10,
            backgroundColor: "#d1ecf1",
            border: "1px solid #bee5eb",
            borderRadius: "6px",
          }}
        >
          <strong>Basado en solicitud:</strong> #{solicitudUsada.consecutivo} - {solicitudUsada.usuario}
        </div>
      )}

      {/* Formulario */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <div>
          <label>Consecutivo:</label>
          <select
            value={formData.consecutivo}
            onChange={(e) => {
              const selected = solicitudesDisponibles.find(
                (s) => s.consecutivo === e.target.value
              );
              if (selected) {
                handleChange("consecutivo", selected.consecutivo);
                handleChange("usuario", selected.nombre); // puedes traer más campos si deseas
                handleChange("fecha", new Date().toISOString().slice(0, 10)); // fecha actual
              }
            }}
            style={{ ...inputStyle, fontWeight: "bold", backgroundColor: "#fffacd" }}
          >
            <option value="">-- Seleccionar solicitud pendiente --</option>
            {solicitudesDisponibles.map((sol) => (
              <option key={sol.id} value={sol.consecutivo}>
                {sol.consecutivo} - {sol.nombre}
              </option>
            ))}
          </select>
        </div>

        {["usuario", "fecha", "codigoservicio", "cargo", "equipo", "falla", "diagnostico", "solucion", "tecnico", "observacion"].map(
          (key) => (
            <div key={key}>
              <label>{key.charAt(0).toUpperCase() + key.slice(1)}</label>
              <input
                type={key === "fecha" ? "date" : "text"}
                value={formData[key]}
                onChange={(e) => handleChange(key, e.target.value)}
                style={inputStyle}
              />
            </div>
          )
        )}

        {/* Validación del código */}
        <div>
          <button
            onClick={() => setCodigoValido(formData.codigoservicio === codigosSolicitud[formData.consecutivo])}
            style={{
              padding: "6px 12px",
              backgroundColor: "#3498db",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Validar Código
          </button>
        </div>

        {/* Selección de partes reemplazadas */}
        <div>
          <label>Partes reemplazadas:</label><br />
          {partesOpciones.map((parte) => (
            <label key={parte} style={{ display: "block" }}>
              <input type="checkbox" checked={formData.partes.includes(parte)} onChange={() => handleChange("partes", formData.partes.includes(parte) ? formData.partes.filter(p => p !== parte) : [...formData.partes, parte])} />
              {parte}
            </label>
          ))}
        </div>

        {/* Tipo de Soporte */}
        <div>
          <label>Tipo de Soporte:</label><br />
          <label><input type="radio" checked={formData.tipoSoporte === "virtual"} onChange={() => handleChange("tipoSoporte", "virtual")} /> Virtual</label>
          <label style={{ marginLeft: 10 }}><input type="radio" checked={formData.tipoSoporte === "presencial"} onChange={() => handleChange("tipoSoporte", "presencial")} /> Presencial</label>
        </div>

        {/* Servicio Finalizado */}
        <div>
          <label>Servicio Finalizado:</label><br />
          <label><input type="radio" checked={formData.servicioFinalizado === "no"} onChange={() => handleChange("servicioFinalizado", "no")} /> No</label>
          <label style={{ marginLeft: 10 }}><input type="radio" checked={formData.servicioFinalizado === "si"} onChange={() => handleChange("servicioFinalizado", "si")} /> Sí</label>
        </div>

        {/* Aplazado */}
        <div>
          <label>Servicio aplazado:</label><br />
          <label><input type="radio" checked={formData.aplazado === "no"} onChange={() => handleChange("aplazado", "no")} /> No</label>
          <label style={{ marginLeft: 10 }}><input type="radio" checked={formData.aplazado === "si"} onChange={() => handleChange("aplazado", "si")} /> Sí</label>
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

      </div>

      {/* Guardar */}
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
            cursor: formValido ? "pointer" : "not-allowed",
          }}
        >
          Guardar
        </button>
      </div>

      {/* Lista de registros */}
      <h2 style={{ marginTop: 32 }}>Registros guardados</h2>
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
          backgroundColor: "#f0f8ff",
          marginBottom: 16,
        }}
      />

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "16px",
          justifyContent: "flex-start",
        }}
      >
        {registrosFiltrados.map((r) => (
          <div
            key={r.id}
            style={{
              width: "300px",
              border: "1px solid #ccc",
              borderRadius: "8px",
              padding: "12px",
              backgroundColor: "#fdfefe",
              boxShadow: "2px 2px 6px rgba(0,0,0,0.1)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              fontSize: "12px",
            }}
          >
            <div><strong>Consecutivo:</strong> {r.consecutivo}</div>
            <div><strong>Usuario:</strong> {r.usuario}</div>
            <div><strong>Codigo Servicio:</strong> {r.codigoservicio}</div>
            <div><strong>Fecha:</strong> {r.fecha}</div>
            <div><strong>Equipo:</strong> {r.equipo}</div>
            <div><strong>Diagnóstico:</strong> {r.diagnostico}</div>
            <div><strong>Solución:</strong> {r.solucion}</div>
            <div><strong>Finalizado:</strong> {r.servicioFinalizado}</div>
            <div><strong>Técnico:</strong> {r.tecnico}</div>
            <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between" }}>
              <button
                onClick={() => handleEdit(r)}
                style={{ ...botonAccionStyle, backgroundColor: "#f39c12" }}
              >
                Editar
              </button>
              <button
                onClick={() => handleDelete(r.id)}
                style={{ ...botonAccionStyle, backgroundColor: "#c0392b" }}
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
          position: "fixed",
          bottom: "20px",
          left: "110px",
          zIndex: 1000,
          padding: "12px 24px",
          backgroundColor: "#2980b9",
          color: "white",
          border: "none",
          borderRadius: "5px",
          cursor: "pointer",
          boxShadow: "0px 4px 6px rgba(0,0,0,0.2)",
        }}
        onClick={() => router.push("/")}
      >
        ⬅ Regresar
      </button>
    </div>
  );
}
