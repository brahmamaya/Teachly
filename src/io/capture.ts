import type { Board } from '../board';
import { download, insertImageSrc } from './files';
import { store } from '../store';

// Screen recording, screen snapshots and document-camera capture.

let recorder: MediaRecorder | null = null;
let streams: MediaStream[] = [];
let startedAt = 0;

export function isRecording(): boolean {
  return !!recorder && recorder.state !== 'inactive';
}

export function recordingElapsed(): number {
  return isRecording() ? Date.now() - startedAt : 0;
}

export async function startRecording(withMic: boolean, onStop: () => void): Promise<void> {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    alert('Screen recording is not supported in this browser.');
    return;
  }
  const display = await navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: 30 },
    audio: true,
    // Prefer recording this tab on Chromium.
    ...({ preferCurrentTab: true, selfBrowserSurface: 'include' } as object),
  } as DisplayMediaStreamOptions);
  streams = [display];
  const tracks = [...display.getVideoTracks()];
  const audioSources: MediaStream[] = [];
  if (display.getAudioTracks().length) audioSources.push(display);
  if (withMic) {
    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streams.push(mic);
      audioSources.push(mic);
    } catch {
      /* mic denied — record without it */
    }
  }
  if (audioSources.length === 1) tracks.push(...audioSources[0].getAudioTracks());
  else if (audioSources.length > 1) {
    const ac = new AudioContext();
    const dest = ac.createMediaStreamDestination();
    for (const s of audioSources) ac.createMediaStreamSource(s).connect(dest);
    tracks.push(...dest.stream.getAudioTracks());
  }
  const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
  const chunks: Blob[] = [];
  recorder = new MediaRecorder(new MediaStream(tracks), mime ? { mimeType: mime, videoBitsPerSecond: 5_000_000 } : undefined);
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  recorder.onstop = () => {
    for (const s of streams) s.getTracks().forEach((t) => t.stop());
    streams = [];
    const type = recorder?.mimeType || 'video/webm';
    const ext = type.includes('mp4') ? 'mp4' : 'webm';
    download(new Blob(chunks, { type }), `teachly-recording-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${ext}`);
    recorder = null;
    onStop();
  };
  display.getVideoTracks()[0].addEventListener('ended', () => stopRecording());
  recorder.start(1000);
  startedAt = Date.now();
}

export function stopRecording(): void {
  if (recorder && recorder.state !== 'inactive') recorder.stop();
}

async function grabFrame(stream: MediaStream): Promise<string> {
  const video = document.createElement('video');
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await video.play();
  await new Promise((r) => setTimeout(r, 350));
  const c = document.createElement('canvas');
  c.width = video.videoWidth;
  c.height = video.videoHeight;
  c.getContext('2d')!.drawImage(video, 0, 0);
  stream.getTracks().forEach((t) => t.stop());
  return c.toDataURL('image/jpeg', 0.92);
}

/** Capture a screen / window / tab and drop it on the board to annotate. */
export async function snapshotScreen(board: Board): Promise<void> {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    alert('Screen capture is not supported in this browser.');
    return;
  }
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  const src = await grabFrame(stream);
  const el = await insertImageSrc(board, src);
  store.setTool({ tool: 'select' });
  store.select([el.id]);
}

/** Show a live camera preview (document camera / webcam) with a capture button. */
export async function cameraCapture(board: Board, host: HTMLElement): Promise<void> {
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: 'environment' } });
  } catch {
    alert('Camera is not available or permission was denied.');
    return;
  }
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `<div class="modal camera-modal"><video playsinline muted autoplay></video>
    <div class="modal-actions"><button class="btn" data-a="cancel">Cancel</button><button class="btn primary" data-a="snap">📸 Capture to board</button></div></div>`;
  host.appendChild(wrap);
  const video = wrap.querySelector('video')!;
  video.srcObject = stream;
  const close = () => {
    stream.getTracks().forEach((t) => t.stop());
    wrap.remove();
  };
  wrap.addEventListener('click', async (e) => {
    const a = (e.target as HTMLElement).closest('button')?.dataset.a;
    if (a === 'cancel' || e.target === wrap) close();
    if (a === 'snap') {
      const c = document.createElement('canvas');
      c.width = video.videoWidth;
      c.height = video.videoHeight;
      c.getContext('2d')!.drawImage(video, 0, 0);
      close();
      const el = await insertImageSrc(board, c.toDataURL('image/jpeg', 0.92));
      store.setTool({ tool: 'select' });
      store.select([el.id]);
    }
  });
}
