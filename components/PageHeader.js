// components/PageHeader.js
import { BRAND } from "@/utils/branding";

export default function PageHeader({ titulo, subtitulo, children }) {
  return (
    <div
      style={{
        marginBottom: "2rem",
        background: "#fff",
        borderRadius: "16px",
        padding: "1.5rem",
        boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
        border: "1px solid #e5e7eb",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
        <div style={{ flex: 1, minWidth: "200px" }}>
          <h1
            style={{
              margin: 0,
              fontSize: "1.875rem",
              fontWeight: "800",
              color: "#0B3D91",
              lineHeight: 1.2,
            }}
          >
            {titulo}
          </h1>
          {subtitulo && (
            <p
              style={{
                margin: "0.5rem 0 0 0",
                fontSize: "0.95rem",
                color: "#6b7280",
                lineHeight: 1.5,
              }}
            >
              {subtitulo}
            </p>
          )}
        </div>
        
        {children && (
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            {children}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center" }}>
          <img
            src={BRAND.logoUrl}
            alt={BRAND.clientName}
            style={{
              height: "50px",
              width: "auto",
              objectFit: "contain",
              filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))",
            }}
          />
        </div>
      </div>
    </div>
  );
}
