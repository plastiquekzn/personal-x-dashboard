import type { OcrLayoutItemInput } from "@/lib/ocr/parser";

type TesseractBbox = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

type TesseractLine = {
  bbox: TesseractBbox;
  text: string;
  confidence?: number;
};

type TesseractParagraph = {
  lines?: TesseractLine[];
};

type TesseractBlock = {
  paragraphs?: TesseractParagraph[];
};

function bboxToPoly(bbox: TesseractBbox) {
  return [
    { x: bbox.x0, y: bbox.y0 },
    { x: bbox.x1, y: bbox.y0 },
    { x: bbox.x1, y: bbox.y1 },
    { x: bbox.x0, y: bbox.y1 }
  ];
}

export function extractLayoutItemsFromTesseractBlocks(blocks: TesseractBlock[]) {
  const items: OcrLayoutItemInput[] = [];

  for (const block of blocks ?? []) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) {
        if (!line.text?.trim()) {
          continue;
        }

        items.push({
          text: line.text,
          score: line.confidence ?? 0,
          poly: bboxToPoly(line.bbox)
        });
      }
    }
  }

  return items;
}
