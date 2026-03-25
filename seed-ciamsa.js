const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Leer service account desde .env.local
const lines = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8').split('\n');
const env = {};
for (const line of lines) {
  const [key, ...rest] = line.split('=');
  if (key && rest.length) env[key.trim()] = rest.join('=').trim();
}

const serviceAccount = JSON.parse(Buffer.from(env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8'));
console.log('Proyecto:', serviceAccount.project_id);

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const CLIENTES = [
  { id:'spia',     nombre:'SPIA',      color:'#3b82f6', emoji:'S' },
  { id:'cliente1', nombre:'Cliente 1', color:'#8b5cf6', emoji:'1' },
  { id:'cliente2', nombre:'CIAMSA 2',  color:'#10b981', emoji:'2' },
  { id:'cliente3', nombre:'CIAMSA 3',  color:'#f59e0b', emoji:'3' },
];

const TRABAJADORES = [
  { cedula:'1111805515', nombre:'RIVAS JOHAN MAURICIO',            cargo:'TARJADOR',                basicoMensual:1750905, clienteIds:['cliente2'], tipo:'fijo' },
  { cedula:'1007849683', nombre:'SOLIS VALENCIA JHAN CARLOS',      cargo:'TARJADOR',                basicoMensual:1750905, clienteIds:['cliente2'], tipo:'fijo' },
  { cedula:'1111807627', nombre:'RIASCOS HURTADO HARRY ARLEY',     cargo:'TARJADOR',                basicoMensual:1750905, clienteIds:['cliente2'], tipo:'fijo' },
  { cedula:'1192749232', nombre:'MARTINEZ MOSQUERA LUIS ADILSON',  cargo:'TARJADOR',                basicoMensual:1750905, clienteIds:['cliente2'], tipo:'fijo' },
  { cedula:'94442198',   nombre:'RENTERIA RENTERIA ULICER',        cargo:'TARJADOR',                basicoMensual:1750905, clienteIds:['cliente2'], tipo:'fijo' },
  { cedula:'1111741262', nombre:'MATEUS HERRERA YACCER ENRIQUE',   cargo:'TARJADOR',                basicoMensual:1750905, clienteIds:['cliente2'], tipo:'fijo' },
  { cedula:'1151446050', nombre:'GUERRERO VALENCIA LENIS ALFONSO', cargo:'TARJADOR',                basicoMensual:1750905, clienteIds:['cliente2'], tipo:'fijo' },
  { cedula:'1111819223', nombre:'HINESTROZA MURILLO LUIS CARLOS',  cargo:'O.VARIOS',                basicoMensual:1750905, clienteIds:['cliente2'], tipo:'fijo' },
  { cedula:'14474475',   nombre:'MONTANO AGUINO ELVIS MANUEL',     cargo:'O.VARIOS',                basicoMensual:1750905, clienteIds:['cliente2'], tipo:'fijo' },
  { cedula:'1148954692', nombre:'AREVALO GARCIA CHRISTIAN ALEXIS', cargo:'AUXILIAR DE OPERACIONES', basicoMensual:2339970, clienteIds:['cliente2'], tipo:'fijo' },
  { cedula:'1111753870', nombre:'ARBOLEDA VALENCIA CINDY YULIETH', cargo:'AUXILIAR DE CALIDAD',     basicoMensual:1750905, clienteIds:['cliente2'], tipo:'fijo' },
  { cedula:'1111773830', nombre:'PAREDES GUERRERO EDWIN HENANDO',  cargo:'AUXILIAR DE BODEGA',      basicoMensual:2339970, clienteIds:['cliente2'], tipo:'fijo' },
  { cedula:'16481219',   nombre:'ALEGRIA GONGORA ERNESTO',         cargo:'ESTIBADOR',               basicoMensual:1750905, clienteIds:['cliente2'], tipo:'variable' },
  { cedula:'1059042730', nombre:'ANGULO CASTILLO JOSE JEISON',     cargo:'ESTIBADOR',               basicoMensual:1750905, clienteIds:['cliente2'], tipo:'variable' },
  { cedula:'16505544',   nombre:'ARIAS PALACIOS CARLOS ALBERTO',   cargo:'ESTIBADOR',               basicoMensual:1750905, clienteIds:['cliente2'], tipo:'variable' },
  { cedula:'1078689782', nombre:'CUERO CHAMAPURRO DEYSON',         cargo:'ESTIBADOR',               basicoMensual:1750905, clienteIds:['cliente2','cliente3'], tipo:'variable' },
  { cedula:'1193042818', nombre:'DONISABE NEGRIA YILBERSON',       cargo:'ESTIBADOR',               basicoMensual:1750905, clienteIds:['cliente2'], tipo:'variable' },
  { cedula:'73150775',   nombre:'HURTADO MALO JAVIER MARIA',       cargo:'DIRECTOR DE OPERACIONES', basicoMensual:0,       clienteIds:['cliente2'], tipo:'comision' },
  { cedula:'1111776063', nombre:'PORTOCARRERO CUERO JHON EDWAR',   cargo:'ESTIBADOR',               basicoMensual:1750905, clienteIds:['cliente2'], tipo:'variable' },
  { cedula:'1151446240', nombre:'RENTERIA JUAN CARLOS',            cargo:'ESTIBADOR',               basicoMensual:1750905, clienteIds:['cliente2'], tipo:'variable' },
  { cedula:'14471709',   nombre:'RIASCOS JORI JESUS',              cargo:'ESTIBADOR',               basicoMensual:1750905, clienteIds:['cliente2'], tipo:'variable' },
  { cedula:'1148951460', nombre:'ROSERO OBREGON DUBAN',            cargo:'ESTIBADOR',               basicoMensual:1750905, clienteIds:['cliente2'], tipo:'variable' },
  { cedula:'1192912827', nombre:'TORRES MONTANO YEISON',           cargo:'ESTIBADOR',               basicoMensual:1750905, clienteIds:['cliente2'], tipo:'variable' },
  { cedula:'16493345',   nombre:'VALENCIA HECTOR FABIO',           cargo:'ESTIBADOR',               basicoMensual:1750905, clienteIds:['cliente2'], tipo:'variable' },
  { cedula:'16507408',   nombre:'VIVEROS RIASCOS HERNANDO',        cargo:'ESTIBADOR',               basicoMensual:1750905, clienteIds:['cliente2'], tipo:'variable' },
  { cedula:'1195573751', nombre:'ANGULO MONDRAGON WILSON',         cargo:'ESTIBADOR',               basicoMensual:1750905, clienteIds:['cliente3'], tipo:'variable' },
  { cedula:'94440523',   nombre:'CABEZAS ASPRILLA JAN EDINSON',    cargo:'ESTIBADOR',               basicoMensual:1750905, clienteIds:['cliente3'], tipo:'variable' },
  { cedula:'1111753451', nombre:'CAICEDO JOHAN MAURICIO',          cargo:'O.VARIOS',                basicoMensual:1750905, clienteIds:['cliente3'], tipo:'variable' },
  { cedula:'1111739552', nombre:'CANGA MEDINA JHON EDER',          cargo:'ESTIBADOR',               basicoMensual:1750905, clienteIds:['cliente3'], tipo:'variable' },
  { cedula:'94445876',   nombre:'JOHN WILMER OROZCO VALENCIA',     cargo:'TARJADOR',                basicoMensual:1750905, clienteIds:['cliente3'], tipo:'variable' },
  { cedula:'1111748607', nombre:'JONATHAN MOSQUERA RIASCOS',       cargo:'TARJADOR',                basicoMensual:1750905, clienteIds:['cliente3'], tipo:'variable' },
  { cedula:'1111755501', nombre:'MACHADO SOLIMAN JUAN DANIEL',     cargo:'ESTIBADOR',               basicoMensual:1750905, clienteIds:['cliente3'], tipo:'variable' },
  { cedula:'1115452252', nombre:'MINA VALENCIA JOSE ARLEY',        cargo:'ESTIBADOR',               basicoMensual:1750905, clienteIds:['cliente3'], tipo:'variable' },
  { cedula:'16510080',   nombre:'MONTANO JHON FREDDY',             cargo:'AUXILIAR DE OPERACIONES', basicoMensual:2339970, clienteIds:['cliente3'], tipo:'variable' },
  { cedula:'1192908854', nombre:'MOSQUERA RUIZ JHEFERSON STIVEN',  cargo:'O.VARIOS',                basicoMensual:1750905, clienteIds:['cliente3'], tipo:'variable' },
  { cedula:'1151439963', nombre:'PORTOCARRERO CRISTIAN',           cargo:'ESTIBADOR',               basicoMensual:1750905, clienteIds:['cliente3'], tipo:'variable' },
  { cedula:'1144072654', nombre:'RAFAEL SINISTERRA VASQUEZ',       cargo:'TARJADOR',                basicoMensual:1750905, clienteIds:['cliente3'], tipo:'variable' },
  { cedula:'16482805',   nombre:'SAA MOSQUERA BERNARDO',           cargo:'AUXILIAR DE OPERACIONES', basicoMensual:1750905, clienteIds:['cliente3'], tipo:'variable' },
  { cedula:'1007946704', nombre:'VALENCIA DIEGO ALBERTO',          cargo:'ESTIBADOR',               basicoMensual:1750905, clienteIds:['cliente3'], tipo:'variable' },
  { cedula:'16510559',   nombre:'VIVEROS ANGULO WILLIAM',          cargo:'ESTIBADOR',               basicoMensual:1750905, clienteIds:['cliente3'], tipo:'variable' },
];

const SERVICIOS = [
  { id:'c2_tarjado',              clienteId:'cliente2', nombre:'Tarjado',                 tarifa:58364,  unidad:'dia' },
  { id:'c2_estiba',               clienteId:'cliente2', nombre:'Estiba',                  tarifa:58364,  unidad:'dia' },
  { id:'c2_operaciones_varias',   clienteId:'cliente2', nombre:'Operaciones Varias',      tarifa:58364,  unidad:'dia' },
  { id:'c2_auxiliar_operaciones', clienteId:'cliente2', nombre:'Auxiliar de Operaciones', tarifa:77999,  unidad:'dia' },
  { id:'c2_auxiliar_calidad',     clienteId:'cliente2', nombre:'Auxiliar de Calidad',     tarifa:58364,  unidad:'dia' },
  { id:'c2_auxiliar_bodega',      clienteId:'cliente2', nombre:'Auxiliar de Bodega',      tarifa:77999,  unidad:'dia' },
  { id:'c2_direccion_ope',        clienteId:'cliente2', nombre:'Direccion de Operaciones',tarifa:400000, unidad:'periodo' },
  { id:'c3_tarjado',              clienteId:'cliente3', nombre:'Tarjado',                 tarifa:58364,  unidad:'dia' },
  { id:'c3_estiba',               clienteId:'cliente3', nombre:'Estiba',                  tarifa:58364,  unidad:'dia' },
  { id:'c3_operaciones_varias',   clienteId:'cliente3', nombre:'Operaciones Varias',      tarifa:58364,  unidad:'dia' },
  { id:'c3_auxiliar_operaciones', clienteId:'cliente3', nombre:'Auxiliar de Operaciones', tarifa:77999,  unidad:'dia' },
];

async function main() {
  const ts = admin.firestore.FieldValue.serverTimestamp();
  console.log('\n============================');
  console.log(' CARGA CIAMSA 2 Y CIAMSA 3');
  console.log('============================\n');

  console.log('Paso 1/3: Clientes...');
  for (const c of CLIENTES) {
    await db.collection('nomina_clientes').doc(c.id).set(
      { nombre: c.nombre, color: c.color, emoji: c.emoji, activo: true, updatedAt: ts },
      { merge: true }
    );
    console.log('  OK:', c.id, '->', c.nombre);
  }

  console.log('\nPaso 2/3: Trabajadores...');
  let nuevos = 0, actualizados = 0;
  for (const t of TRABAJADORES) {
    const snap = await db.collection('nomina_trabajadores').where('cedula', '==', t.cedula).get();
    if (!snap.empty) {
      const ref  = snap.docs[0].ref;
      const data = snap.docs[0].data();
      const ids  = [...new Set([...(data.clienteIds || ['spia']), ...t.clienteIds])];
      await ref.set({ clienteIds: ids, basicoMensual: t.basicoMensual > 0 ? t.basicoMensual : (data.basicoMensual || 0), tipo: t.tipo, updatedAt: ts }, { merge: true });
      actualizados++;
      console.log(' ACT:', t.cedula, t.nombre.substring(0,30), '->', ids.join(','));
    } else {
      await db.collection('nomina_trabajadores').add({
        cedula: t.cedula, nombre: t.nombre, cargo: t.cargo,
        basicoMensual: t.basicoMensual, clienteIds: t.clienteIds,
        estado: 'activo', tipo: t.tipo, createdAt: ts, updatedAt: ts,
      });
      nuevos++;
      console.log(' NEW:', t.cedula, t.nombre.substring(0,30));
    }
  }

  console.log('\nPaso 3/3: Servicios...');
  for (const s of SERVICIOS) {
    await db.collection('nomina_servicios').doc(s.id).set(
      { nombre: s.nombre, clienteId: s.clienteId, tarifa: s.tarifa, unidad: s.unidad, activo: true, updatedAt: ts },
      { merge: true }
    );
    console.log(' OK:', s.clienteId, s.nombre);
  }

  console.log('\n============================');
  console.log(' LISTO! Nuevos:', nuevos, '| Actualizados:', actualizados);
  console.log('============================\n');
  process.exit(0);
}

main().catch(err => { console.error('ERROR:', err.message); process.exit(1); });