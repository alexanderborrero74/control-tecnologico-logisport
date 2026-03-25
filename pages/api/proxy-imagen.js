// pages/api/proxy-imagen.js
export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'URL de imagen requerida' });
  }

  // Validar que sea una URL de Firebase Storage
  if (!url.includes('firebasestorage.googleapis.com') && !url.includes('firebasestorage.app')) {
    return res.status(400).json({ error: 'URL no válida' });
  }

  try {
    // Obtener la imagen desde Firebase
    const response = await fetch(url);
    
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Error al obtener imagen' });
    }

    // Obtener el buffer de la imagen
    const imageBuffer = await response.arrayBuffer();
    
    // Obtener el tipo de contenido
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    // Configurar headers para la respuesta
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // Cache 1 año
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // Enviar la imagen
    return res.send(Buffer.from(imageBuffer));
    
  } catch (error) {
    console.error('Error en proxy de imagen:', error);
    return res.status(500).json({ error: 'Error al procesar la imagen' });
  }
}
