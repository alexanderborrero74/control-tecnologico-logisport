@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
powershell -Command "$lines = Get-Content pages\nomina\matriz.js; $lines[3115..3155] | ForEach-Object -Begin {$i=3116} -Process { '{0}: {1}' -f $i++, $_ }" > todos_trab.txt
type todos_trab.txt
pause
