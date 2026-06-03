@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
powershell -Command "$lines = Get-Content pages\nomina\matriz.js; $lines[3750..3830] | ForEach-Object -Begin {$i=3751} -Process { '{0}: {1}' -f $i++, $_ }" > spia_form.txt
type spia_form.txt
pause
