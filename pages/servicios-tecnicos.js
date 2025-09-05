// pages/servicios-tecnicos.js – FINAL (Logisport)
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { db } from "@/firebase/firebaseConfig";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
} from "firebase/firestore";
import { USUARIOS_BASE } from "@/utils/usuarios-base";

/* ==================== PRESETS ==================== */
const CARGO_PRESETS = [
  "gerencia",
  "asistente administrativa",
  "auxiliar contable",
  "auxiliar comercio exterior",
  "analista comercio exterior",
  "jefe de exportacion",
  "jefe de importacion",
  "Tramitadores",
  "Analista importacion",
  "Revisora importacion",
  "Auxiliar aduanero",
  "Auxiliar de comercio exterior",
  "Aprendiz sena",
  "Auxiliar operativo",
  "Auxiliar administrativo y coserje",
  "Archivo",
];

const NOMBRE_PC_PRESETS = Array.from({ length: 100 }, (_, i) => {
  const n = String(i + 1).padStart(3, "0");
  return `SIDECOMEX${n}`; // solo catálogo visual
});

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
  const [solicitudesAll, setSolicitudesAll] = useState([]);
  const [solicitudesDisponibles, setSolicitudesDisponibles] = useState([]);
  const [codigosSolicitud, setCodigosSolicitud] = useState({});
  const [editandoId, setEditandoId] = useState(null);
  const [mensaje, setMensaje] = useState("");
  const [codigoValido, setCodigoValido] = useState(false);
  const [formValido, setFormValido] = useState(false);
  const [filtroTexto, setFiltroTexto] = useState("");
  const [claveEliminar, setClaveEliminar] = useState("");

  // --- Cargar registros y solicitudes ---
  const cargarRegistros = async () => {
    const snapshot = await getDocs(collection(db, "serviciosTecnicos"));
    setRegistros(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  };

  const cargarSolicitudes = async () => {
    const snapshot = await getDocs(collection(db, "solicitudes"));
    const usadosSnapshot = await getDocs(collection(db, "serviciosTecnicos"));
    const usados = usadosSnapshot.docs.map((d) => d.data().consecutivo).filter(Boolean);

    const disponibles = snapshot.docs
      .filter((doc) => {
        const cons = doc.data().consecutivo;
        return cons && !usados.includes(cons);
      })
      .map((doc) => ({ id: doc.id, ...doc.data() }));

    const codigos = {};
    disponibles.forEach((item) => {
      codigos[item.consecutivo] = item.codigo; // usar 'codigo' de la solicitud
    });

    setCodigosSolicitud(codigos);
    setSolicitudesDisponibles(disponibles);
  };

  useEffect(() => {
    cargarRegistros();
    cargarSolicitudes();
  }, []);

  // Suscripción en tiempo real a solicitudes y serviciosTecnicos
  useEffect(() => {
    const unsubReg = onSnapshot(collection(db, "serviciosTecnicos"), (snap) => {
      setRegistros(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const unsubSol = onSnapshot(collection(db, "solicitudes"), (snap) => {
      setSolicitudesAll(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubReg(); unsubSol(); };
  }, []);

  // Recalcular pendientes y mapa de códigos cuando cambian colecciones
  useEffect(() => {
    const usados = new Set(registros.map((r) => r.consecutivo).filter(Boolean));
    const disponibles = (solicitudesAll || []).filter((s) => s.consecutivo && !usados.has(s.consecutivo));
    setSolicitudesDisponibles(disponibles);
    const codigos = {};
    for (const item of disponibles) {
      if (item.consecutivo) codigos[item.consecutivo] = item.codigo;
    }
    setCodigosSolicitud(codigos);
  }, [solicitudesAll, registros]);

  // --- Prefill desde query ---
  useEffect(() => {
    if (router.query && router.query.consecutivo) {
      setFormData((prev) => ({
        ...prev,
        consecutivo: router.query.consecutivo || "",
        usuario: router.query.usuario || "",
        fecha: router.query.fecha || "",
        falla: router.query.descripcion || "",      }));}
  }, [router.query]);

  // --- Validación de formulario ---
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
    setFormValido(
      (formData.servicioFinalizado === "si" && codigoValido) ||
        (formData.servicioFinalizado === "no" && camposRequeridosLlenos())
    );
  }, [formData, codigoValido]);

  // --- Opciones de catálogos ---
  const opciones = useMemo(() => {
    const uniq = (arr) =>
      Array.from(new Set((arr || []).filter(Boolean).map((s) => String(s).trim())));

    const cargosReg = uniq(registros.map((r) => r.cargo));
    const cargos = uniq([...CARGO_PRESETS, ...cargosReg]).sort((a, b) =>
      a.localeCompare(b, "es", { sensitivity: "base" })
    );

    const pcsReg = uniq(registros.map((r) => r.equipo));
    const pcs = uniq([...NOMBRE_PC_PRESETS, ...pcsReg]).sort((a, b) =>
      a.localeCompare(b, "es", { sensitivity: "base" })
    );

    const usuariosReg = uniq(registros.map((r) => r.usuario));
    const usuariosSol = uniq(solicitudesDisponibles.map((s) => s.usuario || s.nombre)) || [];
    const usuarios = uniq([...USUARIOS_BASE, ...usuariosReg, ...usuariosSol]).sort(
      (a, b) => a.localeCompare(b, "es", { sensitivity: "base" })
    );

    return { cargos, pcs, usuarios };
  }, [registros, solicitudesDisponibles]);

  // --- Handlers ---
  const handleChange = async (key, value) => {
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
      visitaPreventiva: false,
      visitaCorrectiva: false,
      tecnico: "",
      observacion: "",
      tipoSoporte: "virtual",
      servicioFinalizado: "no",
    });
    setEditandoId(null);
    setCodigoValido(false);
  };

  const handleSave = async () => {
    if (formData.servicioFinalizado === "si" && !codigoValido) {
      setMensaje("⚠ El código ingresado no coincide con el generado en la solicitud.");
      setTimeout(() => setMensaje(""), 6000);
      return;
    }
    if (formData.servicioFinalizado === "no" && !camposRequeridosLlenos()) {
      setMensaje("⚠ Debes completar todos los campos requeridos antes de guardar.");
      setTimeout(() => setMensaje(""), 5000);
      return;
    }

    try {
      if (editandoId) {
        await updateDoc(doc(db, "serviciosTecnicos", editandoId), formData);
        setMensaje("✅ Registro actualizado");
      } else {
        await addDoc(collection(db, "serviciosTecnicos"), formData);
        setMensaje("✅ Registro guardado");
      }

      if (formData.servicioFinalizado === "si") {
        const snapshot = await getDocs(collection(db, "solicitudes"));
        const solicitudDoc = snapshot.docs.find(
          (docx) => docx.data().consecutivo === formData.consecutivo
        );
        if (solicitudDoc) {
          await updateDoc(doc(db, "solicitudes", solicitudDoc.id), { finalizado: "si" });
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
    setFormData({ ...registro });
    setEditandoId(registro.id);
    if (registro.servicioFinalizado === "si") {
      setCodigoValido(true);
      setMensaje("✅ Código validado automáticamente");
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
    const {
      consecutivo = "",
      usuario = "",
      fecha = "",
      cargo = "",
      equipo = "",
      descripcion = "",
      nombre = "",
    } = solicitud;

    setFormData((prev) => ({
      ...prev,
      consecutivo,
      usuario: usuario || nombre || "",      fecha,
      cargo,
      equipo,
      falla: descripcion || "",
    }));
  };

  // Listado filtrado rápido
  const registrosFiltrados = registros.filter((r) =>
    [r.usuario, r.equipo, r.tecnico, r.cargo, r.fecha]
      .join(" ")
      .toLowerCase()
      .includes(filtroTexto.toLowerCase())
  );

  return (
    <div style={{ padding: 20, fontFamily: "Arial, sans-serif" }}>
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

        {/* Filtro rápido del listado */}
        <div style={{ ...styles.card, width: "100%" }}>
          <div style={styles.cardHeader}>
            <h3 style={{ margin: 0, fontSize: 18, color: "#111827" }}>Filtro rápido del listado</h3>
          </div>
          <div style={{ marginTop: 8 }}>
            <input
              type="text"
              placeholder="Filtrar por usuario, técnico, equipo, etc."
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value.toLowerCase())}
              style={styles.input}
            />
          </div>
        </div>

        {/* Solicitudes pendientes */}
        <div style={{ ...styles.card, width: "100%" }}>
          <div style={styles.cardHeader}>
            <h3 style={{ margin: 0, fontSize: 18, color: "#111827" }}>Solicitudes pendientes sin atender</h3>
          </div>
          {solicitudesDisponibles.length === 0 ? (
            <div style={{ ...styles.alert, background: "#fff", color: "#6b7280", borderColor: "#e5e7eb", marginTop: 8 }}>
              No hay solicitudes pendientes.
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
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
            <h3 style={{ margin: 0, fontSize: 20, color: "#111827" }}>Registro de servicio técnico</h3>
          </div>

          <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
            {/* Selector solicitud */}
            <div>
              <label style={styles.label}>Consecutivo (desde solicitud)</label>
              <select
                value={formData.consecutivo}
                onChange={(e) => {
                  const selected = solicitudesDisponibles.find((s) => s.consecutivo === e.target.value);
                  if (selected) {
                    handleChange("consecutivo", selected.consecutivo);
                    handleChange("usuario", selected.usuario || selected.nombre || "");handleChange("fecha", new Date().toISOString().slice(0, 10));
                  } else {
                    handleChange("consecutivo", e.target.value);
                  }
                }}
                style={{ ...styles.input, background: "#fffacd" }}
              >
                <option value="">-- Seleccionar solicitud pendiente --</option>
                {solicitudesDisponibles.map((sol) => (
                  <option key={sol.id} value={sol.consecutivo}>
                    {sol.consecutivo} - {sol.usuario || sol.nombre}
                  </option>
                ))}
              </select>
            </div>

            {/* Campos principales */}
            <div style={styles.rowGrid3}>
              <Field label="Usuario" value={formData.usuario} onChange={(v) => handleChange("usuario", v)} listId="usuariosOptions" />
              <Field label="Fecha" type="date" value={formData.fecha} onChange={(v) => handleChange("fecha", v)} />
              <Field label="Código de solicitud (digitar manual)" value={formData.codigoservicio} onChange={(v) => handleChange("codigoservicio", v)} />
            </div>

            <div style={styles.rowGrid3}>
              <Field label="Cargo" value={formData.cargo} onChange={(v) => handleChange("cargo", v)} listId="cargoOptions" />
              <Field label="Equipo" value={formData.equipo} onChange={(v) => handleChange("equipo", v)} listId="pcOptions" />
              <Field label="Correo del usuario" type="email" value={formData.correoUsuario} onChange={(v) => handleChange("correoUsuario", v)} />
            </div>

            <div style={styles.rowGrid2}>
              <Field label="Falla" value={formData.falla} onChange={(v) => handleChange("falla", v)} />
              <Field label="Diagnóstico" value={formData.diagnostico} onChange={(v) => handleChange("diagnostico", v)} />
            </div>

            <Field label="Solución" value={formData.solucion} onChange={(v) => handleChange("solucion", v)} />

            {/* Partes reemplazadas */}
            <div>
              <label style={styles.label}>Partes reemplazadas</label>
              <div style={{ display: "grid", gap: 4 }}>
                {["Disco duro", "Board", "Memoria RAM", "Pantalla", "Equipo", "Teclado"].map((parte) => (
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
                ))}
              </div>
            </div>

            {/* Tipo de soporte */}
            <div>
              <label style={styles.label}>Tipo de soporte</label>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <label style={styles.radioLabel}>
                  <input type="radio" checked={formData.tipoSoporte === "virtual"} onChange={() => handleChange("tipoSoporte", "virtual")}/> Virtual
                </label>
                <label style={styles.radioLabel}>
                  <input type="radio" checked={formData.tipoSoporte === "presencial"} onChange={() => handleChange("tipoSoporte", "presencial")}/> Presencial
                </label>
              </div>
            </div>

            {/* Servicio Finalizado */}
            <div>
              <label style={styles.label}>Servicio finalizado</label>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <label style={styles.radioLabel}>
                  <input type="radio" checked={formData.servicioFinalizado === "no"} onChange={() => handleChange("servicioFinalizado", "no")} /> No
                </label>
                <label style={styles.radioLabel}>
                  <input type="radio" checked={formData.servicioFinalizado === "si"} onChange={() => handleChange("servicioFinalizado", "si")} /> Sí
                </label>
              </div>
            </div>

            {/* Aplazado */}
            <div>
              <label style={styles.label}>Servicio aplazado</label>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <label style={styles.radioLabel}>
                  <input type="radio" checked={formData.aplazado === "no"} onChange={() => handleChange("aplazado", "no")} /> No
                </label>
                <label style={styles.radioLabel}>
                  <input type="radio" checked={formData.aplazado === "si"} onChange={() => handleChange("aplazado", "si")} /> Sí
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
                onClick={() => setCodigoValido(formData.codigoservicio === codigosSolicitud[formData.consecutivo])}
                style={styles.secondaryBtn}
              >
                Validar código
              </button>

              <button
                type="button"
                onClick={async () => {
                  if (!formData.consecutivo || !formData.correoUsuario) {
                    setMensaje("⚠ Ingrese el consecutivo y el correo del usuario antes de reenviar el código.");
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
                      setMensaje("⚠ No se encontró solicitud con ese correo y consecutivo.");
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
            <Field label="Observación" value={formData.observacion} onChange={(v) => handleChange("observacion", v)} />

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

            {/* Botón Guardar */}
            <div style={{ display: "flex", justifyContent: "center" }}>
              <button
                type="button"
                onClick={handleSave}
                disabled={!formValido}
                style={{ ...styles.primaryBtn, opacity: formValido ? 1 : 0.5, cursor: formValido ? "pointer" : "not-allowed" }}
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
      <h2 style={{ marginTop: 24, textAlign: "center", color: "#111827" }}>Registros guardados</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, marginTop: 12 }}>
        {registrosFiltrados.map((r) => (
          <div key={r.id} style={styles.card}>
            <div style={styles.cardHeader}>
              <h3 style={{ margin: 0, fontSize: 18, color: "#111827" }}>{r.usuario || "Usuario"}</h3>
              <span style={{ ...styles.badge, background: "#e0f2fe", color: "#075985" }} title="Consecutivo">{r.consecutivo}</span>
            </div>

            <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
              <Row label="Fecha" value={r.fecha} />
              <Row label="Equipo" value={r.equipo} />
              <Row label="Cargo" value={r.cargo} />
              <Row label="Diagnóstico" value={r.diagnostico} />
              <Row label="Solución" value={r.solucion} />
              <Row label="Finalizado" value={r.servicioFinalizado} />
              <Row label="Técnico" value={r.tecnico} />
            </div>

            <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
              <input type="password" placeholder="Clave para eliminar" value={claveEliminar} onChange={(e) => setClaveEliminar(e.target.value)} style={styles.input} />
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <button onClick={() => handleEdit(r)} style={styles.warnBtn}>Editar</button>
                <button onClick={() => handleDelete(r.id)} style={styles.dangerBtn}>Eliminar</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Botón Regresar */}
      <button onClick={() => router.push("/")} style={styles.backBtn} title="Volver al inicio">⬅ Regresar</button>
    </div>
  );
}

/* ---------- Subcomponentes de UI ---------- */
function Field({ label, value, onChange, type = "text", listId }) {
  return (
    <div>
      <label style={styles.label}>{label}</label>
      <input type={type} list={listId} value={value} onChange={(e) => onChange(e.target.value)} style={styles.input} />
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 8 }}>
      <div style={{ color: "#6b7280", fontWeight: 700 }}>{label}:</div>
      <div style={{ color: "#111827" }}>{value || "—"}</div>
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
};
