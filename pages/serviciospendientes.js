import { useRouter } from "next/router";

export default function Serviciospendientes() {
  const router = useRouter();

  return (
    <div style={{ padding: "24px" }}>
      <h1 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "16px" }}>SERVICIOS PENDIENTES</h1>
      <p>Aquí va los servicios pendientes.</p>
      <button style={{ marginTop: "16px" }} onClick={() => router.push("/")}>Regresar</button>
    </div>
  );
}
