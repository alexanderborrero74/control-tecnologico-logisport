// pages/api/upload-image.js - Método directo sin Firebase Admin
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('[DEBUG] Endpoint upload-image llamado');

    // Leer el body completo
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    
    console.log('[DEBUG] Body size:', buffer.length);

    // Parsear multipart/form-data manualmente
    const boundary = req.headers['content-type']?.split('boundary=')[1];
    if (!boundary) {
      console.error('[ERROR] No boundary found in content-type');
      return res.status(400).json({ error: 'Invalid content-type' });
    }

    // Convertir a string para buscar partes
    const bodyStr = buffer.toString('binary');
    const parts = bodyStr.split(`--${boundary}`);
    
    console.log('[DEBUG] Parts found:', parts.length);

    let fileBuffer = null;
    let fileName = 'uploaded-file';
    let mimeType = 'application/octet-stream';
    let folder = 'uploads';

    // Buscar la parte del archivo
    for (const part of parts) {
      if (part.includes('Content-Disposition: form-data;') && part.includes('filename=')) {
        const fileNameMatch = part.match(/filename="([^"]+)"/);
        if (fileNameMatch) {
          fileName = fileNameMatch[1];
        }

        const contentTypeMatch = part.match(/Content-Type: ([^\r\n]+)/);
        if (contentTypeMatch) {
          mimeType = contentTypeMatch[1];
        }

        const fileStart = part.indexOf('\r\n\r\n') + 4;
        const fileEnd = part.lastIndexOf('\r\n');
        if (fileStart > 3 && fileEnd > fileStart) {
          const fileContent = part.substring(fileStart, fileEnd);
          fileBuffer = Buffer.from(fileContent, 'binary');
        }
      } else if (part.includes('name="folder"')) {
        const folderMatch = part.match(/\r\n\r\n([^\r\n]+)/);
        if (folderMatch) {
          folder = folderMatch[1];
        }
      }
    }

    if (!fileBuffer) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Subir directamente a Firebase Storage usando la API REST
    const uniqueFileName = `${folder}/${Date.now()}_${fileName}`;
    console.log('[DEBUG] Uploading to:', uniqueFileName);

    // Usar la API REST de Firebase Storage - BUCKET CORRECTO
    const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/ti-logisport-sas.firebasestorage.app/o?name=${encodeURIComponent(uniqueFileName)}`;
    
    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': mimeType,
      },
      body: fileBuffer,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('[ERROR] Upload failed:', uploadResponse.status, errorText);
      
      // Intentar con el bucket alternativo
      const altUploadUrl = `https://firebasestorage.googleapis.com/v0/b/ti-logisport-sas.appspot.com/o?name=${encodeURIComponent(uniqueFileName)}`;
      
      const altResponse = await fetch(altUploadUrl, {
        method: 'POST',
        headers: {
          'Content-Type': mimeType,
        },
        body: fileBuffer,
      });
      
      if (!altResponse.ok) {
        const altErrorText = await altResponse.text();
        console.error('[ERROR] Alt upload also failed:', altResponse.status, altErrorText);
        return res.status(500).json({ 
          error: 'Upload to Firebase failed',
          details: errorText,
          altDetails: altErrorText
        });
      }
      
      const altData = await altResponse.json();
      const altPublicUrl = `https://firebasestorage.googleapis.com/v0/b/ti-logisport-sas.appspot.com/o/${encodeURIComponent(uniqueFileName)}?alt=media`;
      
      return res.status(200).json({ 
        url: altPublicUrl,
        success: true 
      });
    }

    const uploadData = await uploadResponse.json();
    console.log('[SUCCESS] File uploaded');

    // URL pública
    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/ti-logisport-sas.firebasestorage.app/o/${encodeURIComponent(uniqueFileName)}?alt=media`;

    return res.status(200).json({ 
      url: publicUrl,
      success: true 
    });

  } catch (error) {
    console.error('[ERROR] Exception:', error);
    return res.status(500).json({ 
      error: 'Server error',
      message: error.message
    });
  }
}
