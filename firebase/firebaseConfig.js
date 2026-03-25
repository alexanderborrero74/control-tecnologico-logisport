// firebase/firebaseConfig.js
import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBNMXiEGcgp9bHWNPhqaBH_cAcATEZwI8M",
  authDomain: "ti-logisport-sas.firebaseapp.com",
  projectId: "ti-logisport-sas",
  // ⚠️ El bucket por defecto es *.appspot.com (no *.firebasestorage.app)
  storageBucket: "ti-logisport-sas.appspot.com",
  messagingSenderId: "111655171359",
  appId: "1:111655171359:web:030e6831424e8d056fac2a",
};

// Evita re-inicializar en dev/hot-reload
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Instancias listas
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Exporta en ambos estilos para que tu código actual no falle
export { app, auth, db, storage };
export default app;
