/**
 * scripts/importar-cargos.js
 * Importa los cargos del Excel de nómina directamente a Firestore
 * 
 * Uso: node scripts/importar-cargos.js
 */

const admin = require("firebase-admin");
require("dotenv").config({ path: ".env.local" });

// Decodificar service account desde la variable de entorno
const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
if (!serviceAccountBase64) {
  console.error("❌ No se encontró FIREBASE_SERVICE_ACCOUNT_BASE64 en .env.local");
  process.exit(1);
}

const serviceAccount = JSON.parse(
  Buffer.from(serviceAccountBase64, "base64").toString("utf8")
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// ── Cargos extraídos del Excel NOMINA PRUEBA + hoja TRABAJADORES ──────────
// Solo cargos válidos (filtrados — sin nombres de personas ni ruido)
const CARGOS_EXCEL = [
  { nombre: "ASISTENTE DE OPERACIONES",                    basicoMensual: 1977000 },
  { nombre: "AUXILIAR ADMINISTRATIVA",                     basicoMensual: 1930000 },
  { nombre: "AUXILIAR COMPRAS",                            basicoMensual: 1750905 },
  { nombre: "AUXILIAR CONTABLE",                           basicoMensual: 1750905 },
  { nombre: "AUXILIAR DE OPERACIONES",                     basicoMensual: 1787405 },
  { nombre: "AUXILIAR GESTION HUMANA",                     basicoMensual: 1750905 },
  { nombre: "AUXILIAR SISO",                               basicoMensual: 1787405 },
  { nombre: "CONTADOR",                                    basicoMensual: 2000000 },
  { nombre: "COORDINADOR OPERACIONES",                     basicoMensual: 2500000 },
  { nombre: "COORDINADOR SGST",                            basicoMensual: 2207000 },
  { nombre: "COORDINADORA DE RECURSOS HUMANOS",            basicoMensual: 2500000 },
  { nombre: "DIRECTOR DE OPERACIONES",                     basicoMensual: 4046350 },
  { nombre: "ESTIBADOR",                                   basicoMensual: 1750905 },
  { nombre: "ESTIBADOR-1",                                 basicoMensual: 1750905 },
  { nombre: "GERENTE",                                     basicoMensual: 4000000 },
  { nombre: "LIDER DE RESPONSABILIDAD SOCIAL Y BIENESTAR", basicoMensual: 2207000 },
  { nombre: "LIDER SISTEMA DE GESTION SGST",               basicoMensual: 2207000 },
  { nombre: "LIDER SOCIAL",                                basicoMensual: 1977000 },
  { nombre: "LIQUIDADOR DE SERVICIOS",                     basicoMensual: 1977000 },
  { nombre: "OPERADOR DE MONTACARGA",                      basicoMensual: 2050000 },
];

async function importarCargos() {
  console.log("🚀 Iniciando importación de cargos a Firestore...\n");

  // Leer cargos existentes para no duplicar
  const existentes = await db.collection("nomina_cargos").get();
  const nombresExistentes = new Set(
    existentes.docs.map((d) => d.data().nombre?.toUpperCase())
  );

  console.log(`📋 Cargos existentes en Firestore: ${nombresExistentes.size}`);
  console.log(`📂 Cargos a importar del Excel:    ${CARGOS_EXCEL.length}\n`);

  let creados = 0;
  let actualizados = 0;
  let omitidos = 0;

  for (const cargo of CARGOS_EXCEL) {
    const nombreUp = cargo.nombre.toUpperCase();

    // Buscar si ya existe
    const docExistente = existentes.docs.find(
      (d) => d.data().nombre?.toUpperCase() === nombreUp
    );

    if (docExistente) {
      const dataActual = docExistente.data();
      // Si no tiene basicoMensual o es diferente → actualizar
      if (!dataActual.basicoMensual || dataActual.basicoMensual !== cargo.basicoMensual) {
        await docExistente.ref.update({
          basicoMensual: cargo.basicoMensual,
          actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`  🔄 Actualizado: ${cargo.nombre} → $${cargo.basicoMensual.toLocaleString("es-CO")}`);
        actualizados++;
      } else {
        console.log(`  ✅ Sin cambios: ${cargo.nombre}`);
        omitidos++;
      }
    } else {
      // Crear nuevo
      await db.collection("nomina_cargos").add({
        nombre:        cargo.nombre,
        basicoMensual: cargo.basicoMensual,
        creadoEn:      admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`  ➕ Creado:      ${cargo.nombre} → $${cargo.basicoMensual.toLocaleString("es-CO")}`);
      creados++;
    }
  }

  console.log(`\n${"─".repeat(55)}`);
  console.log(`✅ Importación completada:`);
  console.log(`   ➕ Nuevos creados:    ${creados}`);
  console.log(`   🔄 Actualizados:      ${actualizados}`);
  console.log(`   ✅ Sin cambios:       ${omitidos}`);
  console.log(`   📊 Total procesados:  ${CARGOS_EXCEL.length}`);
  console.log(`${"─".repeat(55)}\n`);

  process.exit(0);
}

importarCargos().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
