/** Target can slot — matches the product editor 3:4 preview. */
export const CAN_IMAGE_WIDTH = 360;
export const CAN_IMAGE_HEIGHT = 480;

/**
 * Scale an image file into a 3:4 can slot (contain, centered on light background).
 * Returns a JPEG blob ready for upload.
 */
export async function scaleImageToCanSlot(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file");
  }
  if (file.size > 20 * 1024 * 1024) {
    throw new Error("Image is too large (max 20 MB)");
  }

  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = CAN_IMAGE_WIDTH;
    canvas.height = CAN_IMAGE_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not prepare image canvas");

    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, CAN_IMAGE_WIDTH, CAN_IMAGE_HEIGHT);

    const scale = Math.min(
      CAN_IMAGE_WIDTH / bitmap.width,
      CAN_IMAGE_HEIGHT / bitmap.height
    );
    const drawW = bitmap.width * scale;
    const drawH = bitmap.height * scale;
    const dx = (CAN_IMAGE_WIDTH - drawW) / 2;
    const dy = (CAN_IMAGE_HEIGHT - drawH) / 2;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, dx, dy, drawW, drawH);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.88)
    );
    if (!blob) throw new Error("Could not encode image");
    return blob;
  } finally {
    bitmap.close();
  }
}
