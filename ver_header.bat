@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
powershell -Command "$lines = Get-Content pages\nomina\matriz.js; $lines[2953..2995] | ForEach-Object -Begin {$i=2954} -Process { '{0}: {1}' -f $i++, $_ }" > header_lines.txt
type header_lines.txt
pause
