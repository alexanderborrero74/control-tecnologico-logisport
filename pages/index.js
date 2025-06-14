import { useRouter } from "next/router";
import { useEffect, useState, useRef } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";

const botonStyle = {
  padding: "14px 28px",
  fontWeight: "bold",
  fontSize: "16px",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
  background: "linear-gradient(145deg, #4e73df, #2c3e9e)", // Agregado un gradiente
  color: "#fff",
  width: "80%",
  maxWidth: "400px",
  transition: "all 0.3s ease", // Transición suave para hover
  boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)", // Sombra sutil
  fontFamily: "'Arial', sans-serif",
};

const botonHoverStyle = {
  background: "linear-gradient(145deg, #2c3e9e, #4e73df)", // Efecto de hover
  boxShadow: "0 6px 10px rgba(0, 0, 0, 0.2)", // Sombra más intensa al hacer hover
  transform: "scale(1.05)", // Aumento al hacer hover
};

const footerStyle = {
  position: "fixed",
  bottom: 0,
  left: 0,
  width: "100%",
  backgroundColor: "#f1f1f1",
  textAlign: "center",
  padding: "16px",
  fontSize: "14px",
  color: "#555",
  borderTop: "1px solid #ddd",
  zIndex: 1000,
};

function PageWrapper({ title, children, pendientes, toggleLista, mostrarLista }) {
  const router = useRouter();

  return (
    <div style={{ padding: "24px", paddingBottom: "80px" }}>
      <div
        style={{
          position: "sticky",
          top: 0,
          backgroundColor: "#fff",
          padding: "16px",
          zIndex: 1000,
          borderBottom: "1px solid #ddd",
          textAlign: "center",
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
          PLANEADOR TECNOLOGICO LOGISPORT
        </h1>
      </div>

      {children}

      {/* Botón flotante y lista desplegable */}
      {pendientes.length > 0 && (
        <>
          <button
            onClick={toggleLista}
            style={{
              position: "fixed",
              bottom: "100px",
              right: "20px",
              backgroundColor: "#dc3545",
              color: "#fff",
              border: "none",
              borderRadius: "50px",
              padding: "16px",
              fontSize: "14px",
              fontWeight: "bold",
              boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
              cursor: "pointer",
              zIndex: 1000,
              transition: "all 0.3s ease",
            }}
          >
            Servicios pendientes: {pendientes.length}
          </button>

          {mostrarLista && (
            <div
              style={{
                position: "fixed",
                bottom: "160px",
                right: "20px",
                width: "300px",
                maxHeight: "400px",
                overflowY: "auto",
                backgroundColor: "#fff",
                border: "1px solid #ccc",
                borderRadius: "10px",
                boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
                zIndex: 1100,
              }}
            >
              <div
                style={{
                  padding: "12px",
                  fontWeight: "bold",
                  backgroundColor: "#f5f5f5",
                  borderBottom: "1px solid #ddd",
                }}
              >
                Lista de solicitudes pendientes
              </div>
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {pendientes.map((item, index) => (
                  <li key={index} style={{ padding: "10px", borderBottom: "1px solid #eee" }}>
                    <strong>{item.nombre}</strong>
                    <br />
                    <small>{item.fecha}</small>
                    <br />
                    <span>{item.descripcion?.slice(0, 60)}...</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {/* Botón de regreso */}
      {router.pathname !== "/" && (
        <div style={{ textAlign: "center", marginTop: "32px" }}>
          <button
            style={{
              padding: "14px 28px",
              fontWeight: "bold",
              backgroundColor: "#3498db",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              transition: "all 0.3s ease",
              boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
            }}
            onClick={() => router.push("/")}
          >
            Regresar
          </button>
        </div>
      )}

      {/* Footer */}
      <footer style={footerStyle}>
        © 2025 <strong>Alexander Borrero - Soporteia.Net 310-5056616</strong>. Todos los derechos reservados.
      </footer>
    </div>
  );
}

export default function ControlTecnologico() {
  const [pendientes, setPendientes] = useState([]);
  const [mostrarLista, setMostrarLista] = useState(false);
  const router = useRouter();
  const listaRef = useRef();

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "solicitudes"), (snapshot) => {
      const activos = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((doc) => !doc.finalizado || doc.finalizado !== "si");
      setPendientes(activos);
    });

    return () => unsubscribe();
  }, []);

  // Ocultar lista si se hace clic fuera
  useEffect(() => {
    function handleClickOutside(e) {
      if (listaRef.current && !listaRef.current.contains(e.target)) {
        setMostrarLista(false);
      }
    }
    if (mostrarLista) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [mostrarLista]);

  return (
    <PageWrapper
      title="PLANEADOR TECNOLOGICO LOGISPORT"
      pendientes={pendientes}
      mostrarLista={mostrarLista}
      toggleLista={() => setMostrarLista(!mostrarLista)}
    >
      {/* Imagen izquierda */}
      <div
        style={{
          position: "fixed",
          left: 50,
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: 999,
          padding: "10px",
          maxWidth: "25%",
          minWidth: "80px",
        }}
      >
        <img
          src="/img/logo1.png"
          alt="Logo Izquierdo"
          style={{
            width: "100%",
            height: "auto",
            maxHeight: "300px",
            objectFit: "contain",
          }}
        />
      </div>

      {/* Imagen derecha */}
      <div
        style={{
          position: "fixed",
          right: 0,
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: 999,
          padding: "10px",
          maxWidth: "30%",
          minWidth: "80px",
        }}
      >
        <img
          src="/img/planeador.png"
          alt="Logo Derecho"
          style={{
            width: "100%",
            height: "auto",
            maxHeight: "300px",
            objectFit: "contain",
          }}
        />
      </div>

      {/* Botonera */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          alignItems: "center",
          paddingTop: "40px",
          paddingLeft: "22%",
          paddingRight: "22%",
        }}
      >
        <button style={botonStyle} onClick={() => router.push("/servicios-tecnicos")}>
          Servicios Técnicos Realizados
        </button>
        
        <button style={botonStyle} onClick={() => router.push("/solicitudserviciotecnico")}>
          Solicitar Servicio Técnico
        </button>
        <button style={botonStyle} onClick={() => router.push("/hoja-vida")}>
          Hoja de Vida Equipos
        </button>
        <button style={botonStyle} onClick={() => router.push("/registro-fotografico")}>
          Registro Fotográfico
        </button>
        <button style={botonStyle} onClick={() => router.push("/licencias")}>
          Licencias
        </button>
        <button style={botonStyle} onClick={() => router.push("/nube")}>
          Nube Privada
        </button>
        <button style={botonStyle} onClick={() => router.push("/usuario-aplicaciones-licencias")}>
          Implementación de Aplicaciones y Licencias
        </button>
        <button style={botonStyle} onClick={() => router.push("/estadisticas")}>
          Estadística Servicios Técnicos
        </button>
        <button style={botonStyle} onClick={() => router.push("/procesoit")}>
          Procesos Tecnologicos IT Implementados
        </button>
        <button style={botonStyle} onClick={() => router.push("/documentacionti")}>
          Documentación
        </button>
      </div>
    </PageWrapper>
  );
}
