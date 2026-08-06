import { PDFDocument, PDFPage, PDFFont, StandardFonts, rgb } from "pdf-lib";

type Candidate = { name: string; email: string; phone?: string; location?: string };
type CoverLetterInput = {
  candidate: Candidate;
  targetTitle?: string;
  targetCompany?: string;
  body: string;
  signatureImage?: Uint8Array<ArrayBufferLike>;
};

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const LEFT = 72;
const RIGHT = 72;
const TOP = 720;
const BOTTOM = 54;
const CONTENT_WIDTH = PAGE_WIDTH - LEFT - RIGHT;
const BODY_SIZE = 11.2;
const BODY_LEADING = 17;
const META_SIZE = 9.8;
const ACCENT_YELLOW = rgb(1, 0.74, 0);
const ACCENT_CORAL = rgb(1, 0.2, 0.08);
const ACCENT_BLUE = rgb(0.02, 0.63, 0.82);
const DARK = rgb(0.08, 0.08, 0.08);
const MUTED = rgb(0.34, 0.34, 0.34);

export async function createCoverLetterPdf(input: CoverLetterInput) {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const signature = input.signatureImage ? await document.embedPng(input.signatureImage) : null;
  const parsed = parseCoverLetterBody(input.body);

  document.setTitle(`${input.candidate.name} Cover Letter${input.targetTitle ? ` - ${input.targetTitle}` : ""}`);
  document.setAuthor(input.candidate.name);
  document.setSubject(input.targetTitle ? `Cover letter tailored for ${input.targetTitle}` : "Cover Letter");
  document.setCreator("CareerGroove");

  let page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = drawHeader(page, { regular, bold }, input.candidate);

  ({ page, y } = drawMetaBlock({
    document,
    page,
    y,
    regular,
    bold,
    candidate: input.candidate,
    targetCompany: input.targetCompany,
    targetTitle: input.targetTitle,
  }));

  const blocks = [parsed.greeting, ...parsed.bodyParagraphs].filter(Boolean);

  for (const block of blocks) {
    ({ page, y } = drawParagraphBlock({
      document,
      page,
      y,
      text: block,
      regular,
      bold,
      before: block === parsed.greeting ? 10 : 0,
      after: 10,
    }));
  }

  const signatureHeight = signature ? signature.scaleToFit(160, 52).height + 54 : 56;
  if (y - signatureHeight < BOTTOM) {
    page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = drawHeader(page, { regular, bold }, input.candidate);
    ({ page, y } = drawMetaBlock({
      document,
      page,
      y,
      regular,
      bold,
      candidate: input.candidate,
      targetCompany: input.targetCompany,
      targetTitle: input.targetTitle,
      compact: true,
    }));
  }

  page.drawText(parsed.closing, { x: LEFT, y, size: BODY_SIZE, font: regular, color: DARK });
  y -= 30;

  if (signature) {
    const scaled = signature.scaleToFit(160, 52);
    page.drawImage(signature, { x: LEFT, y: y - scaled.height + 8, width: scaled.width, height: scaled.height });
    y -= Math.max(scaled.height, 28);
  }

  page.drawText(clean(input.candidate.name || "Candidate"), { x: LEFT, y: y - BODY_SIZE, size: BODY_SIZE, font: bold, color: DARK });
  const footerText = [input.candidate.email, input.candidate.phone, input.candidate.location].filter(Boolean).join("  •  ");
  if (footerText) {
    const footerY = 26;
    page.drawLine({ start: { x: LEFT, y: footerY + 14 }, end: { x: PAGE_WIDTH - RIGHT, y: footerY + 14 }, thickness: 0.7, color: rgb(0.87, 0.87, 0.87) });
    page.drawText(footerText, { x: LEFT, y: footerY, size: 8.8, font: regular, color: MUTED });
  }
  return document.save();
}

function drawHeader(page: PDFPage, fonts: { regular: PDFFont; bold: PDFFont }, candidate: Candidate) {
  const swatchY = TOP - 2;
  page.drawRectangle({ x: 23.5, y: swatchY, width: 10.5, height: 11, color: ACCENT_YELLOW });
  page.drawRectangle({ x: 35, y: swatchY, width: 10.5, height: 11, color: ACCENT_CORAL });
  page.drawRectangle({ x: 46.5, y: swatchY, width: 10.5, height: 11, color: ACCENT_BLUE });
  page.drawText(clean(candidate.name || "Cover Letter"), { x: LEFT, y: TOP, size: 15, font: fonts.bold, color: DARK });

  const contact = [candidate.phone, candidate.email, candidate.location].filter(Boolean).join("  |  ");
  const contactLines = wrapText(clean(contact), fonts.regular, 9.8, CONTENT_WIDTH);
  contactLines.forEach((line, index) => {
    page.drawText(line, { x: LEFT, y: TOP - 21 - index * 12, size: 9.8, font: fonts.regular, color: DARK });
  });

  const dividerY = TOP - 37 - Math.max(contactLines.length - 1, 0) * 12;
  page.drawLine({ start: { x: LEFT, y: dividerY }, end: { x: PAGE_WIDTH - RIGHT, y: dividerY }, thickness: 1, color: rgb(0.82, 0.82, 0.82) });
  return dividerY - 28;
}

function drawMetaBlock({
  document,
  page,
  y,
  regular,
  bold,
  candidate,
  targetCompany,
  targetTitle,
  compact = false,
}: {
  document: PDFDocument;
  page: PDFPage;
  y: number;
  regular: PDFFont;
  bold: PDFFont;
  candidate: Candidate;
  targetCompany?: string;
  targetTitle?: string;
  compact?: boolean;
}) {
  const employerLines = [targetCompany, targetTitle].filter(Boolean).map((value) => clean(value || ""));
  const senderLines = [candidate.location, candidate.email, candidate.phone].filter(Boolean).map((value) => clean(value || ""));
  const rightBlock = [formatDateLine(), ...employerLines];
  const leftWidth = 220;
  const rightWidth = CONTENT_WIDTH - leftWidth - 28;
  const topY = y;

  senderLines.forEach((line, index) => {
    page.drawText(line, { x: LEFT, y: topY - index * 12, size: META_SIZE, font: regular, color: MUTED });
  });
  rightBlock.forEach((line, index) => {
    const textWidth = regular.widthOfTextAtSize(line, META_SIZE);
    page.drawText(line, { x: LEFT + leftWidth + 28 + Math.max(0, rightWidth - textWidth), y: topY - index * 12, size: META_SIZE, font: index === 0 ? bold : regular, color: DARK });
  });

  let nextY = topY - Math.max(senderLines.length, rightBlock.length, 1) * 12 - (compact ? 16 : 22);
  if (nextY < BOTTOM + 80) {
    page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    nextY = drawHeader(page, { regular, bold }, candidate);
  }
  return { page, y: nextY };
}

function drawParagraphBlock({
  document,
  page,
  y,
  text,
  regular,
  bold,
  before = 0,
  after = 0,
}: {
  document: PDFDocument;
  page: PDFPage;
  y: number;
  text: string;
  regular: PDFFont;
  bold: PDFFont;
  before?: number;
  after?: number;
}) {
  y -= before;
  const lines = wrapText(text, regular, BODY_SIZE, CONTENT_WIDTH);
  for (const line of lines) {
    if (y - BODY_LEADING < BOTTOM) {
      page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = drawHeader(page, { regular, bold }, { name: "", email: "" });
    }
    page.drawText(line, { x: LEFT, y, size: BODY_SIZE, font: regular, color: DARK });
    y -= BODY_LEADING;
  }
  y -= after;
  return { page, y };
}

function parseCoverLetterBody(text: string) {
  const paragraphs = clean(text)
    .split(/\n\s*\n/)
    .map((part) => part.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);

  const first = paragraphs[0] || "";
  const greeting = /^dear\b/i.test(first) ? first : "Dear Hiring Manager,";

  let bodyParagraphs = /^dear\b/i.test(first) ? paragraphs.slice(1) : paragraphs;
  let closing = "Sincerely,";

  const closingIndex = bodyParagraphs.findIndex((paragraph, index) =>
    index >= Math.max(bodyParagraphs.length - 2, 0) && /^(sincerely|best regards|kind regards|regards|thank you|respectfully)[,!]?\s*$/i.test(paragraph));
  if (closingIndex >= 0) {
    closing = bodyParagraphs[closingIndex].replace(/\s+/g, " ").trim();
    bodyParagraphs = bodyParagraphs.slice(0, closingIndex);
  }

  bodyParagraphs = bodyParagraphs.filter((paragraph) => paragraph.toLowerCase() !== "dear hiring manager," && paragraph.toLowerCase() !== closing.toLowerCase());
  if (!bodyParagraphs.length) bodyParagraphs = ["I am excited to submit my application and would welcome the chance to discuss how my experience can support your team."];

  return { greeting, bodyParagraphs, closing };
}

function formatDateLine() {
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(new Date());
}

function wrapText(text: string, font: PDFFont, size: number, width: number) {
  const words = clean(text).split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  return lines;
}

function clean(value: string) {
  return value.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
