// scripts/migrar-cargos-spia.cjs
// Agrega clienteId: "spia" a todos los cargos que no tengan clienteId
// Uso: node scripts/migrar-cargos-spia.cjs

const admin = require('firebase-admin');
const path  = require('path');
const fs    = require('fs');

const saPath = path.join(__dirname, '..', 'serviceAccountKey.json');
if (!fs.existsSync(saPath)) { console.error('❌ No se encontró serviceAccountKey.json'); process.exit(1); }
admin.initializeApp({ credential: admin.credential.cert(require(saPath)) });
const db = admin.firestore();

async function migrar() {
  const snap = await db.collection('nomina_cargos').get();
  const sinCliente = snap.docs.filter(d => !d.data().clienteId);

  if (sinCliente.length === 0) {
    console.log('✅ Todos los cargos ya tienen clienteId asignado.');
    process.exit(0);
  }

  console.log(`Migrando ${sinCliente.length} cargos sin clienteId → clienteId: "spia"...`);
  const batch = db.batch();
  sinCliente.forEach(d => batch.update(d.ref, { clienteId: 'spia' }));
  await batch.commit();

  console.log('\n✅ Migración completa:');
  sinCliente.forEach(d => console.log(`   ${d.data().nombre}`));
  process.exit(0);
}

migrar().catch(e => { console.error('❌', e.message); process.exit(1); });
