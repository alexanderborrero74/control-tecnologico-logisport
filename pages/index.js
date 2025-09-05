// Archivo completo: pages/index.js – Hover menú de pendientes + Acceso a nube (nueva pestaña)
// Mantiene tu lógica y estilos. Solo:
// 1) El tooltip de pendientes muestra lista (usuario + descripción)
// 2) Botón "Acceso a nube" abre https://192.168.1.244/cgi-bin/ en nueva pestaña, azul oscuro

import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import {
  collection,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import { db } from "@/firebase/firebaseConfig";
import { getUserRoleByUid } from "@/utils/getUserRole";

// === Fallback robusto para BRAND ===
let BRAND = { appName: "Nexo TI", subtitle: "Control Tecnológico", logoUrl: "/nexoti-logo.png?v=2" };
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Branding = require("@/utils/branding");
  const candidate = Branding?.BRAND || Branding?.default || Branding;
  if (candidate && typeof candidate === "object") {
    BRAND = {
      appName: candidate.appName || BRAND.appName,
      subtitle: candidate.subtitle || BRAND.subtitle,
      logoUrl: candidate.logoUrl || BRAND.logoUrl,
      tenants: candidate.tenants || BRAND.tenants,
    };
  }
} catch {}

const contenedorStyle = {
  maxWidth: 1100,
  margin: "0 auto",
  padding: 16,
  position: "relative",
  zIndex: 1,
};

const headerStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 20,
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 16,
  paddingTop: 24,
};

const cardStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 20,
  boxShadow: "0 10px 24px rgba(0,0,0,0.08)",
};

const infoStyle = { fontSize: 14, color: "#555" };

const footerStyle = {
  position: "fixed",
  left: 0,
  right: 0,
  bottom: 0,
  background: "#fff",
  borderTop: "1px solid rgba(0,0,0,0.06)",
  padding: "10px 16px",
  display: "flex",
  justifyContent: "center",
  zIndex: 2,
};

export default function ControlTecnologico() {
  const router = useRouter();

  const [rol, setRol] = useState("");
  const [cargandoRol, setCargandoRol] = useState(true);

  const [pendientes, setPendientes] = useState([]);
  const [mostrarTooltip, setMostrarTooltip] = useState(false);

  const [companyLogoUrl, setCompanyLogoUrl] = useState("");

  const spokePendingRef = useRef(false);
  useEffect(() => {
    spokePendingRef.current = false;
  }, []);
  useEffect(() => {
    if (pendientes.length > 0 && !spokePendingRef.current) {
      const t = setTimeout(() => {
        try {
          if (typeof window !== "undefined" && "speechSynthesis" in window) {
            const msg = new SpeechSynthesisUtterance("Hay servicios pendientes por finalizar");
            const voices = window.speechSynthesis.getVoices();
            const es = voices.find((v) => (v.lang || "").toLowerCase().startsWith("es"));
            if (es) msg.voice = es;
            msg.rate = 1;
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(msg);
          }
        } catch {}
        spokePendingRef.current = true;
      }, 5000);
      return () => clearTimeout(t);
    }
  }, [pendientes]);

  const cerrarSesion = async () => {
    const auth = getAuth();
    await signOut(auth);
    router.push("/login");
  };

  const guessCompanyLogo = (email) => {
    if (!email) return "";
    const domain = String(email.split("@")[1] || "").toLowerCase().trim();
    if (!domain) return "";
    const t = BRAND?.tenants?.[domain];
    if (t?.logoUrl) return t.logoUrl;
    return `/logos/${domain}.png`;
  };

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setCompanyLogoUrl("");
        router.push("/login");
        return;
      }
      try {
        const r = await getUserRoleByUid(u.uid);
        setRol(r);
        setCargandoRol(false);
        setCompanyLogoUrl(guessCompanyLogo(u.email));

        try {
          await addDoc(collection(db, "logins"), {
            uid: u.uid,
            email: u.email || "",
            rol: r,
            fecha: serverTimestamp(),
          });
        } catch {}
      } catch (e) {
        setRol("usuario");
        setCargandoRol(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    let timeoutId;
    const logout = async () => {
      try {
        const auth = getAuth();
        await signOut(auth);
      } finally {
        router.push("/login");
      }
    };
    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(logout, 5 * 60 * 1000);
    };
    const eventos = ["mousemove", "keydown", "click", "scroll"];
    eventos.forEach((e) => window.addEventListener(e, resetTimer));
    resetTimer();
    return () => {
      clearTimeout(timeoutId);
      eventos.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  }, [router]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "solicitudes"), (snapshot) => {
      const activos = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter(
          (doc) =>
            !doc.finalizado ||
            String(doc.finalizado).toLowerCase().trim() !== "si"
        );
      setPendientes(activos);
    });
    return () => unsub();
  }, []);

  const rutasAdmin = [
    { ruta: "/servicios-tecnicos", label: "Servicios técnicos" },
    { ruta: "/solicitudserviciotecnico", label: "Solicitud de servicio técnico" },
    { ruta: "/hoja-vida", label: "Hoja de vida de equipos" },
    { ruta: "/licencias", label: "Licencias / Software" },
    { ruta: "/estadisticas", label: "Estadísticas" },
    { ruta: "/capsulas-admin", label: "Cápsulas (admin)" },
    { ruta: "/trazabilidad-logins", label: "Trazabilidad de logins" },
    { ruta: "/control-de-contrasenas", label: "control de contraseñas" },
    { ruta: "/inventario", label: "Inventario tecnologico" },
    { ruta: "/registro-fotografico", label: "Registro fotografico" },
    { ruta: "/usuario-aplicaciones-licencias", label: "TI Implementado" },
  ];
  const rutasUsuario = [{ ruta: "/solicitudserviciotecnico", label: "Solicitud de servicio técnico" }];

  const rutasMostrar = rol === "admin" ? rutasAdmin : rutasUsuario;

  const manejarNavegacion = (ruta) => router.push(ruta);

  const handleLogoError = (e) => {
    const curr = e.currentTarget.getAttribute("src") || "";
    if (!curr.includes("nexoti-logo.png")) {
      e.currentTarget.src = "/nexoti-logo.png?v=2";
    } else if (!curr.includes("nexoti-logo.svg")) {
      e.currentTarget.src = "/nexoti-logo.svg?v=2";
    } else {
      e.currentTarget.src = "/logo1.png";
    }
  };

  const headerLogoSrc = BRAND.logoUrl || "/nexoti-logo.png?v=2";
  const watermarkUrl = headerLogoSrc;

  const watermarkStyle = {
    position: "fixed",
    inset: 0,
    backgroundImage: `url(${watermarkUrl})`,
    backgroundSize: "min(70vw, 900px)",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    backgroundAttachment: "fixed",
    opacity: 0.06,
    filter: "grayscale(100%)",
    pointerEvents: "none",
    zIndex: 0,
  };

  return (
    <>
      <div aria-hidden style={watermarkStyle} />

      <div style={contenedorStyle}>
        <header style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* <img src={headerLogoSrc} onError={handleLogoError} alt="Logo" style={{ height: 48 }} /> */}
            <div>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 800,
                  color: "#2c3e9e",
                  lineHeight: "1.1",
                }}
              >
                {BRAND.appName}
              </div>
              <div
                style={{ fontSize: 14, color: "#4b5563", marginTop: 4 }}
              >
                {BRAND.subtitle}
              </div>
            </div>
          </div>

          {/* Botones: Acceso a nube (nueva pestaña) + Cerrar sesión */}
          <div style={{ display: "flex", gap: 8 }}>
            <a
              href="http://logisportsas.ddns.net:5000/"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: "#1e3a8a",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "10px 14px",
                cursor: "pointer",
                display: "inline-block",
                textDecoration: "none",
              }}
            >
              Acceso a nube
            </a>
            <button
              onClick={cerrarSesion}
              style={{
                background: "#ef4444",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "10px 14px",
                cursor: "pointer",
              }}
            >
              Cerrar sesión
            </button>
          </div>
        </header>

        <div style={cardStyle}>
          <div style={infoStyle}>
            Bienvenido al panel principal. Selecciona una opción para continuar.
          </div>

          <div style={gridStyle}>
            {rutasMostrar.map((item, i) => (
              <button key={i} style={botonStyle} onClick={() => manejarNavegacion(item.ruta)}>
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {pendientes.length > 0 && (
          <div
            onMouseEnter={() => setMostrarTooltip(true)}
            onMouseLeave={() => setMostrarTooltip(false)}
            style={{
              position: "fixed",
              bottom: 54,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 1000,
            }}
          >
            <div style={{ position: "relative", display: "inline-block" }}>
              {mostrarTooltip && (
                <div
                  style={{
                    position: "absolute",
                    bottom: "calc(100% + 10px)",
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "#111827",
                    color: "#fff",
                    padding: "6px 10px",
                    borderRadius: 8,
                    fontSize: 12,
                    whiteSpace: "nowrap",
                    boxShadow: "0 6px 16px rgba(0,0,0,0.2)",
                  }}
                >
                  Servicios pendientes: coloca el cursor para ver detalles.
                </div>
              )}

              <button
                id="btn-pendientes"
                style={{
                  padding: "12px 20px",
                  background: "#f59e0b",
                  color: "#111827",
                  border: "none",
                  borderRadius: 10,
                  fontWeight: "bold",
                  cursor: "pointer",
                  boxShadow: "0 8px 18px rgba(0,0,0,0.15)",
                }}
              >
                🔔 {pendientes.length} Pendientes
              </button>

              {mostrarTooltip && (
                <div
                  style={{
                    position: "absolute",
                    bottom: "calc(100% + 12px)",
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "#ffffff",
                    color: "#111827",
                    width: 320,
                    maxHeight: 360,
                    overflow: "auto",
                    borderRadius: 10,
                    border: "1px solid #e5e7eb",
                    boxShadow: "0 12px 28px rgba(0,0,0,0.18)",
                    padding: 10,
                    fontSize: 13,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <strong>Servicios pendientes</strong>
                    <span
                      style={{
                        background: "#ef4444",
                        color: "#fff",
                        borderRadius: 999,
                        padding: "0 8px",
                        height: 22,
                        minWidth: 22,
                        display: "grid",
                        placeItems: "center",
                        fontSize: 12,
                      }}
                    >
                      {pendientes.length}
                    </span>
                  </div>

                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
                    {pendientes.length === 0 && (
                      <li style={{ color: "#6b7280" }}>No hay pendientes.</li>
                    )}
                    {pendientes.map((p) => (
                      <li
                        key={p.id}
                        style={{
                          background: "#f9fafb",
                          border: "1px solid #eef2f7",
                          borderRadius: 8,
                          padding: "8px 10px",
                        }}
                      >
                        <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {p?.nombre || p?.usuario || p?.cliente || "—"}
                        </div>
                        <div style={{ color: "#374151", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={p?.descripcion || p?.detalle || p?.asunto || ""}>
                          {p?.descripcion || p?.detalle || p?.asunto || "(Sin descripción)"}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <footer style={footerStyle}>
        <span translate="no">© 2025 Derechos reservados - Alexander Borrero</span>
      </footer>
    </>
  );
}

const botonStyle = {
  backgroundColor: "#3498db",
  color: "white",
  padding: "12px",
  borderRadius: "8px",
  border: "none",
  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
  cursor: "pointer",
};
