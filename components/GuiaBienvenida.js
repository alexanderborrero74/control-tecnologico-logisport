// components/GuiaBienvenida.js
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { getAuth, onAuthStateChanged } from "firebase/auth";

/**
 * Asistente flotante animado con bienvenida por voz:
 * - Visible en todas las páginas (se monta en _app.js).
 * - Home ("/"): 2 frases; la segunda aparece a los 3s.
 * - Minimizable y opción "No mostrar (1 día)" (localStorage).
 * - Al cambiar de página, se reabre (maximiza) automáticamente.
 * - VOZ:
 *   - dice “Bienvenido <nombre>” (antes del @ del email) cada vez que el usuario inicia sesión
 *   - escucha el evento 'guia-pendientes-audio' para decir “Hay servicios pendientes por finalizar”
 */
export default function GuiaBienvenida() {
  const router = useRouter();
  const [visible, setVisible] = useState(true);
  const [open, setOpen] = useState(true);
  const [user, setUser] = useState(null);

  // ======== UTIL: TTS (texto a voz) ========
  const [pendingTTS, setPendingTTS] = useState("");
  const lastWelcomeRef = useRef({ uid: "", at: 0 }); // evita disparos dobles por el mismo onAuthStateChanged inmediato

  const pickSpanishVoice = () => {
    try {
      const voices = window.speechSynthesis.getVoices() || [];
      const es = voices.find((v) => (v.lang || "").toLowerCase().startsWith("es"));
      return es || voices[0] || null;
    } catch {
      return null;
    }
  };

  const speak = (text) => {
    try {
      if (!window.speechSynthesis || !text) return false;
      const utter = new SpeechSynthesisUtterance(text);
      const voice = pickSpanishVoice();
      if (voice) utter.voice = voice;
      utter.lang = (voice?.lang || "es-ES");
      utter.rate = 1;
      utter.pitch = 1;
      utter.volume = 1;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
      return true;
    } catch {
      return false;
    }
  };

  // Desbloqueo si el navegador exige gesto del usuario
  useEffect(() => {
    if (!pendingTTS) return;
    const unlock = () => {
      if (speak(pendingTTS)) setPendingTTS("");
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [pendingTTS]);

  // Carga voces inicial
  useEffect(() => {
    try {
      window.speechSynthesis?.getVoices?.();
      const onVoices = () => {};
      window.speechSynthesis?.addEventListener?.("voiceschanged", onVoices);
      return () => {
        window.speechSynthesis?.removeEventListener?.("voiceschanged", onVoices);
      };
    } catch {}
  }, []);

  // ======== Mensajes del asistente por ruta ========
  const scriptMap = (email) => {
    const saludoHome = `Hola soy Alexander Borrero tu guía tecnológico, ${
      email ? `veo que estás autenticado (${email}), ` : ""
    }Bienvenido.`;

    return {
      "/": [saludoHome, ""],
      "/servicios-tecnicos": [
        "Hola colaborador, recuerda diligenciar todos los campos y tener el código de seguridad del servicio para que puedas finalizar tu soporte con éxito. Ten en cuenta las buenas prácticas.",
      ],
      "/solicitudserviciotecnico": [
        "¿Estás seguro de tener una falla real? ¿Ya utilizaste todos los recursos antes de avisarle a nuestro proveedor? Entre más específico seas al transmitir tu solicitud, ¡la solución será más rápida y efectiva!",
      ],
      "/hoja-vida": [
        "Si vas a ingresar un equipo nuevo recuerda llenar todos los campos. Si vas a dar de baja, actualiza el formato de activos.",
      ],
      "/control-de-contrasenas": [
        "Debemos actualizar constantemente las bases de datos y accesos para cumplir con las normas de seguridad. Aquí puedes exportar tu información y mantenerla segura.",
      ],
    };
  };

  // Usuario + bienvenida por voz en cada inicio de sesión
  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u || null);

      // Si hay usuario, dar bienvenida SIEMPRE en cada login
      try {
        if (!u) return;
        const now = Date.now();
        // evita doble disparo en milisegundos para el mismo uid
        if (lastWelcomeRef.current.uid === u.uid && now - lastWelcomeRef.current.at < 1500) return;
        lastWelcomeRef.current = { uid: u.uid, at: now };

        const nameFromEmail = (u.email || "").split("@")[0] || "";
        const name = (u.displayName?.split(" ")?.[0]) || nameFromEmail || "usuario";
        const phrase = `Bienvenido ${name}`;

        setTimeout(() => {
          const ok = speak(phrase);
          if (!ok) setPendingTTS(phrase);
        }, 400);
      } catch {}
    });
    return () => unsub();
  }, []);

  // Respeta "no mostrar por 1 día"
  useEffect(() => {
    try {
      const raw = localStorage.getItem("guiaBienvenida:hideUntil");
      if (raw && Number(raw) > Date.now()) setVisible(false);
    } catch {}
  }, []);

  // Mensajes por ruta con retardo de 3s para la segunda frase (si existe)
  const [msgIndex, setMsgIndex] = useState(0);
  const timerRef = useRef(null);

  const messages = (() => {
    const map = scriptMap(user?.email || "");
    return map[router.pathname] || ["Bienvenido. Explora las opciones disponibles en esta sección."];
  })();

  useEffect(() => {
    setMsgIndex(0);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (messages.length > 1) {
      timerRef.current = setTimeout(() => setMsgIndex(1), 3000);
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.pathname, user?.email]);

  // Al cambiar de ruta: volver a maximizar (si está visible)
  useEffect(() => {
    if (visible) setOpen(true);
  }, [router.pathname, visible]);

  // === Escuchar AUDIO de pendientes (disparado desde pages/index.js) ===
  useEffect(() => {
    const handler = () => {
      const phrase = "Hay servicios pendientes por finalizar";
      const ok = speak(phrase);
      if (!ok) setPendingTTS(phrase);
    };
    window.addEventListener("guia-pendientes-audio", handler);
    return () => window.removeEventListener("guia-pendientes-audio", handler);
  }, []);

  if (!visible) return null;

  // Ocultar por 1 día
  const hideForOneDay = () => {
    try {
      const ONE_DAY = 1000 * 60 * 60 * 24; // 1 día
      localStorage.setItem("guiaBienvenida:hideUntil", String(Date.now() + ONE_DAY));
    } catch {}
    setVisible(false);
  };

  return (
    <>
      <div className="assistant-wrap">
        {/* Controles */}
        <div className="controls">
          <button
            title={open ? "Minimizar" : "Abrir"}
            className="ctrl"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "─" : "＋"}
          </button>
          <button title="No mostrar por 1 día" className="ctrl" onClick={hideForOneDay}>
            ✕
          </button>
        </div>

        {/* Personaje */}
        <div className={`avatar ${open ? "" : "avatar--compact"}`} aria-hidden>
          <div className="head">
            <div className="eye eye--l" />
            <div className="eye eye--r" />
            <div className="mouth" />
          </div>
          <div className="body">
            <div className="arm arm--l" />
            <div className="arm arm--r" />
          </div>
          <div className="shadow" />
        </div>

        {/* Globo desde la boca */}
        {open && (
          <div className="bubble">
            <div className="bubble-title">Asistente</div>
            <div className="bubble-text">{messages[msgIndex] || messages[0]}</div>

            <div className="bubble-actions">
              <button className="btn-secondary" onClick={() => setOpen(false)}>
                Minimizar
              </button>
              <button className="btn-ghost" onClick={hideForOneDay}>
                No mostrar (1 día)
              </button>
            </div>

            <div className="tail" />
          </div>
        )}
      </div>

      {/* Estilos y animaciones (tus estilos originales) */}
      <style jsx>{`
        .assistant-wrap {
          position: fixed;
          right: 24px;
          bottom: 24px;
          z-index: 3000;
          width: 320px;
          pointer-events: auto;
          font-family: Arial, sans-serif;
        }
        .controls {
          position: absolute;
          top: -6px;
          right: -6px;
          display: flex;
          gap: 6px;
        }
        .ctrl {
          background: #007acc;
          color: #fff;
          border: 0;
          border-radius: 8px;
          padding: 6px 8px;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .avatar {
          position: relative;
          width: 110px;
          height: 150px;
          margin-left: auto;
          animation: float 3.3s ease-in-out infinite;
          filter: drop-shadow(0 10px 24px rgba(0, 0, 0, 0.18));
        }
        .avatar--compact {
          height: 110px;
        }

        .head {
          position: relative;
          width: 90px;
          height: 78px;
          margin: 0 auto;
          background: #ffffff;
          border: 2px solid #007acc;
          border-radius: 22px 22px 18px 18px;
          box-shadow: inset 0 -4px 0 #e5f2fb;
        }
        .eye {
          position: absolute;
          top: 28px;
          width: 14px;
          height: 14px;
          background: #111827;
          border-radius: 50%;
          animation: blink 4.5s infinite;
        }
        .eye--l {
          left: 24px;
        }
        .eye--r {
          right: 24px;
          animation-delay: 2.1s;
        }

        .mouth {
          position: absolute;
          left: 50%;
          bottom: 12px;
          transform: translateX(-50%);
          width: 24px;
          height: 6px;
          background: #ef4444;
          border-radius: 10px;
          box-shadow: inset 0 -1px 0 rgba(0, 0, 0, 0.15);
        }

        .body {
          position: relative;
          width: 74px;
          height: 56px;
          margin: 6px auto 0;
          background: #007acc;
          border-radius: 18px;
          box-shadow: inset 0 -4px 0 #005e9b;
          animation: sway 2.8s ease-in-out infinite;
        }
        .arm {
          position: absolute;
          top: -4px;
          width: 14px;
          height: 42px;
          background: #007acc;
          border-radius: 8px;
        }
        .arm--l {
          left: -10px;
          transform-origin: top right;
          animation: wave 2.8s ease-in-out infinite;
        }
        .arm--r {
          right: -10px;
        }

        .shadow {
          position: absolute;
          left: 8px;
          right: 8px;
          bottom: -6px;
          height: 8px;
          background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0.25), rgba(0, 0, 0, 0));
          filter: blur(1px);
          animation: squish 3.3s ease-in-out infinite;
        }

        .bubble {
          position: absolute;
          right: 110px;
          bottom: 38px;
          width: 230px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 12px;
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
        }
        .bubble-title {
          font-weight: 900;
          color: #111827;
          margin-bottom: 6px;
        }
        .bubble-text {
          color: #1f2937;
          font-size: 14px;
          white-space: pre-wrap;
        }
        .bubble-actions {
          display: flex;
          gap: 8px;
          margin-top: 8px;
          flex-wrap: wrap;
        }
        .btn-secondary {
          background: #6b7280;
          color: #ffffff;
          padding: 8px 10px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 700;
        }
        .btn-ghost {
          background: #ffffff;
          color: #374151;
          padding: 8px 10px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 700;
        }
        .tail {
          position: absolute;
          right: -8px;
          bottom: 18px;
          width: 0;
          height: 0;
          border-left: 10px solid #ffffff;
          border-top: 10px solid transparent;
          border-bottom: 10px solid transparent;
          filter: drop-shadow(2px 0 0 rgba(0, 0, 0, 0.08));
        }

        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes sway {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(-2deg); }
        }
        @keyframes squish {
          0%, 100% { transform: scaleX(1); opacity: 0.5; }
          50% { transform: scaleX(0.85); opacity: 0.7; }
        }
        @keyframes blink {
          0%, 92%, 100% { transform: scaleY(1); }
          95% { transform: scaleY(0.1); }
        }
        @keyframes wave {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(10deg); }
        }

        @media (max-width: 480px) {
          .assistant-wrap { width: 90vw; right: 5vw; }
          .bubble { width: calc(90vw - 110px); }
        }
      `}</style>
    </>
  );
}
