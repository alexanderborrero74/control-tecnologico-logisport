@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
node -e "
const fs=require('fs');
const lines=fs.readFileSync('pages/nomina/matriz.js','utf8').split('\n');
console.log(lines.slice(2165,2195).map((l,i)=>(2166+i)+': '+l).join('\n'));
"
pause
