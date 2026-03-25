"use client";
import { useEffect, useState, useRef } from "react";

export default function AlertsFloat() {
  const [alerts, setAlerts] = useState([]);
  const [count, setCount] = useState(0);
  const [prevCount, setPrevCount] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const modalRef = useRef(null);

  // === Reproducir sonido de alerta ===
  const playAlertSound = () => {
    const audio = new Audio("/alert-sound.mp3");
    audio.volume = 0.6;
    audio.play().catch(() => {
      console.warn("El sonido no se pudo reproducir automáticamente.");
    });
  };

  // === Vibración (en móviles) ===
  const vibrateAlert = () => {
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }
  };

  // === Cargar alertas desde la API /api/alerts ===
  useEffect(() => {
    async function fetchAlerts() {
      try {
        const res = await fetch("/api/alerts");
        const data = await res.json();
        if (data.ok) {
          const newCount = data.count || 0;
          setAlerts(data.items || []);
          setPrevCount(count);
          setCount(newCount);

          // Si hay nuevas alertas, emitir sonido y vibración
          if (newCount > prevCount) {
            playAlertSound();
            vibrateAlert();
          }
        } else {
          console.error("Error cargando alertas:", data);
        }
      } catch (err) {
        console.error("Error obteniendo alertas:", err);
      }
    }

    fetchAlerts();
    const interval = setInterval(fetchAlerts, 60000); // cada minuto
    return () => clearInterval(interval);
  }, [count, prevCount]);

  // === Cerrar modal al hacer click fuera ===
  const handleBackdropClick = (e) => {
    if (modalRef.current && e.target === modalRef.current) {
      setShowModal(false);
    }
  };

  return (
    <>
      {/* === BOTÓN FLOTANTE === */}
      <button
        className={`alertFloatBtn ${count > 0 ? "blink" : ""}`}
        onClick={() => setShowModal(true)}
        title="Ver alertas activas"
        aria-haspopup="dialog"
      >
        <span className="icon">🔔</span>
        <span className="label">Alertas</span>
        {count > 0 && <span className="count">{count}</span>}
      </button>

      {/* === MODAL === */}
      {showModal && (
        <div
          className="alertModalBackdrop"
          ref={modalRef}
          onClick={handleBackdropClick}
          role="dialog"
          aria-modal="true"
          aria-labelledby="alert-title"
        >
          <div className="alertModalCard">
            <div className="alertModalHeader">
              <div className="alertModalTitleWrap">
                <span className="alertIcon">🚨</span>
                <h3 id="alert-title" className="alertModalTitle">
                  Equipos con alertas
                </h3>
                <span className="alertCount">{count}</span>
              </div>
              <button
                className="closeAlertBtn"
                onClick={() => setShowModal(false)}
              >
                Cerrar
              </button>
            </div>

            <div className="alertModalBody">
              {count === 0 ? (
                <div className="emptyState">No hay alertas activas 🎉</div>
              ) : (
                <div className="tableWrap">
                  <div className="tableHead">
                    <div>Equipo</div>
                    <div>Usuario</div>
                    <div>Alerta</div>
                  </div>
                  <div className="tableBody">
                    {alerts.map((a, i) => (
                      <div key={i} className="tableRow">
                        <div className="cell strong">{a.hostname || a.id}</div>
                        <div className="cell">{a.username || "—"}</div>
                        <div className="cell">
                          {Array.isArray(a.alerts) && a.alerts.length > 0 ? (
                            <ul className="alertList">
                            <ul className="alertList">
  {a.alerts.map((msg, j) => {
    const isShutdown = msg.toLowerCase().includes("apagó de forma inesperada");
    const fecha = a.updatedAt
      ? new Date(a.updatedAt).toLocaleString("es-CO", {
          dateStyle: "short",
          timeStyle: "medium",
        })
      : null;
    return (
      <li key={j}>
        {isShutdown && fecha
          ? `Apagado inesperado detectado el ${fecha}`
          : msg}
      </li>
    );
  })}
</ul>

                            </ul>
                          ) : (
                            <span className="muted">(sin detalles)</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* === ESTILOS === */}
      <style jsx>{`
        /* === BOTÓN FLOTANTE === */
        .alertFloatBtn {
          position: fixed;
          bottom: 300px;
          right: 24px;
          background: #ef4444;
          color: #fff;
          border: none;
          border-radius: 50%;
          width: 80px;
          height: 80px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: bold;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.25);
          cursor: pointer;
          z-index: 50;
          transition: all 0.2s ease;
        }
        .alertFloatBtn:hover {
          filter: brightness(1.15);
          transform: scale(1.05);
        }
        .icon {
          font-size: 24px;
          line-height: 1;
        }
        .label {
          margin-top: 2px;
          font-size: 11px;
          font-weight: 700;
        }
        .count {
          position: absolute;
          top: 4px;
          right: 4px;
          background: #fff;
          color: #ef4444;
          font-size: 10px;
          font-weight: 800;
          border-radius: 999px;
          padding: 2px 6px;
        }

        /* Parpadeo cuando hay alertas */
        @keyframes blink {
          0%, 50%, 100% {
            opacity: 1;
          }
          25%, 75% {
            opacity: 0.4;
          }
        }
        .blink {
          animation: blink 1s infinite;
        }

        /* === MODAL === */
        .alertModalBackdrop {
          position: fixed;
          inset: 0;
          z-index: 60;
          background: radial-gradient(
            1200px 800px at 50% 90%,
            rgba(15, 23, 42, 0.2),
            rgba(2, 6, 23, 0.55)
          );
          display: grid;
          place-items: center;
          padding: 20px;
          backdrop-filter: blur(2px);
        }
        .alertModalCard {
          width: min(960px, 95vw);
          background: rgba(255, 255, 255, 0.95);
          border-radius: 16px;
          box-shadow: 0 30px 80px rgba(2, 6, 23, 0.25);
          overflow: hidden;
          animation: pop 0.16s ease-out;
        }
        @keyframes pop {
          from {
            transform: translateY(10px);
            opacity: 0.6;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .alertModalHeader {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px 16px;
          background: linear-gradient(180deg, #fff 0%, #f8fafc 100%);
          border-bottom: 1px solid #e5e7eb;
        }
        .alertModalTitleWrap {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .alertIcon {
          font-size: 20px;
        }
        .alertModalTitle {
          margin: 0;
          font-size: 16px;
          font-weight: 900;
          color: #0f172a;
        }
        .alertCount {
          background: #ef4444;
          color: #fff;
          font-weight: 800;
          font-size: 12px;
          border-radius: 999px;
          padding: 2px 8px;
        }
        .closeAlertBtn {
          background: #0f172a;
          color: #fff;
          border: none;
          border-radius: 10px;
          padding: 6px 10px;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 6px 16px rgba(2, 6, 23, 0.2);
        }
        .alertModalBody {
          padding: 12px 14px;
          max-height: min(70vh, 600px);
          overflow: auto;
        }
        .emptyState {
          padding: 20px;
          text-align: center;
          color: #334155;
          font-weight: 600;
        }
        .tableWrap {
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          overflow: hidden;
        }
        .tableHead {
          display: grid;
          grid-template-columns: 200px 200px 1fr;
          background: #0ea5e9;
          color: #fff;
          font-weight: 900;
          font-size: 13px;
          padding: 10px 12px;
        }
        .tableBody {
          display: grid;
        }
        .tableRow {
          display: grid;
          grid-template-columns: 200px 200px 1fr;
          border-top: 1px solid #e5e7eb;
          background: #fff;
        }
        .tableRow:nth-child(odd) {
          background: #f8fafc;
        }
        .cell {
          padding: 10px 12px;
          font-size: 13px;
          color: #0f172a;
        }
        .cell.strong {
          font-weight: 800;
        }
        .alertList {
          margin: 0;
          padding-left: 18px;
          list-style-type: disc;
        }
      `}</style>
    </>
  );
}
