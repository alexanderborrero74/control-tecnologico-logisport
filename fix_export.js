const fs = require('fs');
const path = 'pages/nomina/matriz.js';
let content = fs.readFileSync(path, 'utf8');

// Reemplazar función exportarCSV por exportarXLS
const oldFn = /const exportarCSV=\(\)=>\{[\s\S]*?\};/;
const newFn = `const exportarXLS=()=>{
          const hdr=['Trabajador','Cedula','Fecha','Cuadrilla','Servicio','Cantidad','Neto'];
          const esc=(v)=>String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
          const row=(vals,types)=>'<Row>'+vals.map((v,i)=>'<Cell><Data ss:Type="'+types[i]+'">'+( types[i]==='Number'?(+v||0):esc(v))+'</Data></Cell>').join('')+'</Row>';
          const rows=filasFilt.map(f=>row([f.nombre,f.cedula,f.fecha,f.cuadrilla,f.servicio,f.cantidad,f.neto],['String','String','String','String','String','Number','Number']));
          const xml='<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Detalle"><Table>'+row(hdr,hdr.map(()=>'String'))+rows.join('')+'</Table></Worksheet></Workbook>';
          const blob=new Blob([xml],{type:'application/vnd.ms-excel'});
          const url=URL.createObjectURL(blob);const a=document.createElement('a');
          a.href=url;a.download=\`detalle_\${periodoDesde}_\${periodoHasta}.xls\`;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
        };`;

if (oldFn.test(content)) {
  content = content.replace(oldFn, newFn);
  // Cambiar onClick y texto del botón
  content = content.replace('onClick={exportarCSV}', 'onClick={exportarXLS}');
  content = content.replace(/Exportar CSV/g, 'Exportar XLS');
  fs.writeFileSync(path, content, 'utf8');
  console.log('OK - exportarCSV reemplazado por exportarXLS, archivo .xls');
} else {
  console.log('NO ENCONTRADO - buscando patron...');
  const idx = content.indexOf('exportarCSV');
  console.log('exportarCSV en posicion:', idx);
}
