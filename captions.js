// init captions
export function initCaptions(container) {
  if (!container) throw new Error('Captions container element is required');

  const statusEl = document.createElement('div');
  statusEl.className = 'status';
  container.appendChild(statusEl);

  const listEl = document.createElement('div');
  listEl.className = 'list';
  container.appendChild(listEl);

  const entries = []; // rolling buffer

  // render window
  function render() {
    const now = Date.now();
    const cutoff = now - 20000;
    while (entries.length > 0 && entries[0].ts < cutoff) entries.shift();
    listEl.innerHTML = '';
    entries.forEach((entry) => {
      const line = document.createElement('div');
      line.className = 'line';
      line.textContent = entry.text;
      listEl.appendChild(line);
    });
    listEl.scrollTop = listEl.scrollHeight;
  }

  // set status
  function setStatus(text) {
    statusEl.textContent = text;
  }

  // add line
  function appendLine(text) {
    entries.push({ text, ts: Date.now() });
    render();
  }

  // clear all
  function clearAll() {
    entries.length = 0;
    render();
  }

  // set size
  function setTextSize(size) {
    container.style.setProperty('--caption-size', `${size}px`);
  }

  // get text
  function getText() {
    return entries.map((e) => e.text).join('\n');
  }

  return { appendLine, clearAll, setStatus, setTextSize, getText };
}
