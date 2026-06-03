@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
powershell -Command "$lines = Get-Content pages\nomina\matriz.js; $lines[2130..2165] | ForEach-Object -Begin {$i=2131} -Process { '{0}: {1}' -f $i++, $_ }" > carga_cuad.txt
type carga_cuad.txt
pause
