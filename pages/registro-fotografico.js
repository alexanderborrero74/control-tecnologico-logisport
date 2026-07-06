// pages/registro-fotografico.js — LOGISPORT
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "@/firebase/firebaseConfig";
import {
  collection, addDoc, onSnapshot, orderBy, query,
  serverTimestamp, updateDoc, deleteDoc, doc, getDocs, where,
} from "firebase/firestore";
import { subirACloudinary } from "@/utils/cloudinaryUpload";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { useUsuarios } from "@/utils/useUsuarios";
import { useCargos } from "@/utils/useCargos";
import LayoutWithSidebar from "@/components/LayoutWithSidebar";
import PageHeader from "@/components/PageHeader";
import ImagenSegura from "@/components/ImagenSegura";

const MAX_FOTOS_POR_EQUIPO = 3;

export default function RegistroFotografico() {
  const router = useRouter();

  const [usuario, setUsuario]                   = useState(null);
  const [checkingAuth, setCheckingAuth]         = useState(true);
  const [fotos, setFotos]                       = useState([]);
  const [equipos, setEquipos]                   = useState([]);
  const [subiendo, setSubiendo]                 = useState({});
  const [renombres, setRenombres]               = useState({});
  const [filtro, setFiltro]                     = useState("");
  const [filtroEquipo, setFiltroEquipo]         = useState("");
  const [nombreNuevaFoto, setNombreNuevaFoto]   = useState("");
  const [equipoSeleccionado, setEquipoSeleccionado] = useState("");
  const [mensaje, setMensaje]                   = useState("");
  const [error, setError]                       = useState("");
  const [archivosPendientes, setArchivosPendientes] = useState([]);
  const [fotosImport, setFotosImport]           = useState([]);
  const [subiendoImport, setSubiendoImport]     = useState(false);
  const [progresoImport, setProgresoImport]     = useState({});
  const [editCargo, setEditCargo]               = useState({}); // {fotoId: cargo}

  const inputRef       = useRef(null);
  const inputImportRef = useRef(null);

  // Cargos desde cargosCatalogo (Admin Usuarios)
  const { cargos: cargosDB } = useCargos();
  const cargosDisponibles = useMemo(() => {
    return (cargosDB || []).filter(c => c.activo !== false).map(c => c.nombre).sort();
  }, [cargosDB]);

  // Auth
  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (u) => {
      setUsuario(u || null);
      setCheckingAuth(false);
    });
    return () => unsub();
  }, []);

  // Cargar equipos desde hojaVidaEquipos
  useEffect(() => {
    const cargarEquipos = async () => {
      try {
        const snap = await getDocs(collection(db, "hojaVidaEquipos"));
        const nombres = [...new Set(
          snap.docs.map(d => d.data().nombrePC).filter(Boolean).sort((a, b) => a.localeCompare(b, "es"))
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

  const conteoFotosPorEquipo = useMemo(() => {
    return fotos.reduce((acc, f) => {
      if (f.nombrePC) acc[f.nombrePC] = (acc[f.nombrePC] || 0) + 1;
      return acc;
    }, {});
  }, [fotos]);

  // ── Importación masiva ──
  const handleSeleccionarImport = (e) => {
    const archivos = Array.from(e.target.files || []).filter(f => f.type.startsWith("image/"));
    if (!archivos.length) return;
    const nuevas = archivos.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      cargo: "",
      nombre: file.name.replace(/\.[^.]+$/, ""),
    }));
    setFotosImport(prev => [...prev, ...nuevas]);
    if (inputImportRef.current) inputImportRef.current.value = "";
  };

  const actualizarCampoImport = (idx, campo, valor) => {
    setFotosImport(prev => prev.map((f, i) => i === idx ? { ...f, [campo]: valor } : f));
  };

  const quitarFotoImport = (idx) => {
    setFotosImport(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubirImport = async () => {
    if (!fotosImport.length || subiendoImport) return;
    if (!usuario) { setError("Debes estar autenticado."); return; }
    setSubiendoImport(true);
    setError(""); setMensaje("");
    let subidas = 0;
    for (let idx = 0; idx < fotosImport.length; idx++) {
      const item = fotosImport[idx];
      setProgresoImport(p => ({ ...p, [idx]: 5 }));
      try {
        const resultado = await subirACloudinary(item.file, (pct) =>
          setProgresoImport(p => ({ ...p, [idx]: pct }))
        );
        await addDoc(colRef, {
          displayName:  item.nombre || item.file.name,
          originalName: item.file.name,
          path:         resultado.publicId,
          downloadURL:  resultado.url,
          type:         item.file.type,
          size:         resultado.size || 0,
          nombrePC:     item.cargo || "",
          cargo:        item.cargo || "",
          createdAt:    serverTimestamp(),
          uid:          usuario.uid,
          email:        usuario.email,
          fuente:       "cloudinary",
          importMasiva: true,
        });
        setProgresoImport(p => ({ ...p, [idx]: 100 }));
        subidas++;
      } catch (err) {
        console.error(err);
        setProgresoImport(p => ({ ...p, [idx]: -1 }));
      }
    }
    setMensaje("Importacion completa: " + subidas + " foto(s) subidas.");
    setTimeout(() => setMensaje(""), 4000);
    setFotosImport([]);
    setProgresoImport({});
    setSubiendoImport(false);
  };

  // ── Subida individual ──
  const handleSeleccionarArchivos = (e) => {
    if (!equipoSeleccionado) { setError("Selecciona primero el equipo."); return; }
    const fotosActuales = conteoFotosPorEquipo[equipoSeleccionado] || 0;
    const disponibles = MAX_FOTOS_POR_EQUIPO - fotosActuales;
    if (disponibles <= 0) { setError("El equipo ya tiene el maximo de fotos."); return; }
    const archivos = Array.from(e.target.files || []).filter(f => f.type.startsWith("image/")).slice(0, disponibles);
    setArchivosPendientes(archivos);
    setError("");
    if (archivos.length > 0) {
      setMensaje(archivos.length + " archivo(s) listo(s).");
      setTimeout(() => setMensaje(""), 4000);
    }
  };

  const handleSubirFotos = async () => {
    if (!equipoSeleccionado || !archivosPendientes.length || !usuario) return;
    const fotosActuales = conteoFotosPorEquipo[equipoSeleccionado] || 0;
    if (fotosActuales >= MAX_FOTOS_POR_EQUIPO) { setError("Limite de fotos alcanzado."); return; }
    setError(""); setMensaje("");
    for (let idx = 0; idx < archivosPendientes.length; idx++) {
      const archivo = archivosPendientes[idx];
      const tempKey = "upload_" + Date.now() + "_" + idx;
      setSubiendo(p => ({ ...p, [tempKey]: 10 }));
      try {
        const resultado = await subirACloudinary(archivo, (pct) =>
          setSubiendo(p => ({ ...p, [tempKey]: pct }))
        );
        await addDoc(colRef, {
          displayName:  nombreNuevaFoto.trim() || archivo.name,
          originalName: archivo.name,
          path:         resultado.publicId,
          downloadURL:  resultado.url,
          type:         archivo.type,
          size:         resultado.size,
          nombrePC:     equipoSeleccionado,
          createdAt:    serverTimestamp(),
          uid:          usuario.uid,
          email:        usuario.email,
          fuente:       "cloudinary",
        });
        setSubiendo(p => { const c = { ...p }; delete c[tempKey]; return c; });
      } catch (err) {
        console.error(err);
        setError("Error al subir: " + err.message);
        setSubiendo(p => { const c = { ...p }; delete c[tempKey]; return c; });
      }
    }
    setMensaje("Fotos subidas a " + equipoSeleccionado);
    setTimeout(() => setMensaje(""), 4000);
    setArchivosPendientes([]);
    setNombreNuevaFoto("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const actualizarNombre = async (foto) => {
    const nuevo = (renombres[foto.id] ?? "").trim();
    if (!nuevo) return;
    try {
      await updateDoc(doc(db, "registroFotografico", foto.id), { displayName: nuevo });
      setMensaje("Nombre actualizado");
      setTimeout(() => setMensaje(""), 2000);
    } catch { setError("No se pudo actualizar el nombre."); }
    finally { setRenombres(p => ({ ...p, [foto.id]: "" })); }
  };

  const actualizarCargo = async (foto, nuevoCargo) => {
    try {
      // 1. Actualizar en registroFotografico
      await updateDoc(doc(db, "registroFotografico", foto.id), {
        cargo: nuevoCargo,
        nombrePC: nuevoCargo,
      });

      // 2. Buscar equipo en hojaVidaEquipos con ese cargo
      if (nuevoCargo) {
        // Buscar por cargo exacto
        const q = query(
          collection(db, "hojaVidaEquipos"),
          where("cargo", "==", nuevoCargo)
        );
        const snap = await getDocs(q);

        // Si no encuentra exacto, buscar en todos y comparar sin case
        let equipoDoc = snap.empty ? null : snap.docs[0];
        if (!equipoDoc) {
          const todos = await getDocs(collection(db, "hojaVidaEquipos"));
          const match = todos.docs.find(d => 
            (d.data().cargo || "").toLowerCase().trim() === nuevoCargo.toLowerCase().trim()
          );
          equipoDoc = match || null;
        }

        if (!equipoDoc) {
          setMensaje("Cargo actualizado. No se encontro equipo con cargo: '" + nuevoCargo + "' en Hoja de Vida.");
          setTimeout(() => setMensaje(""), 5000);
          return;
        }
        const equipo = equipoDoc.data();
        const equipoRef = doc(db, "hojaVidaEquipos", equipoDoc.id);

        // 3. Verificar cuantas fotos ya tiene
        const tieneFoto1 = !!equipo.foto1URL;
        const tieneFoto2 = !!equipo.foto2URL;

        if (tieneFoto1 && tieneFoto2) {
          setError("El equipo " + nuevoCargo + " ya tiene 2 fotos. Solo se aceptan 2 fotos por equipo.");
          setTimeout(() => setError(""), 4000);
          return;
        }

        // 4. Agregar la foto al slot disponible
        if (!tieneFoto1) {
          await updateDoc(equipoRef, {
            foto1URL: foto.downloadURL,
            foto1Name: foto.displayName || foto.originalName || "foto1",
          });
        } else {
          await updateDoc(equipoRef, {
            foto2URL: foto.downloadURL,
            foto2Name: foto.displayName || foto.originalName || "foto2",
          });
        }

        setMensaje("Cargo actualizado y foto vinculada a Hoja de Vida de " + nuevoCargo);
      } else {
        setMensaje("Cargo actualizado.");
      }

      setTimeout(() => setMensaje(""), 3000);
    } catch (e) {
      console.error(e);
      setError("No se pudo actualizar el cargo: " + e.message);
      setTimeout(() => setError(""), 4000);
    }
  };

  const eliminarFoto = async (foto) => {
    if (!confirm("Eliminar " + (foto.displayName || foto.originalName) + "?")) return;
    try {
      await deleteDoc(doc(db, "registroFotografico", foto.id));
      setMensaje("Foto eliminada");
      setTimeout(() => setMensaje(""), 2000);
    } catch { setError("No se pudo eliminar."); }
  };

  const descargarImagen = (url, nombre) => {
    const a = document.createElement("a");
    a.href = url; a.download = nombre || "foto";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

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

  const fotosAgrupadas = useMemo(() => {
    const grupos = {};
    fotosFiltradas.forEach(f => {
      const key = f.nombrePC || "Sin equipo asignado";
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(f);
    });
    return grupos;
  }, [fotosFiltradas]);

  if (checkingAuth) return <div style={{ padding: 24 }}>Verificando autenticacion...</div>;
  if (!usuario) return (
    <LayoutWithSidebar>
      <div style={{ padding: 24 }}>
        <div style={s.alertErr}>Debes iniciar sesion para acceder.</div>
        <button onClick={() => router.push("/login")} style={{ padding: "10px 20px", background: "#0B3D91", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
          Ir a Login
        </button>
      </div>
    </LayoutWithSidebar>
  );

  return (
    <LayoutWithSidebar>
      <PageHeader titulo="Registro Fotografico" />
      <div style={s.container}>

        {mensaje && <div style={s.alertOk}>{mensaje}</div>}
        {error   && <div style={s.alertErr}>{error}</div>}

        {/* Formulario subida individual */}
        <div style={s.uploadSection}>
          <div style={s.uploadTitle}>Subir nueva foto</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div style={s.inputGroup}>
              <label style={s.label}>Equipo (PC) al que pertenece *</label>
              <select value={equipoSeleccionado} onChange={e => { setEquipoSeleccionado(e.target.value); setArchivosPendientes([]); if (inputRef.current) inputRef.current.value = ""; }}
                style={{ ...s.input, color: equipoSeleccionado ? "#111827" : "#9ca3af" }}>
                <option value="">Selecciona el equipo</option>
                {equipos.map(eq => {
                  const count = conteoFotosPorEquipo[eq] || 0;
                  const lleno = count >= MAX_FOTOS_POR_EQUIPO;
                  return (
                    <option key={eq} value={eq} disabled={lleno}>
                      {eq} ({count}/{MAX_FOTOS_POR_EQUIPO} fotos){lleno ? " COMPLETO" : ""}
                    </option>
                  );
                })}
              </select>
            </div>
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
              <span>{Object.keys(subiendo).length > 0 ? "Subiendo..." : "GUARDAR (" + archivosPendientes.length + ")"}</span>
            </button>
          </div>
        </div>

        {/* Progreso subida individual */}
        {Object.keys(subiendo).length > 0 && (
          <div style={s.progressWrap}>
            {Object.entries(subiendo).map(([key, pct]) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  <span>Subiendo...</span><span style={{ color: "#0B3D91" }}>{pct}%</span>
                </div>
                <div style={s.barBg}>
                  <div style={{ width: pct + "%", height: "100%", background: "linear-gradient(90deg,#0B3D91,#007acc)", transition: "width 0.3s" }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Importacion masiva */}
        <div style={{ background: "#f0f9ff", border: "2px dashed #0B3D91", borderRadius: 16, padding: 24, marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
            <div style={{ fontWeight: 800, fontSize: 17, color: "#0B3D91" }}>
              Importacion masiva de fotos
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <label style={{ padding: "10px 20px", background: "#0B3D91", color: "#fff", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                Seleccionar fotos
                <input ref={inputImportRef} type="file" accept="image/*" multiple onChange={handleSeleccionarImport} style={{ display: "none" }} />
              </label>
              {fotosImport.length > 0 && (
                <button onClick={handleSubirImport} disabled={subiendoImport}
                  style={{ padding: "10px 20px", background: subiendoImport ? "#9ca3af" : "#10b981", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, cursor: subiendoImport ? "not-allowed" : "pointer", fontSize: 14 }}>
                  {subiendoImport ? "Subiendo..." : "Subir " + fotosImport.length + " foto(s)"}
                </button>
              )}
            </div>
          </div>

          {fotosImport.length === 0 ? (
            <div style={{ textAlign: "center", color: "#6b7280", padding: "20px 0", fontSize: 14 }}>
              Haz clic en "Seleccionar fotos" para importar varias imagenes y asignarle un cargo a cada una.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
              {fotosImport.map((item, idx) => {
                const pct = progresoImport[idx];
                const subida = pct === 100;
                const errorFoto = pct === -1;
                const borderColor = subida ? "#10b981" : errorFoto ? "#ef4444" : "#e5e7eb";
                return (
                  <div key={idx} style={{ background: "#fff", borderRadius: 12, overflow: "hidden", border: "2px solid " + borderColor, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                    <div style={{ position: "relative", paddingBottom: "65%", background: "#f3f4f6", overflow: "hidden" }}>
                      <img src={item.preview} alt={item.nombre} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                      {!subiendoImport && !subida && (
                        <button onClick={() => quitarFotoImport(idx)} style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", borderRadius: "50%", width: 26, height: 26, cursor: "pointer", fontSize: 14 }}>x</button>
                      )}
                      {subida && <div style={{ position: "absolute", top: 6, left: 6, background: "#10b981", color: "#fff", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>Subida</div>}
                      {errorFoto && <div style={{ position: "absolute", top: 6, left: 6, background: "#ef4444", color: "#fff", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>Error</div>}
                      {pct > 0 && pct < 100 && (
                        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 5, background: "rgba(0,0,0,0.2)" }}>
                          <div style={{ width: pct + "%", height: "100%", background: "#10b981", transition: "width 0.3s" }} />
                        </div>
                      )}
                    </div>
                    <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                      <input type="text" value={item.nombre}
                        onChange={e => actualizarCampoImport(idx, "nombre", e.target.value)}
                        placeholder="Nombre de la foto"
                        disabled={subida || subiendoImport}
                        style={{ padding: "8px 10px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 12, fontWeight: 500, outline: "none", width: "100%" }} />
                      <select value={item.cargo}
                        onChange={e => actualizarCampoImport(idx, "cargo", e.target.value)}
                        disabled={subida || subiendoImport}
                        style={{ padding: "8px 10px", border: "1.5px solid " + (item.cargo ? "#0B3D91" : "#fbbf24"), borderRadius: 8, fontSize: 12, fontWeight: 600, outline: "none", background: item.cargo ? "#eff6ff" : "#fffbeb", color: item.cargo ? "#1e3a8a" : "#92400e" }}>
                        <option value="">Asignar cargo</option>
                        {cargosDisponibles.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Filtros */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <input type="text" value={filtro} onChange={e => setFiltro(e.target.value)}
            placeholder="Buscar por nombre..."
            style={{ flex: 1, minWidth: 180, padding: "10px 14px", border: "2px solid #e5e7eb", borderRadius: 10, fontSize: 14, outline: "none" }} />
          <select value={filtroEquipo} onChange={e => setFiltroEquipo(e.target.value)}
            style={{ padding: "10px 14px", border: "2px solid #e5e7eb", borderRadius: 10, fontSize: 14, outline: "none", background: "white" }}>
            <option value="">Todos los equipos</option>
            {equipos.map(eq => <option key={eq} value={eq}>{eq} ({conteoFotosPorEquipo[eq] || 0})</option>)}
            {fotos.some(f => !f.nombrePC) && <option value="__sin_equipo__">Sin equipo asignado</option>}
          </select>
        </div>

        {/* Galeria */}
        {Object.keys(fotosAgrupadas).length === 0 ? (
          <div style={s.emptyState}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>📷</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#6b7280" }}>No hay fotos para mostrar</div>
          </div>
        ) : (
          Object.entries(fotosAgrupadas).map(([equipo, fotosGrupo]) => {
            const pctBarra = Math.round((fotosGrupo.length / MAX_FOTOS_POR_EQUIPO) * 100);
            const colorBarra = fotosGrupo.length >= MAX_FOTOS_POR_EQUIPO ? "#f87171" : "#86efac";
            return (
              <div key={equipo} style={{ marginBottom: 32 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, padding: "10px 16px", background: "#0B3D91", borderRadius: 10 }}>
                  <span style={{ fontSize: 18 }}>🖥️</span>
                  <span style={{ fontWeight: 800, fontSize: 16, color: "#fff" }}>{equipo}</span>
                  <span style={{ background: "rgba(255,255,255,0.2)", color: "#fff", padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                    {fotosGrupo.length}/{MAX_FOTOS_POR_EQUIPO} fotos
                  </span>
                  <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.2)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: pctBarra + "%", height: "100%", background: colorBarra, borderRadius: 3 }} />
                  </div>
                </div>
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
                        {/* Select cargo editable desde galeria */}
                        <div style={{ marginBottom: 10 }}>
                          <select
                            value={editCargo[foto.id] !== undefined ? editCargo[foto.id] : (foto.cargo || foto.nombrePC || "")}
                            onChange={e => {
                              setEditCargo(p => ({ ...p, [foto.id]: e.target.value }));
                              actualizarCargo(foto, e.target.value);
                            }}
                            style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #0B3D91", borderRadius: 8, fontSize: 12, fontWeight: 600, outline: "none", background: "#eff6ff", color: "#1e3a8a" }}
                          >
                            <option value="">-- Asignar cargo --</option>
                            {cargosDisponibles.map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>
                        <div style={s.btnRow}>
                          <button onClick={() => descargarImagen(foto.downloadURL, foto.displayName || foto.originalName)}
                            style={{ ...s.btn, background: "#0B3D91", color: "#fff" }}>Descargar</button>
                          <button onClick={() => eliminarFoto(foto)}
                            style={{ ...s.btn, background: "#ef4444", color: "#fff" }}>Eliminar</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
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
