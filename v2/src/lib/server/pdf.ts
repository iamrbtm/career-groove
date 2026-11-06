import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

function wrapText(
  text: string,
  font: { widthOfTextAtSize: (text: string, size: number) => number },
  size: number,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

export async function renderPdf(title: string, bodyMarkdown: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const margin = 54;
  const ink = rgb(0.06, 0.06, 0.05);
  let page = pdf.addPage([612, 792]);
  let { width, height } = page.getSize();
  let y = height - margin;

  const newPage = () => {
    page = pdf.addPage([612, 792]);
    ({ width, height } = page.getSize());
    y = height - margin;
  };

  const ensure = (needed: number) => {
    if (y - needed < margin) newPage();
  };

  const draw = (text: string, size: number, font: typeof regular, gap = 6) => {
    const maxWidth = width - margin * 2;
    const lines = wrapText(text, font, size, maxWidth);
    for (const line of lines) {
      ensure(size + 2);
      page.drawText(line, { x: margin, y, size, font, color: ink });
      y -= size + 2;
    }
    y -= gap;
  };

  draw(title, 22, bold, 14);

  for (const rawLine of bodyMarkdown.split("\n")) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      y -= 8;
      continue;
    }
    if (line.startsWith("### ")) {
      ensure(18);
      draw(line.slice(4), 11, bold, 4);
    } else if (line.startsWith("## ")) {
      ensure(22);
      draw(line.slice(3), 13, bold, 5);
    } else if (line.startsWith("# ")) {
      ensure(26);
      draw(line.slice(2), 17, bold, 8);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      draw(`• ${line.slice(2)}`, 10, regular, 2);
    } else {
      draw(line, 10, regular, 2);
    }
  }

  return pdf.save();
}
