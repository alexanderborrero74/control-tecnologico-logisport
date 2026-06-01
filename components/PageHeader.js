// components/PageHeader.js
export default function PageHeader({ title, subtitle, icon: Icon }) {
  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: "800", color: "#0B3D91", margin: 0 }}>
        {Icon && <Icon size={22} style={{ marginRight: "0.5rem", verticalAlign: "middle" }} />}
        {title}
      </h1>
      {subtitle && <p style={{ color: "#64748b", margin: "0.25rem 0 0", fontSize: "0.9rem" }}>{subtitle}</p>}
    </div>
  );
}
