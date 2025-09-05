import { useState } from "react";

export default function TestEmail() {
  const [to, setTo] = useState("soportesistemas@soporteia.net");
  const [subject, setSubject] = useState("Prueba SMTP desde app");
  const [text, setText] = useState("Correo de prueba.");
  const [html, setHtml] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [fromName, setFromName] = useState("SoporteIA");
  const [resData, setResData] = useState(null);
  const [loading, setLoading] = useState(false);

  const send = async () => {
    setLoading(true);
    setResData(null);
    try {
      const r = await fetch("/api/enviarCorreoElectronico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          subject,
          text: html ? undefined : text,
          html: html || undefined,
          replyTo: replyTo || undefined,
          fromName: fromName || undefined,
          debug: true,
        }),
      });
      const data = await r.json().catch(() => ({}));
      setResData({ status: r.status, ok: r.ok, ...data });
    } catch (e) {
      setResData({ status: 0, ok: false, error: String(e) });
    } finally {
      setLoading(false);
    }
  };

  const input = {
    padding: 8,
    border: "1px solid #ddd",
    borderRadius: 8,
  };

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, sans-serif", maxWidth: 800 }}>
      <h1 style={{ fontWeight: 800, marginBottom: 12 }}>Test envío de correo</h1>
      <div style={{ display: "grid", gap: 8 }}>
        <input
          placeholder="Para"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          style={input}
        />
        <input
          placeholder="Asunto"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          style={input}
        />
        <textarea
          placeholder="Texto (se usa si no pones HTML)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          style={input}
        />
        <textarea
          placeholder="HTML opcional"
          value={html}
          onChange={(e) => setHtml(e.target.value)}
          rows={4}
          style={input}
        />
        <input
          placeholder="replyTo (opcional)"
          value={replyTo}
          onChange={(e) => setReplyTo(e.target.value)}
          style={input}
        />
        <input
          placeholder="fromName (opcional)"
          value={fromName}
          onChange={(e) => setFromName(e.target.value)}
          style={input}
        />
        <button
          onClick={send}
          disabled={loading}
          style={{
            background: "#2563eb",
            color: "#fff",
            border: "none",
            padding: "10px 16px",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          {loading ? "Enviando..." : "Enviar prueba"}
        </button>
        {resData && (
          <pre
            style={{
              background: "#f9fafb",
              padding: 12,
              borderRadius: 8,
              whiteSpace: "pre-wrap",
            }}
          >
            {JSON.stringify(resData, null, 2)}
          </pre>
        )}
      </div>
      <p style={{ marginTop: 12, color: "#6b7280" }}>
        Este formulario usa <code>/api/enviarCorreoElectronico</code>. Si ves un error,
        el JSON mostrará el <b>hint</b> con la causa probable (auth, conexión SMTP, etc.).
      </p>
    </div>
  );
}
