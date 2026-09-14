// One-off dev utility: wrap a text file in a multi-page test PDF.
// Long lines are wrapped and split across pages so page-number detection
// can be exercised. Usage: node scripts/make-test-pdf.cjs <input.txt> [output.pdf]
const fs = require("fs");

const input = process.argv[2];
const output = process.argv[3] || "test.pdf";
const text = fs.readFileSync(input, "utf8").replace(/\r/g, "");

// Wrap at ~95 chars on word boundaries.
const wrapped = [];
for (const line of text.split("\n")) {
  let rest = line;
  if (!rest.trim()) {
    wrapped.push("");
    continue;
  }
  while (rest.length > 95) {
    const cut = rest.lastIndexOf(" ", 95);
    wrapped.push(rest.slice(0, cut > 0 ? cut : 95));
    rest = rest.slice(cut > 0 ? cut + 1 : 95);
  }
  wrapped.push(rest);
}

// ~45 content lines per page.
const perPage = 45;
const pages = [];
for (let i = 0; i < wrapped.length; i += perPage) {
  const rows = wrapped
    .slice(i, i + perPage)
    .map((l) => l.replace(/[()\\]/g, ""))
    .map((l, j) => (j === 0 ? "(" + l + ") Tj" : "T* (" + l + ") Tj"))
    .join("\n");
  pages.push("BT /F1 10 Tf 20 750 Td 14 TL 12 Tw\n" + rows + "\nET");
}

// Refs: 1 catalog, 2 pages-tree, 3 font, then page/content pairs from 4.
const fontRef = 3;
let nextRef = 4;
const pageObjs = [];
for (const stream of pages) {
  const pageRef = nextRef++;
  const contentRef = nextRef++;
  pageObjs.push({
    pageRef,
    page: "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents " + contentRef + " 0 R /Resources << /Font << /F1 " + fontRef + " 0 R >> >> >>",
    content: "<< /Length " + stream.length + " >>\nstream\n" + stream + "\nendstream",
  });
}
const flat = [
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [" + pageObjs.map((p) => p.pageRef + " 0 R").join(" ") + "] /Count " + pages.length + " >>",
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
];
pageObjs.forEach((p) => {
  flat.push(p.page, p.content);
});

let pdf = "%PDF-1.4\n";
const offsets = [];
flat.forEach((body, i) => {
  offsets.push(pdf.length);
  pdf += i + 1 + " 0 obj\n" + body + "\nendobj\n";
});
const xref = pdf.length;
pdf += "xref\n0 " + (flat.length + 1) + "\n0000000000 65535 f \n";
offsets.forEach((o) => {
  pdf += String(o).padStart(10, "0") + " 00000 n \n";
});
pdf += "trailer\n<< /Size " + (flat.length + 1) + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF";

fs.writeFileSync(output, Buffer.from(pdf, "latin1"));
console.log("wrote", output, pdf.length, "bytes,", pages.length, "pages");
