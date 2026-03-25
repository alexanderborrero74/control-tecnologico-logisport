// pages/index.js - Dashboard LOGISPORT con sidebar y servicios pendientes
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, addDoc, serverTimestamp, doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";
import { getUserRoleByUid } from "@/utils/getUserRole";
import { BRAND } from "@/utils/branding";
import LayoutWithSidebar from "@/components/LayoutWithSidebar";
import PageHeader from "@/components/PageHeader";
import ModalContrasena from "@/components/ModalContrasena";
import { 
  FileText, Wrench, HardDrive, Book, BarChart3, 
  Settings, Package, Lock, AlertCircle, CheckCircle,
  Clock, TrendingUp, FileCheck, DollarSign
} from "lucide-react";

// Destino según rol: nomina va directo a liquidar, admin/admin_nomina al dashboard
const destinoNomina = (rol) =>
  rol === "nomina" ? "/nomina/liquidar" : "/nomina";

export default function Dashboard() {
  const router = useRouter();
  const [rol, setRol] = useState("");
  const [pendientes, setPendientes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal contraseña
  const [modalAbierto, setModalAbierto] = useState(false);
  const [errorContrasena, setErrorContrasena] = useState("");

  // Autenticación
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/login"); return; }
      try {
        const userRole = await getUserRoleByUid(user.uid);
        setRol(userRole);
        await addDoc(collection(db, "logins"), {
          uid: user.uid, email: user.email || "",
          rol: userRole, fecha: serverTimestamp(),
        });
      } catch (error) {
        console.error("Error:", error);
        setRol("usuario");
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  // Escuchar servicios pendientes
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "solicitudes"), (snapshot) => {
      const solicitudes = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((d) => {
          const finalizado = String(d.finalizado || "").toLowerCase().trim();
          return finalizado !== "si" && finalizado !== "sí";
        });
      setPendientes(solicitudes);
    });
    return () => unsubscribe();
  }, []);

  // Voz
  useEffect(() => {
    if (pendientes.length > 0) {
      const timer = setTimeout(() => {
        try {
          if (typeof window !== "undefined" && "speechSynthesis" in window) {
            const msg = new SpeechSynthesisUtterance(
              `Hay ${pendientes.length} servicio${pendientes.length > 1 ? "s" : ""} pendiente${pendientes.length > 1 ? "s" : ""} por finalizar`
            );
            const voices = window.speechSynthesis.getVoices();
            const esVoice = voices.find((v) => v.lang.toLowerCase().startsWith("es"));
            if (esVoice) msg.voice = esVoice;
            msg.rate = 1;
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(msg);
          }
        } catch (error) { console.error(error); }
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [pendientes.length]);

  // ── Clic en "Abrir Liquidación" ──────────────────────────────────────────
  const abrirLiquidacion = async () => {
    try {
      const snap = await getDoc(doc(db, "configuracion", "accesos_modulos"));
      const cfg = snap.exists() ? (snap.data()?.modulos?.["nomina-liquidar"] || {}) : {};
      if (cfg.requiereContrasena && cfg.contrasena) {
        setErrorContrasena("");
        setModalAbierto(true);
      } else {
        router.push(destinoNomina(rol));
      }
    } catch {
      setErrorContrasena("Error al verificar. Inténtalo de nuevo.");
    }
  };

  const confirmarContrasena = async (intento) => {
    try {
      const snap = await getDoc(doc(db, "configuracion", "accesos_modulos"));
      const cfg = snap.exists() ? (snap.data()?.modulos?.["nomina-liquidar"] || {}) : {};
      if (String(cfg.contrasena || "") === String(intento)) {
        setModalAbierto(false);
        setErrorContrasena("");
        router.push(destinoNomina(rol));
      } else {
        setErrorContrasena("Contraseña incorrecta. Inténtalo de nuevo.");
      }
    } catch {
      router.push(DESTINO_NOMINA);
    }
  };

  // Accesos rápidos
  const todasLasRutas = [
    { icon: Wrench,    label: "Servicios técnicos",   path: "/servicios-tecnicos",            color: "#0B3D91", roles: ["admin", "tecnico"] },
    { icon: FileText,  label: "Solicitar servicio",    path: "/solicitudserviciotecnico",       color: "#00AEEF", roles: ["admin", "tecnico", "usuario", "nomina"] },
    { icon: FileCheck, label: "Seguimiento códigos",  path: "/seguimiento-codigos-asociados",  color: "#06b6d4", roles: ["admin", "tecnico"] },
    { icon: HardDrive, label: "Hoja de vida equipos", path: "/hoja-vida",                      color: "#10b981", roles: ["admin"] },
    { icon: Book,      label: "Documentación TI",     path: "/documentacionti",                color: "#f59e0b", roles: ["admin", "auditor"] },
    { icon: BarChart3, label: "Estadísticas",          path: "/estadisticas",                   color: "#8b5cf6", roles: ["admin", "auditor"] },
    { icon: BarChart3, label: "Indicadores",           path: "/indicadores-gestion",            color: "#ec4899", roles: ["admin", "auditor"] },
    { icon: BarChart3, label: "Informe de Gestión",    path: "/informe-gestion",                color: "#0ea5e9", roles: ["admin", "auditor"] },
    { icon: Settings,  label: "Cápsulas",              path: "/capsulas-admin",                 color: "#ef4444", roles: ["admin"] },
    { icon: Package,   label: "Licencias",             path: "/licencias",                      color: "#06b6d4", roles: ["admin"] },
    { icon: Lock,      label: "Contraseñas",           path: "/control-de-contrasenas",         color: "#f97316", roles: ["admin"] },
  ];
  const rutasRapidas = todasLasRutas.filter(r => r.roles.includes(rol));

  if (loading) {
    return (
      <LayoutWithSidebar>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ width: "60px", height: "60px", border: "4px solid #e5e7eb", borderTop: "4px solid #0B3D91", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 1rem" }} />
            <p style={{ color: "#6b7280", fontWeight: "600" }}>Cargando dashboard...</p>
          </div>
        </div>
        <style jsx>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </LayoutWithSidebar>
    );
  }

  return (
    <LayoutWithSidebar>
      <PageHeader 
        titulo={`Bienvenido${rol === "admin" ? " - Administrador" : ""}`}
        subtitulo="Panel de control tecnológico LOGISPORT"
      />

      {/* ALERTAS PENDIENTES */}
      {pendientes.length > 0 && ["admin", "tecnico"].includes(rol) && (
        <div style={{ background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)", border: "2px solid #f59e0b", borderRadius: "12px", padding: "1.25rem", marginBottom: "2rem", display: "flex", alignItems: "center", gap: "1rem", boxShadow: "0 4px 12px rgba(245,158,11,0.2)" }}>
          <AlertCircle size={32} style={{ color: "#f59e0b", flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: "800", color: "#92400e" }}>
              {pendientes.length} Servicio{pendientes.length > 1 ? "s" : ""} Pendiente{pendientes.length > 1 ? "s" : ""}
            </h3>
            <p style={{ margin: "0.25rem 0 0 0", color: "#78350f", fontWeight: "600" }}>Hay solicitudes que requieren atención</p>
          </div>
          <button onClick={() => router.push("/servicios-tecnicos")}
            style={{ padding: "0.75rem 1.5rem", background: "#f59e0b", color: "#fff", border: "none", borderRadius: "8px", fontWeight: "700", cursor: "pointer" }}>
            Ver Pendientes
          </button>
        </div>
      )}

      {/* STATS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.5rem", marginBottom: "2rem" }}>
        <StatCard icon={Clock}       label="Pendientes"     value={pendientes.length} color="#f59e0b" bgColor="#fef3c7" />
        <StatCard icon={CheckCircle} label="Sistema Activo" value="Operativo"         color="#10b981" bgColor="#d1fae5" isText />
        <StatCard icon={TrendingUp}  label="Estado"         value="Óptimo"            color="#0B3D91" bgColor="#dbeafe" isText />
      </div>

      {/* ── ACCESO DIRECTO LIQUIDAR NÓMINA ── visible para admin */}
      {["admin", "admin_nomina", "nomina"].includes(rol) && (
        <div style={{
          marginBottom: "1.5rem",
          background: "linear-gradient(135deg, #0B3D91 0%, #00AEEF 100%)",
          borderRadius: "16px", padding: "1.5rem 2rem",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: "1rem",
          boxShadow: "0 8px 24px rgba(11,61,145,0.3)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ width: "56px", height: "56px", borderRadius: "14px", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <DollarSign size={30} color="#fff"/>
            </div>
            <div>
              <h3 style={{ margin: 0, color: "#fff", fontWeight: "800", fontSize: "1.2rem" }}>💰 Liquidar Nómina</h3>
              <p style={{ margin: 0, color: "rgba(255,255,255,0.8)", fontSize: "0.85rem" }}>
                {rol === "nomina" ? "Ir directamente al módulo de liquidación" : "Módulo de liquidación y cálculo de nómina LOGISPORT"}
              </p>
            </div>
          </div>
          <button onClick={abrirLiquidacion}
            style={{
              padding: "0.9rem 2rem", background: "#fff",
              color: "#0B3D91", border: "none", borderRadius: "12px",
              fontWeight: "800", cursor: "pointer", fontSize: "1rem",
              boxShadow: "0 4px 12px rgba(0,0,0,0.2)", transition: "transform 0.15s",
            }}
            onMouseEnter={e => e.currentTarget.style.transform = "scale(1.04)"}
            onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
          >
            Abrir Liquidación →
          </button>
        </div>
      )}

      {/* ACCESOS RÁPIDOS */}
      <div style={{ background: "#fff", borderRadius: "16px", padding: "2rem", boxShadow: "0 4px 12px rgba(0,0,0,0.05)", border: "1px solid #e5e7eb" }}>
        <h2 style={{ margin: "0 0 1.5rem 0", fontSize: "1.5rem", fontWeight: "800", color: "#0B3D91" }}>Accesos Rápidos</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1rem" }}>
          {rutasRapidas.map((ruta, index) => (
            <button key={index} onClick={() => router.push(ruta.path)}
              style={{ padding: "1.25rem", background: "#fff", border: `2px solid ${ruta.color}15`, borderRadius: "12px", cursor: "pointer", transition: "all 0.2s", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem", textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = ruta.color; e.currentTarget.style.background = `${ruta.color}08`; e.currentTarget.style.transform = "translateY(-4px)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = `${ruta.color}15`; e.currentTarget.style.background = "#fff"; e.currentTarget.style.transform = "translateY(0)"; }}
            >
              <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: `${ruta.color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ruta.icon size={24} style={{ color: ruta.color }} />
              </div>
              <span style={{ fontWeight: "700", color: "#1f2937", fontSize: "0.95rem", lineHeight: 1.3 }}>{ruta.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* INFORMACIÓN */}
      <div style={{ marginTop: "2rem", background: "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)", borderRadius: "12px", padding: "1.5rem", border: "1px solid #0B3D9130" }}>
        <p style={{ margin: 0, color: "#0B3D91", fontWeight: "600", textAlign: "center" }}>
          Sistema de Control Tecnológico · {BRAND.clientName} · {new Date().getFullYear()}
        </p>
      </div>

      {/* MODAL CONTRASEÑA */}
      <ModalContrasena
        abierto={modalAbierto}
        modulo="Liquidar Nómina"
        onConfirmar={confirmarContrasena}
        onCancelar={() => { setModalAbierto(false); setErrorContrasena(""); }}
        error={errorContrasena}
      />

      <style jsx>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </LayoutWithSidebar>
  );
}

function StatCard({ icon: Icon, label, value, color, bgColor, isText = false }) {
  return (
    <div style={{ background: "#fff", borderRadius: "12px", padding: "1.5rem", border: `1px solid ${color}20`, boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <div style={{ width: "48px", height: "48px", borderRadius: "10px", background: bgColor, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={24} style={{ color }} />
        </div>
        <div>
          <div style={{ fontSize: isText ? "1.25rem" : "2rem", fontWeight: "800", color: "#1f2937", lineHeight: 1 }}>{value}</div>
          <div style={{ fontSize: "0.875rem", color: "#6b7280", marginTop: "0.25rem", fontWeight: "600" }}>{label}</div>
        </div>
      </div>
    </div>
  );
}
