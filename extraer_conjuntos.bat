@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
echo Extrayendo version con Conjuntos...
git show ae7ffdb:pages/nomina/matriz.js > matriz_con_conjuntos.js
echo LISTO - archivo: matriz_con_conjuntos.js
pause
