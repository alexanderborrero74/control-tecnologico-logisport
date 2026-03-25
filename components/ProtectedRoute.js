// components/ProtectedRoute.js
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getUserRoleByUid, tieneAcceso } from "@/utils/getUserRole";

export default function ProtectedRoute({ children }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [autorizado, setAutorizado] = useState(false);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      try {
        const rol = await getUserRoleByUid(user.uid);
        const tienePermisos = tieneAcceso(rol, router.pathname);

        if (!tienePermisos) {
          // Redirigir según el rol
          if (rol === "tecnico") {
            router.push("/servicios-tecnicos");
          } else if (rol === "auditor") {
            router.push("/indicadores-gestion");
          } else {
            router.push("/");
          }
          return;
        }

        setAutorizado(true);
      } catch (error) {
        console.error("Error verificando permisos:", error);
        router.push("/");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router.pathname]);

  if (loading) {
    return (
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        background: "#f5f7fb"
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: "60px",
            height: "60px",
            border: "4px solid #e5e7eb",
            borderTop: "4px solid #0B3D91",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
            margin: "0 auto 1rem"
          }} />
          <p style={{ color: "#6b7280", fontWeight: "600" }}>Verificando permisos...</p>
        </div>
        <style jsx>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!autorizado) {
    return null;
  }

  return children;
}
