import { useRouter } from "next/router";

export default function RegistroFotografico() {
  const router = useRouter();

  return (
    <div style={{ padding: "24px" }}>
      <h1 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "16px" }}>REGISTRO FOTOGRÁFICO</h1>
      <p>Aquí va el contenido del Registro Fotográfico.</p>
      <button style={{ marginTop: "16px" }} onClick={() => router.push("/")}>Regresar</button>
    </div>
  );
}
