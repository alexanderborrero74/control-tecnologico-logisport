@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
powershell -Command "$lines = Get-Content pages\nomina\matriz.js; $lines[259..320] | ForEach-Object -Begin {$i=260} -Process { '{0}: {1}' -f $i++, $_ }" > semanal_detail.txt
type semanal_detail.txt
pause
