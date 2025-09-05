// firebase/firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBNMXiEGcgp9bHWNPhqaBH_cAcATEZwI8M",
  authDomain: "ti-logisport-sas.firebaseapp.com",
  projectId: "ti-logisport-sas",
  storageBucket: "ti-logisport-sas.firebasestorage.app",
  messagingSenderId: "111655171359",
  appId: "1:111655171359:web:030e6831424e8d056fac2a"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
