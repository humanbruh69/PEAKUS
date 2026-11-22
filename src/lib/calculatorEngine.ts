export type AngleMode = 'DEG' | 'RAD';

export interface CalcEvaluationResult {
  ok: boolean;
  value?: number;
  formatted: string;
  error?: string;
}

export interface CalcHistoryEntry {
  id: string;
  expression: string;
  result: string;
  timestamp: number;
}

type Token =
  | { type: 'num'; value: number }
  | { type: 'ident'; name: string }
  | { type: 'op'; op: string }
  | { type: 'lparen' }
  | { type: 'rparen' };

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  π: Math.PI,
  e: Math.E,
};

const FUNCTIONS = new Set(['sin', 'cos', 'tan', 'sqrt', 'ln', 'log']);

function tokenize(raw: string): Token[] {
  const input = raw
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/√/g, 'sqrt');

  const rawTokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (/[0-9.]/.test(ch)) {
      let numStr = '';
      let dotCount = 0;
      while (i < input.length && /[0-9.]/.test(input[i])) {
        if (input[i] === '.') {
          dotCount++;
          if (dotCount > 1) throw new Error('Invalid number');
        }
        numStr += input[i++];
      }
      if (numStr === '.') throw new Error('Invalid number');
      rawTokens.push({ type: 'num', value: Number(numStr) });
      continue;
    }

    if (ch === 'π') {
      rawTokens.push({ type: 'ident', name: 'π' });
      i++;
      continue;
    }

    if (/[a-zA-Z]/.test(ch)) {
      let name = '';
      while (i < input.length && /[a-zA-Z0-9]/.test(input[i])) {
        name += input[i++];
      }
      rawTokens.push({ type: 'ident', name: name.toLowerCase() });
      continue;
    }

    if (ch === '(') {
      rawTokens.push({ type: 'lparen' });
      i++;
      continue;
    }

    if (ch === ')') {
      rawTokens.push({ type: 'rparen' });
      i++;
      continue;
    }

    if ('+-*/^%'.includes(ch)) {
      rawTokens.push({ type: 'op', op: ch });
      i++;
      continue;
    }

    throw new Error(`Unexpected character "${ch}"`);
  }

  // Insert implicit multiplication tokens (e.g. 2π, 3(4+5), (1+2)(3+4), )2, 2sqrt(9))
  const tokens: Token[] = [];
  for (let idx = 0; idx < rawTokens.length; idx++) {
    const cur = rawTokens[idx];
    if (idx > 0) {
      const prev = rawTokens[idx - 1];
      const prevEndsValue =
        prev.type === 'num' ||
        prev.type === 'rparen' ||
        (prev.type === 'ident' && prev.name in CONSTANTS);
      const curStartsValue =
        cur.type === 'num' ||
        cur.type === 'lparen' ||
        cur.type === 'ident';
      if (prevEndsValue && curStartsValue) {
        tokens.push({ type: 'op', op: '*' });
      }
    }
    tokens.push(cur);
  }

  return tokens;
}

export function formatCalcNumber(num: number): string {
  if (!Number.isFinite(num)) {
    throw new Error('Result is undefined');
  }
  const normalizedZero = Math.abs(num) < 1e-12 ? 0 : num;
  if (normalizedZero === 0) return '0';

  const abs = Math.abs(normalizedZero);
  if (abs >= 1e12 || (abs > 0 && abs < 1e-9)) {
    return normalizedZero.toExponential(6).replace(/\.?0+e/, 'e');
  }

  const rounded = Number(normalizedZero.toPrecision(12));
  return String(rounded);
}

export function evaluateExpression(
  expression: string,
  angleMode: AngleMode = 'DEG',
  ansValue: number = 0
): CalcEvaluationResult {
  const trimmed = expression.trim();
  if (!trimmed) {
    return { ok: false, formatted: '0', error: 'Empty expression' };
  }

  try {
    const tokens = tokenize(trimmed);
    if (tokens.length === 0) {
      return { ok: false, formatted: '0', error: 'Empty expression' };
    }

    let pos = 0;
    const peek = (): Token | undefined => tokens[pos];
    const consume = (): Token => tokens[pos++];

    const parseExpression = (): number => {
      let left = parseTerm();
      while (true) {
        const tok = peek();
        if (tok?.type === 'op' && (tok.op === '+' || tok.op === '-')) {
          consume();
          const right = parseTerm();
          left = tok.op === '+' ? left + right : left - right;
        } else {
          break;
        }
      }
      return left;
    };

    const parseTerm = (): number => {
      let left = parsePower();
      while (true) {
        const tok = peek();
        if (tok?.type === 'op' && (tok.op === '*' || tok.op === '/')) {
          consume();
          const right = parsePower();
          if (tok.op === '/' && right === 0) {
            throw new Error('Cannot divide by zero');
          }
          left = tok.op === '*' ? left * right : left / right;
        } else {
          break;
        }
      }
      return left;
    };

    const parsePower = (): number => {
      const base = parseUnary();
      const tok = peek();
      if (tok?.type === 'op' && tok.op === '^') {
        consume();
        const exponent = parsePower();
        return Math.pow(base, exponent);
      }
      return base;
    };

    const parseUnary = (): number => {
      const tok = peek();
      if (tok?.type === 'op' && tok.op === '-') {
        consume();
        return -parseUnary();
      }
      if (tok?.type === 'op' && tok.op === '+') {
        consume();
        return parseUnary();
      }
      return parsePostfix();
    };

    const parsePostfix = (): number => {
      let val = parsePrimary();
      while (true) {
        const tok = peek();
        if (tok?.type === 'op' && tok.op === '%') {
          consume();
          val = val / 100;
        } else {
          break;
        }
      }
      return val;
    };

    const parsePrimary = (): number => {
      const tok = peek();
      if (!tok) throw new Error('Incomplete expression');

      if (tok.type === 'num') {
        consume();
        return tok.value;
      }

      if (tok.type === 'lparen') {
        consume();
        const val = parseExpression();
        const close = peek();
        if (close?.type !== 'rparen') {
          throw new Error('Missing closing parenthesis');
        }
        consume();
        return val;
      }

      if (tok.type === 'ident') {
        consume();
        if (tok.name === 'ans') {
          return ansValue;
        }
        if (tok.name in CONSTANTS) {
          return CONSTANTS[tok.name];
        }
        if (FUNCTIONS.has(tok.name)) {
          let arg: number;
          if (peek()?.type === 'lparen') {
            consume();
            arg = parseExpression();
            if (peek()?.type !== 'rparen') {
              throw new Error('Missing closing parenthesis');
            }
            consume();
          } else {
            arg = parseUnary();
          }
          return applyMathFn(tok.name, arg, angleMode);
        }
        throw new Error(`Unknown symbol "${tok.name}"`);
      }

      throw new Error('Invalid syntax');
    };

    const value = parseExpression();
    if (pos < tokens.length) {
      throw new Error('Unexpected token');
    }

    const formatted = formatCalcNumber(value);
    return { ok: true, value: Number(formatted), formatted };
  } catch (err: any) {
    return {
      ok: false,
      formatted: 'Error',
      error: err?.message || 'Invalid expression',
    };
  }
}

function applyMathFn(fn: string, arg: number, angleMode: AngleMode): number {
  const rad = angleMode === 'DEG' ? (arg * Math.PI) / 180 : arg;
  switch (fn) {
    case 'sin':
      return Math.sin(rad);
    case 'cos':
      return Math.cos(rad);
    case 'tan': {
      const c = Math.cos(rad);
      if (Math.abs(c) < 1e-12) throw new Error('Undefined tangent');
      return Math.tan(rad);
    }
    case 'sqrt':
      if (arg < 0) throw new Error('Negative square root');
      return Math.sqrt(arg);
    case 'ln':
      if (arg <= 0) throw new Error('Logarithm domain error');
      return Math.log(arg);
    case 'log':
      if (arg <= 0) throw new Error('Logarithm domain error');
      return Math.log10(arg);
    default:
      throw new Error(`Unknown function "${fn}"`);
  }
}

export function toggleSignInExpression(expr: string): string {
  const trimmed = expr.trim();
  if (!trimmed || trimmed === '0') return '-';
  // Match a trailing number or (-number) at the end of the expression
  const wrappedNegMatch = trimmed.match(/^(.*)\(-([0-9.]+)\)$/);
  if (wrappedNegMatch) {
    return `${wrappedNegMatch[1]}${wrappedNegMatch[2]}`;
  }
  const trailingNumMatch = trimmed.match(/^(.*?)([0-9.]+)$/);
  if (trailingNumMatch) {
    const prefix = trailingNumMatch[1];
    const num = trailingNumMatch[2];
    if (!prefix) return `-${num}`;
    if (prefix === '-') return num;
    return `${prefix}(-${num})`;
  }
  return trimmed.startsWith('-') ? trimmed.slice(1) : `-(${trimmed})`;
}
