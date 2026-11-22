import { icon } from './icons';
import { fadeOut } from './panel';

// The Teachly guide (the "i" button in the Menu): every feature in plain English, with steps and a tip, on a calm
// white page that scrolls; a search box finds a button by its name. And the short welcome shown the first time
// Teachly opens. Loaded only when needed (nothing of this runs while the teacher writes).

interface Entry {
  name: string;
  /** Extra words people may search for. */
  keys?: string;
  what: string;
  steps: string[];
  tip: string;
}
interface Section {
  title: string;
  items: Entry[];
}

const GUIDE: Section[] = [
  {
    title: 'Start here',
    items: [
      { name: 'Toolbar', keys: 'bar buttons bottom top', what: 'All your tools sit in the bar at the edge of the screen.', steps: ['Tap a tool to use it.', 'Tap the same tool again to see its options.'], tip: 'Hide buttons you never use: Menu ▸ Edit toolbar. You can also move the bar to the top.' },
      { name: 'Notebooks', keys: 'library folder cover favourite trash', what: 'Every topic lives in a notebook, like a real copy.', steps: ['Menu ▸ Notebooks.', 'Tap New, give it a name and pick a cover.', 'Star a notebook to keep it in Favourites; make folders for each subject or class.'], tip: 'One notebook per chapter keeps a whole year easy to find. Deleted notebooks wait in Trash until you empty it.' },
      { name: 'Saving', keys: 'autosave saved backup', what: 'Teachly saves by itself while you work. Nothing leaves your device.', steps: ['Just write: the small “Saved” sign shows it is done.'], tip: 'For a backup, Menu ▸ Save notebook makes a file you can keep anywhere and open later with Open file.' },
    ],
  },
  {
    title: 'Write',
    items: [
      { name: 'Pen', keys: 'pens pencil fineliner ball pen crayon fountain marker watercolour brush calligraphy write', what: 'Ten real pens: pencil, fine liner, ball pen, crayon, fountain pen, marker, watercolour, brush, calligraphy and highlighter.', steps: ['Tap the pen button.', 'Tap a pen in the tray. It rises to show it is in use.', 'Pick a colour and set the size with the slider.'], tip: 'Each pen remembers its own colour. Keep a blue ball pen for writing and a red fine liner for corrections, then switch with one tap.' },
      { name: 'Colour flower', keys: 'colour color rainbow any colour picker', what: 'Any colour you like, from a flower of colours.', steps: ['In the pen bar, tap the rainbow circle.', 'Slide your finger over the flower: a bubble shows the colour under it.', 'Lift your finger to pick it.'], tip: 'Soft colours near the middle are great for highlighting areas; deep colours near the edge read well from the back of the class.' },
      { name: 'Highlighter', keys: 'mark see-through', what: 'A see-through pen that marks without hiding the text below.', steps: ['Pen ▸ Highlighter.', 'Drag over words.'], tip: 'Mark key lines on PDF pages while you study, or while the class follows in their books.' },
      { name: 'Perfect shapes by hand', keys: 'hold shape circle line', what: 'Draw a rough circle, line or box and hold still: it becomes neat.', steps: ['Turn on Menu ▸ Settings ▸ Hold pen to make a shape.', 'Draw, keep the pen still for a moment at the end.'], tip: 'Perfect for quick diagrams in your notes or while you explain.' },
      { name: 'Group writing', keys: 'many students multi touch together', what: 'Several people write on the board at the same time.', steps: ['Tools ▸ Group writing.'], tip: 'Run a “who solves it first” race with two students at the board.' },
      { name: 'Stylus only', keys: 'palm apple pencil fingers', what: 'With a stylus, only the stylus writes; fingers and palms do not.', steps: ['Menu ▸ Settings ▸ Stylus only.'], tip: 'Keep it off on classroom boards, so the board pen and fingers both write.' },
    ],
  },
  {
    title: 'Erase and undo',
    items: [
      { name: 'Eraser', keys: 'rub delete clean', what: 'Removes writing.', steps: ['Tap the eraser.', 'Drag over what you want to remove. Tap the eraser again for its options.'], tip: 'Faster: scribble over writing with the pen to erase it, or rub with your palm (both can be turned on in Settings).' },
      { name: 'Undo and Redo', keys: 'back mistake', what: 'Step back or forward.', steps: ['Tap the curved arrows.'], tip: 'Undo also brings back a deleted page or a moved picture.' },
    ],
  },
  {
    title: 'Shapes, text and colour',
    items: [
      { name: 'Shapes', keys: 'rectangle circle arrow line triangle', what: 'Clean lines, arrows, boxes, circles and more.', steps: ['Tap Shapes and pick one.', 'Drag on the board.'], tip: 'Draw a box, then use Fill colour to make a coloured label.' },
      { name: 'Text', keys: 'type keyboard words', what: 'Typed text for titles and notes.', steps: ['Tap Text, then tap the board where it should go.', 'Type. Tap outside when done.'], tip: 'Typed headings with handwritten notes look clean in the saved PDF.' },
      { name: 'Fill colour', keys: 'bucket paint inside', what: 'Colours the inside of a shape or a closed drawing.', steps: ['Tap the bucket and pick a colour.', 'Tap inside the shape.'], tip: 'Colour the parts of a diagram (lens, prism, cell): easier to remember, and visible from far away on a board.' },
      { name: 'Select', keys: 'move resize rotate copy lock group', what: 'Move, resize, turn, copy, recolour or delete things.', steps: ['Tap the select arrow.', 'Tap an item, or draw around several.', 'Use the handles and the buttons that appear.'], tip: 'Lock a picture you write on so it does not move by accident.' },
      { name: 'Table', keys: 'rows columns grid', what: 'A clean table you can type into.', steps: ['Insert ▸ Table.', 'Slide to choose rows and columns.'], tip: 'Great for observation tables in practicals.' },
    ],
  },
  {
    title: 'Pages',
    items: [
      { name: 'Pages panel', keys: 'all pages reorder drag move copy', what: 'Every page of the notebook at the side.', steps: ['Tap the stacked-pages button.', 'Tap a page to open it.', 'Hold a page and move it up or down to change the order.'], tip: 'Drag a page out onto the board to copy everything on it into the page you are on.' },
      { name: 'All pages (full screen)', keys: 'grid expand overview', what: 'All pages as a grid.', steps: ['Pages panel ▸ Expand.'], tip: 'Use it for a quick recap: the whole topic at a glance before an exam or at the end of a class.' },
      { name: 'New page and page arrows', keys: 'add next previous', what: 'Add pages and move between them.', steps: ['Tap + for a new page; use the arrows to go back and forth.'], tip: 'Keep one idea per page: revising later is much easier.' },
      { name: 'Board colour and paper', keys: 'background black white lines grid dots', what: 'Black, white or green boards with lines, grid or dots.', steps: ['Open the Menu and pick a colour and a paper.'], tip: 'Graph paper for physics plots, four lines for handwriting practice.' },
    ],
  },
  {
    title: 'PDF, slides and pictures',
    items: [
      { name: 'PDF / Book', keys: 'pdf book chapter import add end', what: 'Open a PDF and write on its pages.', steps: ['Insert ▸ PDF / Book and choose the file.', 'Choose where its pages go: at the end, after this page or at the start.'], tip: 'Add the next chapter at the end of the same notebook, so the whole book and your notes stay in one place.' },
      { name: 'PowerPoint', keys: 'slides pptx presentation', what: 'Show your slides and write on them.', steps: ['Insert ▸ PowerPoint and choose the file.'], tip: 'Write notes or answers right on the slides.' },
      { name: 'Picture and Crop', keys: 'image photo crop cut', what: 'Add a picture and keep only the part you need.', steps: ['Insert ▸ Picture.', 'Select the picture ▸ Crop, drag the corners, Done.'], tip: 'Crop a question from a photo of a book and solve it beside it.' },
    ],
  },
  {
    title: 'Tools',
    items: [
      { name: 'Laser pointer', keys: 'point show red', what: 'A glowing pointer that fades away.', steps: ['Tools ▸ Laser pointer.', 'Point and move.'], tip: 'Point without leaving marks when you explain a diagram to others.' },
      { name: 'Tape', keys: 'hide answer reveal cover', what: 'Hide answers, tap to show them.', steps: ['Tools ▸ Tape.', 'Drag a strip over the answer. Tap it to reveal.'], tip: 'Hide answers to test yourself while revising, or ask the class first and then reveal.' },
      { name: 'Spotlight and Screen cover', keys: 'focus dim curtain', what: 'Show only one part of the board.', steps: ['Tools ▸ Spotlight or Screen cover.'], tip: 'Reveal a long solution step by step.' },
      { name: 'Magnifier', keys: 'zoom lens big', what: 'A lens that makes small details big.', steps: ['Tools ▸ Magnifier and move it over the board.'], tip: 'Read small labels in a diagram, or show them to the back rows.' },
      { name: 'Ruler, Protractor, Compass', keys: 'straight line angle circle geometry', what: 'Real drawing instruments on the board.', steps: ['Tools ▸ Ruler, Protractor or Compass.', 'Draw along the edge with the pen.'], tip: 'The pen snaps to the ruler edge: perfectly straight ray diagrams.' },
      { name: 'Graph', keys: 'plot function y = equation curve', what: 'Draws y = f(x) curves.', steps: ['Tools ▸ Graph.', 'Type an equation or tap an example.', 'Put on board.'], tip: 'Plot two curves together and ask where they meet.' },
      { name: 'Calculator', keys: 'math numbers', what: 'A calculator on the board.', steps: ['Tools ▸ Calculator.'], tip: 'Solve numericals without leaving your notes.' },
      { name: 'Timer', keys: 'clock countdown time', what: 'A countdown everyone can see.', steps: ['Tap Timer and set the minutes.'], tip: 'Time yourself on practice questions, or run quick class tests.' },
      { name: 'Subject helpers', keys: 'physics chapter pieces diagrams', what: 'Ready pieces for a chapter, like blocks and pulleys.', steps: ['Menu ▸ Subject, pick the class and chapter.'], tip: 'Build free-body diagrams in seconds.' },
    ],
  },
  {
    title: 'Class and groups',
    items: [
      { name: 'Poll A B C D', keys: 'vote quiz question', what: 'Quick hand-count of answers.', steps: ['Tools ▸ Poll and tap the counts.'], tip: 'Shows at once which wrong idea most students have.' },
      { name: 'Random picker', keys: 'name student choose dice', what: 'Picks a student at random.', steps: ['Tools ▸ Random picker and add names.'], tip: 'Fair turns: nobody feels left out.' },
      { name: 'Scoreboard', keys: 'team points game', what: 'Scores for teams.', steps: ['Tools ▸ Scoreboard.'], tip: 'Turn revision into a team quiz.' },
      { name: 'Record lesson', keys: 'video voice microphone record', what: 'Records your page and your voice as a video on your device.', steps: ['Tap Record and allow the microphone.', 'Tap Stop to save the video.'], tip: 'Explain a topic once and keep the video for revision, or share it with anyone who missed the class.' },
    ],
  },
  {
    title: 'Move, zoom and show',
    items: [
      { name: 'Slide mode (hand)', keys: 'move pan zoom pinch', what: 'Move and zoom the board.', steps: ['Tap the hand.', 'Drag to move, pinch to zoom, double tap to zoom in or out.'], tip: 'Tap the frame button to see the whole page again.' },
      { name: 'Screenshot', keys: 'capture picture area', what: 'Saves a picture of part of the board.', steps: ['Tap the camera-frame button and drag over an area.'], tip: 'Save a key diagram to revise later or share with friends.' },
      { name: 'Full screen', keys: 'big hide browser', what: 'Hides everything except Teachly.', steps: ['Menu ▸ Full screen.'], tip: 'Use it on boards and projectors for a clean view.' },
    ],
  },
  {
    title: 'Save and share',
    items: [
      { name: 'Save PDF', keys: 'export download print', what: 'Your notes as a sharp PDF.', steps: ['Menu ▸ Save PDF.', 'Choose this page, all pages or a range.'], tip: 'Print your notes or share them as a PDF.' },
      { name: 'Save picture', keys: 'png image export', what: 'The page as a picture.', steps: ['Menu ▸ Save picture.'], tip: 'Good for a single diagram or a homework question.' },
      { name: 'Share Teachly', keys: 'link friend teacher', what: 'Tell friends and teachers about Teachly.', steps: ['Menu ▸ Share.'], tip: 'Teachly is free for everyone.' },
    ],
  },
  {
    title: 'Settings',
    items: [
      { name: 'Edit toolbar', keys: 'customise buttons top bottom hexagon', what: 'Choose which buttons show, and where the bar sits.', steps: ['Menu ▸ Edit toolbar.'], tip: 'Put your six favourite tools on the floating hexagon to reach them anywhere.' },
      { name: 'Large buttons', keys: 'big board fingers', what: 'Bigger buttons for classroom boards.', steps: ['Menu ▸ Settings ▸ Large buttons.'], tip: 'Easier to hit from a step away from the board.' },
      { name: 'Your privacy', keys: 'privacy data safe', what: 'No account, no tracking. Everything stays on your device.', steps: ['Menu ▸ Privacy to read the full policy.'], tip: 'Clearing the app’s data or uninstalling removes your notebooks, so keep backups.' },
    ],
  },
];

/** The icon each feature has in the app (shown beside its name). */
const ICON: Record<string, string> = {
  Toolbar: 'tools', Notebooks: 'notebook', Saving: 'save', Pen: 'pk_pen', 'Colour flower': 'palette', Highlighter: 'pk_highlighter',
  'Perfect shapes by hand': 'magic', 'Group writing': 'pen', 'Stylus only': 'pk_pencil', Eraser: 'eraser', 'Undo and Redo': 'undo',
  Shapes: 'shapes', Text: 'text', 'Fill colour': 'bucket', Select: 'select', Table: 'table', 'Pages panel': 'pages',
  'All pages (full screen)': 'expand', 'New page and page arrows': 'plus', 'Board colour and paper': 'background', 'PDF / Book': 'pdf',
  PowerPoint: 'slides', 'Picture and Crop': 'crop', 'Laser pointer': 'laser', Tape: 'tape', 'Spotlight and Screen cover': 'spotlight',
  Magnifier: 'magnifier', 'Ruler, Protractor, Compass': 'ruler', Graph: 'graph', Calculator: 'calc', Timer: 'timer', 'Subject helpers': 'atom',
  'Poll A B C D': 'poll', 'Random picker': 'dice', Scoreboard: 'score', 'Record lesson': 'record', 'Slide mode (hand)': 'pan',
  Screenshot: 'shot', 'Full screen': 'fullscreen', 'Save PDF': 'download', 'Save picture': 'image', 'Share Teachly': 'share',
  'Edit toolbar': 'settings', 'Large buttons': 'bigger', 'Your privacy': 'shield',
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const words = (e: Entry) => `${e.name} ${e.keys ?? ''} ${e.what}`.toLowerCase();

/** Opens the guide over everything (white page, search on top). */
export function openGuide(host: HTMLElement): void {
  if (host.querySelector('.guide')) return;
  const el = document.createElement('section');
  el.className = 'guide';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Teachly guide');
  el.innerHTML = `
    <header class="gd-top">
      <div class="gd-bar"><h1>Guide</h1><button class="gd-x" data-gd="close" aria-label="Close the guide">✕</button></div>
      <label class="gd-search"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16.5 16.5L21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><input type="search" placeholder="Search a button, e.g. pen, PDF, tape" aria-label="Search the guide"></label>
    </header>
    <div class="gd-body">
      <p class="gd-intro">Everything Teachly can do, with the quickest way to do it.</p>
      ${GUIDE.map((s, si) => `<div class="gd-sec" data-s="${si}"><h2>${esc(s.title)}</h2>${s.items
        .map((e, i) => `<article class="gd-item" data-k="${esc(words(e))}" data-i="${si}-${i}"><h3><span class="gd-ic" aria-hidden="true">${icon(ICON[e.name] ?? 'help', 20)}</span>${esc(e.name)}</h3><p>${esc(e.what)}</p><ol>${e.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol><p class="gd-tip"><b>Tip</b> ${esc(e.tip)}</p></article>`)
        .join('')}</div>`).join('')}
      <p class="gd-none" hidden>Nothing found. Try another word, like “colour” or “page”.</p>
    </div>`;
  host.appendChild(el);
  const input = el.querySelector('input') as HTMLInputElement;
  const none = el.querySelector('.gd-none') as HTMLElement;
  // Search as you type: matching features stay, sections without a match hide.
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    let shown = 0;
    el.querySelectorAll<HTMLElement>('.gd-sec').forEach((sec) => {
      let any = false;
      sec.querySelectorAll<HTMLElement>('.gd-item').forEach((it) => {
        const ok = !q || q.split(/\s+/).every((w) => (it.dataset.k ?? '').includes(w));
        it.hidden = !ok;
        if (ok) any = true;
      });
      sec.hidden = !any;
      if (any) shown++;
    });
    none.hidden = shown > 0;
  });
  const close = () => {
    document.removeEventListener('keydown', onKey);
    fadeOut(el, 200);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);
  el.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('[data-gd=close]')) close();
  });
}

const CARDS: [string, string, string][] = [
  ['✨', 'Notes that feel like magic', 'Write, draw and explain. On phone, tablet or board.'],
  ['🖊️', 'Ten real pens', 'Each pen keeps its own colour.'],
  ['📚', 'Everything in one notebook', 'Notes, PDFs and pictures together. Saves by itself.'],
  ['ⓘ', 'Need help? Tap the i', 'Every button explained, with search.'],
];

/**
 * Faint grey pictures scattered at angles behind the first card: tools and school subjects. [what, left %, top %, turn°, size px]
 * `what` is an app icon name, or a symbol in quotes ("π", "H₂O"): written as text in the correct maths/science form.
 */
const BG: [string, number, number, number, number][] = [
  ['pen', 7, 9, -18, 44], ['atom', 24, 22, -10, 38], ['"π"', 90, 10, 12, 44],
  ['flask', 6, 36, 14, 42], ['"√x"', 94, 36, -10, 34], ['ruler', 88, 60, 30, 46],
  ['"Σ"', 4, 62, -8, 44], ['graph', 22, 88, -12, 42], ['"H₂O"', 50, 94, 0, 30],
  ['compass', 78, 88, -20, 42], ['bolt', 30, 8, 16, 34], ['"∫"', 70, 6, 10, 46],
  ['abc', 96, 82, 14, 34], ['"Δ"', 3, 88, 12, 36],
  // in the middle too, behind the words (very faint)
  ['"E=mc²"', 60, 44, -6, 28], ['setsquare', 36, 47, 18, 40], ['"x²"', 68, 66, 12, 34], ['protractor', 30, 72, -14, 40],
  ['"∞"', 42, 26, 0, 36], ['calc', 62, 24, 10, 32], ['"θ"', 18, 44, 0, 34], ['magnifier', 80, 46, -18, 34],
  ['"%"', 54, 72, 8, 30], ['notebook', 46, 60, -8, 34],
];

/** The short welcome shown the first time Teachly opens: four calm cards, Skip any time. */
export function showWelcome(host: HTMLElement, done: () => void): void {
  const back = document.createElement('div');
  back.className = 'welcome';
  const bg = BG.map(([n, x, y, r, z]) => `<i style="left:${x}%;top:${y}%;transform:translate(-50%,-50%) rotate(${r}deg);font-size:${z}px">${n.startsWith('"') ? esc(n.slice(1, -1)) : icon(n, z)}</i>`).join('');
  back.innerHTML = `<div class="wl-card" role="dialog" aria-label="Welcome to Teachly"><div class="wl-bg" aria-hidden="true">${bg}</div><div class="wl-ic" aria-hidden="true"></div><h2></h2><p></p><div class="wl-dots">${CARDS.map(() => '<i></i>').join('')}</div><div class="wl-btns"><button class="wl-skip" data-wl="skip">Skip</button><button class="wl-next" data-wl="next">Next</button></div></div>`;
  host.appendChild(back);
  let i = 0;
  const card = back.querySelector('.wl-card') as HTMLElement;
  const paint = () => {
    const [ic, h, p] = CARDS[i];
    (card.querySelector('.wl-ic') as HTMLElement).textContent = ic;
    (card.querySelector('h2') as HTMLElement).textContent = h;
    (card.querySelector('p') as HTMLElement).textContent = p;
    card.querySelectorAll('.wl-dots i').forEach((d, k) => d.classList.toggle('on', k === i));
    card.classList.toggle('first', i === 0);
    (card.querySelector('[data-wl=next]') as HTMLElement).textContent = i === CARDS.length - 1 ? 'Let’s start' : 'Next';
    card.classList.remove('turn');
    void card.offsetWidth;
    card.classList.add('turn');
  };
  const end = () => {
    fadeOut(back, 220);
    done();
  };
  back.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('[data-wl]') as HTMLElement | null;
    if (!b) return;
    if (b.dataset.wl === 'skip' || i === CARDS.length - 1) return end();
    i++;
    paint();
  });
  paint();
}
