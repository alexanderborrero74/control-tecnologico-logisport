const fs = require('fs');
const path = 'pages/nomina/matriz.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Eliminar useEffect
const effPattern = /\/\/ Recalcular neto cuando cambian los trabajadores adicionales[\s\S]*?\[trabsAdicionales\]\);/;
if (effPattern.test(content)) {
  content = content.replace(effPattern, '');
  console.log('OK - useEffect eliminado');
} else {
  console.log('useEffect no encontrado (puede ya estar eliminado)');
}

// 2. Reemplazar el display del neto para calcular con adicionales en tiempo real
// El neto se muestra como: form.netoCalculado>0?formatCOP(form.netoCalculado):"—"
// Lo reemplazamos para calcular el neto correcto inline

const oldNetoDisplay = 
  '<span style={{fontWeight:"800",color:"#065f46",fontSize:"1.3rem",fontFamily:"monospace"}}>\n' +
  '                {form.netoCalculado>0?formatCOP(form.netoCalculado):"—"}\n' +
  '              </span>';

const newNetoDisplay =
  '<span style={{fontWeight:"800",color:"#065f46",fontSize:"1.3rem",fontFamily:"monospace"}}>\n' +
  '                {(()=>{\n' +
  '                  if(!form.servicioValor||form.tipoSeleccion==="trabajador") return form.netoCalculado>0?formatCOP(form.netoCalculado):"—";\n' +
  '                  const _p=(parseInt(form.personas)||1)+(trabsAdicionales?.length||0);\n' +
  '                  const _n=Math.round(calcularNetoOperacion(parseFloat(form.servicioValor)||0,_p,parseInt(form.cantidad)||1)*100)/100;\n' +
  '                  return _n>0?formatCOP(_n):"—";\n' +
  '                })()}\n' +
  '              </span>';

if (content.includes(oldNetoDisplay)) {
  content = content.replace(oldNetoDisplay, newNetoDisplay);
  console.log('OK - neto display actualizado con calculo inline');
} else {
  console.log('SKIP - patron neto display no encontrado');
}

fs.writeFileSync(path, content, 'utf8');
console.log('LISTO');
