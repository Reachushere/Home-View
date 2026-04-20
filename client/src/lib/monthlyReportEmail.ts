import html2canvas from "html2canvas";
import { PDFDocument } from "pdf-lib";

const KEVIN_NAME = "Kevin Morrall";
const KEVIN_EMAIL = "kevin.morrall@akisqnuk.org";
const FROM_NAME = "Bryn Kai-Hendricks";
const FROM_EMAIL = "bryn.kai-hendricks@outlook.com";

export async function buildMonthlyReportPdfBytes(): Promise<Uint8Array> {
  const dialog = document.querySelector('[data-testid="monthly-report-dialog"]') as HTMLElement | null;
  if (!dialog) throw new Error("Monthly report dialog not mounted");

  const canvas = await html2canvas(dialog, {
    backgroundColor: "#ffffff",
    scale: 2,
    useCORS: true,
    logging: false,
    windowWidth: dialog.scrollWidth,
    windowHeight: dialog.scrollHeight,
  });

  const pngDataUrl = canvas.toDataURL("image/png");
  const pngBytes = await (await fetch(pngDataUrl)).arrayBuffer();

  const pdf = await PDFDocument.create();
  const PAGE_W = 612;
  const PAGE_H = 792;
  const MARGIN = 28.8;
  const page = pdf.addPage([PAGE_W, PAGE_H]);
  const png = await pdf.embedPng(pngBytes);

  const maxW = PAGE_W - 2 * MARGIN;
  const maxH = PAGE_H - 2 * MARGIN;
  const ratio = Math.min(maxW / png.width, maxH / png.height);
  const w = png.width * ratio;
  const h = png.height * ratio;

  page.drawImage(png, {
    x: (PAGE_W - w) / 2,
    y: (PAGE_H - h) / 2,
    width: w,
    height: h,
  });

  return await pdf.save();
}

function monthYearLabel(reportingPeriod: string): string {
  const m = reportingPeriod.match(/to\s+([A-Za-z]+)\s+\d+,\s+(\d{4})/);
  if (m) return `${m[1]} ${m[2]}`;
  const d = new Date();
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk) as unknown as number[]);
  }
  return btoa(binary);
}

function wrap76(s: string): string {
  return s.replace(/(.{76})/g, "$1\r\n");
}

function rfc2822Date(d: Date = new Date()): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const tzMin = -d.getTimezoneOffset();
  const sign = tzMin >= 0 ? "+" : "-";
  const abs = Math.abs(tzMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${days[d.getDay()]}, ${pad(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()} ` +
         `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${sign}${hh}${mm}`;
}

function buildEmlString(opts: {
  subject: string;
  body: string;
  pdfFilename: string;
  pdfBytes: Uint8Array;
}): string {
  const boundary = "----=_UniCal_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  const pdfB64 = wrap76(uint8ToBase64(opts.pdfBytes));
  const bodyCRLF = opts.body.replace(/\r?\n/g, "\r\n");

  const headers = [
    `From: "${FROM_NAME}" <${FROM_EMAIL}>`,
    `To: "${KEVIN_NAME}" <${KEVIN_EMAIL}>`,
    `Subject: ${opts.subject}`,
    `Date: ${rfc2822Date()}`,
    `X-Unsent: 1`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ].join("\r\n");

  const parts = [
    `--${boundary}`,
    `Content-Type: text/plain; charset="utf-8"`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    bodyCRLF,
    ``,
    `--${boundary}`,
    `Content-Type: application/pdf; name="${opts.pdfFilename}"`,
    `Content-Transfer-Encoding: base64`,
    `Content-Disposition: attachment; filename="${opts.pdfFilename}"`,
    ``,
    pdfB64,
    ``,
    `--${boundary}--`,
    ``,
  ].join("\r\n");

  return headers + "\r\n\r\n" + parts;
}

export async function emailMonthlyReportViaOutlook(opts: {
  reportingPeriod: string;
  reportDate: string;
}): Promise<{ pdfFilename: string; emlFilename: string }> {
  const pdfBytes = await buildMonthlyReportPdfBytes();
  const label = monthYearLabel(opts.reportingPeriod);
  const pdfFilename = `Monthly Report - ${label}.pdf`;
  const emlFilename = `Monthly Report - ${label}.eml`;

  const subject = `Monthly Report - ${label}`;
  const body = [
    `Hello Kevin,`,
    ``,
    `Please find attached my post-secondary monthly education report for the period ${opts.reportingPeriod}.`,
    ``,
    `Thank you,`,
    `Bryn Kai-Hendricks`,
  ].join("\r\n");

  const eml = buildEmlString({ subject, body, pdfFilename, pdfBytes });
  const blob = new Blob([eml], { type: "message/rfc822" });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = emlFilename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 60000);

  return { pdfFilename, emlFilename };
}
