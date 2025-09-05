// pages/_app.js
import "@/styles/globals.css"; // aquí tienes body.menu-home con tu imagen
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";
import dynamic from "next/dynamic";
import Head from "next/head";

/* ========== Cargar asistente sin SSR ========== */
const GuiaBienvenida = dynamic(
  () => import("@/components/GuiaBienvenida").then(m => m.default || m),
  { ssr: false }
);

/* ========= Texto de cápsulas (elige mejor campo) ========= */
const FIELD_CANDIDATES = [
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

function pickTextFromDoc(data) {
  for (const k of FIELD_CANDIDATES) {
    const v = data?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (v != null && v.toString && v.toString().trim()) return v.toString().trim();
  }
  for (const [, v] of Object.entries(data || {})) {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (v != null && v.toString && v.toString().trim()) return v.toString().trim();
  }
  return "";
}

/* ========= Cápsulas GLOBAL (en toda la app) ========= */
function GlobalCapsulas() {
  const [pool, setPool] = useState([]);   // array de strings (mensajes)
  const [visible, setVisible] = useState(false);
  const [msg, setMsg] = useState("");

  const startedRef = useRef(false);
  const lastIdxRef = useRef(-1);
  const hideTimerRef = useRef(null);
  const loopTimerRef = useRef(null);

  const clearHide = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = null;
  };
  const clearLoop = () => {
    if (loopTimerRef.current) clearTimeout(loopTimerRef.current);
    loopTimerRef.current = null;
  };

  const showRandom = () => {
    if (!pool.length) return;

    // evita repetir la misma consecutiva si hay más de una
    let idx = Math.floor(Math.random() * pool.length);
    if (pool.length > 1 && idx === lastIdxRef.current) {
      idx = (idx + 1) % pool.length;
    }
    lastIdxRef.current = idx;

    setMsg(pool[idx]);
    setVisible(true);

    // ocultar a los 12s
    clearHide();
    hideTimerRef.current = setTimeout(() => setVisible(false), 12000);
  };

  const scheduleNext = (ms) => {
    clearLoop();
    loopTimerRef.current = setTimeout(() => {
      // si la pestaña está oculta, reprograma sin mostrar
      if (typeof document !== "undefined" && document.hidden) {
        scheduleNext(10000); // vuelve a intentar en 10s
        return;
      }
      showRandom();
      // próxima entre 28s y 36s (aleatorio alrededor de 30s)
      const jitter = 28000 + Math.floor(Math.random() * 8000);
      scheduleNext(jitter);
    }, ms);
  };

  // Suscripción en vivo a "capsulas" y bucle controlado por setTimeout
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "capsulas"),
      (snap) => {
        const arr = [];
        snap.forEach((d) => {
          const t = pickTextFromDoc(d.data());
          if (t) arr.push(t);
        });
        // dedup + limpieza
        const dedup = Array.from(new Set(arr.map((s) => s.trim()))).filter(Boolean);
        setPool(dedup);
      },
      () => {}
    );
    return () => {
      unsub?.();
    };
  }, []);

  // Arranca el ciclo cuando haya pool
  useEffect(() => {
    if (!pool.length) return;
    if (startedRef.current) return; // solo una vez

    startedRef.current = true;

    // disparo inicial a los 2s
    setTimeout(() => {
      if (!document.hidden) showRandom();
    }, 2000);

    // programa la siguiente
    scheduleNext(30000);

    return () => {
      startedRef.current = false;
      clearHide();
      clearLoop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool.length]);

  if (!visible || !msg) return null;

  return (
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
        maxWidth: 360,
        border: "1px solid #f7c873",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ fontSize: 20, lineHeight: "20px" }}>💡</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, marginBottom: 6, color: "#7c2d12" }}>
            Ciberseguridad
          </div>
          <div style={{ fontSize: 14, color: "#1f2937", whiteSpace: "pre-wrap" }}>
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
  );
}

/* ========= Fondo del MENÚ PRINCIPAL =========
   Aplica body.menu-home solo en rutas de menú.
   Login NUNCA lleva fondo de menú.
*/
const MENU_HOME_ROUTES = [
  "/",               // menú principal
  "/home",
  "/inicio",
  "/menu",
  "/menu-principal",
  "/menu-admin",
  "/admin",
  "/dashboard",
];
const EXCLUDE_ROUTES = ["/login"];

export default function MyApp({ Component, pageProps }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // Desactivar traducción automática del navegador
  useEffect(() => {
    try {
      document.documentElement.setAttribute("lang", "es");
      document.documentElement.setAttribute("translate", "no");
      document.documentElement.classList.add("notranslate");
    } catch {}
  }, []);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const path = router.pathname || "";
    const isExcluded = EXCLUDE_ROUTES.includes(path);
    const isMenuHome = MENU_HOME_ROUTES.includes(path);

    if (!isExcluded && isMenuHome) {
      document.body.classList.add("menu-home");
    } else {
      document.body.classList.remove("menu-home");
    }

    return () => {
      document.body.classList.remove("menu-home");
    };
  }, [router.pathname]);

  return (
    <>
      <Head>
        <meta name="google" content="notranslate" />
        <meta httpEquiv="Content-Language" content="es" />
      </Head>

      <Component {...pageProps} />

      {mounted && <GuiaBienvenida />}
      {mounted && <GlobalCapsulas />}
    </>
  );
}
