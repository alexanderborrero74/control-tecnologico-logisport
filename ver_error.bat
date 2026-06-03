@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
powershell -Command "$lines = Get-Content pages\nomina\matriz.js; $lines[4413..4425] | ForEach-Object -Begin {$i=4414} -Process { Write-Output ('{0}: {1}' -f $i++, $_) }" > lineas_error.txt
type lineas_error.txt
pause
