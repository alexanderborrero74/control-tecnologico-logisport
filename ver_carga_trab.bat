@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
powershell -Command "Select-String -Path pages\nomina\matriz.js -Pattern 'cargarTrabajadores|setTodosTrabajadores|activos|clienteIds' | Select-Object LineNumber,Line | Format-Table -Wrap" > carga_trab.txt
type carga_trab.txt
pause
