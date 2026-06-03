@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
powershell -Command "Select-String -Path pages\nomina\matriz.js -Pattern 'PERSONAL SPIA|PERSONAL_SPIA|spiaAdicional|SPIA ADICIONAL|trabajadoresSpia|spiaWorkers|setCuadDiaTrabajadores|cuadDiaTrabajadores' | Select-Object LineNumber,Line | Format-Table -Wrap" > terrestre_personal.txt
type terrestre_personal.txt
pause
