/** Longer side of a picture after the browser made it smaller: plenty for the screen, for A4 and for the KI to read. */
const MAX_SIDE = 2000;

/**
 * Makes a large picture smaller in the browser (JPEG), so the upload is fast also on a tablet. Every JPEG is
 * drawn anew, which drops its EXIF data (camera, place, time of a phone photo). Small PNG and WebP files stay as they are.
 */
export async function shrinkImage(file: File, maxSide = MAX_SIDE): Promise<File> {
  if (typeof createImageBitmap !== "function") return file;
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    return file; // the server decides
  }
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const photo = file.type === "image/jpeg";
  if (scale === 1 && !photo && file.size <= 1.5 * 1024 * 1024) {
    bmp.close();
    return file;
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  // transparent drawings stay readable on white paper
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.86));
  if (!blob || (!photo && blob.size >= file.size)) return file;
  return new File([blob], file.name.replace(/\.[a-z0-9]+$/i, "") + ".jpg", { type: "image/jpeg" });
}
