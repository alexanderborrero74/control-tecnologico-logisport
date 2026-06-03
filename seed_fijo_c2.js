// Script para sembrar el personal fijo de CIAMSA 2 en Firestore
// Ejecutar: node seed_fijo_c2.js

const { initializeApp } = require("firebase/app");
const { getFirestore, collection, addDoc, getDocs, deleteDoc } = require("firebase/firestore");

// Configuracion Firebase - ajusta con tu config
const firebaseConfig = {
  // PEGA AQUI TU CONFIG DE FIREBASE (la misma de firebaseConfig.js)
  // apiKey: "...", authDomain: "...", projectId: "ti-logisport-sas", ...
};

// Personal fijo CIAMSA 2 segun NOMINA ORG del Excel
const PERSONAL_FIJO = [
  { orden:1,  nombre:"SAA MOSQUERA BERNARDO",           cedula:"16482805",   cargo:"AUXILIAR OPE", salarioMensual:2090000, activo:true },
  { orden:2,  nombre:"ALEGRIA GONGORA ERNESTO",          cedula:"16481219",   cargo:"EST",          salarioMensual:1160000, activo:true },
  { orden:3,  nombre:"DONISABE NEGRIA YILBERSON",        cedula:"1193042818", cargo:"O.V",          salarioMensual:1160000, activo:false },
  { orden:4,  nombre:"RIASCOS JORI JESUS",               cedula:"14471709",   cargo:"EST",          salarioMensual:1160000, activo:true },
  { orden:5,  nombre:"ROSERO OBREGON DUBAN",             cedula:"1148951460", cargo:"EST",          salarioMensual:1160000, activo:true },
  { orden:6,  nombre:"RIASCOS RIASCOS JOSE GREGORIO",    cedula:"16487221",   cargo:"EST",          salarioMensual:1160000, activo:true },
  { orden:7,  nombre:"VALENCIA HECTOR FABIO",            cedula:"16493345",   cargo:"EST",          salarioMensual:1160000, activo:false },
  { orden:8,  nombre:"PALMA ANGULO AKON SAMUEL",         cedula:"1151443150", cargo:"O.V",          salarioMensual:1160000, activo:true },
  { orden:9,  nombre:"VIVEROS RIASCOS HERNANDO",         cedula:"16507408",   cargo:"EST",          salarioMensual:1160000, activo:true },
  { orden:10, nombre:"ARIAS PALACIOS CARLOS ALBERTO",    cedula:"16505544",   cargo:"ESTIBADOR",    salarioMensual:1160000, activo:true },
];

async function main() {
  const app = initializeApp(firebaseConfig);
  const db  = getFirestore(app);
  const col = collection(db, "nomina_fijo_c2");

  // Borrar existentes
  const snap = await getDocs(col);
  for (const d of snap.docs) await deleteDoc(d.ref);
  console.log("Limpiado coleccion nomina_fijo_c2");

  // Insertar nuevos
  for (const p of PERSONAL_FIJO) {
    await addDoc(col, { ...p, creadoEn: new Date(), actualizadoEn: new Date() });
    console.log("OK:", p.nombre, p.salarioMensual);
  }
  console.log("LISTO - Personal fijo sembrado en Firestore");
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
