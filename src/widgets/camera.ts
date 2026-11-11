import { icon } from '../ui/icons';
import { fadeOut } from '../ui/panel';

// Take a photo and put it on the page (Insert > Camera).
// Privacy: the camera is asked for only when the teacher taps Camera, and
// the device (or browser) shows its own permission question. The picture
// stays on the device like any other picture on a page. The camera is
// switched off the moment the photo is taken or the panel is closed;
// nothing is recorded, stored elsewhere or sent anywhere.

let open = false;

/** Why the camera could not start, in plain words. */
function cameraError(e: unknown): string {
  const name = (e as DOMException)?.name ?? '';
  const app = location.hostname === 'appassets.androidplatform.net';
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return app
      ? 'Camera permission was not given. Tap Camera again to allow it, or allow it in Android Settings > Apps > Teachly > Permissions. If Teachly never asks, download the newest app from physica.in.'
      : 'Camera permission was not given. Allow the camera for this site in the browser settings, then tap Camera again.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No camera was found on this device.';
  if (name === 'NotReadableError') return 'The camera is busy in another app. Close that app and try again.';
  return 'The camera could not be opened on this device.';
}

/**
 * Open the camera panel. `onPhoto` gets the photo (JPEG data URL) when the
 * teacher taps "Add to page".
 */
export function openCamera(host: HTMLElement, onPhoto: (dataUrl: string) => void): void {
  if (open) return;
  open = true;
  let stream: MediaStream | null = null;
  let facing: 'environment' | 'user' = 'environment';
  let photo = '';

  const box = document.createElement('section');
  box.className = 'campanel';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-label', 'Take a photo');
  // Fixed markup only (no user text).
  box.innerHTML = `
    <div class="cam-view">
      <video class="cam-video" autoplay playsinline muted></video>
      <img class="cam-shot" alt="Photo taken" hidden>
      <div class="cam-msg" data-msg>Starting camera…</div>
    </div>
    <div class="cam-bar">
      <button class="cam-btn" data-c="close" aria-label="Close">${icon('close', 22)}<span>Close</span></button>
      <button class="cam-snap" data-c="snap" aria-label="Take photo" disabled></button>
      <button class="cam-btn" data-c="flip" aria-label="Switch camera" hidden>${icon('redo', 22)}<span>Switch</span></button>
      <button class="cam-btn" data-c="retake" aria-label="Take again" hidden>${icon('undo', 22)}<span>Again</span></button>
      <button class="cam-use" data-c="use" hidden>${icon('check', 20)} Add to page</button>
    </div>`;
  host.appendChild(box);
  const video = box.querySelector('video') as HTMLVideoElement;
  const shot = box.querySelector('.cam-shot') as HTMLImageElement;
  const msg = box.querySelector('[data-msg]') as HTMLElement;
  const btn = (c: string) => box.querySelector(`[data-c=${c}]`) as HTMLButtonElement;

  const stop = () => {
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    video.srcObject = null;
  };
  const mode = (taken: boolean) => {
    video.hidden = taken;
    shot.hidden = !taken;
    btn('snap').hidden = taken;
    btn('retake').hidden = !taken;
    btn('use').hidden = !taken;
    btn('flip').hidden = taken || !btn('flip').dataset.many;
  };
  const start = async () => {
    stop();
    mode(false);
    msg.hidden = false;
    msg.textContent = 'Starting camera…';
    btn('snap').disabled = true;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new DOMException('', 'NotFoundError');
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facing }, width: { ideal: 2560 }, height: { ideal: 1440 } },
        audio: false,
      });
      if (!open) return stop(); // closed while the permission question was showing
      video.srcObject = stream;
      await video.play().catch(() => {});
      msg.hidden = true;
      btn('snap').disabled = false;
      // Offer "Switch" only when there is more than one camera.
      const cams = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
      if (cams.length > 1) btn('flip').dataset.many = '1';
      btn('flip').hidden = cams.length < 2;
    } catch (e) {
      stop();
      msg.hidden = false;
      msg.textContent = cameraError(e);
    }
  };
  // The app goes to the background: switch the camera off at once.
  const onHide = () => {
    if (document.visibilityState === 'hidden' && stream) {
      stop();
      msg.hidden = false;
      msg.textContent = 'Camera paused. Tap Again to start it.';
      btn('snap').hidden = true;
      btn('retake').hidden = false;
    }
  };
  document.addEventListener('visibilitychange', onHide);
  const close = () => {
    open = false;
    stop();
    document.removeEventListener('visibilitychange', onHide);
    fadeOut(box, 180);
  };

  box.addEventListener('click', (e) => {
    const c = ((e.target as HTMLElement).closest('[data-c]') as HTMLElement | null)?.dataset.c;
    if (c === 'close') return close();
    if (c === 'flip') {
      facing = facing === 'environment' ? 'user' : 'environment';
      return void start();
    }
    if (c === 'snap' && stream && video.videoWidth) {
      const cv = document.createElement('canvas');
      cv.width = video.videoWidth;
      cv.height = video.videoHeight;
      cv.getContext('2d')!.drawImage(video, 0, 0);
      photo = cv.toDataURL('image/jpeg', 0.92);
      cv.width = cv.height = 1;
      stop(); // camera off as soon as the photo is taken
      shot.src = photo;
      return mode(true);
    }
    if (c === 'retake') {
      photo = '';
      shot.removeAttribute('src');
      return void start();
    }
    if (c === 'use' && photo) {
      onPhoto(photo);
      close();
    }
  });
  box.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') close();
  });
  void start();
}
