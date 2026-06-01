// pages/cambiar-clave.js — LOGISPORT
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { getAuth, onAuthStateChanged, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import { app } from "@/firebase/firebaseConfig";
import { getUserRoleByUid } from "@/utils/getUserRole";

function validarClave(clave) {
  return {
    longitud:  clave.length >= 8,
    mayuscula: /[A-Z]/.test(clave),
    numero:    /[0-9]/.test(clave),
    letra:     /[a-zA-Z]/.test(clave),
  };
}

function ReglaItem({ ok, texto }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: ok ? "#10b981" : "rgba(255,255,255,0.6)", transition: "color 0.2s" }}>
      <span style={{ fontWeight: 700, fontSize: 14 }}>{ok ? "✓" : "○"}</span>
      {texto}
    </div>
  );
}

export default function CambiarClave() {
  const router = useRouter();
  const { obligatorio, dias } = router.query;
  const esObligatorio = obligatorio === "true";
  const esAviso       = obligatorio === "aviso";

  const [user, setUser]               = useState(null);
  const [rol, setRol]                 = useState(null);
  const [claveActual, setClaveActual] = useState("");
  const [nuevaClave, setNuevaClave]   = useState("");
  const [confirmar, setConfirmar]     = useState("");
  const [showActual, setShowActual]   = useState(false);
  const [showNueva, setShowNueva]     = useState(false);
  const [showConf, setShowConf]       = useState(false);
  const [cargando, setCargando]       = useState(false);
  const [error, setError]             = useState("");
  const [exito, setExito]             = useState(false);
  const [enviandoNotif, setEnviandoNotif] = useState(false);
  const [notifEnviada, setNotifEnviada]   = useState(false);

  useEffect(() => {
    const auth = getAuth(app);
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.replace("/login"); return; }
      setUser(u);
      const r = await getUserRoleByUid(u.uid).catch(() => "usuario");
      setRol(r || "usuario");
    });
    return () => unsub();
  }, [router]);

  const irAApp = () => router.replace("/");

  // Enviar nueva clave a sistemas antes de guardar
  const handleNotificarSistemas = async () => {
    if (!todasOk) { setError("Completa la nueva contraseña antes de notificar."); return; }
    if (!coinciden) { setError("Las contraseñas deben coincidir antes de notificar."); return; }
    setEnviandoNotif(true);
    setError("");
    try {
      const res = await fetch("/api/notificar-nueva-clave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailUsuario:  user.email,
          nuevaClave:    nuevaClave,
          nombreUsuario: user.displayName || user.email,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotifEnviada(true);
      } else {
        // Si falla el envio, igual permitir continuar pero avisar
        console.error("Error notificacion:", data.error);
        // Marcamos como enviada para no bloquear al usuario
        // El admin puede ver la clave en el historial de cambios
        setNotifEnviada(true);
        setError("⚠️ No se pudo enviar el correo, pero puedes continuar cambiando la clave.");
      }
    } catch (e) {
      console.error(e);
      // Igualmente permitir continuar
      setNotifEnviada(true);
      setError("⚠️ Error de red al notificar, pero puedes continuar.");
    } finally {
      setEnviandoNotif(false);
    }
  };

  const reglas = validarClave(nuevaClave);
  const todasOk = Object.values(reglas).every(Boolean);
  const coinciden = nuevaClave === confirmar && confirmar.length > 0;

  const handleCambiar = async (e) => {
    e.preventDefault();
    setError("");
    if (!todasOk) { setError("La nueva contraseña no cumple todos los requisitos."); return; }
    if (!coinciden) { setError("Las contraseñas no coinciden."); return; }
    if (nuevaClave === claveActual) { setError("La nueva contraseña no puede ser igual a la actual."); return; }

    setCargando(true);
    try {
      const auth = getAuth(app);
      const cu = auth.currentUser;
      await reauthenticateWithCredential(cu, EmailAuthProvider.credential(cu.email, claveActual));
      await updatePassword(cu, nuevaClave);

      // Renovar fecha de caducidad — pasar email Y uid para mayor confiabilidad
      const renovRes = await fetch("/api/renovar-caducidad-clave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cu.email, uid: cu.uid }),
      });
      const renovData = await renovRes.json();
      if (!renovData.success) {
        console.error("Error renovando caducidad:", renovData.error);
      }
      setExito(true);
      setTimeout(() => irAApp(), 2000);
    } catch (err) {
      if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") setError("La contraseña actual es incorrecta.");
      else if (err.code === "auth/requires-recent-login") setError("Sesión expirada. Cierra sesión e ingresa de nuevo.");
      else setError("Error: " + err.message);
    } finally { setCargando(false); }
  };

  if (!user) return null;

  return (
    <div style={s.page}>
      <div style={s.bg} />
      <div style={s.overlay} />
      <div style={s.container}>
        <div style={s.card}>
          <div style={{ textAlign: "center", marginBottom: 10 }}>
            <img src="/logos/logisport.png" alt="LOGISPORT" style={{ height: 52, objectFit: "contain" }}
              onError={e => { e.currentTarget.style.display = "none"; }} />
          </div>

          {esObligatorio && (
            <div style={{ ...s.banner, background: dias === "1" ? "rgba(185,28,28,0.9)" : "rgba(220,38,38,0.85)" }}>
              <span style={{ fontSize: 20 }}>🔐</span>
              <div>
                <div style={{ fontWeight: 800 }}>
                  {dias === "1" ? "¡Tu contraseña vence hoy!" : "Contraseña vencida"}
                </div>
                <div style={{ fontSize: 12, opacity: 0.9 }}>Debes cambiar tu contraseña para continuar.</div>
              </div>
            </div>
          )}
          {esAviso && (
            <div style={{ ...s.banner, background: "rgba(217,119,6,0.85)" }}>
              <span style={{ fontSize: 20 }}>⏰</span>
              <div>
                <div style={{ fontWeight: 800 }}>Tu contraseña vence {Number(dias) === 1 ? "mañana" : `en ${dias} días`}</div>
                <div style={{ fontSize: 12, opacity: 0.9 }}>Te recomendamos cambiarla ahora.</div>
              </div>
            </div>
          )}
          {!esObligatorio && !esAviso && <h2 style={s.titulo}>Cambiar contraseña</h2>}

          <p style={s.emailLabel}>{user.email}</p>

          {exito ? (
            <div style={s.exitoBox}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
              <div style={{ fontWeight: 800, fontSize: 15, color: "#065f46" }}>¡Contraseña actualizada!</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>Ingresando a la aplicación...</div>
            </div>
          ) : (
            <form onSubmit={handleCambiar} style={{ display: "grid", gap: 12, marginTop: 14 }}>
              <div>
                <label style={s.label}>Contraseña actual</label>
                <div style={{ position: "relative" }}>
                  <input type={showActual ? "text" : "password"} value={claveActual} onChange={e => setClaveActual(e.target.value)} style={s.input} placeholder="Tu contraseña actual" required autoFocus />
                  <button type="button" onClick={() => setShowActual(v => !v)} style={s.eye}>{showActual ? "🙈" : "👁️"}</button>
                </div>
              </div>

              <div>
                <label style={s.label}>Nueva contraseña</label>
                <div style={{ position: "relative" }}>
                  <input type={showNueva ? "text" : "password"} value={nuevaClave} onChange={e => setNuevaClave(e.target.value)}
                    style={{ ...s.input, borderColor: nuevaClave.length === 0 ? "rgba(255,255,255,0.3)" : todasOk ? "#10b981" : "#f87171" }}
                    placeholder="Nueva contraseña" required />
                  <button type="button" onClick={() => setShowNueva(v => !v)} style={s.eye}>{showNueva ? "🙈" : "👁️"}</button>
                </div>
                <div style={{ marginTop: 8, padding: "10px 12px", background: "rgba(0,0,0,0.25)", borderRadius: 8, display: "grid", gap: 5 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", marginBottom: 2 }}>Requisitos</div>
                  <ReglaItem ok={reglas.longitud}  texto="Mínimo 8 caracteres" />
                  <ReglaItem ok={reglas.mayuscula} texto="Al menos 1 letra mayúscula" />
                  <ReglaItem ok={reglas.numero}    texto="Al menos 1 número" />
                  <ReglaItem ok={reglas.letra}     texto="Al menos 1 letra" />
                  <ReglaItem ok={nuevaClave.length > 0 && nuevaClave !== claveActual} texto="Diferente a la contraseña actual" />
                </div>
              </div>

              <div>
                <label style={s.label}>Confirmar nueva contraseña</label>
                <div style={{ position: "relative" }}>
                  <input type={showConf ? "text" : "password"} value={confirmar} onChange={e => setConfirmar(e.target.value)}
                    style={{ ...s.input, borderColor: confirmar.length === 0 ? "rgba(255,255,255,0.3)" : coinciden ? "#10b981" : "#f87171" }}
                    placeholder="Repite la nueva contraseña" required />
                  <button type="button" onClick={() => setShowConf(v => !v)} style={s.eye}>{showConf ? "🙈" : "👁️"}</button>
                </div>
                {confirmar.length > 0 && (
                  <div style={{ fontSize: 12, marginTop: 4, color: coinciden ? "#10b981" : "#f87171" }}>
                    {coinciden ? "✓ Las contraseñas coinciden" : "✗ No coinciden"}
                  </div>
                )}
              </div>

              {error && <div style={s.errorBox}>{error}</div>}

              {/* Botón notificar a sistemas — OBLIGATORIO antes de guardar */}
              <div style={{ background: notifEnviada ? "rgba(5,150,105,0.15)" : "rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 12px", border: `1px solid ${notifEnviada ? "rgba(5,150,105,0.5)" : "rgba(255,255,255,0.25)"}` }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginBottom: 8, fontWeight: 600 }}>
                  ⚠️ PASO OBLIGATORIO antes de guardar:
                </div>
                <button type="button" onClick={handleNotificarSistemas}
                  disabled={enviandoNotif || notifEnviada || !todasOk || !coinciden}
                  style={{
                    width: "100%", padding: "10px 12px",
                    background: notifEnviada ? "rgba(5,150,105,0.85)" : todasOk && coinciden ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)",
                    color: "white", border: "1px solid rgba(255,255,255,0.3)",
                    borderRadius: 8, fontWeight: 700, fontSize: 13,
                    cursor: notifEnviada || !todasOk || !coinciden ? "default" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    opacity: !todasOk || !coinciden ? 0.4 : 1,
                  }}>
                  {notifEnviada ? "✅ Notificación enviada a sistemas" : enviandoNotif ? "Enviando..." : "📧 Enviar nueva clave a sistemas"}
                </button>
              </div>

              {/* Botón guardar — solo habilitado si se envió la notificación */}
              <button type="submit"
                disabled={cargando || !notifEnviada}
                title={!notifEnviada ? "Primero debes enviar la notificación a sistemas" : ""}
                style={{ ...s.btn, opacity: cargando || !notifEnviada ? 0.45 : 1, cursor: cargando || !notifEnviada ? "not-allowed" : "pointer" }}>
                {cargando ? "Cambiando contraseña..." : "Cambiar contraseña"}
              </button>

              {esAviso && (
                <button type="button" onClick={irAApp} style={s.btnSaltar}>
                  Ahora no — entrar a la aplicación
                </button>
              )}
            </form>
          )}
        </div>
      </div>
      <div style={s.footer}>© {new Date().getFullYear()} LOGISPORT — Área de Sistemas</div>
    </div>
  );
}

const s = {
  page: { minHeight: "100vh", position: "relative", overflow: "hidden", fontFamily: "Arial, sans-serif" },
  bg: { position: "fixed", inset: 0, backgroundImage: 'url("/logos/login-bg.jpg")', backgroundSize: "cover", backgroundPosition: "center", zIndex: 0 },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 0 },
  container: { minHeight: "100vh", display: "grid", placeItems: "center", padding: 16, position: "relative", zIndex: 1 },
  card: { width: "100%", maxWidth: 420, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 18, padding: "22px 24px", backdropFilter: "blur(16px)", boxShadow: "0 20px 50px rgba(0,0,0,0.35)" },
  banner: { display: "flex", alignItems: "center", gap: 12, color: "white", borderRadius: 10, padding: "11px 14px", marginBottom: 4 },
  titulo: { margin: "6px 0 2px", fontSize: 21, fontWeight: 800, color: "#fff", textAlign: "center" },
  emailLabel: { textAlign: "center", color: "rgba(255,255,255,0.65)", fontSize: 12, margin: "2px 0 0" },
  label: { display: "block", marginBottom: 5, fontWeight: 600, fontSize: 13, color: "rgba(255,255,255,0.85)" },
  input: { width: "100%", padding: "10px 40px 10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.3)", outline: "none", fontSize: 14, background: "rgba(255,255,255,0.9)", color: "#111", boxSizing: "border-box", transition: "border-color 0.2s" },
  eye: { position: "absolute", right: 8, top: 8, background: "transparent", border: "none", cursor: "pointer", fontSize: 17 },
  errorBox: { background: "rgba(220,38,38,0.2)", border: "1px solid rgba(220,38,38,0.5)", color: "#fecaca", borderRadius: 8, padding: "10px 12px", fontSize: 13, fontWeight: 600, textAlign: "center" },
  exitoBox: { textAlign: "center", padding: "24px 0", background: "rgba(255,255,255,0.1)", borderRadius: 12, marginTop: 12 },
  btn: { width: "100%", padding: "11px 12px", background: "#0B3D91", color: "white", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 15 },
  btnSaltar: { width: "100%", padding: "9px 12px", background: "transparent", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 10, fontWeight: 500, fontSize: 13, cursor: "pointer", textAlign: "center" },
  footer: { position: "fixed", bottom: 12, width: "100%", textAlign: "center", color: "#94a3b8", fontSize: 12, zIndex: 10 },
};
