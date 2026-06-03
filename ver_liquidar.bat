@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
powershell -Command "Select-String -Path pages\nomina\liquidar.js -Pattern 'Cargar trabajadores|cargarTrabajadores|filas|setFilas|clienteActivo|cliente2|calcularNomina|netoAPagar|CIAMSA|bloque|fijo|FIJO' | Select-Object LineNumber,Line | Format-Table -Wrap" > liquidar_struct.txt
type liquidar_struct.txt
pause
