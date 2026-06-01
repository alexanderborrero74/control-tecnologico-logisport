/**
 * SEED — TERRESTRE, CIAMSA 2 y CIAMSA 3
 * ============================================================
 * Proyecto: control-tecnologico-logisport (Firebase: ti-logisport-sas)
 * Ejecutar: node seed-terrestre-ciamsa.js
 *
 * Qué hace:
 *  1. Renombra cliente1 → TERRESTRE
 *  2. Confirma nombres de cliente2 (CIAMSA 2) y cliente3 (CIAMSA 3)
 *  3. Carga servicios con tarifas reales (extraídas de los Excel de mayo 2026)
 *  4. Carga trabajadores de los 3 clientes
 *
 * Reglas:
 *  - Usa setDoc(merge:true) → nunca borra datos existentes
 *  - Detecta duplicados por cédula → solo actualiza clientes y cargo
 *  - Los trabajadores de SPIA no se tocan
 * ============================================================
 */

const { initializeApp }  = require('firebase/app');
const { getFirestore, collection, doc, setDoc, getDocs } = require('firebase/firestore');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');

const firebaseConfig = {
  apiKey:            "AIzaSyBNMXiEGcgp9bHWNPhqaBH_cAcATEZwI8M",
  authDomain:        "ti-logisport-sas.firebaseapp.com",
  projectId:         "ti-logisport-sas",
  storageBucket:     "ti-logisport-sas.appspot.com",
  messagingSenderId: "111655171359",
  appId:             "1:111655171359:web:030e6831424e8d056fac2a",
};

console.log('🔥 Proyecto Firebase:', firebaseConfig.projectId);
const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

// ── Credenciales admin de Logisport ──
const EMAIL = 'sitbun@gmail.com';   // ← cambia esto
const PASS  = 'Al3xander.';                // ← cambia esto

// ══════════════════════════════════════════════════════════
// 1. CLIENTES
// ══════════════════════════════════════════════════════════
const CLIENTES = [
  { id:'cliente1', nombre:'TERRESTRE', color:'#14b8a6', emoji:'🚛' },
  { id:'cliente2', nombre:'CIAMSA 2',  color:'#8b5cf6', emoji:'⚓' },
  { id:'cliente3', nombre:'CIAMSA 3',  color:'#f59e0b', emoji:'⚓' },
];

// ══════════════════════════════════════════════════════════
// 2. SERVICIOS
// Fuente: hojas LISTADO DE SERVICIO y MATRIZ de los Excel mayo 2026
// unidad: "ton" (destajo por tonelada), "hora" (por hora), "dia" (valor diario fijo)
// ══════════════════════════════════════════════════════════
const SERVICIOS = [

  // ── TERRESTRE (cliente1) ──────────────────────────────────
  { clienteId:'cliente1', nombre:'ARRUME Y DESCASGUE DIURNO',             valor: 4680,                  unidad:'ton'  },
  { clienteId:'cliente1', nombre:'ARRUME Y DESCASGUE NOCTURNO',           valor: 6318,                  unidad:'ton'  },
  { clienteId:'cliente1', nombre:'ARRUME Y DESCASGUE FES DIU',            valor: 8658,                  unidad:'ton'  },
  { clienteId:'cliente1', nombre:'ARRUME Y DESCASGUE FES NOC',            valor: 8424,                  unidad:'ton'  },
  { clienteId:'cliente1', nombre:'CARGUE ESCOTILLA DIURNA',               valor: 5733,                  unidad:'ton'  },
  { clienteId:'cliente1', nombre:'CARGUE ESCOTILLA NOCTURNA',             valor: 7739.55,               unidad:'ton'  },
  { clienteId:'cliente1', nombre:'CARGUE ESCOTILLA DIURNA FESTIVA',       valor: 10319.4,               unidad:'ton'  },
  { clienteId:'cliente1', nombre:'CARGUE ESCOTILLA NOCTURNA FESTIVA',     valor: 12325.95,              unidad:'ton'  },
  { clienteId:'cliente1', nombre:'DESEMBALAJE CAJAS DIURNAS',             valor: 3789.5258631859,       unidad:'ton'  },
  { clienteId:'cliente1', nombre:'DESEMBALAJE SACOS DIU',                 valor: 2765.5179553029,       unidad:'ton'  },
  { clienteId:'cliente1', nombre:'DESEMBALAJE SACOS DIURNO FESTIVO',      valor: 4001.1553155600,       unidad:'ton'  },
  { clienteId:'cliente1', nombre:'DESEMBALAJE SACOS ARINA DE PESCADO DIU',valor: 3789.5258631859,       unidad:'ton'  },
  { clienteId:'cliente1', nombre:'DESPACHO CAJAS DIURNAS',                valor: 3789.5258631859,       unidad:'ton'  },
  { clienteId:'cliente1', nombre:'DESPACHO SACOS DIU',                    valor: 3474.9,                unidad:'ton'  },
  { clienteId:'cliente1', nombre:'DESPACHO SACOS ARINA DE PESCADO DIU',   valor: 3789.5258631859,       unidad:'ton'  },
  { clienteId:'cliente1', nombre:'EMBALAJE MIXTO DIURNA',                 valor: 36105.9812669556,      unidad:'contrato' },
  { clienteId:'cliente1', nombre:'EMBALAJE MIXTO NOCTURNA',               valor: 48743.0747103901,      unidad:'contrato' },
  { clienteId:'cliente1', nombre:'EMBALAJE MIXTO FESTIVO DIUR',           valor: 65803.1508590266,      unidad:'contrato' },
  { clienteId:'cliente1', nombre:'EMBALAJE MIXTO FESTIVO NOCT',           valor: 75822.7321799999,      unidad:'contrato' },
  { clienteId:'cliente1', nombre:'EMBALAJE NORMAL DIURNA',                valor: 65789.535123967,       unidad:'contrato' },
  { clienteId:'cliente1', nombre:'EMBALAJE NORMAL NOCTURNA',              valor: 88815.872417355,       unidad:'contrato' },
  { clienteId:'cliente1', nombre:'EMBALAJE NORMAL FESTIVO DIUR',          valor: 119901.42776343,       unidad:'contrato' },
  { clienteId:'cliente1', nombre:'EMBALAJE NORMAL FESTIVO NOCT',          valor: 138158.02376033,       unidad:'contrato' },
  { clienteId:'cliente1', nombre:'EMBALAJE PUSH PULL DIURNA',             valor: 21917.8927502985,      unidad:'contrato' },
  { clienteId:'cliente1', nombre:'EMBALAJE PUSH PULL NOCTURNA',           valor: 29589.1552129029,      unidad:'contrato' },
  { clienteId:'cliente1', nombre:'EMBALAJE PUSH PULL FESTIVO DIUR',       valor: 39945.3595374189,      unidad:'contrato' },
  { clienteId:'cliente1', nombre:'HORA COCEDOR HD',                       valor: 11934,                 unidad:'hora' },
  { clienteId:'cliente1', nombre:'HORA COCEDOR HN',                       valor: 16110.9,               unidad:'hora' },
  { clienteId:'cliente1', nombre:'HORA COCEDOR HFD',                      valor: 21481.2,               unidad:'hora' },
  { clienteId:'cliente1', nombre:'HORA COCEDOR HFN',                      valor: 25658.1,               unidad:'hora' },
  { clienteId:'cliente1', nombre:'HORA O,VARIOS DIURNAS',                 valor: 9126,                  unidad:'hora' },
  { clienteId:'cliente1', nombre:'HORA O,VARIOS NOCTURNAS',               valor: 12285,                 unidad:'hora' },
  { clienteId:'cliente1', nombre:'HORA O,VARIOS FESTIVAS',                valor: 15795,                 unidad:'hora' },
  { clienteId:'cliente1', nombre:'HORA O,VARIOS FESTIVAS NOCT',           valor: 19305,                 unidad:'hora' },
  { clienteId:'cliente1', nombre:'HORA TARJADOR DIURNAS',                 valor: 9243,                  unidad:'hora' },
  { clienteId:'cliente1', nombre:'HORA TARJADOR NOCTURNA',                valor: 12478.05,              unidad:'hora' },
  { clienteId:'cliente1', nombre:'HORA TARJADOR FESTIVA DIU',             valor: 16637.4,               unidad:'hora' },
  { clienteId:'cliente1', nombre:'HORA TARJADOR FESTIVA NOCT',            valor: 19872.45,              unidad:'hora' },
  { clienteId:'cliente1', nombre:'PALLETIZADO DIURNA',                    valor: 3152.158891937,         unidad:'ton'  },
  { clienteId:'cliente1', nombre:'PALLETIZADO NOCTURNA',                  valor: 4255.4145041147,        unidad:'ton'  },
  { clienteId:'cliente1', nombre:'PALLETIZADO DIURNA FESTIVO',            valor: 5516.4996899999,        unidad:'ton'  },
  { clienteId:'cliente1', nombre:'RESTIBAS',                              valor: 2784.6,                unidad:'ton'  },
  { clienteId:'cliente1', nombre:'RESTIBAS SACOS',                        valor: 2765.5179553029,        unidad:'ton'  },
  { clienteId:'cliente1', nombre:'SUBSIDIO TRANSPORTE DIA',               valor: 8010.6,                unidad:'dia'  },

  // ── CIAMSA 2 (cliente2) — Personal destajo ────────────────
  { clienteId:'cliente2', nombre:'DESPACHO SACOS DIU',                    valor: 2872.771945992,         unidad:'ton'  },
  { clienteId:'cliente2', nombre:'RESTIBAS SACOS',                        valor: 2285.565822032,         unidad:'ton'  },
  { clienteId:'cliente2', nombre:'DESEMBALAJE SACOS DIU',                 valor: 2285.552029176,         unidad:'ton'  },
  { clienteId:'cliente2', nombre:'DESPACHO CAJAS DIURNAS',                valor: 3131.839556352,         unidad:'ton'  },
  { clienteId:'cliente2', nombre:'DESARRUME',                             valor: 3604.77,               unidad:'ton'  },
  { clienteId:'cliente2', nombre:'DESPACHO SACOS ARINA DE PESCADO DIU',   valor: 3590.96493249,          unidad:'ton'  },
  { clienteId:'cliente2', nombre:'RESTIBA ARINA DE PESCADO',              valor: 2571.965665074,         unidad:'ton'  },
  // Personal fijo — valor por DÍA trabajado
  { clienteId:'cliente2', nombre:'AUXILIAR DE OPE Y SISO VALOR DIA',      valor: 69666.666670,           unidad:'dia'  },
  { clienteId:'cliente2', nombre:'TARJADOR DIA',                          valor: 61922.25,              unidad:'dia'  },
  { clienteId:'cliente2', nombre:'AUXILIAR DE CALIDAD DIA',               valor: 62400,                 unidad:'dia'  },
  { clienteId:'cliente2', nombre:'AUXILIAR DE BODEGA DIA',                valor: 91258.83,              unidad:'dia'  },
  { clienteId:'cliente2', nombre:'AUXILIAR OPERACIONES DIA',              valor: 91258.83,              unidad:'dia'  },
  { clienteId:'cliente2', nombre:'O.VARIOS DIA',                          valor: 58363.5,               unidad:'dia'  },
  // Horas extras
  { clienteId:'cliente2', nombre:'HORA O,VARIOS DIURNAS',                 valor: 8190,                  unidad:'hora' },
  { clienteId:'cliente2', nombre:'TARJADOR EXTRAS DIURNAS',               valor: 10554.928977273,        unidad:'hora' },
  { clienteId:'cliente2', nombre:'AUXILIAR DE OPE Y SISO EXTRAS DIU',     valor: 11875,                 unidad:'hora' },

  // ── CIAMSA 3 (cliente3) — Personal fijo ──────────────────
  { clienteId:'cliente3', nombre:'AUXILIAR DE OPE Y SISO VALOR DIA',      valor: 69666.666670,           unidad:'dia'  },
  { clienteId:'cliente3', nombre:'AUXILIAR DE OPE Y SISO EXTRAS DIU',     valor: 11875,                 unidad:'hora' },
  { clienteId:'cliente3', nombre:'TARJADOR DIA',                          valor: 61922.25,              unidad:'dia'  },
  { clienteId:'cliente3', nombre:'TARJADOR EXTRAS DIURNAS',               valor: 10554.928977273,        unidad:'hora' },
  { clienteId:'cliente3', nombre:'DIA SALARIO O.VARIOS',                  valor: 58363.5,               unidad:'dia'  },
  { clienteId:'cliente3', nombre:'O.VARIOS EXTRAS DIURNAS',               valor: 9692.642045455,         unidad:'hora' },
  { clienteId:'cliente3', nombre:'HORA TARJADOR',                         valor: 8444,                  unidad:'hora' },
  // Personal destajo (Estibadores)
  { clienteId:'cliente3', nombre:'DESPACHO SACOS DIU',                    valor: 2872.771945992,         unidad:'ton'  },
  { clienteId:'cliente3', nombre:'DESEMBALAJE SACOS DIU',                 valor: 2285.552029176,         unidad:'ton'  },
  { clienteId:'cliente3', nombre:'RESTIBAS SACOS',                        valor: 2285.565822032,         unidad:'ton'  },
  { clienteId:'cliente3', nombre:'DESARRUME',                             valor: 3604.77,               unidad:'ton'  },
  { clienteId:'cliente3', nombre:'DESPACHO SACOS ARINA DE PESCADO DIU',   valor: 3590.96493249,          unidad:'ton'  },
  { clienteId:'cliente3', nombre:'RESTIBA ARINA DE PESCADO',              valor: 2571.965665074,         unidad:'ton'  },
];

// ══════════════════════════════════════════════════════════
// 3. TRABAJADORES
// tipo: 'fijo' = salario mensual garantizado
//       'destajo' = solo producción (con piso SMMLV)
// basicoMensual: salario mensual de contrato
// SMMLV 2026 = 1,750,905
// ══════════════════════════════════════════════════════════
const SMMLV = 1750905;

const TRABAJADORES = [

  // ─── TERRESTRE (cliente1) ─────────────────────────────────
  { cedula:'1006203551', nombre:'ANGULO KEILING DAYANA',           cargo:'TARJADORA',      basicoMensual: SMMLV,     clienteIds:['cliente1'], tipo:'destajo' },
  { cedula:'94443382',   nombre:'CELORIO ANGULO WILLIAM',          cargo:'ESTIBADOR',       basicoMensual: SMMLV,     clienteIds:['cliente1'], tipo:'destajo' },
  { cedula:'1107044706', nombre:'CIFUENTE SHAROL ANDREA',          cargo:'TARJADORA',       basicoMensual: SMMLV,     clienteIds:['cliente1'], tipo:'destajo' },
  { cedula:'1028188614', nombre:'CORDOBA VIVEROS ALVARO STIVEN',   cargo:'ESTIBADOR',       basicoMensual: SMMLV,     clienteIds:['cliente1'], tipo:'destajo' },
  { cedula:'94443217',   nombre:'HURTADO PINEDA OMAR',             cargo:'ESTIBADOR',       basicoMensual: SMMLV,     clienteIds:['cliente1'], tipo:'destajo' },
  { cedula:'16491415',   nombre:'MURILLO JOSE DOMINGO',            cargo:'ESTIBADOR M.',    basicoMensual: SMMLV,     clienteIds:['cliente1'], tipo:'destajo' },
  { cedula:'1111743310', nombre:'PEREA ARBOLEDA DANNA YARITZA',    cargo:'TARJADORA',       basicoMensual: SMMLV,     clienteIds:['cliente1'], tipo:'destajo' },
  { cedula:'94440202',   nombre:'RIASCOS CASTRO JORGE ANDRES',     cargo:'ESTIBADOR',       basicoMensual: SMMLV,     clienteIds:['cliente1'], tipo:'destajo' },
  { cedula:'1111792302', nombre:'RIASCOS TORRES HECTOR ALEXIS',    cargo:'ESTIBADOR',       basicoMensual: SMMLV,     clienteIds:['cliente1'], tipo:'destajo' },
  { cedula:'1006198728', nombre:'VALENCIA MOSQUERA YAJAIRA',       cargo:'TARJADORA',       basicoMensual: SMMLV,     clienteIds:['cliente1'], tipo:'destajo' },
  { cedula:'1192915465', nombre:'BONILLA JENIFFER FERNANDA',       cargo:'TARJADORA',       basicoMensual: SMMLV,     clienteIds:['cliente1'], tipo:'destajo' },
  { cedula:'1193221638', nombre:'BALANTA RIASCOS MIGUEL ANGEL',    cargo:'ESTIBADOR',       basicoMensual: SMMLV,     clienteIds:['cliente1'], tipo:'destajo' },
  { cedula:'16498710',   nombre:'BONILLA OBANDO JOSE ANGEL',       cargo:'COCEDOR',         basicoMensual: SMMLV,     clienteIds:['cliente1'], tipo:'destajo' },
  { cedula:'1108334026', nombre:'CAMPAZ ANDRADE BRAYAN STIVEN',    cargo:'ESTIBADOR',       basicoMensual: SMMLV,     clienteIds:['cliente1'], tipo:'destajo' },
  { cedula:'1006202145', nombre:'CASTILLO PAZ JEFRID ANDRES',      cargo:'ESTIBADOR',       basicoMensual: SMMLV,     clienteIds:['cliente1'], tipo:'destajo' },
  { cedula:'1006200141', nombre:'ESTUPINÁN MOSQUERA MARLEN HILARY',cargo:'TARJADORA',       basicoMensual: SMMLV,     clienteIds:['cliente1'], tipo:'destajo' },
  { cedula:'1111818384', nombre:'FERRAZZI LOPEZ ALEYANDRO MARCO',  cargo:'ESTIBADOR',       basicoMensual: SMMLV,     clienteIds:['cliente1'], tipo:'destajo' },
  { cedula:'94443217',   nombre:'HURTADO PINEDA OMAR',             cargo:'ESTIBADOR',       basicoMensual: SMMLV,     clienteIds:['cliente1'], tipo:'destajo' },
  { cedula:'1007946963', nombre:'HURTADO RAMOS SUANER JHULIET',    cargo:'TARJADORA',       basicoMensual: SMMLV,     clienteIds:['cliente1'], tipo:'destajo' },
  { cedula:'1111786079', nombre:'MANYOMA MURILLO MIGUEL ANTONIO',  cargo:'ESTIBADOR',       basicoMensual: SMMLV,     clienteIds:['cliente1'], tipo:'destajo' },
  { cedula:'1028182965', nombre:'MELO MINA MAYKOL ANDRES',         cargo:'ESTIBADOR',       basicoMensual: SMMLV,     clienteIds:['cliente1'], tipo:'destajo' },
  { cedula:'31603898',   nombre:'MOSQUERA VALENCIA MARLIN',        cargo:'TARJADORA',       basicoMensual: SMMLV,     clienteIds:['cliente1'], tipo:'destajo' },
  { cedula:'1006199700', nombre:'MURILLO VENTE WENDY TATIANA',     cargo:'TARJADORA',       basicoMensual: SMMLV,     clienteIds:['cliente1'], tipo:'destajo' },
  { cedula:'16512167',   nombre:'MURILLO JHON WAINER',             cargo:'ESTIBADOR',       basicoMensual: SMMLV,     clienteIds:['cliente1'], tipo:'destajo' },
  { cedula:'1028185921', nombre:'OBANDO VIVEROS KATERIN LICETH',   cargo:'TARJADORA',       basicoMensual: SMMLV,     clienteIds:['cliente1'], tipo:'destajo' },
  { cedula:'1111801032', nombre:'OROBIO LOZANO JOSE FABIAN',       cargo:'ESTIBADOR',       basicoMensual: SMMLV,     clienteIds:['cliente1'], tipo:'destajo' },
  { cedula:'1151443150', nombre:'PALMA ANGULO AKON SAMUEL',        cargo:'O.VARIOS',        basicoMensual: SMMLV,     clienteIds:['cliente1'], tipo:'destajo' },
  { cedula:'1111754324', nombre:'RODRIGUEZ MINA IVETH NICOLL',     cargo:'TARJADORA',       basicoMensual: SMMLV,     clienteIds:['cliente1'], tipo:'destajo' },
  { cedula:'1148951466', nombre:'ROSERO OBREGON DAVID',            cargo:'ESTIBADOR',       basicoMensual: SMMLV,     clienteIds:['cliente1'], tipo:'destajo' },
  { cedula:'1111765970', nombre:'TORRES IBARGUEN JACOB',           cargo:'ESTIBADOR',       basicoMensual: SMMLV,     clienteIds:['cliente1'], tipo:'destajo' },
  { cedula:'16490476',   nombre:'TORRES VARGAS JAIME',             cargo:'ESTIBADOR',       basicoMensual: SMMLV,     clienteIds:['cliente1'], tipo:'destajo' },
  { cedula:'1111753023', nombre:'VIERA SINISTERRA STEFANNY',       cargo:'TARJADORA',       basicoMensual: SMMLV,     clienteIds:['cliente1'], tipo:'destajo' },
  { cedula:'1111763588', nombre:'RIASCOS GARCES GUSTAVO ADOLFO',   cargo:'ESTIBADOR',       basicoMensual: SMMLV,     clienteIds:['cliente1'], tipo:'destajo' },
  { cedula:'16495620',   nombre:'AGUIÑO QUIÑONES WILLIAM',         cargo:'SUPERVISOR',      basicoMensual: SMMLV,     clienteIds:['cliente1'], tipo:'destajo' },

  // ─── CIAMSA 2 (cliente2) — Personal DESTAJO ───────────────
  { cedula:'16482805',   nombre:'SAA MOSQUERA BERNARDO',           cargo:'AUXILIAR OPE',    basicoMensual: 2090000,   clienteIds:['cliente2'], tipo:'fijo'    },
  { cedula:'16481219',   nombre:'ALEGRIA GONGORA ERNESTO',         cargo:'ESTIBADOR',       basicoMensual: SMMLV,     clienteIds:['cliente2'], tipo:'destajo' },
  { cedula:'1193042818', nombre:'DONISABE NEGRIA YILBERSON',       cargo:'O.VARIOS',        basicoMensual: SMMLV,     clienteIds:['cliente2'], tipo:'destajo' },
  { cedula:'14471709',   nombre:'RIASCOS JORI JESUS',              cargo:'ESTIBADOR',       basicoMensual: SMMLV,     clienteIds:['cliente2'], tipo:'destajo' },
  { cedula:'1148951460', nombre:'ROSERO OBREGON DUBAN',            cargo:'ESTIBADOR',       basicoMensual: SMMLV,     clienteIds:['cliente2'], tipo:'destajo' },
  { cedula:'16487221',   nombre:'RIASCOS RIASCOS JOSE GREGORIO',   cargo:'ESTIBADOR',       basicoMensual: SMMLV,     clienteIds:['cliente2'], tipo:'destajo' },
  { cedula:'16493345',   nombre:'VALENCIA HECTOR FABIO',           cargo:'ESTIBADOR',       basicoMensual: SMMLV,     clienteIds:['cliente2'], tipo:'destajo' },
  { cedula:'16507408',   nombre:'VIVEROS RIASCOS HERNANDO',        cargo:'ESTIBADOR',       basicoMensual: SMMLV,     clienteIds:['cliente2'], tipo:'destajo' },
  { cedula:'1151443150', nombre:'PALMA ANGULO AKON SAMUEL',        cargo:'O.VARIOS',        basicoMensual: SMMLV,     clienteIds:['cliente2'], tipo:'destajo' },
  { cedula:'16505544',   nombre:'ARIAS PALACIOS CARLOS ALBERTO',   cargo:'ESTIBADOR',       basicoMensual: SMMLV,     clienteIds:['cliente2'], tipo:'destajo' },
  // CIAMSA 2 — Personal FIJO (Tarjadores, Auxiliares)
  { cedula:'1111805515', nombre:'RIVAS JOHAN MAURICIO',            cargo:'TARJADOR',        basicoMensual: 1857667.5, clienteIds:['cliente2'], tipo:'fijo'    },
  { cedula:'1007849683', nombre:'SOLIS VALENCIA JHAN CARLOS',      cargo:'TARJADOR',        basicoMensual: 1857667.5, clienteIds:['cliente2'], tipo:'fijo'    },
  { cedula:'1111807627', nombre:'RIASCOS HURTADO HARRY ARLEY',     cargo:'TARJADOR',        basicoMensual: 1857667.5, clienteIds:['cliente2'], tipo:'fijo'    },
  { cedula:'1192749232', nombre:'MARTINEZ MOSQUERA LUIS ADILSON',  cargo:'TARJADOR',        basicoMensual: 1857667.5, clienteIds:['cliente2'], tipo:'fijo'    },
  { cedula:'94442198',   nombre:'RENTERIA RENTERIA ULICER',        cargo:'TARJADOR',        basicoMensual: 1857667.5, clienteIds:['cliente2'], tipo:'fijo'    },
  { cedula:'1111741262', nombre:'MATEUS HERRERA YACCER ENRIQUE',   cargo:'TARJADOR',        basicoMensual: 1857667.5, clienteIds:['cliente2'], tipo:'fijo'    },
  { cedula:'1151446050', nombre:'GUERRERO VALENCIA LENIS ALFONSO', cargo:'TARJADOR',        basicoMensual: 1857667.5, clienteIds:['cliente2'], tipo:'fijo'    },
  { cedula:'16485738',   nombre:'LUNA MOSQUERA JORGE ELIECER',     cargo:'O.VARIOS',        basicoMensual: SMMLV,     clienteIds:['cliente2'], tipo:'fijo'    },
  { cedula:'14474475',   nombre:'MONTAÑO AGUIÑO ELVIS MANUEL',     cargo:'O.VARIOS',        basicoMensual: SMMLV,     clienteIds:['cliente2'], tipo:'fijo'    },
  { cedula:'1148954692', nombre:'AREVALO GARCIA CHRISTIAN ALEXIS', cargo:'AUXILIAR OPERACIONES', basicoMensual:2737764.9, clienteIds:['cliente2'], tipo:'fijo' },
  { cedula:'1111753870', nombre:'ARBOLEDA VALENCIA CINDY YULIETH', cargo:'AUXILIAR DE CALIDAD',  basicoMensual:1872000,   clienteIds:['cliente2'], tipo:'fijo' },
  { cedula:'1111794798', nombre:'ROSERO SAA JHON JAIRO',           cargo:'AUXILIAR DE CALIDAD',  basicoMensual:1872000,   clienteIds:['cliente2'], tipo:'fijo' },
  { cedula:'1111773830', nombre:'PAREDES GUERRERO EDWIN HENANDO',  cargo:'AUXILIAR DE BODEGA',   basicoMensual:2737764.9, clienteIds:['cliente2'], tipo:'fijo' },

  // ─── CIAMSA 3 (cliente3) ──────────────────────────────────
  // FIJOS
  { cedula:'16510080',   nombre:'MONTAÑO JHON FREDDY',             cargo:'AUXILIAR OPE',    basicoMensual: 2090000,   clienteIds:['cliente3'], tipo:'fijo'    },
  { cedula:'1078689782', nombre:'CUERO CHAMAPURRO DEYSON',         cargo:'TARJADOR',        basicoMensual: 1857667.5, clienteIds:['cliente3'], tipo:'fijo'    },
  { cedula:'1111748607', nombre:'JONATHAN MOSQUERA RIASCOS',       cargo:'TARJADOR',        basicoMensual: 1857667.5, clienteIds:['cliente3'], tipo:'fijo'    },
  { cedula:'1144072654', nombre:'RAFAEL SINISTERRA VASQUEZ',       cargo:'TARJADOR',        basicoMensual: 1857667.5, clienteIds:['cliente3'], tipo:'fijo'    },
  { cedula:'1111753451', nombre:'CAICEDO JOHAN MAURICIO',          cargo:'O. VARIOS',       basicoMensual: SMMLV,     clienteIds:['cliente3'], tipo:'fijo'    },
  { cedula:'1192908854', nombre:'MOSQUERA RUIZ JHEFERSON STIVEN',  cargo:'O. VARIOS',       basicoMensual: SMMLV,     clienteIds:['cliente3'], tipo:'fijo'    },
  { cedula:'94229166',   nombre:'GAMBOA CAICEDO JUAN PABLO',       cargo:'O. VARIOS',       basicoMensual: SMMLV,     clienteIds:['cliente3'], tipo:'fijo'    },
  { cedula:'1006200141', nombre:'ESTUPINÁN MOSQUERA MARLEN HILARY',cargo:'TARJADOR',        basicoMensual: 1857667.5, clienteIds:['cliente3'], tipo:'fijo'    },
  { cedula:'31603898',   nombre:'MOSQUERA VALENCIA MARLIN',        cargo:'TARJADOR',        basicoMensual: 1857667.5, clienteIds:['cliente3'], tipo:'fijo'    },
  { cedula:'1028185921', nombre:'OBANDO VIVEROS KATERIN LICETH',   cargo:'TARJADOR',        basicoMensual: 1857667.5, clienteIds:['cliente3'], tipo:'fijo'    },
  { cedula:'1111754324', nombre:'RODRIGUEZ MINA IVETH NICOLL',     cargo:'TARJADOR',        basicoMensual: 1857667.5, clienteIds:['cliente3'], tipo:'fijo'    },
  { cedula:'1111753023', nombre:'VIERA SINISTERRA STEFANNY',       cargo:'TARJADOR',        basicoMensual: 1857667.5, clienteIds:['cliente3'], tipo:'fijo'    },
  // DESTAJO (Estibadores)
  { cedula:'1195573751', nombre:'ANGULO MONDRAGON WILSON',         cargo:'ESTIBADOR',       basicoMensual: SMMLV,     clienteIds:['cliente3'], tipo:'destajo' },
  { cedula:'94440523',   nombre:'CABEZAS ASPRILLA JAN EDINSON',    cargo:'ESTIBADOR',       basicoMensual: SMMLV,     clienteIds:['cliente3'], tipo:'destajo' },
  { cedula:'1111739552', nombre:'CANGA MEDINA JHON EDER',          cargo:'ESTIBADOR',       basicoMensual: SMMLV,     clienteIds:['cliente3'], tipo:'destajo' },
  { cedula:'1111818384', nombre:'FERRAZZI LOPEZ ALEYANDRO MARCO',  cargo:'ESTIBADOR',       basicoMensual: SMMLV,     clienteIds:['cliente3'], tipo:'destajo' },
  { cedula:'1111755501', nombre:'MACHADO SOLIMAN JUAN DANIEL',     cargo:'ESTIBADOR',       basicoMensual: SMMLV,     clienteIds:['cliente3'], tipo:'destajo' },
  { cedula:'1007946704', nombre:'VALENCIA DIEGO ALBERTO',          cargo:'ESTIBADOR',       basicoMensual: SMMLV,     clienteIds:['cliente3'], tipo:'destajo' },
  { cedula:'16510559',   nombre:'VIVEROS ANGULO WILLIAM',          cargo:'ESTIBADOR',       basicoMensual: SMMLV,     clienteIds:['cliente3'], tipo:'destajo' },
  { cedula:'1007864235', nombre:'MOSQUERA SINISTERRA JHON ALEXANDER', cargo:'ESTIBADOR',    basicoMensual: SMMLV,     clienteIds:['cliente3'], tipo:'destajo' },
  { cedula:'1111801032', nombre:'OROBIO LOZANO JOSE FABIAN',       cargo:'ESTIBADOR',       basicoMensual: SMMLV,     clienteIds:['cliente3'], tipo:'destajo' },
  { cedula:'1111786079', nombre:'MANYOMA MURILLO MIGUEL ANTONIO',  cargo:'ESTIBADOR',       basicoMensual: SMMLV,     clienteIds:['cliente3'], tipo:'destajo' },
  { cedula:'1151439963', nombre:'PORTOCARRERO CRISTIAN',           cargo:'ESTIBADOR',       basicoMensual: SMMLV,     clienteIds:['cliente3'], tipo:'destajo' },
  { cedula:'1193096375', nombre:'MINA ANGULO ANDRES FELIPE',       cargo:'ESTIBADOR',       basicoMensual: SMMLV,     clienteIds:['cliente3'], tipo:'destajo' },
  { cedula:'1111755418', nombre:'MINA RIVAS JHON DEINER',          cargo:'ESTIBADOR',       basicoMensual: SMMLV,     clienteIds:['cliente3'], tipo:'destajo' },
];

// ══════════════════════════════════════════════════════════
// EJECUCIÓN PRINCIPAL
// ══════════════════════════════════════════════════════════
async function main() {
  const ts = new Date();
  let errores = 0;

  // ── Autenticar ──
  console.log('\n🔐 Autenticando...');
  await signInWithEmailAndPassword(auth, EMAIL, PASS);
  console.log('   ✅ Autenticado como', EMAIL);
  console.log('\n📋 Actualizando clientes...');
  for (const c of CLIENTES) {
    try {
      await setDoc(doc(db, 'nomina_clientes', c.id), {
        nombre: c.nombre, color: c.color, emoji: c.emoji,
        actualizadoEn: ts,
      }, { merge: true });
      console.log(`   ✓ ${c.id} → "${c.nombre}"`);
    } catch(e) {
      console.error(`   ✗ ${c.id}: ${e.message}`);
      errores++;
    }
  }

  // ── 2. Servicios ──
  console.log('\n🔧 Cargando servicios...');
  const snapServ = await getDocs(collection(db, 'nomina_servicios'));
  const serviciosExistentes = snapServ.docs.map(d => ({
    id: d.id, nombre: (d.data().nombre||'').toUpperCase(), clienteId: d.data().clienteId || ''
  }));

  let servNuevos = 0, servActualizados = 0;
  for (const s of SERVICIOS) {
    const nombreUp = s.nombre.toUpperCase();
    const existe = serviciosExistentes.find(e => e.nombre === nombreUp && e.clienteId === s.clienteId);
    try {
      if (existe) {
        await setDoc(doc(db, 'nomina_servicios', existe.id), {
          nombre: nombreUp, valor: s.valor, clienteId: s.clienteId,
          unidad: s.unidad || 'ton', actualizadoEn: ts,
        }, { merge: true });
        servActualizados++;
        console.log(`   ↻ [${s.clienteId}] ${nombreUp}`);
      } else {
        const ref = doc(collection(db, 'nomina_servicios'));
        await setDoc(ref, {
          nombre: nombreUp, valor: s.valor, clienteId: s.clienteId,
          unidad: s.unidad || 'ton', actualizadoEn: ts,
        });
        servNuevos++;
        console.log(`   + [${s.clienteId}] ${nombreUp}`);
      }
    } catch(e) {
      console.error(`   ✗ ${nombreUp}: ${e.message}`);
      errores++;
    }
  }
  console.log(`   → ${servNuevos} nuevos, ${servActualizados} actualizados`);

  // ── 3. Trabajadores ──
  console.log('\n👷 Cargando trabajadores...');
  const snapTrab = await getDocs(collection(db, 'nomina_trabajadores'));
  const trabExistentes = snapTrab.docs.map(d => ({
    id: d.id, cedula: String(d.data().cedula||'').trim(), data: d.data()
  }));

  let trabNuevos = 0, trabActualizados = 0;
  // Agrupar por cédula para consolidar clienteIds
  const porCedula = {};
  for (const t of TRABAJADORES) {
    const cc = String(t.cedula).trim();
    if (!porCedula[cc]) porCedula[cc] = { ...t, clienteIds: [...t.clienteIds] };
    else {
      for (const cId of t.clienteIds) {
        if (!porCedula[cc].clienteIds.includes(cId)) porCedula[cc].clienteIds.push(cId);
      }
    }
  }

  for (const [cedula, t] of Object.entries(porCedula)) {
    const existe = trabExistentes.find(e => e.cedula === cedula);
    try {
      const data = {
        cedula,
        nombre:        t.nombre,
        cargo:         t.cargo,
        basicoMensual: t.basicoMensual,
        tipo:          t.tipo || 'destajo',
        activo:        true,
        actualizadoEn: ts,
      };
      if (existe) {
        const clientesActuales = Array.isArray(existe.data.clienteIds) ? existe.data.clienteIds : [];
        const clientesMerged = [...new Set([...clientesActuales, ...t.clienteIds])];
        await setDoc(doc(db, 'nomina_trabajadores', existe.id), {
          ...data, clienteIds: clientesMerged,
        }, { merge: true });
        trabActualizados++;
        console.log(`   ↻ ${cedula} | ${t.nombre} → [${clientesMerged.join(', ')}]`);
      } else {
        const ref = doc(collection(db, 'nomina_trabajadores'));
        await setDoc(ref, { ...data, clienteIds: t.clienteIds });
        trabNuevos++;
        console.log(`   + ${cedula} | ${t.nombre} → [${t.clienteIds.join(', ')}]`);
      }
    } catch(e) {
      console.error(`   ✗ ${cedula}: ${e.message}`);
      errores++;
    }
  }
  console.log(`   → ${trabNuevos} nuevos, ${trabActualizados} actualizados`);

  // ── Resumen ──
  console.log('\n══════════════════════════════════════════');
  if (errores === 0) {
    console.log(' ✅ CARGA COMPLETADA SIN ERRORES');
  } else {
    console.log(` ⚠️  CARGA COMPLETADA CON ${errores} ERRORES — revisa arriba`);
  }
  console.log('══════════════════════════════════════════');
  console.log(`\n📌 Clientes actualizados:`);
  console.log(`   Cliente 1 → TERRESTRE`);
  console.log(`   Cliente 2 → CIAMSA 2`);
  console.log(`   Cliente 3 → CIAMSA 3`);
  console.log(`\n🚀 Despliega: vercel --prod\n`);
  process.exit(0);
}

main().catch(err => {
  console.error('\n❌ ERROR FATAL:', err.message);
  process.exit(1);
});
