// Some Chromium devices can capture a live frame without displaying a <video>.
// Feature-detect the method: "ImageCapture" alone does not imply grabFrame.
type FrameSource = {
  new(track: MediaStreamTrack): { grabFrame(): Promise<ImageBitmap> };
  prototype: { grabFrame?: unknown };
};

export function getFrameSource() {
  const api = (globalThis as unknown as { ImageCapture?: FrameSource }).ImageCapture;
  return typeof api === "function" && typeof api.prototype?.grabFrame === "function" ? api : null;
}

export async function frameToJpeg(source: CanvasImageSource, width: number, height: number, number: number) {
  if (!width || !height) throw new Error("The camera frame is not ready. Please try again.");
  const scale = Math.min(1, 1600 / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  try {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("The photo could not be captured");
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.78));
    if (!blob) throw new Error("The photo could not be captured");
    const now = Date.now();
    return new File([blob], `vehicle-${now}-${number}.jpg`, { type: "image/jpeg", lastModified: now });
  } finally {
    canvas.width = canvas.height = 0;
  }
}
