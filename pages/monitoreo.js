"use client";

import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/router";
import LayoutWithSidebar from "@/components/LayoutWithSidebar";

import { db } from "@/firebase/firebaseConfig";
import {
  collection,
  getDocs,
  query as fsQuery,
  where,
  orderBy,
} from "firebase/firestore";

/* =========================
   Utils (tu lógica intacta)
   ========================= */
const cls = (...s) => s.filter(Boolean).join(" ");
const clamp01 = (n) => Math.max(0, Math.min(100, n));
const fmtGB = (mb) =>
  typeof mb === "number" && !isNaN(mb) ? `${(mb / 1024).toFixed(1)} GB` : "—";
const fmtMBorGB = (mb) => {
  if (typeof mb !== "number" || isNaN(mb)) return "—";
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.max(0, Math.round(mb))} MB`;
};
function fmtMinutes(m) {
  if (typeof m !== "number" || isNaN(m)) return "—";
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const mi = Math.floor(m % 60);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h || d) parts.push(`${h}h`);
  parts.push(`${mi}m`);
  return parts.join(" ");
}

function DiskCell({ disks }) {
  if (!Array.isArray(disks) || disks.length === 0)
    return <span className="text-gray-500">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {disks.map((d, i) => {
        const label = d.letter || d.name || `Disk${i + 1}`;
        const pct = typeof d.freePct === "number" ? `${d.freePct}%` : "—";
        const low = typeof d.freePct === "number" && d.freePct < 10;
        return (
          <span
            key={i}
            className={cls(
              "px-2 py-0.5 rounded-full text-xs border",
              low
                ? "bg-red-50 text-red-700 border-red-400"
                : "bg-gray-50 text-gray-800 border-gray-400"
            )}
          >
            {label}: {pct}
          </span>
        );
      })}
    </div>
  );
}

function DiskTypeCell({ disks }) {
  if (!Array.isArray(disks) || disks.length === 0)
    return <span className="text-gray-500">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {disks.map((d, i) => {
        const label = d.letter || d.name || `Disk${i + 1}`;
        const type =
          (d.type && String(d.type).toUpperCase()) ??
          (typeof d.isSSD === "boolean" ? (d.isSSD ? "SSD" : "HDD") : null) ??
          (d.mediaType ? String(d.mediaType).toUpperCase() : null) ??
          (d.busType ? String(d.busType).toUpperCase() : null) ??
          "—";
        return (
          <span
            key={i}
            className="px-2 py-0.5 rounded-full text-xs border bg-white text-gray-800 border-gray-500"
          >
            {label}: {type}
          </span>
        );
      })}
    </div>
  );
}

/* =========================
   Modal inline con portal
   ========================= */
function InlinePortalModal({ show, onClose, title, children }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!show || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Fondo que cierra */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      {/* Contenido */}
      <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto p-6">
        <button
          onClick={onClose}
          className="absolute top-3 right-4 text-gray-500 hover:text-gray-700 text-xl font-bold"
          aria-label="Cerrar"
        >
          &times;
        </button>
        {title ? (
          <h2 className="text-xl font-bold mb-4 text-center text-gray-800">
            {title}
          </h2>
        ) : null}
        {children}
      </div>
    </div>,
    document.body
  );
}

/* =========================
   Página
   ========================= */
export default function MonitoreoPage() {
  const router = useRouter();

  // Estado principal
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [q, setQ] = useState("");
  const [onlyAlerts, setOnlyAlerts] = useState(false);

  // ======= Exportar a Excel: selección de columnas =======
  const HEADERS = [
    "Hostname","Usuario","Marca","Modelo","Serial","CPU Marca","CPU Modelo","SO","Uptime","CPU %","CPU Temp (°C)",
    "Mem usada","Mem total","Mem %","Batería","Estado bat.","Discos (Libre %)","Tipo disco","Temp","Escritorio",
    "Office","Tags","Versión","Actualizado",
  ];
  const [colOptions, setColOptions] = useState(HEADERS);
  const [selectedCols, setSelectedCols] = useState(HEADERS);

  const toggleCol = (h) => {
    setSelectedCols((prev) => prev.includes(h) ? prev.filter((x) => x !== h) : [...prev, h]);
  };

  function buildRowValues(it) {
    const u = it.ultimo || {};
    const brand = u.brand || u.manufacturer || "—";
    const model = u.model || "—";
    const serial = u.serial || u.device?.serial || "—";
    const cpuVendor = u.cpuVendor || u.cpu?.vendor || "—";
    const cpuName = u.cpuName || u.cpu?.name || "—";
    const os = u.os || "—";
    const cpu = typeof u.cpuLoadPct === "number" ? `${u.cpuLoadPct}%` : "—";
    const cpuTempVal = typeof u.cpuTempC === "number" ? Math.round(u.cpuTempC) :
                       typeof u.cpu?.tempC === "number" ? Math.round(u.cpu.tempC) : null;
    const cpuTemp = cpuTempVal !== null ? `${cpuTempVal}°C` : "—";
    const memUsed = fmtGB(u.memory?.usedMb);
    const memTotal = fmtGB(u.memory?.totalMb);
    const memPct = typeof u.memory?.usedPct === "number" ? `${u.memory.usedPct}%` : "—";
    const battPctVal = typeof u.battery?.percent === "number" ? clamp01(u.battery.percent) : null;
    const battPct = battPctVal !== null ? `${battPctVal}%` : "—";
    const battStatus = u.battery?.status || "N/A";
    const uptime = fmtMinutes(u.uptimeMin);
    const tags = Array.isArray(u.tags) ? u.tags : [];
    const tempSize = fmtMBorGB(u.temp?.sizeMB);
    const deskSize = fmtMBorGB(u.desktop?.sizeMB);
    const officeDisplay = [u.office?.edition || u.office?.product, u.office?.version].filter(Boolean).join(" — ") || "—";
    const agentVersion = u.agentVersion || "—";
    const updated = it.updatedAt ? new Date(it.updatedAt).toLocaleString() : "—";

    const diskLibre = (u.storage?.disks || []).map((d) => {
      const pct = typeof d?.freePct === "number" ? `${d.freePct}%` : "—";
      const letter = d?.letter || d?.name || d?.device || "";
      return letter ? `${letter}: ${pct}` : pct;
    }).filter(Boolean).join(" | ") || "—";

    const diskTipo = (u.storage?.disks || []).map((d) => {
      const t = d?.type || d?.mediaType || "";
      const letter = d?.letter || d?.name || d?.device || "";
      return letter ? `${letter}: ${t || "?"}` : (t || "");
    }).filter(Boolean).join(" | ") || "—";

    const tagsStr = tags.length ? tags.join(", ") : "—";

    return {
      "Hostname": u.hostname || it.id,
      "Usuario": u.username || "—",
      "Marca": brand,
      "Modelo": model,
      "Serial": serial,
      "CPU Marca": cpuVendor,
      "CPU Modelo": cpuName,
      "SO": os,
      "Uptime": uptime,
      "CPU %": cpu,
      "CPU Temp (°C)": cpuTemp,
      "Mem usada": memUsed,
      "Mem total": memTotal,
      "Mem %": memPct,
      "Batería": battPct,
      "Estado bat.": battStatus,
      "Discos (Libre %)": diskLibre,
      "Tipo disco": diskTipo,
      "Temp": tempSize,
      "Escritorio": deskSize,
      "Office": officeDisplay,
      "Tags": tagsStr,
      "Versión": agentVersion,
      "Actualizado": updated,
    };
  }

  async function exportToExcel() {
    try {
      const XLSX = await import("xlsx");
      const headers = selectedCols;
      const aoa = [headers];
      (filtered || []).forEach((it) => {
        const row = buildRowValues(it);
        aoa.push(headers.map((h) => row[h]));
      });
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws["!cols"] = headers.map((h) => ({ wch: Math.max(14, Math.min(40, String(h).length + 2)) }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Monitoreo");
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth()+1).padStart(2,"0");
      const dd = String(now.getDate()).padStart(2,"0");
      const hh = String(now.getHours()).padStart(2,"0");
      const mi = String(now.getMinutes()).padStart(2,"0");
      XLSX.writeFile(wb, `Monitoreo_Equipos_${yyyy}${mm}${dd}_${hh}${mi}.xlsx`);
    } catch (err) {
      console.error("Error exportando a Excel:", err);
      alert("No se pudo exportar a Excel. Revisa la consola.");
    }
  }


  // Historial (un solo modal)
  const [openHistorial, setOpenHistorial] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null); // null = global por cliente
  const [historialEventos, setHistorialEventos] = useState([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [errorHistorial, setErrorHistorial] = useState("");

  // Colección Firestore (ajústala si usas otro nombre)
  const HIST_COLLECTION = "apagadosHistoricos";

  // Cliente por defecto
  const defaultClient =
    process.env.NEXT_PUBLIC_DEFAULT_CLIENT_ID || process.env.NEXT_PUBLIC_APP_NAME || "LOGISPORT";
  const clientId = String(router.query.clientId || defaultClient);

  // Cargar listado principal
  useEffect(() => {
    let timer;
    const abort = new AbortController();
    async function fetchOnce() {
      try {
        const url = `/api/monitoreo-list?clientId=${encodeURIComponent(
          clientId
        )}&_=${Date.now()}`;
        const r = await fetch(url, {
          signal: abort.signal,
          cache: "no-store",
          headers: { pragma: "no-cache", "cache-control": "no-cache" },
        });
        const j = await r.json();
        if (j.ok) {
          setItems(j.items || []);
          setErrorMsg("");
        } else {
          setErrorMsg(j.error || "Error al cargar datos");
        }
      } catch (e) {
        if (e.name !== "AbortError") setErrorMsg(e.message || "Error de red");
      } finally {
        setLoading(false);
      }
    }
    if (clientId) {
      fetchOnce();
      timer = setInterval(fetchOnce, 10000);
    }
    return () => {
      if (timer) clearInterval(timer);
      abort.abort();
    };
  }, [clientId]);

  // Cargar historial al abrir
  async function reloadHistorial() {
    setLoadingHistorial(true);
    setErrorHistorial("");
    try {
      if (!db) throw new Error("No se encontró Firestore (db)");

      // Cargar sin orderBy para evitar error por tipo mixto de registradoEn
      const constraints = [where("clientId", "==", clientId)];
      if (selectedDeviceId) constraints.push(where("deviceId", "==", selectedDeviceId));

      const histQuery = fsQuery(collection(db, HIST_COLLECTION), ...constraints);
      const snap = await getDocs(histQuery);

      const list = snap.docs.map((d) => {
        const data = d.data();

        // registradoEn puede ser Timestamp de Firestore o string ISO
        let fechaObj = null;
        if (data?.registradoEn?.toDate) {
          fechaObj = data.registradoEn.toDate();
        } else if (data?.registradoEn) {
          fechaObj = new Date(data.registradoEn);
        } else if (data?.fechaEventoIso) {
          fechaObj = new Date(data.fechaEventoIso);
        }

        const fecha = fechaObj ? fechaObj.toLocaleDateString("es-CO") : (data.fecha || "—");
        const hora  = fechaObj ? fechaObj.toLocaleTimeString("es-CO") : (data.hora  || "—");
        const fechaSort = fechaObj ? fechaObj.getTime() : 0;

        return {
          id: d.id,
          hostname:     data?.hostname     || data?.equipo  || "—",
          username:     data?.username     || data?.usuario || "—",
          agentVersion: data?.agentVersion || data?.version || "—",
          fechaLocal:   data?.fechaEventoLocal || "—",
          fecha,
          hora,
          fechaSort,
        };
      })
      // Ordenar por fecha descendente en el cliente
      .sort((a, b) => b.fechaSort - a.fechaSort);

      setHistorialEventos(list);
    } catch (err) {
      console.error("Historial ERROR:", err);
      setErrorHistorial(err?.message || "No se pudo cargar el historial");
    } finally {
      setLoadingHistorial(false);
    }
  }

  useEffect(() => {
    if (openHistorial) reloadHistorial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openHistorial, clientId, selectedDeviceId]);

  // Filtro tabla principal
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (items || []).filter((it) => {
      if (onlyAlerts && !it.hasAlerts) return false;
      const u = it.ultimo || {};
      if (!term) return true;
      return [u.hostname, u.username, it.id, u.model, u.brand, u.manufacturer].some(
        (v) => (v || "").toLowerCase().includes(term)
      );
    });
  }, [items, q, onlyAlerts]);

  return (
    <LayoutWithSidebar>
    <div className="min-h-screen bg-gray-50 relative">
      {/* Badge debug (BORRAR si no lo necesitas) */}
      <div className="fixed bottom-3 right-3 z-[10000] text-xs px-2 py-1 rounded bg-black/70 text-white">
        modal: {openHistorial ? "abierto" : "cerrado"}
      </div>

      {/* Barra fija superior */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 2000,
          backgroundColor: "#007acc",
          color: "white",
          padding: "14px 10px",
          boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
          textAlign: "center",
          fontWeight: 900,
          fontSize: "32px",
          letterSpacing: "1px",
        }}
      >
        MONITOREO EQUIPOS OFICINA BUENAVENTURA
      </div>

      {/* Contenido */}
      <div className="pt-28 px-4 md:px-8 pb-8 max-w-[120rem] mx-auto overflow-x-auto">
        {/* Filtros */}
        <div className="flex flex-col md:flex-row gap-3 md:items-center mb-4">
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por hostname, usuario, modelo, marca"
            className="w-full md:w-96 px-3 py-2 border rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={onlyAlerts}
              onChange={(e) => setOnlyAlerts(e.target.checked)}
            />
            Solo con alertas
          </label>
          <div className="text-sm text-gray-500 md:ml-auto">
            
          </div>

          {/* Selección de columnas + Exportar */}
          <div className="relative flex items-center gap-2">
            <details className="relative">
              <summary className="cursor-pointer text-sm px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 select-none">
                Seleccionar columnas
              </summary>
              <div className="absolute right-0 mt-2 w-80 max-h-80 overflow-auto p-3 bg-white border rounded-xl shadow-lg z-20">
                <div className="flex justify-between mb-2">
                  <button type="button" className="text-xs underline" onClick={() => setSelectedCols(colOptions)}>Todas</button>
                  <button type="button" className="text-xs underline" onClick={() => setSelectedCols([])}>Ninguna</button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {colOptions.map((h) => (
                    <label key={h} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={selectedCols.includes(h)}
                        onChange={() => toggleCol(h)}
                      />
                      <span className="truncate" title={h}>{h}</span>
                    </label>
                  ))}
                </div>
              </div>
            </details>

            <button
              type="button"
              onClick={exportToExcel}
              disabled={selectedCols.length === 0}
              className="bg-green-600 disabled:opacity-50 text-white px-4 py-2 rounded-xl hover:bg-green-700 transition text-sm"
              title={selectedCols.length === 0 ? "Selecciona al menos una columna" : "Exportar a Excel"}
            >
              Exportar a Excel
            </button>
          </div>
          <div className="hidden" />
          <div className="text-sm text-gray-500 md:ml-auto">
Mostrando {filtered.length} de {items.length}
          </div>

          {/* Botón Descargar Agente */}
          <a
            href="/agents/agente-logisport.zip"
            download="agente-logisport.zip"
            className="bg-blue-700 text-white px-4 py-2 rounded-xl hover:bg-blue-800 transition text-sm flex items-center gap-2"
            title="Descargar agente de monitoreo para instalar en los equipos"
          >
            ⬇️ Descargar Agente
          </a>

          {/* Botón Historial */}
          <button
            onClick={() => {
              setSelectedDeviceId(null);
              setOpenHistorial(true);
            }}
            className="bg-red-600 text-white px-4 py-2 rounded-xl hover:bg-red-700 transition text-sm"
          >
            Historial de apagados no controlados
          </button>
        </div>

        {/* Tabla principal */}
        <div
          className="mt-6 bg-white rounded-2xl shadow-sm"
          style={{
            overflowX: "auto",
            overflowY: "auto",
            maxHeight: "calc(100vh - 220px)",
          }}
        >
          <style jsx>{`
            .grid-table {
              border-collapse: separate;
              border-spacing: 0;
              table-layout: fixed;
              width: 100%;
              min-width: 2800px;
            }
            .grid-table th,
            .grid-table td {
              border: 2px solid #9ca3af;
              padding: 12px 14px;
              line-height: 1.45rem;
              vertical-align: middle;
              word-break: break-word;
              overflow-wrap: break-word;
              white-space: normal;
            }
            .grid-table thead th {
              position: sticky;
              top: 0;
              background: #f3f4f6;
              z-index: 10;
              border-bottom: 3px solid #4b5563;
            }

            .minw-host { min-width: 220px; max-width: 240px; }
            .minw-user { min-width: 180px; max-width: 200px; }
            .minw-brand { min-width: 160px; max-width: 200px; }
            .minw-model { min-width: 220px; max-width: 260px; }

            .minw-serial { min-width: 200px; max-width: 260px; }
            .minw-cpuv  { min-width: 140px; max-width: 180px; text-align:center; }
            .minw-cpun  { min-width: 260px; max-width: 320px; }

            .minw-os { min-width: 220px; max-width: 260px; }
            .minw-uptime { min-width: 100px; max-width: 120px; text-align:center; }

            .minw-cpu,
            .minw-memused,
            .minw-memtot,
            .minw-mempct,
            .minw-batt,
            .minw-bstat,
            .minw-type,
            .minw-temp,
            .minw-desk,
            .minw-office,
            .minw-tags,
            .minw-agent,
            .minw-upd {
              text-align: center;
            }

            .truncate {
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
          `}</style>

          <table className="grid-table text-[14px]">
            <thead>
              <tr>
                {[
                  "Hostname",
                  "Usuario",
                  "Marca",
                  "Modelo",
                  "Serial",
                  "CPU Marca",
                  "CPU Modelo",
                  "SO",
                  "Uptime",
                  "CPU %",
                  "CPU Temp (°C)",
                  "Mem usada",
                  "Mem total",
                  "Mem %",
                  "Batería",
                  "Estado bat.",
                  "Discos (Libre %)",
                  "Tipo disco",
                  "Temp",
                  "Escritorio",
                  "Office",
                  "Tags",
                  "Versión Agente",
                  "Última lectura",
                  "Actualizado",
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={25} className="px-3 py-4 text-center text-gray-600">
                    Cargando…
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={25} className="px-3 py-4 text-center text-gray-600">
                    No hay equipos que coincidan con el filtro.
                  </td>
                </tr>
              )}
              {!loading &&
                filtered.map((it) => {
                  const u = it.ultimo || {};
                  const brand = u.brand || u.manufacturer || "—";
                  const model = u.model || "—";
                  const serial = u.serial || u.device?.serial || "—";
                  const cpuVendor = u.cpuVendor || u.cpu?.vendor || "—";
                  const cpuName = u.cpuName || u.cpu?.name || "—";
                  const os = u.os || "—";
                  
                  const cpu =
                    typeof u.cpuLoadPct === "number" ? `${u.cpuLoadPct}%` : "—";
                  const cpuTempVal =
                    typeof u.cpuTempC === "number" ? Math.round(u.cpuTempC) :
                    typeof u.cpu?.tempC === "number" ? Math.round(u.cpu.tempC) :
                    null;
                  const cpuTemp = cpuTempVal !== null ? `${cpuTempVal}°C` : "—";
                  const isHot = cpuTempVal !== null && cpuTempVal >= 90;
                  const memUsed = fmtGB(u.memory?.usedMb);
                  const memTotal = fmtGB(u.memory?.totalMb);
                  const memPct =
                    typeof u.memory?.usedPct === "number"
                      ? `${u.memory.usedPct}%`
                      : "—";
                  const battPctVal =
                    typeof u.battery?.percent === "number"
                      ? clamp01(u.battery.percent)
                      : null;
                  const battPct = battPctVal !== null ? `${battPctVal}%` : "—";
                  const battStatus = u.battery?.status || "N/A";
                  const uptime = fmtMinutes(u.uptimeMin);
                  const tags = Array.isArray(u.tags) ? u.tags : [];
                  const tempSize = fmtMBorGB(u.temp?.sizeMB);
                  const deskSize = fmtMBorGB(u.desktop?.sizeMB);
                  const officeDisplay =
                    [u.office?.edition || u.office?.product, u.office?.version]
                      .filter(Boolean)
                      .join(" — ") || "—";

                  return (
                    <tr
                      key={it.id}
                      className={`odd:bg-white even:bg-gray-50 hover:bg-indigo-50 ${isHot ? "bg-red-50" : ""}`}
                    >
                      <td className="minw-host">{u.hostname || it.id}</td>
                      <td className="minw-user">{u.username || "—"}</td>
                      <td className="minw-brand">{brand}</td>
                      <td className="minw-model">{model}</td>

                      <td className="minw-serial truncate" title={serial}>
                        {serial}
                      </td>
                      <td className="minw-cpuv">{cpuVendor}</td>
                      <td className="minw-cpun truncate" title={cpuName}>
                        {cpuName}
                      </td>

                      <td className="minw-os">{os}</td>
                      <td className="minw-uptime">{uptime}</td>

                      <td className="minw-cpu">{cpu}</td>
                      <td className="minw-cputemp">{cpuTemp}</td>
                      <td className="minw-memused">{memUsed}</td>
                      <td className="minw-memtot">{memTotal}</td>
                      <td className="minw-mempct">{memPct}</td>

                      <td className="minw-batt">{battPct}</td>
                      <td className="minw-bstat">{battStatus}</td>

                      <td className="minw-disk">
                        <DiskCell disks={u.storage?.disks} />
                      </td>
                      <td className="minw-type">
                        <DiskTypeCell disks={u.storage?.disks} />
                      </td>

                      <td className="minw-temp">{tempSize}</td>
                      <td className="minw-desk">{deskSize}</td>
                      <td className="minw-office">{officeDisplay}</td>

                      <td className="minw-tags">
                        {tags.length === 0 ? (
                          <span className="text-gray-500">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {tags.map((t) => (
                              <span
                                key={t}
                                className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700 border border-gray-300"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      <td className="minw-agent">{u.agentVersion || "—"}</td>
                      <td className="minw-upd" style={{ whiteSpace: "nowrap", color: u.ts ? "#059669" : "#9ca3af", fontWeight: u.ts ? 700 : 400 }}>
                        {u.ts
                          ? new Date(u.ts).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
                          : "—"}
                      </td>
                      <td className="minw-upd">
                        {it.updatedAt
                          ? new Date(it.updatedAt).toLocaleString("es-CO")
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {!loading && errorMsg && (
          <div className="mt-4 p-3 rounded-xl bg-red-50 text-red-700 text-sm">
            {errorMsg}
          </div>
        )}
      </div>

      {/* =========================
          MODAL por portal (z-[9999])
          ========================= */}
      <InlinePortalModal
        show={openHistorial}
        onClose={() => setOpenHistorial(false)}
        title={
          selectedDeviceId
            ? `Historial de Apagados — ${selectedDeviceId}`
            : "Historial de Apagados No Controlados"
        }
      >
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-gray-600">
            {loadingHistorial ? "Cargando…" : `${historialEventos.length} evento(s)`}
          </div>
          <button
            onClick={() => reloadHistorial()}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 hover:bg-gray-100"
          >
            Recargar
          </button>
        </div>

        {errorHistorial && (
          <div className="mb-3 p-2 rounded-lg bg-red-50 text-red-700 text-sm">
            {errorHistorial}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 text-left font-bold">Equipo</th>
                <th className="px-4 py-2 text-left font-bold">Usuario</th>
                <th className="px-4 py-2 text-left font-bold">Fecha y hora del apagado</th>
                <th className="px-4 py-2 text-left font-bold">Hora registro</th>
                <th className="px-4 py-2 text-left font-bold">Versión Agente</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {loadingHistorial ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-600">
                    Cargando…
                  </td>
                </tr>
              ) : historialEventos.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-600">
                    No hay eventos registrados.
                  </td>
                </tr>
              ) : (
                historialEventos.map((ev) => (
                  <tr key={ev.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-bold text-red-700">{ev.hostname}</td>
                    <td className="px-4 py-2">{ev.username}</td>
                    <td className="px-4 py-2 font-mono text-sm">{ev.fechaLocal || `${ev.fecha} ${ev.hora}`}</td>
                    <td className="px-4 py-2 text-gray-500 text-xs">{ev.fecha} {ev.hora}</td>
                    <td className="px-4 py-2">{ev.agentVersion}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </InlinePortalModal>


    </div>
    </LayoutWithSidebar>
  );
}