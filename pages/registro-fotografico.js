// pages/registro-fotografico.js — LOGISPORT
// Fotos vinculadas a equipos de hoja-vida, máx 3 por equipo
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "@/firebase/firebaseConfig";
import {
  collection, addDoc, onSnapshot, orderBy, query,
  serverTimestamp, updateDoc, deleteDoc, doc, getDocs,
} from "firebase/firestore";
import { subirACloudinary } from "@/utils/cloudinaryUpload";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import LayoutWithSidebar from "@/components/LayoutWithSidebar";
import PageHeader from "@/components/PageHeader";
import ImagenSegura from "@/components/ImagenSegura";

const MAX_FOTOS_POR_EQUIPO = 3;

export default function RegistroFotografico() {
  const router = useRouter();

  const [usuario, setUsuario]                   = useState(null);
  const [checkingAuth, setCheckingAuth]         = useState(true);
  const [fotos, setFotos]                       = useState([]);
  const [equipos, setEquipos]                   = useState([]); // nombres de PC desde hojaVidaEquipos
  const [subiendo, setSubiendo]                 = useState({});
  const [renombres, setRenombres]               = useState({});
  const [filtro, setFiltro]                     = useState("");
  const [filtroEquipo, setFiltroEquipo]         = useState(""); // filtro por equipo
  const [nombreNuevaFoto, setNombreNuevaFoto]   = useState("");
  const [equipoSeleccionado, setEquipoSeleccionado] = useState(""); // equipo al que pertenece la foto
  const [mensaje, setMensaje]                   = useState("");
  const [error, setError]                       = useState("");
  const [archivosPendientes, setArchivosPendientes] = useState([]);

  const inputRef = useRef(null);

  // Auth
  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (u) => {
      setUsuario(u || null);
      setCheckingAuth(false);
    });
    return () => unsub();
  }, []);

  // Cargar nombres de PC desde hojaVidaEquipos
  useEffect(() => {
    const cargarEquipos = async () => {
      try {
        const snap = await getDocs(collection(db, "hojaVidaEquipos"));
        const nombres = [...new Set(
          snap.docs
            .map(d => d.data().nombrePC)
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b, "es"))
        )];
        setEquipos(nombres);
      } catch (e) { console.error(e); }
    };
    cargarEquipos();
  }, []);

  const colRef = useMemo(() => collection(db, "registroFotografico"), []);

  // Suscripción Firestore
  useEffect(() => {
    if (!usuario) return;
    const q = query(colRef, orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setFotos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.error(err);
      setError("No se pudieron cargar las fotos.");
    });
    return () => unsub();
  }, [colRef, usuario]);

  // Contar fotos por equipo
  const conteoFotosPorEquipo = useMemo(() => {
    return fotos.reduce((acc, f) => {
      if (f.nombrePC) acc[f.nombrePC] = (acc[f.nombrePC] || 0) + 1;
      return acc;
    }, {});
  }, [fotos]);

  // Seleccionar archivos
  const handleSeleccionarArchivos = (e) => {
    if (!equipoSeleccionado) {
      setError("⚠️ Selecciona primero el equipo al que pertenecen las fotos.");
      return;
    }
    const fotosActuales = conteoFotosPorEquipo[equipoSeleccionado] || 0;
    const disponibles = MAX_FOTOS_POR_EQUIPO - fotosActuales;
    if (disponibles <= 0) {
      setError(`⚠️ El equipo "${equipoSeleccionado}" ya tiene ${MAX_FOTOS_POR_EQUIPO} fotos (máximo permitido).`);
      return;
    }
    const archivos = Array.from(e.target.files || []).filter(f => f.type.startsWith("image/")).slice(0, disponibles);
    setArchivosPendientes(archivos);
    setError("");
    if (archivos.length > 0) {
      setMensaje(`${archivos.length} archivo(s) listo(s). Espacio disponible: ${disponibles} foto(s).`);
      setTimeout(() => setMensaje(""), 4000);
    }
  };

  // Subir a Cloudinary
  const handleSubirFotos = async () => {
    if (!equipoSeleccionado) { setError("⚠️ Selecciona el equipo primero."); return; }
    if (!archivosPendientes.length) { setError("⚠️ No hay archivos seleccionados."); return; }
    if (!usuario) { setError("⚠️ Debes estar autenticado."); return; }

    // Verificar límite
    const fotosActuales = conteoFotosPorEquipo[equipoSeleccionado] || 0;
    if (fotosActuales >= MAX_FOTOS_POR_EQUIPO) {
      setError(`⚠️ "${equipoSeleccionado}" ya tiene ${MAX_FOTOS_POR_EQUIPO} fotos.`);
      return;
    }

    setError(""); setMensaje("");

    for (let idx = 0; idx < archivosPendientes.length; idx++) {
      const archivo = archivosPendientes[idx];
      const tempKey = `upload_${Date.now()}_${idx}`;
      setSubiendo(p => ({ ...p, [tempKey]: 10 }));

      try {
        const resultado = await subirACloudinary(archivo, (pct) =>
          setSubiendo(p => ({ ...p, [tempKey]: pct }))
        );

        const nombreFinal = nombreNuevaFoto.trim() || archivo.name;
        await addDoc(colRef, {
          displayName:  nombreFinal,
          originalName: archivo.name,
          path:         resultado.publicId,
          downloadURL:  resultado.url,
          type:         archivo.type,
          size:         resultado.size,
          nombrePC:     equipoSeleccionado, // vínculo con el equipo
          createdAt:    serverTimestamp(),
          uid:          usuario.uid,
          email:        usuario.email,
          fuente:       "cloudinary",
        });

        setSubiendo(p => { const c = { ...p }; delete c[tempKey]; return c; });
      } catch (err) {
        console.error(err);
        setError(`Error al subir: ${err.message}`);
        setSubiendo(p => { const c = { ...p }; delete c[tempKey]; return c; });
      }
    }

    setMensaje("✅ Foto(s) subida(s) y vinculada(s) a " + equipoSeleccionado);
    setTimeout(() => setMensaje(""), 4000);
    setArchivosPendientes([]);
    setNombreNuevaFoto("");
    if (inputRef.current) inputRef.current.value = "";
  };

  // Renombrar
  const actualizarNombre = async (foto) => {
    const nuevo = (renombres[foto.id] ?? "").trim();
    if (!nuevo) return;
    try {
      await updateDoc(doc(db, "registroFotografico", foto.id), { displayName: nuevo });
      setMensaje("✅ Nombre actualizado");
      setTimeout(() => setMensaje(""), 2000);
    } catch { setError("No se pudo actualizar el nombre."); }
    finally { setRenombres(p => ({ ...p, [foto.id]: "" })); }
  };

  // Eliminar
  const eliminarFoto = async (foto) => {
    if (!confirm(`¿Eliminar "${foto.displayName || foto.originalName}"?`)) return;
    try {
      await deleteDoc(doc(db, "registroFotografico", foto.id));
      setMensaje("🗑️ Foto eliminada");
      setTimeout(() => setMensaje(""), 2000);
    } catch { setError("No se pudo eliminar."); }
  };

  // Descargar
  const descargarImagen = (url, nombre) => {
    const a = document.createElement("a");
    a.href = url; a.download = nombre || "foto";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  // Filtro combinado: texto + equipo
  const fotosFiltradas = useMemo(() => {
    return fotos.filter(f => {
      const textOk = !filtro.trim() ||
        (f.displayName || "").toLowerCase().includes(filtro.toLowerCase()) ||
        (f.originalName || "").toLowerCase().includes(filtro.toLowerCase()) ||
        (f.nombrePC || "").toLowerCase().includes(filtro.toLowerCase());
      const equipoOk = !filtroEquipo || f.nombrePC === filtroEquipo;
      return textOk && equipoOk;
    });
  }, [fotos, filtro, filtroEquipo]);

  // Agrupar fotos por equipo para mostrar conteo
  const fotosAgrupadas = useMemo(() => {
    const grupos = {};
    fotosFiltradas.forEach(f => {
      const key = f.nombrePC || "Sin equipo asignado";
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(f);
    });
    return grupos;
  }, [fotosFiltradas]);

  if (checkingAuth) return <div style={{ padding: 24 }}>Verificando autenticación...</div>;
  if (!usuario) return (
    <LayoutWithSidebar>
      <div style={{ padding: 24 }}>
        <div style={s.alertErr}>⚠️ Debes iniciar sesión para acceder.</div>
        <button onClick={() => router.push("/login")}
          style={{ padding: "10px 20px", background: "#0B3D91", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
          Ir a Login
        </button>
      </div>
    </LayoutWithSidebar>
  );

  return (
    <LayoutWithSidebar>
      <PageHeader titulo="Registro Fotográfico" />
      <div style={s.container}>

        {mensaje && <div style={s.alertOk}>✅ {mensaje}</div>}
        {error   && <div style={s.alertErr}>❌ {error}</div>}

        {/* ── Formulario de subida ── */}
        <div style={s.uploadSection}>
          <div style={s.uploadTitle}>📸 Subir nueva foto</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            {/* Selector de equipo */}
            <div style={s.inputGroup}>
              <label style={s.label}>Equipo (PC) al que pertenece <span style={{ color: "#fbbf24" }}>*</span></label>
              <select value={equipoSeleccionado} onChange={e => { setEquipoSeleccionado(e.target.value); setArchivosPendientes([]); if (inputRef.current) inputRef.current.value = ""; }}
                style={{ ...s.input, color: equipoSeleccionado ? "#111827" : "#9ca3af" }} required>
                <option value="">— Selecciona el equipo —</option>
                {equipos.map(eq => {
                  const count = conteoFotosPorEquipo[eq] || 0;
                  const lleno = count >= MAX_FOTOS_POR_EQUIPO;
                  return (
                    <option key={eq} value={eq} disabled={lleno}>
                      {eq} ({count}/{MAX_FOTOS_POR_EQUIPO} fotos){lleno ? " — COMPLETO" : ""}
                    </option>
                  );
                })}
              </select>
              {equipoSeleccionado && (
                <div style={{ fontSize: 12, marginTop: 4, color: (conteoFotosPorEquipo[equipoSeleccionado] || 0) >= MAX_FOTOS_POR_EQUIPO ? "#dc2626" : "#059669", fontWeight: 600 }}>
                  {conteoFotosPorEquipo[equipoSeleccionado] || 0}/{MAX_FOTOS_POR_EQUIPO} fotos usadas para este equipo
                </div>
              )}
            </div>

            {/* Nombre de la foto */}
            <div style={s.inputGroup}>
              <label style={s.label}>Nombre descriptivo (opcional)</label>
              <input type="text" value={nombreNuevaFoto} onChange={e => setNombreNuevaFoto(e.target.value)}
                placeholder="Ej: Vista frontal, Torre, Monitor..." style={s.input} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "end" }}>
            <div style={s.inputGroup}>
              <label style={s.label}>Seleccionar imagen</label>
              <input ref={inputRef} type="file" accept="image/*" onChange={handleSeleccionarArchivos}
                disabled={!equipoSeleccionado || (conteoFotosPorEquipo[equipoSeleccionado] || 0) >= MAX_FOTOS_POR_EQUIPO}
                style={{ ...s.input, cursor: equipoSeleccionado ? "pointer" : "not-allowed" }} />
            </div>
            <button onClick={handleSubirFotos}
              disabled={archivosPendientes.length === 0 || Object.keys(subiendo).length > 0 || !equipoSeleccionado}
              style={{ ...s.btnGuardar, background: archivosPendientes.length > 0 && equipoSeleccionado ? "#10b981" : "#9ca3af", cursor: archivosPendientes.length > 0 && equipoSeleccionado ? "pointer" : "not-allowed" }}>
              <span>💾</span>
              <span>{Object.keys(subiendo).length > 0 ? "Subiendo..." : `GUARDAR (${archivosPendientes.length})`}</span>
            </button>
          </div>
        </div>

        {/* Progreso */}
        {Object.keys(subiendo).length > 0 && (
          <div style={s.progressWrap}>
            {Object.entries(subiendo).map(([key, pct]) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  <span>Subiendo...</span><span style={{ color: "#0B3D91" }}>{pct}%</span>
                </div>
                <div style={s.barBg}>
                  <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg,#0B3D91,#007acc)", transition: "width 0.3s" }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Filtros ── */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <input type="text" value={filtro} onChange={e => setFiltro(e.target.value)}
            placeholder="🔍 Buscar por nombre..."
            style={{ flex: 1, minWidth: 180, padding: "10px 14px", border: "2px solid #e5e7eb", borderRadius: 10, fontSize: 14, outline: "none" }} />
          <select value={filtroEquipo} onChange={e => setFiltroEquipo(e.target.value)}
            style={{ padding: "10px 14px", border: "2px solid #e5e7eb", borderRadius: 10, fontSize: 14, outline: "none", background: "white" }}>
            <option value="">Todos los equipos</option>
            {equipos.map(eq => <option key={eq} value={eq}>{eq} ({conteoFotosPorEquipo[eq] || 0})</option>)}
            {fotos.some(f => !f.nombrePC) && <option value="__sin_equipo__">Sin equipo asignado</option>}
          </select>
        </div>

        {/* ── Galería agrupada por equipo ── */}
        {Object.keys(fotosAgrupadas).length === 0 ? (
          <div style={s.emptyState}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>📷</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#6b7280" }}>No hay fotos para mostrar</div>
            <div style={{ fontSize: 14, color: "#9ca3af", marginTop: 6 }}>
              {filtro || filtroEquipo ? "Ninguna foto coincide con el filtro" : "Sube la primera foto usando el formulario de arriba"}
            </div>
          </div>
        ) : (
          Object.entries(fotosAgrupadas).map(([equipo, fotosGrupo]) => (
            <div key={equipo} style={{ marginBottom: 32 }}>
              {/* Cabecera del grupo */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, padding: "10px 16px", background: "#0B3D91", borderRadius: 10 }}>
                <span style={{ fontSize: 18 }}>🖥️</span>
                <span style={{ fontWeight: 800, fontSize: 16, color: "#fff" }}>{equipo}</span>
                <span style={{ background: "rgba(255,255,255,0.2)", color: "#fff", padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                  {fotosGrupo.length}/{MAX_FOTOS_POR_EQUIPO} fotos
                </span>
                {/* Barra de capacidad */}
                <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.2)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${(fotosGrupo.length / MAX_FOTOS_POR_EQUIPO) * 100}%`, height: "100%", background: fotosGrupo.length >= MAX_FOTOS_POR_EQUIPO ? "#f87171" : "#86efac", borderRadius: 3 }} />
                </div>
              </div>

              {/* Grid de fotos del grupo */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
                {fotosGrupo.map(foto => (
                  <div key={foto.id} style={s.card}>
                    <div style={s.thumbWrap}>
                      <ImagenSegura url={foto.downloadURL} alt={foto.displayName || foto.originalName} style={s.img} />
                    </div>
                    <div style={s.cardBody}>
                      <div style={s.row}>
                        <input type="text"
                          value={renombres[foto.id] ?? foto.displayName ?? foto.originalName ?? ""}
                          onChange={e => setRenombres(p => ({ ...p, [foto.id]: e.target.value }))}
                          style={s.textInput} placeholder="Nombre de la foto" />
                        <button onClick={() => actualizarNombre(foto)} style={s.btnIcon} title="Guardar nombre">💾</button>
                      </div>
                      <div style={s.btnRow}>
                        <button onClick={() => descargarImagen(foto.downloadURL, foto.displayName || foto.originalName)}
                          style={{ ...s.btn, background: "#0B3D91", color: "#fff" }}>⬇️ Descargar</button>
                        <button onClick={() => eliminarFoto(foto)}
                          style={{ ...s.btn, background: "#ef4444", color: "#fff" }}>🗑️ Eliminar</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </LayoutWithSidebar>
  );
}

const s = {
  container:    { padding: "24px", maxWidth: 1400, margin: "0 auto" },
  uploadSection:{ background: "linear-gradient(135deg,#0B3D91 0%,#007acc 100%)", padding: 24, borderRadius: 16, marginBottom: 24, boxShadow: "0 12px 40px rgba(11,61,145,0.25)" },
  uploadTitle:  { color: "#fff", fontSize: 18, fontWeight: 800, marginBottom: 16 },
  inputGroup:   { display: "flex", flexDirection: "column", gap: 6 },
  label:        { color: "#fff", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" },
  input:        { padding: "11px 14px", border: "none", borderRadius: 10, fontSize: 14, background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", outline: "none" },
  btnGuardar:   { padding: "12px 28px", color: "#fff", border: 0, borderRadius: 10, fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" },
  progressWrap: { background: "#fff", padding: 20, borderRadius: 12, marginBottom: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" },
  barBg:        { height: 8, background: "#e5e7eb", borderRadius: 8, overflow: "hidden" },
  card:         { borderRadius: 14, boxShadow: "0 4px 16px rgba(0,0,0,0.08)", background: "#fff", overflow: "hidden", border: "1px solid #e5e7eb" },
  thumbWrap:    { position: "relative", width: "100%", paddingBottom: "70%", overflow: "hidden", background: "#f3f4f6" },
  img:          { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" },
  cardBody:     { padding: 16 },
  row:          { display: "flex", gap: 8, alignItems: "center", marginBottom: 10 },
  textInput:    { flex: 1, padding: "10px 12px", border: "2px solid #e5e7eb", borderRadius: 8, fontSize: 13, fontWeight: 500, outline: "none" },
  btnIcon:      { width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", border: 0, borderRadius: 8, cursor: "pointer", fontSize: 16, background: "#10b981", color: "#fff" },
  btnRow:       { display: "flex", gap: 8 },
  btn:          { flex: 1, padding: "10px 12px", border: 0, borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 },
  alertOk:      { background: "#d1fae5", border: "2px solid #10b981", color: "#065f46", padding: "12px 18px", borderRadius: 10, marginBottom: 16, fontSize: 14, fontWeight: 600 },
  alertErr:     { background: "#fee2e2", border: "2px solid #ef4444", color: "#991b1b", padding: "12px 18px", borderRadius: 10, marginBottom: 16, fontSize: 14, fontWeight: 600 },
  emptyState:   { textAlign: "center", padding: "60px 20px", color: "#9ca3af" },
};
