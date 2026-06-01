@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
echo Extrayendo commit d3e2421 (anterior a ae7ffdb)...
git show d3e2421:pages/nomina/matriz.js > matriz_conjuntos_d3e2421.js
echo LISTO
echo Buscando "conjunto" o "Alfa" o "Beta"...
findstr /i "conjunto\|showConj\|Alfa\|Beta\|totalMes\|acumulados" matriz_conjuntos_d3e2421.js
pause
