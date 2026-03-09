// pages/nomina/index.js
// Dashboard principal del módulo NÓMINA
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";
import { getUserRoleByUid } from "@/utils/getUserRole";
import LayoutWithSidebar from "@/components/LayoutWithSidebar";
import { moduloDePath } from "@/utils/accesoModulos";
import { formatCOP } from "@/utils/nominaCalculos";
import {
  Users, DollarSign, ClipboardList, TrendingUp,
  FileText, ArrowRight, Calendar, CreditCard, AlertCircle, UsersRound, SlidersHorizontal, Building2
} from "lucide-react";

const PRIMARY = "#0B3D91";
const ACCENT = "#00AEEF";

export default function NominaIndex() {
  const router = useRouter();
  const [rol, setRol] = useState(null);
  const [stats, setStats] = useState(null);
  const [ultimoPeriodo, setUltimoPeriodo] = useState(null);
  const [loading, setLoading] = useState(true);



  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/login"); return; }
      const r = await getUserRoleByUid(user.uid);
      setRol(r);
      if (!["admin", "admin_nomina", "rrhh", "usuario", "nomina"].includes(r)) {
        router.push("/");
        return;
      }
      await cargarStats();
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // GateModulo en _app.js protege automáticamente cualquier ruta con contraseña.
  // Aquí solo navegamos; si la ruta tiene clave, GateModulo la interceptará.
  const handleNavegar = (path) => router.push(path);

  const cargarStats = async () => {
    try {
      const [trabSnap, svcSnap, periodosSnap, adelantosSnap] = await Promise.all([
        getDocs(collection(db, "nomina_trabajadores")),
        getDocs(collection(db, "nomina_servicios")),
        getDocs(query(collection(db, "nomina_periodos"), orderBy("creadoEn", "desc"), limit(1))),
        getDocs(query(collection(db, "nomina_adelantos"), orderBy("fecha", "desc"), limit(50))),
      ]);
      
      let totalNomina = 0;
      let totalAdelantos = 0;
      let ultimoP = null;

      if (!periodosSnap.empty) {
        const p = periodosSnap.docs[0].data();
        ultimoP = { id: periodosSnap.docs[0].id, ...p };
        totalNomina = p.totalGeneral || 0;
        setUltimoPeriodo(ultimoP);
      }

      adelantosSnap.docs.forEach(d => {
        const a = d.data();
        if (a.estado === "pendiente") totalAdelantos += (a.monto || 0);
      });

      setStats({
        totalTrabajadores: trabSnap.size,
        totalServicios: svcSnap.size,
        totalNomina,
        totalAdelantos,
        ultimoPeriodo: ultimoP,
      });
    } catch (e) {
      console.error(e);
    }
  };

  const modulos = [
    {
      titulo: "Trabajadores",
      descripcion: "Gestión de empleados activos",
      icon: Users,
      color: "#3b82f6",
      path: "/nomina/trabajadores",
      roles: ["admin", "admin_nomina", "rrhh", "nomina"],
    },
    {
      titulo: "Listado de Asistencia",
      descripcion: "Composición de cuadrillas y motivos de ausencia",
      icon: UsersRound,
      color: "#0ea5e9",
      path: "/nomina/asistencia",
      roles: ["admin", "admin_nomina", "nomina"],
    },
    {
      titulo: "Servicios y Tarifas",
      descripcion: "Catálogo de servicios con valores",
      icon: ClipboardList,
      color: "#8b5cf6",
      path: "/nomina/servicios",
      roles: ["admin", "admin_nomina", "nomina"],
    },
    {
      titulo: "Matriz",
      descripcion: "Registro diario de operaciones por cuadrilla",
      icon: TrendingUp,
      color: "#10b981",
      path: "/nomina/matriz",
      roles: ["admin", "admin_nomina", "nomina"],
    },
    {
      titulo: "Liquidar Nómina",
      descripcion: "Generar nómina por período · un cliente a la vez",
      icon: DollarSign,
      color: "#f59e0b",
      path: "/nomina/liquidar",
      roles: ["admin", "admin_nomina", "nomina"],
    },
    {
      titulo: "Liquidación Unificada 🆕",
      descripcion: "Todos los clientes en una sola nómina · detalle producción por operación",
      icon: FileText,
      color: "#0B3D91",
      path: "/nomina/liquidar_unificada",
      roles: ["admin", "admin_nomina", "nomina"],
    },
    {
      titulo: "Historial de Nóminas",
      descripcion: "Consultar períodos anteriores",
      icon: Calendar,
      color: "#6366f1",
      path: "/nomina/historial",
      roles: ["admin", "admin_nomina", "rrhh", "usuario", "nomina"],
    },
    {
      titulo: "Adelantos y Comida",
      descripcion: "Adelantos de salario y descuentos por comida",
      icon: CreditCard,
      color: "#ef4444",
      path: "/nomina/adelantos",
      roles: ["admin", "admin_nomina", "rrhh", "nomina"],
    },
    {
      titulo: "Desprendibles",
      descripcion: "Comprobantes de pago por empleado",
      icon: FileText,
      color: "#14b8a6",
      path: "/nomina/desprendibles",
      roles: ["admin", "admin_nomina", "rrhh", "usuario", "nomina"],
    },
    {
      titulo: "Administrar",
      descripcion: "Cargos, cuadrillas, motivos y observaciones",
      icon: SlidersHorizontal,
      color: "#64748b",
      path: "/nomina/administrar",
      roles: ["admin", "admin_nomina", "nomina"],
    },
    {
      titulo: "Clientes",
      descripcion: "SPIA, Cliente 1, Cliente 2, Cliente 3 — editar nombres e inicializar datos",
      icon: Building2,
      color: "#7c3aed",
      path: "/nomina/clientes",
      roles: ["admin", "admin_nomina"],
    },
  ];

  const modulosVisibles = modulos.filter(m => m.roles.includes(rol));

  if (loading) return (
    <LayoutWithSidebar>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: PRIMARY }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>💰</div>
          <div style={{ fontWeight: "700", fontSize: "1.2rem" }}>Cargando Liquidación Nómina...</div>
        </div>
      </div>
    </LayoutWithSidebar>
  );

  return (
    <LayoutWithSidebar>
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{
          background: `linear-gradient(135deg, ${PRIMARY} 0%, #1a56c4 100%)`,
          borderRadius: "16px",
          padding: "2rem",
          marginBottom: "2rem",
          color: "#fff",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "2rem", fontWeight: "800" }}>💰 LIQUIDACIÓN NÓMINA</h1>
            <p style={{ margin: "0.5rem 0 0", opacity: 0.9 }}>
              Gestión integral de nómina — LOGISPORT S.A.S.
            </p>
            {ultimoPeriodo && (
              <div style={{
                marginTop: "0.75rem",
                background: "rgba(255,255,255,0.15)",
                borderRadius: "8px",
                padding: "0.5rem 1rem",
                display: "inline-block",
                fontSize: "0.9rem",
              }}>
                📅 Último período: <strong>{ultimoPeriodo.nombre}</strong>
              </div>
            )}
          </div>
          {rol === "admin" || rol === "admin_nomina" || rol === "nomina" ? (
            <button
              onClick={() => handleNavegar("/nomina/liquidar")}
              style={{
                background: ACCENT,
                border: "none",
                borderRadius: "10px",
                padding: "0.9rem 1.5rem",
                color: "#fff",
                fontWeight: "700",
                cursor: "pointer",
                fontSize: "1rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <DollarSign size={20} /> Nueva Nómina
            </button>
          ) : null}
        </div>

        {/* Stats */}
        {stats && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1.25rem",
            marginBottom: "2rem",
          }}>
            {[
              { label: "Trabajadores", value: stats.totalTrabajadores, icon: "👷", color: "#3b82f6" },
              { label: "Servicios", value: stats.totalServicios, icon: "📋", color: "#8b5cf6" },
              { label: "Último total nómina", value: formatCOP(stats.totalNomina), icon: "💵", color: "#10b981" },
              { label: "Adelantos pendientes", value: formatCOP(stats.totalAdelantos), icon: "⚠️", color: "#ef4444" },
            ].map((s, i) => (
              <div key={i} style={{
                background: "#fff",
                borderRadius: "12px",
                padding: "1.5rem",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                borderLeft: `4px solid ${s.color}`,
              }}>
                <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>{s.icon}</div>
                <div style={{ fontSize: "1.4rem", fontWeight: "800", color: s.color }}>{s.value}</div>
                <div style={{ color: "#64748b", fontSize: "0.85rem", fontWeight: "600" }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Módulos */}
        <h2 style={{ color: PRIMARY, marginBottom: "1rem", fontWeight: "700" }}>Módulos disponibles</h2>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "1.25rem",
        }}>
          {modulosVisibles.map((m, i) => (
            <div
              key={i}
              onClick={() => handleNavegar(m.path)}
              style={{
                background: "#fff",
                borderRadius: "14px",
                padding: "1.5rem",
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                border: "1px solid #e2e8f0",
                transition: "all 0.2s ease",
                display: "flex",
                alignItems: "center",
                gap: "1rem",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.boxShadow = `0 8px 24px rgba(0,0,0,0.12)`;
                e.currentTarget.style.transform = "translateY(-3px)";
                e.currentTarget.style.borderColor = m.color;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.borderColor = "#e2e8f0";
              }}
            >
              <div style={{
                width: "54px",
                height: "54px",
                background: `${m.color}18`,
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}>
                <m.icon size={26} color={m.color} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: "700", color: "#1e293b", fontSize: "1rem" }}>{m.titulo}</div>
                <div style={{ color: "#64748b", fontSize: "0.82rem", marginTop: "2px" }}>{m.descripcion}</div>
              </div>
              <ArrowRight size={18} color="#94a3b8" />
            </div>
          ))}
        </div>
      </div>

    </LayoutWithSidebar>
  );
}
