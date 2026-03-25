// pages/api/documentacion.js - Actualizado para soportar carpetas por año
import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  const { folder } = req.query;
  const baseDir = path.join(process.cwd(), 'public', 'documentacion');

  try {
    // Si se solicita una carpeta específica
    if (folder) {
      const folderPath = path.join(baseDir, folder);
      
      if (!fs.existsSync(folderPath)) {
        return res.status(404).json({ error: 'Carpeta no encontrada' });
      }

      const archivos = fs.readdirSync(folderPath)
        .filter(nombre => {
          const ext = nombre.split('.').pop().toLowerCase();
          return ['pdf', 'xlsx', 'xls', 'docx', 'doc'].includes(ext);
        })
        .map(nombre => ({
          nombre,
          ruta: `${folder}/${nombre}`,
          tipo: 'archivo'
        }));

      return res.status(200).json(archivos);
    }

    // Si no se especifica carpeta, devolver estructura con carpetas y archivos raíz
    const items = fs.readdirSync(baseDir);
    const estructura = {
      carpetas: [],
      archivos: []
    };

    items.forEach(item => {
      const itemPath = path.join(baseDir, item);
      const stats = fs.statSync(itemPath);

      if (stats.isDirectory()) {
        // Es una carpeta
        estructura.carpetas.push({
          nombre: item,
          tipo: 'carpeta'
        });
      } else {
        // Es un archivo
        const ext = item.split('.').pop().toLowerCase();
        if (['pdf', 'xlsx', 'xls', 'docx', 'doc'].includes(ext)) {
          estructura.archivos.push({
            nombre: item,
            ruta: item,
            tipo: 'archivo'
          });
        }
      }
    });

    res.status(200).json(estructura);
  } catch (error) {
    console.error('Error al leer documentos TI:', error);
    res.status(500).json({ error: 'No se pudieron cargar los archivos.' });
  }
}
