// pages/_app.js
import "@/styles/globals.css";
import "react-datepicker/dist/react-datepicker.css";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import Head from "next/head";
import GateModulo from "@/components/GateModulo";

/* ========== Cargar asistente sin SSR ========== */
const GuiaBienvenida = dynamic(
  () => import("@/components/GuiaBienvenida").then(m => m.default || m),
  { ssr: false }
);

/* ========= Fondo del MENÚ PRINCIPAL =========
   Aplica body.menu-home solo en rutas de menú.
   Login NUNCA lleva fondo de menú.
*/
const MENU_HOME_ROUTES = [
  "/",
  "/home",
  "/inicio",
  "/menu",
  "/menu-principal",
  "/menu-admin",
  "/admin",
  "/dashboard",
];
const EXCLUDE_ROUTES = ["/login"];

export default function MyApp({ Component, pageProps }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // Desactivar traducción automática del navegador
  useEffect(() => {
    try {
      document.documentElement.setAttribute("lang", "es");
      document.documentElement.setAttribute("translate", "no");
      document.documentElement.classList.add("notranslate");
    } catch {}
  }, []);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const path = router.pathname || "";
    const isExcluded = EXCLUDE_ROUTES.includes(path);
    const isMenuHome = MENU_HOME_ROUTES.includes(path);

    if (!isExcluded && isMenuHome) {
      document.body.classList.add("menu-home");
    } else {
      document.body.classList.remove("menu-home");
    }

    return () => {
      document.body.classList.remove("menu-home");
    };
  }, [router.pathname]);

  return (
    <>
      <Head>
        <meta name="google" content="notranslate" />
        <meta httpEquiv="Content-Language" content="es" />
      </Head>

      <GateModulo>
        <Component {...pageProps} />
      </GateModulo>

      {mounted && <GuiaBienvenida />}
    </>
  );
}
