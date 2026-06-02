@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
python -c "
with open('pages/nomina/matriz.js','r',encoding='utf-8') as f:
    content = f.read()
idx = content.find('const guardar = async')
print('Posicion:', idx)
print(repr(content[idx:idx+300]))
" > resultado_patch.txt 2>&1
echo LISTO - abre resultado_patch.txt
pause
