// pages/registro-fotografico.js
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
import { app, db, storage } from "@/firebase/firebaseConfig";
import {
  collection, addDoc, onSnapshot, orderBy, query,
  serverTimestamp, updateDoc, deleteDoc, doc,
  getDocs, where
} from "firebase/firestore";
import {
  ref, uploadBytesResumable, getDownloadURL, deleteObject,
  listAll, getMetadata
} from "firebase/storage";
import { getAuth, onAuthStateChanged } from "firebase/auth";

const cleanPrefix = (p) => (p || "").replace(/^\/+|\/+$/g, "");
const safeName = (name) => (name || "").replace(/[^a-zA-Z0-9._-]/g, "_");

export default function RegistroFotografico() {
  const router = useRouter();

  const [usuario, setUsuario] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [fotos, setFotos] = useState([]);
  const [subiendo, setSubiendo] = useState({});
  const [renombres, setRenombres] = useState({});
  const [filtro, setFiltro] = useState("");

  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [estado, setEstado] = useState([]);
  const [seleccionInfo, setSeleccionInfo] = useState({ total: 0 });

  const [prefix, setPrefix] = useState(""); // raíz por defecto
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ done: 0, total: 0, created: 0, skipped: 0 });

  const [singlePath, setSinglePath] = useState("");

  // Diagnóstico de bucket
  const [bucketUrl, setBucketUrl] = useState("");
  const [bucketFromConfig, setBucketFromConfig] = useState("");
  const [bucketFromEnv, setBucketFromEnv] = useState("");

  const inputRef = useRef(null);

  const pushEstado = (txt) => {
    console.log("[REG-FOTO]", txt);
    setEstado((prev) => [txt, ...prev].slice(0, 60));
  };

  // Mostrar bucket real y config
  useEffect(() => {
    try {
      const root = ref(storage);
      setBucketUrl(root.toString()); // ej: "gs://sidecomex-a82d0.appspot.com/"
      // valor del config por defecto (si no usas override)
      setBucketFromConfig(app?.options?.storageBucket || "(no-definido)");
      // lo que venga de .env por si está seteado
      setBucketFromEnv(process.env.NEXT_PUBLIC_STORAGE_BUCKET_URL || "(no-definido)");
      pushEstado(`Bucket en uso por el SDK: ${root.toString()}`);
      pushEstado(`storageBucket (config): ${app?.options?.storageBucket}`);
      pushEstado(`NEXT_PUBLIC_STORAGE_BUCKET_URL: ${process.env.NEXT_PUBLIC_STORAGE_BUCKET_URL || "(no-definido)"}`);
    } catch {}
  }, []);

  // Auth
  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (u) => {
      setUsuario(u || null);
      setCheckingAuth(false);
      pushEstado(u ? `Autenticado: ${u.email}` : "Sin sesión");
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
        pushEstado(`Cargadas ${rows.length} fotos desde Firestore`);
      },
      (err) => {
        console.error("Firestore onSnapshot error:", err);
        setError("No se pudieron cargar las fotos (reglas de Firestore o conexión).");
        pushEstado(`ERROR Firestore onSnapshot: ${err?.message || err}`);
      }
    );
    return () => unsub();
  }, [colRef, usuario]);

  // Subir
  const handleCargarFotos = (e) => {
    const archivos = Array.from(e.target.files || []);
    setSeleccionInfo({ total: archivos.length });
    pushEstado(`onChange: ${archivos.length} archivo(s) seleccionado(s)`);

    if (!usuario) {
      setError("⚠️ Debes estar autenticado para subir fotos.");
      pushEstado("Bloqueado: no hay usuario autenticado");
      return;
    }
    setError("");
    if (!archivos.length) return;

    const basePrefix = cleanPrefix(prefix); // "" = raíz
    archivos.forEach((archivo, idx) => {
      if (!archivo.type.startsWith("image/")) {
        pushEstado(`Saltado no-imagen: ${archivo.name} (${archivo.type})`);
        return;
      }

      const carpeta = new Date().toISOString().slice(0, 10); // yyyy-mm-dd
      const ruta = basePrefix
        ? `${basePrefix}/${carpeta}/${Date.now()}_${idx}_${safeName(archivo.name)}`
        : `${carpeta}/${Date.now()}_${idx}_${safeName(archivo.name)}`;

      const storageRef = ref(storage, ruta);
      const uploadTask = uploadBytesResumable(storageRef, archivo, { contentType: archivo.type });

      setSubiendo((p) => ({ ...p, [ruta]: 0 }));
      pushEstado(`Iniciando subida: ${ruta}`);

      uploadTask.on(
        "state_changed",
        (snap) => {
          const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
          setSubiendo((p) => ({ ...p, [ruta]: pct }));
          if (pct === 0 || pct === 100 || pct % 10 === 0) pushEstado(`Progreso ${ruta}: ${pct}%`);
        },
        (err) => {
          const msg = parseStorageError(err, pushEstado);
          setError(`No se pudo subir la imagen: ${msg}`);
          pushEstado(`ERROR subida ${ruta}: ${msg}`);
          setSubiendo((p) => { const c = { ...p }; delete c[ruta]; return c; });
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            await addDoc(colRef, {
              displayName: archivo.name,
              originalName: archivo.name,
              path: ruta,
              downloadURL,
              type: archivo.type,
              size: archivo.size,
              createdAt: serverTimestamp(),
              uid: usuario.uid,
              email: usuario.email,
            });
            setMensaje("✅ Imagen subida");
            setTimeout(() => setMensaje(""), 2500);
            pushEstado(`Metadatos guardados en Firestore: ${ruta}`);
          } catch (e2) {
            setError("La imagen subió, pero no se guardaron los metadatos (Firestore).");
            pushEstado(`ERROR addDoc Firestore: ${e2?.message || e2}`);
          } finally {
            setSubiendo((p) => { const c = { ...p }; delete c[ruta]; return c; });
          }
        }
      );
    });

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
      pushEstado(`Nombre actualizado para doc ${foto.id}: ${nuevo}`);
    } catch (e) {
      setError("No se pudo actualizar el nombre (permisos/reglas).");
      pushEstado(`ERROR updateDoc: ${e?.message || e}`);
    } finally {
      setRenombres((p) => ({ ...p, [foto.id]: "" }));
    }
  };

  // Eliminar
  const eliminarFoto = async (foto) => {
    if (!confirm(`¿Eliminar la foto "${foto.displayName || foto.originalName}"?`)) return;
    try {
      await deleteObject(ref(storage, foto.path));
      pushEstado(`Borrada en Storage: ${foto.path}`);
    } catch (err) {
      pushEstado(`WARN deleteObject: ${err?.message || err}`);
    }
    try {
      await deleteDoc(doc(db, "registroFotografico", foto.id));
      setMensaje("🗑️ Foto eliminada");
      setTimeout(() => setMensaje(""), 2000);
      pushEstado(`Borrado doc Firestore: ${foto.id}`);
    } catch (e) {
      setError("No se pudo eliminar el registro en Firestore.");
      pushEstado(`ERROR deleteDoc: ${e?.message || e}`);
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
    pushEstado(`Descarga solicitada: ${nombre || "foto"}`);
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

  // Listar recursivo
  const listAllRecursive = async (dirRef) => {
    const result = await listAll(dirRef);
    let items = [...result.items];
    for (const folderRef of result.prefixes) {
      const nested = await listAllRecursive(folderRef);
      items = items.concat(nested);
    }
    return items;
  };

  // Sincronizar Storage -> Firestore
  const syncFromStorage = async () => {
    if (!usuario) { setError("⚠️ Debes estar autenticado para sincronizar."); return; }
    setError(""); setMensaje("");
    setSyncing(true); setSyncProgress({ done: 0, total: 0, created: 0, skipped: 0 });

    try {
      const P = cleanPrefix(prefix); // "" = raíz
      const rootRef = P ? ref(storage, P) : ref(storage);
      pushEstado(`Sincronizando desde carpeta: "${P || "(raíz)"}"`);

      const allItems = await listAllRecursive(rootRef);
      setSyncProgress((s) => ({ ...s, total: allItems.length }));
      pushEstado(`Encontrados ${allItems.length} archivo(s) en Storage en "${P || "/"}"`);

      let created = 0, skipped = 0, done = 0;

      for (const itemRef of allItems) {
        try {
          const fullPath = itemRef.fullPath; // ej. "piscina.png" (raíz)
          const snap = await getDocs(query(colRef, where("path", "==", fullPath)));
          if (!snap.empty) { skipped++; done++; setSyncProgress({ done, total: allItems.length, created, skipped }); continue; }

          const meta = await getMetadata(itemRef);
          const url = await getDownloadURL(itemRef);

          await addDoc(colRef, {
            displayName: meta.name,
            originalName: meta.name,
            path: fullPath,
            downloadURL: url,
            type: meta.contentType || "image/*",
            size: meta.size || 0,
            createdAt: serverTimestamp(),
            uploadedAt: meta.timeCreated ? new Date(meta.timeCreated) : new Date(),
            uid: usuario.uid,
            email: usuario.email,
          });

          created++; done++;
          setSyncProgress({ done, total: allItems.length, created, skipped });
          pushEstado(`Backfill creado: ${fullPath}`);
        } catch (eEach) {
          const msg = parseStorageError(eEach, pushEstado);
          pushEstado(`ERROR backfill: ${msg}`);
          done++;
          setSyncProgress((s) => ({ ...s, done }));
        }
      }

      setMensaje(`✅ Sincronización terminada. Nuevos: ${created}, ya existentes: ${skipped}.`);
      pushEstado("Sincronización completada.");
    } catch (e) {
      const msg = parseStorageError(e, pushEstado);
      setError(`❌ No se pudo sincronizar: ${msg}`);
      pushEstado(`ERROR sincronizando: ${msg}`);
    } finally {
      setSyncing(false);
    }
  };

  // Importar por ruta exacta (ej. "piscina.png")
  const [singleLoading, setSingleLoading] = useState(false);
  const importByPath = async () => {
    const path = (singlePath || "").trim().replace(/^\/+/, "");
    if (!path) { setError("Escribe una ruta. Ej: piscina.png"); return; }
    setError(""); setMensaje(""); setSingleLoading(true);
    pushEstado(`Importando ruta exacta: "${path}"`);

    try {
      const snap = await getDocs(query(colRef, where("path", "==", path)));
      if (!snap.empty) {
        setMensaje("ℹ️ Ya existía un documento con esa ruta.");
        pushEstado("Ruta ya existente en Firestore (omitido).");
        setSingleLoading(false);
        return;
      }

      const r = ref(storage, path);
      const meta = await getMetadata(r); // aquí verás permisos/ruta inválida
      const url = await getDownloadURL(r);

      await addDoc(colRef, {
        displayName: meta.name,
        originalName: meta.name,
        path,
        downloadURL: url,
        type: meta.contentType || "image/*",
        size: meta.size || 0,
        createdAt: serverTimestamp(),
        uploadedAt: meta.timeCreated ? new Date(meta.timeCreated) : new Date(),
        uid: usuario.uid,
        email: usuario.email,
      });

      setMensaje("✅ Documento creado desde ruta exacta");
      pushEstado(`Backfill por ruta creado: ${path}`);
      setSinglePath("");
    } catch (e) {
      const msg = parseStorageError(e, pushEstado);
      setError(`No se pudo importar por ruta: ${msg}`);
      pushEstado(`ERROR importByPath: ${msg}`);
    } finally {
      setSingleLoading(false);
    }
  };

  // Estilos
  const styles = {
    container: { padding: "24px", maxWidth: 1200, margin: "0 auto" },
    title: { fontSize: 24, fontWeight: "bold", marginBottom: 12 },
    toolbar: { display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 16 },
    inputText: { padding: 8, border: "1px solid #ccc", borderRadius: 6 },
    backBtn: { padding: "8px 14px", border: 0, borderRadius: 6, background: "#4e73df", color: "#fff", cursor: "pointer" },
    grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 },
    card: { border: "1px solid #ddd", borderRadius: 10, padding: 12, boxShadow: "0 2px 6px rgba(0,0,0,0.06)", background: "#fff" },
    thumbWrap: { position: "relative", width: "100%", paddingBottom: "66%", overflow: "hidden", borderRadius: 8, marginBottom: 8 },
    img: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" },
    row: { display: "flex", gap: 8, alignItems: "center", marginBottom: 8 },
    textInput: { flex: 1, padding: 8, border: "1px solid #ccc", borderRadius: 6 },
    btnPrimary: { flex: 1, padding: "8px 10px", background: "#4e73df", color: "#fff", border: 0, borderRadius: 6, cursor: "pointer" },
    btnSuccess: { padding: "8px 10px", background: "#1cc88a", color: "#fff", border: 0, borderRadius: 6, cursor: "pointer" },
    btnDanger: { flex: 1, padding: "8px 10px", background: "#e74a3b", color: "#fff", border: 0, borderRadius: 6, cursor: "pointer" },
    smallBtn: { padding: "6px 10px", borderRadius: 6, border: 0, background: "#1cc88a", color: "#fff", cursor: "pointer" },
    progressWrap: { marginBottom: 12 },
    barBg: { height: 6, background: "#eee", borderRadius: 4 },
    bar: (pct) => ({ width: `${pct}%`, height: 6, borderRadius: 4, background: "#4e73df" }),
    meta: { marginTop: 8, fontSize: 12, color: "#666" },
    alertOk: { background: "#e6fff3", border: "1px solid #1cc88a", color: "#155e4d", padding: "8px 12px", borderRadius: 6, marginBottom: 10, fontSize: 14 },
    alertErr: { background: "#fff0f0", border: "1px solid #e74a3b", color: "#8a1f17", padding: "8px 12px", borderRadius: 6, marginBottom: 10, fontSize: 14 },
    estado: { background: "#f7f7f7", border: "1px solid #ddd", padding: 10, borderRadius: 8, fontSize: 12, color: "#444" },
    smallNote: { fontSize: 12, color: "#666" },
    inputPrefix: { padding: 8, border: "1px solid #ccc", borderRadius: 6, minWidth: 220 },
  };

  if (checkingAuth) return <div style={{ padding: 24 }}>Verificando autenticación...</div>;
  if (!usuario) {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={styles.title}>REGISTRO FOTOGRÁFICO</h1>
        <div style={styles.alertErr}>⚠️ Debes iniciar sesión para acceder a esta página.</div>
        <button onClick={() => router.push("/login")} style={styles.backBtn}>Ir a Login</button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>REGISTRO FOTOGRÁFICO</h1>
      {mensaje ? <div style={styles.alertOk}>{mensaje}</div> : null}
      {error ? <div style={styles.alertErr}>{error}</div> : null}

      <div style={styles.toolbar}>
        <input ref={inputRef} type="file" accept="image/*" multiple onChange={handleCargarFotos} />
        <span style={styles.smallNote}>
          {seleccionInfo.total > 0 ? `Seleccionaste ${seleccionInfo.total} archivo(s)` : "Sin archivos seleccionados"}
        </span>

        {/* Prefijo/carpeta para sincronizar (vacío = raíz) */}
        <input
          type="text"
          value={prefix}
          onChange={(e) => setPrefix(e.target.value)}
          placeholder="Carpeta en Storage (vacío = raíz)"
          style={styles.inputPrefix}
        />
        <button onClick={syncFromStorage} disabled={syncing} style={styles.smallBtn}>
          {syncing ? `Sincronizando… (${syncProgress.done}/${syncProgress.total})` : "Sincronizar desde Storage"}
        </button>

        {/* Importar por ruta exacta */}
        <input
          type="text"
          value={singlePath}
          onChange={(e) => setSinglePath(e.target.value)}
          placeholder="Ruta exacta (ej: piscina.png)"
          style={styles.inputPrefix}
        />
        <button onClick={importByPath} disabled={singleLoading} style={styles.smallBtn}>
          {singleLoading ? "Importando…" : "Importar por ruta"}
        </button>

        <button onClick={() => router.push("/")} style={styles.backBtn}>Regresar</button>
      </div>

      {/* Progreso de cargas */}
      {Object.keys(subiendo).length > 0 && (
        <div style={styles.progressWrap}>
          {Object.entries(subiendo).map(([ruta, pct]) => (
            <div key={ruta} style={{ marginBottom: 6, fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{ruta.split("/").slice(-1)[0]}</span>
                <span>{pct}%</span>
              </div>
              <div style={styles.barBg}>
                <div style={styles.bar(pct)} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Panel estado */}
      <div style={{ marginBottom: 16 }}>
        <div style={styles.estado}>
          <div style={{ fontWeight: "bold", marginBottom: 6 }}>Estado</div>
          <div>Usuario: {usuario?.email}</div>
          <div>Bucket en uso (SDK): <code>{bucketUrl || "(?)"}</code></div>
          <div>storageBucket (config): <code>{bucketFromConfig || "(?)"}</code></div>
          <div>NEXT_PUBLIC_STORAGE_BUCKET_URL: <code>{bucketFromEnv || "(no-definido)"}</code></div>
          <div>Prefijo para sincronizar: <code>{cleanPrefix(prefix) || "(raíz)"}</code></div>
          {syncing ? (
            <div style={{ marginTop: 6 }}>
              Progreso sync: {syncProgress.done}/{syncProgress.total} — nuevos: {syncProgress.created}, omitidos: {syncProgress.skipped}
            </div>
          ) : null}
          <ul style={{ marginTop: 8 }}>
            {estado.map((line, i) => (<li key={i}>• {line}</li>))}
          </ul>
        </div>
      </div>

      {/* Grid */}
      <div style={styles.grid}>
        {fotosFiltradas.map((foto) => (
          <div key={foto.id} style={styles.card}>
            <div style={styles.thumbWrap}>
             <img
  src="/nexoti-logo.svg?v=1"
  alt="NexoTI"
  style={{ height: 56, width: "auto", objectFit: "contain" }}
/>

            </div>
            <div style={styles.row}>
              <input
                type="text"
                value={renombres[foto.id] ?? foto.displayName ?? foto.originalName ?? ""}
                onChange={(e) => setRenombres((p) => ({ ...p, [foto.id]: e.target.value }))}
                style={styles.textInput}
              />
              <button onClick={() => actualizarNombre(foto)} style={styles.btnSuccess}>Guardar</button>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => descargarImagen(
                  foto.downloadURL,
                  (foto.displayName || foto.originalName || "foto")
                )}
                style={styles.btnPrimary}
              >
                Descargar
              </button>
              <button onClick={() => eliminarFoto(foto)} style={styles.btnDanger}>Eliminar</button>
            </div>
            <div style={styles.meta}>Original: {foto.originalName}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function parseStorageError(err, pushEstado) {
  const code = err?.code || "";
  let serverMsg = "";
  try {
    const raw = err?.customData?.serverResponse;
    if (raw) {
      pushEstado?.(`ServerResponse RAW: ${raw.slice(0, 200)}${raw.length > 200 ? "…" : ""}`);
      const parsed = JSON.parse(raw);
      if (parsed?.error?.message) serverMsg = parsed.error.message; // p.ej. "PERMISSION_DENIED" / "APP_CHECK_TOKEN_REQUIRED" / etc.
    }
  } catch {}
  const text = [serverMsg, err?.message].filter(Boolean).join(" | ");

  if (/APP_CHECK/i.test(text)) return "App Check está bloqueando la solicitud (enforcement activo sin token).";
  if (/PERMISSION|UNAUTHORIZED|403/i.test(text) || /unauthorized|permission|403/i.test(code)) return "Permisos/reglas de Storage no permiten esta operación.";
  if (/notFound|No such object|bucket/i.test(text)) return "Bucket o ruta no existe (verifica el bucket y la ruta).";
  if (/CORS/i.test(text)) return "CORS bloqueado en el navegador.";
  if (/deadline|timeout|retry/i.test(text)) return "Se agotaron reintentos (red o bloqueo de servicio).";

  return text || "Error desconocido";
}
