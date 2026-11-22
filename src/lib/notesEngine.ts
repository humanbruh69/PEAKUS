/**
 * Pure rich-text Notepad sanitizer, converter, and word/character stats engine.
 * Zero DOM dependencies so it runs deterministically in both browser and Node unit tests.
 */

const ALLOWED_TAGS = new Set([
  'p',
  'div',
  'br',
  'b',
  'strong',
  'i',
  'em',
  'u',
  's',
  'strike',
  'del',
  'h1',
  'h2',
  'blockquote',
  'ul',
  'ol',
  'li',
  'span',
  'input',
]);

const STRIP_WITH_CONTENT_TAGS = ['script', 'style', 'iframe', 'object', 'embed', 'svg', 'noscript'];

export function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function decodeHtmlEntities(html: string): string {
  return String(html)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_m, dec) => {
      const code = Number(dec);
      return Number.isFinite(code) ? String.fromCharCode(code) : '';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCharCode(code) : '';
    });
}

export function isLikelyNotesHtml(raw: string): boolean {
  if (!raw || typeof raw !== 'string') return false;
  return /<\/?(?:p|div|h1|h2|blockquote|ul|ol|li|b|strong|i|em|u|s|strike|del|br|span|input)\b[^>]*>/i.test(
    raw
  );
}

function sanitizeTagAttributes(tag: string, rawAttrs: string): string {
  if (!rawAttrs || !rawAttrs.trim()) {
    return tag === 'input' ? ' type="checkbox" class="notes-checkbox"' : '';
  }

  const attrsOut: string[] = [];

  if (tag === 'input') {
    const isCheckbox = /type\s*=\s*["']?checkbox["']?/i.test(rawAttrs);
    if (!isCheckbox) return ' type="checkbox" class="notes-checkbox"';
    attrsOut.push('type="checkbox"');
    attrsOut.push('class="notes-checkbox"');
    if (/\bchecked(?:\s*=|\b)/i.test(rawAttrs)) {
      attrsOut.push('checked="checked"');
    }
    return ' ' + attrsOut.join(' ');
  }

  // Only allow safe text-align on block-level tags
  if (['p', 'div', 'h1', 'h2', 'blockquote', 'li', 'ul', 'ol'].includes(tag)) {
    const alignMatch = rawAttrs.match(/text-align\s*:\s*(left|center|right)/i);
    if (alignMatch) {
      attrsOut.push(`style="text-align: ${alignMatch[1].toLowerCase()}"`);
    }

    const classMatch = rawAttrs.match(/\bclass\s*=\s*["']([^"']*)["']/i);
    if (classMatch) {
      const allowedClasses = classMatch[1]
        .split(/\s+/)
        .filter(c => c === 'notes-checklist' || c === 'notes-check-item' || c === 'is-checked');
      if (allowedClasses.length > 0) {
        attrsOut.push(`class="${allowedClasses.join(' ')}"`);
      }
    }

    const checkedAttrMatch = rawAttrs.match(/\bdata-checked\s*=\s*["']?(true|false)["']?/i);
    if (checkedAttrMatch) {
      attrsOut.push(`data-checked="${checkedAttrMatch[1].toLowerCase()}"`);
    }
  }

  return attrsOut.length > 0 ? ' ' + attrsOut.join(' ') : '';
}

/**
 * Strictly sanitize HTML produced by contentEditable / pasted snippets using an explicit allowlist.
 */
export function sanitizeRichNotesHtml(rawHtml: string): string {
  if (!rawHtml || typeof rawHtml !== 'string') return '';

  let working = rawHtml;
  for (const dangerous of STRIP_WITH_CONTENT_TAGS) {
    const pairRe = new RegExp(`<${dangerous}\\b[^>]*>[\\s\\S]*?<\\/${dangerous}>`, 'gi');
    working = working.replace(pairRe, '');
    const singleRe = new RegExp(`<${dangerous}\\b[^>]*\\/?>`, 'gi');
    working = working.replace(singleRe, '');
  }

  // Filter every remaining HTML tag
  const sanitized = working.replace(/<\/?([a-zA-Z0-9-]+)([^>]*)>/g, (full, rawTag, rawAttrs) => {
    const tag = String(rawTag).toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) {
      return '';
    }
    const isClosing = full.startsWith('</');
    if (isClosing) {
      if (tag === 'br' || tag === 'input') return '';
      return `</${tag}>`;
    }
    const cleanAttrs = sanitizeTagAttributes(tag, rawAttrs || '');
    if (tag === 'br') return '<br>';
    if (tag === 'input') return `<input${cleanAttrs}>`;
    return `<${tag}${cleanAttrs}>`;
  });

  return sanitized.trim();
}

export function plainTextToRichHtml(text: string): string {
  if (!text) return '';
  const lines = String(text).replace(/\r\n/g, '\n').split('\n');
  const html = lines
    .map(line => (line.length === 0 ? '<p><br></p>' : `<p>${escapeHtml(line)}</p>`))
    .join('');
  return html;
}

export function extractPlainTextFromNotes(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  if (!isLikelyNotesHtml(raw)) {
    return raw.replace(/\r\n/g, '\n').replace(/\u00A0/g, ' ');
  }

  const clean = sanitizeRichNotesHtml(raw);
  const withBreaks = clean
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|h1|h2|blockquote|li|ul|ol)>/gi, '\n')
    .replace(/<(?:ul|ol|p|div|h1|h2|blockquote|li)\b[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '');

  const decoded = decodeHtmlEntities(withBreaks)
    .replace(/\u00A0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+|\n+$/g, '');

  return decoded;
}

export function isRichNotesEmpty(raw: string): boolean {
  if (!raw || !raw.trim()) return true;
  if (/<input\b[^>]*type=["']?checkbox["']?/i.test(raw)) return false;
  return extractPlainTextFromNotes(raw).trim().length === 0;
}

export function normalizeNotesInput(raw: string): string {
  if (!raw || !raw.trim()) return '';
  if (isLikelyNotesHtml(raw)) {
    const clean = sanitizeRichNotesHtml(raw);
    return isRichNotesEmpty(clean) ? '' : clean;
  }
  return plainTextToRichHtml(raw);
}

export interface NotesStats {
  words: number;
  characters: number;
}

export function getNotesStats(raw: string): NotesStats {
  const plain = extractPlainTextFromNotes(raw);
  const normalized = plain.replace(/\r/g, '').replace(/\u00A0/g, ' ').replace(/^\n+|\n+$/g, '');
  if (!normalized.trim()) {
    // Handle case where user typed only spaces
    const chars = normalized.replace(/\n/g, '').length;
    return { words: 0, characters: chars };
  }
  const words = normalized.trim().split(/\s+/).filter(Boolean).length;
  const characters = normalized.replace(/\n/g, '').length;
  return { words, characters };
}

export function appendLineToRichNotes(currentNotes: string, addition: string, maxLength = 20000): string {
  const cleanAddition = String(addition || '').trim();
  if (!cleanAddition) return normalizeNotesInput(currentNotes);

  const baseHtml = normalizeNotesInput(currentNotes);
  const addHtml = plainTextToRichHtml(cleanAddition);
  const combined = baseHtml ? `${baseHtml}${addHtml}` : addHtml;
  return combined.slice(0, maxLength);
}
