import { PDFDocument, PDFPage, PDFFont, StandardFonts, rgb } from "pdf-lib";

export type ResumeExperience = {
  company: string;
  title: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  highlights: string[];
};

export type ResumeCredential = {
  name: string;
  issuer?: string;
  location?: string;
  date?: string;
  details?: string;
};

export type ResumeData = {
  summary: string;
  education: ResumeCredential[];
  workExperience: ResumeExperience[];
  certifications: ResumeCredential[];
  skills: string[];
};

type Candidate = { name: string; email: string; phone?: string; location?: string };
type TextFont = "regular" | "bold";
type Line = {
  text: string;
  font: TextFont;
  size: number;
  lineHeight: number;
  color: ReturnType<typeof rgb>;
  indent?: number;
  hangingIndent?: number;
  before?: number;
  after?: number;
};

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const LEFT = 72;
const RIGHT = 40;
const BOTTOM = 34;
const CONTENT_WIDTH = PAGE_WIDTH - LEFT - RIGHT;
const DARK = rgb(0.08, 0.08, 0.08);
const GRAY = rgb(0.38, 0.38, 0.38);

const stylePresets = [
  { body: 9.8, leading: 12.1, section: 15.2, sectionLeading: 18, sectionGap: 10, itemGap: 4.5 },
  { body: 9.2, leading: 11.2, section: 14.4, sectionLeading: 17, sectionGap: 8, itemGap: 3.5 },
  { body: 8.6, leading: 10.4, section: 13.6, sectionLeading: 16, sectionGap: 7, itemGap: 3 },
];

export async function createResumePdf({ candidate, resume, targetTitle }: { candidate: Candidate; resume: ResumeData; targetTitle?: string }) {
  const document = await PDFDocument.create();
  const page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const fonts = { regular, bold };

  document.setTitle(`${candidate.name} Resume${targetTitle ? ` - ${targetTitle}` : ""}`);
  document.setAuthor(candidate.name);
  document.setSubject(targetTitle ? `Resume tailored for ${targetTitle}` : "Resume");
  document.setCreator("CareerGroove");

  drawHeader(page, fonts, candidate);
  const top = headerBottom(fonts.regular, candidate);
  const fitted = fitResume(resume, fonts, top - BOTTOM);
  drawLines(page, fonts, fitted.lines, top);

  return document.save();
}

function drawHeader(page: PDFPage, fonts: { regular: PDFFont; bold: PDFFont }, candidate: Candidate) {
  const swatchY = 719;
  page.drawRectangle({ x: 23.5, y: swatchY, width: 10.5, height: 11, color: rgb(1, 0.74, 0) });
  page.drawRectangle({ x: 35, y: swatchY, width: 10.5, height: 11, color: rgb(1, 0.2, 0.08) });
  page.drawRectangle({ x: 46.5, y: swatchY, width: 10.5, height: 11, color: rgb(0.02, 0.63, 0.82) });
  page.drawText(clean(candidate.name || "Resume"), { x: LEFT, y: 720, size: 14.8, font: fonts.bold, color: DARK });

  const contact = [candidate.phone, candidate.email, candidate.location].filter(Boolean).join("  |  ");
  const contactLines = wrapText(clean(contact), fonts.regular, 9.8, CONTENT_WIDTH);
  contactLines.slice(0, 2).forEach((text, index) => {
    page.drawText(text, { x: LEFT, y: 699 - index * 12, size: 9.8, font: fonts.regular, color: DARK });
  });
}

function headerBottom(font: PDFFont, candidate: Candidate) {
  const contact = [candidate.phone, candidate.email, candidate.location].filter(Boolean).join("  |  ");
  return wrapText(clean(contact), font, 9.8, CONTENT_WIDTH).length > 1 ? 667 : 679;
}

function fitResume(original: ResumeData, fonts: { regular: PDFFont; bold: PDFFont }, availableHeight: number) {
  let resume = normalizeResume(original);
  for (const style of stylePresets) {
    const lines = buildLines(resume, style);
    if (measureLines(lines, fonts) <= availableHeight) return { lines, style };
  }

  // Keep the most relevant information first: shorten prose, remove optional skills,
  // then reduce low-priority bullets and older experience entries until the page fits.
  resume = { ...resume, summary: limitWords(resume.summary, 48) };
  const minimumSkills = resume.certifications.length ? 0 : Math.min(4, resume.skills.length);
  for (let round = 0; round < 30; round += 1) {
    for (const style of stylePresets.slice(1)) {
      const lines = buildLines(resume, style);
      if (measureLines(lines, fonts) <= availableHeight) return { lines, style };
    }
    // Certifications take priority when relevant. Skills are retained as the
    // replacement section when no certification applies to the target role.
    if (resume.skills.length > minimumSkills) {
      resume.skills.pop();
      continue;
    }
    const jobWithExtra = [...resume.workExperience].reverse().find((job) => job.highlights.length > 1);
    if (jobWithExtra) {
      jobWithExtra.highlights.pop();
      continue;
    }
    if (resume.workExperience.length > 2) {
      resume.workExperience.pop();
      continue;
    }
    const longest = resume.workExperience.flatMap((job) => job.highlights.map((text) => ({ job, text }))).sort((a, b) => b.text.length - a.text.length)[0];
    if (longest?.text.split(/\s+/).length > 12) {
      const index = longest.job.highlights.indexOf(longest.text);
      longest.job.highlights[index] = limitWords(longest.text, Math.max(12, longest.text.split(/\s+/).length - 6));
      continue;
    }
    break;
  }

  return { lines: buildLines(resume, stylePresets.at(-1)!), style: stylePresets.at(-1)! };
}

function normalizeResume(resume: ResumeData): ResumeData {
  return {
    summary: clean(resume.summary),
    education: (resume.education || []).slice(0, 4).map(normalizeCredential),
    workExperience: (resume.workExperience || []).slice(0, 5).map((job) => ({
      company: clean(job.company),
      title: clean(job.title),
      location: clean(job.location || ""),
      startDate: clean(job.startDate || ""),
      endDate: clean(job.endDate || ""),
      highlights: (job.highlights || []).slice(0, 3).map((item) => limitWords(clean(item), 26)).filter(Boolean),
    })),
    certifications: (resume.certifications || []).slice(0, 6).map(normalizeCredential),
    skills: [...new Set((resume.skills || []).map((skill) => limitWords(clean(skill), 6)).filter(Boolean))].slice(0, 10),
  };
}

function normalizeCredential(item: ResumeCredential): ResumeCredential {
  return {
    name: limitWords(clean(item.name), 20),
    issuer: limitWords(clean(item.issuer || ""), 20),
    location: limitWords(clean(item.location || ""), 10),
    date: limitWords(clean(item.date || ""), 8),
    details: limitWords(clean(item.details || ""), 18),
  };
}

function buildLines(resume: ResumeData, style: (typeof stylePresets)[number]): Line[] {
  const lines: Line[] = [];
  const section = (text: string) => lines.push({ text, font: "bold", size: style.section, lineHeight: style.sectionLeading, color: GRAY, before: lines.length ? style.sectionGap : 0, after: 2 });
  const body = (text: string, options: Partial<Line> = {}) => lines.push({ text, font: "regular", size: style.body, lineHeight: style.leading, color: DARK, ...options });
  const strong = (text: string, options: Partial<Line> = {}) => lines.push({ text, font: "bold", size: style.body, lineHeight: style.leading, color: GRAY, ...options });

  section("Summary");
  body(resume.summary || "Career summary not provided.");

  section("Education");
  if (resume.education.length) {
    resume.education.forEach((item, index) => {
      strong(joinParts([item.issuer, item.location, item.date]), { before: index ? style.itemGap : 0 });
      body(joinParts([item.name, item.details]));
    });
  } else body("Education details not provided.");

  section("Work Experience");
  if (resume.workExperience.length) {
    resume.workExperience.forEach((job, index) => {
      strong(joinParts([job.company?.toUpperCase(), job.title, job.location, dateRange(job.startDate, job.endDate)]), { before: index ? style.itemGap : 0 });
      job.highlights.forEach((highlight) => body(`•  ${highlight}`, { indent: 1, hangingIndent: 10 }));
    });
  } else body("Work experience not provided.");

  if (resume.certifications.length) {
    section("Certifications");
    resume.certifications.forEach((item, index) => {
      strong(joinParts([item.name, item.issuer, item.date]), { before: index ? 1 : 0 });
      if (item.details) body(item.details);
    });
  }
  if (resume.skills.length) {
    section("Skills");
    body(resume.skills.join("  •  "));
  }
  return lines;
}

function drawLines(page: PDFPage, fonts: { regular: PDFFont; bold: PDFFont }, lines: Line[], top: number) {
  let y = top;
  for (const line of lines) {
    y -= line.before || 0;
    const font = fonts[line.font];
    const indent = line.indent || 0;
    const wrapped = wrapText(line.text, font, line.size, CONTENT_WIDTH - indent, line.hangingIndent || 0);
    wrapped.forEach((text, index) => {
      page.drawText(text, {
        x: LEFT + indent + (index ? line.hangingIndent || 0 : 0),
        y: y - line.size,
        size: line.size,
        font,
        color: line.color,
      });
      y -= line.lineHeight;
    });
    y -= line.after || 0;
  }
}

function measureLines(lines: Line[], fonts: { regular: PDFFont; bold: PDFFont }) {
  return lines.reduce((height, line) => {
    const wrapped = wrapText(line.text, fonts[line.font], line.size, CONTENT_WIDTH - (line.indent || 0), line.hangingIndent || 0);
    return height + (line.before || 0) + wrapped.length * line.lineHeight + (line.after || 0);
  }, 0);
}

function wrapText(text: string, font: PDFFont, size: number, width: number, hangingIndent = 0) {
  const words = clean(text).split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    const lineWidth = lines.length ? width - hangingIndent : width;
    if (current && font.widthOfTextAtSize(candidate, size) > lineWidth) {
      lines.push(current);
      current = word;
    } else current = candidate;
  }
  if (current) lines.push(current);
  return lines;
}

function dateRange(start?: string, end?: string) {
  if (!start && !end) return "";
  return [start, end || "Present"].filter(Boolean).join(" - ");
}

function joinParts(values: Array<string | undefined>) {
  return values.map((value) => clean(value || "")).filter(Boolean).join(" | ");
}

function limitWords(value: string, max: number) {
  const words = clean(value).split(/\s+/).filter(Boolean);
  return words.length > max ? `${words.slice(0, max).join(" ").replace(/[,:;.-]+$/, "")}.` : words.join(" ");
}

function clean(value: string) {
  return String(value || "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[^\x20-\x7E\u2022]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
