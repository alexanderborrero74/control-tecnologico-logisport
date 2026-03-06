// pages/nomina/clientes.js
// Esta página fue reemplazada por la pestaña Clientes en /nomina/administrar
import { useEffect } from "react";
import { useRouter } from "next/router";

export default function ClientesRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/nomina/administrar");
  }, []);
  return null;
}
