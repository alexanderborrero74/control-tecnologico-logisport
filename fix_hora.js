const fs = require('fs');
const path = 'pages/nomina/matriz.js';
let content = fs.readFileSync(path, 'utf8');

// Helper de hora que se inyectará en el JSX
const oldDisplay = `{op.fechaStr||"—"}</td>`;
const newDisplay = `{op.fechaStr||"—"}{op.creadoEn ? <span style={{display:"block",fontSize:"0.68rem",color:"#94a3b8",fontFamily:"monospace"}}>{(() => { try { const d = op.creadoEn?.toDate ? op.creadoEn.toDate() : new Date(op.creadoEn?.seconds*1000||op.creadoEn); return d.toLocaleTimeString("es-CO",{hour:"2-digit",minute:"2-digit"}); } catch(e){ return ""; } })()}</span> : null}</td>`;

let count = 0;
while (content.includes(oldDisplay)) {
  content = content.replace(oldDisplay, newDisplay);
  count++;
  if (count > 5) break; // seguridad
}

fs.writeFileSync(path, content, 'utf8');
console.log('OK - hora agregada en', count, 'celdas de fecha');
