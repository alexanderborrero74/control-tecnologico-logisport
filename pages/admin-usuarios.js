// pages/admin-usuarios.js
import { useState } from "react";
import { Users, Briefcase, Plus, Upload, Download, Trash2, Edit2, Check, X, Wrench, Lock, Eye, EyeOff, ShieldCheck, UserCheck } from "lucide-react";
import LayoutWithSidebar from "@/components/LayoutWithSidebar";
import PageHeader from "@/components/PageHeader";
import { useUsuarios, agregarUsuario, actualizarUsuario, eliminarUsuario, limpiarYReimportarUsuarios } from "@/utils/useUsuarios";
import { useCargos, agregarCargo, actualizarCargo, eliminarCargo, limpiarYReimportarCargos } from "@/utils/useCargos";
import { useTecnicos, agregarTecnico, actualizarTecnico, eliminarTecnico } from "@/utils/useTecnicos";
import { USUARIOS_BASE } from "@/utils/usuarios-base";
import { CARGOS_BASE } from "@/utils/cargos-base";
import { useAccesoModulos, guardarAccesoModulo, TODAS_LAS_PAGINAS } from "@/utils/useAccesoModulos";

export default function AdminUsuarios() {
  const [tabActiva, setTabActiva] = useState("usuarios");
  const { usuarios, loading: loadingUsuarios, recargar: recargarUsuarios } = useUsuarios();
  const { cargos, loading: loadingCargos, recargar: recargarCargos } = useCargos();
  const { tecnicos, loading: loadingTecnicos, recargar: recargarTecnicos } = useTecnicos();

  const [modalUsuario, setModalUsuario] = useState(false);
  const [modalCargo, setModalCargo] = useState(false);
  const [modalTecnico, setModalTecnico] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState(null);
  const [cargoEditando, setCargoEditando] = useState(null);
  const [tecnicoEditando, setTecnicoEditando] = useState(null);
  const [formUsuario, setFormUsuario] = useState({ nombre: "", email: "", cargo: "", rol: "usuario", activo: true });
  const [formCargo, setFormCargo] = useState({ nombre: "", activo: true });
  const [formTecnico, setFormTecnico] = useState({ nombre: "", email: "", empresa: "", activo: true });
  const [mensaje, setMensaje] = useState("");
  const { accesos, loading: loadingAccesos } = useAccesoModulos();
  const [moduloEditando, setModuloEditando] = useState(null); // módulo seleccionado para editar
  const [formAcceso, setFormAcceso] = useState({
    requiereContrasena: false,
    contrasena: "",
    correosAutorizados: "", // texto con correos separados por coma
  });
  const [verContrasena, setVerContrasena] = useState(false);
  const [guardandoAcceso, setGuardandoAcceso] = useState(false);

  // ============ USUARIOS ============
  const abrirModalUsuario = (usuario = null) => {
    if (usuario) {
      setUsuarioEditando(usuario);
      setFormUsuario({
        nombre: usuario.nombre || "",
        email: usuario.email || "",
        cargo: usuario.cargo || "",
        rol: usuario.rol || "usuario",
        activo: usuario.activo !== false,
      });
    } else {
      setUsuarioEditando(null);
      setFormUsuario({ nombre: "", email: "", cargo: "", rol: "usuario", activo: true });
    }
    setModalUsuario(true);
  };

  const guardarUsuario = async () => {
    try {
      if (usuarioEditando) {
        const result = await actualizarUsuario(usuarioEditando.id, formUsuario);
        if (result.success) {
          setMensaje("Usuario actualizado correctamente");
          recargarUsuarios();
          setModalUsuario(false);
        } else {
          setMensaje(`Error: ${result.error}`);
        }
      } else {
        const result = await agregarUsuario(formUsuario);
        if (result.success) {
          setMensaje("Usuario agregado correctamente");
          recargarUsuarios();
          setModalUsuario(false);
        } else {
          setMensaje(`Error: ${result.error}`);
        }
      }
      setTimeout(() => setMensaje(""), 3000);
    } catch (error) {
      console.error("❌❌❌ ERROR CAPTURADO EN guardarCargo ❌❌❌");
      console.error("Error completo:", error);
      console.error("Mensaje:", error.message);
      console.error("Stack:", error.stack);
      setMensaje(`Error: ${error.message}`);
      alert(`ERROR: ${error.message}`);
      setTimeout(() => setMensaje(""), 3000);
    }
  };

  const eliminarUsuarioConfirm = async (id) => {
    if (confirm("¿Estás seguro de eliminar este usuario?")) {
      const result = await eliminarUsuario(id);
      if (result.success) {
        setMensaje("Usuario eliminado correctamente");
        recargarUsuarios();
      } else {
        setMensaje(`Error: ${result.error}`);
      }
      setTimeout(() => setMensaje(""), 3000);
    }
  };

  const importarUsuariosBase = async () => {
    if (confirm("¿Deseas limpiar todos los usuarios actuales e importar la lista base? Esta acción no se puede deshacer.")) {
      const usuariosFormateados = USUARIOS_BASE.map(nombre => ({
        nombre,
        email: "",
        cargo: "",
        rol: "usuario",
        activo: true,
      }));
      const result = await limpiarYReimportarUsuarios(usuariosFormateados);
      if (result.success) {
        setMensaje(`Importación exitosa: ${result.importados} usuarios`);
        recargarUsuarios();
      } else {
        setMensaje(`Error: ${result.error}`);
      }
      setTimeout(() => setMensaje(""), 3000);
    }
  };

  // ============ CARGOS ============
  const abrirModalCargo = (cargo = null) => {
    if (cargo) {
      setCargoEditando(cargo);
      setFormCargo({
        nombre: cargo.nombre || "",
        activo: cargo.activo !== false,
      });
    } else {
      setCargoEditando(null);
      setFormCargo({ nombre: "", activo: true });
    }
    setModalCargo(true);
  };

  const guardarCargo = async () => {
    console.log("=== INICIO guardarCargo (admin-usuarios.js) ===");
    console.log("Editando:", cargoEditando);
    console.log("Form data:", formCargo);
    console.log("Tipo de cargoEditando:", typeof cargoEditando);
    console.log("cargoEditando es null?", cargoEditando === null);
    console.log("cargoEditando es falsy?", !cargoEditando);
    
    try {
      console.log("→ Entrando al try...");
      if (cargoEditando && cargoEditando.id) {
        console.log("→ RAMA: Editando cargo existente");
        const result = await actualizarCargo(cargoEditando.id, formCargo);
        if (result.success) {
          setMensaje("Cargo actualizado correctamente");
          recargarCargos();
          setModalCargo(false);
        } else {
          setMensaje(`Error: ${result.error}`);
        }
      } else {
        console.log("→ RAMA: Creando cargo nuevo");
        console.log("→ Nombre a guardar:", formCargo.nombre);
        console.log("→ Tipo de agregarCargo:", typeof agregarCargo);
        console.log("→ Llamando agregarCargo con:", formCargo.nombre);
        const result = await agregarCargo(formCargo.nombre);
        console.log("→ Resultado de agregarCargo:", result);
        
        if (result.success) {
          console.log("✅ Cargo agregado correctamente");
          setMensaje("Cargo agregado correctamente");
          recargarCargos();
          setModalCargo(false);
        } else {
          setMensaje(`Error: ${result.error}`);
        }
      }
      setTimeout(() => setMensaje(""), 3000);
    } catch (error) {
      setMensaje(`Error: ${error.message}`);
      setTimeout(() => setMensaje(""), 3000);
    }
  };

  const eliminarCargoConfirm = async (id) => {
    if (confirm("¿Estás seguro de eliminar este cargo?")) {
      const result = await eliminarCargo(id);
      if (result.success) {
        setMensaje("Cargo eliminado correctamente");
        recargarCargos();
      } else {
        setMensaje(`Error: ${result.error}`);
      }
      setTimeout(() => setMensaje(""), 3000);
    }
  };

  const importarCargosBase = async () => {
    if (confirm("¿Deseas limpiar todos los cargos actuales e importar la lista base? Esta acción no se puede deshacer.")) {
      const result = await limpiarYReimportarCargos(CARGOS_BASE);
      if (result.success) {
        setMensaje(`Importación exitosa: ${result.importados} cargos`);
        recargarCargos();
      } else {
        setMensaje(`Error: ${result.error}`);
      }
      setTimeout(() => setMensaje(""), 3000);
    }
  };

  // ============ TÉCNICOS ============
  const abrirModalTecnico = (tecnico = null) => {
    if (tecnico) {
      setTecnicoEditando(tecnico);
      setFormTecnico({
        nombre: tecnico.nombre || "",
        email: tecnico.email || "",
        empresa: tecnico.empresa || "",
        activo: tecnico.activo !== false,
      });
    } else {
      setTecnicoEditando(null);
      setFormTecnico({ nombre: "", email: "", empresa: "", activo: true });
    }
    setModalTecnico(true);
  };

  const guardarTecnico = async () => {
    try {
      if (tecnicoEditando) {
        const result = await actualizarTecnico(tecnicoEditando.id, formTecnico);
        if (result.success) {
          setMensaje("Técnico actualizado correctamente");
          recargarTecnicos();
          setModalTecnico(false);
        } else {
          setMensaje(`Error: ${result.error}`);
        }
      } else {
        const result = await agregarTecnico(formTecnico);
        if (result.success) {
          setMensaje("Técnico agregado correctamente");
          recargarTecnicos();
          setModalTecnico(false);
        } else {
          setMensaje(`Error: ${result.error}`);
        }
      }
      setTimeout(() => setMensaje(""), 3000);
    } catch (error) {
      setMensaje(`Error: ${error.message}`);
      setTimeout(() => setMensaje(""), 3000);
    }
  };

  // ============ ACCESOS Y CONTRASEÑAS ============
  const abrirEdicionModulo = (pagina) => {
    const cfg = accesos[pagina.id] || {};
    setModuloEditando(pagina);
    setFormAcceso({
      requiereContrasena: cfg.requiereContrasena || false,
      contrasena: cfg.contrasena || "",
      correosAutorizados: (cfg.correosAutorizados || []).join(", "),
    });
    setVerContrasena(false);
  };

  const guardarConfigAcceso = async () => {
    if (!moduloEditando) return;
    setGuardandoAcceso(true);
    try {
      const correosLista = formAcceso.correosAutorizados
        .split(",")
        .map(e => e.trim().toLowerCase())
        .filter(Boolean);
      await guardarAccesoModulo(moduloEditando.id, {
        ruta:                moduloEditando.ruta,
        nombre:              moduloEditando.nombre,
        categoria:           moduloEditando.categoria,
        requiereContrasena:  formAcceso.requiereContrasena,
        contrasena:          formAcceso.requiereContrasena ? formAcceso.contrasena : "",
        correosAutorizados:  correosLista,
        activo:              true,
      });
      setMensaje(`✅ Configuración guardada para "${moduloEditando.nombre}"`);
      setModuloEditando(null);
    } catch (err) {
      setMensaje(`Error: ${err.message}`);
    }
    setGuardandoAcceso(false);
    setTimeout(() => setMensaje(""), 3000);
  };

  const eliminarTecnicoConfirm = async (id) => {
    if (confirm("¿Estás seguro de eliminar este técnico?")) {
      const result = await eliminarTecnico(id);
      if (result.success) {
        setMensaje("Técnico eliminado correctamente");
        recargarTecnicos();
      } else {
        setMensaje(`Error: ${result.error}`);
      }
      setTimeout(() => setMensaje(""), 3000);
    }
  };

  return (
    <LayoutWithSidebar>
      <PageHeader titulo="Administración de Usuarios, Cargos y Técnicos" />

      {mensaje && (
        <div style={{
          background: mensaje.startsWith("Error") ? "#fee2e2" : "#d1fae5",
          color: mensaje.startsWith("Error") ? "#991b1b" : "#065f46",
          padding: "1rem",
          borderRadius: "8px",
          marginBottom: "1rem",
          fontWeight: "600",
        }}>
          {mensaje}
        </div>
      )}

      {/* TABS */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "2rem", borderBottom: "2px solid #e5e7eb" }}>
        <button
          onClick={() => setTabActiva("usuarios")}
          style={{
            padding: "0.75rem 1.5rem",
            border: "none",
            borderBottom: tabActiva === "usuarios" ? "3px solid #0B3D91" : "3px solid transparent",
            background: tabActiva === "usuarios" ? "rgba(11,61,145,0.05)" : "transparent",
            color: tabActiva === "usuarios" ? "#0B3D91" : "#6b7280",
            fontWeight: "700",
            cursor: "pointer",
            transition: "all 0.2s",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <Users size={20} />
          Usuarios ({usuarios.length})
        </button>
        <button
          onClick={() => setTabActiva("cargos")}
          style={{
            padding: "0.75rem 1.5rem",
            border: "none",
            borderBottom: tabActiva === "cargos" ? "3px solid #0B3D91" : "3px solid transparent",
            background: tabActiva === "cargos" ? "rgba(11,61,145,0.05)" : "transparent",
            color: tabActiva === "cargos" ? "#0B3D91" : "#6b7280",
            fontWeight: "700",
            cursor: "pointer",
            transition: "all 0.2s",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <Briefcase size={20} />
          Cargos ({cargos.length})
        </button>
        <button
          onClick={() => setTabActiva("tecnicos")}
          style={{
            padding: "0.75rem 1.5rem",
            border: "none",
            borderBottom: tabActiva === "tecnicos" ? "3px solid #0B3D91" : "3px solid transparent",
            background: tabActiva === "tecnicos" ? "rgba(11,61,145,0.05)" : "transparent",
            color: tabActiva === "tecnicos" ? "#0B3D91" : "#6b7280",
            fontWeight: "700",
            cursor: "pointer",
            transition: "all 0.2s",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <Wrench size={20} />
          Técnicos ({tecnicos.length})
        </button>
        <button
          onClick={() => setTabActiva("accesos")}
          style={{
            padding: "0.75rem 1.5rem",
            border: "none",
            borderBottom: tabActiva === "accesos" ? "3px solid #f97316" : "3px solid transparent",
            background: tabActiva === "accesos" ? "rgba(249,115,22,0.05)" : "transparent",
            color: tabActiva === "accesos" ? "#f97316" : "#6b7280",
            fontWeight: "700",
            cursor: "pointer",
            transition: "all 0.2s",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <Lock size={20} />
          Accesos y Contraseñas
        </button>
      </div>

      {/* TAB USUARIOS */}
      {tabActiva === "usuarios" && (
        <div>
          <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
            <button
              onClick={() => abrirModalUsuario()}
              style={{
                padding: "0.75rem 1.5rem",
                background: "linear-gradient(180deg, #0B3D91, #082d6b)",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontWeight: "700",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <Plus size={20} />
              Nuevo Usuario
            </button>
            <button
              onClick={importarUsuariosBase}
              style={{
                padding: "0.75rem 1.5rem",
                background: "#10b981",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontWeight: "700",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <Upload size={20} />
              Importar Usuarios Base
            </button>
          </div>

          {loadingUsuarios ? (
            <p>Cargando usuarios...</p>
          ) : (
            <div className="table" style={{ borderRadius: "12px", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "linear-gradient(180deg, #f3f6ff, #eef2ff)" }}>
                    <th style={{ padding: "1rem", textAlign: "left", fontWeight: "800" }}>Nombre</th>
                    <th style={{ padding: "1rem", textAlign: "left", fontWeight: "800" }}>Email</th>
                    <th style={{ padding: "1rem", textAlign: "left", fontWeight: "800" }}>Cargo</th>
                    <th style={{ padding: "1rem", textAlign: "left", fontWeight: "800" }}>Rol</th>
                    <th style={{ padding: "1rem", textAlign: "center", fontWeight: "800" }}>Estado</th>
                    <th style={{ padding: "1rem", textAlign: "center", fontWeight: "800" }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((usuario) => (
                    <tr key={usuario.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                      <td style={{ padding: "1rem" }}>{usuario.nombre}</td>
                      <td style={{ padding: "1rem" }}>{usuario.email}</td>
                      <td style={{ padding: "1rem" }}>{usuario.cargo}</td>
                      <td style={{ padding: "1rem" }}>
                        <span style={{
                          padding: "0.25rem 0.75rem",
                          borderRadius: "9999px",
                          fontSize: "0.75rem",
                          fontWeight: "600",
                          background: usuario.rol === "admin" ? "#dbeafe" : "#f3f4f6",
                          color: usuario.rol === "admin" ? "#1e40af" : "#374151",
                        }}>
                          {usuario.rol}
                        </span>
                      </td>
                      <td style={{ padding: "1rem", textAlign: "center" }}>
                        {usuario.activo !== false ? (
                          <span style={{ color: "#10b981", fontWeight: "600" }}>✓ Activo</span>
                        ) : (
                          <span style={{ color: "#ef4444", fontWeight: "600" }}>✗ Inactivo</span>
                        )}
                      </td>
                      <td style={{ padding: "1rem", textAlign: "center" }}>
                        <button
                          onClick={() => abrirModalUsuario(usuario)}
                          style={{
                            padding: "0.5rem",
                            background: "#60a5fa",
                            color: "#fff",
                            border: "none",
                            borderRadius: "6px",
                            cursor: "pointer",
                            marginRight: "0.5rem",
                          }}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => eliminarUsuarioConfirm(usuario.id)}
                          style={{
                            padding: "0.5rem",
                            background: "#ef4444",
                            color: "#fff",
                            border: "none",
                            borderRadius: "6px",
                            cursor: "pointer",
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB CARGOS */}
      {tabActiva === "cargos" && (
        <div>
          <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
            <button
              onClick={abrirModalCargo}
              style={{
                padding: "0.75rem 1.5rem",
                background: "linear-gradient(180deg, #0B3D91, #082d6b)",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontWeight: "700",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <Plus size={20} />
              Nuevo Cargo
            </button>
            <button
              onClick={importarCargosBase}
              style={{
                padding: "0.75rem 1.5rem",
                background: "#10b981",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontWeight: "700",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <Upload size={20} />
              Importar Cargos Base
            </button>
          </div>

          {loadingCargos ? (
            <p>Cargando cargos...</p>
          ) : cargos.length === 0 ? (
            <div style={{
              padding: "3rem",
              textAlign: "center",
              background: "#f9fafb",
              borderRadius: "12px",
              border: "2px dashed #d1d5db",
            }}>
              <p style={{ color: "#6b7280", marginBottom: "1rem" }}>No hay cargos registrados</p>
              <button
                onClick={abrirModalCargo}
                style={{
                  padding: "0.75rem 1.5rem",
                  background: "#0B3D91",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: "700",
                  cursor: "pointer",
                }}
              >
                Crear primer cargo
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "1rem" }}>
              {cargos.map((cargo) => (
                <div
                  key={cargo.id}
                  style={{
                    background: "#fff",
                    padding: "1.5rem",
                    borderRadius: "12px",
                    border: "1px solid #e5e7eb",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "0.75rem" }}>
                    <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: "700", color: "#0B3D91" }}>
                      {cargo.nombre}
                    </h3>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        onClick={() => abrirModalCargo(cargo)}
                        style={{
                          padding: "0.25rem",
                          background: "#dbeafe",
                          color: "#1e40af",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                        }}
                        title="Editar cargo"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => eliminarCargoConfirm(cargo.id)}
                        style={{
                          padding: "0.25rem",
                          background: "#fee2e2",
                          color: "#dc2626",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                        }}
                        title="Eliminar cargo"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div>
                    {cargo.activo !== false ? (
                      <span style={{
                        padding: "0.25rem 0.75rem",
                        borderRadius: "9999px",
                        fontSize: "0.75rem",
                        fontWeight: "600",
                        background: "#d1fae5",
                        color: "#065f46",
                      }}>
                        Activo
                      </span>
                    ) : (
                      <span style={{
                        padding: "0.25rem 0.75rem",
                        borderRadius: "9999px",
                        fontSize: "0.75rem",
                        fontWeight: "600",
                        background: "#fee2e2",
                        color: "#991b1b",
                      }}>
                        Inactivo
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB TÉCNICOS */}
      {tabActiva === "tecnicos" && (
        <div>
          <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
            <button
              onClick={() => abrirModalTecnico()}
              style={{
                padding: "0.75rem 1.5rem",
                background: "linear-gradient(180deg, #0B3D91, #082d6b)",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontWeight: "700",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <Plus size={20} />
              Nuevo Técnico
            </button>
          </div>

          {loadingTecnicos ? (
            <p>Cargando técnicos...</p>
          ) : (
            <div style={{ borderRadius: "12px", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff" }}>
                <thead>
                  <tr style={{ background: "linear-gradient(180deg, #f3f6ff, #eef2ff)" }}>
                    <th style={{ padding: "1rem", textAlign: "left", fontWeight: "800" }}>Nombre</th>
                    <th style={{ padding: "1rem", textAlign: "left", fontWeight: "800" }}>Email</th>
                    <th style={{ padding: "1rem", textAlign: "left", fontWeight: "800" }}>Empresa</th>
                    <th style={{ padding: "1rem", textAlign: "center", fontWeight: "800" }}>Estado</th>
                    <th style={{ padding: "1rem", textAlign: "center", fontWeight: "800" }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {tecnicos.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ padding: "2rem", textAlign: "center", color: "#6b7280" }}>
                        No hay técnicos registrados
                      </td>
                    </tr>
                  ) : (
                    tecnicos.map((tecnico) => (
                      <tr key={tecnico.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                        <td style={{ padding: "1rem" }}>{tecnico.nombre}</td>
                        <td style={{ padding: "1rem" }}>{tecnico.email}</td>
                        <td style={{ padding: "1rem" }}>{tecnico.empresa || "—"}</td>
                        <td style={{ padding: "1rem", textAlign: "center" }}>
                          {tecnico.activo !== false ? (
                            <span style={{ color: "#10b981", fontWeight: "600" }}>✓ Activo</span>
                          ) : (
                            <span style={{ color: "#ef4444", fontWeight: "600" }}>✗ Inactivo</span>
                          )}
                        </td>
                        <td style={{ padding: "1rem", textAlign: "center" }}>
                          <button
                            onClick={() => abrirModalTecnico(tecnico)}
                            style={{
                              padding: "0.5rem",
                              background: "#60a5fa",
                              color: "#fff",
                              border: "none",
                              borderRadius: "6px",
                              cursor: "pointer",
                              marginRight: "0.5rem",
                            }}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => eliminarTecnicoConfirm(tecnico.id)}
                            style={{
                              padding: "0.5rem",
                              background: "#ef4444",
                              color: "#fff",
                              border: "none",
                              borderRadius: "6px",
                              cursor: "pointer",
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL USUARIO */}
      {modalUsuario && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
          onClick={() => setModalUsuario(false)}
        >
          <div
            style={{
              background: "#fff",
              padding: "2rem",
              borderRadius: "16px",
              width: "min(500px, 90vw)",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0, color: "#0B3D91" }}>
              {usuarioEditando ? "Editar Usuario" : "Nuevo Usuario"}
            </h2>
            
            <div style={{ display: "grid", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>
                  Nombre <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="text"
                  value={formUsuario.nombre}
                  onChange={(e) => setFormUsuario({ ...formUsuario, nombre: e.target.value })}
                  required
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1.5px solid #d9e2f1",
                    borderRadius: "8px",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>
                  Email
                </label>
                <input
                  type="email"
                  value={formUsuario.email}
                  onChange={(e) => setFormUsuario({ ...formUsuario, email: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1.5px solid #d9e2f1",
                    borderRadius: "8px",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>
                  Cargo
                </label>
                <input
                  type="text"
                  value={formUsuario.cargo}
                  onChange={(e) => setFormUsuario({ ...formUsuario, cargo: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1.5px solid #d9e2f1",
                    borderRadius: "8px",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>
                  Rol
                </label>
                <select
                  value={formUsuario.rol}
                  onChange={(e) => setFormUsuario({ ...formUsuario, rol: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1.5px solid #d9e2f1",
                    borderRadius: "8px",
                  }}
                >
                  <option value="usuario">Usuario</option>
                  <option value="admin">Admin</option>
                  <option value="owner">Owner</option>
                </select>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input
                  type="checkbox"
                  checked={formUsuario.activo}
                  onChange={(e) => setFormUsuario({ ...formUsuario, activo: e.target.checked })}
                  style={{ width: "20px", height: "20px" }}
                />
                <label style={{ fontWeight: "600" }}>Activo</label>
              </div>
            </div>

            <div style={{ display: "flex", gap: "1rem", marginTop: "1.5rem" }}>
              <button
                onClick={() => setModalUsuario(false)}
                style={{
                  flex: 1,
                  padding: "0.75rem",
                  background: "#f3f4f6",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: "700",
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={guardarUsuario}
                style={{
                  flex: 1,
                  padding: "0.75rem",
                  background: "#0B3D91",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: "700",
                  cursor: "pointer",
                }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CARGO */}
      {modalCargo && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
          onClick={() => setModalCargo(false)}
        >
          <div
            style={{
              background: "#fff",
              padding: "2rem",
              borderRadius: "16px",
              width: "min(400px, 90vw)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0, color: "#0B3D91" }}>
              {cargoEditando ? "Editar Cargo" : "Nuevo Cargo"}
            </h2>
            
            <div style={{ display: "grid", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>
                  Nombre <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="text"
                  value={formCargo.nombre}
                  onChange={(e) => setFormCargo({ ...formCargo, nombre: e.target.value })}
                  required
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1.5px solid #d9e2f1",
                    borderRadius: "8px",
                  }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input
                  type="checkbox"
                  checked={formCargo.activo}
                  onChange={(e) => setFormCargo({ ...formCargo, activo: e.target.checked })}
                  style={{ width: "20px", height: "20px" }}
                />
                <label style={{ fontWeight: "600" }}>Activo</label>
              </div>
            </div>

            <div style={{ display: "flex", gap: "1rem", marginTop: "1.5rem" }}>
              <button
                onClick={() => setModalCargo(false)}
                style={{
                  flex: 1,
                  padding: "0.75rem",
                  background: "#f3f4f6",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: "700",
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={guardarCargo}
                style={{
                  flex: 1,
                  padding: "0.75rem",
                  background: "#0B3D91",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: "700",
                  cursor: "pointer",
                }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB ACCESOS Y CONTRASEÑAS */}
      {tabActiva === "accesos" && (
        <div>
          <div style={{ marginBottom: "1.5rem", padding: "1rem 1.25rem", background: "#fff7ed", borderRadius: "12px", border: "1px solid #fed7aa" }}>
            <p style={{ margin: 0, color: "#9a3412", fontWeight: "600", fontSize: "0.88rem" }}>
              🔒 Configura para cada página: si requiere contraseña para ingresar, cuál es la contraseña,
              y qué correos verán el <strong>acceso directo</strong> en el dashboard principal.
            </p>
          </div>

          {/* Lista de páginas agrupadas por categoría */}
          {["Facilidad de Acceso", "Nómina", "Control TI"].map(cat => {
            // Mostramos "Nómina" primero, luego el resto
            const categorias = ["Nómina", "Control TI"];
            return categorias;
          })[0].map(categoria => (
            <div key={categoria} style={{ marginBottom: "2rem" }}>
              <h3 style={{ color: "#0B3D91", borderBottom: "2px solid #e2e8f0", paddingBottom: "0.5rem", marginBottom: "1rem",
                display: "flex", alignItems: "center", gap: "0.5rem" }}>
                {categoria === "Nómina" ? "💰" : "💻"} {categoria}
              </h3>
              <div style={{ display: "grid", gap: "0.6rem" }}>
                {TODAS_LAS_PAGINAS.filter(p => p.categoria === categoria).map(pagina => {
                  const cfg = accesos[pagina.id] || {};
                  const tieneContrasena = cfg.requiereContrasena;
                  const numCorreos = (cfg.correosAutorizados || []).length;
                  return (
                    <div key={pagina.id} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "0.85rem 1.1rem", background: "#fff", borderRadius: "10px",
                      border: `1px solid ${tieneContrasena ? "#fbbf24" : "#e2e8f0"}`,
                      boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                      flexWrap: "wrap", gap: "0.5rem",
                    }}>
                      <div style={{ flex: 1, minWidth: "200px" }}>
                        <div style={{ fontWeight: "700", color: "#1e293b", fontSize: "0.9rem" }}>{pagina.nombre}</div>
                        <div style={{ fontSize: "0.75rem", color: "#94a3b8", fontFamily: "monospace" }}>{pagina.ruta}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                        {tieneContrasena && (
                          <span style={{ padding: "0.2rem 0.6rem", background: "#fef3c7", color: "#92400e",
                            borderRadius: "6px", fontSize: "0.72rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                            <Lock size={11}/> Con contraseña
                          </span>
                        )}
                        {numCorreos > 0 && (
                          <span style={{ padding: "0.2rem 0.6rem", background: "#dbeafe", color: "#1e40af",
                            borderRadius: "6px", fontSize: "0.72rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                            <UserCheck size={11}/> {numCorreos} correo{numCorreos !== 1 ? "s" : ""}
                          </span>
                        )}
                        {!tieneContrasena && numCorreos === 0 && (
                          <span style={{ color: "#94a3b8", fontSize: "0.75rem" }}>Sin configurar</span>
                        )}
                        <button onClick={() => abrirEdicionModulo(pagina)} style={{
                          padding: "0.4rem 0.9rem", background: "#0B3D91", color: "#fff",
                          border: "none", borderRadius: "7px", cursor: "pointer",
                          fontWeight: "700", fontSize: "0.78rem", display: "flex", alignItems: "center", gap: "0.3rem",
                        }}>
                          <Edit2 size={13}/> Configurar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL EDITAR ACCESO DE MÓDULO */}
      {moduloEditando && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", display:"flex",
          alignItems:"center", justifyContent:"center", zIndex:9999 }}>
          <div style={{ background:"#fff", borderRadius:"16px", padding:"2rem", width:"min(520px,92vw)",
            boxShadow:"0 20px 60px rgba(0,0,0,0.25)", maxHeight:"90vh", overflowY:"auto" }}>
            <h2 style={{ marginTop:0, color:"#0B3D91", fontSize:"1.15rem", display:"flex", alignItems:"center", gap:"0.5rem" }}>
              <Lock size={20}/> {moduloEditando.nombre}
            </h2>
            <div style={{ fontSize:"0.78rem", color:"#94a3b8", marginBottom:"1.5rem", fontFamily:"monospace" }}>
              {moduloEditando.ruta}
            </div>

            {/* Requiere contraseña */}
            <div style={{ marginBottom:"1.25rem", padding:"1rem", background:"#f8fafc", borderRadius:"10px", border:"1px solid #e2e8f0" }}>
              <label style={{ display:"flex", alignItems:"center", gap:"0.7rem", cursor:"pointer" }}>
                <input type="checkbox" checked={formAcceso.requiereContrasena}
                  onChange={e => setFormAcceso(f => ({ ...f, requiereContrasena: e.target.checked }))}
                  style={{ width:"18px", height:"18px", accentColor:"#f97316", cursor:"pointer" }}/>
                <div>
                  <div style={{ fontWeight:"700", color:"#1e293b" }}>Requiere contraseña para ingresar</div>
                  <div style={{ fontSize:"0.78rem", color:"#64748b" }}>Muestra un modal de contraseña antes de entrar a esta página</div>
                </div>
              </label>
            </div>

            {/* Contraseña */}
            {formAcceso.requiereContrasena && (
              <div style={{ marginBottom:"1.25rem" }}>
                <label style={{ display:"block", marginBottom:"0.4rem", fontWeight:"700", fontSize:"0.85rem" }}>Contraseña de acceso</label>
                <div style={{ position:"relative" }}>
                  <input type={verContrasena ? "text" : "password"}
                    value={formAcceso.contrasena}
                    onChange={e => setFormAcceso(f => ({ ...f, contrasena: e.target.value }))}
                    placeholder="Ingresa la contraseña..."
                    style={{ width:"100%", padding:"0.75rem 3rem 0.75rem 0.9rem",
                      border:"1.5px solid #e2e8f0", borderRadius:"9px",
                      fontSize:"0.95rem", outline:"none", boxSizing:"border-box" }}/>
                  <button onClick={() => setVerContrasena(v => !v)}
                    style={{ position:"absolute", right:"0.75rem", top:"50%", transform:"translateY(-50%)",
                      background:"none", border:"none", cursor:"pointer", color:"#94a3b8", padding:"0.2rem" }}>
                    {verContrasena ? <EyeOff size={17}/> : <Eye size={17}/>}
                  </button>
                </div>
              </div>
            )}

            {/* Correos con acceso directo */}
            <div style={{ marginBottom:"1.5rem" }}>
              <label style={{ display:"block", marginBottom:"0.4rem", fontWeight:"700", fontSize:"0.85rem" }}>
                <UserCheck size={15} style={{ verticalAlign:"middle", marginRight:"4px" }}/>
                Correos con acceso directo en dashboard
              </label>
              <textarea
                value={formAcceso.correosAutorizados}
                onChange={e => setFormAcceso(f => ({ ...f, correosAutorizados: e.target.value }))}
                placeholder="correo1@empresa.com, correo2@empresa.com, ..."
                rows={3}
                style={{ width:"100%", padding:"0.75rem", border:"1.5px solid #e2e8f0",
                  borderRadius:"9px", fontSize:"0.85rem", outline:"none",
                  boxSizing:"border-box", resize:"vertical", fontFamily:"inherit" }}/>
              <div style={{ fontSize:"0.73rem", color:"#94a3b8", marginTop:"0.3rem" }}>
                Separa los correos con coma. Solo estos usuarios verán el acceso directo en la página principal.
              </div>
            </div>

            <div style={{ display:"flex", gap:"0.75rem" }}>
              <button onClick={() => setModuloEditando(null)}
                style={{ flex:1, padding:"0.8rem", background:"#f1f5f9", border:"none", borderRadius:"10px",
                  fontWeight:"700", cursor:"pointer", color:"#475569" }}>Cancelar</button>
              <button onClick={guardarConfigAcceso} disabled={guardandoAcceso}
                style={{ flex:2, padding:"0.8rem",
                  background: guardandoAcceso ? "#e2e8f0" : "linear-gradient(135deg, #0B3D91, #00AEEF)",
                  border:"none", borderRadius:"10px", fontWeight:"800",
                  cursor: guardandoAcceso ? "not-allowed" : "pointer", color:"#fff",
                  display:"flex", alignItems:"center", justifyContent:"center", gap:"0.5rem",
                  boxShadow: guardandoAcceso ? "none" : "0 4px 12px rgba(11,61,145,0.3)" }}>
                <ShieldCheck size={17}/> {guardandoAcceso ? "Guardando..." : "Guardar configuración"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TÉCNICOS */}
      {modalTecnico && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
        }}>
          <div style={{
            background: "#fff",
            borderRadius: "12px",
            padding: "2rem",
            maxWidth: "500px",
            width: "90%",
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          }}>
            <h2 style={{ marginTop: 0, color: "#0B3D91" }}>
              {tecnicoEditando ? "Editar Técnico" : "Nuevo Técnico"}
            </h2>

            <div style={{ display: "grid", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>
                  Nombre *
                </label>
                <input
                  type="text"
                  value={formTecnico.nombre}
                  onChange={(e) => setFormTecnico({ ...formTecnico, nombre: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #d1d5db",
                    borderRadius: "8px",
                  }}
                  placeholder="Nombre del técnico"
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>
                  Email *
                </label>
                <input
                  type="email"
                  value={formTecnico.email}
                  onChange={(e) => setFormTecnico({ ...formTecnico, email: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #d1d5db",
                    borderRadius: "8px",
                  }}
                  placeholder="correo@empresa.com"
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>
                  Empresa
                </label>
                <input
                  type="text"
                  value={formTecnico.empresa}
                  onChange={(e) => setFormTecnico({ ...formTecnico, empresa: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #d1d5db",
                    borderRadius: "8px",
                  }}
                  placeholder="Empresa del técnico"
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input
                  type="checkbox"
                  checked={formTecnico.activo}
                  onChange={(e) => setFormTecnico({ ...formTecnico, activo: e.target.checked })}
                  style={{ width: "20px", height: "20px" }}
                />
                <label style={{ fontWeight: "600" }}>Activo</label>
              </div>
            </div>

            <div style={{ display: "flex", gap: "1rem", marginTop: "1.5rem" }}>
              <button
                onClick={() => setModalTecnico(false)}
                style={{
                  flex: 1,
                  padding: "0.75rem",
                  background: "#f3f4f6",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: "700",
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={guardarTecnico}
                style={{
                  flex: 1,
                  padding: "0.75rem",
                  background: "#0B3D91",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: "700",
                  cursor: "pointer",
                }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </LayoutWithSidebar>
  );
}
