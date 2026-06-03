@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
powershell -Command "$lines = Get-Content pages\nomina\index.js; $lines[125..155] | ForEach-Object -Begin {$i=126} -Process { '{0}: {1}' -f $i++, $_ }" > index_menu.txt
type index_menu.txt
pause
