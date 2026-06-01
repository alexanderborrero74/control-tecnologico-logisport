@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
echo Mostrando que cambios hizo ae7ffdb en matriz.js...
git show ae7ffdb -- pages/nomina/matriz.js > diff_ae7ffdb.txt
echo LISTO - abre diff_ae7ffdb.txt
pause
