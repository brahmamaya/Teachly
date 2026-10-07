// Small, safe math expression compiler (no eval). Supports + - * / ^ %,
// parentheses, implicit multiplication (2x, 3(x+1), x sin x), unary minus,
// constants pi/e, factorial (!) and common functions.

type Node =
  | { k: 'num'; v: number }
  | { k: 'var'; n: string }
  | { k: 'un'; op: string; a: Node }
  | { k: 'bin'; op: string; a: Node; b: Node }
  | { k: 'fn'; n: string; args: Node[] };

const FUNCS: Record<string, (...a: number[]) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  abs: Math.abs,
  exp: Math.exp,
  ln: Math.log,
  log: Math.log10,
  log2: Math.log2,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  sign: Math.sign,
  min: Math.min,
  max: Math.max,
  pow: Math.pow,
};

const CONSTS: Record<string, number> = { pi: Math.PI, π: Math.PI, e: Math.E };

function factorial(n: number): number {
  if (n < 0 || !Number.isFinite(n)) return NaN;
  if (n > 170) return Infinity;
  // Gamma approximation for non-integers (Lanczos).
  if (!Number.isInteger(n)) {
    const g = 7;
    const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    const x = n;
    let a = c[0];
    const t = x + g + 0.5;
    for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
    return Math.sqrt(2 * Math.PI) * Math.pow(t, x + 0.5) * Math.exp(-t) * a;
  }
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function tokenize(src: string): string[] {
  const s = src.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/√/g, 'sqrt');
  const toks: string[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      if (s[j] === 'e' && /[-+0-9]/.test(s[j + 1] ?? '') && !/[a-z]/i.test(s[j + 1] ?? '')) {
        j++;
        if (s[j] === '+' || s[j] === '-') j++;
        while (j < s.length && /[0-9]/.test(s[j])) j++;
      }
      toks.push(s.slice(i, j));
      i = j;
      continue;
    }
    if (/[a-zπ]/i.test(ch)) {
      let j = i;
      while (j < s.length && /[a-z0-9π]/i.test(s[j])) j++;
      const word = s.slice(i, j).toLowerCase();
      // Split runs like "xsinx" into known names greedily.
      let k = 0;
      while (k < word.length) {
        let matched = '';
        for (const name of [...Object.keys(FUNCS), ...Object.keys(CONSTS)].sort((a, b) => b.length - a.length)) {
          if (word.startsWith(name, k)) {
            matched = name;
            break;
          }
        }
        if (!matched) matched = word[k];
        toks.push(matched);
        k += matched.length;
      }
      i = j;
      continue;
    }
    if ('+-*/^%(),!'.includes(ch)) {
      toks.push(ch);
      i++;
      continue;
    }
    throw new Error(`Unexpected "${ch}"`);
  }
  return toks;
}

function parse(src: string): Node {
  const t = tokenize(src);
  let p = 0;
  const peek = () => t[p];
  const next = () => t[p++];
  const isAtomStart = (tok: string | undefined) => tok !== undefined && (/^[0-9.]/.test(tok) || /^[a-zπ]/i.test(tok) || tok === '(');

  function expr(): Node {
    let a = term();
    while (peek() === '+' || peek() === '-') {
      const op = next();
      a = { k: 'bin', op, a, b: term() };
    }
    return a;
  }
  function term(): Node {
    let a = unary();
    for (;;) {
      if (peek() === '*' || peek() === '/' || peek() === '%') {
        const op = next();
        a = { k: 'bin', op, a, b: unary() };
      } else if (isAtomStart(peek())) {
        a = { k: 'bin', op: '*', a, b: power() };
      } else break;
    }
    return a;
  }
  function unary(): Node {
    if (peek() === '-') {
      next();
      return { k: 'un', op: '-', a: unary() };
    }
    if (peek() === '+') {
      next();
      return unary();
    }
    return power();
  }
  function power(): Node {
    const a = postfix();
    if (peek() === '^') {
      next();
      return { k: 'bin', op: '^', a, b: unary() };
    }
    return a;
  }
  function postfix(): Node {
    let a = atom();
    while (peek() === '!') {
      next();
      a = { k: 'un', op: '!', a };
    }
    return a;
  }
  function atom(): Node {
    const tok = next();
    if (tok === undefined) throw new Error('Unexpected end');
    if (tok === '(') {
      const e = expr();
      if (next() !== ')') throw new Error('Missing )');
      return e;
    }
    if (/^[0-9.]/.test(tok)) {
      const v = Number(tok);
      if (Number.isNaN(v)) throw new Error(`Bad number ${tok}`);
      return { k: 'num', v };
    }
    if (tok in FUNCS) {
      if (peek() === '(') {
        next();
        const args: Node[] = [];
        if (peek() !== ')') {
          args.push(expr());
          while (peek() === ',') {
            next();
            args.push(expr());
          }
        }
        if (next() !== ')') throw new Error('Missing )');
        return { k: 'fn', n: tok, args };
      }
      // sin x  → sin(x)
      return { k: 'fn', n: tok, args: [power()] };
    }
    if (tok in CONSTS) return { k: 'num', v: CONSTS[tok] };
    if (/^[a-z]$/i.test(tok)) return { k: 'var', n: tok };
    throw new Error(`Unknown "${tok}"`);
  }
  const root = expr();
  if (p < t.length) throw new Error(`Unexpected "${t[p]}"`);
  return root;
}

function evalNode(n: Node, vars: Record<string, number>): number {
  switch (n.k) {
    case 'num':
      return n.v;
    case 'var':
      if (!(n.n in vars)) throw new Error(`Unknown variable ${n.n}`);
      return vars[n.n];
    case 'un':
      return n.op === '-' ? -evalNode(n.a, vars) : factorial(evalNode(n.a, vars));
    case 'bin': {
      const a = evalNode(n.a, vars), b = evalNode(n.b, vars);
      switch (n.op) {
        case '+': return a + b;
        case '-': return a - b;
        case '*': return a * b;
        case '/': return a / b;
        case '%': return a % b;
        case '^': return Math.pow(a, b);
      }
      return NaN;
    }
    case 'fn':
      return FUNCS[n.n](...n.args.map((x) => evalNode(x, vars)));
  }
}

export function compile(src: string): (vars: Record<string, number>) => number {
  // Allow "y = ..." / "f(x) = ..." prefixes.
  const body = src.replace(/^\s*(y|f\s*\(\s*x\s*\))\s*=/i, '');
  const tree = parse(body);
  return (vars) => evalNode(tree, vars);
}

export function evaluate(src: string): number {
  return compile(src)({});
}

export function formatNumber(v: number): string {
  if (!Number.isFinite(v)) return Number.isNaN(v) ? 'Error' : v > 0 ? '∞' : '-∞';
  if (Math.abs(v) >= 1e12 || (Math.abs(v) < 1e-6 && v !== 0)) return v.toExponential(6).replace(/\.?0+e/, 'e');
  return String(Math.round(v * 1e10) / 1e10);
}
