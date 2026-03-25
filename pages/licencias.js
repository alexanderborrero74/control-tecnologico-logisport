import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import LayoutWithSidebar from "@/components/LayoutWithSidebar";
import PageHeader from "@/components/PageHeader";

export default function Licencias() {
  const router = useRouter();
  const [carpetas, setCarpetas] = useState([]);
  const [archivos, setArchivos] = useState([]);
  const [carpetaActual, setCarpetaActual] = useState(null);
  const [archivoActivo, setArchivoActivo] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    cargarLicencias();
  }, [carpetaActual]);

  const cargarLicencias = async () => {
    setCargando(true);
    try {
      const url = carpetaActual 
        ? `/api/licencias?folder=${encodeURIComponent(carpetaActual)}`
        : '/api/licencias';
      
      const response = await fetch(url);
      const data = await response.json();

      if (carpetaActual) {
        // Estamos dentro de una carpeta
        setCarpetas([]);
        setArchivos(data || []);
      } else {
        // Vista principal
        setCarpetas(data.carpetas || []);
        setArchivos(data.archivos || []);
      }
    } catch (error) {
      console.error("Error al cargar licencias:", error);
      setCarpetas([]);
      setArchivos([]);
    } finally {
      setCargando(false);
    }
  };

  const abrirCarpeta = (nombreCarpeta) => {
    setCarpetaActual(nombreCarpeta);
  };

  const volverAtras = () => {
    setCarpetaActual(null);
  };

  const renderArchivo = (archivo) => {
    const ruta = carpetaActual ? archivo.ruta : archivo.nombre;
    const extension = archivo.nombre.split(".").pop().toLowerCase();

    if (extension === "pdf") {
      return (
        <iframe
          src={`/licencias/${ruta}`}
          title={archivo.nombre}
          width="100%"
          height="400px"
          style={{ border: "none" }}
        ></iframe>
      );
    }

    if (extension === "xlsx" || extension === "xls") {
      const fullUrl = `${window.location.origin}/licencias/${ruta}`;
      return (
        <iframe
          src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fullUrl)}`}
          width="100%"
          height="400px"
          style={{ border: "none" }}
          title={archivo.nombre}
        ></iframe>
      );
    }

    if (extension === "docx" || extension === "doc") {
      const fullUrl = `${window.location.origin}/licencias/${ruta}`;
      return (
        <iframe
          src={`https://docs.google.com/gview?url=${encodeURIComponent(fullUrl)}&embedded=true`}
          width="100%"
          height="400px"
          style={{ border: "none" }}
          title={archivo.nombre}
        ></iframe>
      );
    }

    if (["png", "jpg", "jpeg"].includes(extension)) {
      return (
        <img
          src={`/licencias/${ruta}`}
          alt={archivo.nombre}
          style={{ width: "100%", height: "400px", objectFit: "contain" }}
        />
      );
    }

    return <p>El archivo no es compatible para previsualización.</p>;
  };

  const descargarArchivo = (archivo) => {
    const ruta = carpetaActual ? archivo.ruta : archivo.nombre;
    const link = document.createElement('a');
    link.href = `/licencias/${ruta}`;
    link.download = archivo.nombre;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <LayoutWithSidebar>
      <PageHeader titulo="Licencias de Software" />
      <div style={{ padding: "24px" }}>
        {/* Logos Fijos */}
        <div style={{ position: "fixed", top: 10, left: 10, zIndex: 2000 }}></div>
        <div style={{ position: "fixed", top: 10, right: 10, zIndex: 2000 }}>
          <img
            src="/nexoti-logo.svg?v=1"
            alt="NexoTI"
            style={{ height: 56, width: "auto", objectFit: "contain" }}
          />
        </div>

        {/* Encabezado con navegación */}
        <div style={{ marginBottom: "24px" }}>
          <h1
            style={{
              fontSize: "36px",
              color: "#2c3e50",
              textShadow: "2px 2px 4px rgba(0,0,0,0.3)",
              fontWeight: "900",
              letterSpacing: "1px",
              textAlign: "center",
              marginBottom: "16px",
            }}
          >
            📜 Licencias de Software
          </h1>

          {/* Breadcrumb */}
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: "12px",
            justifyContent: "center",
            marginBottom: "16px"
          }}>
            <button
              onClick={() => router.push("/")}
              style={{
                padding: "8px 16px",
                backgroundColor: "#2980b9",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: "600",
              }}
            >
              🏠 Inicio
            </button>

            {carpetaActual && (
              <>
                <span style={{ fontSize: "20px", color: "#7f8c8d" }}>›</span>
                <button
                  onClick={volverAtras}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "#95a5a6",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontWeight: "600",
                  }}
                >
                  ← Volver a Licencias
                </button>
                <span style={{ fontSize: "20px", color: "#7f8c8d" }}>›</span>
                <span style={{ 
                  fontSize: "18px", 
                  fontWeight: "700",
                  color: "#2c3e50",
                  padding: "8px 16px",
                  backgroundColor: "#ecf0f1",
                  borderRadius: "6px"
                }}>
                  📁 {carpetaActual}
                </span>
              </>
            )}
          </div>
        </div>

        {cargando ? (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <p style={{ fontSize: "18px", color: "#7f8c8d" }}>Cargando licencias...</p>
          </div>
        ) : (
          <>
            {/* Carpetas (solo en vista principal) */}
            {!carpetaActual && carpetas.length > 0 && (
              <div style={{ marginBottom: "32px" }}>
                <h2 style={{ 
                  fontSize: "24px", 
                  fontWeight: "700",
                  color: "#2c3e50",
                  marginBottom: "16px",
                  borderBottom: "3px solid #3498db",
                  paddingBottom: "8px"
                }}>
                  📂 Carpetas de Licencias
                </h2>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                    gap: "16px",
                  }}
                >
                  {carpetas.map((carpeta, index) => (
                    <div
                      key={index}
                      onClick={() => abrirCarpeta(carpeta.nombre)}
                      style={{
                        border: "2px solid #3498db",
                        borderRadius: "12px",
                        padding: "24px",
                        cursor: "pointer",
                        textAlign: "center",
                        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                        color: "white",
                        transition: "all 0.3s ease",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "translateY(-4px)";
                        e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.25)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
                      }}
                    >
                      <div style={{ fontSize: "48px", marginBottom: "12px" }}>📁</div>
                      <div style={{ 
                        fontSize: "20px", 
                        fontWeight: "700",
                        textShadow: "1px 1px 2px rgba(0,0,0,0.3)"
                      }}>
                        {carpeta.nombre}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Archivos */}
            {archivos.length > 0 && (
              <div>
                <h2 style={{ 
                  fontSize: "24px", 
                  fontWeight: "700",
                  color: "#2c3e50",
                  marginBottom: "16px",
                  borderBottom: "3px solid #9b59b6",
                  paddingBottom: "8px"
                }}>
                  📄 {carpetaActual ? `Licencias - ${carpetaActual}` : 'Licencias de Software'}
                </h2>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                    gap: "16px",
                  }}
                >
                  {archivos.map((archivo, index) => (
                    <div
                      key={index}
                      style={{
                        border: "1px solid #ccc",
                        borderRadius: "8px",
                        overflow: "hidden",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                        transition: "all 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.2)";
                        e.currentTarget.style.transform = "translateY(-2px)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";
                        e.currentTarget.style.transform = "translateY(0)";
                      }}
                    >
                      <div
                        style={{
                          padding: "12px",
                          background: "linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%)",
                          color: "white",
                          fontWeight: "bold",
                          fontSize: "14px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span style={{ flex: 1, marginRight: "8px" }}>{archivo.nombre}</span>
                        <div style={{ display: "flex", gap: "4px" }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setArchivoActivo(archivo);
                            }}
                            style={{
                              padding: "4px 8px",
                              backgroundColor: "#3498db",
                              color: "white",
                              border: "none",
                              borderRadius: "4px",
                              cursor: "pointer",
                              fontSize: "12px",
                            }}
                            title="Ver licencia"
                          >
                            👁️
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              descargarArchivo(archivo);
                            }}
                            style={{
                              padding: "4px 8px",
                              backgroundColor: "#27ae60",
                              color: "white",
                              border: "none",
                              borderRadius: "4px",
                              cursor: "pointer",
                              fontSize: "12px",
                            }}
                            title="Descargar licencia"
                          >
                            ⬇️
                          </button>
                        </div>
                      </div>
                      <div 
                        style={{ cursor: "pointer" }}
                        onClick={() => setArchivoActivo(archivo)}
                      >
                        {renderArchivo(archivo)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {carpetas.length === 0 && archivos.length === 0 && (
              <div style={{ 
                textAlign: "center", 
                padding: "60px 20px",
                backgroundColor: "#ecf0f1",
                borderRadius: "12px"
              }}>
                <div style={{ fontSize: "64px", marginBottom: "16px" }}>📜</div>
                <p style={{ fontSize: "18px", color: "#7f8c8d", fontWeight: "600" }}>
                  No hay licencias disponibles en esta carpeta
                </p>
              </div>
            )}
          </>
        )}

        {/* Modal para visualizar en grande */}
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
              zIndex: 3000,
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
                position: "relative",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {renderArchivo(archivoActivo)}
              
              {/* Botones del modal */}
              <div style={{
                position: "absolute",
                top: "10px",
                right: "10px",
                display: "flex",
                gap: "8px",
                zIndex: 3100
              }}>
                <button
                  onClick={() => descargarArchivo(archivoActivo)}
                  style={{
                    backgroundColor: "#27ae60",
                    color: "white",
                    border: "none",
                    padding: "8px 16px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: "600",
                  }}
                >
                  ⬇️ Descargar
                </button>
                <button
                  style={{
                    backgroundColor: "#c0392b",
                    color: "white",
                    border: "none",
                    padding: "8px 16px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: "600",
                  }}
                  onClick={() => setArchivoActivo(null)}
                >
                  ✕ Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </LayoutWithSidebar>
  );
}
