// Archivo completo: pages/login.js — versión mínima estable (corrige “Default export is not a React Component”)
// Mantiene tu lógica y estilos. Evita imports dinámicos que a veces rompen el build.

import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import {
  getAuth,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  signInWithEmailAndPassword,
} from "firebase/auth";

// Branding básico (si luego quieres, lo movemos a utils/branding.js)
const BRAND = {
  appName: "Logisport",
  subtitle: "Control Tecnológico",
  logoUrl: "/nexoti-logo.svg?v=3",
};

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Si ya hay sesión, ir SIEMPRE al menú (/) — no a otras páginas
  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) router.replace("/");
    });
    return () => unsub();
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const auth = getAuth();
      await setPersistence(auth, browserLocalPersistence);
      await signInWithEmailAndPassword(auth, email, pass);
      router.replace("/");
    } catch (error) {
      setErr("Credenciales inválidas o error de red.");
    } finally {
      setLoading(false);
    }
  };

  const styles = {
    page: { minHeight: "100vh", position: "relative", overflow: "hidden", fontFamily: "Arial, sans-serif" },
    bg: { position: "fixed", inset: 0, backgroundImage: 'url("/login-bg.jpg")', backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat", backgroundAttachment: "fixed" },
    overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", pointerEvents: "none" },
    container: { minHeight: "100vh", display: "grid", placeItems: "center", padding: 16, position: "relative", zIndex: 1 },
    card: { width: "100%", maxWidth: 420, background: "#fff", borderRadius: 18, boxShadow: "0 10px 30px rgba(0,0,0,0.08)", padding: 22 },
    brand: { display: "grid", justifyItems: "center", gap: 10, marginBottom: 16 },
    title: { margin: 0, fontSize: 22, fontWeight: 800, color: "#2c3e9e" },
    input: { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb", outline: "none" },
    btn: { width: "100%", padding: "11px 12px", background: "#3498db", color: "white", border: "none", borderRadius: 10, fontWeight: 700 },
    error: { color: "#b91c1c", fontSize: 14 },
    footer: { position: "fixed", bottom: 10, width: "100%", textAlign: "center", color: "#f1f1f1", fontSize: 14, zIndex: 10 },
  };

  const handleLogoError = (e) => {
    const curr = e.currentTarget.getAttribute("src") || "";
    if (!curr.includes("nexoti-logo.svg")) {
      e.currentTarget.removeAttribute("srcset");
      e.currentTarget.src = "/nexoti-logo.svg?v=3";
    } else if (!curr.includes("nexoti-logo.png")) {
      e.currentTarget.src = "/nexoti-logo.png?v=2";
    } else {
      e.currentTarget.src = "/logo1.png";
    }
  };

  return (
    <div style={styles.page}>
      {/* Fondo */}
      <div style={styles.bg} aria-hidden />
      <div style={styles.overlay} aria-hidden />

      <div style={styles.container}>
        <form onSubmit={handleSubmit} style={styles.card}>
          <div style={styles.brand}>
            <img
              src={BRAND.logoUrl || "/nexoti-logo.svg?v=3"}
              onError={handleLogoError}
              alt={BRAND.appName || "Logisport"}
              decoding="async"
              draggable={false}
              style={{ height: 72, width: "auto", objectFit: "contain" }}
            />
            <h1 style={styles.title}>Iniciar sesión</h1>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <input type="email" placeholder="Correo" value={email} onChange={(e) => setEmail(e.target.value)} style={styles.input} required />
            <input type="password" placeholder="Contraseña" value={pass} onChange={(e) => setPass(e.target.value)} style={styles.input} required />
            <button disabled={loading} style={styles.btn}>{loading ? "Ingresando..." : "Ingresar"}</button>
            {err && <div style={styles.error}>{err}</div>}
          </div>
        </form>
      </div>

      <div style={styles.footer}>
        <span translate="no">© 2025 Derechos reservados - Alexander Borrero</span>
      </div>
    </div>
  );
}
