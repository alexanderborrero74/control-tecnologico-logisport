// utils/catalogs.js
import app from "@/firebase/firebaseConfig";
import {
  collection, doc, setDoc, serverTimestamp, onSnapshot, getFirestore,
} from "firebase/firestore";

const db = getFirestore(app);

// Colecciones centrales
const MAP = {
  cargo: "catalog_cargos",
  pc: "catalog_pcs",
  usuario: "catalog_usuarios",
};

// id “slug” para evitar duplicados
export function slugify(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Inserta/actualiza un valor en el catálogo correspondiente
export async function addToCatalog(kind, value) {
  const col = MAP[kind];
  if (!col) return;
  const name = String(value || "").trim();
  if (!name) return;
  const id = slugify(name);
  await setDoc(
    doc(collection(db, col), id),
    { name, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

// Inserta varios de una
export async function addManyToCatalog({ cargo, pc, usuario }) {
  const ops = [];
  if (cargo) ops.push(addToCatalog("cargo", cargo));
  if (pc) ops.push(addToCatalog("pc", pc));
  if (usuario) ops.push(addToCatalog("usuario", usuario));
  await Promise.all(ops);
}

// Suscribirse a los catálogos
export function watchCatalogs({ onCargos, onPcs, onUsuarios }) {
  const unsubs = [];
  if (onCargos) {
    unsubs.push(
      onSnapshot(collection(db, MAP.cargo), (snap) => {
        const arr = snap.docs
          .map((d) => d.data()?.name)
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
        onCargos(arr);
      })
    );
  }
  if (onPcs) {
    unsubs.push(
      onSnapshot(collection(db, MAP.pc), (snap) => {
        const arr = snap.docs
          .map((d) => d.data()?.name)
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
        onPcs(arr);
      })
    );
  }
  if (onUsuarios) {
    unsubs.push(
      onSnapshot(collection(db, MAP.usuario), (snap) => {
        const arr = snap.docs
          .map((d) => d.data()?.name)
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
        onUsuarios(arr);
      })
    );
  }
  return () => unsubs.forEach((u) => u && u());
}
