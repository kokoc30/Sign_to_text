import { openCamera, stopStream } from './camera.js';
import { initCaptions } from './captions.js';
import { createTextSource } from './textSource.js';

document.addEventListener('DOMContentLoaded', () => {
  const videoEl    = document.getElementById('video');
  const captionsEl = document.getElementById('captions');

  const startBtn  = document.getElementById('start');
  const pauseBtn  = document.getElementById('pause');
  const resumeBtn = document.getElementById('resume');
  const stopBtn   = document.getElementById('stop');
  const clearBtn  = document.getElementById('clear');
  const saveBtn   = document.getElementById('save');

  const sizeSlider = document.getElementById('captionSize');
  const sizeLabel  = document.getElementById('captionSizeLabel');

  const modal      = document.getElementById('consent-modal');
  const acceptBtn  = document.getElementById('consent-accept');
  const declineBtn = document.getElementById('consent-decline');

  const captions = initCaptions(captionsEl);

  let state = 'idle';
  let currentStream = null;
  let textSource = null;
  let dirty = false;

  // feedback beep
  function playFeedback() {
    try {
      navigator.vibrate?.(150);
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {}
  }

  // toggle controls
  function updateControls() {
    startBtn.disabled  = state === 'processing';
    pauseBtn.disabled  = state !== 'processing';
    resumeBtn.disabled = state !== 'paused';
    stopBtn.disabled   = state === 'idle';
    clearBtn.disabled  = state === 'idle';
  }

  // set state
  function setState(newState) {
    state = newState;
    let text;
    if (state === 'idle') text = '● Ready';
    else if (state === 'processing') text = '▲ Processing';
    else text = '■ Paused';
    captions.setStatus(text);
    updateControls();
  }

  // start capture
  async function startCaptioning() {
    const consentGiven = localStorage.getItem('consentAccepted') === 'true';
    if (!consentGiven) {
      modal.style.display = 'flex';
      return;
    }
    if (state !== 'idle') return;
    try {
      captions.clearAll();
      dirty = false;
      currentStream = await openCamera(videoEl);
      textSource = createTextSource({
        onLine: (line) => {
          captions.appendLine(line);
          dirty = true;
        },
      });
      textSource.start();
      setState('processing');
      playFeedback();
    } catch (err) {
      console.error(err);
      alert('Unable to start camera or captions: ' + err.message);
      stopCaptioning();
    }
  }

  // pause
  function pauseCaptioning() {
    if (state !== 'processing') return;
    textSource.pause();
    captions.appendLine('—Paused—');
    dirty = true;
    setState('paused');
  }

  // resume
  function resumeCaptioning() {
    if (state !== 'paused') return;
    textSource.resume();
    setState('processing');
  }

  // save .txt
  function saveTranscript() {
    const text = captions.getText();
    if (!text.trim()) {
      alert('Nothing to save yet.');
      return;
    }
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const file = `asl_transcript_${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}.txt`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = file;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
    dirty = false;
    playFeedback();
    if (state !== 'idle') {
      captions.setStatus('Saved');
      setTimeout(() => setState(state), 2000);
    }
  }

  // stop + cleanup
  function stopCaptioning() {
    if (state === 'idle') return;
    try { textSource?.stop(); } catch {}
    textSource = null;
    try { currentStream && stopStream(currentStream, videoEl); } catch {}
    currentStream = null;

    const hasLines = captionsEl.querySelector('.list')?.children.length > 0;
    if (hasLines && dirty) {
      const saveIt = confirm('Save transcript before discarding? Click OK to save, Cancel to discard.');
      if (saveIt) {
        saveTranscript();
      } else {
        captions.clearAll();
        dirty = false;
      }
    }
    setState('idle');
    playFeedback();
  }

  // clear lines
  function clearCaptions() {
    const hasLines = captionsEl.querySelector('.list')?.children.length > 0;
    if (!hasLines) return;
    if (confirm('Clear captions?')) {
      captions.clearAll();
      dirty = false;
    }
  }

  // bind events
  startBtn.addEventListener('click', startCaptioning);
  pauseBtn.addEventListener('click', pauseCaptioning);
  resumeBtn.addEventListener('click', resumeCaptioning);
  stopBtn.addEventListener('click', stopCaptioning);
  clearBtn.addEventListener('click', clearCaptions);
  saveBtn.addEventListener('click', saveTranscript);

  // consent modal
  acceptBtn.addEventListener('click', () => {
    localStorage.setItem('consentAccepted', 'true');
    modal.style.display = 'none';
    startCaptioning();
  });
  declineBtn.addEventListener('click', () => {
    localStorage.setItem('consentAccepted', 'false');
    modal.style.display = 'none';
    captions.appendLine('Camera access declined. Cannot start captions.');
  });

  // caption size
  const savedSize = parseInt(localStorage.getItem('captionSize') || '16', 10);
  sizeSlider.value = savedSize;
  sizeLabel.textContent = `${savedSize}pt`;
  captions.setTextSize(savedSize);

  sizeSlider.addEventListener('input', () => {
    const size = parseInt(sizeSlider.value, 10);
    captions.setTextSize(size);
    sizeLabel.textContent = `${size}pt`;
    localStorage.setItem('captionSize', String(size));
    if (size < 12) {
      captions.setStatus('Small text selected. Consider increasing for readability.');
    } else {
      setState(state);
    }
  });

  // hotkeys
  document.addEventListener('keydown', (ev) => {
    const tag = (ev.target instanceof HTMLElement) ? ev.target.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea') return;

    if (ev.code === 'Space' || ev.key === ' ') {
      ev.preventDefault();
      if (state === 'idle' || state === 'paused') startCaptioning();
      else if (state === 'processing') stopCaptioning();
    }
    if (ev.key === 'p' || ev.key === 'P') {
      if (state === 'processing') pauseCaptioning();
      else if (state === 'paused') resumeCaptioning();
    }
    if (ev.key === 'c' || ev.key === 'C') clearCaptions();
  });

  // unsaved warn
  window.addEventListener('beforeunload', (e) => {
    const hasLines = captionsEl.querySelector('.list')?.children.length > 0;
    if (hasLines && (state === 'processing' || state === 'paused')) {
      e.preventDefault();
      e.returnValue = '';
      return '';
    }
  });

  setState('idle');
});

