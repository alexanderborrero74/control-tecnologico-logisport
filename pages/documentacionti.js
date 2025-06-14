import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function DocumentacionTi() {
  const router = useRouter();
  const [archivos, setArchivos] = useState([]);
  const [archivoActivo, setArchivoActivo] = useState(null);

  useEffect(() => {
    const cargarArchivos = async () => {
      try {
        const response = await fetch("/api/documentacion");
        const data = await response.json();
        setArchivos(data);
      } catch (error) {
        console.error("Error al cargar archivos PDF:", error);
      }
    };
    cargarArchivos();
  }, []);

  return (
    <div style={{ padding: "24px" }}>
      {/* Logos fijos */}
      <div style={{ position: "fixed", top: 10, left: 10, zIndex: 2000 }}>
        <img src="/img/logo1.png" alt="Logo Izquierdo" style={{ height: "60px" }} />
      </div>
      <div style={{ position: "fixed", top: 10, right: 10, zIndex: 2000 }}>
        <img src="/img/logo2.png" alt="Logo Derecho" style={{ height: "60px" }} />
      </div>

      {/* Título fijo */}
      <div style={{
        position: "sticky",
        top: 0,
        backgroundColor: "#fff",
        zIndex: 1500,
        padding: "12px",
        borderBottom: "2px solid #007acc",
        textAlign: "center"
      }}>
        <h1 style={{
          fontSize: "36px",
          color: "#2c3e50",
          textShadow: "2px 2px 4px rgba(0,0,0,0.3)",
          fontWeight: "900",
          letterSpacing: "1px",
          margin: 0
        }}>
          Documentos implementación TI
        </h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px", marginTop: "24px" }}>
        {archivos.map((archivo, index) => (
          <div
            key={index}
            style={{ border: "1px solid #ccc", borderRadius: "8px", overflow: "hidden", cursor: "pointer" }}
            onClick={() => setArchivoActivo(archivo)}
          >
            <iframe
              src={`/documentacion/${archivo}`}
              title={archivo}
              width="100%"
              height="400px"
              style={{ border: "none" }}
            ></iframe>
            <div style={{ padding: "8px", background: "#f4f4f4", textAlign: "center", fontWeight: "bold" }}>{archivo}</div>
          </div>
        ))}
      </div>

      {/* Modal de vista ampliada */}
      {archivoActivo && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0,0,0,0.7)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 2000
          }}
          onClick={() => setArchivoActivo(null)}
        >
          <div
            style={{
              width: "90%",
              height: "90%",
              backgroundColor: "white",
              borderRadius: "8px",
              overflow: "hidden",
              position: "relative"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <iframe
              src={`/documentacion/${archivoActivo}`}
              title="Vista Ampliada"
              width="100%"
              height="100%"
              style={{ border: "none" }}
            ></iframe>
            <button
              style={{
                position: "absolute",
                top: "10px",
                right: "10px",
                backgroundColor: "#c0392b",
                color: "white",
                border: "none",
                padding: "6px 12px",
                borderRadius: "4px",
                cursor: "pointer"
              }}
              onClick={() => setArchivoActivo(null)}
            >
              ✕ Cerrar
            </button>
            <button
              style={{
                position: "absolute",
                bottom: "10px",
                left: "10px",
                backgroundColor: "#2980b9",
                color: "white",
                padding: "10px 20px",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer",
                zIndex: 2100,
                boxShadow: "0 4px 8px rgba(0,0,0,0.1)"
              }}
              onClick={() => router.push("/")}
            >
              ⬅ Regresar
            </button>
          </div>
        </div>
      )}

      {/* Botón regresar fijo fuera del modal */}
      {!archivoActivo && (
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
      )}
    </div>
  );
}
