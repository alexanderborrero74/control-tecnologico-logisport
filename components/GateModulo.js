// components/GateModulo.js
// Intercepta TODA navegación. Si el módulo tiene contraseña → pide clave.
// REGLA PRINCIPAL: el rol "admin" SIEMPRE tiene paso libre, sin excepción.
// IMPORTANTE: espera a tener TANTO el rol COMO la config antes de evaluar.

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { onSnapshot, doc } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { db } from "@/firebase/firebaseConfig";
import { getUserRoleByUid } from "@/utils/getUserRole";
import ModalContrasena from "@/components/ModalContrasena";
import { moduloDePath, estaDesbloqueado, marcarDesbloqueado, RUTA_A_MODULO } from "@/utils/accesoModulos";

const RUTAS_LIBRES  = new Set(["/login", "/mi-pago", "/404", "/_error"]);
const ROLES_LIBRES  = new Set(["admin", "nomina"]); // estos roles nunca son bloqueados

function rutaProtegible(path) {
  const p = (path || "").split("?")[0].split("#")[0];
  return !RUTAS_LIBRES.has(p) && p in RUTA_A_MODULO;
}

export default function GateModulo({ children }) {
  const router = useRouter();

  // null = todavía cargando
  const [accesos, setAccesos]   = useState(null);
  const [rol,     setRol]       = useState(null);
  const accesosRef              = useRef(null);
  const rolRef                  = useRef(null);

  const [gateActivo,       setGateActivo]      = useState(false);
  const [gateModuloId,     setGateModuloId]    = useState(null);
  const [gateModuloNombre, setGateNombre]      = useState("");
  const [gateError,        setGateError]       = useState("");
  const [bloqueado,        setBloqueado]       = useState(false);

  // ── 1. Cargar rol del usuario ─────────────────────────────────────────────
  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const r = await getUserRoleByUid(user.uid);
          rolRef.current = r;
          setRol(r);
        } catch {
          rolRef.current = "usuario";
          setRol("usuario");
        }
      } else {
        rolRef.current = "anonimo";
        setRol("anonimo");
      }
    });
    return () => unsub();
  }, []);

  // ── 2. Cargar config de Firestore en tiempo real ──────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "configuracion", "accesos_modulos"), (snap) => {
      const modulos = snap.exists() ? (snap.data().modulos || {}) : {};
      accesosRef.current = modulos;
      setAccesos(modulos);
    });
    return () => unsub();
  }, []);

  // ── 3. Evaluar ruta cuando AMBOS (rol + config) están listos ─────────────
  useEffect(() => {
    if (rol === null || accesos === null) return; // esperar ambos
    evaluarRuta(router.pathname);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rol, accesos]);

  // ── 4. Evaluar en cada cambio de ruta ─────────────────────────────────────
  useEffect(() => {
    const handle = (url) => {
      // Si todavía no tenemos rol o config, no bloquear (evitar pantalla de carga eterna)
      if (rolRef.current === null || accesosRef.current === null) return;
      evaluarRuta(url.split("?")[0]);
    };
    router.events.on("routeChangeComplete", handle);
    return () => router.events.off("routeChangeComplete", handle);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Lógica central ────────────────────────────────────────────────────────
  const evaluarRuta = (path) => {
    const limpio = (path || "").split("?")[0].split("#")[0];

    // Ruta siempre libre
    if (RUTAS_LIBRES.has(limpio)) { setBloqueado(false); return; }

    // Admin (y roles libres) → SIEMPRE pasan, sin importar nada más
    if (ROLES_LIBRES.has(rolRef.current)) { setBloqueado(false); return; }

    const moduloId = moduloDePath(limpio);
    if (!moduloId) { setBloqueado(false); return; }

    // Ya desbloqueado en esta sesión de pestaña
    if (estaDesbloqueado(moduloId)) { setBloqueado(false); return; }

    const cfg = (accesosRef.current || {})[moduloId];
    if (!cfg || !cfg.requiereContrasena || !cfg.contrasena) {
      setBloqueado(false);
      return;
    }

    // Requiere contraseña → activar gate
    setGateModuloId(moduloId);
    setGateNombre(cfg.nombre || moduloId);
    setGateError("");
    setGateActivo(true);
    setBloqueado(true);
  };

  const handleConfirmar = (clave) => {
    const cfg = (accesosRef.current || {})[gateModuloId];
    if (!cfg) return;
    if (String(clave).trim() === String(cfg.contrasena).trim()) {
      marcarDesbloqueado(gateModuloId);
      setGateActivo(false);
      setBloqueado(false);
      setGateError("");
    } else {
      setGateError("Contraseña incorrecta. Intenta de nuevo.");
    }
  };

  const handleCancelar = () => {
    setGateActivo(false);
    setBloqueado(false);
    setGateError("");
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  return (
    <>
      <div style={{
        visibility: bloqueado ? "hidden" : "visible",
        height:     bloqueado ? 0       : "auto",
        overflow:   bloqueado ? "hidden": "visible",
      }}>
        {children}
      </div>

      {/* Pantalla de espera SOLO mientras cargamos rol+config en ruta protegible */}
      {bloqueado && !gateActivo && (
        <div style={{
          position: "fixed", inset: 0, background: "#f8fafc",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 9998,
        }}>
          <div style={{ textAlign: "center", color: "#0B3D91" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🔒</div>
            <div style={{ fontWeight: "700", fontSize: "1.1rem" }}>Verificando acceso...</div>
          </div>
        </div>
      )}

      <ModalContrasena
        abierto={gateActivo}
        modulo={gateModuloNombre}
        onConfirmar={handleConfirmar}
        onCancelar={handleCancelar}
        error={gateError}
        modoGate={true}
      />
    </>
  );
}
