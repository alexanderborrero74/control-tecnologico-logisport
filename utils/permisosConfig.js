// utils/permisosConfig.js
// Catálogo centralizado de sub-permisos por módulo.
// Cada módulo tiene acciones granulares que se pueden activar/desactivar
// de forma independiente del nivel general (ninguno/lectura/limitado/total).

export const PERMISOS_MODULOS = {
  trabajadores: {
    label: "Trabajadores",
    emoji: "👷",
    acciones: [
      { id: "crear_trabajador",   label: "Crear trabajador",          emoji: "➕" },
      { id: "editar_trabajador",  label: "Editar datos del trabajador",emoji: "✏️" },
      { id: "eliminar_trabajador",label: "Eliminar trabajador",        emoji: "🗑️" },
      { id: "importar_excel",     label: "Importar Excel masivo",      emoji: "📥" },
      { id: "exportar_excel",     label: "Exportar Excel",             emoji: "📤" },
    ],
  },

  asistencia: {
    label: "Listado de Asistencia",
    emoji: "📋",
    acciones: [
      { id: "registrar_llamado",  label: "Registrar llamado a lista",  emoji: "✅" },
      { id: "editar_asistencia",  label: "Editar asistencia existente",emoji: "✏️" },
      { id: "exportar_excel",     label: "Exportar Excel",             emoji: "📤" },
    ],
  },

  servicios: {
    label: "Servicios y Tarifas",
    emoji: "💲",
    acciones: [
      { id: "crear_servicio",   label: "Crear servicio",          emoji: "➕" },
      { id: "editar_servicio",  label: "Editar servicio / tarifa", emoji: "✏️" },
      { id: "eliminar_servicio",label: "Eliminar servicio",        emoji: "🗑️" },
    ],
  },

  matriz: {
    label: "Matriz",
    emoji: "📊",
    acciones: [
      { id: "crear_registro",    label: "Crear registro de operación",emoji: "➕" },
      { id: "editar_registro",   label: "Editar registro existente",  emoji: "✏️" },
      { id: "eliminar_registro", label: "Eliminar registro",          emoji: "🗑️" },
      { id: "exportar_datax",    label: "Exportar DataX",             emoji: "💾" },
      { id: "exportar_excel",    label: "Exportar Excel",             emoji: "📤" },
    ],
  },

  liquidar: {
    label: "Liquidar Nómina",
    emoji: "💰",
    acciones: [
      { id: "liquidar_nomina",  label: "Generar / liquidar nómina",   emoji: "▶️" },
      { id: "exportar_excel",   label: "Exportar Excel",              emoji: "📤" },
      { id: "exportar_datax",   label: "Exportar DataX",              emoji: "💾" },
    ],
  },

  liquidar_unificada: {
    label: "Liquidación Unificada",
    emoji: "📑",
    acciones: [
      { id: "liquidar_nomina",  label: "Generar / liquidar nómina",   emoji: "▶️" },
      { id: "exportar_excel",   label: "Exportar Excel",              emoji: "📤" },
      { id: "exportar_datax",   label: "Exportar DataX",              emoji: "💾" },
    ],
  },

  historial: {
    label: "Historial de Nóminas",
    emoji: "📅",
    acciones: [
      { id: "ver_detalle",      label: "Ver detalle de período",     emoji: "👁️" },
      { id: "eliminar_periodo", label: "Eliminar período",           emoji: "🗑️" },
    ],
  },

  adelantos: {
    label: "Adelantos y Comida",
    emoji: "💳",
    acciones: [
      { id: "crear_adelanto",   label: "Registrar adelanto",         emoji: "➕" },
      { id: "editar_adelanto",  label: "Editar adelanto",            emoji: "✏️" },
      { id: "eliminar_adelanto",label: "Eliminar adelanto",          emoji: "🗑️" },
      { id: "gestionar_comida", label: "Gestionar descuentos comida",emoji: "🍽️" },
    ],
  },

  desprendibles: {
    label: "Desprendibles",
    emoji: "🧾",
    acciones: [
      { id: "ver_desprendible",  label: "Ver desprendible",          emoji: "👁️" },
      { id: "compartir_link",    label: "Compartir enlace público",  emoji: "🔗" },
    ],
  },

  administrar: {
    label: "Administrar",
    emoji: "⚙️",
    acciones: [
      // Cargos
      { id: "crear_cargo",           label: "Crear cargo",              emoji: "➕", grupo: "Cargos" },
      { id: "editar_cargo",          label: "Editar cargo",             emoji: "✏️", grupo: "Cargos" },
      { id: "eliminar_cargo",        label: "Eliminar cargo",           emoji: "🗑️", grupo: "Cargos" },
      // Novedades
      { id: "crear_novedad",         label: "Crear novedad",            emoji: "➕", grupo: "Novedades" },
      { id: "editar_novedad",        label: "Editar novedad",           emoji: "✏️", grupo: "Novedades" },
      { id: "eliminar_novedad",      label: "Eliminar novedad",         emoji: "🗑️", grupo: "Novedades" },
      { id: "cargar_predefinidos",   label: "Cargar novedades predefinidas", emoji: "🔄", grupo: "Novedades" },
      // Cuadrillas
      { id: "crear_cuadrilla",       label: "Crear cuadrilla",          emoji: "➕", grupo: "Cuadrillas" },
      { id: "editar_cuadrilla",      label: "Editar cuadrilla",         emoji: "✏️", grupo: "Cuadrillas" },
      { id: "eliminar_cuadrilla",    label: "Eliminar cuadrilla",       emoji: "🗑️", grupo: "Cuadrillas" },
      // Observaciones / Motivos
      { id: "crear_observacion",     label: "Crear observación/motivo", emoji: "➕", grupo: "Observaciones" },
      { id: "editar_observacion",    label: "Editar observación/motivo",emoji: "✏️", grupo: "Observaciones" },
      { id: "eliminar_observacion",  label: "Eliminar observación/motivo",emoji: "🗑️", grupo: "Observaciones" },
    ],
  },

  clientes: {
    label: "Clientes",
    emoji: "🏢",
    acciones: [
      { id: "editar_cliente",         label: "Editar nombre de cliente",  emoji: "✏️" },
      { id: "inicializar_datos",      label: "Inicializar datos del cliente", emoji: "🔄" },
    ],
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Devuelve las acciones por defecto de un módulo dado su nivel.
 * "total"    → todas activas
 * "limitado" → todas activas (el administrador define qué desactivar)
 * "lectura"  → ninguna activa (solo lectura)
 * "ninguno"  → ninguna activa
 */
export function accionesPorNivel(moduloId, nivel) {
  const config = PERMISOS_MODULOS[moduloId];
  if (!config) return {};
  const activo = nivel === "total" || nivel === "limitado";
  return Object.fromEntries(
    config.acciones.map(a => [a.id, activo])
  );
}

/**
 * Convierte el valor guardado en Firestore al formato objeto normalizado.
 * Acepta tanto el formato antiguo (string) como el nuevo (objeto con nivel+acciones).
 */
export function normalizarPermiso(moduloId, valor) {
  if (!valor || valor === "ninguno") {
    return { nivel: "ninguno", acciones: accionesPorNivel(moduloId, "ninguno") };
  }
  if (typeof valor === "string") {
    // Formato antiguo — convertir
    return { nivel: valor, acciones: accionesPorNivel(moduloId, valor) };
  }
  // Formato nuevo — completar acciones faltantes con default según nivel
  const defaults = accionesPorNivel(moduloId, valor.nivel || "lectura");
  return {
    nivel:    valor.nivel    || "lectura",
    acciones: { ...defaults, ...(valor.acciones || {}) },
  };
}
