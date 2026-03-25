// pages/login.js – Estilo “Gateway” (solo presentación). Cambios solicitados:
// - Link: “← Regresar a NexoTI” con texto NexoTI en degradado tipo logo
// - Correo centrado y con tipografía más marcada
// - Footer centrado y discreto

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { app } from "@/firebase/firebaseConfig";

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || "https://gateway-nexoti.vercel.app";
const TIMEOUT_MS = 30_000;

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);

  // 1) Toma ?email= y si no viene, vuelve al Gateway
  useEffect(() => {
    if (!router.isReady) return;
    const q = router.query?.email;
    if (typeof q === "string" && q.includes("@")) setEmail(q);
    else router.replace(GATEWAY_URL);
  }, [router.isReady, router.query?.email]);

  // 2) Inactividad: 30s → volver al Gateway con el email
  useEffect(() => {
    if (!email) return;
    const back = () => {
      const u = new URL(GATEWAY_URL);
      u.searchParams.set("email", email);
      window.location.assign(u.toString());
    };
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(back, TIMEOUT_MS);
    return () => timerRef.current && clearTimeout(timerRef.current);
  }, [email]);

  // 3) Reinicia el temporizador con actividad
  useEffect(() => {
    if (!email) return;
    const bump = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const u = new URL(GATEWAY_URL);
        u.searchParams.set("email", email);
        window.location.assign(u.toString());
      }, TIMEOUT_MS);
    };
    window.addEventListener("keydown", bump);
    window.addEventListener("mousemove", bump);
    window.addEventListener("click", bump);
    return () => {
      window.removeEventListener("keydown", bump);
      window.removeEventListener("mousemove", bump);
      window.removeEventListener("click", bump);
    };
  }, [email]);

  function onKeyDown(e) {
    if (typeof e.getModifierState === "function") {
      setCapsLockOn(e.getModifierState("CapsLock"));
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    if (!email) {
      setErr("Sesión inválida. Regresando al portal principal…");
      setTimeout(() => router.replace(GATEWAY_URL), 900);
      return;
    }
    if (!clave) {
      setErr("Ingrese su contraseña");
      return;
    }
    setLoading(true);
    try {
      const auth = getAuth(app);
      await signInWithEmailAndPassword(auth, String(email).trim(), String(clave));
      const next = typeof router.query?.redirect === "string" ? router.query.redirect : "/";
      router.push(next);
    } catch (error) {
      let msg = "No se pudo iniciar sesión.";
      if (error?.code === "auth/invalid-email") msg = "Correo inválido.";
      if (error?.code === "auth/user-not-found") msg = "Usuario no encontrado.";
      if (error?.code === "auth/wrong-password") msg = "Contraseña incorrecta.";
      if (error?.code === "auth/too-many-requests") msg = "Demasiados intentos. Inténtalo más tarde.";
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      {/* Fondo + overlay tipo gateway */}
      <div style={styles.bg} aria-hidden />
      <div style={styles.overlay} aria-hidden />

      <div style={styles.container}>
        <form onSubmit={onSubmit} style={styles.card}>
          {/* Logo logisport */}
          <div style={{ display: "grid", justifyItems: "center", marginBottom: 6 }}>
            <img
              src="/logos/logisport.png"
              alt="logisport"
              style={{ height: 64, width: "auto", objectFit: "contain" }}
              decoding="async"
              draggable={false}
            />
          </div>

          <h1 style={styles.title}>Nexo TI – logisport</h1>

          {/* Correo (centrado + estilo) */}
          <div style={styles.readonlyEmail} title={email}>
            {email || "—"}
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ position: "relative" }}>
              <input
                type={showPass ? "text" : "password"}
                placeholder="Contraseña"
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                onKeyDown={onKeyDown}
                style={styles.input}
                autoFocus
                required
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                style={styles.eyeBtn}
                tabIndex={-1}
                aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
                title={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPass ? "🙈" : "👁️"}
              </button>
            </div>

            {capsLockOn && <div style={styles.caps}>Bloq Mayús activado</div>}

            <button type="submit" disabled={loading} style={styles.btn}>
              {loading ? "Ingresando..." : "Ingresar"}
            </button>

            {err && <div style={styles.error}>{err}</div>}

            {/* Link “Regresar a NexoTI” con estilo degradado en la palabra NexoTI */}
            <a href={GATEWAY_URL} className="nexotiLink" title="Volver al portal principal">
              ← Regresar a <span className="brandMark">NexoTI</span>
            </a>
          </div>
        </form>
      </div>

      {/* Footer discreto y centrado */}
      <div style={styles.footer}>
        <span translate="no">© {new Date().getFullYear()} Derechos reservados - Alexander Borrero</span>
      </div>

      {/* Estilos adicionales para el enlace con degradado */}
      <style jsx>{`
        .nexotiLink {
          display: inline-block;
          text-align: center;
          font-weight: 700;
          text-decoration: none;
          margin: 0 auto;
          color: #e5e7eb; /* color base suave */
        }
        .nexotiLink:hover { opacity: .95; }
        .brandMark {
          background: linear-gradient(90deg, #0ea5e9, #2563eb, #1e40af);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          text-shadow: 0 1px 0 rgba(255,255,255,.35);
          margin-left: 6px;
        }
      `}</style>
    </div>
  );
}

const styles = {
  page: { minHeight: "100vh", position: "relative", overflow: "hidden", fontFamily: "Arial, sans-serif" },

  bg: {
    position: "fixed", inset: 0,
    backgroundImage: 'url("/logos/login-bg.jpg")',
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    backgroundAttachment: "fixed",
    zIndex: 0,
  },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", pointerEvents: "none", zIndex: 0 },

  container: { minHeight: "100vh", display: "grid", placeItems: "center", padding: 16, position: "relative", zIndex: 1 },

  card: {
    width: "100%",
    maxWidth: 420,
    background: "rgba(255, 255, 255, 0.14)",
    border: "1px solid rgba(255, 255, 255, 0.36)",
    borderRadius: 18,
    boxShadow: "0 18px 50px rgba(0,0,0,0.25)",
    padding: 22,
    backdropFilter: "blur(14px) saturate(140%)",
    WebkitBackdropFilter: "blur(14px) saturate(140%)",
  },
  title: { margin: 0, fontSize: 22, fontWeight: 800, color: "#2c3e9e", textAlign: "center", marginBottom: 6 },

  // Correo centrado + “más estilo”
  readonlyEmail: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 12,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    color: "#0f172a",
    fontWeight: 800,
    fontSize: 16,
    letterSpacing: ".3px",
    textAlign: "center",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  input: { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb", outline: "none" },
  eyeBtn: { position: "absolute", right: 8, top: 7, border: "none", background: "transparent", fontSize: 18, cursor: "pointer", lineHeight: 1 },
  caps: { background: "#fff7ed", color: "#9a3412", border: "1px solid #fed7aa", borderRadius: 8, padding: "6px 10px", fontWeight: 700, fontSize: 12 },
  btn: { width: "100%", padding: "11px 12px", background: "#007acc", color: "white", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer" },
  error: { background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 12px", textAlign: "center", fontWeight: 700, fontSize: 13 },

  // Footer discreto (sin resalto)
  footer: {
    position: "fixed",
    bottom: 12,
    width: "100%",
    textAlign: "center",
    color: "#cbd5e1",   // gris suave
    fontSize: 13,
    zIndex: 10,
    fontWeight: 500,    // no resaltado
  },
};
