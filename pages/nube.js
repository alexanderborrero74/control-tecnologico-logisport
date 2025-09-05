import { useRouter } from "next/router";
import { useEffect, useState } from "react";

// Estructura del registro
const parseHTMLLogs = (htmlString) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, "text/html");
  const rows = [...doc.querySelectorAll("table tr")].slice(1); // Ignorar encabezado

  return rows.map((tr) => {
    const cells = tr.querySelectorAll("td");
    return {
      tipo: cells[0]?.textContent.trim(),
      fechaHora: cells[1]?.textContent.trim(),
      protocolo: cells[2]?.textContent.trim(),
      usuario: cells[3]?.textContent.trim(),
      evento: cells[4]?.textContent.trim()
    };
  });
};

export default function NubePrivada() {
  const router = useRouter();
  const [registros, setRegistros] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch("/nube sidecomex.pdf"); // Asegúrate de colocar el archivo en /public
      const text = await res.text();
      const datos = parseHTMLLogs(text);
      setRegistros(datos);
    };

    fetchData();
  }, []);

  return (
    <div style={{ padding: "24px", paddingTop: "100px", fontFamily: "Arial, sans-serif" }}>
      {/* Título fijo */}
      <div style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        backgroundColor: "white",
        padding: "10px 0",
        borderBottom: "2px solid #ccc",
        textAlign: "center",
        zIndex: 1000
      }}>
        <h1 style={{
        fontSize: "36px",
        color: "#2c3e50",
        textShadow: "2px 2px 4px rgba(0,0,0,0.3)",
        fontWeight: "900",
        letterSpacing: "1px",
        textAlign: "center",
        marginBottom: "24px"
      }}>
        Nube privada
      </h1>
      </div>

      <div style={{ overflowX: "auto", maxHeight: "75vh" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
          <thead style={{ backgroundColor: "#007acc", color: "white" }}>
            <tr>
              <th style={{ padding: "8px", border: "1px solid #ccc" }}>Tipo</th>
              <th style={{ padding: "8px", border: "1px solid #ccc" }}>Fecha y hora</th>
              <th style={{ padding: "8px", border: "1px solid #ccc" }}>Protocolo</th>
              <th style={{ padding: "8px", border: "1px solid #ccc" }}>Usuario</th>
              <th style={{ padding: "8px", border: "1px solid #ccc" }}>Evento</th>
            </tr>
          </thead>
          <tbody>
            {registros.map((registro, idx) => (
              <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? "#f9f9f9" : "#ffffff" }}>
                <td style={{ padding: "6px", border: "1px solid #ddd" }}>{registro.tipo}</td>
                <td style={{ padding: "6px", border: "1px solid #ddd" }}>{registro.fechaHora}</td>
                <td style={{ padding: "6px", border: "1px solid #ddd" }}>{registro.protocolo}</td>
                <td style={{ padding: "6px", border: "1px solid #ddd" }}>{registro.usuario}</td>
                <td style={{ padding: "6px", border: "1px solid #ddd" }}>{registro.evento}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Botón regresar fijo */}
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
          zIndex: 1000,
          boxShadow: "0 4px 8px rgba(0,0,0,0.1)"
        }}
        onClick={() => router.push("/")}
      >
        ⬅ Regresar
      </button>
    </div>
  );
}
