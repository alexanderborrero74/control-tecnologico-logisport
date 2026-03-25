// pages/capsulas-admin.js - Administración de Cápsulas de Seguridad LOGISPORT
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { 
  collection, 
  addDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";
import { getUserRoleByUid } from "@/utils/getUserRole";
import { getAuth } from "firebase/auth";
import LayoutWithSidebar from "@/components/LayoutWithSidebar";
import PageHeader from "@/components/PageHeader";
import { 
  Plus, Edit2, Trash2, Eye, EyeOff, Save, X, AlertCircle 
} from "lucide-react";

const FORM_DEFAULT = {
  id: null,
  titulo: "",
  contenido: "",
  activa: true,
  prioridad: 1,
  tipo: "informacion",
  fechaInicio: "",
  fechaFin: "",
  duracionDias: 30,
  intervaloSegundos: 5,
  intervaloRecurrencia: 30,
  duracionPantalla: 10,
  fechaCreacion: null,
};

export default function CapsulasSeguridadAdmin() {
  const router = useRouter();
  const [capsulas, setCapsulas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState({ texto: "", tipo: "" });
  const [modalAbierto, setModalAbierto] = useState(false);
  const [rol, setRol] = useState("");
  const [formData, setFormData] = useState(FORM_DEFAULT);

  // Verificar permisos
  useEffect(() => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) { router.push("/login"); return; }
    const verificar = async () => {
      const userRole = await getUserRoleByUid(user.uid);
      setRol(userRole);
      if (userRole !== "admin" && userRole !== "owner") {
        setMensaje({ texto: "No tienes permisos para acceder a esta sección", tipo: "error" });
        setTimeout(() => router.push("/"), 3000);
      }
    };
    verificar();
  }, [router]);

  const cargarCapsulas = async () => {
    try {
      setLoading(true);
      const snapshot = await getDocs(collection(db, "capsulas"));
      let data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (a.prioridad || 999) - (b.prioridad || 999));
      setCapsulas(data);
    } catch (error) {
      console.error("❌ Error cargando cápsulas:", error);
      setMensaje({ texto: "Error al cargar las cápsulas: " + error.message, tipo: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (rol === "admin" || rol === "owner") cargarCapsulas();
  }, [rol]);

  const flash = (texto, tipo = "success") => {
    setMensaje({ texto, tipo });
    setTimeout(() => setMensaje({ texto: "", tipo: "" }), 3000);
  };

  const abrirModal = (capsula = null) => {
    if (capsula) {
      setFormData({
        id: capsula.id,
        titulo: capsula.titulo || "",
        contenido: capsula.contenido || "",
        activa: capsula.activa !== false,
        prioridad: capsula.prioridad || 1,
        tipo: capsula.tipo || "informacion",
        fechaInicio: capsula.fechaInicio || "",
        fechaFin: capsula.fechaFin || "",
        duracionDias: capsula.duracionDias || 30,
        intervaloSegundos: capsula.intervaloSegundos || 5,
        intervaloRecurrencia: capsula.intervaloRecurrencia || 30,
        duracionPantalla: capsula.duracionPantalla || 10,
        fechaCreacion: capsula.fechaCreacion,
      });
    } else {
      setFormData(FORM_DEFAULT);
    }
    setModalAbierto(true);
  };

  const cerrarModal = () => { setModalAbierto(false); setFormData(FORM_DEFAULT); };

  const handleGuardar = async () => {
    if (!formData.titulo.trim()) { flash("El título es obligatorio", "error"); return; }
    if (!formData.contenido.trim()) { flash("El contenido es obligatorio", "error"); return; }
    try {
      const dataToSave = {
        titulo: formData.titulo.trim(),
        contenido: formData.contenido.trim(),
        activa: formData.activa,
        prioridad: parseInt(formData.prioridad) || 1,
        tipo: formData.tipo,
        fechaInicio: formData.fechaInicio || null,
        fechaFin: formData.fechaFin || null,
        duracionDias: parseInt(formData.duracionDias) || 30,
        intervaloSegundos: Math.max(3, parseInt(formData.intervaloSegundos) || 5),
        intervaloRecurrencia: Math.max(1, parseInt(formData.intervaloRecurrencia) || 30),
        duracionPantalla: Math.max(3, parseInt(formData.duracionPantalla) || 10),
        fechaActualizacion: serverTimestamp(),
      };
      if (formData.id) {
        await updateDoc(doc(db, "capsulas", formData.id), dataToSave);
        flash("Cápsula actualizada exitosamente");
      } else {
        dataToSave.fechaCreacion = serverTimestamp();
        await addDoc(collection(db, "capsulas"), dataToSave);
        flash("Cápsula creada exitosamente");
      }
      cerrarModal();
      await cargarCapsulas();
    } catch (error) {
      console.error("Error guardando cápsula:", error);
      flash("Error al guardar la cápsula", "error");
    }
  };

  const handleEliminar = async (id) => {
    if (!window.confirm("¿Eliminar esta cápsula? Esta acción no se puede deshacer.")) return;
    try {
      await deleteDoc(doc(db, "capsulas", id));
      flash("Cápsula eliminada exitosamente");
      await cargarCapsulas();
    } catch (error) {
      flash("Error al eliminar la cápsula", "error");
    }
  };

  const toggleActiva = async (capsula) => {
    try {
      await updateDoc(doc(db, "capsulas", capsula.id), {
        activa: !capsula.activa,
        fechaActualizacion: serverTimestamp(),
      });
      flash(`Cápsula ${!capsula.activa ? "activada" : "desactivada"} exitosamente`);
      await cargarCapsulas();
    } catch (error) {
      flash("Error al cambiar el estado", "error");
    }
  };

  const getTipoColor = (tipo) => {
    switch (tipo) {
      case "critica": return { bg: "#fee2e2", border: "#dc2626", text: "#7f1d1d" };
      case "alerta":  return { bg: "#fef3c7", border: "#f59e0b", text: "#78350f" };
      default:        return { bg: "#dbeafe", border: "#3b82f6", text: "#1e3a8a" };
    }
  };

  if (loading) return (
    <LayoutWithSidebar>
      <PageHeader titulo="Cápsulas de Seguridad" />
      <div style={S.loadingContainer}>
        <div style={S.spinner} />
        <p style={S.loadingText}>Cargando cápsulas...</p>
      </div>
    </LayoutWithSidebar>
  );

  if (rol !== "admin" && rol !== "owner") return (
    <LayoutWithSidebar>
      <PageHeader titulo="Cápsulas de Seguridad" />
      <div style={S.errorContainer}>
        <AlertCircle size={48} color="#dc2626" />
        <p style={S.errorText}>No tienes permisos para acceder a esta sección</p>
      </div>
    </LayoutWithSidebar>
  );

  return (
    <LayoutWithSidebar>
      <PageHeader titulo="Administración de Cápsulas de Seguridad" />
      <div style={S.container}>

        {mensaje.texto && (
          <div style={{
            ...S.alert,
            background: mensaje.tipo === "success" ? "#d1fae5" : "#fee2e2",
            color: mensaje.tipo === "success" ? "#065f46" : "#991b1b",
            borderColor: mensaje.tipo === "success" ? "#10b981" : "#dc2626",
          }}>{mensaje.texto}</div>
        )}

        <div style={S.header}>
          <div>
            <h2 style={S.title}>Cápsulas de Seguridad</h2>
            <p style={S.subtitle}>Gestiona los mensajes informativos que verán los usuarios al iniciar sesión</p>
          </div>
          <button onClick={() => abrirModal()} style={S.btnPrimary}>
            <Plus size={20} /><span>Nueva Cápsula</span>
          </button>
        </div>

        <div style={S.infoBox}>
          <AlertCircle size={20} color="#0B3D91" />
          <div>
            <strong>¿Cómo funcionan las cápsulas?</strong>
            <p style={{ margin: "0.25rem 0 0 0", color: "#6b7280" }}>
              Aparecen automáticamente a los usuarios después del delay configurado, se repiten según la recurrencia
              y permanecen en pantalla el tiempo indicado. Solo se muestran las cápsulas <strong>activas</strong> y dentro de su vigencia.
            </p>
          </div>
        </div>

        {capsulas.length === 0 ? (
          <div style={S.emptyState}>
            <AlertCircle size={48} color="#9ca3af" />
            <h3 style={{ color: "#6b7280", margin: "1rem 0 0.5rem 0" }}>No hay cápsulas creadas</h3>
            <p style={{ color: "#9ca3af", margin: 0 }}>Crea tu primera cápsula para comenzar</p>
          </div>
        ) : (
          <div style={S.grid}>
            {capsulas.map((capsula) => {
              const colores = getTipoColor(capsula.tipo);
              return (
                <div key={capsula.id} style={{
                  ...S.card,
                  borderLeft: `4px solid ${colores.border}`,
                  opacity: capsula.activa ? 1 : 0.6,
                }}>
                  <div style={S.cardHeader}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                        <h3 style={S.cardTitle}>{capsula.titulo || "[Sin título]"}</h3>
                        <span style={{ ...S.badge, background: colores.bg, color: colores.text, border: `1px solid ${colores.border}` }}>
                          {capsula.tipo || "informacion"}
                        </span>
                      </div>
                      <span style={S.priority}>Prioridad: {capsula.prioridad || 1}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      {capsula.activa ? <Eye size={20} color="#10b981" /> : <EyeOff size={20} color="#ef4444" />}
                      <span style={{
                        ...S.statusBadge,
                        background: capsula.activa ? "#d1fae5" : "#fee2e2",
                        color: capsula.activa ? "#065f46" : "#991b1b",
                      }}>
                        {capsula.activa ? "Activa" : "Inactiva"}
                      </span>
                    </div>
                  </div>

                  <div style={S.cardContent}>
                    <p style={S.contentText}>{capsula.contenido || "[Sin contenido]"}</p>
                    <div style={{ marginTop: "1rem", padding: "0.75rem", background: "#f9fafb", borderRadius: "6px", fontSize: "0.8rem", color: "#6b7280" }}>
                      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                        <span>🕒 Delay: <strong>{capsula.intervaloSegundos || 5}s</strong></span>
                        <span>🔁 Cada: <strong>{capsula.intervaloRecurrencia || 30} min</strong></span>
                        <span>⏱️ Visible: <strong>{capsula.duracionPantalla || 10}s</strong></span>
                      </div>
                      {(capsula.fechaInicio || capsula.fechaFin) && (
                        <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem" }}>
                          {capsula.fechaInicio && <span>📅 Desde: <strong>{capsula.fechaInicio}</strong></span>}
                          {capsula.fechaFin && <span>📅 Hasta: <strong>{capsula.fechaFin}</strong></span>}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={S.cardActions}>
                    <button onClick={() => toggleActiva(capsula)}
                      style={{ ...S.btnSecondary, background: capsula.activa ? "#fef3c7" : "#d1fae5", color: capsula.activa ? "#78350f" : "#065f46" }}>
                      {capsula.activa ? <EyeOff size={16} /> : <Eye size={16} />}
                      <span>{capsula.activa ? "Desactivar" : "Activar"}</span>
                    </button>
                    <button onClick={() => abrirModal(capsula)} style={S.btnSecondary}>
                      <Edit2 size={16} /><span>Editar</span>
                    </button>
                    <button onClick={() => handleEliminar(capsula.id)} style={{ ...S.btnSecondary, color: "#dc2626" }}>
                      <Trash2 size={16} /><span>Eliminar</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── MODAL ── */}
        {modalAbierto && (
          <div style={S.modalOverlay} onClick={cerrarModal}>
            <div style={S.modal} onClick={(e) => e.stopPropagation()}>
              <div style={S.modalHeader}>
                <h3 style={S.modalTitle}>{formData.id ? "Editar Cápsula" : "Nueva Cápsula"}</h3>
                <button onClick={cerrarModal} style={S.closeBtn}><X size={24} /></button>
              </div>

              <div style={S.modalBody}>
                {/* Título */}
                <div style={S.formGroup}>
                  <label style={S.label}>Título <span style={{ color: "#dc2626" }}>*</span></label>
                  <input type="text" value={formData.titulo} maxLength={100} style={S.input}
                    placeholder="Ej: Actualización del sistema"
                    onChange={(e) => setFormData({ ...formData, titulo: e.target.value })} />
                  <small style={S.helpText}>{formData.titulo.length}/100 caracteres</small>
                </div>

                {/* Tipo y Prioridad */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div style={S.formGroup}>
                    <label style={S.label}>Tipo</label>
                    <select value={formData.tipo} style={S.input}
                      onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}>
                      <option value="informacion">Información</option>
                      <option value="alerta">Alerta</option>
                      <option value="critica">Crítica</option>
                    </select>
                  </div>
                  <div style={S.formGroup}>
                    <label style={S.label}>Prioridad</label>
                    <input type="number" min="1" max="100" value={formData.prioridad} style={S.input}
                      onChange={(e) => setFormData({ ...formData, prioridad: e.target.value })} />
                    <small style={S.helpText}>1 = Mayor prioridad</small>
                  </div>
                </div>

                {/* Contenido */}
                <div style={S.formGroup}>
                  <label style={S.label}>Contenido <span style={{ color: "#dc2626" }}>*</span></label>
                  <textarea value={formData.contenido} maxLength={500}
                    style={{ ...S.input, minHeight: "120px", resize: "vertical" }}
                    placeholder="Escribe el mensaje que verán los usuarios..."
                    onChange={(e) => setFormData({ ...formData, contenido: e.target.value })} />
                  <small style={S.helpText}>{formData.contenido.length}/500 caracteres</small>
                </div>

                {/* Temporizadores */}
                <div style={{ marginBottom: "1.5rem", padding: "1rem", background: "#f0f9ff", borderRadius: "8px", border: "2px solid #0B3D91" }}>
                  <label style={{ ...S.label, marginBottom: "0.75rem", fontSize: "1rem" }}>⏱️ Configuración de Temporizadores</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
                    <div>
                      <label style={{ ...S.label, fontSize: "0.875rem" }}>Delay inicial (seg)</label>
                      <input type="number" min="3" max="60" value={formData.intervaloSegundos} style={S.input}
                        onChange={(e) => setFormData({ ...formData, intervaloSegundos: e.target.value })} />
                      <small style={S.helpText}>Espera antes de la 1ª aparición</small>
                    </div>
                    <div>
                      <label style={{ ...S.label, fontSize: "0.875rem" }}>Recurrencia (min)</label>
                      <input type="number" min="1" max="1440" value={formData.intervaloRecurrencia} style={S.input}
                        onChange={(e) => setFormData({ ...formData, intervaloRecurrencia: e.target.value })} />
                      <small style={S.helpText}>Cada cuántos minutos reaparece</small>
                    </div>
                    <div>
                      <label style={{ ...S.label, fontSize: "0.875rem" }}>Visible (seg)</label>
                      <input type="number" min="3" max="60" value={formData.duracionPantalla} style={S.input}
                        onChange={(e) => setFormData({ ...formData, duracionPantalla: e.target.value })} />
                      <small style={S.helpText}>Tiempo en pantalla</small>
                    </div>
                  </div>
                  <div style={{ marginTop: "0.75rem", padding: "0.75rem", background: "white", borderRadius: "6px", fontSize: "0.875rem" }}>
                    <strong>👁️ Comportamiento:</strong> Aparece {formData.intervaloSegundos}s después de cargar,
                    luego cada <strong>{formData.intervaloRecurrencia} min</strong> y
                    permanece visible <strong>{formData.duracionPantalla}s</strong>.
                  </div>
                </div>

                {/* Vigencia */}
                <div style={{ marginBottom: "1.5rem", padding: "1rem", background: "#f9fafb", borderRadius: "8px" }}>
                  <label style={{ ...S.label, marginBottom: "0.75rem" }}>Vigencia (Opcional)</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <div>
                      <label style={{ ...S.label, fontSize: "0.875rem" }}>Fecha Inicio</label>
                      <input type="date" value={formData.fechaInicio} style={S.input}
                        onChange={(e) => setFormData({ ...formData, fechaInicio: e.target.value })} />
                    </div>
                    <div>
                      <label style={{ ...S.label, fontSize: "0.875rem" }}>Fecha Fin</label>
                      <input type="date" value={formData.fechaFin} style={S.input}
                        onChange={(e) => setFormData({ ...formData, fechaFin: e.target.value })} />
                    </div>
                  </div>
                  <small style={S.helpText}>Dejar en blanco para que no expire.</small>
                </div>

                {/* Estado */}
                <div style={S.formGroup}>
                  <label style={S.checkboxLabel}>
                    <input type="checkbox" checked={formData.activa} style={{ marginRight: "0.5rem" }}
                      onChange={(e) => setFormData({ ...formData, activa: e.target.checked })} />
                    <span>Activar cápsula inmediatamente</span>
                  </label>
                  <small style={S.helpText}>Solo las cápsulas activas son visibles para los usuarios.</small>
                </div>
              </div>

              <div style={S.modalFooter}>
                <button onClick={cerrarModal} style={S.btnCancel}>Cancelar</button>
                <button onClick={handleGuardar} style={S.btnSave}>
                  <Save size={20} /><span>{formData.id ? "Actualizar" : "Crear"}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </LayoutWithSidebar>
  );
}

const S = {
  container: { padding: "0" },
  loadingContainer: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh" },
  spinner: { width: "60px", height: "60px", border: "4px solid #e5e7eb", borderTop: "4px solid #0B3D91", borderRadius: "50%", animation: "spin 1s linear infinite" },
  loadingText: { marginTop: "1rem", color: "#6b7280", fontWeight: "600" },
  errorContainer: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: "1rem" },
  errorText: { color: "#dc2626", fontSize: "1.125rem", fontWeight: "600" },
  alert: { padding: "1rem", borderRadius: "12px", marginBottom: "1.5rem", fontWeight: "600", border: "2px solid", textAlign: "center" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem", gap: "1rem", flexWrap: "wrap" },
  title: { fontSize: "1.875rem", fontWeight: "800", color: "#0B3D91", margin: 0 },
  subtitle: { color: "#6b7280", margin: "0.5rem 0 0 0", fontSize: "0.95rem" },
  infoBox: { background: "#f0f9ff", border: "2px solid #0B3D91", borderRadius: "12px", padding: "1rem", marginBottom: "1.5rem", display: "flex", gap: "0.75rem", alignItems: "flex-start" },
  btnPrimary: { display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.75rem 1.5rem", background: "#0B3D91", color: "#fff", border: "none", borderRadius: "10px", fontWeight: "700", cursor: "pointer", boxShadow: "0 4px 12px rgba(11,61,145,0.3)" },
  emptyState: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "4rem 2rem", background: "#fff", borderRadius: "12px", border: "2px dashed #d1d5db" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: "1.5rem" },
  card: { background: "#fff", borderRadius: "12px", padding: "1.25rem", boxShadow: "0 2px 8px rgba(0,0,0,0.08)", border: "1px solid #e5e7eb" },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem", paddingBottom: "1rem", borderBottom: "1px solid #f3f4f6" },
  cardTitle: { margin: 0, fontSize: "1.125rem", fontWeight: "700", color: "#111827" },
  badge: { padding: "0.25rem 0.75rem", borderRadius: "999px", fontSize: "0.75rem", fontWeight: "700", textTransform: "uppercase" },
  priority: { fontSize: "0.875rem", color: "#6b7280", fontWeight: "600" },
  statusBadge: { padding: "0.25rem 0.75rem", borderRadius: "999px", fontSize: "0.75rem", fontWeight: "700" },
  cardContent: { marginBottom: "1rem" },
  contentText: { color: "#374151", lineHeight: "1.6", margin: 0 },
  cardActions: { display: "flex", gap: "0.5rem", flexWrap: "wrap" },
  btnSecondary: { display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 1rem", background: "#f3f4f6", color: "#374151", border: "none", borderRadius: "8px", fontWeight: "600", fontSize: "0.875rem", cursor: "pointer" },
  modalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "1rem" },
  modal: { background: "#fff", borderRadius: "16px", maxWidth: "600px", width: "100%", maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.5rem", borderBottom: "1px solid #e5e7eb" },
  modalTitle: { margin: 0, fontSize: "1.5rem", fontWeight: "800", color: "#0B3D91" },
  closeBtn: { background: "transparent", border: "none", cursor: "pointer", color: "#6b7280", padding: "0.25rem", borderRadius: "6px" },
  modalBody: { padding: "1.5rem", overflowY: "auto", flex: 1 },
  formGroup: { marginBottom: "1.25rem" },
  label: { display: "block", marginBottom: "0.5rem", fontWeight: "700", color: "#374151", fontSize: "0.95rem" },
  input: { width: "100%", padding: "0.75rem", borderRadius: "8px", border: "2px solid #e5e7eb", fontSize: "1rem", outline: "none" },
  helpText: { display: "block", marginTop: "0.25rem", color: "#9ca3af", fontSize: "0.875rem" },
  checkboxLabel: { display: "flex", alignItems: "center", cursor: "pointer", fontWeight: "600", color: "#374151" },
  modalFooter: { display: "flex", justifyContent: "flex-end", gap: "0.75rem", padding: "1.5rem", borderTop: "1px solid #e5e7eb" },
  btnCancel: { padding: "0.75rem 1.5rem", background: "#f3f4f6", color: "#374151", border: "none", borderRadius: "8px", fontWeight: "700", cursor: "pointer" },
  btnSave: { display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.75rem 1.5rem", background: "#0B3D91", color: "#fff", border: "none", borderRadius: "8px", fontWeight: "700", cursor: "pointer", boxShadow: "0 4px 12px rgba(11,61,145,0.3)" },
};

if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.textContent = `@keyframes spin { to { transform: rotate(360deg); } } input:focus, textarea:focus, select:focus { border-color: #0B3D91 !important; box-shadow: 0 0 0 3px rgba(11,61,145,0.1); }`;
  document.head.appendChild(style);
}
