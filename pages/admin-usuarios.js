// pages/admin-usuarios.js
import { useState, useEffect, useRef } from "react";
import { Users, Briefcase, Plus, Upload, Download, Trash2, Edit2, Check, X, Wrench, Lock, Eye, EyeOff, ShieldCheck, UserCheck, Clock } from "lucide-react";
import LayoutWithSidebar from "@/components/LayoutWithSidebar";
import PageHeader from "@/components/PageHeader";
import { useUsuarios, agregarUsuario, actualizarUsuario, eliminarUsuario, limpiarYReimportarUsuarios } from "@/utils/useUsuarios";
import { useCargos, agregarCargo, actualizarCargo, eliminarCargo, limpiarYReimportarCargos } from "@/utils/useCargos";
import { useTecnicos, agregarTecnico, actualizarTecnico, eliminarTecnico } from "@/utils/useTecnicos";
import { USUARIOS_BASE } from "@/utils/usuarios-base";
import { CARGOS_BASE } from "@/utils/cargos-base";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getUserRoleByUid } from "@/utils/getUserRole";
import { useAccesoModulos, guardarAccesoModulo, TODAS_LAS_PAGINAS } from "@/utils/useAccesoModulos";

export default function AdminUsuarios() {
  const [tabActiva, setTabActiva] = useState("usuarios");
  const [rolActual, setRolActual] = useState("admin"); // rol del usuario logueado
  const esTecnico = rolActual === "tecnico";

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const r = await getUserRoleByUid(u.uid).catch(() => "usuario");
        setRolActual(r || "usuario");
      }
    });
    return () => unsub();
  }, []);
  const { usuarios, loading: loadingUsuarios, recargar: recargarUsuarios } = useUsuarios();
  const { cargos, loading: loadingCargos, recargar: recargarCargos } = useCargos();
  const { tecnicos, loading: loadingTecnicos, recargar: recargarTecnicos } = useTecnicos();

  const [modalUsuario, setModalUsuario] = useState(false);
  const [modalCargo, setModalCargo] = useState(false);
  const [modalTecnico, setModalTecnico] = useState(false);
  const [modalConfirmar, setModalConfirmar] = useState(null);
  const [eliminando, setEliminando] = useState(false);
  const pendingDeleteRef = useRef(null);

  const abrirConfirmarEliminar = (tipo, id, mensaje) => {
    pendingDeleteRef.current = { tipo, id };
    setModalConfirmar(mensaje);
  };

  const ejecutarEliminacion = async () => {
    const pending = pendingDeleteRef.current;
    if (!pending || !pending.id) {
      alert("Error: no hay elemento para eliminar");
      return;
    }
    setEliminando(true);
    const { tipo, id } = pending;
    let result;
    try {
      if (tipo === "usuario")       result = await eliminarUsuario(id);
      else if (tipo === "cargo")    result = await eliminarCargo(id);
      else if (tipo === "tecnico")  result = await eliminarTecnico(id);
      else result = { success: false, error: "Tipo desconocido" };
    } catch (e) {
      result = { success: false, error: e.message };
    }
    setEliminando(false);
    setModalConfirmar(null);
    pendingDeleteRef.current = null;
    if (result?.success) {
      const msg = tipo === "usuario" ? "Usuario eliminado" : tipo === "cargo" ? "Cargo eliminado" : "Técnico eliminado";
      setMensaje(msg);
      if (tipo === "usuario")      recargarUsuarios();
      else if (tipo === "cargo")   recargarCargos();
      else if (tipo === "tecnico") recargarTecnicos();
    } else {
      setMensaje(`Error al eliminar: ${result?.error || "desconocido"}`);
    }
    setTimeout(() => setMensaje(""), 4000);
  };
  const [usuarioEditando, setUsuarioEditando] = useState(null);
  const [cargoEditando, setCargoEditando] = useState(null);
  const [tecnicoEditando, setTecnicoEditando] = useState(null);
  const [formUsuario, setFormUsuario] = useState({ nombre: "", email: "", cargo: "", rol: "usuario", activo: true, password: "", confirmPassword: "", diasCaducidad: 60 });
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [formCargo, setFormCargo] = useState({ nombre: "", activo: true });
  const [formTecnico, setFormTecnico] = useState({ nombre: "", email: "", empresa: "", activo: true, password: "", confirmPassword: "", diasCaducidad: 60 });
  const [showPassTec, setShowPassTec] = useState(false);
  const [showConfirmTec, setShowConfirmTec] = useState(false);
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
        password: "",
        confirmPassword: "",
        diasCaducidad: usuario.diasCaducidad || 60,
      });
    } else {
      setUsuarioEditando(null);
      setFormUsuario({ nombre: "", email: "", cargo: "", rol: "usuario", activo: true, password: "", confirmPassword: "", diasCaducidad: 60 });
    }
    setShowPass(false);
    setShowConfirm(false);
    setModalUsuario(true);
  };

  const guardarUsuario = async () => {
    try {
      if (usuarioEditando) {
        // Validar contraseña si se ingresó
        if (formUsuario.password) {
          if (formUsuario.password.length < 6) { setMensaje("Mínimo 6 caracteres"); return; }
          if (formUsuario.password !== formUsuario.confirmPassword) { setMensaje("Las contraseñas no coinciden"); return; }
        }
        const { password, confirmPassword, ...datosActualizar } = formUsuario;
        const result = await actualizarUsuario(usuarioEditando.id, datosActualizar);
        if (!result.success) { setMensaje(`Error: ${result.error}`); return; }

        // Si ingresó contraseña, crear/actualizar en Firebase Auth (gateway)
        if (formUsuario.password) {
          const authRes = await fetch("/api/crear-usuario-auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: usuarioEditando.email || formUsuario.email,
              password: formUsuario.password,
              displayName: formUsuario.nombre,
            }),
          });
          const authData = await authRes.json();
          // Si se creo un uid nuevo, guardarlo en Firestore
          if (authData.success && authData.uid && !usuarioEditando.uid) {
            await actualizarUsuario(usuarioEditando.id, { uid: authData.uid });
          }
        }

        setMensaje("Usuario actualizado correctamente");
        recargarUsuarios();
        setModalUsuario(false);
      } else {
        // Crear: validaciones
        if (!formUsuario.nombre.trim()) { setMensaje("El nombre es obligatorio"); return; }
        if (!formUsuario.email.trim()) { setMensaje("El correo es obligatorio"); return; }
        if (!formUsuario.password.trim()) { setMensaje("La contraseña es obligatoria"); return; }
        if (formUsuario.password.length < 6) { setMensaje("Mínimo 6 caracteres"); return; }
        if (formUsuario.password !== formUsuario.confirmPassword) { setMensaje("Las contraseñas no coinciden"); return; }

        // 1. Crear en Firebase Auth
        const authRes = await fetch("/api/crear-usuario-auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: formUsuario.email.trim(),
            password: formUsuario.password,
            displayName: formUsuario.nombre.trim(),
          }),
        });
        const authData = await authRes.json();
        if (!authData.success) { setMensaje(`Error Auth: ${authData.error}`); return; }

        // 2. Guardar en Firestore con uid y caducidad
        const result = await agregarUsuario({
          nombre: formUsuario.nombre,
          email:  formUsuario.email,
          cargo:  formUsuario.cargo,
          rol:    formUsuario.rol,
          activo: formUsuario.activo,
          uid:    authData.uid,
          diasCaducidad: formUsuario.diasCaducidad || 60,
        });
        if (result.success) {
          setMensaje("Usuario creado correctamente en la aplicación");
          recargarUsuarios();
          setModalUsuario(false);
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

  const eliminarUsuarioConfirm = (id) => abrirConfirmarEliminar("usuario", id, "¿Eliminar este usuario? Esta acción no se puede deshacer.");
  const eliminarCargoConfirm   = (id) => abrirConfirmarEliminar("cargo",   id, "¿Eliminar este cargo?");
  const eliminarTecnicoConfirm = (id) => abrirConfirmarEliminar("tecnico", id, "¿Eliminar este técnico?");

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
        password: "",
        confirmPassword: "",
        diasCaducidad: tecnico.diasCaducidad || 60,
      });
    } else {
      setTecnicoEditando(null);
      setFormTecnico({ nombre: "", email: "", empresa: "", activo: true, password: "", confirmPassword: "", diasCaducidad: 60 });
    }
    setShowPassTec(false);
    setShowConfirmTec(false);
    setModalTecnico(true);
  };

  const guardarTecnico = async () => {
    try {
      if (tecnicoEditando) {
        // Validar contraseña si se ingresó
        if (formTecnico.password) {
          if (formTecnico.password.length < 6) { setMensaje("Mínimo 6 caracteres"); return; }
          if (formTecnico.password !== formTecnico.confirmPassword) { setMensaje("Las contraseñas no coinciden"); return; }
        }
        const { password, confirmPassword, ...datosTecnico } = formTecnico;
        const result = await actualizarTecnico(tecnicoEditando.id, datosTecnico);
        if (!result.success) { setMensaje(`Error: ${result.error}`); return; }

        // Si ingresó nueva contraseña, actualizarla en Auth via API
        if (formTecnico.password && tecnicoEditando.uid) {
          await fetch("/api/crear-usuario-auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: tecnicoEditando.email || formTecnico.email, password: formTecnico.password, displayName: formTecnico.nombre }),
          });
        }

        setMensaje("Técnico actualizado correctamente");
        recargarTecnicos();
        setModalTecnico(false);
      } else {
        // Crear: validaciones
        if (!formTecnico.nombre.trim()) { setMensaje("El nombre es obligatorio"); return; }
        if (!formTecnico.email.trim()) { setMensaje("El correo es obligatorio"); return; }
        if (!formTecnico.password.trim()) { setMensaje("La contraseña es obligatoria"); return; }
        if (formTecnico.password.length < 6) { setMensaje("Mínimo 6 caracteres"); return; }
        if (formTecnico.password !== formTecnico.confirmPassword) { setMensaje("Las contraseñas no coinciden"); return; }

        // 1. Crear en Firebase Auth
        const authRes = await fetch("/api/crear-usuario-auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: formTecnico.email.trim(),
            password: formTecnico.password,
            displayName: formTecnico.nombre.trim(),
          }),
        });
        const authData = await authRes.json();
        if (!authData.success) { setMensaje(`Error Auth: ${authData.error}`); return; }

        // 2. Guardar en colección técnicos
        const { password, confirmPassword, diasCaducidad, ...datosTecnico } = formTecnico;
        const result = await agregarTecnico({ ...datosTecnico, uid: authData.uid });
        if (!result.success) { setMensaje(`Error: ${result.error}`); return; }

        // 3. Guardar en usuariosCatalogo con rol "tecnico" para que pueda ingresar
        const dias = Math.min(60, Math.max(1, Number(formTecnico.diasCaducidad) || 60));

        const { agregarUsuario: _ag } = await import("@/utils/useUsuarios");
        await _ag({
          nombre:        formTecnico.nombre,
          email:         formTecnico.email,
          cargo:         formTecnico.empresa || "Técnico",
          rol:           "tecnico",
          activo:        formTecnico.activo,
          uid:           authData.uid,
          diasCaducidad: dias,
        });

        // 4. Guardar en coleccion "usuarios" (UID como ID del doc) para que getUserRoleByUid lo encuentre
        const { doc: firestoreDoc, setDoc } = await import("firebase/firestore");
        const { db: fireDb } = await import("@/firebase/firebaseConfig");
        await setDoc(firestoreDoc(fireDb, "usuarios", authData.uid), {
          rol:       "tecnico",
          nombre:    formTecnico.nombre,
          email:     formTecnico.email,
          uid:       authData.uid,
          creadoEn:  new Date().toISOString(),
        });

        setMensaje("✅ Técnico creado. Ya puede ingresar a la aplicación con rol técnico.");
        recargarTecnicos();
        setModalTecnico(false);
      }
      setTimeout(() => setMensaje(""), 4000);
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
        {/* Tab Accesos — solo admin */}
        {!esTecnico && (
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
        )}
        <button
          onClick={() => setTabActiva("caducidad")}
          style={{
            padding: "0.75rem 1.5rem",
            border: "none",
            borderBottom: tabActiva === "caducidad" ? "3px solid #dc2626" : "3px solid transparent",
            background: tabActiva === "caducidad" ? "rgba(220,38,38,0.05)" : "transparent",
            color: tabActiva === "caducidad" ? "#dc2626" : "#6b7280",
            fontWeight: "700",
            cursor: "pointer",
            transition: "all 0.2s",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <Clock size={20} />
          Caducidad de Contraseñas
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
                          style={{ padding:"0.5rem", background:"#60a5fa", color:"#fff", border:"none", borderRadius:"6px", cursor:"pointer", marginRight:"0.5rem" }}
                        >
                          <Edit2 size={16} />
                        </button>
                        {!esTecnico && (
                        <button
                          onClick={() => eliminarUsuarioConfirm(usuario.id)}
                          style={{ padding:"0.5rem", background:"#ef4444", color:"#fff", border:"none", borderRadius:"6px", cursor:"pointer" }}
                        >
                          <Trash2 size={16} />
                        </button>
                        )}
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
                        style={{ padding:"0.25rem", background:"#dbeafe", color:"#1e40af", border:"none", borderRadius:"4px", cursor:"pointer" }}
                        title="Editar cargo"
                      >
                        <Edit2 size={16} />
                      </button>
                      {!esTecnico && (
                      <button
                        onClick={() => eliminarCargoConfirm(cargo.id)}
                        style={{ padding:"0.25rem", background:"#fee2e2", color:"#dc2626", border:"none", borderRadius:"4px", cursor:"pointer" }}
                        title="Eliminar cargo"
                      >
                        <Trash2 size={16} />
                      </button>
                      )}
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
                    <th style={{ padding: "1rem", textAlign: "left", fontWeight: "800" }}>Rol</th>
                    <th style={{ padding: "1rem", textAlign: "center", fontWeight: "800" }}>Estado</th>
                    <th style={{ padding: "1rem", textAlign: "center", fontWeight: "800" }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {tecnicos.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ padding: "2rem", textAlign: "center", color: "#6b7280" }}>
                        No hay técnicos registrados
                      </td>
                    </tr>
                  ) : (
                    tecnicos.map((tecnico) => (
                      <tr key={tecnico.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                        <td style={{ padding: "1rem" }}>{tecnico.nombre}</td>
                        <td style={{ padding: "1rem" }}>{tecnico.email}</td>
                        <td style={{ padding: "1rem" }}>{tecnico.empresa || "—"}</td>
                        <td style={{ padding: "1rem" }}>
                          <span style={{ padding: "0.25rem 0.75rem", borderRadius: "9999px", fontSize: "0.75rem", fontWeight: "600", background: "#dbeafe", color: "#1e40af" }}>
                            técnico
                          </span>
                        </td>
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
                            style={{ padding:"0.5rem", background:"#60a5fa", color:"#fff", border:"none", borderRadius:"6px", cursor:"pointer", marginRight:"0.5rem" }}
                          >
                            <Edit2 size={16} />
                          </button>
                          {!esTecnico && (
                          <button
                            onClick={() => eliminarTecnicoConfirm(tecnico.id)}
                            style={{ padding:"0.5rem", background:"#ef4444", color:"#fff", border:"none", borderRadius:"6px", cursor:"pointer" }}
                          >
                            <Trash2 size={16} />
                          </button>
                          )}
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
                  Email {!usuarioEditando && <span style={{ color: "#ef4444" }}>*</span>}
                </label>
                <input
                  type="email"
                  value={formUsuario.email}
                  onChange={(e) => setFormUsuario({ ...formUsuario, email: e.target.value })}
                  required
                  style={{ width: "100%", padding: "0.75rem", border: "1.5px solid #d9e2f1", borderRadius: "8px", background: "#fff" }}
                />
              </div>

              {/* Contraseña: obligatoria al crear, opcional al editar */}
              {!usuarioEditando ? (
                <>
                  <div>
                    <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>
                      Contraseña <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <div style={{ position: "relative" }}>
                      <input
                        type={showPass ? "text" : "password"}
                        value={formUsuario.password}
                        onChange={(e) => setFormUsuario({ ...formUsuario, password: e.target.value })}
                        placeholder="Mínimo 6 caracteres"
                        style={{ width: "100%", padding: "0.75rem 3rem 0.75rem 0.75rem", border: "1.5px solid #d9e2f1", borderRadius: "8px", boxSizing: "border-box" }}
                        autoComplete="new-password"
                      />
                      <button type="button" onClick={() => setShowPass(v => !v)}
                        style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 18 }}>
                        {showPass ? "🙈" : "👁️"}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>
                      Confirmar contraseña <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <div style={{ position: "relative" }}>
                      <input
                        type={showConfirm ? "text" : "password"}
                        value={formUsuario.confirmPassword}
                        onChange={(e) => setFormUsuario({ ...formUsuario, confirmPassword: e.target.value })}
                        placeholder="Repite la contraseña"
                        style={{ width: "100%", padding: "0.75rem 3rem 0.75rem 0.75rem", border: "1.5px solid #d9e2f1", borderRadius: "8px", boxSizing: "border-box" }}
                        autoComplete="new-password"
                      />
                      <button type="button" onClick={() => setShowConfirm(v => !v)}
                        style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 18 }}>
                        {showConfirm ? "🙈" : "👁️"}
                      </button>
                    </div>
                    {formUsuario.confirmPassword && formUsuario.password !== formUsuario.confirmPassword && (
                      <div style={{ fontSize: 12, color: "#dc2626", marginTop: 4 }}>Las contraseñas no coinciden</div>
                    )}
                  </div>
                </>
              ) : (
                /* Al editar: contraseña opcional para resetearla */
                <div style={{ padding: "10px 14px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 8 }}>Nueva contraseña (opcional — dejar vacío para no cambiar)</div>
                  <div style={{ position: "relative", marginBottom: 8 }}>
                    <input type={showPass ? "text" : "password"} value={formUsuario.password}
                      onChange={e => setFormUsuario({ ...formUsuario, password: e.target.value })}
                      placeholder="Nueva contraseña..."
                      style={{ width: "100%", padding: "0.75rem 3rem 0.75rem 0.75rem", border: "1.5px solid #d9e2f1", borderRadius: 8, boxSizing: "border-box" }}
                      autoComplete="new-password" />
                    <button type="button" onClick={() => setShowPass(v => !v)}
                      style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 18 }}>
                      {showPass ? "🙈" : "👁️"}
                    </button>
                  </div>
                  {formUsuario.password && (
                    <div style={{ position: "relative" }}>
                      <input type={showConfirm ? "text" : "password"} value={formUsuario.confirmPassword}
                        onChange={e => setFormUsuario({ ...formUsuario, confirmPassword: e.target.value })}
                        placeholder="Confirmar nueva contraseña"
                        style={{ width: "100%", padding: "0.75rem 3rem 0.75rem 0.75rem", border: "1.5px solid #d9e2f1", borderRadius: 8, boxSizing: "border-box" }}
                        autoComplete="new-password" />
                      <button type="button" onClick={() => setShowConfirm(v => !v)}
                        style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 18 }}>
                        {showConfirm ? "🙈" : "👁️"}
                      </button>
                      {formUsuario.confirmPassword && formUsuario.password !== formUsuario.confirmPassword && (
                        <div style={{ fontSize: 12, color: "#dc2626", marginTop: 4 }}>Las contraseñas no coinciden</div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>
                  Caducidad de contraseña
                  {usuarioEditando && <span style={{ fontWeight: 400, fontSize: 12, color: "#6b7280", marginLeft: 6 }}>(cambiar reinicia desde hoy)</span>}
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="number" min="1" max="60"
                    value={formUsuario.diasCaducidad ?? 60}
                    onChange={(e) => setFormUsuario({ ...formUsuario, diasCaducidad: Math.min(60, Math.max(1, Number(e.target.value) || 60)) })}
                    style={{ width: 80, padding: "0.75rem", border: "1.5px solid #d9e2f1", borderRadius: "8px", textAlign: "center" }}
                  />
                  <span style={{ fontSize: 13, color: "#6b7280" }}>días (máx. 60)</span>
                </div>
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

      {/* TAB CADUCIDAD DE CONTRASEÑAS */}
      {tabActiva === "caducidad" && (() => {
        const hoy = new Date();
        const conCaducidad = usuarios.map(u => {
          if (!u.fechaCaducidadClave) return { ...u, dias: null, estado: "sin_config" };
          const vence = new Date(u.fechaCaducidadClave);
          const dias = Math.round((vence - hoy) / (1000 * 60 * 60 * 24));
          const estado = dias <= 0 ? "vencida" : dias <= 7 ? "critica" : dias <= 15 ? "advertencia" : "ok";
          return { ...u, dias, estado, fechaVence: vence };
        }).sort((a, b) => (a.dias ?? 999) - (b.dias ?? 999));

        const resumen = {
          vencidas:    conCaducidad.filter(u => u.estado === "vencida").length,
          criticas:    conCaducidad.filter(u => u.estado === "critica").length,
          advertencia: conCaducidad.filter(u => u.estado === "advertencia").length,
          ok:          conCaducidad.filter(u => u.estado === "ok").length,
          sin_config:  conCaducidad.filter(u => u.estado === "sin_config").length,
        };

        const colorEstado = { vencida: { bg: "#fee2e2", color: "#991b1b", label: "⚠️ Vencida" }, critica: { bg: "#fef3c7", color: "#78350f", label: "🔔 Crítica" }, advertencia: { bg: "#fef9c3", color: "#854d0e", label: "⏰ Pronto" }, ok: { bg: "#d1fae5", color: "#065f46", label: "✅ Vigente" }, sin_config: { bg: "#f3f4f6", color: "#6b7280", label: "— Sin configurar" } };

        return (
          <div>
            {/* Tarjetas resumen */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12, marginBottom: 24 }}>
              {[
                { label: "Vencidas",    count: resumen.vencidas,    bg: "#fee2e2", color: "#991b1b", icon: "⚠️" },
                { label: "Críticas",   count: resumen.criticas,    bg: "#fef3c7", color: "#78350f", icon: "🔔" },
                { label: "Por vencer",  count: resumen.advertencia, bg: "#fef9c3", color: "#854d0e", icon: "⏰" },
                { label: "Vigentes",    count: resumen.ok,          bg: "#d1fae5", color: "#065f46", icon: "✅" },
                { label: "Sin config",  count: resumen.sin_config,  bg: "#f3f4f6", color: "#6b7280", icon: "—" },
              ].map(t => (
                <div key={t.label} style={{ background: t.bg, borderRadius: 12, padding: "16px 14px", textAlign: "center", border: `1px solid ${t.color}22` }}>
                  <div style={{ fontSize: 24, marginBottom: 4 }}>{t.icon}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: t.color }}>{t.count}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: t.color }}>{t.label}</div>
                </div>
              ))}
            </div>

            {/* Tabla de usuarios */}
            <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "auto", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f9fafb" }}>
                    {["Usuario", "Correo", "Cargo", "Días restantes", "Fecha vencimiento", "Duración", "Estado", "Acción"].map(h => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#6b7280", borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {conCaducidad.map((u, i) => {
                    const est = colorEstado[u.estado];
                    return (
                      <tr key={u.id} style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                        <td style={{ padding: "10px 14px", fontWeight: 600, color: "#111827", fontSize: 14 }}>{u.nombre}</td>
                        <td style={{ padding: "10px 14px", color: "#6b7280", fontSize: 13 }}>{u.email || "—"}</td>
                        <td style={{ padding: "10px 14px", color: "#6b7280", fontSize: 13 }}>{u.cargo || "—"}</td>
                        <td style={{ padding: "10px 14px" }}>
                          {u.dias !== null ? (
                            <span style={{ fontWeight: 800, fontSize: 15, color: u.dias <= 0 ? "#dc2626" : u.dias <= 7 ? "#d97706" : "#059669" }}>
                              {u.dias <= 0 ? `Venció hace ${Math.abs(u.dias)}d` : `${u.dias} días`}
                            </span>
                          ) : <span style={{ color: "#9ca3af" }}>No configurada</span>}
                        </td>
                        <td style={{ padding: "10px 14px", color: "#374151", fontSize: 13, whiteSpace: "nowrap" }}>
                          {u.fechaVence ? u.fechaVence.toLocaleDateString("es-CO") : "—"}
                        </td>
                        <td style={{ padding: "10px 14px", color: "#6b7280", fontSize: 13 }}>
                          {u.diasCaducidad ? `${u.diasCaducidad} días` : "—"}
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700, background: est.bg, color: est.color }}>
                            {est.label}
                          </span>
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <button
                            onClick={() => abrirModalUsuario(u)}
                            style={{ padding: "5px 12px", background: "#0B3D91", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 12 }}
                          >
                            Editar caducidad
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 12, fontSize: 12, color: "#9ca3af", textAlign: "center" }}>
              ⚠️ Crítica = menos de 7 días · ⏰ Por vencer = menos de 15 días · Ordenado de más urgente a más lejano
            </div>
          </div>
        );
      })()}

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
      <div
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9999 }}
      onClick={() => setModalTecnico(false)}
      >
          <div
      style={{ background:"#fff", borderRadius:12, padding:"2rem", maxWidth:500, width:"90%", maxHeight:"85vh", overflowY:"auto", boxShadow:"0 20px 60px rgba(0,0,0,0.3)" }}
      onClick={e => e.stopPropagation()}
      >
            <h2 style={{ marginTop:0, color:"#0B3D91" }}>{tecnicoEditando ? "Editar Técnico" : "Nuevo Técnico"}</h2>

            <div style={{ display:"grid", gap:"1rem" }}>

      <div>
      <label style={{ display:"block", marginBottom:"0.5rem", fontWeight:600 }}>Nombre *</label>
      <input type="text" value={formTecnico.nombre}
      onChange={e => setFormTecnico({...formTecnico, nombre:e.target.value})}
      placeholder="Nombre del técnico"
      style={{ width:"100%", padding:"0.75rem", border:"1px solid #d1d5db", borderRadius:8, boxSizing:"border-box" }} />
      </div>

      <div>
          <label style={{ display:"block", marginBottom:"0.5rem", fontWeight:600 }}>
        Email {!tecnicoEditando && <span style={{color:"#ef4444"}}>*</span>}
      </label>
      <input type="email" value={formTecnico.email}
          onChange={e => setFormTecnico({...formTecnico, email:e.target.value})}
          placeholder="correo@empresa.com"
            style={{ width:"100%", padding:"0.75rem", border:"1px solid #d1d5db", borderRadius:8, boxSizing:"border-box" }} />
      </div>

              <div>
          <label style={{ display:"block", marginBottom:"0.5rem", fontWeight:600 }}>Empresa</label>
          <input type="text" value={formTecnico.empresa}
            onChange={e => setFormTecnico({...formTecnico, empresa:e.target.value})}
            placeholder="Empresa del técnico"
            style={{ width:"100%", padding:"0.75rem", border:"1px solid #d1d5db", borderRadius:8, boxSizing:"border-box" }} />
        </div>

        {/* Contraseña: obligatoria al crear, opcional al editar */}
              {!tecnicoEditando ? (
          <>
            <div>
          <label style={{ display:"block", marginBottom:"0.5rem", fontWeight:600 }}>Contraseña <span style={{color:"#ef4444"}}>*</span></label>
        <div style={{ position:"relative" }}>
        <input type={showPassTec?"text":"password"} value={formTecnico.password}
        onChange={e => setFormTecnico({...formTecnico, password:e.target.value})}
          placeholder="Mínimo 6 caracteres" autoComplete="new-password"
          style={{ width:"100%", padding:"0.75rem 3rem 0.75rem 0.75rem", border:"1px solid #d1d5db", borderRadius:8, boxSizing:"border-box" }} />
      <button type="button" onClick={() => setShowPassTec(v=>!v)}
      style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", fontSize:18 }}>
      {showPassTec ? "🙈" : "👁️"}
      </button>
      </div>
      </div>

      <div>
      <label style={{ display:"block", marginBottom:"0.5rem", fontWeight:600 }}>Confirmar contraseña <span style={{color:"#ef4444"}}>*</span></label>
      <div style={{ position:"relative" }}>
          <input type={showConfirmTec?"text":"password"} value={formTecnico.confirmPassword}
            onChange={e => setFormTecnico({...formTecnico, confirmPassword:e.target.value})}
          placeholder="Repite la contraseña" autoComplete="new-password"
        style={{ width:"100%", padding:"0.75rem 3rem 0.75rem 0.75rem", border:"1px solid #d1d5db", borderRadius:8, boxSizing:"border-box" }} />
        <button type="button" onClick={() => setShowConfirmTec(v=>!v)}
          style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", fontSize:18 }}>
        {showConfirmTec ? "🙈" : "👁️"}
      </button>
      </div>
      {formTecnico.confirmPassword && formTecnico.password !== formTecnico.confirmPassword && (
      <div style={{ fontSize:12, color:"#dc2626", marginTop:4 }}>Las contraseñas no coinciden</div>
      )}
      </div>
          </>
        ) : (
          /* Al editar: contraseña opcional para resetearla */
          <>
            <div style={{ padding:"10px 14px", background:"#f8fafc", borderRadius:8, border:"1px solid #e2e8f0" }}>
              <div style={{ fontSize:12, fontWeight:700, color:"#6b7280", marginBottom:8 }}>Nueva contraseña (opcional — dejar vacío para no cambiar)</div>
              <div style={{ position:"relative", marginBottom:8 }}>
                <input type={showPassTec?"text":"password"} value={formTecnico.password}
                  onChange={e => setFormTecnico({...formTecnico, password:e.target.value})}
                  placeholder="Nueva contraseña..."
                  style={{ width:"100%", padding:"0.75rem 3rem 0.75rem 0.75rem", border:"1px solid #d1d5db", borderRadius:8, boxSizing:"border-box" }}
                  autoComplete="new-password" />
                <button type="button" onClick={() => setShowPassTec(v=>!v)}
                  style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", fontSize:18 }}>
                  {showPassTec ? "🙈" : "👁️"}
                </button>
              </div>
              {formTecnico.password && (
                <div style={{ position:"relative" }}>
                  <input type={showConfirmTec?"text":"password"} value={formTecnico.confirmPassword}
                    onChange={e => setFormTecnico({...formTecnico, confirmPassword:e.target.value})}
                    placeholder="Confirmar nueva contraseña"
                    style={{ width:"100%", padding:"0.75rem 3rem 0.75rem 0.75rem", border:"1px solid #d1d5db", borderRadius:8, boxSizing:"border-box" }}
                    autoComplete="new-password" />
                  <button type="button" onClick={() => setShowConfirmTec(v=>!v)}
                    style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", fontSize:18 }}>
                    {showConfirmTec ? "🙈" : "👁️"}
                  </button>
                  {formTecnico.confirmPassword && formTecnico.password !== formTecnico.confirmPassword && (
                    <div style={{ fontSize:12, color:"#dc2626", marginTop:4 }}>Las contraseñas no coinciden</div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

      {/* Caducidad: visible tanto al crear como al editar */}
      <div>
      <label style={{ display:"block", marginBottom:"0.5rem", fontWeight:600 }}>
        Caducidad de contraseña
        {tecnicoEditando && <span style={{ fontWeight:400, fontSize:12, color:"#6b7280", marginLeft:6 }}>(cambiar reinicia desde hoy)</span>}
      </label>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
      <input type="number" min="1" max="60" value={formTecnico.diasCaducidad ?? 60}
          onChange={e => setFormTecnico({...formTecnico, diasCaducidad:Math.min(60,Math.max(1,Number(e.target.value)||60))})}
            style={{ width:80, padding:"0.75rem", border:"1px solid #d1d5db", borderRadius:8, textAlign:"center" }} />
          <span style={{ fontSize:13, color:"#6b7280" }}>días (máx. 60)</span>
      </div>
      </div>

      <div style={{ display:"flex", alignItems:"center", gap:"0.5rem" }}>
      <input type="checkbox" checked={formTecnico.activo}
      onChange={e => setFormTecnico({...formTecnico, activo:e.target.checked})}
        style={{ width:20, height:20 }} />
        <label style={{ fontWeight:600 }}>Activo</label>
              </div>

      </div>

      {!tecnicoEditando && (
      <div style={{ marginTop:16, padding:"10px 14px", background:"#eff6ff", borderRadius:8, border:"1px solid #bfdbfe", fontSize:13, color:"#1e40af" }}>
      🔑 El técnico podrá ingresar a la app con <strong>rol técnico</strong> — tiene acceso a Servicios Técnicos y Solicitudes.
      </div>
      )}

      <div style={{ display:"flex", gap:"1rem", marginTop:"1.5rem" }}>
        <button onClick={() => setModalTecnico(false)}
        style={{ flex:1, padding:"0.75rem", background:"#f3f4f6", border:"none", borderRadius:8, fontWeight:700, cursor:"pointer" }}>
      Cancelar
      </button>
        <button onClick={guardarTecnico}
                style={{ flex:1, padding:"0.75rem", background:"#0B3D91", color:"#fff", border:"none", borderRadius:8, fontWeight:700, cursor:"pointer" }}>
          Guardar
      </button>
      </div>
      </div>
      </div>
      )}
      {/* MODAL CONFIRMAR ELIMINACIÓN */}
      {modalConfirmar && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:99999 }}>
          <div style={{ background:"#fff", borderRadius:12, padding:"2rem", maxWidth:400, width:"90%", boxShadow:"0 20px 60px rgba(0,0,0,0.3)" }}>
            <h3 style={{ marginTop:0, color:"#dc2626", fontSize:18 }}>⚠️ Confirmar eliminación</h3>
            <p style={{ color:"#374151", marginBottom:"1.5rem" }}>{modalConfirmar}</p>
            <div style={{ display:"flex", gap:"1rem" }}>
              <button onClick={() => { setModalConfirmar(null); pendingDeleteRef.current = null; }} disabled={eliminando}
                style={{ flex:1, padding:"0.75rem", background:"#f3f4f6", border:"none", borderRadius:8, fontWeight:700, cursor:"pointer" }}>
                Cancelar
              </button>
              <button onClick={ejecutarEliminacion} disabled={eliminando}
                style={{ flex:1, padding:"0.75rem", background:"#dc2626", color:"#fff", border:"none", borderRadius:8, fontWeight:700, cursor:eliminando?"not-allowed":"pointer", opacity:eliminando?0.7:1 }}>
                {eliminando ? "Eliminando..." : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

    </LayoutWithSidebar>
  );
}
