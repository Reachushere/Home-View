import OpenAI from 'openai';

const VALID_ROLES = new Set(['system', 'assistant', 'user', 'tool', 'function', 'developer']);

let patched = false;

export function installOpenAISanitizer() {
  if (patched) return;
  try {
    const proto: any = (OpenAI as any)?.Chat?.Completions?.prototype
      || (OpenAI as any)?.Resources?.Chat?.Completions?.prototype
      || require('openai/resources/chat/completions/completions').Completions.prototype;
    if (!proto || typeof proto.create !== 'function') {
      console.warn('[OpenAI Sanitizer] Could not locate Completions.prototype.create — skipping patch');
      return;
    }
    const orig = proto.create;
    proto.create = function patchedCreate(this: any, body: any, options?: any) {
      try {
        if (body && Array.isArray(body.messages)) {
          const before = body.messages.length;
          const filtered = body.messages.filter((m: any) => m && typeof m === 'object' && typeof m.role === 'string' && VALID_ROLES.has(m.role));
          if (filtered.length !== before) {
            console.warn(`[OpenAI Sanitizer] Stripped ${before - filtered.length} message(s) with invalid role(s): ${body.messages.filter((m: any) => !VALID_ROLES.has(m?.role)).map((m: any) => m?.role).join(', ')}`);
            body.messages = filtered;
          }
        }
      } catch (e) {
        console.error('[OpenAI Sanitizer] sanitize failure (passing through):', e);
      }
      return orig.call(this, body, options);
    };
    patched = true;
    console.log('[OpenAI Sanitizer] Installed — invalid message roles will be stripped before reaching OpenAI');
  } catch (e) {
    console.error('[OpenAI Sanitizer] Failed to install:', e);
  }
}
