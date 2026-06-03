@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
powershell -Command "
$file = 'pages\nomina\matriz.js'
$content = Get-Content $file -Raw -Encoding UTF8

$oldFunc = @'
        const exportarCSV=()=>{
'@

$newFunc = @'
        const exportarXLS=()=>{
          const hdr=['Trabajador','Cedula','Fecha','Cuadrilla','Servicio','Cantidad','Neto'];
          const esc=(v)=>String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
          const mkRow=(vals,types)=>'<Row>'+vals.map((v,i)=>'<Cell><Data ss:Type=""'+types[i]+'"">'+(types[i]==='Number'?(v||0):esc(v))+'</Data></Cell>').join('')+'</Row>';
          const rows=filasFilt.map(f=>mkRow([f.nombre,f.cedula,f.fecha,f.cuadrilla,f.servicio,f.cantidad,f.neto],['String','String','String','String','String','Number','Number']));
          const xml='<?xml version=""1.0""?><Workbook xmlns=""urn:schemas-microsoft-com:office:spreadsheet"" xmlns:ss=""urn:schemas-microsoft-com:office:spreadsheet""><Worksheet ss:Name=""Detalle""><Table>'+mkRow(hdr,hdr.map(()=>'String'))+rows.join('')+'</Table></Worksheet></Workbook>';
          const blob=new Blob([xml],{type:'application/vnd.ms-excel'});
          const url=URL.createObjectURL(blob);const a=document.createElement('a');
          a.href=url;a.download='detalle_'+periodoDesde+'_'+periodoHasta+'.xls';document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
        };
'@

if ($content -match [regex]::Escape('const exportarCSV=()=>')) {
    $content = $content -replace 'const exportarCSV=\(\)=>\{[\s\S]*?\};', $newFunc.Trim()
    Set-Content $file $content -Encoding UTF8 -NoNewline
    Write-Host 'REEMPLAZO OK - funcion exportarXLS creada'
} else {
    Write-Host 'NO ENCONTRADO - verificar manualmente'
}
"
pause
