// pages/api/documentacion.js
import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  const directorio = path.join(process.cwd(), 'public', 'documentacion');

  try {
    const archivos = fs.readdirSync(directorio)
      .filter(nombre => nombre.endsWith('.pdf'));

    res.status(200).json(archivos);
  } catch (error) {
    console.error('Error al leer documentos TI:', error);
    res.status(500).json({ error: 'No se pudieron cargar los archivos PDF.' });
  }
}
