// utils/cloudinaryUpload.js — LOGISPORT
// Misma cuenta y preset que CADEGRAN (dsomqay6y / cadegran_fotos)
const CLOUD_NAME    = "dsomqay6y";
const UPLOAD_PRESET = "cadegran_fotos"; // preset unsigned ya existente en la cuenta

export async function subirACloudinary(archivo, onProgress) {
  const formData = new FormData();
  formData.append("file", archivo);
  formData.append("upload_preset", UPLOAD_PRESET);

  const esImagen = archivo.type.startsWith("image/");
  const esVideo  = archivo.type.startsWith("video/");
  const resourceType = esImagen ? "image" : esVideo ? "video" : "raw";

  if (onProgress) onProgress(20);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`,
    { method: "POST", body: formData }
  );

  if (onProgress) onProgress(80);

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || "Error al subir a Cloudinary");
  }

  const data = await res.json();
  if (onProgress) onProgress(100);

  return {
    url:          data.secure_url,
    publicId:     data.public_id,
    size:         archivo.size,
    type:         archivo.type,
    resourceType,
  };
}
