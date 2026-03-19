export interface TickerEmail {
  emailId: string;
  body: string;
  receivedAt: Date;
  command?: 'delete' | 'clear' | 'expire';
  commandTarget?: string;
  expireMinutes?: number;
}

export function parseTickerCommand(body: string): { command?: 'delete' | 'clear' | 'expire'; target?: string; expireMinutes?: number } {
  const lower = body.toLowerCase().trim();

  if (lower === 'clear all' || lower === 'delete all' || lower === 'remove all') {
    return { command: 'clear' };
  }

  const deleteMatch = lower.match(/^(?:delete|remove)\s+(.+?)(?:\s+(?:from\s+)?ticker)?$/i);
  if (deleteMatch) {
    return { command: 'delete', target: deleteMatch[1].trim() };
  }

  const expireMatch = lower.match(/^(?:expire|expires?)\s+(?:in\s+)?(\d+)\s*(min(?:ute)?s?|hours?|hr?s?)/i);
  if (expireMatch) {
    let minutes = parseInt(expireMatch[1]);
    const unit = expireMatch[2].toLowerCase();
    if (unit.startsWith('h')) minutes *= 60;
    return { command: 'expire', expireMinutes: minutes };
  }

  return {};
}

export function extractInlineExpiry(body: string): { cleanBody: string; expireMinutes: number | null } {
  const match = body.match(/\[expires?:\s*(\d+)\s*(min(?:ute)?s?|hours?|hr?s?|days?)\s*\]/i);
  if (!match) return { cleanBody: body, expireMinutes: null };
  let minutes = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  if (unit.startsWith('h')) minutes *= 60;
  if (unit.startsWith('d')) minutes *= 1440;
  const cleanBody = body.replace(match[0], '').trim();
  return { cleanBody, expireMinutes: minutes };
}
