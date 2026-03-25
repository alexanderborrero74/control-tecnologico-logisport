// utils/org.js

/**
 * Deriva el identificador de organización desde el hostname
 * @param {string} host - El hostname (ej: "logisport.vercel.app")
 * @returns {string} - El identificador de la organización (ej: "LOGI")
 */
export function deriveOrgFromHost(host) {
  if (!host) return "LOGI";
  
  // Si contiene "logisport" o "logi", retorna LOGI
  if (host.includes("logisport") || host.includes("logi")) {
    return "LOGI";
  }
  
  // Si es localhost, retorna LOGI por defecto
  if (host.includes("localhost") || host.includes("127.0.0.1")) {
    return "LOGI";
  }
  
  // Por defecto retorna LOGI
  return "LOGI";
}

/**
 * Obtiene el nombre completo de la organización
 * @param {string} orgId - El ID de la organización (ej: "LOGI")
 * @returns {string} - El nombre completo
 */
export function getOrgFullName(orgId) {
  const names = {
    LOGI: "LOGISPORT - Control Tecnológico",
  };
  
  return names[orgId] || orgId;
}

/**
 * Obtiene la configuración de la organización
 * @param {string} orgId - El ID de la organización
 * @returns {object} - La configuración de la organización
 */
export function getOrgConfig(orgId) {
  const configs = {
    LOGI: {
      name: "LOGISPORT",
      fullName: "LOGISPORT - Control Tecnológico",
      primaryColor: "#0B3D91",
      logo: "/logisport.png",
    },
  };
  
  return configs[orgId] || configs.LOGI;
}
