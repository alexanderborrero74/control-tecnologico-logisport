@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
powershell -Command "Select-String -Path pages\nomina\matriz.js -Pattern 'cuadrillasOtros|cuadrillasXCliente|trabajadoresCruz|cargaCuad|loadCuad|cuadrillasAll|allCuadrillas|setCuadrillas' | Select-Object LineNumber,Line | Format-Table -Wrap" > cuad_otros.txt
type cuad_otros.txt
pause
