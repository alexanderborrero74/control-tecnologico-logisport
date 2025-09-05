// utils/getUserRole.js
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";

export async function getUserRoleByUid(uid) {
  if (!uid) return "usuario";
  const ref = doc(db, "usuarios", uid);
  const snap = await getDoc(ref);

  let rol = "usuario";
  if (snap.exists()) {
    const raw = snap.data().rol;
    if (raw) {
      let r = String(raw).toLowerCase().trim();
      if (["admin","administracion","administración","administrator","adm"].includes(r)) {
        rol = "admin";
      } else {
        rol = "usuario";
      }
    }
  }
  return rol;
}
