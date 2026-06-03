@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
powershell -Command "Select-String -Path pages\nomina\matriz.js -Pattern 'trabsServicio|cuadDiaTrab|Trabajadores adicionales|trabajadoresAdicionales|setTrabsServicio' | Select-Object LineNumber,Line | Format-Table -Wrap" > adicional_lines.txt
type adicional_lines.txt
pause
