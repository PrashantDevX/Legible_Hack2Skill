// One-off: wrap a text file's content in a minimal test PDF.
// Usage: node scripts/make-test-pdf.cjs <input.txt> [output.pdf]
const fs = require("fs");

const input = process.argv[2];
const output = process.argv[3] || "test.pdf";
const lines = fs.readFileSync(input, "utf8").split(/\r?\n/);
const rows = lines
  .map((l) => l.replace(/[()\\]/g, ""))
  .map((l, i) => (i === 0 ? "(" + l + ") Tj" : "T* (" + l + ") Tj"))
  .join("\n");
const stream = "BT /F1 10 Tf 20 750 Td 14 TL 12 Tw\n" + rows + "\nET";

const objs = [
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
  "<< /Length " + stream.length + " >>\nstream\n" + stream + "\nendstream",
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
];

let pdf = "%PDF-1.4\n";
const offsets = [];
objs.forEach((body, i) => {
  offsets.push(pdf.length);
  pdf += i + 1 + " 0 obj\n" + body + "\nendobj\n";
});
const xref = pdf.length;
pdf += "xref\n0 " + (objs.length + 1) + "\n0000000000 65535 f \n";
offsets.forEach((o) => {
  pdf += String(o).padStart(10, "0") + " 00000 n \n";
});
pdf += "trailer\n<< /Size " + (objs.length + 1) + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF";

fs.writeFileSync(output, Buffer.from(pdf, "latin1"));
console.log("wrote", output, pdf.length, "bytes");
