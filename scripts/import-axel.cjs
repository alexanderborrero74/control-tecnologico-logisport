/**
 * scripts/import-axel.js
 * 
 * Uso:
 *  1) npm i firebase-admin xlsx
 *  2) Define GOOGLE_APPLICATION_CREDENTIALS apuntando a tu service account (JSON)
 *     o edita la ruta en esta línea: admin.credential.cert(require("./serviceAccount.json"))
 *  3) node scripts/import-axel.js "/ruta/al/registro basc logisport  actualizado.xlsx"
 * 
 * Qué hace:
 *  - Lee el Excel de Axel
 *  - Normaliza columnas
 *  - Inserta/actualiza datos en Firestore en las colecciones que ya usan tus páginas:
 *      • licencias
 *      • hojaVidaEquipos
 *      • serviciosTecnicos  (si hay hoja "Implementacion detallada")
 *  - No sube contraseñas/llaves (pestañas de nube/accesos se ignoran o se guardan sin secretos)
 */

const path = require("path");
const fs = require("fs");
const admin = require("firebase-admin");
const XLSX = require("xlsx");

// ---------- FIREBASE ADMIN SETUP ----------
try {
  if (!admin.apps.length) {
    // Opción A: por variable de entorno GOOGLE_APPLICATION_CREDENTIALS
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  }
} catch (e) {
  // Opción B: archivo local serviceAccount.json
  const svcPath = path.resolve(process.cwd(), "serviceAccount.json");
  if (!fs.existsSync(svcPath)) {
    console.error("No se pudo inicializar Firebase Admin. Define GOOGLE_APPLICATION_CREDENTIALS o crea serviceAccount.json");
    process.exit(1);
  }
  admin.initializeApp({ credential: admin.credential.cert(require(svcPath)) });
}

const db = admin.firestore();

// ---------- HELPERS ----------
const norm = (v) => (v == null ? "" : String(v).trim());
const toDate = (v) => {
  if (!v) return null;
  if (v instanceof Date) return v;
  // Excel puede venir como número (serial) o string
  if (!isNaN(v) && Number(v) > 25569) {
    const date = new Date(Math.round((Number(v) - 25569) * 86400 * 1000));
    return date;
  }
  const d = new Date(v);
  return isNaN(d) ? null : d;
};
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const cleanObj = (o) => Object.fromEntries(Object.entries(o).filter(([,v]) => v !== undefined && v !== null && v !== ""));

// Detección por nombre de pestaña
const isLicenciasSheet = (name) => /licencia|kaspersky|office|windows|drive|usuario.*aplicaci/i.test(name);
const isEquiposSheet   = (name) => /activo|activos|criticidad|hoja.*vida|equip/i.test(name);
const isServiciosSheet = (name) => /implementacion.*detallada|servicio|ticket|soporte/i.test(name);
const isSecretSheet    = (name) => /nube.*acceso|accesos|claves|password|secreto/i.test(name);

// Mapear columnas comunes a claves del proyecto
const mapKeys = (row) => {
  const r = {};
  for (const [k, v] of Object.entries(row)) {
    const key = norm(k).toLowerCase();
    const val = v;
    // LICENCIAS
    if (/proveedor|vendor|fabricante/.test(key)) r.proveedor = norm(val);
    else if (/tipo|product|aplicaci|software/.test(key)) r.tipo = norm(val);
    else if (/estado|status/.test(key)) r.estado = norm(val);
    else if (/vence|vencimiento|expiry|expir/i.test(key)) r.vence = toDate(val);
    else if (/usuario|user|correo|email/.test(key)) r.usuario = norm(val);
    else if (/serial|licen(c|s)ia.*(code|key)?|clave|key/.test(key)) r.licencia = norm(val); // se guardará enmascarada

    // EQUIPOS
    else if (/equipo|nombre.*equipo|hostname|device/.test(key)) r.nombreEquipo = norm(val);
    else if (/tipo.*equipo|clase|categoria/.test(key)) r.tipoEquipo = norm(val);
    else if (/estado/.test(key)) r.estado = norm(val).toLowerCase();
    else if (/sede|ubicaci|location/.test(key)) r.sede = norm(val);
    else if (/marca/.test(key)) r.marca = norm(val);
    else if (/modelo/.test(key)) r.modelo = norm(val);
    else if (/serial|serie/.test(key)) r.serial = norm(val);
    else if (/responsable|propietario|owner|asignado/.test(key)) r.responsable = norm(val);
    else if (/criticidad|critico|critical/.test(key)) r.nivelCriticidad = norm(val);

    // SERVICIOS
    else if (/fecha/.test(key)) r.fecha = toDate(val);
    else if (/tecnico|técnico|atendi/.test(key)) r.tecnico = norm(val);
    else if (/cliente|area|depart|solicitante/.test(key)) r.cliente = norm(val);
    else if (/tipo.*serv|actividad|tarea/.test(key)) r.tipoServicio = norm(val);
    else if (/observa|detalle|nota|coment/.test(key)) r.detalle = norm(val);
  }
  return r;
};

const mask = (s) => (s ? s.replace(/.(?=.{4})/g, "•") : s);

async function importLicencias(name, rows) {
  console.log(`→ Licencias desde: ${name}`);
  const col = db.collection("licencias");
  const batch = db.batch();
  let count = 0;

  for (const row of rows) {
    const m = mapKeys(row);
    if (!m.proveedor && !m.tipo && !m.usuario && !m.vence) continue; // fila vacía

    const data = cleanObj({
      proveedor: m.proveedor,
      tipo: m.tipo,
      usuario: m.usuario,
      vence: m.vence ? ymd(m.vence) : undefined,
      estado: m.vence ? (new Date(ymd(m.vence)) >= new Date(ymd(new Date())) ? "Vigente" : "Vencida") : (m.estado || ""),
      // Nunca guardamos la clave tal cual
      licenciaMask: m.licencia ? mask(m.licencia) : undefined,
      origen: name,
      importadoEl: admin.firestore.FieldValue.serverTimestamp(),
    });

    const docId = `${(m.usuario||"unknown").toLowerCase().replace(/[^a-z0-9]+/g,"-")}-${(m.tipo||"varios").toLowerCase().replace(/[^a-z0-9]+/g,"-")}-${count}`.slice(0, 200);
    const ref = col.doc(docId);
    batch.set(ref, data, { merge: true });
    count++;
  }

  if (count) await batch.commit();
  console.log(`   Guardadas ${count} licencias.`);
}

async function importEquipos(name, rows) {
  console.log(`→ Equipos/Hoja de Vida desde: ${name}`);
  const col = db.collection("hojaVidaEquipos");
  const batch = db.batch();
  let count = 0;

  for (const row of rows) {
    const m = mapKeys(row);
    if (!m.nombreEquipo && !m.tipoEquipo && !m.serial && !m.responsable) continue;

    const data = cleanObj({
      nombreEquipo: m.nombreEquipo,
      tipoEquipo: m.tipoEquipo,
      estado: m.estado || "activo",
      sede: m.sede,
      marca: m.marca,
      modelo: m.modelo,
      serial: m.serial,
      responsable: m.responsable,
      nivelCriticidad: m.nivelCriticidad,
      origen: name,
      importadoEl: admin.firestore.FieldValue.serverTimestamp(),
    });

    const docId = `${(m.serial||m.nombreEquipo||"eq").toLowerCase().replace(/[^a-z0-9]+/g,"-")}`.slice(0, 200);
    const ref = col.doc(docId || undefined);
    batch.set(ref, data, { merge: true });
    count++;
  }

  if (count) await batch.commit();
  console.log(`   Guardados ${count} equipos.`);
}

async function importServicios(name, rows) {
  console.log(`→ Servicios Técnicos desde: ${name}`);
  const col = db.collection("serviciosTecnicos");
  const batch = db.batch();
  let count = 0;

  for (const row of rows) {
    const m = mapKeys(row);
    if (!m.tipoServicio && !m.tecnico && !m.cliente && !m.fecha) continue;

    const data = cleanObj({
      tipoServicio: m.tipoServicio,
      tecnico: m.tecnico,
      cliente: m.cliente,
      fecha: m.fecha ? ymd(m.fecha) : undefined,
      detalle: m.detalle,
      origen: name,
      importadoEl: admin.firestore.FieldValue.serverTimestamp(),
    });

    const docRef = col.doc();
    batch.set(docRef, data, { merge: true });
    count++;
  }

  if (count) await batch.commit();
  console.log(`   Guardados ${count} servicios.`);
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Uso: node scripts/import-axel.js /ruta/al/archivo.xlsx");
    process.exit(1);
  }
  const abs = path.resolve(process.cwd(), file);
  if (!fs.existsSync(abs)) {
    console.error("No existe el archivo:", abs);
    process.exit(1);
  }

  const wb = XLSX.readFile(abs, { cellDates: true });
  const names = wb.SheetNames;
  console.log("Hojas encontradas:", names);

  for (const name of names) {
    const ws = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

    if (!rows.length) continue;

    if (isSecretSheet(name)) {
      console.log(`(omitir secretos) ${name} — se ignoran claves/contraseñas`);
      continue; // por seguridad
    }

    if (isLicenciasSheet(name)) {
      await importLicencias(name, rows);
      continue;
    }
    if (isEquiposSheet(name)) {
      await importEquipos(name, rows);
      continue;
    }
    if (isServiciosSheet(name)) {
      await importServicios(name, rows);
      continue;
    }

    // Si no matchea, intentamos clasificar por columnas
    const sample = mapKeys(rows[0] || {});
    if (sample.vence || sample.tipo) {
      await importLicencias(name, rows);
    } else if (sample.tipoEquipo || sample.serial || sample.nombreEquipo) {
      await importEquipos(name, rows);
    } else if (sample.tipoServicio || sample.tecnico || sample.cliente) {
      await importServicios(name, rows);
    } else {
      console.log(`(sin clasificar) ${name} — no se importó`);
    }
  }

  console.log("✔ Importación finalizada.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
