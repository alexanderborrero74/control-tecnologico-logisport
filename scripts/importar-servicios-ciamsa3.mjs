// scripts/importar-servicios-ciamsa3.mjs
// Importa los 92 servicios CIAMSA 3 a la colección nomina_servicios con clienteId = "cliente3"
//
// REQUISITOS:
//   1. Colocar serviceAccount.json en esta misma carpeta (scripts/)
//      Descargar desde: Firebase Console → Proyecto → ⚙️ → Cuentas de servicio → Generar nueva clave privada
//   2. Instalar firebase-admin si no está:
//      npm install firebase-admin
//
// USO:
//   node scripts/importar-servicios-ciamsa3.mjs

import { createRequire } from "module";
import { readFileSync }   from "fs";
import { fileURLToPath }  from "url";
import { dirname, join }  from "path";

const require      = createRequire(import.meta.url);
const admin        = require("firebase-admin");
const __dirname    = dirname(fileURLToPath(import.meta.url));

// ── Carga service account desde la misma carpeta del script ──
const saPath = join(__dirname, "serviceAccount.json");
let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(saPath, "utf8"));
} catch {
  console.error("❌ No se encontró serviceAccount.json en scripts/");
  console.error("   Descárgalo desde Firebase Console → ⚙️ → Cuentas de servicio → Generar nueva clave privada");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// ── 92 servicios extraídos de CIAMSA 3 — Feb 2025 ──
// Fuente: 03__NOMINA_DEL_01_AL_15_FEBRERO_CIAMSA_3.xlsx → hoja LISTADO DE SERVICIO
const SERVICIOS_CIAMSA3 = [
  { nombre: "DESARRUME",                               tarifa: 3081.0     },
  { nombre: "ARRUME DIURNO",                           tarifa: 3081.0     },
  { nombre: "ARRUME F.DIURNO",                         tarifa: 6290.375   },
  { nombre: "ARRUME F.NOCTURNO",                       tarifa: 7548.45    },
  { nombre: "ARUME Y DESARRUME DIURNA",                tarifa: 2895.361   },
  { nombre: "ARUME Y DESARRUME NOCTURNA",              tarifa: 3908.7374  },
  { nombre: "CLASIFICADO  DIURNA",                     tarifa: 1428.3978  },
  { nombre: "CLASIFICADO  NOCTURNA",                   tarifa: 1928.3371  },
  { nombre: "DESCARGUE BANDA  DIURNA",                 tarifa: 1488.0542  },
  { nombre: "DESCARGUE BANDA  NOCTURNA",               tarifa: 2008.8731  },
  { nombre: "DESCARGUE MANUAL DIURNA",                 tarifa: 2769.9012  },
  { nombre: "DESCARGUE MANUAL NOCTURNA",               tarifa: 3739.3666  },
  { nombre: "DESCARGUE ROBOT DIURNA",                  tarifa: 727.818    },
  { nombre: "DESCARGUE ROBOT NOCTURNA",                tarifa: 982.5542   },
  { nombre: "DESEMBALAJE CAJAS DIURNAS",               tarifa: 2676.7859  },
  { nombre: "DESEMBALAJE CAJAS DIURNAS FESTIVAS",      tarifa: 4684.3754  },
  { nombre: "DESEMBALAJE SACOS ARINA DE PES DIU",      tarifa: 2198.2613  },
  { nombre: "DESEMBALAJE SACOS ARINA DE PES FESTIVO",  tarifa: 3846.6497  },
  { nombre: "DESEMBALAJE SACOS DIU",                   tarifa: 1953.4633  },
  { nombre: "DESEMBALAJE SACOS DIURNO FESTIVO",        tarifa: 3419.7909  },
  { nombre: "DESEMBALAJE Y EMBALAJE",                  tarifa: 123240.0   },
  { nombre: "DESPACHO CAJAS DIURNAS",                  tarifa: 2676.7859  },
  { nombre: "DESPACHO CAJAS DIURNAS FESTIVAS",         tarifa: 4684.3754  },
  { nombre: "DESPACHO SACOS ARINA DE PES FESTIVO",     tarifa: 5370.7939  },
  { nombre: "DESPACHO SACOS ARINA DE PESCADO DIU",     tarifa: 3069.2008  },
  { nombre: "DESPACHO SACOS DIU",                      tarifa: 2455.3606  },
  { nombre: "DESPACHO SACOS FEST DIU",                 tarifa: 4295.651   },
  { nombre: "DIAS AUXILIAR",                           tarifa: 36924.7894 },
  { nombre: "DIAS SUPER",                              tarifa: 55458.0    },
  { nombre: "EMBALAJE MIXTO DIURNA",                   tarifa: 30652.0882 },
  { nombre: "EMBALAJE MIXTO NOCTURNA",                 tarifa: 41380.319  },
  { nombre: "EMBALAJE NORMAL DIURNA",                  tarifa: 55851.8716 },
  { nombre: "EMBALAJE NORMAL NOCTURNA",                tarifa: 75400.0267 },
  { nombre: "EMBALAJE PUSH PULL DIURNA",               tarifa: 18607.1437 },
  { nombre: "EMBALAJE PUSH PULL NOCTURNA",             tarifa: 25119.644  },
  { nombre: "ENSAQUE 1",                               tarifa: 19213.0438 },
  { nombre: "ENSAQUE 2",                               tarifa: 13200.0    },
  { nombre: "ENSAQUE FESTIVO",                         tarifa: 23100.0    },
  { nombre: "ETIQUETADO",                              tarifa: 214.4712   },
  { nombre: "HORA O,VARIOS DIURNAS",                   tarifa: 7000.0     },
  { nombre: "HORA O,VARIOS FESTIVAS",                  tarifa: 12250.0    },
  { nombre: "HORA O,VARIOS FESTIVAS NOCT",             tarifa: 14700.0    },
  { nombre: "HORA O,VARIOS NOCTURNAS",                 tarifa: 7695.0     },
  { nombre: "HORA TARJADOR",                           tarifa: 7189.0     },
  { nombre: "HORAS TARJADOR FESIVAS",                  tarifa: 12580.75   },
  { nombre: "HORAS EXTRAS DIUNAS",                     tarifa: 7000.0     },
  { nombre: "PALLETIZADO DIURNA",                      tarifa: 2676.0179  },
  { nombre: "PALLETIZADO NOCTURNA",                    tarifa: 3612.6242  },
  { nombre: "RAJADO DIURNA",                           tarifa: 2691.9649  },
  { nombre: "RAJADO NOCTURNA",                         tarifa: 3634.1526  },
  { nombre: "RESTIBAS SACOS",                          tarifa: 1953.4751  },
  { nombre: "VACIADO X 20 QUIMPAC",                    tarifa: 70000.0    },
  { nombre: "RESTIBAS FESTIVAS DIURNAS",               tarifa: 3418.5749  },
  { nombre: "DIA INCAPACIDAD",                         tarifa: 47450.0    },
  { nombre: "DIA LICENCIA DE LUTO",                    tarifa: 47450.0    },
  { nombre: "DESEMBALAJE LLANTAS",                     tarifa: 3491.8     },
  { nombre: "DESPACHO LLANTAS",                        tarifa: 3902.6     },
  { nombre: "ARRUME LLANTAS",                          tarifa: 3902.6     },
  { nombre: "INSPECIONES ICA",                         tarifa: 1953.4751  },
  { nombre: "ARRUME LLANTAS FESTIVO",                  tarifa: 6829.55    },
  { nombre: "CLASIFICACION LLANTAS",                   tarifa: 3491.8     },
  { nombre: "CLASIFICACION LLANTAS FESTIVOS",          tarifa: 6110.65    },
  { nombre: "DIA SALARIO",                             tarifa: 58363.5    },
  { nombre: "RECARGO NOCTURNO",                        tarifa: 2785.5307  },
  { nombre: "EXTRAS DIURNAS",                          tarifa: 9948.3239  },
  { nombre: "EXTRAS NOCTURNAS",                        tarifa: 12733.8545 },
  { nombre: "RECARGO FESTIVO NOCTURNO",                tarifa: 9152.458   },
  { nombre: "FESTIVAS DIURNAS",                        tarifa: 13927.6534 },
  { nombre: "FESTIVAS NOCTURNAS",                      tarifa: 16713.1841 },
  { nombre: "EXTRAS FESTIVAS DIURNAS",                 tarifa: 16315.2511 },
  { nombre: "EXTRAS FESTIVAS NOCTURNAS",               tarifa: 19100.7818 },
  { nombre: "RECARGO FESTIVO DIURNO",                  tarifa: 14325.5864 },
  { nombre: "RESTIBAS CAJAS",                          tarifa: 2676.7859  },
  { nombre: "SALARIO TARJA DIA",                       tarifa: 48333.33   },
  { nombre: "SUBSIDIO TRANSPORTE DIA",                 tarifa: 6666.6667  },
  { nombre: "DESPACHO TAMBORES DIU",                   tarifa: 2676.7859  },
  { nombre: "RESTIBAS TAMBORES",                       tarifa: 2676.7859  },
  { nombre: "HORAS COCEDOR",                           tarifa: 8500.0     },
  { nombre: "HORAS COCEDOR FESTIVAS",                  tarifa: 14875.0    },
  { nombre: "RESTIBA ARINA DE PESCADO",                tarifa: 2198.2613  },
  { nombre: "DESEMBALAJE CAJAS DIURNAS +30%",          tarifa: 3480.0     },
  { nombre: "AUXILIAR DE OPE Y SISO EX FES DIU",       tarifa: 16655.3648 },
  { nombre: "AUXILIAR DE OPE Y SISO EX FES NOC",       tarifa: 20717.6489 },
  { nombre: "AUXILIAR DE OPE Y SISO EXTRAS DIU",       tarifa: 10155.7102 },
  { nombre: "AUXILIAR DE OPE Y SISO EXTRAS NOC",       tarifa: 14217.9943 },
  { nombre: "AUXILIAR DE OPE Y SISO FES DIU",          tarifa: 14624.2227 },
  { nombre: "AUXILIAR DE OPE Y SISO FES NOC",          tarifa: 17061.5932 },
  { nombre: "AUXILIAR DE OPE Y SISO INCAPACIDAD DIA",  tarifa: 59580.1667 },
  { nombre: "AUXILIAR DE OPE Y SISO R FES DIU",        tarifa: 6905.883   },
  { nombre: "AUXILIAR DE OPE Y SISO R. NOCTURNO",      tarifa: 2843.5989  },
  { nombre: "AUXILIAR DE OPE Y SISO RECARGO FES NOC",  tarifa: 9343.2534  },
  { nombre: "AUXILIAR DE OPE Y SISO VALOR DIA",        tarifa: 59580.1667 },
];

// ── Importación ──
async function importar() {
  console.log("🔍 Verificando servicios existentes para cliente3...");
  const existSnap = await db.collection("nomina_servicios")
    .where("clienteId", "==", "cliente3")
    .get();
  const yaExisten = new Set(existSnap.docs.map(d => d.data().nombre?.toUpperCase()));
  console.log(`   Ya existen: ${yaExisten.size} servicios para cliente3`);

  const nuevos   = SERVICIOS_CIAMSA3.filter(s => !yaExisten.has(s.nombre.toUpperCase()));
  const omitidos = SERVICIOS_CIAMSA3.length - nuevos.length;

  if (nuevos.length === 0) {
    console.log("✅ Todos los servicios ya están en Firestore. Nada que importar.");
    process.exit(0);
  }
  if (omitidos > 0) console.log(`⏭️  Omitidos (ya existen): ${omitidos}`);

  console.log(`\n⬆️  Importando ${nuevos.length} servicios nuevos...`);

  // Usar batches de 500 (límite de Firestore)
  const BATCH_SIZE = 400;
  let ok = 0;

  for (let i = 0; i < nuevos.length; i += BATCH_SIZE) {
    const lote   = nuevos.slice(i, i + BATCH_SIZE);
    const batch  = db.batch();
    for (const s of lote) {
      const ref = db.collection("nomina_servicios").doc();
      batch.set(ref, {
        nombre:    s.nombre,
        tarifa:    s.tarifa,
        valor:     s.tarifa,      // alias para compatibilidad
        clienteId: "cliente3",
        unidad:    "ton",         // toneladas/unidades — unidad CIAMSA
        activo:    true,
        creadoEn:  admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
    ok += lote.length;
    console.log(`   ✓ ${ok}/${nuevos.length} insertados`);
  }

  console.log(`\n✅ Importación completada:`);
  console.log(`   Insertados:     ${ok}`);
  console.log(`   Total cliente3: ${yaExisten.size + ok} servicios`);
  process.exit(0);
}

importar().catch(e => {
  console.error("Error fatal:", e.message || e);
  process.exit(1);
});
