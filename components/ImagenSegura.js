// components/ImagenSegura.js
import { useState } from 'react';

export default function ImagenSegura({ url, alt, style, onClick }) {
  const [error, setError] = useState(false);

  if (!url || error) {
    return (
      <div style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 32 }}>🖼️</span>
        <span style={{ fontSize: 12, color: '#9ca3af' }}>Sin imagen</span>
      </div>
    );
  }

  return (
    <img src={url} alt={alt || 'Imagen'} style={style} onClick={onClick} onError={() => setError(true)} />
  );
}
