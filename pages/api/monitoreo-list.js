// pages/api/monitoreo-list.js — LOGISPORT
import { getFirestore } from "../../lib/admin";

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  try {
    const DEFAULT_CLIENT_ID = process.env.DEFAULT_CLIENT_ID || "LOGISPORT";
    const clientId = String(req.query.clientId || DEFAULT_CLIENT_ID);

    const db = getFirestore();

    // Intentar cargar con el clientId pedido
    const ref = db.collection("monitoreo").doc(clientId).collection("equipos");
    const snap = await ref.orderBy("updatedAt", "desc").limit(1000).get();

    // Si no hay equipos, buscar en todos los documentos de monitoreo
    if (snap.empty) {
      const monitoreoSnap = await db.collection("monitoreo").get();
      const allItems = [];
      
      for (const clientDoc of monitoreoSnap.docs) {
        const equiposSnap = await clientDoc.ref.collection("equipos")
          .orderBy("updatedAt", "desc").limit(1000).get();
        equiposSnap.forEach(doc => {
          const d = doc.data() || {};
          allItems.push({
            id: doc.id,
            clientId: clientDoc.id,
            updatedAt: d.updatedAt || null,
            hasAlerts: !!d.hasAlerts,
            ultimo: d.ultimo || {},
          });
        });
      }

      return res.status(200).json({ ok: true, items: allItems, clientIdUsado: "todos", clientIdsSinDatos: [clientId] });
    }

    const items = [];
    snap.forEach(doc => {
      const d = doc.data() || {};
      items.push({ id: doc.id, updatedAt: d.updatedAt || null, hasAlerts: !!d.hasAlerts, ultimo: d.ultimo || {} });
    });

    return res.status(200).json({ ok: true, items, clientIdUsado: clientId });
  } catch (e) {
    console.error("monitoreo-list error", e);
    return res.status(200).json({ ok: false, error: e?.message || "server_error" });
  }
}
