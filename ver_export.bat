@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
powershell -Command "$lines = Get-Content pages\nomina\matriz.js; $lines[4429..4455] | ForEach-Object -Begin {$i=4430} -Process { '{0}: {1}' -f $i++, $_ }" > lineas_export.txt
type lineas_export.txt
pause
