// utils/generarInformePDF.js
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { BRAND } from "./branding";

export function generarInformeTecnicoPDF(servicio) {
  try {
    console.log("Generando PDF para servicio:", servicio);
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const marginLeft = 15;
    const marginRight = 15;
    const contentWidth = pageWidth - marginLeft - marginRight;
    
    let yPos = 20;

    // ========== HEADER ==========
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(11, 61, 145);
    doc.text("INFORME TÉCNICO DE SERVICIO", pageWidth / 2, yPos, { align: "center" });
    
    yPos += 10;
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(`${BRAND.clientName} - ${BRAND.subtitle}`, pageWidth / 2, yPos, { align: "center" });
    
    yPos += 15;

    // Línea separadora
    doc.setDrawColor(200, 200, 200);
    doc.line(marginLeft, yPos, pageWidth - marginRight, yPos);
    yPos += 10;

    // ========== INFORMACIÓN GENERAL ==========
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("Información General", marginLeft, yPos);
    yPos += 8;

    const infoGeneral = [
      ["Código de Servicio", servicio.codigo || servicio.codigoservicio || "N/A"],
      ["Consecutivo", servicio.consecutivo || "Servicio Interno"],
      ["Fecha", servicio.fecha || "N/A"],
      ["Usuario", servicio.usuario || "N/A"],
      ["Cargo", servicio.cargo || "N/A"],
      ["Equipo", servicio.equipo || "N/A"],
      ["Tipo de Soporte", servicio.tipoSoporte || servicio.modalidad || "N/A"],
    ];

    autoTable(doc, {
      startY: yPos,
      head: [],
      body: infoGeneral,
      theme: "grid",
      headStyles: { fillColor: [11, 61, 145] },
      styles: { fontSize: 10, cellPadding: 3 },
      columnStyles: {
        0: { fontStyle: "bold", fillColor: [240, 240, 240], cellWidth: 60 },
        1: { cellWidth: contentWidth - 60 }
      },
      margin: { left: marginLeft, right: marginRight },
    });

    yPos = doc.lastAutoTable.finalY + 10;

    // ========== DESCRIPCIÓN DEL SERVICIO ==========
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Descripción del Servicio", marginLeft, yPos);
    yPos += 8;

    const descripcionServicio = [
      ["Falla Reportada", servicio.falla || "N/A"],
      ["Diagnóstico", servicio.diagnostico || "N/A"],
      ["Solución Aplicada", servicio.solucion || "N/A"],
    ];

    autoTable(doc, {
      startY: yPos,
      head: [],
      body: descripcionServicio,
      theme: "grid",
      headStyles: { fillColor: [11, 61, 145] },
      styles: { fontSize: 10, cellPadding: 3 },
      columnStyles: {
        0: { fontStyle: "bold", fillColor: [240, 240, 240], cellWidth: 60 },
        1: { cellWidth: contentWidth - 60 }
      },
      margin: { left: marginLeft, right: marginRight },
    });

    yPos = doc.lastAutoTable.finalY + 10;

    // ========== ACTIVIDADES REALIZADAS ==========
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Actividades Realizadas", marginLeft, yPos);
    yPos += 8;

    const actividades = [];
    
    // Actividades legacy
    if (servicio.limpieza) actividades.push(["✓", "Limpieza de equipo"]);
    if (servicio.mantenimiento) actividades.push(["✓", "Mantenimiento general"]);
    if (servicio.cambioClave) actividades.push(["✓", "Cambio de contraseña"]);
    if (servicio.visitaCorrectiva) actividades.push(["✓", "Visita correctiva"]);
    
    // Actividades nuevas
    if (servicio.visitaPreventiva) {
      actividades.push(["✓", `Visita preventiva (${servicio.visitaPreventivaModalidad || "N/A"})`]);
    }
    if (servicio.mantenimientoPreventivo) {
      const detalles = [];
      if (servicio.mantPrevHW) detalles.push("Hardware");
      if (servicio.mantPrevSW) detalles.push("Software");
      const detalle = detalles.length > 0 ? ` - ${detalles.join(", ")}` : "";
      actividades.push(["✓", `Mantenimiento preventivo (${servicio.mantPrevModalidad || "N/A"})${detalle}`]);
    }
    if (servicio.limpiezaExterna) actividades.push(["✓", "Limpieza externa"]);
    if (servicio.mantenimientoInterno) actividades.push(["✓", "Mantenimiento interno"]);

    if (actividades.length === 0) {
      actividades.push(["", "No se registraron actividades específicas"]);
    }

    autoTable(doc, {
      startY: yPos,
      head: [],
      body: actividades,
      theme: "striped",
      headStyles: { fillColor: [11, 61, 145] },
      styles: { fontSize: 10, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 10, halign: "center", fontStyle: "bold", textColor: [0, 128, 0] },
        1: { cellWidth: contentWidth - 10 }
      },
      margin: { left: marginLeft, right: marginRight },
    });

    yPos = doc.lastAutoTable.finalY + 10;

    // ========== PARTES UTILIZADAS ==========
    if (servicio.partes && servicio.partes.length > 0) {
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Partes Utilizadas", marginLeft, yPos);
      yPos += 8;

      const partesData = servicio.partes.map(p => [
        p.nombre || p || "N/A",
        typeof p === 'string' ? "1" : (p.cantidad || "N/A"),
        typeof p === 'string' ? "" : (p.observacion || "")
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [["Nombre", "Cantidad", "Observación"]],
        body: partesData,
        theme: "grid",
        headStyles: { fillColor: [11, 61, 145], textColor: [255, 255, 255] },
        styles: { fontSize: 10, cellPadding: 3 },
        margin: { left: marginLeft, right: marginRight },
      });

      yPos = doc.lastAutoTable.finalY + 10;
    }

    // ========== INFORMACIÓN ADICIONAL ==========
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Información Adicional", marginLeft, yPos);
    yPos += 8;

    const infoAdicional = [
      ["Técnico Responsable", servicio.tecnico || "N/A"],
      ["Estado del Servicio", (servicio.servicioFinalizado === "si" || servicio.finalizado === "si") ? "FINALIZADO" : "PENDIENTE"],
      ["Observaciones", servicio.observacion || "Sin observaciones"],
    ];

    if (servicio.aplazado === "si") {
      infoAdicional.push(["Servicio Aplazado", "SÍ"]);
      infoAdicional.push(["Motivo Aplazamiento", servicio.motivoAplazado || "N/A"]);
    }

    autoTable(doc, {
      startY: yPos,
      head: [],
      body: infoAdicional,
      theme: "grid",
      headStyles: { fillColor: [11, 61, 145] },
      styles: { fontSize: 10, cellPadding: 3 },
      columnStyles: {
        0: { fontStyle: "bold", fillColor: [240, 240, 240], cellWidth: 60 },
        1: { cellWidth: contentWidth - 60 }
      },
      margin: { left: marginLeft, right: marginRight },
    });

    yPos = doc.lastAutoTable.finalY + 15;

    // ========== FIRMAS ==========
    const firmaY = doc.internal.pageSize.height - 40;
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    
    // Firma técnico
    doc.line(marginLeft, firmaY, marginLeft + 70, firmaY);
    doc.text("Firma Técnico", marginLeft, firmaY + 5);
    doc.setFont("helvetica", "bold");
    doc.text(servicio.tecnico || "N/A", marginLeft, firmaY + 10);
    
    // Firma usuario
    const firmaUsuarioX = pageWidth - marginRight - 70;
    doc.setFont("helvetica", "normal");
    doc.line(firmaUsuarioX, firmaY, pageWidth - marginRight, firmaY);
    doc.text("Firma Usuario", firmaUsuarioX, firmaY + 5);
    doc.setFont("helvetica", "bold");
    doc.text(servicio.usuario || "N/A", firmaUsuarioX, firmaY + 10);

    // ========== FOOTER ==========
    const footerY = doc.internal.pageSize.height - 15;
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Generado: ${new Date().toLocaleString("es-CO")} | ${BRAND.clientName} - ${BRAND.appName}`,
      pageWidth / 2,
      footerY,
      { align: "center" }
    );

    console.log("PDF generado exitosamente");
    return doc;
  } catch (error) {
    console.error("Error generando PDF:", error);
    alert("Error al generar el PDF: " + error.message);
    return null;
  }
}

export function imprimirInformeTecnico(servicio) {
  try {
    console.log("Intentando imprimir informe...");
    const doc = generarInformeTecnicoPDF(servicio);
    if (!doc) return;
    
    doc.autoPrint();
    window.open(doc.output("bloburl"), "_blank");
    console.log("Ventana de impresión abierta");
  } catch (error) {
    console.error("Error al imprimir:", error);
    alert("Error al imprimir el informe: " + error.message);
  }
}

export function descargarInformeTecnico(servicio) {
  try {
    console.log("Intentando descargar PDF...");
    const doc = generarInformeTecnicoPDF(servicio);
    if (!doc) return;
    
    const nombreArchivo = `Informe_Tecnico_${servicio.codigo || servicio.consecutivo || servicio.consecutivoInterno || "SIN_CODIGO"}.pdf`;
    doc.save(nombreArchivo);
    console.log("PDF descargado:", nombreArchivo);
  } catch (error) {
    console.error("Error al descargar:", error);
    alert("Error al descargar el PDF: " + error.message);
  }
}
