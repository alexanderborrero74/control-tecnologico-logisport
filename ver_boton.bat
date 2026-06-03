@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
powershell -Command "$lines = Get-Content pages\nomina\matriz.js; $lines[4175..4200] | ForEach-Object -Begin {$i=4176} -Process { '{0}: {1}' -f $i++, $_ }" > boton_guardar.txt
type boton_guardar.txt
pause
