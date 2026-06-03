@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
powershell -Command "Select-String -Path pages\nomina\index.js -Pattern 'liquidar|Liquidar|historial|nomina-ciamsa' | Select-Object LineNumber,Line | Format-Table -Wrap" > index_lines.txt
type index_lines.txt
pause
