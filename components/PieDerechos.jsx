// components/PieDerechos.jsx
export default function PieDerechos() {
  return (
    <footer
      style={{
        position: "fixed",
        bottom: 8,
        left: 0,
        right: 0,
        textAlign: "center",
        fontSize: 12,
        color: "#6b7280",
        pointerEvents: "none",
        zIndex: 9999,
      }}
    >
      © 2025 <span translate="no" style={{ fontWeight: 700 }}>Alexander Borrero</span>. Todos los derechos reservados.
    </footer>
  );
}
