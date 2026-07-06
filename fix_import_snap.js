const fs = require('fs');
const path = 'pages/nomina/matriz.js';
let c = fs.readFileSync(path,'utf8');

// Verificar estado actual del import
const hasOnSnapshot = c.includes('onSnapshot');
console.log('onSnapshot en archivo:', hasOnSnapshot);

// Forzar el import correcto buscando el bloque exacto
const idx = c.indexOf('collection, getDocs, addDoc, updateDoc, deleteDoc,');
if(idx !== -1){
  const lineEnd = c.indexOf('\n', idx + 100);
  const importLine = c.substring(idx, lineEnd);
  console.log('Linea import encontrada:', importLine);
  
  if(!importLine.includes('onSnapshot')){
    // Agregar onSnapshot al final de la segunda línea del import
    const fixed = c.replace(
      'doc, getDoc, setDoc, query, orderBy, where, Timestamp\n} from "firebase/firestore";',
      'doc, getDoc, setDoc, query, orderBy, where, Timestamp, onSnapshot\n} from "firebase/firestore";'
    );
    if(fixed !== c){
      c = fixed;
      console.log('OK - onSnapshot agregado al import');
    } else {
      // Intentar otra variante
      c = c.replace(
        'doc, getDoc, setDoc, query, orderBy, where, Timestamp\r\n} from "firebase/firestore";',
        'doc, getDoc, setDoc, query, orderBy, where, Timestamp, onSnapshot\r\n} from "firebase/firestore";'
      );
      console.log('OK - onSnapshot agregado (variante CR/LF)');
    }
  } else {
    console.log('onSnapshot ya está en el import');
  }
} else {
  console.log('ERROR - no se encontró el bloque de imports');
}

fs.writeFileSync(path, c, 'utf8');

// Verificar resultado
const check = require('fs').readFileSync(path,'utf8');
const lines = check.split('\n');
for(let i=6;i<12;i++) console.log((i+1)+': '+lines[i]);
