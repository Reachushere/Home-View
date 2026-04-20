import html2canvas from "html2canvas";
import { PDFDocument } from "pdf-lib";

const KEVIN_NAME = "Kevin Morrall";
const KEVIN_EMAIL = "kevin.morrall@akisqnuk.org";
const FROM_NAME = "Bryn Kai-Hendricks";
const FROM_EMAIL = "bryn.kai-hendricks@outlook.com";

export async function buildMonthlyReportPdfBytes(): Promise<Uint8Array> {
  const dialog = document.querySelector('[data-testid="monthly-report-dialog"]') as HTMLElement | null;
  if (!dialog) throw new Error("Monthly report dialog not mounted");

  const liveInputs = dialog.querySelectorAll<HTMLInputElement>("input");
  const liveTextareas = dialog.querySelectorAll<HTMLTextAreaElement>("textarea");
  const inputValues = new Map<string, string>();
  const textareaValues = new Map<string, string>();
  liveInputs.forEach((el, i) => {
    const key = el.getAttribute("data-testid") || `input-${i}`;
    el.setAttribute("data-clone-key", key);
    inputValues.set(key, el.value);
  });
  liveTextareas.forEach((el, i) => {
    const key = el.getAttribute("data-testid") || `textarea-${i}`;
    el.setAttribute("data-clone-key", key);
    textareaValues.set(key, el.value);
  });

  // Render an offscreen clone of the dialog using the same fixed
  // 7.7in × 10.2in print layout as the on-screen Print flow, then scale
  // its body to fit so the PDF mirrors print exactly — fitted both
  // directions on a single Letter page.
  const PX_PER_IN = 96;
  const TARGET_W_PX = 7.7 * PX_PER_IN;  // 739.2
  const TARGET_H_PX = 10.2 * PX_PER_IN; // 979.2
  const captureHost = document.createElement("div");
  captureHost.className = "email-pdf-host";
  captureHost.style.cssText = [
    "position:fixed",
    "left:-100000px",
    "top:0",
    `width:${TARGET_W_PX}px`,
    "background:#ffffff",
    "z-index:-1",
    "pointer-events:none",
    "visibility:visible",
  ].join(";");
  const captureClone = dialog.cloneNode(true) as HTMLElement;
  // Replace form controls with static blocks (controls don't render their
  // value reliably into a canvas).
  captureClone.querySelectorAll<HTMLInputElement>("input").forEach((el) => {
    if (el.type === "checkbox" || el.type === "radio") return;
    const key = el.getAttribute("data-clone-key");
    const v = key ? inputValues.get(key) ?? "" : el.value;
    const span = document.createElement("span");
    span.textContent = v;
    span.style.cssText = "display:inline-block;padding:4px 7px;font-size:12px;color:#000;background:#fff;border:1px solid #000;border-radius:3px;width:100%;min-height:24px;box-sizing:border-box;font-family:inherit;white-space:pre-wrap;word-break:break-word;line-height:1.3;";
    el.parentNode?.replaceChild(span, el);
  });
  captureClone.querySelectorAll<HTMLTextAreaElement>("textarea").forEach((el) => {
    const key = el.getAttribute("data-clone-key");
    const v = key ? textareaValues.get(key) ?? "" : el.value;
    const div = document.createElement("div");
    div.textContent = v;
    div.style.cssText = "display:block;padding:4px 7px;font-size:12px;color:#000;background:#fff;border:1px solid #000;border-radius:3px;width:100%;min-height:36px;box-sizing:border-box;font-family:inherit;white-space:pre-wrap;word-break:break-word;line-height:1.3;";
    el.parentNode?.replaceChild(div, el);
  });
  captureHost.appendChild(captureClone);
  document.body.appendChild(captureHost);
  // Force layout under .email-pdf-host scope so the print-style CSS applies.
  void captureClone.offsetHeight;
  // Scale the body content to fit the fixed dialog box, mirroring the
  // beforeprint scaler used by the Print button.
  // The body is the `<div class="flex-1 overflow-y-auto p-4 space-y-3">`
  // child of the dialog — both classes live on the same element.
  const body = captureClone.querySelector<HTMLElement>(":scope > .flex-1.overflow-y-auto")
    || captureClone.querySelector<HTMLElement>(":scope > .overflow-y-auto")
    || captureClone.querySelector<HTMLElement>(".flex-1.overflow-y-auto");
  const header = captureClone.querySelector<HTMLElement>(".monthly-report-header");
  const banner = captureClone.querySelector<HTMLElement>(".monthly-report-banner");
  if (body) {
    const headerH = (header?.offsetHeight ?? 0) + (banner?.offsetHeight ?? 0);
    const cs = window.getComputedStyle(body);
    const padV = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const availableH = captureClone.clientHeight - headerH - padV;
    // Wrap the body's children in a measurable div. The body itself has
    // flex:1 1 auto + height:auto !important from print CSS, so we can't
    // measure or constrain it directly. The wrapper has no flex
    // constraints, so its scrollHeight is the true natural content
    // height and CSS zoom on the wrapper actually changes its rendered
    // size (which is what html2canvas captures).
    const wrap = document.createElement("div");
    wrap.setAttribute("data-print-scale-wrap", "");
    wrap.style.width = "100%";
    while (body.firstChild) wrap.appendChild(body.firstChild);
    body.appendChild(wrap);
    const naturalH = wrap.scrollHeight;
    if (naturalH > 0 && availableH > 0) {
      const scale = availableH / naturalH;
      (wrap.style as unknown as { zoom: string }).zoom = String(scale);
    }
  }

  let canvas: HTMLCanvasElement;
  try {
    canvas = await html2canvas(captureClone, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      logging: false,
      windowWidth: TARGET_W_PX,
      windowHeight: TARGET_H_PX,
      width: TARGET_W_PX,
      height: TARGET_H_PX,
    });
  } finally {
    captureHost.remove();
    liveInputs.forEach((el) => el.removeAttribute("data-clone-key"));
    liveTextareas.forEach((el) => el.removeAttribute("data-clone-key"));
  }

  const pngDataUrl = canvas.toDataURL("image/png");
  const pngBytes = await (await fetch(pngDataUrl)).arrayBuffer();

  const pdf = await PDFDocument.create();
  // US Letter at 72pt/in: 8.5in × 11in. The capture is exactly 7.7in ×
  // 10.2in (printable area with 0.4in margins) so we draw it at that
  // size, centered — matching the Print output 1:1.
  const PAGE_W = 612;  // 8.5in
  const PAGE_H = 792;  // 11in
  const MARGIN = 28.8; // 0.4in
  const page = pdf.addPage([PAGE_W, PAGE_H]);
  const png = await pdf.embedPng(pngBytes);

  const drawW = PAGE_W - 2 * MARGIN; // 554.4
  const drawH = PAGE_H - 2 * MARGIN; // 734.4

  page.drawImage(png, {
    x: MARGIN,
    y: MARGIN,
    width: drawW,
    height: drawH,
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
