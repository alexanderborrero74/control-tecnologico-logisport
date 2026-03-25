// pages/registro-fotografico.js
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
import { db, storage } from "@/firebase/firebaseConfig";
import {
  collection, addDoc, onSnapshot, orderBy, query,
  serverTimestamp, updateDoc, deleteDoc, doc
} from "firebase/firestore";
import {
  ref, uploadBytes, uploadBytesResumable, getDownloadURL, deleteObject
} from "firebase/storage";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import LayoutWithSidebar from "@/components/LayoutWithSidebar";
import PageHeader from "@/components/PageHeader";
import ImagenSegura from "@/components/ImagenSegura";

const safeName = (name) => (name || "").replace(/[^a-zA-Z0-9._-]/g, "_");

export default function RegistroFotografico() {
  const router = useRouter();

  const [usuario, setUsuario] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [fotos, setFotos] = useState([]);
  const [subiendo, setSubiendo] = useState({});
  const [renombres, setRenombres] = useState({});
  const [filtro, setFiltro] = useState("");
  const [nombreNuevaFoto, setNombreNuevaFoto] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
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

  const colRef = useMemo(() => collection(db, "registroFotografico"), []);

  // Suscripción Firestore
  useEffect(() => {
    if (!usuario) return;
    const q = query(colRef, orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setFotos(rows);
      },
      (err) => {
        console.error("Firestore onSnapshot error:", err);
        setError("No se pudieron cargar las fotos.");
      }
    );
    return () => unsub();
  }, [colRef, usuario]);

  // Seleccionar archivos (sin subir aún)
  const handleSeleccionarArchivos = (e) => {
    const archivos = Array.from(e.target.files || []);

    if (!usuario) {
      setError("⚠️ Debes estar autenticado para subir fotos.");
      return;
    }
    setError("");
    
    const archivosValidos = archivos.filter(archivo => archivo.type.startsWith("image/"));
    setArchivosPendientes(archivosValidos);
    
    if (archivosValidos.length > 0) {
      setMensaje(`✅ ${archivosValidos.length} archivo(s) listo(s) para subir.`);
      setTimeout(() => setMensaje(""), 3000);
    } else {
      setError("⚠️ No se seleccionaron imágenes válidas.");
    }
  };
  
  // Subir archivos pendientes
  const handleSubirFotos = async () => {
    if (!archivosPendientes.length) {
      setError("⚠️ No hay archivos seleccionados para subir.");
      return;
    }
    
    setError("");
    setMensaje("");
    
    console.log('🔵 [DEBUG] Iniciando subida de', archivosPendientes.length, 'archivos');

    archivosPendientes.forEach(async (archivo, idx) => {
      const tempKey = `upload_${Date.now()}_${idx}`;
      
      setSubiendo((p) => ({ ...p, [tempKey]: 0 }));
      
      try {
        console.log('🔵 [DEBUG] Subiendo archivo vía servidor...');
        
        // Crear FormData
        const formData = new FormData();
        formData.append('file', archivo);
        
        setSubiendo((p) => ({ ...p, [tempKey]: 25 }));
        
        // Subir vía endpoint del servidor
        const response = await fetch('/api/upload-image', {
          method: 'POST',
          body: formData,
        });
        
        setSubiendo((p) => ({ ...p, [tempKey]: 50 }));
        
        if (!response.ok) {
          throw new Error('Error en la subida');
        }
        
        const data = await response.json();
        console.log('✅ [DEBUG] Subida completada:', data);
        
        setSubiendo((p) => ({ ...p, [tempKey]: 75 }));
        
        const nombreFinal = nombreNuevaFoto.trim() || archivo.name;
        console.log('🔵 [DEBUG] Guardando metadata en Firestore...');
        await addDoc(colRef, {
          displayName: nombreFinal,
          originalName: archivo.name,
          path: data.url, // La URL es el path
          downloadURL: data.url,
          type: archivo.type,
          size: archivo.size,
          createdAt: serverTimestamp(),
          uid: usuario.uid,
          email: usuario.email,
        });
        
        setSubiendo((p) => ({ ...p, [tempKey]: 100 }));
        setMensaje("✅ Imagen subida correctamente");
        setTimeout(() => {
          setMensaje("");
          setSubiendo((p) => { const c = { ...p }; delete c[tempKey]; return c; });
        }, 2500);
      } catch (err) {
        console.error('❌ [DEBUG] Error subida:', err);
        setError(`No se pudo subir la imagen: ${err.message}`);
        setSubiendo((p) => { const c = { ...p }; delete c[tempKey]; return c; });
      }
    });
    
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
    } catch (e) {
      setError("No se pudo actualizar el nombre.");
    } finally {
      setRenombres((p) => ({ ...p, [foto.id]: "" }));
    }
  };

  // Eliminar
  const eliminarFoto = async (foto) => {
    if (!confirm(`¿Eliminar la foto "${foto.displayName || foto.originalName}"?`)) return;
    try {
      await deleteObject(ref(storage, foto.path));
    } catch (err) {
      console.error("Error eliminando archivo:", err);
    }
    try {
      await deleteDoc(doc(db, "registroFotografico", foto.id));
      setMensaje("🗑️ Foto eliminada");
      setTimeout(() => setMensaje(""), 2000);
    } catch (e) {
      setError("No se pudo eliminar el registro.");
    }
  };

  // Descargar
  const descargarImagen = (url, nombre) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = nombre || "foto";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Filtro
  const fotosFiltradas = useMemo(() => {
    const term = filtro.trim().toLowerCase();
    if (!term) return fotos;
    return fotos.filter(
      (f) =>
        (f.displayName || "").toLowerCase().includes(term) ||
        (f.originalName || "").toLowerCase().includes(term)
    );
  }, [filtro, fotos]);

  // Estilos modernos
  const styles = {
    container: { padding: "32px 24px", maxWidth: "1400px", margin: "0 auto" },
    uploadSection: { 
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", 
      padding: "32px", 
      borderRadius: 20, 
      marginBottom: 32,
      boxShadow: "0 20px 60px rgba(102, 126, 234, 0.3)"
    },
    uploadTitle: {
      color: "#fff",
      fontSize: 20,
      fontWeight: 700,
      marginBottom: 20,
      display: "flex",
      alignItems: "center",
      gap: 12
    },
    uploadGrid: { display: "grid", gridTemplateColumns: "1.5fr 1fr auto", gap: 16, alignItems: "end" },
    inputGroup: { display: "flex", flexDirection: "column", gap: 8 },
    label: { color: "#fff", fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" },
    input: { 
      padding: "14px 18px", 
      border: "none", 
      borderRadius: 12, 
      fontSize: 15,
      background: "#fff",
      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
      transition: "all 0.3s ease"
    },
    btnGuardar: { 
      padding: "16px 40px", 
      background: "#10b981", 
      color: "#fff", 
      border: 0, 
      borderRadius: 12, 
      cursor: "pointer",
      fontSize: 16,
      fontWeight: 700,
      boxShadow: "0 6px 20px rgba(16, 185, 129, 0.4)",
      transition: "all 0.3s ease",
      display: "flex",
      alignItems: "center",
      gap: 8,
      whiteSpace: "nowrap"
    },
    filterSection: {
      background: "#fff",
      padding: 24,
      borderRadius: 16,
      marginBottom: 32,
      boxShadow: "0 4px 16px rgba(0,0,0,0.06)"
    },
    filterInput: {
      width: "100%",
      padding: "14px 20px 14px 48px",
      border: "2px solid #e5e7eb",
      borderRadius: 12,
      fontSize: 15,
      transition: "all 0.3s ease",
      background: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cpath d='m21 21-4.35-4.35'/%3E%3C/svg%3E\") no-repeat 16px center"
    },
    grid: { 
      display: "grid", 
      gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", 
      gap: 24,
      marginTop: 24
    },
    card: { 
      borderRadius: 16, 
      boxShadow: "0 4px 16px rgba(0,0,0,0.08)", 
      background: "#fff",
      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      overflow: "hidden"
    },
    thumbWrap: { 
      position: "relative", 
      width: "100%", 
      paddingBottom: "75%", 
      overflow: "hidden",
      background: "linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)"
    },
    img: { 
      position: "absolute", 
      inset: 0, 
      width: "100%", 
      height: "100%", 
      objectFit: "cover",
      transition: "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)"
    },
    cardBody: { padding: 20 },
    row: { display: "flex", gap: 8, alignItems: "center", marginBottom: 12 },
    textInput: { 
      flex: 1, 
      padding: "12px 16px", 
      border: "2px solid #e5e7eb", 
      borderRadius: 10,
      fontSize: 14,
      transition: "all 0.3s ease",
      fontWeight: 500
    },
    btnIcon: {
      width: 40,
      height: 40,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      border: 0,
      borderRadius: 10,
      cursor: "pointer",
      fontSize: 18,
      transition: "all 0.3s ease",
      background: "#10b981",
      color: "#fff"
    },
    btnRow: { display: "flex", gap: 8 },
    btn: { 
      flex: 1, 
      padding: "12px 16px", 
      border: 0, 
      borderRadius: 10, 
      cursor: "pointer",
      fontWeight: 600,
      fontSize: 14,
      transition: "all 0.3s ease",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 6
    },
    btnPrimary: { background: "#3b82f6", color: "#fff" },
    btnDanger: { background: "#ef4444", color: "#fff" },
    progressWrap: { 
      background: "#fff",
      padding: 24,
      borderRadius: 16,
      marginBottom: 24,
      boxShadow: "0 4px 16px rgba(0,0,0,0.06)"
    },
    barBg: { height: 8, background: "#e5e7eb", borderRadius: 8, overflow: "hidden" },
    bar: (pct) => ({ 
      width: `${pct}%`, 
      height: "100%", 
      background: "linear-gradient(90deg, #667eea 0%, #764ba2 100%)",
      transition: "width 0.3s ease"
    }),
    meta: { fontSize: 12, color: "#9ca3af", marginTop: 12, fontWeight: 500 },
    alertOk: { 
      background: "#d1fae5", 
      border: "2px solid #10b981", 
      color: "#065f46", 
      padding: "14px 20px", 
      borderRadius: 12, 
      marginBottom: 20, 
      fontSize: 14,
      fontWeight: 600,
      display: "flex",
      alignItems: "center",
      gap: 10
    },
    alertErr: { 
      background: "#fee2e2", 
      border: "2px solid #ef4444", 
      color: "#991b1b", 
      padding: "14px 20px", 
      borderRadius: 12, 
      marginBottom: 20, 
      fontSize: 14,
      fontWeight: 600,
      display: "flex",
      alignItems: "center",
      gap: 10
    },
    contador: {
      textAlign: "center",
      fontSize: 18,
      color: "#6b7280",
      marginBottom: 8,
      fontWeight: 700
    },
    emptyState: {
      textAlign: "center",
      padding: "80px 20px",
      color: "#9ca3af"
    }
  };

  if (checkingAuth) return <div style={{ padding: 24 }}>Verificando autenticación...</div>;
  if (!usuario) {
    return (
      <LayoutWithSidebar>
        <div style={{ padding: 24 }}>
          <div style={styles.alertErr}>
            ⚠️ Debes iniciar sesión para acceder a esta página.
          </div>
          <button onClick={() => router.push("/login")} style={{...styles.btn, ...styles.btnPrimary, maxWidth: 200}}>
            Ir a Login
          </button>
        </div>
      </LayoutWithSidebar>
    );
  }

  return (
    <LayoutWithSidebar>
      <PageHeader titulo="Registro Fotográfico" />
      <div style={styles.container}>
        
        {mensaje ? (
          <div style={styles.alertOk}>
            <span>✅</span> {mensaje}
          </div>
        ) : null}
        {error ? (
          <div style={styles.alertErr}>
            <span>❌</span> {error}
          </div>
        ) : null}

        {/* Sección de subida */}
        <div style={styles.uploadSection}>
          <div style={styles.uploadTitle}>
            📸 <span>Subir nuevas fotos</span>
          </div>
          
          <div style={styles.uploadGrid}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Seleccionar imágenes</label>
              <input 
                ref={inputRef} 
                type="file" 
                accept="image/*" 
                multiple 
                onChange={handleSeleccionarArchivos}
                style={styles.input}
              />
            </div>
            
            <div style={styles.inputGroup}>
              <label style={styles.label}>Nombre (opcional)</label>
              <input
                type="text"
                value={nombreNuevaFoto}
                onChange={(e) => setNombreNuevaFoto(e.target.value)}
                placeholder="Ej: Evidencia proyecto..."
                style={styles.input}
              />
            </div>

            <button 
              onClick={handleSubirFotos} 
              disabled={archivosPendientes.length === 0 || Object.keys(subiendo).length > 0}
              style={{
                ...styles.btnGuardar,
                background: archivosPendientes.length > 0 ? "#10b981" : "#9ca3af",
                cursor: archivosPendientes.length > 0 ? "pointer" : "not-allowed",
                opacity: archivosPendientes.length > 0 ? 1 : 0.6
              }}
            >
              <span style={{ fontSize: 20 }}>💾</span>
              <span>{Object.keys(subiendo).length > 0 ? "Subiendo..." : `GUARDAR (${archivosPendientes.length})`}</span>
            </button>
          </div>
        </div>

        {/* Progreso */}
        {Object.keys(subiendo).length > 0 && (
          <div style={styles.progressWrap}>
            {Object.entries(subiendo).map(([ruta, pct]) => (
              <div key={ruta} style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 14, fontWeight: 600 }}>
                  <span>{ruta.split("/").slice(-1)[0]}</span>
                  <span style={{ color: "#667eea" }}>{pct}%</span>
                </div>
                <div style={styles.barBg}>
                  <div style={styles.bar(pct)} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Filtro */}
        <div style={styles.filterSection}>
          <input
            type="text"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Buscar fotos por nombre..."
            style={styles.filterInput}
          />
        </div>

        {/* Contador */}
        <div style={styles.contador}>
          {fotosFiltradas.length} {fotosFiltradas.length === 1 ? "foto" : "fotos"}
        </div>

        {/* Grid */}
        {fotosFiltradas.length > 0 ? (
          <div style={styles.grid}>
            {fotosFiltradas.map((foto) => (
              <div key={foto.id} style={styles.card}>
                <div style={styles.thumbWrap}>
                  <ImagenSegura 
                    url={foto.downloadURL} 
                    alt={foto.displayName || foto.originalName || "Foto"} 
                    style={styles.img} 
                  />
                </div>
                
                <div style={styles.cardBody}>
                  <div style={styles.row}>
                    <input
                      type="text"
                      value={renombres[foto.id] ?? foto.displayName ?? foto.originalName ?? ""}
                      onChange={(e) => setRenombres((p) => ({ ...p, [foto.id]: e.target.value }))}
                      style={styles.textInput}
                      placeholder="Nombre de la foto"
                    />
                    <button 
                      onClick={() => actualizarNombre(foto)} 
                      style={styles.btnIcon}
                      title="Guardar nombre"
                    >
                      💾
                    </button>
                  </div>
                  
                  <div style={styles.btnRow}>
                    <button
                      onClick={() => descargarImagen(foto.downloadURL, (foto.displayName || foto.originalName || "foto"))}
                      style={{...styles.btn, ...styles.btnPrimary}}
                    >
                      <span>⬇️</span> Descargar
                    </button>
                    <button 
                      onClick={() => eliminarFoto(foto)} 
                      style={{...styles.btn, ...styles.btnDanger}}
                    >
                      <span>🗑️</span> Eliminar
                    </button>
                  </div>
                  
                  {foto.originalName !== foto.displayName && (
                    <div style={styles.meta}>
                      Original: {foto.originalName}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={styles.emptyState}>
            <div style={{ fontSize: 64, marginBottom: 20 }}>📷</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: "#6b7280" }}>
              No hay fotos para mostrar
            </div>
            <div style={{ fontSize: 15 }}>
              {filtro ? "No se encontraron fotos con ese nombre" : "Sube tu primera imagen usando el formulario de arriba"}
            </div>
          </div>
        )}
      </div>
    </LayoutWithSidebar>
  );
}
