@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
findstr /n "Ver Totales\|showTotalesPanel\|Panel Totales\|STATS" pages\nomina\matriz.js > busqueda_totales.txt
type busqueda_totales.txt
pause
