import { useRouter } from "next/router";
import { BRAND } from "@/utils/branding";

export default function Layout({ children }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      
      {/* Barra superior con Acceso a nube */}
      <header style={{ display: "flex", justifyContent: "flex-end", gap: 12, padding: "10px 16px" }}>
        {BRAND?.cloudUrl ? (
          <a
            href={BRAND.cloudUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              backgroundColor: "#0B3D91",
              color: "#fff",
              padding: "8px 12px",
              borderRadius: 8,
              textDecoration: "none",
              fontWeight: 700
            }}
            title="Acceso a nube"
          >
            Acceso a nube
          </a>
        ) : null}
      </header>

      <main style={{ flex: "1" }}>
        {children}
      </main>

      <footer style={{
        backgroundColor: "#f1f1f1",
        textAlign: "center",
        padding: "16px",
        fontSize: "14px",
        color: "#555",
        borderTop: "1px solid #ddd"
      }}>
        © {new Date().getFullYear()} Alexander Borrero - Soporteia.Net. Todos los derechos reservados.
      </footer>
    </div>
  );
}

