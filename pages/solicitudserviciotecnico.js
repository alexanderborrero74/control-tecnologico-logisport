// pages/solicitudserviciotecnico.js — LOGISPORT
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { db } from "@/firebase/firebaseConfig";
import {
  collection, addDoc, getDocs, deleteDoc, doc,
  runTransaction, getDoc, serverTimestamp, query, where,
} from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getUserRoleByUid } from "@/utils/getUserRole";
import { useUsuarios } from "@/utils/useUsuarios";
import { BRAND } from "@/utils/branding";
import LayoutWithSidebar from "@/components/LayoutWithSidebar";
import PageHeader from "@/components/PageHeader";

function formatearConsecutivoLOGI(n) {
  const num = Math.max(1, Number(n) || 1);
  const s = String(num);
  return "LOGI" + s.padStart(Math.max(4, s.length), "0");
}

function parseNumero(str) {
  const s = String(str || "");
  const m = s.match(/LOGI\s*(\d+)/i) || s.match(/(\d+)/);
  return m ? Number(m[1]) : 0;
}

function generarCodigoAleatorio() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

async function pedirClave() {
  const v = prompt("Ingrese la clave de eliminación (formato 2025.2025):", "");
  return v;
}

async function obtenerNumeroConsecutivo() {
  const ref = doc(db, "contadores", `solicitudes_${BRAND?.codePrefix || "LOGI"}`);
  return await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) { tx.set(ref, { valor: 1 }); return 1; }
    const nuevo = Number(snap.data().valor || 0) + 1;
    tx.update(ref, { valor: nuevo });
    return nuevo;
  });
}

async function enviarCorreo(to, subject, text) {
  try {
    // Acepta string o array de correos
    const lista = Array.isArray(to) ? to : [String(to || "").trim()];
    const limpios = lista.map(s => String(s || "").trim()).filter(Boolean);
    if (limpios.length === 0) return;
    await fetch("/api/enviarCorreoElectronico", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: limpios, subject, text }),
    });
  } catch (e) { console.error("Error enviando correo:", e); }
}

function CampoReadonly({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: "grid", gap: 2 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>{label}</span>
      <span style={{ fontSize: 14, color: "#1f2937", fontWeight: 500 }}>{value}</span>
    </div>
  );
}

const SolicitudServicioTecnico = () => {
  const router = useRouter();
  const [rol, setRol] = useState("cargando");
  const [datosUsuarioLogueado, setDatosUsuarioLogueado] = useState(null);
  const { usuarios } = useUsuarios();

  const [formData, setFormData] = useState({
    nombre: "", cargo: "", correo: "", descripcion: "",
    fecha: new Date(), codigo: generarCodigoAleatorio(),
  });

  const [previewConsecutivo, setPreviewConsecutivo] = useState("LOGI0001");
  const [ultimoAsignado, setUltimoAsignado] = useState("");
  const [registros, setRegistros] = useState([]);
  const [mensaje, setMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);

  // ── Detectar rol y cargar datos del usuario logueado ─────────────────────
  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.replace("/login"); return; }
      try {
        const r = await getUserRoleByUid(u.uid);
        setRol(r || "usuario");

        const q = query(collection(db, "usuariosCatalogo"), where("email", "==", u.email));
        const snap = await getDocs(q);
        let datosCatalogo = { nombre: u.displayName || "", cargo: "", email: u.email || "" };
        if (!snap.empty) {
          const d = snap.docs[0].data();
          datosCatalogo = {
            nombre: d.nombre || u.displayName || u.email?.split("@")[0] || "",
            cargo: d.cargo || "",
            email: d.email || u.email || ""
          };
        } else {
          // No está en catálogo — usar email como nombre de respaldo
          datosCatalogo.nombre = u.displayName || u.email?.split("@")[0] || "";
        }
        setDatosUsuarioLogueado(datosCatalogo);

        // Pre-llenar para roles no-admin
        const rolesAdmin = ["admin", "tecnico", "auditor"];
        if (!rolesAdmin.includes(r || "usuario")) {
          setFormData(prev => ({
            ...prev,
            nombre: datosCatalogo.nombre,
            cargo: datosCatalogo.cargo,
            correo: datosCatalogo.email
          }));
        }
      } catch { setRol("usuario"); }
    });
    return () => unsub();
  }, [router]);

  // ── Cargar registros ──────────────────────────────────────────────────────
  useEffect(() => {
    if (rol === "cargando") return;
    const auth = getAuth();
    const uid = auth.currentUser?.uid;
    const rolesAdmin = ["admin", "tecnico", "auditor"];
    if (rolesAdmin.includes(rol)) cargarRegistrosAdmin();
    else if (uid) cargarRegistrosUsuario(uid);
  }, [rol]);

  const cargarRegistrosAdmin = async () => {
    try {
      const snap = await getDocs(collection(db, "solicitudes"));
      setRegistros(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); }
  };

  const cargarRegistrosUsuario = async (uid) => {
    try {
      const q = query(collection(db, "solicitudes"), where("uidCreador", "==", uid));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
      setRegistros(data);
    } catch (e) { console.error(e); }
  };

  // Próximo consecutivo
  useEffect(() => {
    (async () => {
      try {
        const ref = doc(db, "contadores", `solicitudes_${BRAND?.codePrefix || "LOGI"}`);
        const snap = await getDoc(ref);
        const base = snap.exists() ? Number(snap.data()?.valor || 0) + 1 : 1;
        setPreviewConsecutivo(formatearConsecutivoLOGI(base));
      } catch { setPreviewConsecutivo("LOGI0001"); }
    })();
  }, []);

  // Admin selecciona usuario → auto-llena cargo y correo
  const handleSeleccionarUsuario = (nombre) => {
    const encontrado = usuarios.find(u => u.nombre?.toLowerCase() === nombre?.toLowerCase());
    setFormData(prev => ({ ...prev, nombre, cargo: encontrado?.cargo || "", correo: encontrado?.email || "" }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Si no hay nombre, usar la parte del correo antes del @ como nombre de respaldo
    const nombreFinal = (formData.nombre || "").trim() ||
      (formData.correo ? formData.correo.split("@")[0] : "") ||
      (datosUsuarioLogueado?.email ? datosUsuarioLogueado.email.split("@")[0] : "");

    if (!nombreFinal) { setMensaje("Error: No se pudo identificar al solicitante."); return; }

    // Actualizar formData con el nombre final antes de guardar
    if (!formData.nombre.trim()) {
      setFormData(prev => ({ ...prev, nombre: nombreFinal }));
    }
    setEnviando(true); setMensaje(""); setUltimoAsignado("");

    let consecutivo = "LOGI0001"; let numeroAsignado = 1;
    try {
      numeroAsignado = await obtenerNumeroConsecutivo();
      consecutivo = formatearConsecutivoLOGI(numeroAsignado);
    } catch { const ts = Math.floor(Date.now() / 1000); consecutivo = "LOGI" + ts; numeroAsignado = parseNumero(consecutivo); }

    const auth = getAuth();
    const u = auth.currentUser;
    if (!u) { setEnviando(false); setMensaje("Error: no hay sesión activa."); return; }

    const nuevoRegistro = {
      uid: u.uid, email: u.email || "", uidCreador: u.uid,
      nombre: nombreFinal,
      cargo: formData.cargo || datosUsuarioLogueado?.cargo || "",
      correo: formData.correo || datosUsuarioLogueado?.email || u.email || "",
      descripcion: formData.descripcion, fecha: formData.fecha.toISOString(),
      consecutivo, codigo: formData.codigo, finalizado: false, createdAt: serverTimestamp(),
    };

    try {
      await addDoc(collection(db, "solicitudes"), nuevoRegistro);

      // Correos
      try {
        const asunto = `Solicitud de servicio técnico ${consecutivo}`;
        const cuerpoSoporte = [`Nueva solicitud de servicio técnico.`, ``, `- Consecutivo: ${consecutivo}`, `- Fecha: ${new Date(formData.fecha).toLocaleString()}`, `- Solicitante: ${nuevoRegistro.nombre}`, `- Cargo: ${nuevoRegistro.cargo || "—"}`, `- Correo: ${nuevoRegistro.correo}`, `- Descripción: ${nuevoRegistro.descripcion}`, ``, `SoporteIA.net`].join("\n");
        const cuerpoUsuario = [`Hola ${nuevoRegistro.nombre},`, ``, `Hemos recibido tu solicitud.`, ``, `- Consecutivo: ${consecutivo}`, `- Código: ${nuevoRegistro.codigo}`, `- Descripción: ${nuevoRegistro.descripcion}`, ``, `Pronto te contactaremos.`, ``, `LOGISPORT — Área de Sistemas`].join("\n");
        enviarCorreo(["soportesistemas@soporteia.net", "rivascamiloelian@gmail.com"], asunto, cuerpoSoporte);
        if (nuevoRegistro.correo && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nuevoRegistro.correo.trim())) {
          enviarCorreo(nuevoRegistro.correo, asunto, cuerpoUsuario);
        }
      } catch (e) { console.error(e); }

      setUltimoAsignado(consecutivo);
      if (numeroAsignado > 0) setPreviewConsecutivo(formatearConsecutivoLOGI(numeroAsignado + 1));
      setMensaje("¡Solicitud enviada con éxito!");

      const rolesAdmin = ["admin", "tecnico", "auditor"];
      if (rolesAdmin.includes(rol)) {
        setFormData({ nombre: "", cargo: "", correo: "", descripcion: "", fecha: new Date(), codigo: generarCodigoAleatorio() });
        cargarRegistrosAdmin();
      } else {
        setFormData(prev => ({ nombre: datosUsuarioLogueado?.nombre || prev.nombre, cargo: datosUsuarioLogueado?.cargo || prev.cargo, correo: datosUsuarioLogueado?.email || prev.correo, descripcion: "", fecha: new Date(), codigo: generarCodigoAleatorio() }));
        cargarRegistrosUsuario(u.uid);
      }

      const deseaOtra = window.confirm("Solicitud enviada.\n\n¿Deseas enviar otra solicitud?");
      if (!deseaOtra) router.push("/");
    } catch (error) {
      setMensaje("Error: " + error.message);
    } finally { setEnviando(false); }
  };

  const eliminarRegistro = async (id) => {
    const clave = await pedirClave();
    if (clave == null) return;
    if (String(clave).trim() !== "2025.2025") { alert("Clave incorrecta."); return; }
    try {
      await deleteDoc(doc(db, "solicitudes", id));
      setRegistros(prev => prev.filter(r => r.id !== id));
      alert("Eliminado correctamente.");
    } catch (error) { alert("Error: " + error.message); }
  };

  if (rol === "cargando") return null;
  const rolesAdmin = ["admin", "tecnico", "auditor"];
  const esAdmin = rolesAdmin.includes(rol);

  return (
    <LayoutWithSidebar>
      <PageHeader titulo="Solicitud de Servicio Técnico" />
      <div style={{ fontFamily: "Arial, sans-serif" }}>

        {/* Consecutivo */}
        <div style={{ backgroundColor: "#0B3D91", color: "white", padding: "10px", borderRadius: "10px", boxShadow: "0 4px 10px rgba(0,0,0,0.2)", marginBottom: 16 }}>
          <div style={{ background: "#fff", color: "#111827", borderRadius: 8, padding: "8px 12px", display: "inline-flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontWeight: 700 }}>Consecutivo:</span>
            {ultimoAsignado ? (
              <><span style={{ color: "#059669", fontWeight: 800 }}>Asignado {ultimoAsignado}</span><span style={{ color: "#6b7280" }}>• Próximo {previewConsecutivo}</span></>
            ) : (
              <span style={{ color: "#1f2937" }}>Próximo {previewConsecutivo}</span>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "16px" }}>

          {/* Datos del solicitante */}
          {esAdmin ? (
            <div style={{ display: "grid", gap: 10 }}>
              <label style={{ fontWeight: 700, color: "#374151" }}>Usuario solicitante</label>
              <select value={formData.nombre} onChange={e => handleSeleccionarUsuario(e.target.value)} required
                style={{ padding: "10px", borderRadius: "8px", border: "1px solid #ccc", fontSize: 14 }}>
                <option value="">— Seleccione un usuario —</option>
                {usuarios.filter(u => u.activo !== false).map(u => (
                  <option key={u.id} value={u.nombre}>{u.nombre}{u.cargo ? ` · ${u.cargo}` : ""}</option>
                ))}
              </select>
              {formData.nombre && (
                <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "12px 14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 20px" }}>
                  <CampoReadonly label="Nombre" value={formData.nombre} />
                  <CampoReadonly label="Cargo"  value={formData.cargo  || "Sin cargo"} />
                  <CampoReadonly label="Correo" value={formData.correo || "Sin correo"} />
                </div>
              )}
            </div>
          ) : (
            <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#0369a1", textTransform: "uppercase", marginBottom: 8 }}>👤 Solicitante</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 20px" }}>
                <CampoReadonly label="Nombre" value={formData.nombre || "—"} />
                <CampoReadonly label="Cargo"  value={formData.cargo  || "Sin cargo asignado"} />
                <CampoReadonly label="Correo" value={formData.correo || "—"} />
              </div>
              <input type="hidden" value={formData.nombre} />
              <input type="hidden" value={formData.cargo} />
              <input type="hidden" value={formData.correo} />
            </div>
          )}

          <DatePicker selected={formData.fecha} onChange={date => setFormData(prev => ({ ...prev, fecha: date }))} dateFormat="dd/MM/yyyy"
            customInput={<input style={{ padding: "10px", borderRadius: "8px", border: "1px solid #ccc", width: "100%" }} />} />

          <input type="text" value={formData.codigo} readOnly
            style={{ padding: "10px", borderRadius: "8px", border: "1px solid #ccc", backgroundColor: "#e9ecef", color: "#495057", fontWeight: "bold" }} />

          <input type="text" value={ultimoAsignado ? `Asignado: ${ultimoAsignado}` : `Próximo: ${previewConsecutivo}`} readOnly
            style={{ padding: "10px", borderRadius: "8px", border: "1px solid #ccc", color: "#374151", backgroundColor: "#f3f4f6", fontStyle: "italic" }} />

          <textarea name="descripcion" placeholder="Descripción del problema o servicio solicitado"
            value={formData.descripcion} onChange={e => setFormData(prev => ({ ...prev, descripcion: e.target.value }))}
            rows={4} required style={{ padding: "10px", borderRadius: "8px", border: "1px solid #ccc" }} />

          <button type="submit" disabled={enviando}
            style={{ backgroundColor: enviando ? "#aaa" : "#0B3D91", color: "white", padding: "12px 20px", border: "none", borderRadius: "8px", cursor: enviando ? "not-allowed" : "pointer", fontWeight: "bold" }}>
            {enviando ? "Enviando..." : "Enviar solicitud"}
          </button>
        </form>

        {mensaje && <p style={{ marginTop: "10px", color: mensaje.startsWith("Error") ? "red" : "green", fontWeight: 600 }}>{mensaje}</p>}

        {/* ── Lista Admin ── */}
        {esAdmin && (
          <div style={{ marginTop: 28 }}>
            <h2 style={{ margin: "0 0 10px", fontSize: 18, fontWeight: 700, color: "#111827" }}>
              Solicitudes registradas <span style={{ fontSize: 13, fontWeight: 500, color: "#6b7280" }}>({registros.length})</span>
            </h2>
            {registros.length === 0 ? (
              <p style={{ color: "#6b7280", padding: 24, background: "white", borderRadius: 10, border: "1px solid #e5e7eb", textAlign: "center" }}>No hay solicitudes aún.</p>
            ) : (
              <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "auto", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f9fafb" }}>
                      {["#", "Fecha", "Solicitante", "Cargo", "Descripción", "Código", "Estado", "Eliminar"].map(h => (
                        <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6b7280", borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...registros].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).map((reg, i) => (
                      <tr key={reg.id}
                        style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? "white" : "#fafafa" }}
                        onMouseEnter={e => e.currentTarget.style.background = "#f0f9ff"}
                        onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "white" : "#fafafa"}
                      >
                        <td style={{ padding: "8px 12px" }}>
                          <span style={{ background: "#dbeafe", color: "#1e40af", padding: "2px 7px", borderRadius: 5, fontWeight: 700, fontSize: 11 }}>{reg.consecutivo}</span>
                        </td>
                        <td style={{ padding: "8px 12px", whiteSpace: "nowrap", color: "#374151" }}>
                          {reg.fecha ? new Date(reg.fecha).toLocaleDateString("es-CO") : "—"}
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          <div style={{ fontWeight: 600, color: "#111827" }}>{reg.nombre || "—"}</div>
                          {reg.correo && <div style={{ fontSize: 11, color: "#9ca3af" }}>{reg.correo}</div>}
                        </td>
                        <td style={{ padding: "8px 12px", color: "#374151", whiteSpace: "nowrap" }}>{reg.cargo || "—"}</td>
                        <td style={{ padding: "8px 12px", maxWidth: 200 }}>
                          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200, color: "#374151" }} title={reg.descripcion}>
                            {reg.descripcion || "—"}
                          </div>
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          <span style={{ background: "#f3f4f6", color: "#374151", padding: "2px 7px", borderRadius: 5, fontWeight: 700, fontSize: 11, fontFamily: "monospace" }}>{reg.codigo}</span>
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          <span style={{ padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 700, background: reg.finalizado ? "#d1fae5" : "#fee2e2", color: reg.finalizado ? "#065f46" : "#991b1b" }}>
                            {reg.finalizado ? "✅ Atendida" : "🔴 Pendiente"}
                          </span>
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          <button onClick={() => eliminarRegistro(reg.id)}
                            style={{ background: "#dc2626", color: "white", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontWeight: 600, fontSize: 12 }}>
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Lista Usuario ── */}
        {!esAdmin && (
          <div style={{ marginTop: 28 }}>
            <h2 style={{ margin: "0 0 10px", fontSize: 18, fontWeight: 700, color: "#111827" }}>
              Mis solicitudes <span style={{ fontSize: 13, fontWeight: 500, color: "#6b7280" }}>({registros.length})</span>
            </h2>
            {registros.length === 0 ? (
              <p style={{ color: "#6b7280", padding: 24, background: "#f0f9ff", borderRadius: 10, border: "1px solid #bae6fd", textAlign: "center" }}>Aún no tienes solicitudes registradas.</p>
            ) : (
              <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "auto", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f0f9ff" }}>
                      {["#", "Fecha", "Descripción", "Código", "Estado"].map(h => (
                        <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#075985", borderBottom: "1px solid #bae6fd", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {registros.map((reg, i) => (
                      <tr key={reg.id}
                        style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? "white" : "#f9feff" }}
                        onMouseEnter={e => e.currentTarget.style.background = "#e0f2fe"}
                        onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "white" : "#f9feff"}
                      >
                        <td style={{ padding: "8px 12px" }}>
                          <span style={{ background: "#dbeafe", color: "#1e40af", padding: "2px 7px", borderRadius: 5, fontWeight: 700, fontSize: 11 }}>{reg.consecutivo}</span>
                        </td>
                        <td style={{ padding: "8px 12px", whiteSpace: "nowrap", color: "#374151" }}>
                          {reg.fecha ? new Date(reg.fecha).toLocaleDateString("es-CO") : "—"}
                        </td>
                        <td style={{ padding: "8px 12px", maxWidth: 300 }}>
                          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 300, color: "#374151" }} title={reg.descripcion}>
                            {reg.descripcion || "—"}
                          </div>
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          <span style={{ background: "#f3f4f6", color: "#374151", padding: "2px 7px", borderRadius: 5, fontWeight: 700, fontSize: 11, fontFamily: "monospace" }}>{reg.codigo}</span>
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          <span style={{ padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 700, background: reg.finalizado ? "#d1fae5" : "#fef3c7", color: reg.finalizado ? "#065f46" : "#78350f" }}>
                            {reg.finalizado ? "✅ Atendida" : "⏳ En proceso"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </LayoutWithSidebar>
  );
};

export default SolicitudServicioTecnico;
