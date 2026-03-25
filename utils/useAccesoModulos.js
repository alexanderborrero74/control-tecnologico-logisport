// utils/useAccesoModulos.js
import { useState, useEffect } from "react";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";

// ── Lista maestra de todas las páginas ───────────────────────────────────────
export const TODAS_LAS_PAGINAS = [
  { id: "nomina-liquidar",      ruta: "/nomina/liquidar",               nombre: "Liquidar Nómina",              categoria: "Nómina" },
  { id: "nomina-index",         ruta: "/nomina",                        nombre: "Nómina — Panel principal",     categoria: "Nómina" },
  { id: "nomina-administrar",   ruta: "/nomina/administrar",            nombre: "Nómina — Administrar",         categoria: "Nómina" },
  { id: "nomina-trabajadores",  ruta: "/nomina/trabajadores",           nombre: "Nómina — Trabajadores",        categoria: "Nómina" },
  { id: "nomina-servicios",     ruta: "/nomina/servicios",              nombre: "Nómina — Servicios",           categoria: "Nómina" },
  { id: "nomina-cuadrillas",    ruta: "/nomina/cuadrillas",             nombre: "Nómina — Cuadrillas",          categoria: "Nómina" },
  { id: "nomina-asistencia",    ruta: "/nomina/asistencia",             nombre: "Nómina — Asistencia",          categoria: "Nómina" },
  { id: "nomina-adelantos",     ruta: "/nomina/adelantos",              nombre: "Nómina — Adelantos",           categoria: "Nómina" },
  { id: "nomina-historial",     ruta: "/nomina/historial",              nombre: "Nómina — Historial",           categoria: "Nómina" },
  { id: "nomina-desprendibles", ruta: "/nomina/desprendibles",          nombre: "Nómina — Desprendibles",       categoria: "Nómina" },
  { id: "nomina-matriz",        ruta: "/nomina/matriz",                 nombre: "Nómina — Matriz",              categoria: "Nómina" },
  { id: "servicios-tecnicos",   ruta: "/servicios-tecnicos",            nombre: "Servicios Técnicos",           categoria: "Control TI" },
  { id: "hoja-vida",            ruta: "/hoja-vida",                     nombre: "Hoja de Vida Equipos",         categoria: "Control TI" },
  { id: "estadisticas",         ruta: "/estadisticas",                  nombre: "Estadísticas",                 categoria: "Control TI" },
  { id: "indicadores-gestion",  ruta: "/indicadores-gestion",           nombre: "Indicadores de Gestión",       categoria: "Control TI" },
  { id: "informe-gestion",      ruta: "/informe-gestion",               nombre: "Informe de Gestión",           categoria: "Control TI" },
  { id: "licencias",            ruta: "/licencias",                     nombre: "Licencias",                    categoria: "Control TI" },
  { id: "capsulas-admin",       ruta: "/capsulas-admin",                nombre: "Cápsulas Admin",               categoria: "Control TI" },
  { id: "admin-usuarios",       ruta: "/admin-usuarios",                nombre: "Admin Usuarios",               categoria: "Control TI" },
  { id: "trazabilidad-logins",  ruta: "/trazabilidad-logins",           nombre: "Trazabilidad Logins",          categoria: "Control TI" },
];

// ── Usamos la colección "configuracion" que ya tiene reglas activas ──────────
// Documento: configuracion/accesos_modulos
// Estructura: { modulos: { "nomina-liquidar": { requiereContrasena, contrasena }, ... } }

export function useAccesoModulos() {
  const [accesos, setAccesos] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "configuracion", "accesos_modulos"), (snap) => {
      if (snap.exists()) {
        setAccesos(snap.data().modulos || {});
      } else {
        setAccesos({});
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return { accesos, loading };
}

// ── Guardar config de un módulo ──────────────────────────────────────────────
export async function guardarAccesoModulo(moduloId, config) {
  const ref = doc(db, "configuracion", "accesos_modulos");
  // Leer el doc actual para no pisar otros módulos
  const snap = await getDoc(ref);
  const actual = snap.exists() ? (snap.data().modulos || {}) : {};
  await setDoc(ref, {
    modulos: {
      ...actual,
      [moduloId]: config,
    }
  }, { merge: true });
}

// ── Verificar contraseña ─────────────────────────────────────────────────────
export function verificarContrasena(accesos, moduloId, intento) {
  const cfg = accesos[moduloId];
  if (!cfg || !cfg.requiereContrasena) return true;
  return String(cfg.contrasena || "") === String(intento || "");
}
