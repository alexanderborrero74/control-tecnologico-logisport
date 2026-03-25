import { useRouter } from "next/router";
import LayoutWithSidebar from "@/components/LayoutWithSidebar";
import PageHeader from "@/components/PageHeader";

export default function Serviciospendientes() {
  const router = useRouter();

  return (
    <LayoutWithSidebar>
      <PageHeader titulo="Serviciospendientes" />
  <div style={{ padding: "24px" }}>
      <h1 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "16px" }}>SERVICIOS PENDIENTES</h1>
      <p>Aquí va los servicios pendientes.</p>

    </div>
  </LayoutWithSidebar>
  );
}
