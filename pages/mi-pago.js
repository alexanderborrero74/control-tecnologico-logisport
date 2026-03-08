// pages/mi-pago.js
// Página PÚBLICA — trabajador consulta y descarga su desprendible de pago
// Sin autenticación. Solo necesita su número de cédula.
// Muestra UN SOLO desprendible con TODO el historial del trabajador

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";
import Head from "next/head";
import { DespPrevProduccion } from "./nomina/desprendibles";

const PRIMARY = "#0B3D91";
const SUCCESS = "#059669";
const DANGER  = "#DC2626";
const GRAY    = "#475569";

// ─────────────────────────────────────────────────────────────────────────────
export default function MiPago() {
  const router = useRouter();

  const [cedula,   setCedula]   = useState("");
  const [buscando, setBuscando] = useState(false);
  const [error,    setError]    = useState("");
  const [desp,     setDesp]     = useState(null);   // único desprendible

  useEffect(() => {
    if (!router.isReady) return;
    const { token } = router.query;
    if (token) cargarPorToken(token);
  }, [router.isReady, router.query]);

  const cargarPorToken = async (token) => {
    setBuscando(true); setError("");
    try {
      const snap = await getDoc(doc(db, "nomina_desprendibles", token));
      if (!snap.exists()) { setError("El enlace no es válido o ha expirado."); setBuscando(false); return; }
      setDesp({ id: snap.id, ...snap.data() });
    } catch (e) { setError("Error: " + e.message); }
    setBuscando(false);
  };

  const buscarCedula = async (ced) => {
    const c = String(ced || "").trim();
    if (!c) { setError("Ingresa tu número de cédula."); return; }
    setBuscando(true); setError(""); setDesp(null);
    try {
      const snap = await getDocs(query(
        collection(db, "nomina_desprendibles"),
        where("cedula", "==", c)
      ));
      if (snap.empty) {
        setError("No se encontró comprobante para esta cédula. Consulta con tu empleador para que genere tu desprendible.");
        setBuscando(false); return;
      }
      // Tomar el más reciente (por generadoEn)
      const lista = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const ta = a.generadoEn?.toDate?.()?.getTime?.() || 0;
          const tb = b.generadoEn?.toDate?.()?.getTime?.() || 0;
          return tb - ta;
        });
      setDesp(lista[0]);
      setCedula(c);
    } catch (e) { setError("Error: " + e.message); }
    setBuscando(false);
  };

  const onSubmit = (e) => { e.preventDefault(); buscarCedula(cedula); };

  const volver = () => {
    setDesp(null); setError("");
    router.replace("/mi-pago", undefined, { shallow: true });
  };

  return (
    <>
      <Head>
        <title>Mi Comprobante de Pago — LOGISPORT</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <style jsx global>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, Helvetica, sans-serif; background: #f1f5f9; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        @keyframes spin   { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
        @media print {
          body        { background:#fff !important; }
          .no-print   { display:none !important; }
          .comp-wrap  { box-shadow:none !important; border-radius:0 !important;
                        max-width:100% !important; margin:0 !important;
                        border:1px solid #0369a1 !important; page-break-inside:avoid; }
          @page       { margin:8mm; size:A4 portrait; }
        }
      `}</style>

      {/* ══════════ BARRA SUPERIOR ══════════ */}
      <div className="no-print" style={{
        background: PRIMARY, padding: "0.8rem 1.25rem",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        boxShadow: "0 3px 12px rgba(0,0,0,0.22)", position: "sticky", top: 0, zIndex: 50,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ width:40,height:40,background:"rgba(255,255,255,0.15)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.4rem" }}>🚢</div>
          <div>
            <div style={{ color:"#fff",fontWeight:900,fontSize:"1.05rem",letterSpacing:"0.04em" }}>LOGISPORT</div>
            <div style={{ color:"rgba(255,255,255,0.65)",fontSize:"0.7rem" }}>Comprobante de Pago</div>
          </div>
        </div>
        {desp && (
          <button onClick={() => window.print()} style={{
            background: SUCCESS, border:"none", borderRadius:10, cursor:"pointer",
            padding:"0.55rem 1.35rem", color:"#fff", fontWeight:800, fontSize:"0.9rem",
            display:"flex", alignItems:"center", gap:"0.5rem",
            boxShadow:"0 3px 10px rgba(0,0,0,0.3)",
          }}>
            📥 Descargar PDF
          </button>
        )}
      </div>

      {/* ══════════ ÁREA PRINCIPAL ══════════ */}
      <div style={{ minHeight:"100vh", padding:"1.75rem 1rem 5rem", maxWidth:980, margin:"0 auto" }}>

        {/* ── PANTALLA BÚSQUEDA ── */}
        {!desp && (
          <div style={{
            background:"#fff", borderRadius:20, padding:"3rem 2rem",
            boxShadow:"0 10px 40px rgba(11,61,145,0.14)",
            border:`2px solid ${PRIMARY}18`, animation:"fadeUp 0.4s ease",
          }}>
            <div style={{ textAlign:"center", marginBottom:"2.25rem" }}>
              <div style={{ width:88,height:88,background:`${PRIMARY}10`,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"2.4rem",margin:"0 auto 1.25rem" }}>📄</div>
              <h1 style={{ color:PRIMARY,fontSize:"1.55rem",fontWeight:900,marginBottom:"0.5rem" }}>
                Consulta tu comprobante de pago
              </h1>
              <p style={{ color:GRAY,fontSize:"0.92rem",lineHeight:1.5 }}>
                Ingresa tu número de cédula para ver y descargar tu historial completo de producción
              </p>
            </div>

            {buscando ? (
              <div style={{ textAlign:"center", padding:"2rem 0" }}>
                <div style={{ width:52,height:52,border:`3.5px solid ${PRIMARY}20`,borderTopColor:PRIMARY,borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto 1rem" }}/>
                <div style={{ color:PRIMARY,fontWeight:700,fontSize:"1rem" }}>Buscando tu comprobante...</div>
              </div>
            ) : (
              <>
                <form onSubmit={onSubmit}>
                  <div style={{ display:"flex",gap:"0.75rem",flexWrap:"wrap" }}>
                    <div style={{ flex:1,position:"relative",minWidth:220 }}>
                      <span style={{ position:"absolute",left:"1rem",top:"50%",transform:"translateY(-50%)",fontSize:"1.25rem",pointerEvents:"none" }}>🪪</span>
                      <input
                        type="number" value={cedula}
                        onChange={e=>{ setCedula(e.target.value); setError(""); }}
                        onKeyDown={e=>e.key==="Enter"&&onSubmit(e)}
                        placeholder="Ej: 1059042730" autoFocus inputMode="numeric"
                        style={{
                          width:"100%",padding:"1rem 1rem 1rem 3.2rem",
                          border:`2px solid ${error?DANGER:PRIMARY}35`,
                          borderRadius:13,fontSize:"1.15rem",outline:"none",
                          fontFamily:"monospace",letterSpacing:"0.06em",
                          transition:"border-color 0.2s, box-shadow 0.2s",
                        }}
                        onFocus={e=>{ e.target.style.borderColor=PRIMARY; e.target.style.boxShadow=`0 0 0 3px ${PRIMARY}18`; }}
                        onBlur={e=>{ if(!cedula){ e.target.style.borderColor=`${PRIMARY}35`; e.target.style.boxShadow="none"; } }}
                      />
                    </div>
                    <button type="submit" style={{
                      background:`linear-gradient(135deg,${PRIMARY} 0%,#1a56c4 100%)`,
                      border:"none",borderRadius:13,padding:"1rem 2.25rem",
                      color:"#fff",fontWeight:800,fontSize:"1rem",
                      cursor:"pointer",whiteSpace:"nowrap",
                      boxShadow:`0 5px 16px ${PRIMARY}45`,
                    }}>
                      🔍 Ver mi pago
                    </button>
                  </div>
                </form>

                {error && (
                  <div style={{ marginTop:"1.1rem",background:"#FFF1F2",border:"1.5px solid #FECDD3",borderRadius:11,padding:"0.9rem 1.1rem",color:"#BE123C",fontWeight:600,fontSize:"0.88rem",display:"flex",alignItems:"flex-start",gap:"0.6rem",lineHeight:1.5 }}>
                    <span style={{ fontSize:"1.2rem",flexShrink:0 }}>⚠️</span>
                    {error}
                  </div>
                )}

                <div style={{ marginTop:"1.5rem",background:"#F0F9FF",border:"1px solid #BAE6FD",borderRadius:11,padding:"0.85rem 1.1rem",fontSize:"0.82rem",color:"#0369A1",lineHeight:1.6 }}>
                  💡 Ingresa tu número de cédula <strong>tal como aparece en tu documento</strong> (sin puntos ni espacios).
                  Tu comprobante mostrará <strong>todos tus movimientos y operaciones</strong> registrados.
                </div>
              </>
            )}
          </div>
        )}

        {/* ── COMPROBANTE ── */}
        {desp && (
          <div style={{ animation:"fadeUp 0.32s ease" }}>

            {/* Acciones */}
            <div className="no-print" style={{
              display:"flex", justifyContent:"space-between", alignItems:"center",
              marginBottom:"1rem", flexWrap:"wrap", gap:"0.5rem",
            }}>
              <button onClick={volver} style={{
                background:"#fff",border:"1.5px solid #E2E8F0",borderRadius:9,
                padding:"0.5rem 1.1rem",cursor:"pointer",color:GRAY,fontWeight:700,fontSize:"0.82rem",
                display:"flex",alignItems:"center",gap:"0.4rem",
              }}>
                ← Buscar otra cédula
              </button>
              <button onClick={() => window.print()} style={{
                background:SUCCESS,border:"none",borderRadius:10,
                padding:"0.65rem 1.75rem",color:"#fff",fontWeight:800,fontSize:"0.92rem",
                cursor:"pointer",display:"flex",alignItems:"center",gap:"0.5rem",
                boxShadow:`0 4px 12px ${SUCCESS}50`,
              }}>
                📥 Descargar PDF
              </button>
            </div>

            {/* El desprendible único */}
            <DespPrevProduccion d={desp} />

            <div className="no-print" style={{
              marginTop:"1rem",background:"#EFF6FF",border:"1.5px solid #BFDBFE",
              borderRadius:11,padding:"0.9rem 1.1rem",fontSize:"0.82rem",color:"#1E40AF",lineHeight:1.6,
            }}>
              💡 <strong>¿Cómo guardar como PDF?</strong> Toca <strong>"Descargar PDF"</strong> →
              en tu celular selecciona <em>"Guardar como PDF"</em>.
              En computador se abre el diálogo de impresión → elige <em>"Guardar como PDF"</em>.
            </div>
          </div>
        )}
      </div>
    </>
  );
}
