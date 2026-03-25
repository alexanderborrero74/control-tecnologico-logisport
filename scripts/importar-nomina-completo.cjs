/**
 * scripts/importar-nomina-completo.cjs
 * Script de importación COMPLETA del módulo NÓMINA
 * Datos extraídos del Excel: 03_NOMINA_01_AL_15_DE_FEBRERO_SPIA_2026.xlsx
 *
 * Importa:
 *   - 88 servicios y tarifas → nomina_servicios
 *   - 307 trabajadores únicos → nomina_trabajadores
 *   - 3,577 operaciones históricas → nomina_operaciones (quincena 2026-02-Q1)
 *
 * Uso:
 *   node scripts/importar-nomina-completo.cjs             (todo)
 *   node scripts/importar-nomina-completo.cjs --solo-servicios
 *   node scripts/importar-nomina-completo.cjs --solo-trabajadores
 *   node scripts/importar-nomina-completo.cjs --solo-operaciones
 *
 * Requiere: serviceAccountKey.json en la raíz del proyecto
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Leer credencial desde .env.local (FIREBASE_SERVICE_ACCOUNT_BASE64)
function initFirebase() {
  // Opción 1: serviceAccountKey.json en la raíz
  const saPath = path.join(__dirname, '..', 'serviceAccountKey.json');
  if (fs.existsSync(saPath)) {
    admin.initializeApp({ credential: admin.credential.cert(require(saPath)) });
    console.log('🔑 Autenticado con serviceAccountKey.json');
    return;
  }

  // Opción 2: FIREBASE_SERVICE_ACCOUNT_BASE64 desde .env.local
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const match = envContent.match(/FIREBASE_SERVICE_ACCOUNT_BASE64=(.+)/);
    if (match && match[1]) {
      const base64 = match[1].trim();
      // Igual que lib/admin.js: Buffer.from es permisivo con base64
      const json = Buffer.from(base64, 'base64').toString('utf-8');
      const serviceAccount = JSON.parse(json);
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      console.log('🔑 Autenticado con FIREBASE_SERVICE_ACCOUNT_BASE64 del .env.local');
      return;
    }
  }

  // Opción 3: Variable de entorno GOOGLE_APPLICATION_CREDENTIALS
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
    console.log('🔑 Autenticado con GOOGLE_APPLICATION_CREDENTIALS');
    return;
  }

  console.error('❌ No se encontró ninguna credencial de Firebase.');
  console.error('   Opciones:');
  console.error('   1. Crea serviceAccountKey.json en la raíz del proyecto');
  console.error('   2. Asegúrate de que .env.local tenga FIREBASE_SERVICE_ACCOUNT_BASE64');
  process.exit(1);
}

try { initFirebase(); } catch (e) {
  console.error('❌ Error inicializando Firebase:', e.message);
  process.exit(1);
}

const db = admin.firestore();

// ─── SERVICIOS ────────────────────────────────────────────────────────
const SERVICIOS = [
  { nombre: 'ANTINARCOTICO GRANELES (X20)', valor: 79860 },
  { nombre: 'ANTINARCOTICO GRANELES (X40)', valor: 90750 },
  { nombre: 'APERTURA DE CONTENEDOR', valor: 8228 },
  { nombre: 'ASISTENTE DE OPERACIONES', valor: 988500 },
  { nombre: 'ASISTENTE OPERACIONES EX FES DIU', valor: 18422.05 },
  { nombre: 'ASISTENTE OPERACIONES EX FES NOC', valor: 22915.23 },
  { nombre: 'ASISTENTE OPERACIONES EXTRAS DIU', valor: 11232.95 },
  { nombre: 'ASISTENTE OPERACIONES EXTRAS NOC', valor: 15726.14 },
  { nombre: 'ASISTENTE OPERACIONES FES DIU', valor: 16175.45 },
  { nombre: 'ASISTENTE OPERACIONES FES NOC', valor: 18871.36 },
  { nombre: 'ASISTENTE OPERACIONES INCAPACIDAD DIA', valor: 65900 },
  { nombre: 'ASISTENTE OPERACIONES R FES DIU', valor: 7638.41 },
  { nombre: 'ASISTENTE OPERACIONES R. NOCTURNO', valor: 3145.23 },
  { nombre: 'ASISTENTE OPERACIONES RECARGO FES NOC', valor: 10334.32 },
  { nombre: 'ASISTENTE OPERACIONES VALOR DIA', valor: 65900 },
  { nombre: 'AUXILIAR ADMINISTRATIVO', valor: 965000 },
  { nombre: 'AUXILIAR DE OPE Y SISO EX FES DIU', valor: 16655.36 },
  { nombre: 'AUXILIAR DE OPE Y SISO EX FES NOC', valor: 20717.65 },
  { nombre: 'AUXILIAR DE OPE Y SISO EXTRAS DIU', valor: 10155.71 },
  { nombre: 'AUXILIAR DE OPE Y SISO EXTRAS NOC', valor: 14217.99 },
  { nombre: 'AUXILIAR DE OPE Y SISO FES DIU', valor: 14624.22 },
  { nombre: 'AUXILIAR DE OPE Y SISO FES NOC', valor: 17061.59 },
  { nombre: 'AUXILIAR DE OPE Y SISO INCAPACIDAD DIA', valor: 59580.17 },
  { nombre: 'AUXILIAR DE OPE Y SISO R FES DIU', valor: 6905.88 },
  { nombre: 'AUXILIAR DE OPE Y SISO R. NOCTURNO', valor: 2843.6 },
  { nombre: 'AUXILIAR DE OPE Y SISO RECARGO FES NOC', valor: 9343.25 },
  { nombre: 'AUXILIAR DE OPE Y SISO VALOR DIA', valor: 59580.17 },
  { nombre: 'AUXILIAR DE OPERACIONES', valor: 893702.5 },
  { nombre: 'AUXILIAR SISO', valor: 893702.5 },
  { nombre: 'CROSDOKING REFER', valor: 90750 },
  { nombre: 'DIAN 20 (ORDINARIO)', valor: 79860 },
  { nombre: 'DIAN 40 (ORDINARIO)', valor: 90750 },
  { nombre: 'DIAN 40 REFRIGERADO (ORDINARIO)', valor: 90750 },
  { nombre: 'DIAN CLASIFICACION X40', valor: 145852 },
  { nombre: 'DIAN CONTROL POSTERIOR (20)', valor: 108900 },
  { nombre: 'DIAN CONTROL POSTERIOR (40)', valor: 130680 },
  { nombre: 'DIAN DUTA (X40)', valor: 90750 },
  { nombre: 'DIAN LUGAR DE ARRIBO (X20)', valor: 95590 },
  { nombre: 'DIAN LUGAR DE ARRIBO (X40)', valor: 145852 },
  { nombre: 'ESTIBADOR EX FES DIU', valor: 15836.36 },
  { nombre: 'ESTIBADOR EX FES NOC', valor: 19702.27 },
  { nombre: 'ESTIBADOR EXTRAS DIU', valor: 9657.95 },
  { nombre: 'ESTIBADOR EXTRAS NOC', valor: 13523.86 },
  { nombre: 'ESTIBADOR FES DIU', valor: 13906.25 },
  { nombre: 'ESTIBADOR FES NOC', valor: 16223.86 },
  { nombre: 'ESTIBADOR INCAPACIDAD DIA', valor: 58363.5 },
  { nombre: 'ESTIBADOR R FES DIU', valor: 6570.74 },
  { nombre: 'ESTIBADOR R. NOCTURNO', valor: 2705.68 },
  { nombre: 'ESTIBADOR RECARGO FES NOC', valor: 8890.34 },
  { nombre: 'ESTIBADOR VALOR DIA', valor: 58363.5 },
  { nombre: 'ICA E IMVIMA (ORDINARIO)', valor: 43197 },
  { nombre: 'ICA E INVIMA TUNEL FRIO (ORDINARIO)', valor: 52030 },
  { nombre: 'ITR', valor: 21780 },
  { nombre: 'NARCOTICO 20 (ORDINARIO)', valor: 79860 },
  { nombre: 'NARCOTICO 40 (ORDINARIO)', valor: 90750 },
  { nombre: 'O. MONTACARGAS EX FES DIU', valor: 17420.45 },
  { nombre: 'O. MONTACARGAS EX FES NOC', valor: 21664.77 },
  { nombre: 'O. MONTACARGAS EXTRAS DIU', valor: 10625 },
  { nombre: 'O. MONTACARGAS EXTRAS NOC', valor: 14869.32 },
  { nombre: 'O. MONTACARGAS FES DIU', valor: 15284.09 },
  { nombre: 'O. MONTACARGAS FES NOC', valor: 17830.68 },
  { nombre: 'O. MONTACARGAS INCAPACIDAD DIA', valor: 68333.33 },
  { nombre: 'O. MONTACARGAS R FES DIU', valor: 7215.91 },
  { nombre: 'O. MONTACARGAS R. NOCTURNO', valor: 3261.36 },
  { nombre: 'O. MONTACARGAS RECARGO FES NOC', valor: 10715.91 },
  { nombre: 'O. MONTACARGAS VALOR DIA', valor: 68333.33 },
  { nombre: 'PREINSPECCION (20)', valor: 79860 },
  { nombre: 'PREINSPECCION (40)', valor: 90750 },
  { nombre: 'SUPERVISOR EX FES DIU', valor: 17420.45 },
  { nombre: 'SUPERVISOR EX FES NOC', valor: 21664.77 },
  { nombre: 'SUPERVISOR EXTRAS DIU', valor: 10625 },
  { nombre: 'SUPERVISOR EXTRAS NOC', valor: 14869.32 },
  { nombre: 'SUPERVISOR FES DIU', valor: 15284.09 },
  { nombre: 'SUPERVISOR FES NOC', valor: 17830.68 },
  { nombre: 'SUPERVISOR INCAPACIDAD DIA', valor: 68333.33 },
  { nombre: 'SUPERVISOR R FES DIU', valor: 7215.91 },
  { nombre: 'SUPERVISOR R. NOCTURNO', valor: 3261.36 },
  { nombre: 'SUPERVISOR RECARGO FES NOC', valor: 10715.91 },
  { nombre: 'SUPERVISOR VALOR DIA', valor: 68333.33 },
  { nombre: 'LIDER SOCIAL EX FES DIU', valor: 17083.33 },
  { nombre: 'LIDER SOCIAL EX FES NOC', valor: 21250 },
  { nombre: 'LIDER SOCIAL EXTRAS DIU', valor: 10416.67 },
  { nombre: 'LIDER SOCIAL EXTRAS NOC', valor: 14583.33 },
  { nombre: 'LIDER SOCIAL FES DIU', valor: 15000 },
  { nombre: 'LIDER SOCIAL FES NOC', valor: 17500 },
  { nombre: 'LIDER SOCIAL INCAPACIDAD DIA', valor: 62500 },
  { nombre: 'LIDER SOCIAL R FES DIU', valor: 7083.33 },
  { nombre: 'LIDER SOCIAL R. NOCTURNO', valor: 3333.33 },
  { nombre: 'LIDER SOCIAL RECARGO FES NOC', valor: 10416.67 },
  { nombre: 'LIDER SOCIAL VALOR DIA', valor: 62500 },
];

// ─── TRABAJADORES (307 únicos del Excel) ─────────────────────────────
// Cargados dinámicamente desde el archivo JSON generado por el script Python
// Para regenerar: python3 scripts/extraer-trabajadores.py
function cargarTrabajadores() {
  const jsonPath = path.join(__dirname, 'nomina_data.json');
  if (!fs.existsSync(jsonPath)) {
    console.error('❌ No encontré scripts/nomina_data.json');
    console.error('   Por favor copia el archivo nomina_data.json (generado por el script Python) aquí.');
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  return data;
}

// ─── FUNCIONES ────────────────────────────────────────────────────────

async function importarServicios() {
  console.log('\n📦 Importando servicios y tarifas...');
  const batch = db.batch();
  let count = 0;
  for (const svc of SERVICIOS) {
    const id = svc.nombre.toUpperCase().replace(/[^A-Z0-9]/g, '_').substring(0, 80);
    const ref = db.collection('nomina_servicios').doc(id);
    batch.set(ref, {
      nombre: svc.nombre.trim(),
      valor: svc.valor,
      activo: true,
      creadoEn: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    count++;
  }
  await batch.commit();
  console.log(`✅ ${count} servicios importados`);
}

async function importarTrabajadores(trabajadores) {
  console.log(`\n👷 Importando ${trabajadores.length} trabajadores...`);
  const BATCH_SIZE = 400;
  let total = 0;
  for (let i = 0; i < trabajadores.length; i += BATCH_SIZE) {
    const chunk = trabajadores.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const t of chunk) {
      const ref = db.collection('nomina_trabajadores').doc(t.cedula);
      batch.set(ref, {
        nombre: t.nombre,
        cedula: t.cedula,
        cargo: t.cargo || 'ESTIBADOR',
        cuadrilla: t.cuadrilla || '',
        basicoMensual: t.basicoMensual || 1750905,
        activo: true,
        creadoEn: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      total++;
    }
    await batch.commit();
    console.log(`  Lote ${Math.floor(i / BATCH_SIZE) + 1}: ${chunk.length} trabajadores`);
  }
  console.log(`✅ ${total} trabajadores importados`);
}

async function importarOperaciones(operaciones) {
  console.log(`\n📋 Importando ${operaciones.length} operaciones de la MATRIZ...`);
  console.log('   Quincena: 1-15 Febrero 2026');
  const BATCH_SIZE = 400;
  let total = 0;
  for (let i = 0; i < operaciones.length; i += BATCH_SIZE) {
    const chunk = operaciones.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const op of chunk) {
      const ref = db.collection('nomina_operaciones').doc();
      let fechaTS = null;
      if (op.fechaStr && /^\d{4}-\d{2}-\d{2}$/.test(op.fechaStr)) {
        fechaTS = admin.firestore.Timestamp.fromDate(new Date(op.fechaStr + 'T12:00:00'));
      }
      batch.set(ref, {
        ...op,
        fecha: fechaTS,
        creadoEn: admin.firestore.FieldValue.serverTimestamp(),
      });
      total++;
    }
    await batch.commit();
    process.stdout.write(`\r  Importadas: ${total} / ${operaciones.length}`);
  }
  console.log(`\n✅ ${total} operaciones importadas`);
}

async function main() {
  console.log('🚀 Importación completa del módulo NÓMINA — LOGISPORT');
  console.log('=======================================================\n');

  const { trabajadores, operaciones } = cargarTrabajadores();
  const args = process.argv.slice(2);
  const soloServ = args.includes('--solo-servicios');
  const soloTrab = args.includes('--solo-trabajadores');
  const soloOps  = args.includes('--solo-operaciones');
  const todo = !soloServ && !soloTrab && !soloOps;

  try {
    if (todo || soloServ) await importarServicios();
    if (todo || soloTrab) await importarTrabajadores(trabajadores);
    if (todo || soloOps)  await importarOperaciones(operaciones);

    console.log('\n✅ Importación completada!');
    console.log('\nPróximos pasos:');
    console.log('1. firebase deploy --only firestore:rules');
    console.log('2. npm run build && vercel --prod');
    console.log('3. Asignar rol admin_nomina al usuario de RRHH');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
  process.exit(0);
}

main();
