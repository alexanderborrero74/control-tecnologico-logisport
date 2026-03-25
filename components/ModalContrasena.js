// components/ModalContrasena.js
import { useState, useEffect, useRef } from "react";
import { Lock, X, ShieldCheck } from "lucide-react";

export default function ModalContrasena({ abierto, modulo, onConfirmar, onCancelar, error, modoGate = false }) {
  const [clave, setClave] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (abierto) {
      setClave("");
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [abierto]);

  const handleEnter = (e) => {
    if (e.key === "Enter" && clave.trim()) onConfirmar(clave.trim());
  };

  const handleConfirmar = () => {
    if (clave.trim()) onConfirmar(clave.trim());
  };

  if (!abierto) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "#fff", borderRadius: "20px",
        padding: "2.5rem 2rem", width: "100%", maxWidth: "400px",
        boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
        position: "relative", animation: "fadeInScale 0.2s ease",
      }}>

        {!modoGate && (
          <button onClick={onCancelar} style={{
            position: "absolute", top: "1rem", right: "1rem",
            background: "#f1f5f9", border: "none", borderRadius: "8px",
            padding: "0.4rem", cursor: "pointer", color: "#64748b",
            display: "flex", alignItems: "center",
          }}>
            <X size={18}/>
          </button>
        )}

        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div style={{
            width: "64px", height: "64px", borderRadius: "50%",
            background: "linear-gradient(135deg, #0B3D91, #00AEEF)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 1rem",
            boxShadow: "0 8px 20px rgba(11,61,145,0.3)",
          }}>
            <Lock size={28} color="#fff"/>
          </div>
          <h2 style={{ margin: 0, color: "#0B3D91", fontWeight: "800", fontSize: "1.3rem" }}>
            Acceso restringido
          </h2>
          <p style={{ margin: "0.4rem 0 0", color: "#64748b", fontSize: "0.9rem" }}>
            <strong>{modulo}</strong> requiere contraseña
          </p>
        </div>

        {/* Campo oculto — type="text" con color transparente, sin asteriscos */}
        <div style={{ position: "relative", marginBottom: "1rem", height: "52px" }}>
          <input
            ref={inputRef}
            type="text"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            value={clave}
            onChange={e => setClave(e.target.value)}
            onKeyDown={handleEnter}
            style={{
              position: "absolute", inset: 0,
              width: "100%", height: "100%",
              padding: "0 1rem",
              border: `2px solid ${error ? "#ef4444" : "#bfdbfe"}`,
              borderRadius: "12px",
              fontSize: "1rem",
              outline: "none",
              boxSizing: "border-box",
              background: error ? "#fff5f5" : "#eff6ff",
              color: "transparent",
              caretColor: "#0B3D91",
              zIndex: 2,
            }}
          />
          {/* Overlay visual encima del input */}
          <div style={{
            position: "absolute", inset: 0,
            padding: "0 1rem",
            border: `2px solid ${error ? "#ef4444" : "#bfdbfe"}`,
            borderRadius: "12px",
            background: "transparent",
            display: "flex", alignItems: "center",
            pointerEvents: "none",
            zIndex: 1,
          }}>
            {clave.length === 0 ? (
              <span style={{ color: "#94a3b8", fontSize: "0.95rem" }}>
                Ingresa la clave de acceso...
              </span>
            ) : (
              <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
                {Array.from({ length: Math.min(clave.length, 24) }).map((_, i) => (
                  <div key={i} style={{
                    width: "9px", height: "9px", borderRadius: "50%",
                    background: "#0B3D91", flexShrink: 0,
                  }}/>
                ))}
                {clave.length > 24 && (
                  <span style={{ color: "#0B3D91", fontSize: "0.75rem", fontWeight: "700" }}>
                    +{clave.length - 24}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {error && (
          <div style={{
            marginBottom: "1rem", padding: "0.6rem 0.9rem",
            background: "#fef2f2", border: "1px solid #fca5a5",
            borderRadius: "8px", color: "#dc2626",
            fontSize: "0.82rem", fontWeight: "600",
          }}>
            ❌ {error}
          </div>
        )}

        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button onClick={onCancelar} style={{
            flex: 1, padding: "0.85rem", background: "#f1f5f9",
            border: "none", borderRadius: "12px", cursor: "pointer",
            fontWeight: "700", color: "#475569", fontSize: "0.95rem",
          }}>
            Cancelar
          </button>
          <button
            onClick={handleConfirmar}
            disabled={!clave.trim()}
            style={{
              flex: 2, padding: "0.85rem",
              background: clave.trim()
                ? "linear-gradient(135deg, #0B3D91, #00AEEF)"
                : "#e2e8f0",
              border: "none", borderRadius: "12px",
              cursor: clave.trim() ? "pointer" : "not-allowed",
              fontWeight: "800",
              color: clave.trim() ? "#fff" : "#94a3b8",
              fontSize: "0.95rem",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
              boxShadow: clave.trim() ? "0 4px 12px rgba(11,61,145,0.3)" : "none",
              transition: "all 0.2s",
            }}>
            <ShieldCheck size={18}/> Ingresar
          </button>
        </div>
      </div>

      <style jsx global>{`
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.92); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
