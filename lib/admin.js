// lib/admin.js
import admin from 'firebase-admin';

let _inited = false;

function ensureInit() {
  if (_inited) return;
  
  if (!admin.apps.length) {
    const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
    if (!b64) throw new Error('FIREBASE_SERVICE_ACCOUNT_BASE64 no está definido');
    
    const json = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    
    admin.initializeApp({ 
      credential: admin.credential.cert(json),
      storageBucket: 'ti-logisport-sas.appspot.com'
    });
  }
  
  _inited = true;
}

export function getFirestore() {
  ensureInit();
  return admin.firestore();
}

export function getAdmin() {
  ensureInit();
  return admin;
}
