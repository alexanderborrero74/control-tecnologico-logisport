@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
powershell -Command "Select-String -Path pages\nomina\matriz.js -Pattern 'trabsServicio|cuadDiaTrab|trabajadoresActi|Trabajadores activos|trabajadorActivo|setTrabsServicio' | Select-Object LineNumber,Line | Format-Table -Wrap" > personal_lines.txt
type personal_lines.txt
pause
