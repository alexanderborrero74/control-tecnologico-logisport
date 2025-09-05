// pages/control-de-contrasenas.js
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { db } from "@/firebase/firebaseConfig";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";

/* =========================
   Configuración de módulos
========================= */
const MODULES = [
  { key: "servidor", title: "Servidor", collection: "credenciales_servidor", needsPage: false },
  { key: "correo", title: "Correo", collection: "credenciales_correo", needsPage: false },
  { key: "nube", title: "Nube", collection: "credenciales_nube", needsPage: false },
  { key: "syga", title: "Syga", collection: "credenciales_syga", needsPage: false },
  { key: "sitios", title: "Sitios de internet", collection: "credenciales_sitios", needsPage: true },
];

/* =========================
   Utilidades y correo
========================= */
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
const DIAS_RECORDATORIO = 60; // ~2 meses
const msUntilDue = (iso) => (iso ? new Date(iso).getTime() + DIAS_RECORDATORIO * 86400000 - Date.now() : -1);
const diasRestantes = (ms) => (ms <= 0 ? 0 : Math.ceil(ms / 86400000));
const fmtDate = (d) => { try { return new Date(d).toLocaleString(); } catch { return String(d || ""); } };
const genCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < 4; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return out;
};
const stableKey = (s) => `k_${String(s).replace(/[^a-zA-Z0-9_-]/g, "_")}`;

/* ===============================================
   Filtro UNA SOLA CASILLA con autocompletado
   (sin <select> ni <datalist>, DOM estable)
=============================================== */
const SingleNameFilter = memo(function SingleNameFilter({ users, selected, onChange }) {
  const selectedName = selected[0] || "";
  const [query, setQuery] = useState(selectedName);
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0); // índice resaltado
  const boxRef = useRef(null);
  const listRef = useRef(null);

  const options = useMemo(
    () => Array.from(new Set(users.filter(Boolean))).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" })),
    [users]
  );

  const suggestions = useMemo(() => {
    const q = (query || "").trim().toLowerCase();
    const base = q ? options.filter((u) => u.toLowerCase().includes(q)) : options;
    return base.slice(0, 20);
  }, [options, query]);

  useEffect(() => {
    if (selectedName !== query) setQuery(selectedName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedName]);

  useEffect(() => {
    function onDocClick(e) {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const pick = useCallback((name) => {
    setQuery(name);
    onChange(name ? [name] : []);
    setOpen(false);
  }, [onChange]);

  const clear = useCallback(() => {
    setQuery("");
    onChange([]);
    setOpen(false);
    setHi(0);
  }, [onChange]);

  const onKeyDown = (e) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      return;
    }
    if (!open) {
      if (e.key === "Enter") {
        const exact = options.find((o) => o.toLowerCase() === query.trim().toLowerCase());
        pick(exact || "");
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHi((i) => Math.min(i + 1, Math.max(0, suggestions.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(suggestions[hi] || "");
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div ref={boxRef} style={styles.filterBar}>
      <label style={{ fontWeight: 800, color: "#111827", marginBottom: 6, display: "block" }}>
        Filtrar por nombre:
      </label>

      <div style={{ position: "relative" }}>
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls="suggestions"
          aria-autocomplete="list"
          placeholder="Escribe un nombre…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setHi(0); }}
          onFocus={() => { setOpen(true); }}
          onKeyDown={onKeyDown}
          style={{ ...styles.input, color: "#0f172a" /* texto oscuro */ }}
        />
        {query && (
          <button
            type="button"
            onClick={clear}
            title="Limpiar"
            style={{
              position: "absolute", right: 8, top: 8,
              background: "transparent", border: 0, cursor: "pointer", fontSize: 16, color: "#111827"
            }}
          >
            ×
          </button>
        )}

        {open && suggestions.length > 0 && (
          <ul id="suggestions" ref={listRef} role="listbox" style={styles.suggestList}>
            {suggestions.map((name, idx) => {
              const active = idx === hi;
              return (
                <li
                  role="option"
                  aria-selected={active}
                  key={stableKey(`sug_${name}`)}
                  onMouseDown={(e) => { e.preventDefault(); pick(name); }}
                  onMouseEnter={() => setHi(idx)}
                  style={{
                    padding: "10px 12px",
                    cursor: "pointer",
                    background: active ? "#1d4ed8" : "#ffffff", // azul 700 cuando está resaltado
                    color: active ? "#ffffff" : "#111827",       // texto blanco sobre azul
                    borderBottom: "1px solid #e5e7eb",
                  }}
                >
                  {name}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {selectedName ? (
        <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={styles.chip}>{selectedName}</span>
          <button type="button" style={{ ...styles.btn, background: "#6b7280" }} onClick={clear}>
            Quitar filtro
          </button>
        </div>
      ) : (
        <div style={{ marginTop: 4, color: "#6b7280", fontSize: 13 }}>
          Selecciona un nombre para ver sus registros.
        </div>
      )}
    </div>
  );
});


/* =========================
   Módulo de credenciales
========================= */
function CredentialModule({ config, selectedUsers, onReportOverdue, onReportUsers }) {
  const { key, title, collection: colName, needsPage } = config;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form de alta
  const [nuevoUsuario, setNuevoUsuario] = useState("");
  const [nuevaClaveInicial, setNuevaClaveInicial] = useState("");
  const [nuevaPagina, setNuevaPagina] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, colName));
      const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setItems(arr);
    } finally {
      setLoading(false);
    }
  }, [colName]);

  useEffect(() => { load(); }, [load]);

  // Reporte de usuarios y pendientes (solo cuando cambian items)
  useEffect(() => {
    const users = Array.from(
      new Set(items.map((it) => (it.usuario || "").trim()).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
    onReportUsers(key, users);

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
    onReportOverdue(key, overdue);
  }, [items, key, title, needsPage, onReportOverdue, onReportUsers]);

  // Crear registro
  const handleCrear = async (e) => {
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
      historial: [],
      codigo: genCode(),
      creadoAt: serverTimestamp(),
    };
    await addDoc(collection(db, colName), docData);
    setNuevoUsuario("");
    setNuevaClaveInicial("");
    setNuevaPagina("");
    await load();
  };

  // Actualizar clave
  const handleActualizarClave = async (id, nuevaClave) => {
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
        it.claveActual ? { clave: it.claveActual, fecha: it.fechaCambio || new Date().toISOString() } : null,
      ].filter(Boolean),
    };

    await updateDoc(doc(db, colName, id), updated);
    await load();

    const asunto = `Cambio de contraseña - ${title}`;
    const cuerpo = [
      `Mensaje de cambio de contraseña`,
      `Módulo: ${title}`,
      needsPage && it.pagina ? `Página: ${it.pagina}` : undefined,
      `Usuario: ${it.usuario || "-"}`,
      `Clave nueva: ${String(nuevaClave).trim()}`,
      `Fecha de cambio: ${fmtDate(updated.fechaCambio)}`,
    ].filter(Boolean).join("\n");

    enviarCorreo("soportesistemas@soporteia.net", asunto, cuerpo);
  };

  // Filtrado según usuarios (solo 1 seleccionado)
  const filteredItems = useMemo(() => {
    const sel = (selectedUsers && selectedUsers[0]) ? selectedUsers[0].trim().toLowerCase() : "";
    if (!sel) return [];
    return items.filter((it) => String(it.usuario || "").trim().toLowerCase() === sel);
  }, [items, selectedUsers]);

  // Contenido estable
  let listContent;
  if (loading) {
    listContent = <li key="loading" style={{ color: "#6b7280", listStyle: "none" }}>Cargando…</li>;
  } else if (!selectedUsers || selectedUsers.length === 0) {
    listContent = (
      <li key="need_filter" style={{ color: "#6b7280", listStyle: "none" }}>
        Escribe y elige un <b>nombre</b> en el filtro superior para ver registros.
      </li>
    );
  } else if (filteredItems.length === 0) {
    listContent = <li key="empty" style={{ color: "#6b7280", listStyle: "none" }}>No hay registros para ese usuario.</li>;
  } else {
    listContent = filteredItems.map((it) => (
      <li key={stableKey(it.id)} style={{ listStyle: "none" }}>
        <ItemRow item={it} needsPage={needsPage} onUpdate={handleActualizarClave} />
      </li>
    ));
  }

  return (
    <section style={styles.card}>
      <header style={styles.cardHeader}>
        <h3 style={{ margin: 0, fontSize: 20 }}>{title}</h3>
      </header>

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
        <button type="submit" style={styles.primaryBtn}>Crear</button>
      </form>

      {/* Lista (contenedor estable) */}
      <ul style={{ display: "grid", gap: 12, marginTop: 16, padding: 0 }}>{listContent}</ul>
    </section>
  );
}

/* =========================
   Ítem
========================= */
const ItemRow = memo(function ItemRow({ item, needsPage, onUpdate }) {
  const [nuevaClave, setNuevaClave] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const ms = msUntilDue(item.fechaCambio);
  const overdue = ms <= 0;
  const dleft = diasRestantes(ms);

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
          <small>Próximo recordatorio en: {overdue ? "VENCIDO" : `${dleft} día(s)`}</small>
        </div>

        <button
          type="button"
          onClick={() => setShowHistory((v) => !v)}
          style={{ ...styles.btn, background: "#0ea5e9", width: "fit-content" }}
        >
          {showHistory ? "Ocultar historial" : "Ver historial"}
        </button>

        {showHistory && (
          <div style={styles.historyBox}>
            {(item.historial || []).length === 0 ? (
              <small style={{ color: "#6b7280" }}>Sin cambios anteriores.</small>
            ) : (
              <ul style={{ margin: 0, padding: 0 }}>
                {(item.historial || [])
                  .slice()
                  .reverse()
                  .map((h, i) => (
                    <li key={stableKey(`${item.id}_h_${i}`)} style={{ listStyle: "none" }}>
                      <div style={{ display: "flex", gap: 12 }}>
                        <small style={{ width: 180, color: "#111827" }}>{fmtDate(h.fecha)}</small>
                        <small style={{ color: "#374151" }}>{h.clave}</small>
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            placeholder="Nueva clave"
            value={nuevaClave}
            onChange={(e) => setNuevaClave(e.target.value)}
            style={styles.input}
          />
        </div>
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
    </div>
  );
});

/* =========================
   Página principal
========================= */
export default function ControlDeContrasenas() {
  // Pendientes globales
  const [pendientes, setPendientes] = useState({});
  const handleOverdueChange = useCallback((moduleKey, list) => {
    setPendientes((prev) => {
      const prevList = prev[moduleKey] || [];
      const same =
        prevList.length === list.length &&
        prevList.every(
          (x, i) =>
            x.label === list[i]?.label &&
            x.moduleKey === list[i]?.moduleKey &&
            x.moduleTitle === list[i]?.moduleTitle
        );
      if (same) return prev;
      return { ...prev, [moduleKey]: list };
    });
  }, []);

  const allPendientes = useMemo(
    () =>
      Object.values(pendientes)
        .flat()
        .map((p) => `${p.moduleTitle}: ${p.label.replace(`${p.moduleTitle} - `, "")}`),
    [pendientes]
  );

  // Usuarios globales
  const [usersByModule, setUsersByModule] = useState({});
  const handleUsersChange = useCallback((moduleKey, users) => {
    setUsersByModule((prev) => {
      const prevList = prev[moduleKey] || [];
      const same = prevList.length === users.length && prevList.every((u, i) => u === users[i]);
      if (same) return prev;
      return { ...prev, [moduleKey]: users };
    });
  }, []);

  const allUsers = useMemo(
    () =>
      Array.from(new Set(Object.values(usersByModule).flat().filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "es", { sensitivity: "base" })
      ),
    [usersByModule]
  );

  // Un solo nombre seleccionado
  const [selectedUsers, setSelectedUsers] = useState([]);

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

        {/* Estado global */}
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
            marginBottom: 12,
          }}
        >
          <span style={{ fontWeight: 700 }}>Estado:</span>
          {allPendientes.length === 0 ? (
            <span style={{ color: "#065f46", fontWeight: 700 }}>Todo al día ✅</span>
          ) : (
            <>
              <span style={{ color: "#b91c1c", fontWeight: 800 }}>Pendiente de cambio de clave:</span>
              <ul style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: 0, padding: 0 }}>
                {allPendientes.map((t) => (
                  <li key={stableKey(`pend_${t}`)} style={{ listStyle: "none" }}>
                    <span style={{ ...styles.badge, background: "#fee2e2", color: "#991b1b" }}>{t}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* Filtro: UNA casilla con autocompletado */}
        <SingleNameFilter users={allUsers} selected={selectedUsers} onChange={setSelectedUsers} />
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
            selectedUsers={selectedUsers}
            onReportOverdue={handleOverdueChange}
            onReportUsers={handleUsersChange}
          />
        ))}
      </div>

      {/* Botón fijo Regresar */}
      <Link
        href="/"
        style={{
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
        }}
      >
        ⬅ Regresar
      </Link>
    </div>
  );
}

/* =========================
   Estilos
========================= */
// ====== Estilos (colócalo al final del archivo) ======
const styles = {
  filterBar: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    display: "grid",
    gap: 8,
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  },

  input: {
    width: "100%",
    padding: "10px 36px 10px 10px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    outline: "none",
    // El color del texto lo fijamos en el componente para máximo contraste
  },

  suggestList: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    background: "white",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    marginTop: 6,
    maxHeight: 260,
    overflowY: "auto",
    boxShadow: "0 12px 24px rgba(0,0,0,0.12)",
    padding: 0,
    zIndex: 50,
  },

  chip: {
    background: "#1e40af", // azul fuerte
    color: "#ffffff",
    borderRadius: 999,
    padding: "4px 10px",
    fontSize: 12,
    fontWeight: 800,
  },

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

  primaryBtn: {
    background: "#007acc",
    color: "white",
    padding: "10px 16px",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
  },

  btn: {
    background: "#007acc",
    color: "white",
    padding: "8px 12px",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 700,
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
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
