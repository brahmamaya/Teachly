import { icon } from './icons';
import { floatingPanel, toast } from './panel';

// "Install app": Chrome / Edge / Android offer a real install prompt; on iPad
// and iPhone it is done from Safari's Share menu, so we show the steps.

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPrompt | null = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e as InstallPrompt;
});
window.addEventListener('appinstalled', () => {
  deferred = null;
  toast('Teachly is installed — open it from your home screen');
});

/** Already running as an installed app? */
export function isInstalled(): boolean {
  return matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

function isAppleTouch(): boolean {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac, but has touch.
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

export async function installApp(host: HTMLElement): Promise<void> {
  if (isInstalled()) return toast('Teachly is already installed on this device');
  if (deferred) {
    await deferred.prompt();
    deferred = null;
    return;
  }
  const apple = isAppleTouch();
  const body = floatingPanel(host, { id: 'install', title: 'Install Teachly', iconName: 'download', width: 380 }, false);
  if (!body) return;
  body.innerHTML = apple
    ? `<ol class="install-steps">
        <li>Open this page in <b>Safari</b>.</li>
        <li>Tap the <b>Share</b> button <span class="install-ico">${shareIcon}</span> at the top of the screen.</li>
        <li>Choose <b>Add to Home Screen</b> <span class="install-ico">${icon('plus', 18)}</span>, then tap <b>Add</b>.</li>
        <li>Open <b>Teachly</b> from the home screen — it runs full screen and works without internet.</li>
      </ol>`
    : `<ol class="install-steps">
        <li>Open this page in <b>Chrome</b> or <b>Edge</b>.</li>
        <li>Open the browser menu (⋮) and choose <b>Install app</b> or <b>Add to Home screen</b>.</li>
        <li>Open <b>Teachly</b> from the desktop or home screen — it works without internet.</li>
      </ol>`;
}

const shareIcon =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';

export const DOWNLOAD_URL = 'https://brahmamaya.github.io/Teachly/download.html';

/** Share the download page: native share sheet when available, else copy. */
export async function shareApp(): Promise<void> {
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Teachly by Physica', text: 'Free interactive whiteboard for teachers — install it on your device:', url: DOWNLOAD_URL });
      return;
    } catch {
      /* cancelled — fall back to copying */
    }
  }
  try {
    await navigator.clipboard.writeText(DOWNLOAD_URL);
    toast('Download link copied — paste it in WhatsApp or email');
  } catch {
    toast(DOWNLOAD_URL, 6000);
  }
}
