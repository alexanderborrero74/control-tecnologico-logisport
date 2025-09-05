// pages/control-de-contrasenas.js
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { db } from "@/firebase/firebaseConfig";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDocs,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";

// ====== Módulos → colecciones en Firestore ======
const MODULES = [
  { key: "servidor", title: "Servidor", collection: "credenciales_servidor", needsPage: false },
  { key: "correo", title: "Correo", collection: "credenciales_correo", needsPage: false },
  { key: "nube", title: "Nube", collection: "credenciales_nube", needsPage: false },
  { key: "syga", title: "Syga", collection: "credenciales_syga", needsPage: false },
  { key: "sitios", title: "Sitios de internet", collection: "credenciales_sitios", needsPage: true },
];

// ====== Envío de correo (usa tu API /api/enviarCorreoElectronico) ======
async function enviarCorreo(to, subject, text) {
  try {
    const destinatario = String(to || "").trim();
    if (!destinatario) return;
    const r = await fetch("/api/enviarCorreoElectronico", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: destinatario, subject, text }),
    });
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      console.error("Fallo al enviar correo:", data?.error || r.statusText);
    }
  } catch (e) {
    console.error("Error de red enviando correo:", e);
  }
}

// ====== Utilidades de tiempo y formato ======
const DIAS_RECORDATORIO = 60; // 2 meses aprox.

function msUntilDue(fechaCambioISO) {
  if (!fechaCambioISO) return -1; // sin fecha => ya vencido
  const last = new Date(fechaCambioISO).getTime();
  const due = last + DIAS_RECORDATORIO * 24 * 60 * 60 * 1000;
  return due - Date.now();
}

function fmtCountdown(ms) {
  if (ms <= 0) return "VENCIDO";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${d}d ${h}h ${m}m ${ss}s`;
}

function fmtDate(d) {
  try {
    return new Date(d).toLocaleString();
  } catch {
    return String(d || "");
  }
}

function genCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < 4; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return out;
}

// ====== Componente módulo (lista + alta + actualizar) ======
function CredentialModule({ config, now, onOverdueChange }) {
  const { key, title, collection: colName, needsPage } = config;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form de alta
  const [nuevoUsuario, setNuevoUsuario] = useState("");
  const [nuevaClaveInicial, setNuevaClaveInicial] = useState("");
  const [nuevaPagina, setNuevaPagina] = useState("");

  async function load() {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, colName));
      const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setItems(arr);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reportar pendientes a la cabecera
  useEffect(() => {
    const overdue = items
      .filter((it) => msUntilDue(it.fechaCambio) <= 0)
      .map((it) => ({
        moduleKey: key,
        moduleTitle: title,
        label:
          needsPage && it.pagina
            ? `${title} - ${it.pagina} (${it.usuario || "sin usuario"})`
            : `${title} - ${it.usuario || "sin usuario"}`,
      }));
    onOverdueChange(key, overdue);
  }, [items, key, title, needsPage, onOverdueChange, now]);

  // Alta de registro
  async function handleCrear(e) {
    e.preventDefault();
    if (!nuevoUsuario.trim() || !nuevaClaveInicial.trim() || (needsPage && !nuevaPagina.trim())) {
      alert("Completa los campos requeridos.");
      return;
    }
    const docData = {
      usuario: nuevoUsuario.trim(),
      ...(needsPage ? { pagina: nuevaPagina.trim() } : {}),
      claveActual: nuevaClaveInicial.trim(),
      claveAnterior: "",
      fechaCambio: new Date().toISOString(),
      historial: [], // {clave, fecha}
      codigo: genCode(),
      creadoAt: serverTimestamp(),
    };
    await addDoc(collection(db, colName), docData);
    setNuevoUsuario("");
    setNuevaClaveInicial("");
    setNuevaPagina("");
    await load();
  }

  // Cambio de clave
  async function handleActualizarClave(id, nuevaClave) {
    if (!nuevaClave || !String(nuevaClave).trim()) {
      alert("Ingresa la nueva clave.");
      return;
    }
    const it = items.find((x) => x.id === id);
    if (!it) return;

    const updated = {
      claveAnterior: it.claveActual || "",
      claveActual: String(nuevaClave).trim(),
      fechaCambio: new Date().toISOString(),
      historial: [
        ...(Array.isArray(it.historial) ? it.historial : []),
        it.claveActual
          ? { clave: it.claveActual, fecha: it.fechaCambio || new Date().toISOString() }
          : null,
      ].filter(Boolean),
    };

    await updateDoc(doc(db, colName, id), updated);
    await load();

    // Notificar por correo
    const asunto = `Cambio de contraseña - ${title}`;
    const cuerpo = [
      `Mensaje de cambio de contraseña`,
      `Módulo: ${title}`,
      needsPage && it.pagina ? `Página: ${it.pagina}` : undefined,
      `Usuario: ${it.usuario || "-"}`,
      `Clave nueva: ${String(nuevaClave).trim()}`,
      `Fecha de cambio: ${fmtDate(updated.fechaCambio)}`,
    ]
      .filter(Boolean)
      .join("\n");

    enviarCorreo("soportesistemas@soporteia.net", asunto, cuerpo);
  }

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <h3 style={{ margin: 0, fontSize: 20 }}>{title}</h3>
      </div>

      {/* Alta */}
      <form onSubmit={handleCrear} style={{ display: "grid", gap: 8, marginTop: 12 }}>
        {needsPage && (
          <input
            placeholder="Página"
            value={nuevaPagina}
            onChange={(e) => setNuevaPagina(e.target.value)}
            style={styles.input}
          />
        )}
        <input
          placeholder="Usuario"
          value={nuevoUsuario}
          onChange={(e) => setNuevoUsuario(e.target.value)}
          style={styles.input}
        />
        <input
          placeholder="Clave inicial"
          value={nuevaClaveInicial}
          onChange={(e) => setNuevaClaveInicial(e.target.value)}
          style={styles.input}
        />
        <button type="submit" style={styles.primaryBtn}>
          Crear
        </button>
      </form>

      {/* Lista */}
      <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
        {loading ? (
          <p style={{ color: "#6b7280" }}>Cargando…</p>
        ) : items.length === 0 ? (
          <p style={{ color: "#6b7280" }}>Sin registros aún.</p>
        ) : (
          items.map((it) => (
            <ItemRow
              key={it.id}
              item={it}
              needsPage={needsPage}
              onUpdate={handleActualizarClave}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ====== Fila de un registro ======
function ItemRow({ item, needsPage, onUpdate }) {
  const [nuevaClave, setNuevaClave] = useState("");
  const ms = msUntilDue(item.fechaCambio);
  const overdue = ms <= 0;
  const countdown = fmtCountdown(ms);

  return (
    <div style={styles.item}>
      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
          {needsPage && item.pagina && (
            <span style={{ ...styles.badge, background: "#f3f4f6", color: "#374151" }}>
              Página: {item.pagina}
            </span>
          )}
          <span style={{ ...styles.badge, background: "#e0f2fe", color: "#075985" }}>
            Usuario: {item.usuario || "—"}
          </span>
          <span
            style={{
              ...styles.badge,
              background: overdue ? "#fee2e2" : "#ecfccb",
              color: overdue ? "#b91c1c" : "#3f6212",
            }}
          >
            {overdue ? "Pendiente de cambio" : "Al día"}
          </span>
        </div>

        <div style={{ display: "grid", gap: 2 }}>
          <small>Clave actual: {item.claveActual || "—"}</small>
          <small>Clave anterior: {item.claveAnterior || "—"}</small>
          <small>Fecha último cambio: {item.fechaCambio ? fmtDate(item.fechaCambio) : "—"}</small>
          <small>Próximo recordatorio en: {countdown}</small>
        </div>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            placeholder="Nueva clave"
            value={nuevaClave}
            onChange={(e) => setNuevaClave(e.target.value)}
            style={styles.input}
          />
          <button
            onClick={() => {
              if (!nuevaClave.trim()) return;
              onUpdate(item.id, nuevaClave.trim());
              setNuevaClave("");
            }}
            style={styles.primaryBtn}
          >
            Actualizar clave
          </button>
        </div>

        <details style={styles.historyBox}>
          <summary style={{ cursor: "pointer", fontWeight: 600, color: "#374151" }}>
            Historial de cambios
          </summary>
          {(item.historial || []).length === 0 ? (
            <small style={{ color: "#6b7280" }}>Sin cambios anteriores.</small>
          ) : (
            (item.historial || [])
              .slice()
              .reverse()
              .map((h, i) => (
                <div key={i} style={{ display: "flex", gap: 12 }}>
                  <small style={{ width: 180, color: "#111827" }}>{fmtDate(h.fecha)}</small>
                  <small style={{ color: "#374151" }}>{h.clave}</small>
                </div>
              ))
          )}
        </details>
      </div>
    </div>
  );
}

// ====== Página principal: Control de contraseñas ======
export default function ControlDeContrasenas() {
  const router = useRouter();

  // “Reloj” para refrescar countdown cada 1s en hijos (pasamos "now" si lo prefieres)
  const [, forceTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => forceTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const now = Date.now();

  // Pendientes globales
  const [pendientes, setPendientes] = useState({});
  const allPendientes = useMemo(
    () =>
      Object.values(pendientes)
        .flat()
        .map((p) => `${p.moduleTitle}: ${p.label.replace(`${p.moduleTitle} - `, "")}`),
    [pendientes]
  );

  const handleOverdueChange = (moduleKey, list) => {
    setPendientes((prev) => ({ ...prev, [moduleKey]: list }));
  };

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
        }}
      >
        <h1
          style={{
            fontSize: 36,
            color: "#2c3e50",
            textShadow: "2px 2px 4px rgba(0,0,0,0.3)",
            fontWeight: 900,
            letterSpacing: 1,
            textAlign: "center",
            marginBottom: 12,
          }}
        >
          Control de contraseñas
        </h1>

        {/* Barra informativa de pendientes globales */}
        <div
          style={{
            background: "#fff",
            color: "#111827",
            borderRadius: 8,
            padding: "8px 12px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontWeight: 700 }}>Estado:</span>
          {allPendientes.length === 0 ? (
            <span style={{ color: "#065f46", fontWeight: 700 }}>Todo al día ✅</span>
          ) : (
            <>
              <span style={{ color: "#b91c1c", fontWeight: 800 }}>
                Pendiente de cambio de clave:
              </span>
              {allPendientes.map((t, i) => (
                <span key={i} style={{ ...styles.badge, background: "#fee2e2", color: "#991b1b" }}>
                  {t}
                </span>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Grilla de módulos */}
      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))",
          marginTop: 16,
        }}
      >
        {MODULES.map((cfg) => (
          <CredentialModule
            key={cfg.key}
            config={cfg}
            now={now}
            onOverdueChange={handleOverdueChange}
          />
        ))}
      </div>

      {/* Botón fijo Regresar (azul) */}
      <button
        onClick={() => router.push("/")}
        style={{
          position: "fixed",
          bottom: 20,
          left: 20,
          backgroundColor: "#007acc",
          color: "white",
          padding: "10px 16px",
          border: "none",
          borderRadius: 8,
          cursor: "pointer",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          zIndex: 1000,
        }}
      >
        ⬅ Regresar
      </button>
    </div>
  );
}

// ====== Estilos reutilizables ======
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
  input: {
    padding: 10,
    borderRadius: 8,
    border: "1px solid #d1d5db",
    outline: "none",
  },
  primaryBtn: {
    background: "#007acc",
    color: "white",
    padding: "10px 16px",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
  },
  item: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    padding: 12,
    border: "1px solid #f3f4f6",
    borderRadius: 10,
    background: "#fafafa",
    flexWrap: "wrap",
  },
  badge: {
    padding: "4px 8px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
  },
  historyBox: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: 10,
  },
};
