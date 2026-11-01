import { icon } from './icons';
import { fadeOut } from './panel';

// Privacy policy and Terms of use, shown inside the app (they work offline).
// Every sentence must stay true to what the code does: if a feature changes
// what is stored or sent, change these texts in the same commit and update
// the date.

const UPDATED = '1 November 2026';

const PRIVACY = `
<h1>Privacy policy</h1>
<p class="lg-date">Teachly by Physica · ${UPDATED}</p>
<ul class="lg-list">
  <li><b>No account.</b> No sign-in, ads, tracking or analytics.</li>
  <li><b>Stays on your device:</b> notebooks, opened PDFs and slides, settings, names in the picker and scoreboard. Never sent to us.</li>
  <li><b>Not collected:</b> name, email, phone, contacts, location, camera or photos (only a file you pick is opened).</li>
  <li><b>Internet:</b> only to load and update Teachly's own files. The website host (GitHub Pages) sees normal technical details like your IP address.</li>
  <li><b>Microphone:</b> only for Record lesson. The video is saved on your device.</li>
  <li><b>Android permissions:</b> internet (updates) and microphone (recording). Nothing else.</li>
  <li><b>Deleting:</b> Trash → Empty trash, or uninstall the app / clear site data. We have no copy, so we cannot recover it.</li>
  <li><b>iPad:</b> Safari may clear unused websites. Add Teachly to the Home Screen and keep PDFs of important lessons.</li>
  <li><b>Security:</b> protected by your device's lock. Anyone using your device can open your notebooks.</li>
  <li><b>Children:</b> no personal data is collected from anyone.</li>
</ul>
<p class="lg-contact">Questions: <b>easy@physica.in</b></p>
`;

const TERMS = `
<h1>Terms of use</h1>
<p class="lg-date">Teachly by Physica · ${UPDATED}</p>
<ul class="lg-list">
  <li><b>Free</b> for teachers, students and schools to teach and learn.</li>
  <li><b>Your content is yours</b>, and so is the responsibility. Use only material you are allowed to use.</li>
  <li><b>Recording:</b> get permission where needed before recording people.</li>
  <li><b>Keep copies:</b> lessons stay only on your device; we cannot restore them.</li>
  <li><b>No misuse:</b> nothing unlawful, harmful or abusive.</li>
  <li><b>Updates:</b> Teachly updates itself; features may change.</li>
  <li><b>Name and design</b> belong to Physica. Do not sell Teachly or present it as your own.</li>
  <li><b>As is:</b> no guarantee it works on every device. As far as the law allows, Physica is not responsible for lost data.</li>
  <li><b>Changes:</b> new versions of these terms are shown here with a new date.</li>
</ul>
<p class="lg-contact">Questions: <b>easy@physica.in</b></p>
`;

/** Open the Privacy policy or the Terms of use as a full-screen page. */
export function showLegal(host: HTMLElement, which: 'privacy' | 'terms'): void {
  host.querySelector('.legal')?.remove();
  const el = document.createElement('section');
  el.className = 'legal';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', which === 'privacy' ? 'Privacy policy' : 'Terms of use');
  // Fixed texts from this file only (no user input).
  el.innerHTML = `
    <header class="lg-head">
      <div class="lg-tabs">
        <button class="lg-tab ${which === 'privacy' ? 'on' : ''}" data-lg="privacy">Privacy policy</button>
        <button class="lg-tab ${which === 'terms' ? 'on' : ''}" data-lg="terms">Terms of use</button>
      </div>
      <button class="icon-btn" data-lg="close" title="Close" aria-label="Close">${icon('close', 22)}</button>
    </header>
    <article class="lg-body">${which === 'privacy' ? PRIVACY : TERMS}</article>`;
  el.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('[data-lg]') as HTMLElement | null;
    if (!b) return;
    if (b.dataset.lg === 'close') return fadeOut(el, 180);
    const next = b.dataset.lg as 'privacy' | 'terms';
    (el.querySelector('.lg-body') as HTMLElement).innerHTML = next === 'privacy' ? PRIVACY : TERMS;
    el.querySelectorAll('.lg-tab').forEach((t) => t.classList.toggle('on', t === b));
    (el.querySelector('.lg-body') as HTMLElement).scrollTop = 0;
  });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') fadeOut(el, 180);
  });
  host.appendChild(el);
  (el.querySelector('[data-lg=close]') as HTMLElement).focus();
}
