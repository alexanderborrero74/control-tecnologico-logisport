// pages/licencias.js — LOGISPORT
// Licencias almacenadas en Cloudinary + Firestore (permite subir PDF, imágenes, Word)
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import { db } from "@/firebase/firebaseConfig";
import {
  collection, addDoc, getDocs, deleteDoc, doc,
  serverTimestamp, orderBy, query,
} from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import LayoutWithSidebar from "@/components/LayoutWithSidebar";
import PageHeader from "@/components/PageHeader";

const CLOUD_NAME    = "dsomqay6y";
const UPLOAD_PRESET = "cadegran_fotos";

// Tipos aceptados
const TIPOS_ACEPTADOS = ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp,.bmp";

async function subirACloudinary(archivo, onProgress) {
  const fd = new FormData();
  fd.append("file", archivo);
  fd.append("upload_preset", UPLOAD_PRESET);

  const esImagen = archivo.type.startsWith("image/");
  const esPDF    = archivo.type === "application/pdf";
  const resourceType = esImagen ? "image" : "raw";

  if (onProgress) onProgress(10);

  const res = await fetch(
    "https://api.cloudinary.com/v1_1/" + CLOUD_NAME + "/" + resourceType + "/upload",
    { method: "POST", body: fd }
  );

  if (onProgress) onProgress(80);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || "Error al subir a Cloudinary");
  }
  const data = await res.json();
  if (onProgress) onProgress(100);
  return { url: data.secure_url, publicId: data.public_id };
}

function iconoArchivo(ext) {
  if (ext === "pdf") return "📄";
  if (["doc","docx"].includes(ext)) return "📝";
  if (["xls","xlsx"].includes(ext)) return "📊";
  if (["jpg","jpeg","png","gif","webp","bmp"].includes(ext)) return "🖼️";
  return "📎";
}

export default function Licencias() {
  const router  = useRouter();
  const inputRef = useRef(null);

  const [usuario, setUsuario]         = useState(null);
  const [licencias, setLicencias]     = useState([]);
  const [cargando, setCargando]       = useState(true);
  const [subiendo, setSubiendo]       = useState(false);
  const [progreso, setProgreso]       = useState(0);
  const [mensaje, setMensaje]         = useState("");
  const [error, setError]             = useState("");
  const [archivoActivo, setArchivoActivo] = useState(null);
  const [archivoPendiente, setArchivoPendiente] = useState(null);
  const [nombrePersonalizado, setNombrePersonalizado] = useState("");
  const [categoria, setCategoria]     = useState("");

  // Auth
  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, u => setUsuario(u || null));
    return () => unsub();
  }, []);

  // Cargar licencias desde Firestore
  const cargarLicencias = async () => {
    setCargando(true);
    try {
      const q = query(collection(db, "licencias"), orderBy("creadoEn", "desc"));
      const snap = await getDocs(q);
      setLicencias(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      setError("No se pudieron cargar las licencias.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargarLicencias(); }, []);

  // Seleccionar archivo
  const handleSeleccionar = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setArchivoPendiente(file);
    setNombrePersonalizado(file.name.replace(/\.[^.]+$/, ""));
    setError("");
  };

  // Subir archivo
  const handleSubir = async () => {
    if (!archivoPendiente || subiendo) return;
    if (!usuario) { setError("Debes iniciar sesion."); return; }

    setSubiendo(true);
    setProgreso(0);
    setError("");
    setMensaje("");

    try {
      const resultado = await subirACloudinary(archivoPendiente, setProgreso);
      const ext = archivoPendiente.name.split(".").pop().toLowerCase();

      await addDoc(collection(db, "licencias"), {
        nombre:      nombrePersonalizado.trim() || archivoPendiente.name,
        nombreOriginal: archivoPendiente.name,
        extension:   ext,
        url:         resultado.url,
        publicId:    resultado.publicId,
        categoria:   categoria.trim() || "General",
        tamano:      archivoPendiente.size,
        creadoEn:    serverTimestamp(),
        uid:         usuario.uid,
        email:       usuario.email,
      });

      setMensaje("Archivo subido correctamente.");
      setArchivoPendiente(null);
      setNombrePersonalizado("");
      setCategoria("");
      if (inputRef.current) inputRef.current.value = "";
      await cargarLicencias();
    } catch (e) {
      setError("Error al subir: " + e.message);
    } finally {
      setSubiendo(false);
      setProgreso(0);
      setTimeout(() => setMensaje(""), 4000);
    }
  };

  // Eliminar licencia
  const handleEliminar = async (lic) => {
    if (!confirm("Eliminar " + lic.nombre + "?")) return;
    try {
      await deleteDoc(doc(db, "licencias", lic.id));
      setMensaje("Eliminado.");
      setTimeout(() => setMensaje(""), 2000);
      await cargarLicencias();
    } catch (e) {
      setError("No se pudo eliminar.");
    }
  };

  // Renderizar preview en modal
  const renderPreview = (lic) => {
    const ext = lic.extension || "";
    if (["jpg","jpeg","png","gif","webp","bmp"].includes(ext)) {
      return <img src={lic.url} alt={lic.nombre} style={{ width: "100%", height: "100%", objectFit: "contain" }} />;
    }
    if (ext === "pdf") {
      return <iframe src={lic.url} title={lic.nombre} style={{ width: "100%", height: "100%", border: "none" }} />;
    }
    if (["doc","docx"].includes(ext)) {
      return <iframe src={"https://docs.google.com/gview?url=" + encodeURIComponent(lic.url) + "&embedded=true"} title={lic.nombre} style={{ width: "100%", height: "100%", border: "none" }} />;
    }
    if (["xls","xlsx"].includes(ext)) {
      return <iframe src={"https://view.officeapps.live.com/op/embed.aspx?src=" + encodeURIComponent(lic.url)} title={lic.nombre} style={{ width: "100%", height: "100%", border: "none" }} />;
    }
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 80 }}>{iconoArchivo(ext)}</div>
        <div style={{ fontSize: 18, color: "#374151", fontWeight: 700 }}>{lic.nombre}</div>
        <a href={lic.url} download={lic.nombreOriginal} target="_blank" rel="noreferrer"
          style={{ padding: "12px 24px", background: "#0B3D91", color: "#fff", borderRadius: 8, textDecoration: "none", fontWeight: 700 }}>
          Descargar archivo
        </a>
      </div>
    );
  };

  // Agrupar por categoría
  const grupos = licencias.reduce((acc, lic) => {
    const cat = lic.categoria || "General";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(lic);
    return acc;
  }, {});

  return (
    <LayoutWithSidebar>
      <PageHeader titulo="Licencias de Software" />
      <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>

        {mensaje && <div style={s.alertOk}>{mensaje}</div>}
        {error   && <div style={s.alertErr}>{error}</div>}

        {/* Panel de subida */}
        <div style={s.uploadBox}>
          <div style={s.uploadTitle}>Subir nuevo archivo de licencia</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 12, alignItems: "end", flexWrap: "wrap" }}>
            <div>
              <label style={s.label}>Archivo (PDF, Word, Excel, Imagen)</label>
              <input ref={inputRef} type="file" accept={TIPOS_ACEPTADOS} onChange={handleSeleccionar}
                style={{ ...s.input, cursor: "pointer" }} />
            </div>
            <div>
              <label style={s.label}>Nombre personalizado</label>
              <input type="text" value={nombrePersonalizado} onChange={e => setNombrePersonalizado(e.target.value)}
                placeholder="Ej: Licencia Kaspersky 2025" style={s.input} />
            </div>
            <div>
              <label style={s.label}>Categoría</label>
              <input type="text" value={categoria} onChange={e => setCategoria(e.target.value)}
                placeholder="Ej: Antivirus, Windows, Office..." style={s.input} />
            </div>
            <button onClick={handleSubir} disabled={!archivoPendiente || subiendo}
              style={{ ...s.btnSubir, opacity: archivoPendiente && !subiendo ? 1 : 0.5, cursor: archivoPendiente && !subiendo ? "pointer" : "not-allowed" }}>
              {subiendo ? "Subiendo..." : "Subir"}
            </button>
          </div>

          {/* Barra de progreso */}
          {subiendo && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                <span>Subiendo archivo...</span><span>{progreso}%</span>
              </div>
              <div style={{ height: 8, background: "rgba(255,255,255,0.3)", borderRadius: 8 }}>
                <div style={{ width: progreso + "%", height: "100%", background: "#fff", borderRadius: 8, transition: "width 0.3s" }} />
              </div>
            </div>
          )}

          {archivoPendiente && !subiendo && (
            <div style={{ marginTop: 12, fontSize: 13, color: "rgba(255,255,255,0.9)" }}>
              Archivo seleccionado: <strong>{archivoPendiente.name}</strong> ({(archivoPendiente.size / 1024).toFixed(0)} KB)
            </div>
          )}
        </div>

        {/* Lista de licencias agrupadas por categoría */}
        {cargando ? (
          <div style={{ textAlign: "center", padding: 60, color: "#6b7280", fontSize: 18 }}>Cargando licencias...</div>
        ) : Object.keys(grupos).length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, background: "#f9fafb", borderRadius: 12, color: "#9ca3af" }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>📜</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>No hay licencias. Sube el primer archivo arriba.</div>
          </div>
        ) : (
          Object.entries(grupos).map(([cat, items]) => (
            <div key={cat} style={{ marginBottom: 32 }}>
              <div style={{ fontWeight: 800, fontSize: 18, color: "#0B3D91", marginBottom: 12, paddingBottom: 8, borderBottom: "3px solid #0B3D91" }}>
                📂 {cat} ({items.length})
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                {items.map(lic => (
                  <div key={lic.id} style={s.card}>
                    {/* Header */}
                    <div style={s.cardHeader}>
                      <span style={{ fontSize: 22 }}>{iconoArchivo(lic.extension)}</span>
                      <span style={{ flex: 1, fontWeight: 700, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lic.nombre}</span>
                      <span style={{ fontSize: 10, background: "rgba(255,255,255,0.2)", padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>{(lic.extension || "").toUpperCase()}</span>
                    </div>

                    {/* Preview miniatura */}
                    <div style={{ height: 140, overflow: "hidden", background: "#f3f4f6", cursor: "pointer" }} onClick={() => setArchivoActivo(lic)}>
                      {["jpg","jpeg","png","gif","webp","bmp"].includes(lic.extension) ? (
                        <img src={lic.url} alt={lic.nombre} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: 8 }}>
                          <span style={{ fontSize: 48 }}>{iconoArchivo(lic.extension)}</span>
                          <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>Clic para ver</span>
                        </div>
                      )}
                    </div>

                    {/* Botones */}
                    <div style={{ display: "flex", gap: 8, padding: 10 }}>
                      <button onClick={() => setArchivoActivo(lic)}
                        style={{ flex: 1, padding: "8px", background: "#0B3D91", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 12 }}>
                        👁️ Ver
                      </button>
                      <a href={lic.url} download={lic.nombreOriginal} target="_blank" rel="noreferrer"
                        style={{ flex: 1, padding: "8px", background: "#10b981", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 12, textAlign: "center", textDecoration: "none" }}>
                        ⬇️ Descargar
                      </a>
                      <button onClick={() => handleEliminar(lic)}
                        style={{ padding: "8px 10px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 12 }}>
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}

        {/* Modal vista completa */}
        {archivoActivo && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9000 }}
            onClick={() => setArchivoActivo(null)}>
            <div style={{ width: "92%", height: "90%", background: "#fff", borderRadius: 12, overflow: "hidden", position: "relative" }}
              onClick={e => e.stopPropagation()}>
              {/* Barra modal */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", background: "#0B3D91", color: "#fff" }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{iconoArchivo(archivoActivo.extension)} {archivoActivo.nombre}</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <a href={archivoActivo.url} download={archivoActivo.nombreOriginal} target="_blank" rel="noreferrer"
                    style={{ padding: "6px 14px", background: "#10b981", color: "#fff", borderRadius: 6, fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
                    ⬇️ Descargar
                  </a>
                  <button onClick={() => setArchivoActivo(null)}
                    style={{ padding: "6px 14px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700 }}>
                    ✕ Cerrar
                  </button>
                </div>
              </div>
              <div style={{ height: "calc(100% - 48px)" }}>
                {renderPreview(archivoActivo)}
              </div>
            </div>
          </div>
        )}
      </div>
    </LayoutWithSidebar>
  );
}

const s = {
  uploadBox:   { background: "linear-gradient(135deg,#0B3D91,#007acc)", padding: 24, borderRadius: 16, marginBottom: 28, boxShadow: "0 8px 32px rgba(11,61,145,0.25)" },
  uploadTitle: { color: "#fff", fontSize: 17, fontWeight: 800, marginBottom: 16 },
  label:       { color: "#fff", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 6 },
  input:       { width: "100%", padding: "10px 12px", border: "none", borderRadius: 8, fontSize: 13, background: "#fff", outline: "none" },
  btnSubir:    { padding: "10px 24px", background: "#10b981", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 14, whiteSpace: "nowrap" },
  card:        { borderRadius: 12, border: "1px solid #e5e7eb", background: "#fff", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.07)" },
  cardHeader:  { display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "linear-gradient(135deg,#9b59b6,#8e44ad)", color: "#fff" },
  alertOk:     { background: "#d1fae5", border: "2px solid #10b981", color: "#065f46", padding: "12px 18px", borderRadius: 10, marginBottom: 16, fontWeight: 600 },
  alertErr:    { background: "#fee2e2", border: "2px solid #ef4444", color: "#991b1b", padding: "12px 18px", borderRadius: 10, marginBottom: 16, fontWeight: 600 },
};
