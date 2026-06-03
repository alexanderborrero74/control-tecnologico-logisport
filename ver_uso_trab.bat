@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
powershell -Command "Select-String -Path pages\nomina\matriz.js -Pattern 'cuadDiaTrabajadores|trabsServicio|Trabajadores ad|trabajadoresAd|setTrabsServicio|setCuadDiaTrab' | Select-Object LineNumber,Line | Format-Table -Wrap" > uso_trab.txt
type uso_trab.txt
pause
