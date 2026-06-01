@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
echo === TODOS LOS COMMITS DE MATRIZ.JS === > conjuntos_commits.txt
git log --oneline pages/nomina/matriz.js >> conjuntos_commits.txt
echo. >> conjuntos_commits.txt
echo === COMMITS CON "conjunto" === >> conjuntos_commits.txt
git log -S "conjunto" --oneline pages/nomina/matriz.js >> conjuntos_commits.txt
echo. >> conjuntos_commits.txt
echo === COMMITS CON "Alfa" === >> conjuntos_commits.txt
git log -S "Alfa" --oneline pages/nomina/matriz.js >> conjuntos_commits.txt
echo. >> conjuntos_commits.txt
echo === COMMITS CON "showConj" === >> conjuntos_commits.txt
git log -S "showConj" --oneline pages/nomina/matriz.js >> conjuntos_commits.txt
echo LISTO - revisa conjuntos_commits.txt
pause
