import { useRouter } from "next/router";

export default function Layout({ children }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
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

