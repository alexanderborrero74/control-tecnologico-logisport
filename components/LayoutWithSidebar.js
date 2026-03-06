// components/LayoutWithSidebar.js
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import { getUserRoleByUid } from "@/utils/getUserRole";
import { 
  Home, Wrench, FileText, HardDrive, Settings, Book,
  BarChart3, Package, Lock, CloudUpload, LogOut, Menu, X,
  ChevronRight, ChevronDown, Database, Image, Users, FileCheck,
  FolderOpen, Monitor, ClipboardList, DollarSign, UserCheck,
  CalendarDays, CreditCard, Printer, TrendingUp, UsersRound, SlidersHorizontal
} from "lucide-react";
import { BRAND } from "@/utils/branding";
import CapsulaEmergente from "@/components/CapsulaEmergente";


const PRIMARY = "#0B3D91";

export default function LayoutWithSidebar({ children }) {
  const router = useRouter();
  const [usuario, setUsuario] = useState(null);
  const [rol, setRol] = useState("usuario");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [nominaExpanded, setNominaExpanded] = useState(false);

  // (gate de contraseñas manejado globalmente por GateModulo en _app.js)

  // Expandir automaticamente si estamos en una ruta de nomina
  useEffect(() => {
    if (router.pathname.startsWith("/nomina")) {
      setNominaExpanded(true);
    }
  }, [router.pathname]);

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUsuario({
          email: user.email,
          nombre: user.displayName || user.email?.split("@")[0] || "Usuario",
        });
        try {
          const userRole = await getUserRoleByUid(user.uid);
          setRol(userRole);
        } catch (error) {
          console.error("Error obteniendo rol:", error);
          setRol("usuario");
        }
      } else {
        router.push("/login");
      }
    });
    return () => unsub();
  }, [router]);

  // Navegacion: el gate global en _app.js (GateModulo) se encarga de las contrasenas.
  // El sidebar simplemente navega. Admin siempre pasa sin bloqueo.
  const handleNavegar = (path) => {
    router.push(path);
  };

  const handleLogout = async () => {
    const auth = getAuth();
    await signOut(auth);
    router.push("/login");
  };

  const rolesNomina = ["admin", "admin_nomina", "rrhh", "usuario", "nomina"];
  const puedeVerNomina = rolesNomina.includes(rol);

  const menuItems = [
    { icon: Home, label: "Inicio", path: "/", roles: ["admin", "tecnico", "auditor", "usuario", "nomina"] },
    { icon: Wrench, label: "Servicios técnicos", path: "/servicios-tecnicos", roles: ["admin", "tecnico"] },
    { icon: FileText, label: "Solicitud de servicio", path: "/solicitudserviciotecnico", roles: ["admin", "tecnico", "usuario", "nomina"] },
    { icon: ClipboardList, label: "Admin Solicitudes", path: "/admin-solicitudes", roles: ["admin"] },
    { icon: FileCheck, label: "Seguimiento códigos", path: "/seguimiento-codigos-asociados", roles: ["admin", "tecnico"] },
    { icon: Monitor, label: "Monitoreo", path: "/monitoreo", roles: ["admin"] },
    { icon: HardDrive, label: "Hoja de vida equipos", path: "/hoja-vida", roles: ["admin"] },
    { icon: Book, label: "Documentación TI", path: "/documentacionti", roles: ["admin", "auditor"] },
    { icon: BarChart3, label: "Estadísticas", path: "/estadisticas", roles: ["admin", "auditor"] },
    { icon: BarChart3, label: "Indicadores", path: "/indicadores-gestion", roles: ["admin", "auditor"] },
    { icon: BarChart3, label: "Informe de Gestión", path: "/informe-gestion", roles: ["admin", "auditor"] },
    { icon: Settings, label: "Cápsulas", path: "/capsulas-admin", roles: ["admin", "auditor"] },
    { icon: Package, label: "Licencias", path: "/licencias", roles: ["admin", "auditor"] },
    { icon: Lock, label: "Contraseñas", path: "/control-de-contrasenas", roles: ["admin"] },
    { icon: CloudUpload, label: "Acceso a nube", path: "/nube", roles: ["admin"] },
    { icon: Database, label: "Trazabilidad logins", path: "/trazabilidad-logins", roles: ["admin"] },
    { icon: Image, label: "Registro fotográfico", path: "/registro-fotografico", roles: ["admin"] },
    { icon: Users, label: "Admin Usuarios", path: "/admin-usuarios", roles: ["admin"] },
    { icon: Settings, label: "TI Implementado", path: "/ti-implementado", roles: ["admin"] },
  ].filter(item => item.roles.includes(rol));

  const subMenuNominaAll = [
    { icon: Home,         label: "Dashboard",           path: "/nomina",              roles: ["admin", "admin_nomina", "rrhh", "usuario", "nomina"] },
    { icon: UserCheck,    label: "Trabajadores",         path: "/nomina/trabajadores", roles: ["admin", "admin_nomina", "rrhh", "nomina"] },
    { icon: UsersRound,   label: "Listado de Asistencia", path: "/nomina/asistencia",   roles: ["admin", "admin_nomina", "rrhh", "nomina"] },
    { icon: ClipboardList,label: "Servicios y Tarifas",  path: "/nomina/servicios",    roles: ["admin", "admin_nomina", "nomina"] },
    { icon: TrendingUp,   label: "Matriz",                path: "/nomina/matriz",       roles: ["admin", "admin_nomina", "nomina"] },
    { icon: DollarSign,   label: "Liquidar Nómina",     path: "/nomina/liquidar",     roles: ["admin", "admin_nomina", "nomina"] },
    { icon: CalendarDays, label: "Historial Nóminas",   path: "/nomina/historial",    roles: ["admin", "admin_nomina", "rrhh", "usuario", "nomina"] },
    { icon: CreditCard,   label: "Adelantos",            path: "/nomina/adelantos",   roles: ["admin", "admin_nomina", "rrhh", "nomina"] },
    { icon: Printer,           label: "Desprendibles",  path: "/nomina/desprendibles",roles: ["admin", "admin_nomina", "rrhh", "usuario", "nomina"] },
    { icon: SlidersHorizontal, label: "Administrar",    path: "/nomina/administrar",  roles: ["admin", "admin_nomina", "nomina"] },
  ];
  const subMenuNomina = subMenuNominaAll.filter(m => m.roles.includes(rol));

  const isNominaActive = router.pathname.startsWith("/nomina");

  const btnStyle = (isActive) => ({
    width: "100%",
    padding: collapsed ? "0.75rem 0.5rem" : "0.75rem 1rem",
    background: isActive ? "rgba(255,255,255,0.15)" : "transparent",
    border: "none",
    borderLeft: isActive ? "4px solid #00AEEF" : "4px solid transparent",
    color: "#fff",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    fontSize: "0.95rem",
    fontWeight: isActive ? "600" : "400",
    transition: "all 0.2s ease",
    textAlign: "left",
  });

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f5f7fb" }}>
      {/* SIDEBAR DESKTOP */}
      <aside
        style={{
          width: collapsed ? "80px" : "280px",
          background: `linear-gradient(180deg, ${PRIMARY} 0%, #082d6b 100%)`,
          color: "#fff",
          transition: "width 0.3s ease",
          display: "flex",
          flexDirection: "column",
          position: "fixed",
          height: "100vh",
          zIndex: 1000,
          boxShadow: "4px 0 12px rgba(0,0,0,0.1)",
        }}
        className="sidebar-desktop"
      >
        {/* Header */}
        <div style={{
          padding: collapsed ? "1.5rem 0.5rem" : "1.5rem 1rem",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          {!collapsed && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div style={{ background: "#fff", borderRadius: "8px", padding: "6px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <img src={BRAND.logoUrl} alt={BRAND.clientName} style={{ width: "32px", height: "32px", objectFit: "contain" }} />
              </div>
              <div>
                <div style={{ fontWeight: "800", fontSize: "1.1rem", lineHeight: 1 }}>{BRAND.clientName}</div>
                <div style={{ fontSize: "0.75rem", opacity: 0.8 }}>{BRAND.subtitle}</div>
              </div>
            </div>
          )}
          <button onClick={() => setCollapsed(!collapsed)} style={{
            background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "6px",
            padding: "0.5rem", cursor: "pointer", color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <ChevronRight size={20} style={{ transform: collapsed ? "rotate(0deg)" : "rotate(180deg)", transition: "transform 0.3s ease" }} />
          </button>
        </div>

        {/* Navegación */}
        <nav style={{ flex: 1, overflowY: "auto", padding: "1rem 0" }}>

          {/* ══════════════════════════════════════════
               MODO NÓMINA: sidebar exclusivo
          ══════════════════════════════════════════ */}
          {isNominaActive ? (
            <>
              {/* Botón volver al menú principal */}
              <button
                onClick={() => handleNavegar("/")}
                style={{
                  width: "100%",
                  padding: collapsed ? "0.75rem 0.5rem" : "0.75rem 1rem",
                  background: "rgba(255,255,255,0.08)",
                  border: "none",
                  borderBottom: "1px solid rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.7)",
                  cursor: "pointer",
                  display: "flex", alignItems: "center",
                  gap: "0.75rem",
                  fontSize: "0.85rem",
                  fontWeight: "500",
                  marginBottom: "0.5rem",
                  transition: "all 0.2s",
                }}
                onMouseEnter={e => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.background = "rgba(255,255,255,0.14)"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.7)"; e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
              >
                <ChevronRight size={18} style={{ transform: "rotate(180deg)", flexShrink: 0 }} />
                {!collapsed && <span>Menú principal</span>}
              </button>

              {/* Título sección */}
              {!collapsed && (
                <div style={{
                  padding: "0.5rem 1rem 0.75rem",
                  fontSize: "0.7rem", fontWeight: "800", letterSpacing: "0.12em",
                  color: "#00AEEF", textTransform: "uppercase",
                  display: "flex", alignItems: "center", gap: "0.5rem",
                }}>
                  <DollarSign size={14} />
                  LIQUIDACIÓN NÓMINA
                </div>
              )}

              {/* Items del menú nómina */}
              {subMenuNomina.map((sub, i) => {
                const isSubActive = router.pathname === sub.path;
                return (
                  <button key={i} onClick={() => handleNavegar(sub.path)}
                    style={{
                      width: "100%",
                      padding: collapsed ? "0.75rem 0.5rem" : "0.75rem 1rem",
                      background: isSubActive ? "rgba(0,174,239,0.2)" : "transparent",
                      border: "none",
                      borderLeft: isSubActive ? "4px solid #00AEEF" : "4px solid transparent",
                      color: isSubActive ? "#00AEEF" : "#fff",
                      cursor: "pointer",
                      display: "flex", alignItems: "center",
                      gap: "0.75rem",
                      fontSize: "0.95rem",
                      fontWeight: isSubActive ? "700" : "400",
                      transition: "all 0.2s",
                      textAlign: "left",
                    }}
                    onMouseEnter={e => { if (!isSubActive) { e.currentTarget.style.background = "rgba(0,174,239,0.1)"; } }}
                    onMouseLeave={e => { if (!isSubActive) { e.currentTarget.style.background = "transparent"; } }}
                  >
                    <sub.icon size={20} style={{ flexShrink: 0 }} />
                    {!collapsed && <span>{sub.label}</span>}
                  </button>
                );
              })}
            </>
          ) : (
            /* ══════════════════════════════════════════
               MODO NORMAL: menú principal completo
            ══════════════════════════════════════════ */
            <>
              {menuItems.map((item, idx) => {
                const isActive = router.pathname === item.path;
                return (
                  <button key={idx} onClick={() => handleNavegar(item.path)} style={btnStyle(isActive)}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
                    <item.icon size={20} style={{ flexShrink: 0 }} />
                    {!collapsed && <span>{item.label}</span>}
                  </button>
                );
              })}

              {/* Acceso rápido a Nómina desde menú principal */}
              {puedeVerNomina && (
                <>
                  {!collapsed && (
                    <div style={{
                      padding: "0.75rem 1rem 0.25rem",
                      fontSize: "0.7rem", fontWeight: "700", letterSpacing: "0.1em",
                      color: "rgba(255,255,255,0.45)", textTransform: "uppercase",
                      marginTop: "0.5rem",
                    }}>
                      ── Liquidación Nómina ──
                    </div>
                  )}
                  <button
                    onClick={() => handleNavegar("/nomina")}
                    style={btnStyle(false)}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,174,239,0.15)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <DollarSign size={20} style={{ flexShrink: 0 }} />
                    {!collapsed && <span>Liquidación Nómina</span>}
                  </button>
                </>
              )}
            </>
          )}
        </nav>

        {/* Footer */}
        <div style={{ padding: collapsed ? "1rem 0.5rem" : "1rem", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          {!collapsed && usuario && (
            <div style={{ marginBottom: "0.75rem", fontSize: "0.85rem", opacity: 0.9 }}>
              <div style={{ fontWeight: "600" }}>{usuario.nombre}</div>
              <div style={{ fontSize: "0.75rem", opacity: 0.7 }}>{usuario.email}</div>
              <div style={{
                marginTop: "0.5rem", padding: "4px 8px", borderRadius: "6px",
                fontSize: "0.7rem", fontWeight: "700", textTransform: "uppercase",
                textAlign: "center",
                background: rol === "admin" ? "#ef4444" :
                           rol === "tecnico" ? "#3b82f6" :
                           rol === "auditor" ? "#f59e0b" :
                           rol === "admin_nomina" ? "#10b981" :
                           rol === "rrhh" ? "#8b5cf6" :
                           rol === "nomina" ? "#0ea5e9" : "#6b7280",
                color: "#fff",
              }}>
                {rol === "admin" ? "🔑 Admin" :
                 rol === "tecnico" ? "🔧 Técnico" :
                 rol === "auditor" ? "📊 Auditor" :
                 rol === "admin_nomina" ? "💰 Admin Nómina" :
                 rol === "rrhh" ? "👥 RRHH" :
                 rol === "nomina" ? "📋 Nómina" : "👤 Usuario"}
              </div>
            </div>
          )}
          <button onClick={handleLogout} style={{
            width: "100%", padding: "0.75rem",
            background: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: "8px", color: "#fff", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: "0.5rem", fontWeight: "600", fontSize: "0.9rem",
          }}>
            <LogOut size={18} />
            {!collapsed && "Cerrar sesión"}
          </button>
        </div>
      </aside>

      {/* CONTENIDO */}
      <main style={{
        marginLeft: collapsed ? "80px" : "280px",
        flex: 1, padding: "2rem",
        transition: "margin-left 0.3s ease", minHeight: "100vh",
      }} className="main-content">
        {children}
      </main>

      {/* Mobile */}
      <style jsx global>{`
        @media (max-width: 768px) {
          .sidebar-desktop { transform: translateX(-100%); width: 280px !important; }
          .sidebar-desktop.mobile-open { transform: translateX(0); }
          .main-content { margin-left: 0 !important; }
        }
      `}</style>

      <button
        onClick={() => {
          setMobileOpen(!mobileOpen);
          const sidebar = document.querySelector('.sidebar-desktop');
          if (sidebar) sidebar.classList.toggle('mobile-open');
        }}
        style={{
          position: "fixed", top: "1rem", left: "1rem", zIndex: 1001,
          background: PRIMARY, border: "none", borderRadius: "8px",
          padding: "0.75rem", color: "#fff", cursor: "pointer",
          display: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        }}
        className="mobile-menu-btn"
      >
        {mobileOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      <style jsx global>{`
        @media (max-width: 768px) {
          .mobile-menu-btn { display: flex !important; align-items: center; justify-content: center; }
        }
      `}</style>
      <CapsulaEmergente />


    </div>
  );
}
