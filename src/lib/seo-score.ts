/** Rank Math-style scoring. Pure functions, safe for client and server. */

export type ScoreInput = {
  title: string;
  seoTitle: string;
  metaDescription: string;
  slug: string;
  content: string;
  focusKeyword: string;
  excerpt: string;
  coverAlt: string;
  faqCount: number;
};

export type Check = { label: string; pass: boolean; tip: string };

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

export function wordCount(markdown: string): number {
  return markdown.replace(/[#*_>`\[\]()!-]/g, " ").split(/\s+/).filter(Boolean).length;
}

export function readingMinutes(markdown: string): number {
  return Math.max(1, Math.round(wordCount(markdown) / 200));
}

export function seoChecks(i: ScoreInput): Check[] {
  const kw = norm(i.focusKeyword);
  const title = norm(i.seoTitle || i.title);
  const meta = i.metaDescription.trim();
  const text = norm(i.content);
  const words = wordCount(i.content);
  const firstPara = norm(i.content.split(/\n\s*\n/).find((p) => p.trim() && !p.trim().startsWith("#")) ?? "");
  const headings = (i.content.match(/^#{2,3} .+$/gm) ?? []).map(norm);
  const occurrences = kw ? text.split(kw).length - 1 : 0;
  const density = words ? (occurrences * kw.split(" ").length * 100) / words : 0;
  const links = i.content.match(/\]\((https?:\/\/[^)]+|\/[^)]*)\)/g) ?? [];
  const internal = links.filter((l) => l.includes("](/") || l.includes("autodm.techaasvik.com")).length;
  const external = links.length - internal;
  const images = i.content.match(/!\[([^\]]*)\]/g) ?? [];
  const imagesWithAlt = images.every((m) => m.length > 4);
  const titleLen = (i.seoTitle || i.title).length;
  return [
    { label: "Focus keyword set", pass: kw.length > 1, tip: "Add the main search phrase." },
    { label: "Keyword in SEO title", pass: !!kw && title.includes(kw), tip: "Put the keyword in the title, ideally at the start." },
    { label: "Keyword in URL", pass: !!kw && i.slug.includes(kw.replace(/\s+/g, "-")), tip: "Use the keyword in the slug." },
    { label: "Keyword in meta description", pass: !!kw && norm(meta).includes(kw), tip: "Mention the keyword in the description." },
    { label: "Keyword in first paragraph", pass: !!kw && firstPara.includes(kw), tip: "Use the keyword in the opening lines." },
    { label: "Keyword in a subheading", pass: !!kw && headings.some((h) => h.includes(kw)), tip: "Add an H2/H3 with the keyword." },
    { label: "Keyword density 0.5–2.5%", pass: density >= 0.5 && density <= 2.5, tip: `Current ${density.toFixed(1)}%.` },
    { label: "SEO title 30–60 characters", pass: titleLen >= 30 && titleLen <= 60, tip: `Now ${titleLen}.` },
    { label: "Meta description 120–160 characters", pass: meta.length >= 120 && meta.length <= 160, tip: `Now ${meta.length}.` },
    { label: "Content 800+ words", pass: words >= 800, tip: `Now ${words} words.` },
    { label: "Internal link", pass: internal > 0, tip: "Link to another page on this site." },
    { label: "External link to a source", pass: external > 0, tip: "Cite a trusted source." },
    { label: "Images have alt text", pass: imagesWithAlt && (images.length === 0 || true), tip: "Describe every image." },
    { label: "Cover image alt text", pass: i.coverAlt.trim().length > 3, tip: "Describe the cover image." },
    { label: "Subheadings used", pass: headings.length >= 3, tip: "Break the article into 3+ sections." },
  ];
}

export function geoChecks(i: ScoreInput): Check[] {
  const content = i.content;
  const firstPara = content.split(/\n\s*\n/).find((p) => p.trim() && !p.trim().startsWith("#")) ?? "";
  return [
    { label: "Direct answer in first 60 words", pass: wordCount(firstPara) >= 20 && wordCount(firstPara) <= 80, tip: "Open with a 2–3 sentence answer AI tools can quote." },
    { label: "FAQ section (3+ questions)", pass: i.faqCount >= 3, tip: "Add questions people actually ask." },
    { label: "Numbers or statistics", pass: /\d+(\.\d+)?\s?(%|₹|rs|x|minutes|hours|days)/i.test(content), tip: "Add concrete figures." },
    { label: "Sources cited", pass: /\]\(https?:\/\//.test(content), tip: "Link to official docs or studies." },
    { label: "Definition sentence", pass: /\b(is a|is an|refers to|means)\b/i.test(content), tip: "Define the key term clearly." },
    { label: "Lists or steps", pass: /^(\d+\.|-|\*) /m.test(content), tip: "Use bullet points or numbered steps." },
    { label: "Brand mentioned", pass: /autodm/i.test(content), tip: "Mention AutoDM by Techaasvik by name." },
    { label: "Summary/excerpt written", pass: i.excerpt.trim().length >= 80, tip: "Write an 80+ character summary." },
  ];
}

export function scoreOf(checks: Check[]): number {
  return checks.length ? Math.round((checks.filter((c) => c.pass).length * 100) / checks.length) : 0;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}
