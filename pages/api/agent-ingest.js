// pages/api/agent-ingest.js — LOGISPORT (robusto)
"use strict";

export const config = {
  api: { bodyParser: { sizeLimit: "2mb" } },
};

import { getFirestore } from "../../lib/admin";

const DEFAULT_CLIENT_ID = process.env.DEFAULT_CLIENT_ID || "LOGISPORT";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://logisport.vercel.app";
const CPU_TEMP_HIGH_C = Number(process.env.CPU_TEMP_HIGH_C ?? 90);

// ── Helpers ──────────────────────────────────────────────────────────────────
function isNonEmpty(v) { return v !== undefined && v !== null && v !== ""; }

function clean(obj = {}) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null)
  );
}

function parseMB(val) {
  if (typeof val === "number" && !Number.isNaN(val)) return val;
  const n = parseFloat(String(val ?? "").replace(/[^\d.]/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

function toBogotaLocal(iso) {
  try { return new Date(iso).toLocaleString("es-CO", { timeZone: "America/Bogota" }); }
  catch { return iso; }
}

function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

function nowISOSafe() {
  try { return new Date().toISOString(); }
  catch { return String(Date.now()); }
}

// ── Notificación de correo (no bloquea) ──────────────────────────────────────
function notificarApagadoInesperado({ hostname, username, datetime }) {
  try {
    fetch(`${SITE_URL}/api/enviarCorreoElectronico`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.PRIVATE_API_KEY || "" },
      body: JSON.stringify({
        to: "soportesistemas@soporteia.net",
        subject: `⚠️ Alerta LOGISPORT: Apagado Inesperado — ${hostname || "PC desconocido"}`,
        html: `<div style="font-family:Arial,sans-serif;font-size:14px">
          <h2>⚠️ Apagado Inesperado Detectado — LOGISPORT</h2>
          <p><strong>Equipo:</strong> ${hostname || "(sin nombre)"}</p>
          <p><strong>Usuario:</strong> ${username || "(desconocido)"}</p>
          <p><strong>Fecha/Hora:</strong> ${datetime}</p>
          <hr/><p style="color:#666">NexoTI · SoporteIA.net</p></div>`,
      }),
    }).catch(e => console.error("notificar fetch error:", e));
  } catch (e) {
    console.error("notificar error:", e);
  }
}

// ── Handler principal ─────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  // Validación del token
  const token = req.headers["x-agent-token"];
  if (!token || token !== process.env.AGENT_INGEST_TOKEN) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const now = nowISOSafe();
  const warnings = []; // acumula errores no fatales

  try {
    // Parseo seguro del body
    let body = {};
    try {
      body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    } catch (e) {
      return res.status(400).json({ error: "invalid_json" });
    }

    const {
      clientId      = DEFAULT_CLIENT_ID,
      deviceId,
      hostname,
      username,
      os,
      brand,
      model,
      serial,
      cpuLoadPct,
      cpuVendor,
      cpuName,
      cpu,
      cpuTempC,
      memory        = {},
      storage       = { disks: [] },
      battery       = {},
      temp          = {},
      desktop       = {},
      office        = {},
      unexpectedShutdown,
      agentVersion,
      timestampUtc,
    } = body;

    if (!isNonEmpty(deviceId)) {
      return res.status(400).json({ error: "deviceId_requerido" });
    }

    // Firestore
    let db;
    try { db = getFirestore(); }
    catch (e) { return res.status(500).json({ error: "firestore_init", detail: String(e?.message) }); }

    const clientIdStr = String(clientId || DEFAULT_CLIENT_ID);
    const deviceIdStr = String(deviceId);

    const equipoRef = db.collection("monitoreo").doc(clientIdStr).collection("equipos").doc(deviceIdStr);

    // Leer estado anterior (para dedupe de apagados)
    let equipoData = {};
    try { const snap = await equipoRef.get(); if (snap.exists) equipoData = snap.data() || {}; }
    catch (e) { warnings.push("leer_equipo: " + String(e?.message)); }

    // Tamaños
    const tempSizeMB    = parseMB(temp?.sizeMB);
    const desktopSizeMB = parseMB(desktop?.sizeMB);

    // Alertas
    const alerts = [];
    try {
      if (typeof memory?.usedPct === "number" && memory.usedPct >= 90)
        alerts.push({ type: "high_memory", msg: `Memoria alta (${clamp(memory.usedPct, 0, 100)}%)` });
      if (typeof cpuLoadPct === "number" && cpuLoadPct >= 90)
        alerts.push({ type: "high_cpu", msg: `CPU alta (${clamp(cpuLoadPct, 0, 100)}%)` });
      (storage?.disks || []).forEach(d => {
        if (typeof d?.freePct === "number" && d.freePct < 10)
          alerts.push({ type: "low_disk", msg: `Espacio bajo en ${d.name || d.letter || "disco"}: ${d.freePct}%` });
      });
      if (typeof battery?.percent === "number" && battery.percent < 20)
        alerts.push({ type: "battery_low", msg: `Batería baja (${battery.percent}%)` });
      if (tempSizeMB >= 2048)
        alerts.push({ type: "temp_large", msg: `TEMP con ${(tempSizeMB / 1024).toFixed(1)} GB` });
      if (desktopSizeMB >= 5120)
        alerts.push({ type: "desktop_large", msg: `Escritorio con ${(desktopSizeMB / 1024).toFixed(1)} GB` });
      if (unexpectedShutdown)
        alerts.push({ type: "unexpected_shutdown", msg: "Apagado inesperado detectado" });
      const tempC = typeof cpuTempC === "number" ? cpuTempC : (typeof cpu?.tempC === "number" ? cpu.tempC : null);
      if (tempC !== null && !Number.isNaN(tempC) && tempC >= CPU_TEMP_HIGH_C)
        alerts.push({ type: "cpu_temp_high", msg: `CPU caliente (${tempC}°C)` });
    } catch (e) { warnings.push("alertas: " + String(e?.message)); }

    // Dedupe y validación de apagado inesperado
    let nuevoRegistroApagado = null;
    if (unexpectedShutdown) {
      try {
        const shutdownAtIso = body.unexpectedShutdownAt || body.unexpectedShutdownTime || body.shutdownEventAt || timestampUtc || now;
        const shutdownAt = new Date(shutdownAtIso);
        const receivedAt = new Date(now);

        // Validar que el apagado sea real:
        // 1. La fecha del evento debe ser válida
        // 2. El evento NO puede ser más antiguo que 48 horas desde que se recibió
        // 3. El evento NO puede ser en el futuro
        const horasDesdeEvento = (receivedAt - shutdownAt) / (1000 * 60 * 60);
        const esEventoValido = !Number.isNaN(shutdownAt.getTime())
          && horasDesdeEvento >= 0        // no en el futuro
          && horasDesdeEvento <= 48;      // no más viejo de 48h

        if (!esEventoValido) {
          warnings.push(`apagado_ignorado: evento fuera de rango (${horasDesdeEvento.toFixed(1)}h antes del reporte)`);
        } else {
          // Dedupe: comparar con el último evento registrado
          const lastIso = equipoData?.ultimoApagadoInesperadoIso || equipoData?.ultimoApagadoInesperado || null;
          const lastDate = lastIso ? new Date(lastIso) : null;
          const isSame = !!(lastDate && !Number.isNaN(lastDate.getTime()) && !Number.isNaN(shutdownAt.getTime()) && lastDate.getTime() === shutdownAt.getTime());

          if (!isSame) {
            nuevoRegistroApagado = shutdownAtIso;
            const local = toBogotaLocal(shutdownAtIso);

            // Correo en background
            notificarApagadoInesperado({ hostname, username, datetime: local });

            // Guardar en historial
            try {
              await db.collection("apagadosHistoricos").add({
                clientId:         clientIdStr,
                deviceId:         deviceIdStr,
                hostname:         hostname     || null,
                username:         username     || null,
                agentVersion:     agentVersion || null,
                fechaEventoIso:   shutdownAtIso,
                fechaEventoLocal: local,
                registradoEn:     now,
              });
            } catch (e) { warnings.push("historial_apagado: " + String(e?.message)); }
          }
        }
      } catch (e) { warnings.push("dedupe_apagado: " + String(e?.message)); }
    }

    // Construir objeto "ultimo"
    const cpuTempFinal = typeof cpuTempC === "number" ? cpuTempC
      : (typeof cpu?.tempC === "number" ? cpu.tempC : undefined);

    const ultimo = clean({
      hostname, username, os, brand, model, serial,
      cpuLoadPct, cpuVendor, cpuName,
      cpu: clean({ ...(cpu || {}), tempC: cpuTempFinal }),
      cpuTempC: cpuTempFinal,
      memory, storage, battery,
      temp:    { sizeMB: tempSizeMB },
      desktop: { sizeMB: desktopSizeMB },
      office, unexpectedShutdown, agentVersion,
      ts: timestampUtc || now,
    });

    // Guardar equipo principal
    try {
      const updateData = {
        updatedAt: now,
        hasAlerts: alerts.length > 0,
        alerts,
        ultimo,
      };
      if (nuevoRegistroApagado) {
        updateData.ultimoApagadoInesperadoIso = nuevoRegistroApagado;
        updateData.ultimoApagadoInesperado    = toBogotaLocal(nuevoRegistroApagado);
      }
      await equipoRef.set(updateData, { merge: true });
    } catch (e) {
      // Si falla guardar el equipo, sí es error fatal
      console.error("equipoRef.set error:", e);
      return res.status(500).json({ error: "firestore_write", detail: String(e?.message), warnings });
    }

    // Guardar reporte (best effort — no falla si esto falla)
    try {
      await equipoRef.collection("reports").doc().set(
        clean({ createdAt: now, ...ultimo, alerts })
      );
    } catch (e) { warnings.push("report: " + String(e?.message)); }

    return res.status(200).json({ ok: true, alerts, interval: 15, ...(warnings.length ? { warnings } : {}) });

  } catch (err) {
    console.error("agent-ingest error inesperado:", err);
    return res.status(500).json({ error: "server_error", detail: String(err?.message || err) });
  }
}
