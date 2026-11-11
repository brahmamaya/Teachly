import { icon } from './icons';
import { fadeOut } from './panel';

// Privacy policy and Terms of use, shown inside the app (they work offline).
// Every sentence must stay true to what the code does: if a feature changes
// what is stored or sent, change these texts in the same commit and update
// the date.

const UPDATED = '11 November 2026';

const PRIVACY = `
<h1>Privacy policy</h1>
<p class="lg-date">Teachly by Physica · Last updated ${UPDATED}</p>
<div class="lg-short"><b>In short</b>
  <ul>
    <li>No account, no sign-in, no ads, no tracking, no analytics.</li>
    <li>Your lessons, notebooks and recordings stay on your own device. We never receive them.</li>
    <li>Teachly uses the internet only to load or update its own app files.</li>
  </ul>
</div>

<h2>1. What stays on your device</h2>
<p>Everything you make in Teachly is saved only on the device you are using, in the storage of your browser or of the Teachly Android app:</p>
<ul>
  <li>notebooks, pages, writing, shapes, graphs, text, folders and the Trash;</li>
  <li>PDF files, PowerPoint files and pictures you open in Teachly, and photos you take with <b>Insert &gt; Camera</b> (they are read on your device and are not uploaded);</li>
  <li>a copy of each PDF file you open, and pictures of its pages made when you look at them, kept with the notebook so that big books open fast and <b>Save as PDF</b> can reuse the real pages (small and sharp); they are removed when the notebooks using them are deleted for good;</li>
  <li>your settings (for example pen colours, recent colours, board colour, graph settings, recording quality) and the place where you stopped, so Teachly can open where you left off;</li>
  <li>names you type into the name picker, and team names and scores in the scoreboard.</li>
</ul>
<p>None of this is sent to us or to anyone else.</p>

<h2>2. What we do not collect</h2>
<p>Teachly does not ask for or collect your name, email, phone number, contacts, location, photos from your gallery (only a file you choose yourself is opened), or any information about your students. The camera is used only as described in section 4. Teachly has no advertising, no analytics and no tracking cookies, and we do not sell or share any data, because we do not have any.</p>

<h2>3. When Teachly uses the internet</h2>
<ul>
  <li><b>Website version:</b> your browser downloads Teachly's files from the website host. Like every website host, it receives the technical details needed to send the files (such as your IP address, browser type and time) and may keep them in its own logs under its own privacy policy. Teachly adds nothing to this. After the first visit Teachly also works without internet.</li>
  <li><b>Android app:</b> when the device is online, the app checks the same website for a newer version and downloads Teachly's own updated files. Nothing about you or your lessons is sent; the website host sees the same technical details as above.</li>
  <li><b>Share Teachly:</b> only when you tap it, your device's share menu opens with a link to physica.in.</li>
  <li><b>Links:</b> a web link you open from Teachly opens in your browser.</li>
</ul>

<h2>4. Microphone and camera</h2>
<p>The microphone is used only for <b>Record lesson</b>, only after you start a recording and allow it. The sound goes into the video that is saved on your device. It is not sent anywhere.</p>
<p>The camera is used only when you tap <b>Insert &gt; Camera</b> and allow it. You see the picture live, and only the photo you take and choose to add is put on the page, saved on your device like any other picture. The camera is switched off as soon as the photo is taken, the camera screen is closed or Teachly goes to the background. Nothing is recorded or sent anywhere.</p>
<p>The Android app asks only for these permissions: internet (for updates), microphone (for recording lessons) and camera (for taking a photo for a page). You can refuse the microphone or the camera, or take them back at any time in your device settings; the rest of Teachly keeps working.</p>

<h2>5. Files you save</h2>
<p>PDFs, videos and pictures you save from Teachly are saved on your device (on Android in Downloads / Teachly; on iPad through the share menu, for example Save to Files). What happens to them after that is up to you.</p>

<h2>6. Keeping and deleting your data</h2>
<ul>
  <li>Deleted notebooks go to the Trash; <b>Empty trash</b> removes them for good.</li>
  <li>Uninstalling the Android app, or clearing this website's data in your browser, deletes everything Teachly saved on that device. The Android app keeps its data out of Android's cloud backup, so there is no copy elsewhere.</li>
  <li>Safari on iPad and iPhone may remove the data of websites that have not been used for some time. Adding Teachly to the Home Screen avoids this. Save important lessons as PDF as well.</li>
  <li>Because we never receive your data, we cannot recover it for you.</li>
</ul>

<h2>7. Security</h2>
<p>Your lessons are protected by your device's own security, such as its screen lock. Anyone who can use your device can open Teachly and see your notebooks.</p>

<h2>8. Children</h2>
<p>Teachly is made for teachers. It collects no personal data from anyone, including students. Student names typed into the name picker or scoreboard stay only on that device.</p>

<h2>9. Changes to this policy</h2>
<p>If this policy changes, the new version will be shown here with a new date.</p>

<h2>10. Contact</h2>
<p>Questions about privacy: <b>easy@physica.in</b></p>
`;

const TERMS = `
<h1>Terms of use</h1>
<p class="lg-date">Teachly by Physica · Last updated ${UPDATED}</p>
<div class="lg-short"><b>In short</b>
  <ul>
    <li>Teachly is free to use for teaching and learning.</li>
    <li>What you make is yours, and it stays on your device, so keep your own copies.</li>
    <li>Use it fairly and lawfully.</li>
  </ul>
</div>

<h2>1. Using Teachly</h2>
<p>Teachly is an interactive whiteboard made by Physica. Teachers, students and schools may use it free of charge to teach and learn. Using Teachly means you accept these terms.</p>

<h2>2. Your content</h2>
<ul>
  <li>Your notebooks, writing and recordings belong to you.</li>
  <li>You are responsible for what you put into Teachly. Only open, show or record PDFs, slides, pictures and other material you are allowed to use.</li>
  <li>Do not use Teachly for anything unlawful, harmful or abusive.</li>
  <li>Before recording a lesson, make sure the people who can be heard are fine with being recorded, where this is required.</li>
</ul>

<h2>3. Your data is kept by you</h2>
<p>Teachly saves everything only on your device (see the Privacy policy). We do not keep a copy, so we cannot restore lost or deleted notebooks. Please keep your own copies of important lessons, for example as PDF.</p>

<h2>4. Updates</h2>
<p>Teachly updates itself when your device is online. Features may be added, changed or removed over time.</p>

<h2>5. Teachly's name and design</h2>
<p>The Teachly and Physica names, logos and design belong to Physica. Please do not sell Teachly or present it as your own.</p>

<h2>6. No guarantee</h2>
<p>Teachly is provided "as is". We work to make it reliable, but we cannot promise that it will always work without errors on every device. As far as the law allows, Physica is not responsible for any loss, including lost lessons or data, that comes from using Teachly.</p>

<h2>7. Changes to these terms</h2>
<p>If these terms change, the new version will be shown here with a new date.</p>

<h2>8. Contact</h2>
<p>Questions: <b>easy@physica.in</b></p>
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
