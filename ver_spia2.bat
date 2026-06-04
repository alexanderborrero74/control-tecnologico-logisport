@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
powershell -Command "$lines = Get-Content pages\nomina\matriz.js; $lines[2548..2590] | ForEach-Object -Begin {$i=2549} -Process { '{0}: {1}' -f $i++, $_ }" > guardar_spia2.txt
type guardar_spia2.txt
pause
