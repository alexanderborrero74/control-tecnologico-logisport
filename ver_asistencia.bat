@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
powershell -Command "$lines = Get-Content pages\nomina\matriz.js; $lines[3828..3920] | ForEach-Object -Begin {$i=3829} -Process { '{0}: {1}' -f $i++, $_ }" > asistencia_panel.txt
type asistencia_panel.txt
pause
