import type { Board } from '../board';
import { download } from '../io/files';
import { icon } from '../ui/icons';
import { toast } from '../ui/panel';

// Lesson recording: the board (everything written, live) plus the teacher's
// voice, saved as a video file. Runs only while recording, so it costs
// nothing the rest of the time.

interface Rec {
  rec: MediaRecorder;
  chunks: Blob[];
  mic: MediaStream | null;
  timer: number;
  raf: number;
  pill: HTMLElement;
  start: number;
  type: string;
}

let cur: Rec | null = null;
let hostEl: HTMLElement | null = null;

function pickType(): string {
  const types = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return types.find((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(t)) ?? '';
}

export async function toggleRecording(board: Board, host: HTMLElement): Promise<void> {
  if (cur) return stop();
  hostEl = host;
  if (typeof MediaRecorder === 'undefined' || !HTMLCanvasElement.prototype.captureStream) {
    toast('Recording is not available in this browser', 4000);
    return;
  }
  // One canvas that combines the board layers (max Full HD keeps it light).
  const out = document.createElement('canvas');
  const k = Math.min(1, 1920 / board.ink.width, 1080 / board.ink.height);
  out.width = Math.round((board.ink.width * k) / 2) * 2;
  out.height = Math.round((board.ink.height * k) / 2) * 2;
  const ctx = out.getContext('2d', { alpha: false })!;
  const paint = () => {
    ctx.drawImage(board.bg, 0, 0, out.width, out.height);
    ctx.drawImage(board.ink, 0, 0, out.width, out.height);
    ctx.drawImage(board.overlay, 0, 0, out.width, out.height);
  };
  paint();

  let mic: MediaStream | null = null;
  try {
    mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  } catch {
    toast('Microphone not allowed — recording without sound', 3500);
  }
  const stream = out.captureStream(30);
  mic?.getAudioTracks().forEach((t) => stream.addTrack(t));
  const type = pickType();
  let rec: MediaRecorder;
  try {
    rec = new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), videoBitsPerSecond: 4_000_000 });
  } catch {
    mic?.getTracks().forEach((t) => t.stop());
    toast('Recording is not available on this device', 4000);
    return;
  }
  const pill = document.createElement('div');
  pill.className = 'rec-pill';
  pill.innerHTML = `<i class="rec-dot"></i><b data-t>0:00</b><button class="icon-btn" title="Stop recording" aria-label="Stop recording">${icon('pause', 18)} Stop</button>`;
  pill.querySelector('button')!.addEventListener('click', () => stop());
  host.appendChild(pill);

  const r: Rec = { rec, chunks: [], mic, timer: 0, raf: 0, pill, start: Date.now(), type: rec.mimeType || type || 'video/webm' };
  rec.ondataavailable = (e) => e.data.size && r.chunks.push(e.data);
  rec.onstop = () => save(r);
  rec.start(1000);
  // Copy the board ~30 times a second.
  let last = 0;
  const loop = (t: number) => {
    if (t - last > 30) {
      paint();
      last = t;
    }
    r.raf = requestAnimationFrame(loop);
  };
  r.raf = requestAnimationFrame(loop);
  r.timer = window.setInterval(() => {
    const s = Math.floor((Date.now() - r.start) / 1000);
    (pill.querySelector('[data-t]') as HTMLElement).textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }, 500);
  cur = r;
  toast('Recording the lesson…');
}

function stop(): void {
  const r = cur;
  if (!r) return;
  cur = null;
  cancelAnimationFrame(r.raf);
  clearInterval(r.timer);
  r.pill.remove();
  if (r.rec.state !== 'inactive') r.rec.stop();
  r.mic?.getTracks().forEach((t) => t.stop());
}

async function save(r: Rec): Promise<void> {
  const ext = r.type.includes('mp4') ? 'mp4' : 'webm';
  const blob = new Blob(r.chunks, { type: r.type.split(';')[0] });
  const d = new Date();
  const name = `Teachly lesson ${d.toISOString().slice(0, 10)} ${d.getHours()}-${String(d.getMinutes()).padStart(2, '0')}.${ext}`;
  const file = new File([blob], name, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  const mobile = /iPad|iPhone|Android|Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
  if (!mobile || !nav.canShare?.({ files: [file] })) {
    download(blob, name);
    toast('Lesson video saved to Downloads', 3500);
    return;
  }
  // iPad / phones: sharing needs a fresh tap, so offer a Save button.
  const pill = document.createElement('div');
  pill.className = 'rec-pill ready';
  pill.innerHTML = `<b>Video ready</b><button class="icon-btn">${icon('download', 18)} Save</button><button class="icon-btn" aria-label="Close">${icon('close', 18)}</button>`;
  const [saveBtn, closeBtn] = pill.querySelectorAll('button');
  saveBtn.addEventListener('click', () => {
    navigator.share({ files: [file], title: name }).catch(() => download(blob, name));
    pill.remove();
  });
  closeBtn.addEventListener('click', () => pill.remove());
  hostEl?.appendChild(pill);
}
