import { getGmailAccessToken } from "./gmail";

const NEWSLETTER_DOMAINS = [
  "politico.com", "e.politico.com", "email.politico.com",
  "rawstory.com", "e.rawstory.com", "newsletter.rawstory.com",
  "e.cnn.com", "newsletters.cnn.com", "mail.cnn.com",
  "e.msnbc.com", "newsletters.msnbc.com",
  "e.nbcnews.com", "newsletters.nbcnews.com",
  "newsletter.foxnews.com", "newsletters.foxnews.com", "e.foxnews.com",
  "abcnews.go.com",
  "newsletters.washingtonpost.com", "email.washingtonpost.com",
  "nytdirect.nytimes.com", "newsletters.nytimes.com", "email.nytimes.com",
  "em.huffpost.com", "newsletters.huffpost.com",
  "newsletter.thedailybeast.com", "email.thedailybeast.com",
  "newsletter.newsweek.com", "newsletters.newsweek.com",
  "motherjones.com", "email.motherjones.com",
  "news.vox.com", "newsletter.vox.com",
  "e.axios.com", "axios.com",
  "newsletters.theatlantic.com", "theatlantic.com",
  "newsletter.theguardian.com", "email.theguardian.com",
  "meidastouch.com", "meidasplus.com", "email.meidastouch.com",
  "democracydocket.com", "email.democracydocket.com",
  "newsletter.rollingstone.com", "news.rollingstone.com",
  "theintercept.com", "email.theintercept.com",
  "nypost.com", "newsletter.nypost.com", "email.nypost.com",
  "news.salon.com", "salon.com",
  "newsweek.com",
  "bulwarkmedia.com", "thebulwark.com", "email.thebulwark.com",
  "substack.com",
];

const POLITICAL_KEYWORDS = [
  "Trump", "MAGA", "Biden", "Harris", "DeSantis", "GOP", "Republican",
  "Democrat", "DOJ", "Mueller", "January 6", "impeach", "indictment",
  "Mar-a-Lago", "Capitol", "election", "ballot", "filibuster", "SCOTUS",
];

function buildQuery(): string {
  const fromClause = "from:(" + NEWSLETTER_DOMAINS.map(d => `@${d}`).join(" OR ") + ")";
  const subjectClause = "subject:(" + POLITICAL_KEYWORDS.map(k => `"${k}"`).join(" OR ") + ")";
  return `(${fromClause}) OR (${subjectClause} has:list-unsubscribe)`;
}

async function gmailFetch(path: string, init: RequestInit = {}): Promise<any> {
  const token = await getGmailAccessToken();
  const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  if (!r.ok) throw new Error(`Gmail ${r.status}: ${await r.text()}`);
  return r.json();
}

export async function cleanupPoliticalEmails(limit = 1000): Promise<{ trashed: number; query: string; error?: string }> {
  const query = buildQuery();
  try {
    let trashed = 0;
    let pageToken: string | undefined = undefined;
    let safety = 0;
    while (safety++ < 20) {
      const params = new URLSearchParams({ q: query, maxResults: "500" });
      if (pageToken) params.set("pageToken", pageToken);
      const list: any = await gmailFetch(`messages?${params.toString()}`);
      const ids: string[] = (list.messages || []).map((m: any) => m.id);
      if (ids.length === 0) break;
      const chunks: string[][] = [];
      for (let i = 0; i < ids.length; i += 1000) chunks.push(ids.slice(i, i + 1000));
      for (const chunk of chunks) {
        await gmailFetch("messages/batchModify", {
          method: "POST",
          body: JSON.stringify({ ids: chunk, addLabelIds: ["TRASH"], removeLabelIds: ["INBOX", "UNREAD"] }),
        });
        trashed += chunk.length;
        if (trashed >= limit) return { trashed, query };
      }
      pageToken = list.nextPageToken;
      if (!pageToken) break;
    }
    return { trashed, query };
  } catch (e: any) {
    return { trashed: 0, query, error: e?.message?.substring(0, 400) || String(e) };
  }
}

let monitorInterval: ReturnType<typeof setInterval> | null = null;
let monitorRunning = false;

export function startPoliticalEmailMonitor(intervalMinutes = 5): void {
  if (monitorInterval) return;
  console.log(`[PoliticalEmail] Monitor starting — every ${intervalMinutes} min, blocklist=${NEWSLETTER_DOMAINS.length} domains`);
  const tick = async () => {
    if (monitorRunning) return;
    monitorRunning = true;
    try {
      const r = await cleanupPoliticalEmails(500);
      if (r.error) console.warn(`[PoliticalEmail] Tick error: ${r.error}`);
      else if (r.trashed > 0) console.log(`[PoliticalEmail] Auto-trashed ${r.trashed} email(s)`);
    } catch (e: any) {
      console.warn(`[PoliticalEmail] Tick exception: ${e?.message || e}`);
    } finally {
      monitorRunning = false;
    }
  };
  setTimeout(tick, 30_000);
  monitorInterval = setInterval(tick, intervalMinutes * 60 * 1000);
}

export function getPoliticalBlocklist(): { domains: string[]; keywords: string[] } {
  return { domains: NEWSLETTER_DOMAINS, keywords: POLITICAL_KEYWORDS };
}
