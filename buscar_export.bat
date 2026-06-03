@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
powershell -Command "Select-String -Path pages\nomina\matriz.js -Pattern 'CSV|csv|blob|download|export|Export|detalle|Detalle' | Select-Object LineNumber,Line | Format-Table -AutoSize" > export_lines.txt
type export_lines.txt
pause
