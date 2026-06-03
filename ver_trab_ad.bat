@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
powershell -Command "Select-String -Path pages\nomina\matriz.js -Pattern 'TRABAJADORES ADICIONALES|cuadsOtrosClientes|showTrabsPanel|busqTrabAd|trabsAdicionales' | Select-Object LineNumber,Line | Format-Table -Wrap" > trab_ad_lines.txt
type trab_ad_lines.txt
pause
