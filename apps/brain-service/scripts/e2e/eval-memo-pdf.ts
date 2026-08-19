/**
 * 评测用最小 PDF（Helvetica + ASCII）。聊天 extract 不接受 .txt，HTTP save_offer 走这条路径。
 */
export const EVAL_MEMO_ASCII =
  "FamBrain vault txt save gate. Write-back only after summarize or translate. Eval coverage, not city admin.";

const pdfEscape = (s: string): string =>
  s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

export const makeEvalMemoPdf = (text = EVAL_MEMO_ASCII): Buffer => {
  const stream = Buffer.from(`BT /F1 12 Tf 50 750 Td (${pdfEscape(text)}) Tj ET`);
  const bodies = [
    Buffer.from("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"),
    Buffer.from("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"),
    Buffer.from(
      "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n"
    ),
    Buffer.concat([
      Buffer.from(`4 0 obj\n<< /Length ${stream.length} >>\nstream\n`),
      stream,
      Buffer.from("\nendstream\nendobj\n"),
    ]),
    Buffer.from(
      "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"
    ),
  ];
  let pdf = Buffer.from("%PDF-1.4\n");
  const offsets: number[] = [];
  for (const body of bodies) {
    offsets.push(pdf.length);
    pdf = Buffer.concat([pdf, body]);
  }
  const xrefPos = pdf.length;
  const xrefLines = ["xref", "0 6", "0000000000 65535 f "];
  for (const off of offsets) {
    xrefLines.push(`${String(off).padStart(10, "0")} 00000 n `);
  }
  pdf = Buffer.concat([
    pdf,
    Buffer.from(`${xrefLines.join("\n")}\n`),
    Buffer.from(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`),
  ]);
  return pdf;
};
