@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
powershell -Command "$lines = Get-Content pages\nomina\matriz.js; $lines[3909..3980] | ForEach-Object -Begin {$i=3910} -Process { '{0}: {1}' -f $i++, $_ }" > despues_asistencia.txt
type despues_asistencia.txt
pause
