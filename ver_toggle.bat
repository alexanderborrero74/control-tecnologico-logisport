@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
powershell -Command "$lines = Get-Content pages\nomina\matriz.js; $lines[2295..2320] | ForEach-Object -Begin {$i=2296} -Process { '{0}: {1}' -f $i++, $_ }" > toggle_fn.txt
type toggle_fn.txt
pause
