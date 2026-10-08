// Small, safe maths expression reader (no eval). Used by the graph plotter
// and the calculator. Understands + − × ÷ ^, brackets, |x|, implicit
// multiplication (2x, 3sin(x), (x+1)(x-1)), pi / π, e and common functions.

export type Fn = (x: number) => number;

const FUNCS: Record<string, (v: number) => number> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs,
  ln: Math.log, log: Math.log10, exp: Math.exp,
  floor: Math.floor, ceil: Math.ceil, round: Math.round,
};
const TRIG = new Set(['sin', 'cos', 'tan']);
const ATRIG = new Set(['asin', 'acos', 'atan']);

type Tok = { t: 'num'; v: number } | { t: 'id'; v: string } | { t: 'op'; v: string };

/** Letters a teacher can use as adjustable numbers (sliders in the graph tool). */
export const PARAMS = ['a', 'b', 'c', 'k', 'm'];

function tokenize(src: string, params: boolean): Tok[] {
  const s = src.replace(/[×·]/g, '*').replace(/÷/g, '/').replace(/[−–]/g, '-').replace(/π/g, 'pi').replace(/²/g, '^2').replace(/³/g, '^3').replace(/√/g, 'sqrt');
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) i++;
    else if (/[0-9.]/.test(c)) {
      const m = /^(\d*\.?\d+(?:e[+-]?\d+)?|\d+\.)/i.exec(s.slice(i))!;
      if (!m) throw new Error(`Bad number near "${s.slice(i, i + 5)}"`);
      out.push({ t: 'num', v: parseFloat(m[0]) });
      i += m[0].length;
    } else if (/[a-z]/i.test(c)) {
      const m = /^[a-z]+/i.exec(s.slice(i))![0].toLowerCase();
      // Split runs like "xsin" or "pix" into known words.
      let rest = m;
      while (rest) {
        const w = Object.keys(FUNCS).concat(['pi', 'x', 'e', 'y'], params ? PARAMS : []).sort((a, b) => b.length - a.length).find((k) => rest.startsWith(k));
        if (!w) throw new Error(`Unknown word "${rest}"`);
        out.push({ t: 'id', v: w });
        rest = rest.slice(w.length);
      }
      i += m.length;
    } else if ('+-*/^()|,%!'.includes(c)) {
      out.push({ t: 'op', v: c });
      i++;
    } else throw new Error(`Unexpected "${c}"`);
  }
  return out;
}

type Node = (x: number) => number;

export function compile(src: string, opts: { deg?: boolean; params?: Record<string, number> } = {}): Fn {
  const toks = tokenize(src, !!opts.params);
  const params = opts.params;
  let i = 0;
  const peek = () => toks[i];
  const isOp = (v: string) => peek()?.t === 'op' && peek().v === v;
  const eat = (v: string) => {
    if (!isOp(v)) throw new Error(`Expected "${v}"`);
    i++;
  };
  const k = opts.deg ? Math.PI / 180 : 1;

  function expr(): Node {
    let a = term();
    while (isOp('+') || isOp('-')) {
      const op = toks[i++].v;
      const l = a, r = term();
      a = op === '+' ? (x) => l(x) + r(x) : (x) => l(x) - r(x);
    }
    return a;
  }
  function startsFactor(): boolean {
    const t = peek();
    return !!t && (t.t === 'num' || t.t === 'id' || (t.t === 'op' && t.v === '('));
  }
  function term(): Node {
    let a = unary();
    for (;;) {
      if (isOp('*') || isOp('/') || isOp('%')) {
        const op = toks[i++].v;
        const l = a, r = unary();
        a = op === '*' ? (x) => l(x) * r(x) : op === '/' ? (x) => l(x) / r(x) : (x) => l(x) % r(x);
      } else if (startsFactor()) {
        const l = a, r = unary();
        a = (x) => l(x) * r(x);
      } else return a;
    }
  }
  function unary(): Node {
    if (isOp('-')) {
      i++;
      const a = unary();
      return (x) => -a(x);
    }
    if (isOp('+')) {
      i++;
      return unary();
    }
    return power();
  }
  function power(): Node {
    let a = postfix();
    if (isOp('^')) {
      i++;
      const b = unary();
      const base = a;
      a = (x) => Math.pow(base(x), b(x));
    }
    return a;
  }
  function postfix(): Node {
    let a = primary();
    while (isOp('!')) {
      i++;
      const f = a;
      a = (x) => {
        const n = Math.round(f(x));
        if (n < 0 || n > 170) return NaN;
        let r = 1;
        for (let j = 2; j <= n; j++) r *= j;
        return r;
      };
    }
    return a;
  }
  function primary(): Node {
    const t = toks[i++];
    if (!t) throw new Error('Incomplete expression');
    if (t.t === 'num') return () => t.v;
    if (t.t === 'id') {
      if (t.v === 'x') return (x) => x;
      if (t.v === 'pi') return () => Math.PI;
      if (t.v === 'e') return () => Math.E;
      if (t.v === 'y') throw new Error('Write only the right side, e.g. x^2 + 1');
      if (params && PARAMS.includes(t.v)) {
        const name = t.v;
        // Read live, so moving a slider needs no re-compile.
        return () => params[name] ?? 1;
      }
      const f = FUNCS[t.v];
      // sin x, sin(x), sin 30
      const arg = isOp('(') ? (i++, (() => { const e = expr(); eat(')'); return e; })()) : power();
      if (TRIG.has(t.v)) return (x) => f(arg(x) * k);
      if (ATRIG.has(t.v)) return (x) => f(arg(x)) / k;
      return (x) => f(arg(x));
    }
    if (t.v === '(') {
      const e = expr();
      eat(')');
      return e;
    }
    if (t.v === '|') {
      const e = expr();
      eat('|');
      return (x) => Math.abs(e(x));
    }
    throw new Error(`Unexpected "${t.v}"`);
  }

  const root = expr();
  if (i < toks.length) throw new Error(`Unexpected "${(toks[i] as Tok).v}"`);
  return root;
}

/** Tidy number for display (no 0.30000000000000004). */
export function fmtNum(v: number): string {
  if (!isFinite(v)) return isNaN(v) ? 'Error' : v > 0 ? '∞' : '−∞';
  if (Math.abs(v) >= 1e12 || (Math.abs(v) < 1e-6 && v !== 0)) return v.toExponential(6).replace(/\.?0+e/, 'e');
  return String(parseFloat(v.toPrecision(12)));
}

/** Which adjustable letters (a, b, c, k, m) an expression uses. */
export function usedParams(src: string): string[] {
  try {
    const found = new Set<string>();
    for (const t of tokenize(src, true)) if (t.t === 'id' && PARAMS.includes(t.v)) found.add(t.v);
    return PARAMS.filter((p) => found.has(p));
  } catch {
    return [];
  }
}

/** Pretty form for labels: x^2 → x², sqrt → √, * → ·, pi → π. */
export function prettyExpr(src: string): string {
  const sup: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
  return src
    .replace(/\^\(?(-?\d+)\)?/g, (_, n: string) => [...n].map((c) => sup[c] ?? c).join(''))
    .replace(/sqrt/g, '√')
    .replace(/\bpi\b/g, 'π')
    .replace(/\*/g, '·')
    .replace(/\s+/g, ' ')
    .trim();
}
