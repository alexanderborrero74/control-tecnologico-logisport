@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
powershell -Command "$lines = Get-Content pages\nomina\matriz.js; $lines[2165..2195] | ForEach-Object -Begin {$i=2166} -Process { '{0}: {1}' -f $i++, $_ }" > fn_trab.txt
type fn_trab.txt
pause
