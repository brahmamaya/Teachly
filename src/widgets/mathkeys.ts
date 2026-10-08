// On-screen maths keyboard for the graph tool. Big keys for fingers and
// pens, three pages (numbers, functions, letters & science), and it keeps
// the caret in the equation box. "|" in a key's text marks where the
// caret lands after inserting (e.g. "sqrt(|)").

type Key = { label: string; ins?: string; act?: 'left' | 'right' | 'del' | 'clear' | 'abc'; cls?: string; title?: string };

const k = (label: string, ins = label, cls = '', title = ''): Key => ({ label, ins, cls, title });

const PAGES: Record<string, Key[]> = {
  '123': [
    k('7'), k('8'), k('9'), k('÷', '/', 'op'), k('x', 'x', 'var'), k('(', '('),
    k('4'), k('5'), k('6'), k('×', '*', 'op'), k('x²', '^2', '', 'squared'), k(')', ')'),
    k('1'), k('2'), k('3'), k('−', '-', 'op'), k('xⁿ', '^(|)', '', 'power'), k('√', 'sqrt(|)', '', 'square root'),
    k('0'), k('.'), k('π', 'pi'), k('+', '+', 'op'), k('|x|', 'abs(|)', '', 'absolute value'), k('1/x', '1/(|)', '', 'one over'),
  ],
  'f(x)': [
    k('sin', 'sin(|)'), k('cos', 'cos(|)'), k('tan', 'tan(|)'), k('sin⁻¹', 'asin(|)'), k('cos⁻¹', 'acos(|)'), k('tan⁻¹', 'atan(|)'),
    k('ln', 'ln(|)'), k('log', 'log(|)'), k('eˣ', 'e^(|)'), k('10ˣ', '10^(|)'), k('x³', '^3'), k('∛', 'cbrt(|)'),
    k('sinh', 'sinh(|)'), k('cosh', 'cosh(|)'), k('tanh', 'tanh(|)'), k('⌊x⌋', 'floor(|)', '', 'round down'), k('⌈x⌉', 'ceil(|)', '', 'round up'), k('n!', '!', '', 'factorial'),
    k('x', 'x', 'var'), k('(', '('), k(')', ')'), k('^', '^'), k('×', '*', 'op'), k('÷', '/', 'op'),
  ],
  'abc': [
    k('a', 'a', 'var', 'slider a'), k('b', 'b', 'var', 'slider b'), k('c', 'c', 'var', 'slider c'), k('k', 'k', 'var', 'slider k'), k('m', 'm', 'var', 'slider m'), k('x', 'x', 'var'),
    k('π', 'pi'), k('e', 'e'), k('×10ⁿ', '*10^(|)', '', 'scientific notation'), k('ⁿ√', '^(1/|)', '', 'n-th root: x^(1/n)'), k('%', '%', '', 'remainder'), k('^', '^'),
    k('7'), k('8'), k('9'), k('+', '+', 'op'), k('−', '-', 'op'), k('(', '('),
    k('4'), k('5'), k('6'), k('×', '*', 'op'), k('÷', '/', 'op'), k(')', ')'),
  ],
};

const BOTTOM: Key[] = [
  { label: '◀', act: 'left', title: 'Move left' },
  { label: '▶', act: 'right', title: 'Move right' },
  { label: 'ABC', act: 'abc', title: 'Type with the normal keyboard' },
  { label: 'Clear', act: 'clear', cls: 'soft' },
  { label: '⌫', act: 'del', cls: 'wide', title: 'Delete' },
];

/**
 * Build the keyboard. `target()` returns the equation box to type into;
 * `changed()` is called after every key.
 */
export function mathKeyboard(target: () => HTMLInputElement, changed: () => void): HTMLElement {
  const el = document.createElement('div');
  el.className = 'mk';
  let page = '123';
  const key = (x: Key, i: number) =>
    `<button class="mk-key ${x.cls ?? ''}" data-i="${i}" ${x.title ? `title="${x.title}" aria-label="${x.title}"` : ''}>${x.label}</button>`;
  const render = () => {
    el.innerHTML = `
      <div class="mk-tabs">${Object.keys(PAGES).map((p) => `<button class="mk-tab ${p === page ? 'on' : ''}" data-page="${p}">${p}</button>`).join('')}</div>
      <div class="mk-grid">${PAGES[page].map(key).join('')}</div>
      <div class="mk-bottom">${BOTTOM.map((x, i) => key(x, 100 + i)).join('')}</div>`;
  };
  // Keep the caret in the equation box while keys are pressed.
  el.addEventListener('pointerdown', (e) => e.preventDefault());
  el.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button') as HTMLElement | null;
    if (!b) return;
    if (b.dataset.page) {
      page = b.dataset.page;
      return render();
    }
    const i = Number(b.dataset.i);
    const x = i >= 100 ? BOTTOM[i - 100] : PAGES[page][i];
    const inp = target();
    const a = inp.selectionStart ?? inp.value.length, z = inp.selectionEnd ?? a;
    const v = inp.value;
    let caret = a;
    switch (x.act) {
      case 'left':
        caret = Math.max(0, a - 1);
        break;
      case 'right':
        caret = Math.min(v.length, z + 1);
        break;
      case 'del': {
        // Delete a whole function name with its bracket ("sin(" → "").
        const before = v.slice(0, a);
        const m = a === z ? /(asin|acos|atan|sinh|cosh|tanh|sqrt|cbrt|floor|ceil|abs|sin|cos|tan|log|ln)\($|pi$/.exec(before) : null;
        const from = a !== z ? a : m ? a - m[0].length : Math.max(0, a - 1);
        inp.value = v.slice(0, from) + v.slice(z);
        caret = from;
        break;
      }
      case 'clear':
        inp.value = '';
        caret = 0;
        break;
      case 'abc':
        // Hand over to the device keyboard.
        inp.inputMode = 'text';
        inp.blur();
        inp.focus();
        return;
      default: {
        const ins = x.ins ?? x.label;
        const at = ins.indexOf('|');
        const text = ins.replace('|', '');
        inp.value = v.slice(0, a) + text + v.slice(z);
        caret = a + (at >= 0 ? at : text.length);
      }
    }
    inp.focus();
    inp.setSelectionRange(caret, caret);
    changed();
  });
  render();
  return el;
}
