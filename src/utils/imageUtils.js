/**
 * Resize a base64 PNG (from DALL-E) to a small JPEG using the browser Canvas API.
 * Keeps Firestore documents well under the 1 MB document limit.
 *
 * @param {string} base64Png  Raw base64 PNG string (no data: prefix)
 * @param {number} size       Target width & height in pixels (default 300)
 * @param {number} quality    JPEG quality 0–1 (default 0.82)
 * @returns {Promise<string>} Resized base64 JPEG string (no data: prefix)
 */
export function resizeBase64Image(base64Png, size = 300, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      // Fill white background (PNG may have transparency)
      ctx.fillStyle = '#1A1A1A';
      ctx.fillRect(0, 0, size, size);
      // Draw image centered/cropped to square
      const s = Math.min(img.width, img.height);
      const ox = (img.width - s) / 2;
      const oy = (img.height - s) / 2;
      ctx.drawImage(img, ox, oy, s, s, 0, 0, size, size);
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(dataUrl.split(',')[1]); // return base64 only, no prefix
    };
    img.onerror = reject;
    img.src = `data:image/png;base64,${base64Png}`;
  });
}
