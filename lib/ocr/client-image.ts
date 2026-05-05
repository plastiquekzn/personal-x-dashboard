export type PreparedImage = {
  previewDataUrl: string;
  metricsFocusDataUrl: string;
  dateOcrDataUrl: string;
  bodyOcrDataUrl: string;
  metricsStripOcrDataUrl: string;
  repliesOcrDataUrl: string;
  likesOcrDataUrl: string;
  viewsOcrDataUrl: string;
  width: number;
  height: number;
};

export function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read screenshot file."));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load screenshot preview."));
    image.src = dataUrl;
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function createScaledCanvas(image: HTMLImageElement, scaleFactor: number) {
  const maxWidth = 2600;
  const scale = image.width > maxWidth ? maxWidth / image.width : scaleFactor;
  const width = Math.max(Math.round(image.width * scale), image.width);
  const height = Math.max(Math.round(image.height * scale), image.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas is not available in this browser.");
  }

  context.drawImage(image, 0, 0, width, height);
  return { canvas, context };
}

function createBinaryCanvas(image: HTMLImageElement) {
  const { canvas, context } = createScaledCanvas(image, 1.9);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < pixels.data.length; i += 4) {
    const red = pixels.data[i];
    const green = pixels.data[i + 1];
    const blue = pixels.data[i + 2];
    const grayscale = 0.299 * red + 0.587 * green + 0.114 * blue;
    const binary = grayscale > 120 ? 0 : 255;

    pixels.data[i] = binary;
    pixels.data[i + 1] = binary;
    pixels.data[i + 2] = binary;
  }

  context.putImageData(pixels, 0, 0);
  return canvas;
}

function createInvertedGrayscaleCanvas(image: HTMLImageElement) {
  const { canvas, context } = createScaledCanvas(image, 2.4);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < pixels.data.length; i += 4) {
    const red = pixels.data[i];
    const green = pixels.data[i + 1];
    const blue = pixels.data[i + 2];
    const grayscale = 0.299 * red + 0.587 * green + 0.114 * blue;
    const inverted = 255 - grayscale;

    pixels.data[i] = inverted;
    pixels.data[i + 1] = inverted;
    pixels.data[i + 2] = inverted;
  }

  context.putImageData(pixels, 0, 0);
  return canvas;
}

function createCroppedDataUrl(
  sourceCanvas: HTMLCanvasElement,
  crop: {
    leftRatio: number;
    topRatio: number;
    widthRatio: number;
    heightRatio: number;
    eraseLeftRatio?: number;
  }
) {
  const sourceWidth = sourceCanvas.width;
  const sourceHeight = sourceCanvas.height;
  const sx = Math.round(clamp(crop.leftRatio, 0, 1) * sourceWidth);
  const sy = Math.round(clamp(crop.topRatio, 0, 1) * sourceHeight);
  const sw = Math.max(1, Math.round(clamp(crop.widthRatio, 0, 1) * sourceWidth));
  const sh = Math.max(1, Math.round(clamp(crop.heightRatio, 0, 1) * sourceHeight));
  const cropCanvas = document.createElement("canvas");

  cropCanvas.width = sw;
  cropCanvas.height = sh;

  const cropContext = cropCanvas.getContext("2d");

  if (!cropContext) {
    throw new Error("Canvas is not available in this browser.");
  }

  cropContext.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, sw, sh);

  if (crop.eraseLeftRatio && crop.eraseLeftRatio > 0) {
    const eraseWidth = Math.round(clamp(crop.eraseLeftRatio, 0, 1) * sw);
    cropContext.fillStyle = "#ffffff";
    cropContext.fillRect(0, 0, eraseWidth, sh);
  }

  return cropCanvas.toDataURL("image/png");
}

export async function prepareImageForOcr(file: File): Promise<PreparedImage> {
  const previewDataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(previewDataUrl);
  const bodyCanvas = createBinaryCanvas(image);
  const metricCanvas = createInvertedGrayscaleCanvas(image);
  const previewCanvas = createScaledCanvas(image, 1).canvas;

  return {
    previewDataUrl,
    metricsFocusDataUrl: createCroppedDataUrl(previewCanvas, {
      leftRatio: 0.03,
      topRatio: 0.87,
      widthRatio: 0.94,
      heightRatio: 0.11
    }),
    dateOcrDataUrl: createCroppedDataUrl(metricCanvas, {
      leftRatio: 0.385,
      topRatio: 0.002,
      widthRatio: 0.22,
      heightRatio: 0.055
    }),
    bodyOcrDataUrl: createCroppedDataUrl(bodyCanvas, {
      leftRatio: 0.07,
      topRatio: 0.028,
      widthRatio: 0.72,
      heightRatio: 0.27
    }),
    metricsStripOcrDataUrl: createCroppedDataUrl(metricCanvas, {
      leftRatio: 0.04,
      topRatio: 0.94,
      widthRatio: 0.84,
      heightRatio: 0.055
    }),
    repliesOcrDataUrl: createCroppedDataUrl(metricCanvas, {
      leftRatio: 0.07,
      topRatio: 0.94,
      widthRatio: 0.14,
      heightRatio: 0.055,
      eraseLeftRatio: 0.58
    }),
    likesOcrDataUrl: createCroppedDataUrl(metricCanvas, {
      leftRatio: 0.45,
      topRatio: 0.94,
      widthRatio: 0.14,
      heightRatio: 0.055,
      eraseLeftRatio: 0.46
    }),
    viewsOcrDataUrl: createCroppedDataUrl(metricCanvas, {
      leftRatio: 0.66,
      topRatio: 0.94,
      widthRatio: 0.18,
      heightRatio: 0.055,
      eraseLeftRatio: 0.34
    }),
    width: image.width,
    height: image.height
  };
}

export function dataUrlToFile(dataUrl: string, filename: string, mimeType: string) {
  const [meta, payload] = dataUrl.split(",");

  if (!meta || !payload) {
    throw new Error("Corrupted screenshot preview data.");
  }

  const mimeMatch = meta.match(/data:(.*?);base64/);
  const mime = mimeMatch?.[1] || mimeType || "image/png";
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new File([bytes], filename, { type: mime });
}
