import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import {
  collection,
  getDocs,
  getFirestore
} from "firebase/firestore";
import app from "@/firebase/firebaseConfig";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer
} from "recharts";
import { LineChart, Line, XAxis, YAxis } from "recharts";

const db = getFirestore(app);
const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#8dd1e1", "#a4de6c", "#d0ed57", "#d8854f"];

export default function Estadisticas() {
  const router = useRouter();
  const [fechaInicio, setFechaInicio] = useState(null);
  const [fechaFin, setFechaFin] = useState(null);
  const [resumen, setResumen] = useState({});
  const [filtros, setFiltros] = useState({ equipo: "", tecnico: "", usuario: "" });
  const [serviciosTotales, setServiciosTotales] = useState([]);
  const [filtrosTablas, setFiltrosTablas] = useState({});

  const actualizarFiltroTabla = (clave, valor) => {
    setFiltrosTablas(prev => ({ ...prev, [clave]: valor }));
  };

  useEffect(() => {
    const obtenerDatos = async () => {
      const agruparPorMes = (servicios) => {
        const agrupado = {};
        servicios.forEach(({ fecha }) => {
          const mes = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
          if (!agrupado[mes]) agrupado[mes] = 0;
          agrupado[mes]++;
        });
        return Object.entries(agrupado).map(([mes, cantidad]) => ({ mes, cantidad }));
      };
      const querySnapshot = await getDocs(collection(db, "serviciosTecnicos"));
      const servicios = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.fecha) {
          const fecha = new Date(data.fecha);
          if (
            (!fechaInicio || fecha >= new Date(fechaInicio.setHours(0, 0, 0, 0))) &&
            (!fechaFin || fecha <= new Date(fechaFin.setHours(23, 59, 59, 999))) &&
            (!filtros.tecnico || data.tecnico === filtros.tecnico) &&
            (!filtros.usuario || data.usuario === filtros.usuario) &&
            (!filtros.equipo || data.equipo === filtros.equipo)
          ) {
            servicios.push({ ...data, fecha });
          }
        }
      });

      setServiciosTotales(servicios);

      const contarPorCampo = (campo) => {
        const contador = {};
        servicios.forEach(servicio => {
          let valor = servicio[campo] || "Sin especificar";
          const claveNormalizada = valor.trim().toLowerCase();
          const nombreFinal = valor.trim().charAt(0).toUpperCase() + valor.trim().slice(1).toLowerCase();
          if (!contador[claveNormalizada]) {
            contador[claveNormalizada] = { nombre: nombreFinal, cantidad: 0 };
          }
          contador[claveNormalizada].cantidad += 1;
        });
        return Object.values(contador);
      };

      const contarPartes = () => {
        const contador = {};
        servicios.forEach(s => {
          (s.partes || []).forEach(parte => {
            const parteNormalizada = parte.trim().toLowerCase();
            const nombreFinal = parte.trim().charAt(0).toUpperCase() + parte.trim().slice(1).toLowerCase();
            if (!contador[parteNormalizada]) {
              contador[parteNormalizada] = { nombre: nombreFinal, cantidad: 0 };
            }
            contador[parteNormalizada].cantidad += 1;
          });
        });
        return Object.values(contador);
      };

      const contarServiciosRealizados = () => {
        const campos = ["limpieza", "mantenimiento", "cambioClave", "visitaPreventiva", "visitaCorrectiva"];
        const contador = {};
        campos.forEach(campo => {
          contador[campo] = {
            nombre: campo.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase()),
            cantidad: 0
          };
        });
        servicios.forEach(s => {
          campos.forEach(campo => {
            if (s[campo]) contador[campo].cantidad += 1;
          });
        });
        return Object.values(contador);
      };

      setResumen({
        total: servicios.length,
        porUsuario: contarPorCampo("usuario"),
        porTecnico: contarPorCampo("tecnico"),
        porDiagnostico: contarPorCampo("diagnostico"),
        porSolucion: contarPorCampo("solucion"),
        porEquipo: contarPorCampo("equipo"),
        porPartes: contarPartes(),
        porServicios: contarServiciosRealizados(),
        porMes: agruparPorMes(servicios)
      });
    };

    obtenerDatos();
  }, [fechaInicio, fechaFin, filtros]);

  const renderResumen = (titulo, data, clave) => {
    const filtroTabla = filtrosTablas[clave] || "";
    const dataFiltrada = data.filter((item) =>
      item.nombre.toLowerCase().includes(filtroTabla.toLowerCase())
    );

    return (
      <div className="mb-10">
        <h2 className="text-lg font-semibold mb-4">{titulo}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dataFiltrada}
                  dataKey="cantidad"
                  nameKey="nombre"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label
                >
                  {dataFiltrada.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div>
            <input
              type="text"
              placeholder="Filtrar nombres..."
              value={filtrosTablas[clave] || ""}
              onChange={(e) => actualizarFiltroTabla(clave, e.target.value)}
              className="mb-4 border px-3 py-2 rounded w-full"
            />
            <table className="w-full table-auto border border-gray-300 rounded">
              <thead>
                <tr className="bg-gray-100">
                  <th className="text-left p-2 border">Nombre</th>
                  <th className="text-left p-2 border">Cantidad</th>
                  <th className="text-left p-2 border">Porcentaje</th>
                </tr>
              </thead>
              <tbody>
                {dataFiltrada.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="p-2 border">{item.nombre}</td>
                    <td className="p-2 border">{item.cantidad}</td>
                    <td className="p-2 border">
                      {((item.cantidad / (resumen.total || 1)) * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const tecnicosUnicos = Array.from(new Set(serviciosTotales.map(s => (s.tecnico || "Sin especificar").trim())));
  const usuariosUnicos = Array.from(new Set(serviciosTotales.map(s => (s.usuario || "Sin especificar").trim())));
  const equiposUnicos = Array.from(new Set(serviciosTotales.map(s => (s.equipo || "Sin especificar").trim())));

  return (
    <div className="p-6 max-w-7xl mx-auto relative">
      {/* ✅ LOGOS AGREGADOS */}
      <div style={{ position: "fixed", top: 10, left: 10, zIndex: 2000 }}>
        <img src="/img/logo1.png" alt="Logo Izquierdo" style={{ height: "60px" }} />
      </div>
      <div style={{ position: "fixed", top: 10, right: 10, zIndex: 2000 }}>
        <img src="/img/logo2.png" alt="Logo Derecho" style={{ height: "60px" }} />
      </div>

      <h1 style={{
        fontSize: "36px",
        color: "#2c3e50",
        textShadow: "2px 2px 4px rgba(0,0,0,0.3)",
        fontWeight: "900",
        letterSpacing: "1px",
        textAlign: "center",
        marginBottom: "24px"
      }}>
        Estadistica servicios tecnicos realizados
      </h1>

      <div className="flex flex-wrap gap-4 mb-6 items-end">
        <div>
          <label className="block mb-1 font-medium">Fecha Inicio</label>
          <DatePicker
            selected={fechaInicio}
            onChange={(date) => setFechaInicio(date)}
            placeholderText="Seleccione la fecha de inicio"
            className="border px-3 py-2 rounded w-full"
          />
        </div>
        <div>
          <label className="block mb-1 font-medium">Fecha Fin</label>
          <DatePicker
            selected={fechaFin}
            onChange={(date) => setFechaFin(date)}
            placeholderText="Seleccione la fecha de fin"
            className="border px-3 py-2 rounded w-full"
          />
        </div>
        <div>
          <label className="block mb-1 font-medium">Filtrar por Técnico</label>
          <select
            className="border px-3 py-2 rounded w-full"
            value={filtros.tecnico}
            onChange={(e) => setFiltros({ ...filtros, tecnico: e.target.value })}
          >
            <option value="">Todos los Técnicos</option>
            {tecnicosUnicos.map((t, i) => (
              <option key={i} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block mb-1 font-medium">Filtrar por Usuario</label>
          <select
            className="border px-3 py-2 rounded w-full"
            value={filtros.usuario}
            onChange={(e) => setFiltros({ ...filtros, usuario: e.target.value })}
          >
            <option value="">Todos los Usuarios</option>
            {usuariosUnicos.map((u, i) => (
              <option key={i} value={u}>{u}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block mb-1 font-medium">Filtrar por Equipo</label>
          <select
            className="border px-3 py-2 rounded w-full"
            value={filtros.equipo}
            onChange={(e) => setFiltros({ ...filtros, equipo: e.target.value })}
          >
            <option value="">Todos los Equipos</option>
            {equiposUnicos.map((eq, i) => (
              <option key={i} value={eq}>{eq}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-8">
        <p className="text-md font-medium">Total de servicios encontrados: <strong>{resumen.total || 0}</strong></p>
      </div>

      {resumen.porMes && (
        <div className="mb-10">
          <h2 className="text-lg font-semibold mb-4">Tendencia Mensual de Servicios</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={resumen.porMes}>
                <XAxis dataKey="mes" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="cantidad" stroke="#8884d8" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {resumen.porUsuario && renderResumen("Servicios por Usuario", resumen.porUsuario, "usuario")}
      {resumen.porTecnico && renderResumen("Servicios por Técnico", resumen.porTecnico, "tecnico")}
      {resumen.porEquipo && renderResumen("Servicios por Equipo", resumen.porEquipo, "equipo")}
      {resumen.porDiagnostico && renderResumen("Servicios por Diagnóstico", resumen.porDiagnostico, "diagnostico")}
      {resumen.porSolucion && renderResumen("Servicios por Solución", resumen.porSolucion, "solucion")}
      {resumen.porPartes && renderResumen("Cambios de Partes", resumen.porPartes, "partes")}
      {resumen.porServicios && renderResumen("Servicios Realizados", resumen.porServicios, "servicios")}

      <button
        style={{
          position: "fixed",
          bottom: "20px",
          left: "20px",
          padding: "10px 20px",
          backgroundColor: "#2980b9",
          color: "white",
          border: "none",
          borderRadius: "5px",
          cursor: "pointer",
          zIndex: 1000
        }}
        onClick={() => router.push("/")}
      >
        Regresar
      </button>
    </div>
  );
}
