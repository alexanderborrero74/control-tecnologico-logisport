// components/ModalEnviarEmail.js
import { X } from "lucide-react";

export default function ModalEnviarEmail({ 
  isOpen, 
  onClose, 
  servicio, 
  onEnviar,
  enviando 
}) {
  if (!isOpen) return null;

  return (
    <div 
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div 
        style={{
          backgroundColor: "white",
          borderRadius: 16,
          padding: 24,
          maxWidth: 600,
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 24, color: "#111827", fontWeight: 800 }}>
            📧 Enviar Informe por Correo
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 8,
              borderRadius: 8,
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "#f3f4f6"}
            onMouseLeave={(e) => e.currentTarget.style.background = "none"}
          >
            <X size={24} color="#6b7280" />
          </button>
        </div>

        {/* Información del servicio */}
        <div style={{
          background: "#f0f9ff",
          padding: 16,
          borderRadius: 12,
          marginBottom: 20,
          border: "1px solid #3b82f6",
        }}>
          <h3 style={{ margin: "0 0 12px 0", fontSize: 16, color: "#1e40af", fontWeight: 700 }}>
            Detalles del Servicio
          </h3>
          <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
            <div><strong>Consecutivo:</strong> {servicio?.consecutivo || "N/A"}</div>
            <div><strong>Usuario:</strong> {servicio?.usuario || "N/A"}</div>
            <div><strong>Equipo:</strong> {servicio?.equipo || "N/A"}</div>
            <div><strong>Técnico:</strong> {servicio?.tecnico || "N/A"}</div>
          </div>
        </div>

        <form id="emailForm" onSubmit={onEnviar}>
          {/* Campo de destinatarios */}
          <div style={{ marginBottom: 16 }}>
            <label style={{
              display: "block",
              fontSize: 14,
              fontWeight: 700,
              color: "#374151",
              marginBottom: 8,
            }}>
              Destinatarios <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input
              type="text"
              name="emailsDestino"
              placeholder="correo1@ejemplo.com, correo2@ejemplo.com"
              required
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 8,
                border: "1px solid #d1d5db",
                fontSize: 14,
                outline: "none",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => e.target.style.borderColor = "#3b82f6"}
              onBlur={(e) => e.target.style.borderColor = "#d1d5db"}
            />
            <small style={{ color: "#6b7280", fontSize: 12, marginTop: 4, display: "block" }}>
              Separa múltiples correos con comas
            </small>
          </div>

          {/* Asunto */}
          <div style={{ marginBottom: 16 }}>
            <label style={{
              display: "block",
              fontSize: 14,
              fontWeight: 700,
              color: "#374151",
              marginBottom: 8,
            }}>
              Asunto <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input
              type="text"
              name="asuntoEmail"
              defaultValue={`Informe Técnico - ${servicio?.codigo || servicio?.consecutivo || "Servicio"}`}
              required
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 8,
                border: "1px solid #d1d5db",
                fontSize: 14,
                outline: "none",
              }}
              onFocus={(e) => e.target.style.borderColor = "#3b82f6"}
              onBlur={(e) => e.target.style.borderColor = "#d1d5db"}
            />
          </div>

          {/* Mensaje */}
          <div style={{ marginBottom: 20 }}>
            <label style={{
              display: "block",
              fontSize: 14,
              fontWeight: 700,
              color: "#374151",
              marginBottom: 8,
            }}>
              Mensaje
            </label>
            <textarea
              name="mensajeEmail"
              rows={5}
              defaultValue={`Estimado/a,\n\nAdjunto encontrará el informe técnico del servicio realizado.\n\nDetalles:\n- Consecutivo: ${servicio?.consecutivo || "N/A"}\n- Usuario: ${servicio?.usuario || "N/A"}\n- Fecha: ${servicio?.fecha || "N/A"}\n\nSaludos cordiales.`}
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 8,
                border: "1px solid #d1d5db",
                fontSize: 14,
                fontFamily: "Arial, sans-serif",
                outline: "none",
                resize: "vertical",
              }}
              onFocus={(e) => e.target.style.borderColor = "#3b82f6"}
              onBlur={(e) => e.target.style.borderColor = "#d1d5db"}
            />
          </div>

          {/* Botones */}
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={onClose}
              disabled={enviando}
              style={{
                padding: "12px 24px",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                background: "white",
                color: "#374151",
                fontWeight: 700,
                cursor: enviando ? "not-allowed" : "pointer",
                opacity: enviando ? 0.5 : 1,
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando}
              style={{
                padding: "12px 24px",
                borderRadius: 8,
                border: "none",
                background: enviando ? "#9ca3af" : "#10b981",
                color: "white",
                fontWeight: 700,
                cursor: enviando ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {enviando ? "Enviando..." : "📨 Enviar Correo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
