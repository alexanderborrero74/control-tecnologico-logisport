// pages/nube-privada.js
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import LayoutWithSidebar from "@/components/LayoutWithSidebar";
import PageHeader from "@/components/PageHeader";

/**
 * Parsea un HTML con una o más tablas tipo log.
 * - Busca la primera tabla con al menos 5 columnas.
 * - Ignora el encabezado si viene como <th>.
 * - Extrae: tipo, fechaHora, protocolo, usuario, evento (indices 0..4).
 */
const parseHTMLLogs = (htmlString) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, "text/html");

  // Encuentra la primera tabla "válida" (>=5 columnas)
  const tables = Array.from(doc.querySelectorAll("table"));
  let table = null;

  for (const t of tables) {
    const anyRow = t.querySelector("tr");
    if (!anyRow) continue;
    const colCount =
      anyRow.querySelectorAll("th").length || anyRow.querySelectorAll("td").length;
    if (colCount >= 5) {
      table = t;
      break;
    }
  }
  if (!table) return [];

  // Toma todas las filas (thead/tbody incluidos) y quita el header
  const allRows = Array.from(table.querySelectorAll("tr"));
  const hasHeader =
    allRows[0] &&
    (allRows[0].querySelectorAll("th").length > 0 ||
      allRows[0].textContent.toLowerCase().includes("fecha"));
  const dataRows = hasHeader ? allRows.slice(1) : allRows;

  const rows = [];
  for (const tr of dataRows) {
    const tds = tr.querySelectorAll("td");
    if (tds.length < 5) continue;
    rows.push({
      tipo: tds[0]?.textContent?.trim() || "",
      fechaHora: tds[1]?.textContent?.trim() || "",
      protocolo: tds[2]?.textContent?.trim() || "",
      usuario: tds[3]?.textContent?.trim() || "",
      evento: tds[4]?.textContent?.trim() || "",
    });
  }
  return rows;
};

export default function NubePrivada() {
  const router = useRouter();
  const [registros, setRegistros] = useState([]);
  const [estado, setEstado] = useState({ cargando: true, error: "" });

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Asegúrate que el archivo esté en /public/synovpnlog.html → URL: /synovpnlog.html
        const res = await fetch("/synovpnlog.html", {
          cache: "no-cache",
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status} al cargar synovpnlog.html`);
        const text = await res.text();

        const datos = parseHTMLLogs(text);
        setRegistros(datos);
        setEstado({ cargando: false, error: "" });
      } catch (e) {
        console.error(e);
        setEstado({
          cargando: false,
          error:
            "No se pudo leer synovpnlog.html. Verifica que el archivo exista en /public y que tenga al menos una tabla con 5 columnas (Tipo, Fecha y hora, Protocolo, Usuario, Evento).",
        });
      }
    };

    // DOMParser existe solo en el navegador
    if (typeof window !== "undefined") {
      fetchData();
    }
  }, []);

  return (
    <LayoutWithSidebar>
      <PageHeader titulo="parse H T M L Logs" />
  <div style={{ padding: "24px", paddingTop: "100px", fontFamily: "Arial, sans-serif" }}>
      {/* Título fijo */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          backgroundColor: "white",
          padding: "10px 0",
          borderBottom: "2px solid #ccc",
          textAlign: "center",
          zIndex: 1000,
        }}
      >
        <h1
          style={{
            fontSize: "36px",
            color: "#2c3e50",
            textShadow: "2px 2px 4px rgba(0,0,0,0.3)",
            fontWeight: "900",
            letterSpacing: "1px",
            textAlign: "center",
            marginBottom: "24px",
          }}
        >
          Nube privada
        </h1>
      </div>

      {estado.cargando ? (
        <p style={{ marginTop: 12 }}>Cargando registros de synovpnlog.html…</p>
      ) : estado.error ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            background: "#fdecea",
            color: "#611a15",
            border: "1px solid #f5c6cb",
            borderRadius: 6,
          }}
        >
          {estado.error}
        </div>
      ) : registros.length === 0 ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            background: "#fff8e1",
            color: "#7a4f01",
            border: "1px solid #ffe8a1",
            borderRadius: 6,
          }}
        >
          No se encontraron filas en la tabla. Revisa que el HTML tenga filas de datos debajo del
          encabezado.
        </div>
      ) : null}

      <div style={{ overflowX: "auto", maxHeight: "75vh", marginTop: 12 }}>
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
              <tr
                key={idx}
                style={{ backgroundColor: idx % 2 === 0 ? "#f9f9f9" : "#ffffff" }}
                title={registro.evento}
              >
                <td style={{ padding: "6px", border: "1px solid #ddd", whiteSpace: "nowrap" }}>
                  {registro.tipo}
                </td>
                <td style={{ padding: "6px", border: "1px solid #ddd", whiteSpace: "nowrap" }}>
                  {registro.fechaHora}
                </td>
                <td style={{ padding: "6px", border: "1px solid #ddd" }}>{registro.protocolo}</td>
                <td style={{ padding: "6px", border: "1px solid #ddd" }}>{registro.usuario}</td>
                <td style={{ padding: "6px", border: "1px solid #ddd" }}>{registro.evento}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>


    </div>
  </LayoutWithSidebar>
  );
}
