import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getUserRoleByUid } from "@/utils/getUserRole";
import { db } from "@/firebase/firebaseConfig";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { USUARIOS_BASE } from "@/utils/usuarios-base";
import LayoutWithSidebar from "@/components/LayoutWithSidebar";
import PageHeader from "@/components/PageHeader";
import { imprimirInformeTecnico, descargarInformeTecnico, generarInformeTecnicoPDF } from "@/utils/generarInformePDF";
import { Printer, Download, Mail } from "lucide-react";
import ModalEnviarEmail from "@/components/ModalEnviarEmail";

/* ==================== PRESETS (mismos que Hoja de Vida) ==================== */
const CARGO_PRESETS = [
  "LIDER SOCIAL ",
  "CONTADOR",
  "AUXILIAR DE COMPRAS",
  "AUXILIAR​ES",
  "REVISORA FISCAL",
  "ASISTENTE DE CONTABILIDAD",
  "LIQUIDADORA",
  "DIRECTOR DE OPERACIONES",
  "COORDINADOR SGST",
  "ASISTENTE DE OPERACIONES",
  "COORDINADORA DE RECURSO H",
  "ASISTENTE ADMINISTRATIVA",
  "AUX GESTIONH",
  "COORDINADOR DE OPERACIONES",
  "AUX R. HUMANO  BUENAVENTURA",
];

const NOMBRE_PC_PRESETS = Array.from({ length: 100 }, (_, i) => {
  const n = String(i + 1).padStart(3, "0");
  return `LOGISPORT${n}`;
});

// util para consecutivo interno
const ymd = (d) =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(
    d.getDate()
  ).padStart(2, "0")}`;

const genInternoId = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let r = "";
  for (let i = 0; i < 4; i++) r += chars[Math.floor(Math.random() * chars.length)];
  return `INT-${ymd(new Date())}-${r}`;
};

export default function ServiciosTecnicos() {
  const CLAVE_ELIMINACION = "2025.2025.";
  const router = useRouter();

  // --------- Estados principales ----------
  const [formData, setFormData] = useState({
    correoUsuario: "",
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
    // legacy
    limpieza: false,
    mantenimiento: false,
    cambioClave: false,
    visitaCorrectiva: false,

    // Actividades internas
    esInterno: false,              // solo decorativo; la validación usa ausencia de consecutivo
    consecutivoInterno: "",

    visitaPreventiva: false,
    visitaPreventivaModalidad: "", // "virtual" | "presencial"

    mantenimientoPreventivo: false,
    mantPrevModalidad: "",         // "virtual" | "presencial"
    mantPrevHW: false,
    mantPrevSW: false,

    limpiezaExterna: false,
    mantenimientoInterno: false,

    tecnico: "",
    observacion: "",

    // Campos de negocio visibles
    tipoSoporte: "virtual", // UI
    servicioFinalizado: "no", // UI
    // Espejos para indicadores (se persistirán igual)
    modalidad: "", // "virtual" | "presencial"
    finalizado: "", // "si" | "no"
  });

  const [registros, setRegistros] = useState([]);
  const [solicitudesDisponibles, setSolicitudesDisponibles] = useState([]);
  const [codigosSolicitud, setCodigosSolicitud] = useState({});
  const [editandoId, setEditandoId] = useState(null);
  const [mensaje, setMensaje] = useState("");
  const [codigoValido, setCodigoValido] = useState(false);
  const [formValido, setFormValido] = useState(false);
  const [filtroTexto, setFiltroTexto] = useState("");
  const [claveEliminar, setClaveEliminar] = useState("");
  const [rolActual, setRolActual] = useState("usuario");
  
  // Estados para modal de email
  const [modalEmail, setModalEmail] = useState(false);
  const [servicioParaEmail, setServicioParaEmail] = useState(null);
  const [emailsDestino, setEmailsDestino] = useState("");
  const [asuntoEmail, setAsuntoEmail] = useState("");
  const [mensajeEmail, setMensajeEmail] = useState("");
  const [enviandoEmail, setEnviandoEmail] = useState(false);
  
  // Estados para cargos y técnicos dinámicos desde Firestore
  const [cargosDisponibles, setCargosDisponibles] = useState([]);
  const [tecnicosDisponibles, setTecnicosDisponibles] = useState([]);
  const [usuariosCatalogo, setUsuariosCatalogo] = useState([]); // usuarios con correo

  // helper: si hay una solicitud seleccionada
  const tieneSolicitud = Boolean((formData.consecutivo || "").trim());

  // Hay alguna actividad interna marcada
  const anyInternalSelected =
    formData.visitaPreventiva ||
    formData.mantenimientoPreventivo ||
    formData.limpiezaExterna ||
    formData.mantenimientoInterno;

  // Servicio interno = NO hay consecutivo (independiente del checkbox decorativo)
  const esServicioInterno = !tieneSolicitud;

  // Función para abrir modal de email
  const abrirModalEmail = (servicio) => {
    setServicioParaEmail(servicio);
    setModalEmail(true);
  };

  // Función para enviar email con PDF
  const enviarEmailConPDF = async (e) => {
    e.preventDefault();
    setEnviandoEmail(true);

    try {
      const formData = new FormData(e.target);
      const emailsDestino = formData.get('emailsDestino');
      const asuntoEmail = formData.get('asuntoEmail');
      const mensajeEmail = formData.get('mensajeEmail');

      // Generar PDF
      const doc = generarInformeTecnicoPDF(servicioParaEmail);
      if (!doc) {
        throw new Error("No se pudo generar el PDF");
      }

      // Convertir PDF a base64
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const filename = `Informe_Tecnico_${servicioParaEmail.codigo || servicioParaEmail.consecutivo || "SIN_CODIGO"}.pdf`;

      // Enviar via API
      const response = await fetch('/api/enviarEmailConPDF', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: emailsDestino,
          subject: asuntoEmail,
          message: mensajeEmail,
          pdfBase64: pdfBase64,
          filename: filename,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMensaje("✅ Correo enviado exitosamente");
        setModalEmail(false);
        setServicioParaEmail(null);
      } else {
        throw new Error(data.error || "Error desconocido");
      }
    } catch (error) {
      console.error("Error enviando email:", error);
      setMensaje("❌ Error al enviar el correo: " + error.message);
    } finally {
      setEnviandoEmail(false);
      setTimeout(() => setMensaje(""), 5000);
    }
  };

  // --- Cargar registros y solicitudes ---
  const cargarRegistros = async () => {
    try {
      const snapshot = await getDocs(collection(db, "serviciosTecnicos"));
      setRegistros(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error cargando registros de serviciosTecnicos:", error);
      setRegistros([]);
    }
  };

  const cargarSolicitudes = async () => {
    try {
      const snapshot = await getDocs(collection(db, "solicitudes"));

      // Intentar obtener los consecutivos ya usados; si falla por permisos, continuar sin filtrar
      let usados = [];
      try {
        const usadosSnapshot = await getDocs(collection(db, "serviciosTecnicos"));
        usados = usadosSnapshot.docs.map((d) => d.data().consecutivo);
      } catch (permError) {
        console.warn("Sin permiso para leer serviciosTecnicos al cargar solicitudes. Mostrando todas las solicitudes.", permError);
      }

      const disponibles = snapshot.docs
        .filter((doc) => !usados.includes(doc.data().consecutivo))
        .map((doc) => ({ id: doc.id, ...doc.data() }));

      const codigos = {};
      disponibles.forEach((item) => {
        codigos[item.consecutivo] = item.codigo;
      });

      setCodigosSolicitud(codigos);
      setSolicitudesDisponibles(disponibles);
    } catch (error) {
      console.error("Error cargando solicitudes:", error);
      setSolicitudesDisponibles([]);
    }
  };

  // --- Cargar cargos, técnicos y usuarios desde Firestore ---
  const cargarCargosYTecnicos = async () => {
    try {
      // Cargar cargos activos desde Firestore
      const cargosSnapshot = await getDocs(collection(db, "cargosCatalogo"));
      const cargosFirestore = cargosSnapshot.docs
        .map(d => d.data().nombre || d.data().cargo || "")
        .filter(Boolean);
      const todosCargos = Array.from(new Set([...cargosFirestore, ...CARGO_PRESETS])).sort();
      setCargosDisponibles(todosCargos.map(nombre => ({ nombre })));

      // Cargar técnicos activos
      const tecnicosSnapshot = await getDocs(collection(db, "tecnicos"));
      const tecnicosData = tecnicosSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(t => t.activo !== false)
        .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
      setTecnicosDisponibles(tecnicosData);

      // Cargar usuarios desde usuariosCatalogo con su correo
      const usuariosSnapshot = await getDocs(collection(db, "usuariosCatalogo"));
      const usuariosData = usuariosSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(u => u.activo !== false && u.nombre)
        .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
      setUsuariosCatalogo(usuariosData);
    } catch (error) {
      console.error("Error cargando catálogos:", error);
      setCargosDisponibles(CARGO_PRESETS.map(nombre => ({ nombre })));
    }
  };

  useEffect(() => {
    cargarRegistros();
    cargarSolicitudes();
    cargarCargosYTecnicos();
  }, []);

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const role = await getUserRoleByUid(user.uid);
        setRolActual(role);
      }
    });
    return () => unsub();
  }, []);

  // --- Prefill desde query ---
  useEffect(() => {
    if (router.query && router.query.consecutivo) {
      setFormData((prev) => ({
        ...prev,
        consecutivo: router.query.consecutivo || "",
        usuario: router.query.usuario || "",
        fecha: router.query.fecha || "",
        falla: router.query.descripcion || "",
        codigoservicio: router.query.codigo || "",
      }));

      if (router.query.codigo && router.query.codigo === router.query.codigo) {
        setCodigoValido(true);
        setMensaje("✅ Código validado automáticamente");
        setTimeout(() => setMensaje(""), 4000);
      }
    }
  }, [router.query]);

  // --- Validación de formulario (condición de negocio) ---
  const camposRequeridosLlenos = () => {
    const campos = [
      "usuario",
      "fecha",
      "cargo",
      "equipo",
      "falla",
      "diagnostico",
      "solucion",
      "tecnico",
    ];
    return campos.every(
      (campo) => formData[campo] && String(formData[campo]).trim() !== ""
    );
  };

  useEffect(() => {
    // Si finalizado=si y hay solicitud, exigimos código válido (misma lógica de siempre)
    const okCodigo =
      formData.servicioFinalizado === "si"
        ? (esServicioInterno ? true : codigoValido)
        : true;

    // Si es servicio interno (no hay consecutivo), exigir al menos una actividad interna
    const okInterno = esServicioInterno ? anyInternalSelected : true;

    setFormValido(camposRequeridosLlenos() && okCodigo && okInterno);
  }, [formData, codigoValido, esServicioInterno, anyInternalSelected]);

  // --- Opciones de catálogos (cargos, PCs y usuarios) ---
  const opciones = useMemo(() => {
    const uniq = (arr) =>
      Array.from(
        new Set((arr || []).filter(Boolean).map((s) => String(s).trim()))
      );

    // Cargos desde registros + presets
    const cargosReg = uniq(registros.map((r) => r.cargo));
    const cargosFirestore = cargosDisponibles.map(c => c.nombre || "");
    const cargos = uniq([...cargosFirestore, ...cargosReg]).sort((a, b) =>
      a.localeCompare(b, "es", { sensitivity: "base" })
    );

    // PCs (equipo) desde registros + presets
    const pcsReg = uniq(registros.map((r) => r.equipo));
    const pcs = uniq([...NOMBRE_PC_PRESETS, ...pcsReg]).sort((a, b) =>
      a.localeCompare(b, "es", { sensitivity: "base" })
    );

    // Usuarios: catálogo Firestore + registros anteriores + solicitudes
    const usuariosFirestore = usuariosCatalogo.map(u => u.nombre).filter(Boolean);
    const usuariosReg = uniq(registros.map((r) => r.usuario));
    const usuariosSol = uniq(solicitudesDisponibles.map((s) => s.usuario || s.nombre)) || [];
    const usuarios = uniq([...usuariosFirestore, ...USUARIOS_BASE, ...usuariosReg, ...usuariosSol]).sort(
      (a, b) => a.localeCompare(b, "es", { sensitivity: "base" })
    );

    return { cargos, pcs, usuarios };
  }, [registros, solicitudesDisponibles, cargosDisponibles, usuariosCatalogo]);

  // --- Handlers ---
  const handleChange = async (key, value) => {
    // Espejos para indicadores
    if (key === "tipoSoporte") {
      setFormData((prev) => ({ ...prev, tipoSoporte: value, modalidad: value }));
      return;
    }
    if (key === "servicioFinalizado") {
      setFormData((prev) => ({ ...prev, servicioFinalizado: value, finalizado: value }));
      return;
    }

    // Al seleccionar un consecutivo real, bloqueamos las actividades internas (por UI)
    if (key === "consecutivo") {
      setFormData((prev) => ({ ...prev, [key]: value }));
      return;
    }

    setFormData((prev) => ({ ...prev, [key]: value }));

    if (key === "codigoservicio") {
      try {
        const snapshot = await getDocs(collection(db, "solicitudes"));
        const matching = snapshot.docs.find(
          (docx) =>
            docx.data().consecutivo === formData.consecutivo &&
            docx.data().correo === formData.correoUsuario &&
            docx.data().codigo === value
        );

        if (matching) {
          setCodigoValido(true);
          setMensaje("✅ Código validado correctamente por consecutivo y correo");
        } else {
          setCodigoValido(false);
          setMensaje("❌ Código inválido para este correo o consecutivo");
        }
        setTimeout(() => setMensaje(""), 4000);
      } catch (error) {
        console.error("Error validando código:", error);
        setMensaje("❌ Error al validar el código");
        setTimeout(() => setMensaje(""), 4000);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      correoUsuario: "",
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
      visitaCorrectiva: false,

      esInterno: false,
      consecutivoInterno: "",

      visitaPreventiva: false,
      visitaPreventivaModalidad: "",

      mantenimientoPreventivo: false,
      mantPrevModalidad: "",
      mantPrevHW: false,
      mantPrevSW: false,

      limpiezaExterna: false,
      mantenimientoInterno: false,

      tecnico: "",
      observacion: "",
      tipoSoporte: "virtual",
      servicioFinalizado: "no",
      modalidad: "",
      finalizado: "",
    });
    setEditandoId(null);
    setCodigoValido(false);
  };

  // Guardado GENERAL (aplica tanto a solicitud real como a servicio interno)
  const handleSave = async () => {
    // Si es finalizado y hay solicitud, exige código
    if (formData.servicioFinalizado === "si" && !esServicioInterno && !codigoValido) {
      setMensaje("⚠ El código ingresado no coincide con el generado en la solicitud.");
      setTimeout(() => setMensaje(""), 6000);
      return;
    }
    // Campos base
    if (!camposRequeridosLlenos()) {
      setMensaje("⚠ Debes completar todos los campos requeridos antes de guardar.");
      setTimeout(() => setMensaje(""), 5000);
      return;
    }
    // Si es servicio interno (no hay consecutivo), exigir al menos una actividad interna
    if (esServicioInterno && !anyInternalSelected) {
      setMensaje("⚠ Para servicios internos selecciona al menos una actividad del módulo 'Actividades internas'.");
      setTimeout(() => setMensaje(""), 6000);
      return;
    }

    // consecutivo interno si aplica (no hay solicitud real)
    let consInt = formData.consecutivoInterno;
    let consOut = formData.consecutivo;
    if (esServicioInterno) {
      consInt = consInt || genInternoId();
      consOut = consOut || consInt;
    }

    const payload = {
      ...formData,
      esInterno: esServicioInterno,
      consecutivo: consOut,
      consecutivoInterno: consInt,
      modalidad: formData.modalidad || formData.tipoSoporte || "",
      finalizado: formData.servicioFinalizado || formData.finalizado || "",  // Priorizar servicioFinalizado
      servicioFinalizado: formData.servicioFinalizado || formData.finalizado || "",  // Asegurar ambos campos
      estado: formData.servicioFinalizado === "si" ? "finalizado" : "pendiente",
    };

    try {
      if (editandoId) {
        await updateDoc(doc(db, "serviciosTecnicos", editandoId), payload);
        setMensaje("✅ Registro actualizado");
      } else {
        await addDoc(collection(db, "serviciosTecnicos"), payload);
        setMensaje("✅ Registro guardado");
      }

      // Sólo si es solicitud real, actualizamos su estado
      if (!esServicioInterno && formData.servicioFinalizado === "si") {
        const snapshot = await getDocs(collection(db, "solicitudes"));
        const solicitudDoc = snapshot.docs.find(
          (docx) => docx.data().consecutivo === formData.consecutivo
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
      setTimeout(() => setMensaje(""), 4000);
    }
  };

  const handleEdit = (registro) => {
    // Mapear a campos de UI
    const merged = {
      ...registro,
      tipoSoporte: registro.tipoSoporte || registro.modalidad || "virtual",
      servicioFinalizado: registro.servicioFinalizado || registro.finalizado || "no",
      modalidad: registro.modalidad || registro.tipoSoporte || "",
      finalizado: registro.finalizado || registro.servicioFinalizado || "",
      // IMPORTANTE: Asegurar que el consecutivo se cargue correctamente
      consecutivo: registro.consecutivo || "",
      codigoservicio: registro.codigoservicio || registro.codigo || "",
    };
    setFormData(merged);
    setEditandoId(registro.id);

    const fin = String(merged.servicioFinalizado || merged.finalizado || "").toLowerCase();
    if (fin === "si" || fin === "true" || fin === "finalizado" || fin === "cerrado" || fin === "completado") {
      setCodigoValido(true);
      setMensaje("✅ Editando servicio. Consecutivo: " + (merged.consecutivo || "Sin consecutivo"));
      setTimeout(() => setMensaje(""), 5000);
    } else {
      setMensaje("🔄 Editando servicio. Consecutivo: " + (merged.consecutivo || "Sin consecutivo"));
      setTimeout(() => setMensaje(""), 4000);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id) => {
    if (!claveEliminar || claveEliminar !== CLAVE_ELIMINACION) {
      setMensaje("❌ Clave incorrecta. No se puede eliminar el registro.");
      setTimeout(() => setMensaje(""), 4000);
      return;
    }
    await deleteDoc(doc(db, "serviciosTecnicos", id));
    if (editandoId === id) resetForm();
    await cargarRegistros();
    await cargarSolicitudes();
  };

  const cargarDesdeSolicitud = (solicitud) => {
    const nombreUsuario = solicitud.usuario || solicitud.nombre || "";
    const correoSolicitud = solicitud.correo || "";

    // Buscar cargo del usuario en usuariosCatalogo via los datos de la solicitud
    const cargoSolicitud = solicitud.cargo || "";

    // Buscar equipo más reciente de este usuario en servicios anteriores
    const serviciosPrevios = registros.filter(
      (r) =>
        r.usuario?.toLowerCase() === nombreUsuario.toLowerCase() ||
        r.correoUsuario?.toLowerCase() === correoSolicitud.toLowerCase()
    );
    const equipoReciente =
      serviciosPrevios.length > 0
        ? serviciosPrevios[serviciosPrevios.length - 1].equipo || ""
        : "";

    setFormData((prev) => ({
      ...prev,
      consecutivo:    solicitud.consecutivo  || "",
      usuario:        nombreUsuario,
      correoUsuario:  correoSolicitud,
      cargo:          cargoSolicitud,
      falla:          solicitud.descripcion  || "",
      equipo:         equipoReciente,
      fecha:          new Date().toISOString().slice(0, 10),
      // El código de solicitud NO se auto-llena (el técnico debe ingresarlo manualmente)
      codigoservicio: "",
      esInterno:      false,
    }));
  };

  // Listado filtrado y ordenado por fecha descendente
  const registrosFiltrados = [...registros]
    .sort((a, b) => {
      // Ordenar por fecha descendente (más reciente primero)
      const fa = a.fecha ? new Date(a.fecha) : new Date(0);
      const fb = b.fecha ? new Date(b.fecha) : new Date(0);
      return fb - fa;
    })
    .filter((r) =>
      [r.usuario, r.equipo, r.tecnico, r.cargo, r.fecha, r.consecutivo, r.diagnostico, r.solucion]
        .join(" ")
        .toLowerCase()
        .includes(filtroTexto.toLowerCase())
    );

  return (
    <LayoutWithSidebar>
      <PageHeader titulo="Servicios Técnicos" subtitulo="Gestión y registro de servicios técnicos" />
    <div style={{ fontFamily: "Arial, sans-serif" }}>
      {/* Encabezado */}
      <div
        style={{
          backgroundColor: "#007acc",
          color: "white",
          padding: 10,
          borderRadius: 10,
          boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
          display: "grid",
          justifyItems: "center",
          gap: 12,
        }}
      >
        <h1
          style={{
            fontSize: 36,
            color: "#111827",
            fontWeight: 900,
            letterSpacing: 1,
            margin: 0,
            textAlign: "center",
          }}
        >
          Servicios técnicos solicitados
        </h1>

        {/* Solicitudes pendientes */}
        <div style={{ ...styles.card, width: "100%" }}>
          <div style={styles.cardHeader}>
            <h3 style={{ margin: 0, fontSize: 18, color: "#111827" }}>
              Solicitudes pendientes sin atender
            </h3>
          </div>
          {solicitudesDisponibles.length === 0 ? (
            <div
              style={{
                ...styles.alert,
                background: "#fff",
                color: "#6b7280",
                borderColor: "#e5e7eb",
                marginTop: 8,
              }}
            >
              No hay solicitudes pendientes.
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginTop: 10,
              }}
            >
              {solicitudesDisponibles.map((s) => (
                <button
                  key={s.id}
                  onClick={() => cargarDesdeSolicitud(s)}
                  style={styles.warnBtn}
                  title={`Usar solicitud #${s.consecutivo}`}
                >
                  Usar #{s.consecutivo} · {s.usuario || s.nombre}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Formulario */}
      <div style={{ marginTop: 16 }}>
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={{ margin: 0, fontSize: 20, color: "#111827" }}>
              Registro de servicio técnico
            </h3>
          </div>

          <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
            {/* Mostrar consecutivo cuando estamos editando */}
            {editandoId && formData.consecutivo && (
              <div style={{ 
                ...styles.alert, 
                background: "#dbeafe", 
                color: "#1e40af",
                borderColor: "#3b82f6",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8
              }}>
                <strong>📝 Editando servicio - Consecutivo:</strong>
                <span style={{ fontSize: 18, fontWeight: 800 }}>{formData.consecutivo}</span>
              </div>
            )}

            {/* Selector solicitud */}
            <div>
              <label style={styles.label}>Consecutivo (desde solicitud)</label>
              <select
                value={formData.consecutivo}
                onChange={(e) => {
                  const selected = solicitudesDisponibles.find(
                    (s) => s.consecutivo === e.target.value
                  );
                  if (selected) {
                    cargarDesdeSolicitud(selected);
                  } else {
                    handleChange("consecutivo", e.target.value);
                  }
                }}
                style={{ ...styles.input, background: editandoId ? "#f0f9ff" : "#fffacd" }}
                disabled={editandoId}
              >
                <option value="">-- Seleccionar solicitud pendiente --</option>
                {solicitudesDisponibles.map((sol) => (
                  <option key={sol.id} value={sol.consecutivo}>
                    {sol.consecutivo} - {sol.usuario || sol.nombre}
                  </option>
                ))}
              </select>
              {editandoId && (
                <small style={{ color: "#6b7280", marginTop: 4, display: "block" }}>
                  El consecutivo no puede cambiarse al editar
                </small>
              )}
            </div>

            {/* Campos principales */}
            <div style={styles.rowGrid3}>
              {/* Usuario — solo selección, auto-llena correo */}
              <div>
                <label style={styles.label}>Usuario</label>
                <select
                  value={formData.usuario}
                  onChange={(e) => {
                    const nombre = e.target.value;
                    // Buscar correo y cargo del usuario en el catálogo
                    const encontrado = usuariosCatalogo.find(u => u.nombre === nombre);
                    setFormData(prev => ({
                      ...prev,
                      usuario: nombre,
                      correoUsuario: encontrado?.email || prev.correoUsuario,
                      cargo: encontrado?.cargo || prev.cargo,
                    }));
                  }}
                  style={styles.input}
                >
                  <option value="">-- Seleccionar usuario --</option>
                  {opciones.usuarios.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
              <FieldUI
                label="Fecha"
                type="date"
                value={formData.fecha}
                onChange={(v) => handleChange("fecha", v)}
              />
              <FieldUI
                label="Código de solicitud"
                value={formData.codigoservicio}
                onChange={(v) => handleChange("codigoservicio", v)}
              />
            </div>

            <div style={styles.rowGrid3}>
              {/* Cargo — solo selección */}
              <div>
                <label style={styles.label}>Cargo</label>
                <select
                  value={formData.cargo}
                  onChange={(e) => handleChange("cargo", e.target.value)}
                  style={styles.input}
                >
                  <option value="">-- Seleccionar cargo --</option>
                  {opciones.cargos.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              {/* Equipo — solo selección */}
              <div>
                <label style={styles.label}>Equipo</label>
                <select
                  value={formData.equipo}
                  onChange={(e) => handleChange("equipo", e.target.value)}
                  style={styles.input}
                >
                  <option value="">-- Seleccionar equipo --</option>
                  {opciones.pcs.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <FieldUI
                label="Correo del usuario"
                type="email"
                value={formData.correoUsuario}
                onChange={(v) => handleChange("correoUsuario", v)}
              />
            </div>

            {/* Técnico - Selector dinámico */}
            <div>
              <label style={styles.label}>Técnico *</label>
              <select
                value={formData.tecnico}
                onChange={(e) => handleChange("tecnico", e.target.value)}
                style={{
                  ...styles.input,
                  background: formData.tecnico ? "#ffffff" : "#fffacd",
                  color: "#0f172a",
                }}
              >
                <option value="">-- Seleccionar técnico --</option>
                {tecnicosDisponibles.map((tec) => (
                  <option key={tec.id} value={tec.nombre}>
                    {tec.nombre} {tec.empresa ? `(${tec.empresa})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.rowGrid2}>
              <FieldUI
                label="Falla"
                value={formData.falla}
                onChange={(v) => handleChange("falla", v)}
              />
              <FieldUI
                label="Diagnóstico"
                value={formData.diagnostico}
                onChange={(v) => handleChange("diagnostico", v)}
              />
            </div>

            <FieldUI
              label="Solución"
              value={formData.solucion}
              onChange={(v) => handleChange("solucion", v)}
            />

            {/* ======= Partes reemplazadas + Actividades internas (lado a lado) ======= */}
            <div style={styles.splitGrid}>
              {/* Columna 1: Partes reemplazadas */}
              <section style={styles.subCard}>
                <div style={styles.subHead}>
                  <span style={styles.subHeadTitle}>Partes reemplazadas</span>
                </div>

                <div style={styles.checkGrid}>
                  {["Disco duro", "Board", "Memoria RAM", "Pantalla", "Equipo", "Teclado"].map(
                    (parte) => (
                      <label key={parte} style={styles.radioLabel}>
                        <input
                          type="checkbox"
                          checked={formData.partes.includes(parte)}
                          onChange={() =>
                            handleChange(
                              "partes",
                              formData.partes.includes(parte)
                                ? formData.partes.filter((p) => p !== parte)
                                : [...formData.partes, parte]
                            )
                          }
                        />
                        {parte}
                      </label>
                    )
                  )}
                </div>
              </section>

              {/* Columna 2: Actividades internas */}
              <section style={styles.subCard}>
                <div style={styles.subHead}>
                  <span style={styles.subHeadTitle}>Actividades internas (sin código)</span>
                  <label
                    style={{ ...styles.radioLabel, marginLeft: "auto" }}
                    title={tieneSolicitud ? "Deshabilitado: hay una solicitud seleccionada" : ""}
                  >
                    <input
                      type="checkbox"
                      checked={formData.esInterno || anyInternalSelected}
                      onChange={(e) => handleChange("esInterno", e.target.checked)}
                      disabled={tieneSolicitud}
                    />
                    Marcar como servicio interno
                  </label>
                </div>

                {esServicioInterno && (
                  <div style={{ marginBottom: 8 }}>
                    <label style={styles.label}>Consecutivo interno</label>
                    <input
                      readOnly
                      value={formData.consecutivoInterno || "Se generará al guardar"}
                      style={{ ...styles.input, background: "#f8fafc" }}
                    />
                  </div>
                )}

                <fieldset
                  disabled={tieneSolicitud}
                  style={{ border: 0, padding: 0, margin: 0, opacity: tieneSolicitud ? 0.6 : 1 }}
                >
                  {/* Visita preventiva */}
                  <div style={{ marginBottom: 12 }}>
                    <label style={styles.label}>Visita preventiva</label>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                      <label style={styles.radioLabel}>
                        <input
                          type="checkbox"
                          checked={formData.visitaPreventiva}
                          onChange={(e) => handleChange("visitaPreventiva", e.target.checked)}
                        />
                        Aplicar
                      </label>
                      {formData.visitaPreventiva && (
                        <>
                          <label style={styles.radioLabel}>
                            <input
                              type="radio"
                              checked={formData.visitaPreventivaModalidad === "virtual"}
                              onChange={() => handleChange("visitaPreventivaModalidad", "virtual")}
                            />
                            Virtual
                          </label>
                          <label style={styles.radioLabel}>
                            <input
                              type="radio"
                              checked={formData.visitaPreventivaModalidad === "presencial"}
                              onChange={() => handleChange("visitaPreventivaModalidad", "presencial")}
                            />
                            Presencial
                          </label>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Mantenimiento preventivo */}
                  <div style={{ marginBottom: 12 }}>
                    <label style={styles.label}>Mantenimiento preventivo</label>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                      <label style={styles.radioLabel}>
                        <input
                          type="checkbox"
                          checked={formData.mantenimientoPreventivo}
                          onChange={(e) => handleChange("mantenimientoPreventivo", e.target.checked)}
                        />
                        Aplicar
                      </label>

                      {formData.mantenimientoPreventivo && (
                        <>
                          <span style={{ color: "#6b7280", fontWeight: 700 }}>Modalidad:</span>
                          <label style={styles.radioLabel}>
                            <input
                              type="radio"
                              checked={formData.mantPrevModalidad === "virtual"}
                              onChange={() => handleChange("mantPrevModalidad", "virtual")}
                            />
                            Virtual
                          </label>
                          <label style={styles.radioLabel}>
                            <input
                              type="radio"
                              checked={formData.mantPrevModalidad === "presencial"}
                              onChange={() => handleChange("mantPrevModalidad", "presencial")}
                            />
                            Presencial
                          </label>

                          <span style={{ color: "#6b7280", fontWeight: 700, marginLeft: 4 }}>Tipo:</span>
                          <label style={styles.radioLabel}>
                            <input
                              type="checkbox"
                              checked={formData.mantPrevHW}
                              onChange={(e) => handleChange("mantPrevHW", e.target.checked)}
                            />
                            Hardware
                          </label>
                          <label style={styles.radioLabel}>
                            <input
                              type="checkbox"
                              checked={formData.mantPrevSW}
                              onChange={(e) => handleChange("mantPrevSW", e.target.checked)}
                            />
                            Software
                          </label>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Limpieza externa */}
                  <div style={{ marginBottom: 12 }}>
                    <label style={styles.label}>Limpieza externa de equipos</label>
                    <label style={styles.radioLabel}>
                      <input
                        type="checkbox"
                        checked={formData.limpiezaExterna}
                        onChange={(e) => handleChange("limpiezaExterna", e.target.checked)}
                      />
                      Aplicar
                    </label>
                  </div>

                  {/* Mantenimiento interno */}
                  <div style={{ marginBottom: 8 }}>
                    <label style={styles.label}>Mantenimiento interno de equipos</label>
                    <label style={styles.radioLabel}>
                      <input
                        type="checkbox"
                        checked={formData.mantenimientoInterno}
                        onChange={(e) => handleChange("mantenimientoInterno", e.target.checked)}
                      />
                      Aplicar
                    </label>
                  </div>
                </fieldset>
              </section>
            </div>
            {/* ======= FIN: Partes + Actividades internas ======= */}

            {/* Tipo de soporte */}
            <div>
              <label style={styles.label}>Tipo de soporte</label>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <label style={styles.radioLabel}>
                  <input
                    type="radio"
                    checked={formData.tipoSoporte === "virtual"}
                    onChange={() => handleChange("tipoSoporte", "virtual")}
                  />
                  Virtual
                </label>
                <label style={styles.radioLabel}>
                  <input
                    type="radio"
                    checked={formData.tipoSoporte === "presencial"}
                    onChange={() => handleChange("tipoSoporte", "presencial")}
                  />
                  Presencial
                </label>
              </div>
            </div>

            {/* Servicio Finalizado */}
            <div>
              <label style={styles.label}>Servicio finalizado</label>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <label style={styles.radioLabel}>
                  <input
                    type="radio"
                    checked={formData.servicioFinalizado === "no"}
                    onChange={() => handleChange("servicioFinalizado", "no")}
                  />
                  No
                </label>
                <label style={styles.radioLabel}>
                  <input
                    type="radio"
                    checked={formData.servicioFinalizado === "si"}
                    onChange={() => handleChange("servicioFinalizado", "si")}
                  />
                  Sí
                </label>
              </div>
            </div>

            {/* Aplazado */}
            <div>
              <label style={styles.label}>Servicio aplazado</label>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <label style={styles.radioLabel}>
                  <input
                    type="radio"
                    checked={formData.aplazado === "no"}
                    onChange={() => handleChange("aplazado", "no")}
                  />
                  No
                </label>
                <label style={styles.radioLabel}>
                  <input
                    type="radio"
                    checked={formData.aplazado === "si"}
                    onChange={() => handleChange("aplazado", "si")}
                  />
                  Sí
                </label>
              </div>
              {formData.aplazado === "si" && (
                <input
                  type="text"
                  placeholder="Motivo"
                  value={formData.motivoAplazado}
                  onChange={(e) => handleChange("motivoAplazado", e.target.value)}
                  style={{ ...styles.input, background: "#fff3cd" }}
                />
              )}
            </div>

            {/* Validación/Reenvío de código */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() =>
                  setCodigoValido(
                    formData.codigoservicio ===
                      codigosSolicitud[formData.consecutivo]
                  )
                }
                style={styles.secondaryBtn}
                disabled={esServicioInterno}
                title={esServicioInterno ? "No aplica para servicios internos" : "Validar código"}
              >
                Validar código
              </button>

              <button
                type="button"
                onClick={async () => {
                  if (esServicioInterno) {
                    setMensaje("ℹ Este servicio es interno; no requiere código.");
                    setTimeout(() => setMensaje(""), 4000);
                    return;
                  }
                  if (!formData.consecutivo || !formData.correoUsuario) {
                    setMensaje(
                      "⚠ Ingrese el consecutivo y el correo del usuario antes de reenviar el código."
                    );
                    setTimeout(() => setMensaje(""), 6000);
                    return;
                  }

                  try {
                    const snapshot = await getDocs(collection(db, "solicitudes"));
                    const docMatch = snapshot.docs.find(
                      (docx) =>
                        docx.data().consecutivo === formData.consecutivo &&
                        docx.data().correo === formData.correoUsuario
                    );

                    if (docMatch) {
                      const data = docMatch.data();

                      const response = await fetch("/api/enviarCorreoElectronico", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          to: data.correo,
                          subject: "Reenvío de código de seguimiento",
                          text: `Código: ${data.codigo}\nConsecutivo: ${data.consecutivo}`,
                        }),
                      });

                      if (response.ok) {
                        setMensaje("📧 Código reenviado al correo del usuario.");
                      } else {
                        setMensaje("❌ No se pudo enviar el correo.");
                      }
                    } else {
                      setMensaje(
                        "⚠ No se encontró solicitud con ese correo y consecutivo."
                      );
                    }
                  } catch (error) {
                    console.error("Error reenviando código:", error);
                    setMensaje("❌ Error interno al reenviar el código.");
                  }

                  setTimeout(() => setMensaje(""), 6000);
                }}
                style={styles.warnBtn}
                title="Reenviar código al usuario"
              >
                Reenviar código
              </button>
            </div>

            {/* Observación */}
            <FieldUI
              label="Observación"
              value={formData.observacion}
              onChange={(v) => handleChange("observacion", v)}
            />

            {/* Mensajes */}
            {mensaje && (
              <div
                style={{
                  ...styles.alert,
                  background: mensaje.startsWith("❌") ? "#fee2e2" : "#ecfccb",
                  color: mensaje.startsWith("❌") ? "#991b1b" : "#3f6212",
                  borderColor: mensaje.startsWith("❌") ? "#fca5a5" : "#a3e635",
                }}
              >
                {mensaje}
              </div>
            )}

            {/* Botón Guardar GENERAL */}
            <div style={{ display: "flex", justifyContent: "center" }}>
              <button
                type="button"
                onClick={handleSave}
                disabled={!formValido}
                style={{
                  ...styles.primaryBtn,
                  opacity: formValido ? 1 : 0.5,
                  cursor: formValido ? "pointer" : "not-allowed",
                }}
                title={
                  !camposRequeridosLlenos()
                    ? "Completa los campos obligatorios (usuario, fecha, cargo, equipo, falla, diagnóstico, solución, técnico)."
                    : esServicioInterno && !anyInternalSelected
                    ? "Selecciona al menos una actividad interna."
                    : formData.servicioFinalizado === "si" && !esServicioInterno && !codigoValido
                    ? "Para finalizar con solicitud, valida el código."
                    : "Guardar"
                }
              >
                {formValido ? "✅ Guardar Finalizado" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* datalist (catálogos) */}
      <datalist id="usuariosOptions">
        {opciones.usuarios.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
      <datalist id="cargoOptions">
        {opciones.cargos.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
      <datalist id="pcOptions">
        {opciones.pcs.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>

      {/* Listado */}
      <div style={{ marginTop: 32, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <h2 style={{ margin: 0, color: "#111827", fontSize: 28, fontWeight: 800 }}>
            📋 Registros guardados ({registrosFiltrados.length})
          </h2>
          {/* Filtro de búsqueda */}
          <input
            type="text"
            placeholder="🔍 Buscar por usuario, equipo, técnico, cargo, fecha, consecutivo..."
            value={filtroTexto}
            onChange={(e) => setFiltroTexto(e.target.value)}
            style={{ ...styles.input, maxWidth: 400, padding: "10px 14px", borderRadius: 10, border: "2px solid #0B3D91", fontSize: 14 }}
          />
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))",
          gap: 20,
          marginTop: 12,
        }}
      >
        {registrosFiltrados.map((r) => {
          const mantPrevTxt = r.mantenimientoPreventivo
            ? [
                r.mantPrevModalidad || "",
                r.mantPrevHW ? "HW" : "",
                r.mantPrevSW ? "SW" : "",
              ]
                .filter(Boolean)
                .join(" · ")
            : "No";

          return (
            <div 
              key={r.id} 
              style={{
                ...styles.cardCompact,
                transition: "all 0.3s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-4px)";
                e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.12)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)";
              }}
            >
              {/* Header compacto */}
              <div style={{
                background: "linear-gradient(135deg, #0B3D91 0%, #00AEEF 100%)",
                padding: "10px 14px",
                borderRadius: "10px 10px 0 0",
                marginBottom: 12,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 15, color: "white", fontWeight: 700 }}>
                      {r.usuario || "Usuario"}
                    </h3>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.9)", marginTop: 2 }}>
                      {r.fecha} • {r.equipo}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                    <span style={{ ...styles.badgeCompact, background: "white", color: "#0B3D91" }}>
                      {r.consecutivo}
                    </span>
                    <span style={{
                      ...styles.badgeCompact,
                      background: (r.servicioFinalizado === "si" || r.finalizado === "si") ? "#10b981" : "#f59e0b",
                      color: "white",
                      fontSize: 10,
                    }}>
                      {(r.servicioFinalizado === "si" || r.finalizado === "si") ? "✅ Finalizado" : "⏳ Pendiente"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Información compacta en grid */}
              <div style={{ padding: "0 14px", display: "grid", gap: 8 }}>
                {/* Sección principal */}
                <div style={styles.infoSection}>
                  <RowCompact icon="📄" label="Diagnóstico" value={r.diagnostico} />
                  <RowCompact icon="✅" label="Solución" value={r.solucion} />
                  <RowCompact icon="👨‍🔧" label="Técnico" value={r.tecnico} />
                </div>

                {/* Detalles adicionales (colapsables visualmente) */}
                <details style={{ fontSize: 12 }}>
                  <summary style={{ cursor: "pointer", color: "#6b7280", fontWeight: 600, padding: "6px 0" }}>
                    🔍 Ver más detalles
                  </summary>
                  <div style={{ ...styles.infoSection, marginTop: 8, paddingTop: 8, borderTop: "1px solid #e5e7eb" }}>
                    <RowCompact icon="💼" label="Cargo" value={r.cargo} />
                    <RowCompact icon="💻" label="Modalidad" value={r.tipoSoporte || r.modalidad} />
                    {r.esInterno && <RowCompact icon="🏠" label="Servicio" value="Interno" />}
                    {r.visitaPreventiva && (
                      <RowCompact 
                        icon="🔍" 
                        label="Visita preventiva" 
                        value={r.visitaPreventivaModalidad || "Sí"} 
                      />
                    )}
                    {r.mantenimientoPreventivo && (
                      <RowCompact icon="🔧" label="Mant. preventivo" value={mantPrevTxt} />
                    )}
                    {r.limpiezaExterna && <RowCompact icon="🧹" label="Limpieza" value="Externa" />}
                    {r.mantenimientoInterno && <RowCompact icon="⚙️" label="Mantenimiento" value="Interno" />}
                  </div>
                </details>
              </div>

              <div style={{ marginTop: 14, padding: "0 14px 14px 14px", display: "grid", gap: 8 }}>
                {/* Botones de PDF - Compactos */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                  <button
                    onClick={() => imprimirInformeTecnico(r)}
                    style={{ ...styles.btnCompact, background: "#007acc" }}
                    title="Imprimir informe técnico"
                  >
                    <Printer size={14} />
                    <span style={{ fontSize: 11 }}>Imprimir</span>
                  </button>
                  <button
                    onClick={() => descargarInformeTecnico(r)}
                    style={{ ...styles.btnCompact, background: "#334155" }}
                    title="Descargar PDF"
                  >
                    <Download size={14} />
                    <span style={{ fontSize: 11 }}>PDF</span>
                  </button>
                  <button
                    onClick={() => abrirModalEmail(r)}
                    style={{ ...styles.btnCompact, background: "#10b981" }}
                    title="Enviar por correo"
                  >
                    <Mail size={14} />
                    <span style={{ fontSize: 11 }}>Email</span>
                  </button>
                </div>
                
                {/* Botones de Editar/Eliminar - Compactos */}
                <div style={{ display: "grid", gridTemplateColumns: rolActual === "admin" ? "1fr 1fr" : "1fr", gap: 6 }}>
                  <button onClick={() => handleEdit(r)} style={{ ...styles.btnCompact, background: "#f59e0b" }}>
                    <span style={{ fontSize: 11 }}>✏️ Editar</span>
                  </button>
                  {rolActual === "admin" && (
                    <button 
                      onClick={() => {
                        const confirmDelete = window.confirm(`¿Está seguro de eliminar el servicio ${r.consecutivo}?\n\nIngrese la clave de eliminación en el prompt siguiente.`);
                        if (confirmDelete) {
                          const clave = window.prompt("Ingrese la clave de eliminación:");
                          if (clave === "2025.2025.") {
                            handleDelete(r.id);
                          } else {
                            alert("❌ Clave incorrecta");
                          }
                        }
                      }}
                      style={{ ...styles.btnCompact, background: "#ef4444" }}
                    >
                      <span style={{ fontSize: 11 }}>🗑️ Eliminar</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

    </div>

    {/* Modal de envío de email */}
    <ModalEnviarEmail
      isOpen={modalEmail}
      onClose={() => {
        setModalEmail(false);
        setServicioParaEmail(null);
      }}
      servicio={servicioParaEmail}
      onEnviar={enviarEmailConPDF}
      enviando={enviandoEmail}
    />
    </LayoutWithSidebar>
  );
}

/* ---------- Subcomponentes de UI ---------- */
function FieldUI({ label, value, onChange, type = "text", listId }) {
  return (
    <div>
      <label style={styles.label}>{label}</label>
      <input
        type={type}
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={styles.input}
      />
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 8 }}>
      <div style={{ color: "#6b7280", fontWeight: 700 }}>{label}:</div>
      <div style={{ color: "#111827" }}>{value || "—"}</div>
    </div>
  );
}

function RowCompact({ icon, label, value }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 13 }}>
      <span style={{ fontSize: 14, lineHeight: 1.3 }}>{icon}</span>
      <div style={{ flex: 1, lineHeight: 1.4 }}>
        <span style={{ color: "#6b7280", fontWeight: 600 }}>{label}:</span>
        <span style={{ color: "#111827", marginLeft: 6 }}>{value || "—"}</span>
      </div>
    </div>
  );
}

/* ------------------------ Estilos ------------------------ */
const styles = {
  card: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 12,
    background: "white",
    boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
  },
  cardCompact: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    background: "white",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
    overflow: "hidden",
    height: "fit-content",
  },
  badgeCompact: {
    padding: "3px 8px",
    borderRadius: 12,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.3,
  },
  infoSection: {
    display: "grid",
    gap: 8,
  },
  btnCompact: {
    color: "white",
    padding: "8px 10px",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    transition: "all 0.2s ease",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: "1px solid #f3f4f6",
    paddingBottom: 6,
  },
  label: {
    display: "block",
    fontSize: 12,
    color: "#6b7280",
    fontWeight: 700,
    marginBottom: 6,
  },
  input: {
    width: "100%",
    padding: "10px 10px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    outline: "none",
    background: "#ffffff",
    color: "#0f172a",
  },
  primaryBtn: {
    background: "#007acc",
    color: "white",
    padding: "10px 16px",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 700,
  },
  secondaryBtn: {
    background: "#334155",
    color: "white",
    padding: "8px 12px",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 700,
  },
  warnBtn: {
    background: "#f39c12",
    color: "white",
    padding: "8px 12px",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 700,
  },
  dangerBtn: {
    background: "#c0392b",
    color: "white",
    padding: "8px 12px",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 700,
  },
  badge: {
    padding: "4px 8px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
  },
  alert: {
    border: "1px solid",
    borderRadius: 8,
    padding: "10px 12px",
    textAlign: "center",
    fontWeight: 700,
  },
  rowGrid2: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
    gap: 12,
  },
  rowGrid3: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
    gap: 12,
  },
  radioLabel: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "#111827",
    fontWeight: 600,
  },
  backBtn: {
    position: "fixed",
    bottom: 20,
    left: 20,
    backgroundColor: "#007acc",
    color: "white",
    padding: "10px 16px",
    borderRadius: 8,
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    zIndex: 1000,
    textDecoration: "none",
    fontWeight: 700,
    border: "none",
    cursor: "pointer",
  },

  /* Layout a dos columnas para rellenar el espacio */
  splitGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(360px,1fr))",
    gap: 16,
  },
  subCard: {
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: 12,
    background: "#fff",
  },
  subHead: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    paddingBottom: 6,
    borderBottom: "1px solid #f3f4f6",
    marginBottom: 10,
  },
  subHeadTitle: {
    fontWeight: 800,
    color: "#111827",
  },
  checkGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
    gap: 8,
  },
};
