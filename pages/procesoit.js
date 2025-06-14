import { useRouter } from "next/router";
import { useEffect, useState } from "react";

// Función para parsear la tabla desde el HTML
const parseHTMLTable = (htmlString) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, "text/html");
  const rows = [...doc.querySelectorAll("table tr")];
  return rows.map(row => {
    const cols = row.querySelectorAll("td");
    return [...cols].map(td => td.textContent.trim());
  });
};

export default function Procesoit() {
  const router = useRouter();
  const [tabla, setTabla] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/implementacion  actualizado_archivos/sheet001.htm");
        const html = await res.text();
        const data = parseHTMLTable(html);
        setTabla(data);
      } catch (error) {
        console.error("Error cargando el archivo:", error);
      }
    };
    fetchData();
  }, []);

  return (
    <div style={{ padding: "24px", paddingBottom: "80px" }}>
      {/* ✅ LOGOS AGREGADOS */}
      <div style={{ position: "fixed", top: 10, left: 10, zIndex: 2000 }}>
        <img src="/img/logo1.png" alt="Logo Izquierdo" style={{ height: "60px" }} />
      </div>
      <div style={{ position: "fixed", top: 10, right: 10, zIndex: 2000 }}>
        <img src="/img/logo2.png" alt="Logo Derecho" style={{ height: "60px" }} />
      </div>

      {/* ✅ Título fijo */}
      <div style={{
        position: "sticky",
        top: 0,
        backgroundColor: "white",
        zIndex: 1000,
        padding: "16px",
        borderBottom: "2px solid #ddd",
        textAlign: "center"
      }}>
        <h1 style={{
          fontSize: "28px",
          fontWeight: "bold",
          color: "#2c3e50",
          margin: 0
        }}>
          Procesos Tecnológicos IT Implementados
        </h1>
      </div>

      {tabla.length > 0 ? (
        <div style={{ overflowX: "auto", marginTop: "16px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
            <thead style={{ backgroundColor: "#007acc", color: "white" }}>
              <tr>
                {tabla[0].map((header, i) => (
                  <th key={i} style={{ border: "1px solid #ccc", padding: "10px", textAlign: "left" }}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tabla.slice(1).map((fila, idx) => (
                <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? "#f9f9f9" : "#ffffff" }}>
                  {fila.map((cell, i) => (
                    <td key={i} style={{ border: "1px solid #ddd", padding: "8px", verticalAlign: "top" }}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p style={{ marginTop: "20px" }}>Cargando datos de implementación...</p>
      )}

      {/* ✅ Botón fijo en esquina inferior izquierda */}
      <button
        style={{
          position: "fixed",
          bottom: "20px",
          left: "20px",
          backgroundColor: "#2980b9",
          color: "white",
          padding: "10px 20px",
          border: "none",
          borderRadius: "5px",
          cursor: "pointer",
          zIndex: 1000
        }}
        onClick={() => router.push("/")}
      >
        ⬅ Regresar
      </button>
    </div>
  );
}
