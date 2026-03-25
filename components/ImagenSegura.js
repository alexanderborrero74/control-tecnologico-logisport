// components/ImagenSegura.js
import { useState, useEffect } from 'react';

export default function ImagenSegura({ url, alt, style, onClick }) {
  const [imagenData, setImagenData] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!url) return;

    const cargarImagen = async () => {
      setCargando(true);
      setError(false);

      try {
        // Usar fetch para obtener la imagen como blob
        const response = await fetch(`/api/proxy-imagen?url=${encodeURIComponent(url)}`);
        
        if (!response.ok) {
          throw new Error('Error al cargar imagen');
        }

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        setImagenData(objectUrl);
        setCargando(false);
      } catch (err) {
        console.error('Error cargando imagen:', err);
        setError(true);
        setCargando(false);
      }
    };

    cargarImagen();

    // Cleanup: liberar el object URL cuando el componente se desmonte
    return () => {
      if (imagenData) {
        URL.revokeObjectURL(imagenData);
      }
    };
  }, [url]);

  if (cargando) {
    return (
      <div style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f0f0' }}>
        <span>Cargando...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ffe0e0' }}>
        <span>❌ Error</span>
      </div>
    );
  }

  return (
    <img 
      src={imagenData} 
      alt={alt || 'Imagen'} 
      style={style}
      onClick={onClick}
      onError={() => setError(true)}
    />
  );
}
