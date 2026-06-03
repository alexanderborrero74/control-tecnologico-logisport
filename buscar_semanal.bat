@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
powershell -Command "Select-String -Path pages\nomina\matriz.js -Pattern 'semanaDesde|semanaHasta|semanal|SEMANAL' | Select-Object LineNumber,Line | Format-Table -Wrap" > semanal_lines.txt
type semanal_lines.txt
pause
