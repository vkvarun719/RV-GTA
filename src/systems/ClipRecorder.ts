export class ClipRecorder {
  private canvas: HTMLCanvasElement;
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private previousClipBlob: Blob | null = null;
  private segmentStartMs = 0;
  private mimeType = 'video/webm';
  private pendingDownload = false;
  public isRecording = false;
  public onStatus?: (msg: string) => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.startRolling();
  }

  private pickMimeType(): string {
    const candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    for (const m of candidates) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) {
        return m;
      }
    }
    return 'video/webm';
  }

  private startRolling(): void {
    if (typeof this.canvas.captureStream !== 'function' || typeof MediaRecorder === 'undefined') {
      return;
    }
    try {
      this.stream = this.canvas.captureStream(30);
      this.mimeType = this.pickMimeType();
      this.startSegment();
      this.isRecording = true;
    } catch {
      this.isRecording = false;
    }
  }

  private startSegment(): void {
    if (!this.stream) return;
    this.chunks = [];
    this.segmentStartMs = performance.now();

    const rec = new MediaRecorder(this.stream, { mimeType: this.mimeType, videoBitsPerSecond: 3_500_000 });
    rec.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) {
        this.chunks.push(ev.data);
      }
      // Roll over cleanly every 15s so the active segment stays bounded while preserving valid WebM headers
      if (!this.pendingDownload && performance.now() - this.segmentStartMs >= 15200 && rec.state === 'recording') {
        rec.stop();
      }
    };

    rec.onstop = () => {
      const completed = new Blob(this.chunks, { type: this.mimeType });
      if (this.pendingDownload) {
        this.pendingDownload = false;
        this.downloadBlob(completed);
      } else if (completed.size > 0) {
        this.previousClipBlob = completed;
      }
      this.startSegment();
    };

    rec.start(1000);
    this.recorder = rec;
  }

  saveLast15Seconds(): void {
    if (!this.recorder || !this.isRecording) {
      this.onStatus?.('Clip recorder unsupported in this browser');
      return;
    }

    const elapsed = performance.now() - this.segmentStartMs;
    if (elapsed < 2200 && this.previousClipBlob) {
      this.downloadBlob(this.previousClipBlob);
      return;
    }

    if (this.recorder.state === 'recording') {
      this.pendingDownload = true;
      this.recorder.stop();
    } else if (this.previousClipBlob) {
      this.downloadBlob(this.previousClipBlob);
    }
  }

  private downloadBlob(blob: Blob): void {
    if (blob.size === 0) {
      this.onStatus?.('Clip buffer empty — try again in 2s');
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `namma-rvitm-clip-${Date.now()}.webm`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    this.onStatus?.('Saved gameplay clip (.webm)!');
  }
}
