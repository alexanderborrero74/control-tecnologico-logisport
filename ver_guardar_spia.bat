@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
powershell -Command "$lines = Get-Content pages\nomina\matriz.js; $lines[2562..2585] | ForEach-Object -Begin {$i=2563} -Process { '{0}: {1}' -f $i++, $_ }" > guardar_spia.txt
type guardar_spia.txt
pause
