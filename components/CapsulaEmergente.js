// components/CapsulaEmergente.js - Cápsulas RECURRENTES con auto-cierre
import { useState, useEffect, useRef } from "react";
import { collection, getDocs, query, where, getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { X, Info, AlertTriangle, AlertCircle } from "lucide-react";

export default function CapsulaEmergente() {
  const [capsulas, setCapsulas] = useState([]);
  const [capsulaActual, setCapsulaActual] = useState(null);
  const [mostrarCapsula, setMostrarCapsula] = useState(false);
  
  const intervaloRecurrenciaRef = useRef(null);
  const timeoutAutoCierreRef = useRef(null);
  const timeoutDelayInicialRef = useRef(null);
  const indiceActualRef = useRef(0);

  useEffect(() => {
    console.log("🔵 CapsulaEmergente montado");
    const auth = getAuth();
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        console.log("✅ Usuario autenticado:", user.email);
        cargarCapsulas();
      } else {
        console.log("❌ No hay usuario autenticado");
      }
    });
    return () => {
      console.log("🔴 CapsulaEmergente desmontado");
      limpiarTimers();
      unsubscribe();
    };
  }, []);

  const limpiarTimers = () => {
    if (intervaloRecurrenciaRef.current) {
      clearInterval(intervaloRecurrenciaRef.current);
      intervaloRecurrenciaRef.current = null;
    }
    if (timeoutAutoCierreRef.current) {
      clearTimeout(timeoutAutoCierreRef.current);
      timeoutAutoCierreRef.current = null;
    }
    if (timeoutDelayInicialRef.current) {
      clearTimeout(timeoutDelayInicialRef.current);
      timeoutDelayInicialRef.current = null;
    }
  };

  const cargarCapsulas = async () => {
    try {
      console.log("📦 Cargando cápsulas...");
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) return;

      const db = getFirestore();
      const q = query(collection(db, "capsulas"), where("activa", "==", true));
      const snapshot = await getDocs(q);
      
      let todasCapsulas = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      todasCapsulas = todasCapsulas.sort((a, b) => (a.prioridad || 999) - (b.prioridad || 999));
      
      console.log("📦 Cápsulas encontradas:", todasCapsulas.length);

      if (todasCapsulas.length === 0) return;

      const ahora = new Date();
      todasCapsulas = todasCapsulas.filter(capsula => {
        if (capsula.fechaInicio) {
          const fechaInicio = new Date(capsula.fechaInicio);
          if (ahora < fechaInicio) return false;
        }
        if (capsula.fechaFin) {
          const fechaFin = new Date(capsula.fechaFin);
          fechaFin.setHours(23, 59, 59, 999);
          if (ahora > fechaFin) return false;
        }
        return true;
      });

      console.log("📦 Cápsulas vigentes:", todasCapsulas.length);
      
      if (todasCapsulas.length > 0) {
        setCapsulas(todasCapsulas);
        todasCapsulas.forEach((c, i) => {
          console.log("  -", c.titulo, "Recurrencia:", c.intervaloRecurrencia || 30, "min");
        });
        iniciarSistemaRecurrente(todasCapsulas);
      }
    } catch (error) {
      console.error("❌ Error cargando cápsulas:", error);
    }
  };

  const iniciarSistemaRecurrente = (caps) => {
    limpiarTimers();
    
    const primeraCaps = caps[0];
    const delayInicial = Math.max(3, parseInt(primeraCaps.intervaloSegundos) || 5) * 1000;
    
    console.log("⏱️ Delay inicial:", delayInicial / 1000, "segundos");
    
    timeoutDelayInicialRef.current = setTimeout(() => {
      console.log("🚀 Iniciando ciclo de cápsulas");
      mostrarCapsulaNow(caps, 0);
      configurarIntervaloRecurrente(caps);
    }, delayInicial);
  };

  const configurarIntervaloRecurrente = (caps) => {
    if (intervaloRecurrenciaRef.current) {
      clearInterval(intervaloRecurrenciaRef.current);
    }

    const intervaloMasCorto = Math.min(...caps.map(c => 
      Math.max(1, parseInt(c.intervaloRecurrencia) || 30)
    ));
    
    const intervaloMs = intervaloMasCorto * 60 * 1000;
    console.log("🔁 Intervalo recurrente:", intervaloMasCorto, "minutos");

    intervaloRecurrenciaRef.current = setInterval(() => {
      console.log("⏰ Timer disparado");
      indiceActualRef.current = (indiceActualRef.current + 1) % caps.length;
      mostrarCapsulaNow(caps, indiceActualRef.current);
    }, intervaloMs);
  };

  const mostrarCapsulaNow = (caps, index) => {
    const capsula = caps[index];
    console.log("📢 Mostrando:", capsula.titulo);
    
    setCapsulaActual(capsula);
    setMostrarCapsula(true);

    const duracionPantalla = Math.max(3, parseInt(capsula.duracionPantalla) || 10) * 1000;
    console.log("   Auto-cierre en:", duracionPantalla / 1000, "segundos");
    
    if (timeoutAutoCierreRef.current) {
      clearTimeout(timeoutAutoCierreRef.current);
    }
    
    timeoutAutoCierreRef.current = setTimeout(() => {
      console.log("   ✅ Auto-cierre");
      setMostrarCapsula(false);
      setCapsulaActual(null);
    }, duracionPantalla);
  };

  const cerrarManual = () => {
    console.log("🚫 Cierre manual");
    setMostrarCapsula(false);
    setCapsulaActual(null);
    if (timeoutAutoCierreRef.current) {
      clearTimeout(timeoutAutoCierreRef.current);
    }
  };

  if (!capsulaActual || !mostrarCapsula) return null;

  const getTipoStyles = () => {
    switch (capsulaActual.tipo) {
      case "critica":
        return { bg: "#fee2e2", border: "#dc2626", text: "#7f1d1d", icon: AlertCircle, iconColor: "#dc2626" };
      case "alerta":
        return { bg: "#fef3c7", border: "#f59e0b", text: "#78350f", icon: AlertTriangle, iconColor: "#f59e0b" };
      default:
        return { bg: "#dbeafe", border: "#3b82f6", text: "#1e3a8a", icon: Info, iconColor: "#3b82f6" };
    }
  };

  const estilos = getTipoStyles();
  const IconoTipo = estilos.icon;

  return (
    <div style={styles.container}>
      <div style={{ ...styles.toast, background: estilos.bg, borderLeft: `4px solid ${estilos.border}` }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
          <IconoTipo size={24} color={estilos.iconColor} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h4 style={{ ...styles.toastTitle, color: estilos.text }}>
              {capsulaActual.titulo}
            </h4>
            <p style={styles.toastText}>{capsulaActual.contenido}</p>
          </div>
          <button onClick={cerrarManual} style={styles.closeBtn} title="Cerrar">
            <X size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    position: "fixed",
    top: "1rem",
    right: "1rem",
    zIndex: 99999,
    maxWidth: "420px",
    width: "calc(100vw - 2rem)",
  },
  toast: {
    padding: "1rem",
    borderRadius: "12px",
    boxShadow: "0 10px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.1)",
    animation: "slideInRight 0.4s ease-out",
  },
  toastTitle: {
    margin: "0 0 0.25rem 0",
    fontSize: "0.95rem",
    fontWeight: "700",
    lineHeight: 1.3,
  },
  toastText: {
    margin: 0,
    fontSize: "0.875rem",
    lineHeight: "1.5",
    color: "#374151",
  },
  closeBtn: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: "0.25rem",
    borderRadius: "6px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.2s",
    color: "#6b7280",
    flexShrink: 0,
  },
};

if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.textContent = `
    @keyframes slideInRight {
      from {
        opacity: 0;
        transform: translateX(100%);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }
  `;
  document.head.appendChild(style);
}
