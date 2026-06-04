@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
powershell -Command "$lines = Get-Content pages\nomina\matriz.js; $lines[2536..2595] | ForEach-Object -Begin {$i=2537} -Process { '{0}: {1}' -f $i++, $_ }" > guardar_spia3.txt
type guardar_spia3.txt
pause
