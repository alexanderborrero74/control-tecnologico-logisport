@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
powershell -Command "Select-String -Path pages\nomina\matriz.js -Pattern 'guardarOperacion|const guardar =|cuadrillaDiaGuardar|trabajadoresAsisten|asistentesForm' | Select-Object LineNumber,Line | Format-Table -Wrap" > guardar_lines.txt
type guardar_lines.txt
pause
