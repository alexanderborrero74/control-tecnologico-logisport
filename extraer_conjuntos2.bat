@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
echo Extrayendo version CON Conjuntos (commit anterior a ae7ffdb)...
git show 9bcd532:pages/nomina/matriz.js > matriz_conjuntos_REAL.js
echo LISTO - archivo: matriz_conjuntos_REAL.js
echo Buscando "conjunto" en ese archivo...
findstr /i "conjunto\|showConj\|Alfa\|Beta\|acumulado\|totalMes" matriz_conjuntos_REAL.js
pause
