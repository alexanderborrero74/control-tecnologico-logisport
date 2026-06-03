@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
powershell -Command "Select-String -Path pages\nomina\matriz.js -Pattern 'todosTrabajadores|listaTrabajadores' | Select-Object LineNumber,Line | Format-Table -Wrap" > lista_trab.txt
type lista_trab.txt
pause
