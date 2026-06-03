@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
powershell -Command "Get-Content pages\nomina\matriz.js | Select-Object -Index (3037..3060) | ForEach-Object { $i = 3038; $_ }" > lineas_3038.txt
powershell -Command "$lines = Get-Content pages\nomina\matriz.js; $lines[3037..3060] | ForEach-Object -Begin {$i=3038} -Process { Write-Output ('{0}: {1}' -f $i++, $_) }" > lineas_3038.txt
type lineas_3038.txt
pause
