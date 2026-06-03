@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
powershell -Command "Select-String -Path pages\nomina\matriz.js -Pattern 'trabSpia|busqSpiaCiamsa|cuadrillaDiaToggle|filtSpia|filtCliente|setBusqSpia' | Select-Object LineNumber,Line | Format-Table -Wrap" > terrestre_states.txt
type terrestre_states.txt
pause
