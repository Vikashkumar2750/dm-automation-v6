import { describe, expect, it } from "vitest";

import { DELIVERY_TEMPLATES, inlineParts, parseBody } from "./delivery-page";

describe("delivery page formatting", () => {
  it("turns headings, bullets, notes and FAQ lines into blocks", () => {
    const b = parseBody("# Hello\nIntro\n\n## Inside\n- One\n- Two\n> Note\n? Free? | Yes");
    expect(b.map((x) => x.t)).toEqual(["h1", "p", "h2", "list", "quote", "faq"]);
    expect(b[3]).toEqual({ t: "list", items: ["One", "Two"] });
    expect(b[5]).toEqual({ t: "faq", q: "Free?", a: "Yes" });
  });
  it("keeps raw HTML as plain text", () => {
    expect(parseBody("<script>x</script>")).toEqual([{ t: "p", text: "<script>x</script>" }]);
  });
  it("splits bold text", () => {
    expect(inlineParts("a **b** c")).toEqual([{ bold: false, text: "a " }, { bold: true, text: "b" }, { bold: false, text: " c" }]);
  });
  it("every template starts with an H1 and fits the size limit", () => {
    for (const t of DELIVERY_TEMPLATES) {
      expect(parseBody(t.body)[0].t).toBe("h1");
      expect(t.body.length).toBeLessThanOrEqual(8000);
    }
  });
});
