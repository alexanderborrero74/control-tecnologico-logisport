// pages/capsulas-admin.js
import { useEffect, useRef, useState } from "react";
import {
  collection,
  onSnapshot,
  addDoc,
  serverTimestamp,
  deleteDoc,
  doc,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";
import { useRouter } from "next/router";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getUserRoleByUid } from "@/utils/getUserRole";

// ------------------------------
// Config
// ------------------------------
const DEFAULT_FIELD_CANDIDATES = [
  "mensaje",
  "mensajeCapsula",
  "texto",
  "text",
  "body",
  "contenido",
  "description",
  "mensaje1",
  "msg",
  "detalle",
  "detalles",
  "descripcion",
  "title",
  "titulo",
  "content",
  "notes",
];

const PERIOD_MS = 50_000;  // cada cuánto mostramos una nueva cápsula
const DISPLAY_MS = 12_000; // cuánto tiempo permanece visible

// Extrae texto “mostrable”
function extractTextFromDoc(data, preferredFieldName = "", candidates = DEFAULT_FIELD_CANDIDATES) {
  if (preferredFieldName) {
    const v = data?.[preferredFieldName];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (v != null && v.toString && v.toString().trim()) return v.toString().trim();
  }
  for (const k of candidates) {
    const v = data?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  for (const [, v] of Object.entries(data || {})) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ------------------------------
// Emergente
// ------------------------------
function CapsulasEmergentesInner({
  collectionName = "capsulas",
  fieldCandidates = DEFAULT_FIELD_CANDIDATES,
  preferredFieldName = "",
  debug = false,
}) {
  const [visible, setVisible] = useState(false);
  const [msg, setMsg] = useState("");
  const [status, setStatus] = useState("");

  const usableRef = useRef([]);        // [{id, text}]
  const orderRef = useRef([]);         // orden barajado de índices
  const orderPosRef = useRef(0);       // posición actual en el orden
  const hideTimerRef = useRef(null);   // timeout para ocultar
  const nextTimerRef = useRef(null);   // timeout para la siguiente
  const lastIdRef = useRef("");        // última cápsula mostrada

  const clearHide = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };
  const clearNext = () => {
    if (nextTimerRef.current) {
      clearTimeout(nextTimerRef.current);
      nextTimerRef.current = null;
    }
  };

  const ensureOrder = () => {
    const n = usableRef.current.length;
    if (n === 0) {
      orderRef.current = [];
      orderPosRef.current = 0;
      return;
    }
    if (!orderRef.current.length || orderPosRef.current >= orderRef.current.length) {
      const base = shuffle([...Array(n).keys()]);
      if (n > 1 && lastIdRef.current) {
        const firstIdx = base[0];
        const firstId = usableRef.current[firstIdx]?.id;
        if (firstId === lastIdRef.current) {
          const swapWith = Math.floor(Math.random() * (n - 1)) + 1; // 1..n-1
          [base[0], base[swapWith]] = [base[swapWith], base[0]];
        }
      }
      orderRef.current = base;
      orderPosRef.current = 0;
    }
  };

  const showNext = () => {
    clearHide();
    clearNext();

    const list = usableRef.current;
    if (!list.length) {
      setVisible(false);
      setMsg("");
      if (debug) setStatus(`No hay cápsulas con texto utilizable en «${collectionName}».`);
      return;
    }

    ensureOrder();
    const idx = orderRef.current[orderPosRef.current++];
    const chosen = list[idx];
    if (!chosen) return;

    lastIdRef.current = chosen.id;
    setMsg(chosen.text);
    setVisible(true);

    hideTimerRef.current = setTimeout(() => setVisible(false), DISPLAY_MS);
    nextTimerRef.current = setTimeout(showNext, PERIOD_MS);

    if (debug) {
      setStatus(
        `Mostrando cápsula ${lastIdRef.current}. Disponibles: ${list.length}. ` +
        `Quedan en ciclo: ${orderRef.current.length - orderPosRef.current}. ` +
        `Próxima en ${Math.round(PERIOD_MS / 1000)}s.`
      );
    }
  };

  // Suscripción
  useEffect(() => {
    const qy = query(collection(db, collectionName));
    const unsub = onSnapshot(
      qy,
      (snap) => {
        const arr = snap.docs
          .map((d) => {
            const data = d.data() || {};
            const text = extractTextFromDoc(data, preferredFieldName, fieldCandidates);
            return { id: d.id, text: String(text || "").trim() };
          })
          .filter((x) => x.text);

        usableRef.current = arr;

        if (arr.length === 0) {
          setVisible(false);
          setMsg("");
          clearHide();
          clearNext();
          if (debug) setStatus(`No hay cápsulas válidas en «${collectionName}».`);
          return;
        }

        orderRef.current = [];
        orderPosRef.current = 0;
        clearNext();

        // Primera aparición tras 2s (para simular exactamente el global)
        setTimeout(showNext, 2000);
      },
      (err) => {
        setVisible(false);
        setMsg("");
        clearHide();
        clearNext();
        if (debug) setStatus("Error leyendo cápsulas: " + (err?.message || String(err)));
      }
    );

    return () => {
      unsub();
      clearHide();
      clearNext();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName, preferredFieldName, JSON.stringify(fieldCandidates), debug]);

  const DebugPanel = () =>
    debug && status ? (
      <div
        style={{
          position: "fixed",
          bottom: 16,
          left: 16,
          background: "#eef2ff",
          color: "#1e3a8a",
          border: "1px solid #c7d2fe",
          padding: "8px 10px",
          borderRadius: 8,
          fontSize: 12,
          zIndex: 30000,
          maxWidth: 420,
          whiteSpace: "pre-wrap",
        }}
      >
        {status}
      </div>
    ) : null;

  if (!visible || !msg) return <DebugPanel />;

  return (
    <>
      <div
        style={{
          position: "fixed",
          bottom: 120,
          left: 24,
          backgroundColor: "#fffae6",
          padding: 16,
          borderRadius: 10,
          boxShadow: "0 6px 16px rgba(0,0,0,0.2)",
          zIndex: 20000,
          width: 320,           // tamaño fijo
          maxWidth: 320,
          border: "1px solid #f7c873",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ fontSize: 20, lineHeight: "20px" }}>💡</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, marginBottom: 6, color: "#7c2d12" }}>
              Ciberseguridad
            </div>
            <div style={{ fontSize: 14, color: "#1f2937", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {msg}
            </div>
          </div>
          <button
            onClick={() => {
              setVisible(false);
              clearHide();
            }}
            aria-label="Cerrar"
            title="Cerrar"
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: 16,
              lineHeight: "16px",
            }}
          >
            ×
          </button>
        </div>
      </div>
      <DebugPanel />
    </>
  );
}

// ------------------------------
// Panel Admin
// ------------------------------
function AdminPanel({ collectionName, onAfterChange }) {
  const [mensaje, setMensaje] = useState("");
  const [importLog, setImportLog] = useState("");
  const [loading, setLoading] = useState(false);
  const [caps, setCaps] = useState([]);

  useEffect(() => {
    const qy = query(collection(db, collectionName), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(qy, (snap) => {
      const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setCaps(arr);
    });
    return () => unsub();
  }, [collectionName]);

  const crearCapsula = async () => {
    const text = String(mensaje || "").trim();
    if (!text) return alert("Escribe el mensaje de la cápsula.");
    setLoading(true);
    try {
      await addDoc(collection(db, collectionName), {
        mensaje: text,
        createdAt: serverTimestamp(),
      });
      setMensaje("");
      onAfterChange?.();
    } catch (e) {
      console.error(e);
      alert("Error creando cápsula: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const eliminarCapsula = async (id) => {
    if (!confirm("¿Eliminar esta cápsula?")) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, collectionName, id));
      onAfterChange?.();
    } catch (e) {
      console.error(e);
      alert("Error eliminando cápsula: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFile = async (file) => {
    if (!file) return;
    setImportLog("Leyendo archivo...");
    const txt = await file.text();
    try {
      let rows = [];
      if (file.name.toLowerCase().endsWith(".json")) {
        const data = JSON.parse(txt);
        if (!Array.isArray(data)) throw new Error("El JSON debe ser un arreglo.");
        rows = data;
      } else {
        rows = csvToObjects(txt);
      }

      let count = 0;
      setImportLog("Importando...");
      for (const row of rows) {
        const text = pickAnyStringField(row);
        if (text) {
          await addDoc(collection(db, collectionName), {
            mensaje: text,
            createdAt: serverTimestamp(),
          });
          count++;
        }
      }
      setImportLog(`Importación completa. Insertadas: ${count}`);
      onAfterChange?.();
    } catch (e) {
      console.error(e);
      setImportLog("Error en importación: " + e.message);
    }
  };

  const csvToObjects = (source) => {
    const lines = source.split(/\r?\n/).filter(Boolean);
    if (!lines.length) return [];
    const headers = lines[0].split(",").map((h) => h.trim());
    const objs = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",");
      const o = {};
      headers.forEach((h, idx) => (o[h] = (cols[idx] ?? "").trim()));
      objs.push(o);
    }
    return objs;
  };

  const pickAnyStringField = (o) => {
    for (const k of [
      "mensaje",
      "mensajeCapsula",
      "texto",
      "text",
      "contenido",
      "description",
      "descripcion",
      "msg",
    ]) {
      const v = o?.[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    for (const [, v] of Object.entries(o || {})) {
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return "";
  };

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, marginBottom: 24 }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 12 }}>
        Panel de administración de cápsulas
      </h2>

      {/* Crear */}
      <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
        <label style={{ fontWeight: 600 }}>Nueva cápsula</label>
        <textarea
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          placeholder="Escribe el contenido de la cápsula…"
          rows={4}
          style={{ padding: 8, border: "1px solid #d1d5db", borderRadius: 8 }}
        />
        <button
          onClick={crearCapsula}
          disabled={loading}
          style={{
            alignSelf: "start",
            backgroundColor: "#16a34a",
            color: "white",
            border: "none",
            padding: "10px 16px",
            borderRadius: 8,
            cursor: "pointer",
            boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
          }}
        >
          {loading ? "Guardando..." : "Guardar cápsula"}
        </button>
      </div>

      {/* Importar */}
      <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
        <label style={{ fontWeight: 600 }}>Importar cápsulas (CSV o JSON)</label>
        <input type="file" accept=".csv,.json,text/csv,application/json" onChange={(e) => handleFile(e.target.files?.[0])} />
        <small style={{ color: "#6b7280" }}>
          CSV recomendado con encabezado <code>mensaje</code>. Ejemplo:<br />
          <code>mensaje</code><br />
          <code>Actualiza tu antivirus.</code><br />
          <code>No compartas contraseñas.</code>
        </small>
        {!!importLog && (
          <pre style={{ background: "#f9fafb", padding: 8, borderRadius: 8, whiteSpace: "pre-wrap" }}>
            {importLog}
          </pre>
        )}
      </div>

      {/* Lista / eliminar */}
      <div style={{ display: "grid", gap: 8 }}>
        <label style={{ fontWeight: 600 }}>Cápsulas existentes</label>
        {caps.length === 0 ? (
          <div style={{ color: "#6b7280" }}>No hay cápsulas aún.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {caps.map((c) => (
              <div
                key={c.id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  padding: 8,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  justifyContent: "space-between",
                }}
              >
                <div style={{ whiteSpace: "pre-wrap", color: "#111827", flex: 1 }}>
                  {c.mensaje || c.texto || c.description || c.contenido || c.msg || "(sin texto)"}
                  <div style={{ color: "#6b7280", fontSize: 12, marginTop: 4 }}>
                    {c.createdAt?.toDate?.().toLocaleString?.() || ""}
                  </div>
                </div>
                <button
                  onClick={() => eliminarCapsula(c.id)}
                  style={{
                    background: "#dc2626",
                    color: "white",
                    border: "none",
                    padding: "8px 12px",
                    borderRadius: 8,
                    cursor: "pointer",
                  }}
                >
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ------------------------------
// Página: envuelve admin + emergente
// ------------------------------
export default function CapsulasAdminPage() {
  const router = useRouter();

  // Auth + rol
  const [cargandoRol, setCargandoRol] = useState(true);
  const [rol, setRol] = useState("usuario");

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.push("/login");
        return;
      }
      try {
        const r = await getUserRoleByUid(u.uid);
        setRol(r || "usuario");
      } catch (e) {
        console.error("Error rol:", e);
        setRol("usuario");
      } finally {
        setCargandoRol(false);
      }
    });
    return () => unsub();
  }, [router]);

  // Overrides por querystring
  const colQS = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("col") : null;
  const fieldQS = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("field") : null;
  const debugQS = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("debug") : null;

  const collectionName = (colQS && colQS.trim()) || "capsulas";
  const preferredFieldName = (fieldQS && fieldQS.trim()) || "";
  const debug = debugQS === "1" || debugQS === "true";

  const [tick, setTick] = useState(0);
  const forceRefresh = () => setTick((t) => t + 1);

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>Cápsulas (admin)</h1>
      <p style={{ marginBottom: 16, color: "#374151" }}>
        Administra tus cápsulas de ciberseguridad y visualiza el emergente. Puedes forzar colección y
        campo por URL: <code>?col=miColeccion&amp;field=miCampo</code>. Depuración: <code>?debug=1</code>.
      </p>

      <div style={{ marginBottom: 16 }}>
        <button
          onClick={() => router.push("/")}
          style={{
            backgroundColor: "#2563eb",
            color: "white",
            border: "none",
            padding: "10px 16px",
            borderRadius: 8,
            cursor: "pointer",
            boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
          }}
        >
          ⬅ Regresar
        </button>
      </div>

      {/* Panel admin solo para rol admin */}
      {cargandoRol ? (
        <div style={{ color: "#6b7280", marginBottom: 16 }}>Verificando permisos…</div>
      ) : rol === "admin" ? (
        <AdminPanel collectionName={collectionName} onAfterChange={forceRefresh} />
      ) : (
        <div style={{ color: "#6b7280", marginBottom: 16 }}>
          Tu rol no es <b>admin</b>. Solo verás el emergente.
        </div>
      )}

      {/* Emergente */}
      <CapsulasEmergentesInner
        key={tick}
        collectionName={collectionName}
        preferredFieldName={preferredFieldName}
        debug={debug}
      />
    </div>
  );
}
