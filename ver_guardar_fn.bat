@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
powershell -Command "$lines = Get-Content pages\nomina\matriz.js; $lines[2303..2360] | ForEach-Object -Begin {$i=2304} -Process { '{0}: {1}' -f $i++, $_ }" > guardar_spia_fn.txt
type guardar_spia_fn.txt
pause
