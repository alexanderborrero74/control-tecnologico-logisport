// scripts/importar-cargos-ciamsa3.cjs
// Importa los cargos de CIAMSA 3 a nomina_cargos con clienteId = "cliente3"
// Uso: node scripts/importar-cargos-ciamsa3.cjs

const admin = require('firebase-admin');
const path  = require('path');
const fs    = require('fs');

const saPath = path.join(__dirname, '..', 'serviceAccountKey.json');
if (!fs.existsSync(saPath)) { console.error('❌ No se encontró serviceAccountKey.json'); process.exit(1); }
admin.initializeApp({ credential: admin.credential.cert(require(saPath)) });
const db = admin.firestore();

// Cargos extraídos del Excel CIAMSA 3
// Fuente: hojas TRABAJADORES + NOMINA ORG de 03__NOMINA_DEL_01_AL_15_FEBRERO_CIAMSA_3.xlsx
// basicoMensual = salarioBaseQuincenal × 2 (según NOMINA ORG)
const CARGOS_CIAMSA3 = [
  { nombre: "ESTIBADOR",    basicoMensual: 1517451  }, // 758725.5 × 2
  { nombre: "TARJADOR",     basicoMensual: 817089   }, // 408544.5 × 2
  { nombre: "TARJADORA",    basicoMensual: 817089   },
  { nombre: "O. VARIOS",    basicoMensual: 1750905  }, // 875452.5 × 2
  { nombre: "AUXILIAR OPE", basicoMensual: 1750905  }, // 875452.5 × 2
  { nombre: "A. OPER",      basicoMensual: 1750905  }, // 875452.5 × 2
];

async function importar() {
  const snap = await db.collection('nomina_cargos').where('clienteId','==','cliente3').get();
  const yaExisten = new Set(snap.docs.map(d => d.data().nombre?.toUpperCase()));
  console.log(`Ya existen: ${yaExisten.size} cargos para cliente3`);

  const nuevos = CARGOS_CIAMSA3.filter(c => !yaExisten.has(c.nombre.toUpperCase()));
  if (nuevos.length === 0) { console.log('✅ Todos los cargos ya están importados.'); process.exit(0); }

  console.log(`Importando ${nuevos.length} cargos...`);
  const batch = db.batch();
  for (const c of nuevos) {
    batch.set(db.collection('nomina_cargos').doc(), {
      nombre:        c.nombre,
      basicoMensual: c.basicoMensual,
      clienteId:     'cliente3',
      creadoEn:      admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
  console.log(`✅ ${nuevos.length} cargos insertados.`);
  nuevos.forEach(c => console.log(`   ${c.nombre.padEnd(15)} → $${c.basicoMensual.toLocaleString('es-CO')}/mes`));
  process.exit(0);
}

importar().catch(e => { console.error('❌', e.message); process.exit(1); });
