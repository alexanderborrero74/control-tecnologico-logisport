// /utils/branding.js
export const BRAND = {
  // Texto principal del header
  appName: process.env.NEXT_PUBLIC_APP_NAME || "Sidecomex",
  subtitle: process.env.NEXT_PUBLIC_APP_SUBTITLE || "Control Tecnológico",
  // Logos
  logoUrl: process.env.NEXT_PUBLIC_LOGO_URL || "//nexoti-logo.svg",
  faviconUrl: process.env.NEXT_PUBLIC_FAVICON_URL || "/favicon.svg",
  // Colores base (opcional)
  primary: process.env.NEXT_PUBLIC_PRIMARY || "#007acc",
  accent: process.env.NEXT_PUBLIC_ACCENT || "#0ea5e9",
  // Etiqueta de producto (opcional)
  poweredBy: "NexoTI",
};
