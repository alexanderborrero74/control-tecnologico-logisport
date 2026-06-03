@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
powershell -Command "$lines = Get-Content pages\nomina\matriz.js; $lines[3285..3380] | ForEach-Object -Begin {$i=3286} -Process { '{0}: {1}' -f $i++, $_ }" > personal_spia_impl.txt
type personal_spia_impl.txt
pause
