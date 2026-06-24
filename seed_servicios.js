// seed_servicios.js — Actualizar servicios en Firestore para TERRESTRE, CIAMSA 2, CIAMSA 3
// Ejecutar: node seed_servicios.js
// Requiere: tu config de Firebase en firebaseConfig abajo

const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, addDoc, updateDoc, doc, query, where, deleteDoc } = require("firebase/firestore");

const firebaseConfig = {
  apiKey: "AIzaSyBNMXiEGcgp9bHWNPhqaBH_cAcATEZwI8M",
  authDomain: "ti-logisport-sas.firebaseapp.com",
  projectId: "ti-logisport-sas",
  storageBucket: "ti-logisport-sas.appspot.com",
  messagingSenderId: "111655171359",
  appId: "1:111655171359:web:030e6831424e8d056fac2a",
};

const SERVICIOS = {
  cliente1: [ // TERRESTRE
    {nombre:"ARRUME Y DESCASGUE DIURNO",       valor:4680,           unidad:"ton"},
    {nombre:"ARRUME Y DESCASGUE FES DIU",       valor:8658,           unidad:"ton"},
    {nombre:"ARRUME Y DESCASGUE FES NOC",       valor:8424,           unidad:"ton"},
    {nombre:"ARRUME Y DESCASGUE NOCTURNO",      valor:6318,           unidad:"ton"},
    {nombre:"CARGUE ESCOTILLA DIURNA",          valor:5733,           unidad:"ton"},
    {nombre:"CARGUE ESCOTILLA DIURNA FESTIVA",  valor:10319.4,        unidad:"ton"},
    {nombre:"CARGUE ESCOTILLA NOCTURNA",        valor:7739.55,        unidad:"ton"},
    {nombre:"CARGUE ESCOTILLA NOCTURNA FESTIVA",valor:12325.95,       unidad:"ton"},
    {nombre:"DESEMBALAJE CAJAS DIURNAS",        valor:3789.53,        unidad:"ton"},
    {nombre:"DESEMBALAJE SACOS DIU",            valor:2765.52,        unidad:"ton"},
    {nombre:"DESPACHO CAJAS DIURNAS",           valor:3789.53,        unidad:"ton"},
    {nombre:"DESEMBALAJE SACOS ARINA DE PESCADO DIU",valor:3789.53,   unidad:"ton"},
    {nombre:"DESPACHO SACOS ARINA DE PESCADO DIU",valor:3789.53,      unidad:"ton"},
    {nombre:"DESPACHO SACOS DIU",               valor:3474.9,         unidad:"ton"},
    {nombre:"EMBALAJE MIXTO DIURNA",            valor:36106,          unidad:"ton"},
    {nombre:"EMBALAJE MIXTO FESTIVO DIUR",      valor:65803.15,       unidad:"ton"},
    {nombre:"EMBALAJE MIXTO FESTIVO NOCT",      valor:75822.73,       unidad:"ton"},
    {nombre:"EMBALAJE MIXTO NOCTURNA",          valor:48743.07,       unidad:"ton"},
    {nombre:"EMBALAJE NORMAL DIURNA",           valor:65789.54,       unidad:"ton"},
    {nombre:"EMBALAJE NORMAL FESTIVO DIUR",     valor:119901.43,      unidad:"ton"},
    {nombre:"EMBALAJE NORMAL FESTIVO NOCT",     valor:138158.02,      unidad:"ton"},
    {nombre:"EMBALAJE NORMAL NOCTURNA",         valor:88815.87,       unidad:"ton"},
    {nombre:"EMBALAJE PUSH PULL DIURNA",        valor:21917.89,       unidad:"ton"},
    {nombre:"EMBALAJE PUSH PULL FESTIVO DIUR",  valor:39945.36,       unidad:"ton"},
    {nombre:"EMBALAJE PUSH PULL NOCTURNA",      valor:29589.16,       unidad:"ton"},
    {nombre:"HORA COCEDOR HD",                  valor:11934,          unidad:"hora"},
    {nombre:"HORA COCEDOR HFD",                 valor:21481.2,        unidad:"hora"},
    {nombre:"HORA COCEDOR HFN",                 valor:25658.1,        unidad:"hora"},
    {nombre:"HORA COCEDOR HN",                  valor:16110.9,        unidad:"hora"},
    {nombre:"HORA O,VARIOS DIURNAS",            valor:9126,           unidad:"hora"},
    {nombre:"HORA O,VARIOS FESTIVAS",           valor:15795,          unidad:"hora"},
    {nombre:"HORA O,VARIOS FESTIVAS NOCT",      valor:19305,          unidad:"hora"},
    {nombre:"HORA O,VARIOS NOCTURNAS",          valor:12285,          unidad:"hora"},
    {nombre:"HORA TARJADOR DIURNAS",            valor:9243,           unidad:"hora"},
    {nombre:"HORA TARJADOR FESTIVA DIU",        valor:16637.4,        unidad:"hora"},
    {nombre:"HORA TARJADOR FESTIVA NOCT",       valor:19872.45,       unidad:"hora"},
    {nombre:"HORA TARJADOR NOCTURNA",           valor:12478.05,       unidad:"hora"},
    {nombre:"PALLETIZADO DIURNA",               valor:3152.16,        unidad:"ton"},
    {nombre:"PALLETIZADO DIURNA FESTIVO",       valor:5516.5,         unidad:"ton"},
    {nombre:"PALLETIZADO NOCTURNA",             valor:4255.41,        unidad:"ton"},
    {nombre:"RESTIBAS",                         valor:2784.6,         unidad:"ton"},
    {nombre:"RESTIBAS SACOS",                   valor:2765.52,        unidad:"ton"},
    {nombre:"SUBSIDIO TRANSPORTE DIA",          valor:8010.6,         unidad:"dia"},
    {nombre:"DESEMBALAJE SACOS DIURNO FESTIVO", valor:4001.16,        unidad:"ton"},
  ],
  cliente2: [ // CIAMSA 2
    {nombre:"ARRUME DIURNO",                    valor:3605,           unidad:"ton"},
    {nombre:"ARRUME F.DIURNO",                  valor:7359.74,        unidad:"ton"},
    {nombre:"ARRUME F.NOCTURNO",                valor:8831.69,        unidad:"ton"},
    {nombre:"ARRUME LLANTAS",                   valor:4566.04,        unidad:"ton"},
    {nombre:"ARRUME LLANTAS FESTIVO",           valor:7990.57,        unidad:"ton"},
    {nombre:"ARUME Y DESARRUME DIURNA",         valor:3387.57,        unidad:"ton"},
    {nombre:"ARUME Y DESARRUME NOCTURNA",       valor:4573.22,        unidad:"ton"},
    {nombre:"AUXILIAR DE OPE Y SISO EX FES DIU",valor:19475,         unidad:"hora"},
    {nombre:"AUXILIAR DE OPE Y SISO EX FES NOC",valor:22800,         unidad:"hora"},
    {nombre:"AUXILIAR DE OPE Y SISO EXTRAS DIU",valor:11875,         unidad:"hora"},
    {nombre:"AUXILIAR DE OPE Y SISO EXTRAS NOC",valor:15200,         unidad:"hora"},
    {nombre:"AUXILIAR DE OPE Y SISO FES DIU",   valor:16625,         unidad:"hora"},
    {nombre:"AUXILIAR DE OPE Y SISO FES NOC",   valor:19950,         unidad:"hora"},
    {nombre:"AUXILIAR DE OPE Y SISO INCAPACIDAD DIA",valor:69708.8,  unidad:"dia"},
    {nombre:"AUXILIAR DE OPE Y SISO R FES DIU", valor:8079.88,       unidad:"hora"},
    {nombre:"AUXILIAR DE OPE Y SISO R. NOCTURNO",valor:3325,         unidad:"hora"},
    {nombre:"AUXILIAR DE OPE Y SISO RECARGO FES NOC",valor:10925,    unidad:"hora"},
    {nombre:"AUXILIAR DE OPE Y SISO VALOR DIA", valor:69666.67,      unidad:"dia"},
    {nombre:"CLASIFICACION LLANTAS",            valor:4085.41,        unidad:"ton"},
    {nombre:"CLASIFICACION LLANTAS FESTIVOS",   valor:7149.46,        unidad:"ton"},
    {nombre:"CLASIFICADO DIURNA",               valor:1671.23,        unidad:"ton"},
    {nombre:"CLASIFICADO NOCTURNA",             valor:2256.15,        unidad:"ton"},
    {nombre:"DESARRUME",                        valor:3604.77,        unidad:"ton"},
    {nombre:"DESCARGUE BANDA DIURNA",           valor:1741.02,        unidad:"ton"},
    {nombre:"DESCARGUE BANDA NOCTURNA",         valor:2350.38,        unidad:"ton"},
    {nombre:"DESCARGUE MANUAL DIURNA",          valor:3240.78,        unidad:"ton"},
    {nombre:"DESCARGUE MANUAL NOCTURNA",        valor:4375.06,        unidad:"ton"},
    {nombre:"DESCARGUE ROBOT DIURNA",           valor:851.55,         unidad:"ton"},
    {nombre:"DESCARGUE ROBOT NOCTURNA",         valor:1149.59,        unidad:"ton"},
    {nombre:"DESEMBALAJE CAJAS DIURNAS",        valor:3131.84,        unidad:"ton"},
    {nombre:"DESEMBALAJE CAJAS DIURNAS +30%",   valor:4071.6,         unidad:"ton"},
    {nombre:"DESEMBALAJE CAJAS DIURNAS FESTIVAS",valor:5480.72,       unidad:"ton"},
    {nombre:"DESEMBALAJE LLANTAS",              valor:4085.41,        unidad:"ton"},
    {nombre:"DESEMBALAJE SACOS ARINA DE PES DIU",valor:2571.97,      unidad:"ton"},
    {nombre:"DESEMBALAJE SACOS ARINA DE PES FESTIVO",valor:4500.58,  unidad:"ton"},
    {nombre:"DESEMBALAJE SACOS DIU",            valor:2285.55,        unidad:"ton"},
    {nombre:"DESEMBALAJE SACOS DIURNO FESTIVO", valor:4001.16,        unidad:"ton"},
    {nombre:"DESEMBALAJE Y EMBALAJE",           valor:144190.8,       unidad:"ton"},
    {nombre:"DESPACHO CAJAS DIURNAS",           valor:3131.84,        unidad:"ton"},
    {nombre:"DESPACHO CAJAS DIURNAS FESTIVAS",  valor:5480.72,        unidad:"ton"},
    {nombre:"DESPACHO LLANTAS",                 valor:4566.04,        unidad:"ton"},
    {nombre:"DESPACHO SACOS ARINA DE PES FESTIVO",valor:6283.83,     unidad:"ton"},
    {nombre:"DESPACHO SACOS ARINA DE PESCADO DIU",valor:3590.96,     unidad:"ton"},
    {nombre:"DESPACHO SACOS DIU",               valor:2872.77,        unidad:"ton"},
    {nombre:"DESPACHO SACOS FEST DIU",          valor:5025.91,        unidad:"ton"},
    {nombre:"DESPACHO TAMBORES DIU",            valor:3131.84,        unidad:"ton"},
    {nombre:"DIA COSEDOR",                      valor:74880,          unidad:"dia"},
    {nombre:"DIA INCAPACIDAD",                  valor:55516.5,        unidad:"dia"},
    {nombre:"DIA LICENCIA DE LUTO",             valor:55516.5,        unidad:"dia"},
    {nombre:"DIAS AUXILIAR",                    valor:43202,          unidad:"dia"},
    {nombre:"DIAS SUPER",                       valor:64885.86,       unidad:"dia"},
    {nombre:"DIA SALARIO",                      valor:58363.5,        unidad:"dia"},
    {nombre:"EMBALAJE MIXTO DIURNA",            valor:35862.94,       unidad:"ton"},
    {nombre:"EMBALAJE MIXTO NOCTURNA",          valor:48414.97,       unidad:"ton"},
    {nombre:"EMBALAJE NORMAL DIURNA",           valor:65346.69,       unidad:"ton"},
    {nombre:"EMBALAJE NORMAL NOCTURNA",         valor:88218.03,       unidad:"ton"},
    {nombre:"EMBALAJE PUSH PULL DIURNA",        valor:21770.36,       unidad:"ton"},
    {nombre:"EMBALAJE PUSH PULL NOCTURNA",      valor:29389.98,       unidad:"ton"},
  ],
};
// CIAMSA 3 tiene los mismos servicios que CIAMSA 2
SERVICIOS.cliente3 = SERVICIOS.cliente2.map(s=>({...s}));

async function main(){
  const app = initializeApp(firebaseConfig);
  const db  = getFirestore(app);
  const col = collection(db,"nomina_servicios");

  for(const [clienteId, servicios] of Object.entries(SERVICIOS)){
    console.log(`\nActualizando ${clienteId} (${servicios.length} servicios)...`);
    // Eliminar servicios existentes de este cliente
    const snap = await getDocs(query(col, where("clienteId","==",clienteId)));
    for(const d of snap.docs) await deleteDoc(d.ref);
    console.log(`  Eliminados ${snap.docs.length} servicios anteriores`);
    // Insertar nuevos
    for(const s of servicios){
      await addDoc(col,{
        ...s,
        clienteId,
        tarifa: s.valor,
        orden: servicios.indexOf(s)+1,
        activo: true,
        actualizadoEn: new Date(),
        creadoEn: new Date(),
      });
    }
    console.log(`  Insertados ${servicios.length} servicios OK`);
  }
  console.log('\n✅ LISTO - Servicios actualizados en Firestore');
  process.exit(0);
}

main().catch(e=>{ console.error(e); process.exit(1); });
