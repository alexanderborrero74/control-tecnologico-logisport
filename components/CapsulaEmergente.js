// components/CapsulaEmergente.js
import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";

export default function CapsulaEmergente() {
  const [capsulaVisible, setCapsulaVisible] = useState(false);
  const [mensajeCapsula, setMensajeCapsula] = useState("");
  const [listaCapsulas, setListaCapsulas] = useState([]);

  useEffect(() => {
    const unsubscribeCapsulas = onSnapshot(collection(db, "capsulas"), (snapshot) => {
      const mensajes = snapshot.docs.map((doc) => doc.data().mensaje);
      setListaCapsulas(mensajes);
    });
    return () => unsubscribeCapsulas();
  }, []);

  useEffect(() => {
  if (listaCapsulas.length > 0) {
    mostrarCapsula();
    const intervalo = setInterval(() => {
      mostrarCapsula();
    }, 30 * 1000); // cada 30 segundos
    return () => clearInterval(intervalo);
  }
}, [listaCapsulas]);


  const mostrarCapsula = () => {
    const random = Math.floor(Math.random() * listaCapsulas.length);
    setMensajeCapsula(listaCapsulas[random]);
    setCapsulaVisible(true);
    setTimeout(() => setCapsulaVisible(false), 8000);
  };

  if (!capsulaVisible) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: 120,
      left: 20,
      backgroundColor: "#fffae6",
      padding: 16,
      borderRadius: 8,
      boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
      zIndex: 1500,
      maxWidth: 300
    }}>
      <strong>💡 Ciberseguridad:</strong>
      <p>{mensajeCapsula}</p>
    </div>
  );
}
