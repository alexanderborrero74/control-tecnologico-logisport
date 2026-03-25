// utils/accesoModulos.js
// Helpers para el sistema de contraseña por módulo
// Usados tanto por GateModulo (global) como por index.js (dashboard)

import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";

// ── Mapa ruta → id de módulo ──────────────────────────────────────────────
export const RUTA_A_MODULO = {
  "/nomina":               "nomina-index",
  "/nomina/liquidar":      "nomina-liquidar",
  "/nomina/administrar":   "nomina-administrar",
  "/nomina/trabajadores":  "nomina-trabajadores",
  "/nomina/servicios":     "nomina-servicios",
  "/nomina/cuadrillas":    "nomina-cuadrillas",
  "/nomina/asistencia":    "nomina-asistencia",
  "/nomina/adelantos":     "nomina-adelantos",
  "/nomina/historial":     "nomina-historial",
  "/nomina/desprendibles": "nomina-desprendibles",
  "/nomina/matriz":        "nomina-matriz",
  "/servicios-tecnicos":   "servicios-tecnicos",
  "/hoja-vida":            "hoja-vida",
  "/estadisticas":         "estadisticas",
  "/indicadores-gestion":  "indicadores-gestion",
  "/informe-gestion":      "informe-gestion",
  "/licencias":            "licencias",
  "/capsulas-admin":       "capsulas-admin",
  "/admin-usuarios":       "admin-usuarios",
  "/trazabilidad-logins":  "trazabilidad-logins",
};

// ── Convierte path a moduloId ─────────────────────────────────────────────
export function moduloDePath(path) {
  // Normalizar: quitar query string y hash
  const limpio = (path || "").split("?")[0].split("#")[0];
  return RUTA_A_MODULO[limpio] || null;
}

// ── SessionStorage: desbloqueo dura mientras la PESTAÑA esté abierta ─────
// Nueva pestaña, URL directa o F5 → vuelve a pedir contraseña
const SK = (id) => `gate_${id}`;

export function estaDesbloqueado(moduloId) {
  if (typeof window === "undefined") return false;
  try { return sessionStorage.getItem(SK(moduloId)) === "1"; } catch { return false; }
}

export function marcarDesbloqueado(moduloId) {
  if (typeof window === "undefined") return;
  try { sessionStorage.setItem(SK(moduloId), "1"); } catch {}
}

export function bloquearModulo(moduloId) {
  if (typeof window === "undefined") return;
  try { sessionStorage.removeItem(SK(moduloId)); } catch {}
}

// ── Carga la config de Firestore (para uso puntual sin listener) ──────────
export async function cargarConfigAccesos() {
  try {
    const snap = await getDoc(doc(db, "configuracion", "accesos_modulos"));
    if (!snap.exists()) return {};
    return snap.data().modulos || {};
  } catch { return {}; }
}
