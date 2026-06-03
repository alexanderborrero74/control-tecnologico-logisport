@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
powershell -Command "$lines = Get-Content pages\nomina\matriz.js; $lines[2984..3020] | ForEach-Object -Begin {$i=2985} -Process { '{0}: {1}' -f $i++, $_ }" > cliente_lines.txt
type cliente_lines.txt
pause
