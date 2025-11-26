const canvas = document.getElementById('draw-canvas');
const ctx = canvas.getContext('2d');
const colorPicker = document.getElementById('color-picker');
const sizeRange = document.getElementById('size-range');
const sizeValue = document.getElementById('size-value');
const opacityRange = document.getElementById('opacity-range');
const opacityValue = document.getElementById('opacity-value');
const modeButtons = document.getElementById('mode-buttons');
const shapeSelect = document.getElementById('shape-select');
const fillToggle = document.getElementById('fill-toggle');
const gridToggle = document.getElementById('grid-toggle');
const quickPalette = document.getElementById('quick-palette');
const undoBtn = document.getElementById('btn-undo');
const redoBtn = document.getElementById('btn-redo');
const clearBtn = document.getElementById('btn-clear');
const newCanvasBtn = document.getElementById('btn-new-canvas');
const downloadBtn = document.getElementById('btn-download');
const refreshBtn = document.getElementById('btn-refresh');
const saveForm = document.getElementById('save-form');
const galleryGrid = document.getElementById('gallery-grid');
const cardTemplate = document.getElementById('gallery-card-template');

let drawing = false;
let activeMode = 'pen';
let lastX = 0;
let lastY = 0;
let startShapeSnapshot = null;
let startPoint = null;
let history = [];
let redoStack = [];
const paletteColors = ['#0ea5e9', '#f97316', '#22c55e', '#f43f5e', '#8b5cf6', '#fcd34d', '#14b8a6', '#000000', '#ffffff'];

function init() {
  setupCanvas();
  attachEvents();
  buildPalette();
  updateUIFromControls();
  pushHistory();
  fetchGallery();
}

function setupCanvas() {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function attachEvents() {
  canvas.addEventListener('mousedown', startDraw);
  canvas.addEventListener('mousemove', draw);
  window.addEventListener('mouseup', endDraw);
  canvas.addEventListener('mouseleave', endDraw);

  canvas.addEventListener('touchstart', (e) => startDraw(e.touches[0]));
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    draw(e.touches[0]);
  }, { passive: false });
  window.addEventListener('touchend', endDraw);

  colorPicker.addEventListener('input', () => {
    ctx.strokeStyle = applyOpacity(colorPicker.value);
  });
  sizeRange.addEventListener('input', () => {
    sizeValue.textContent = `${sizeRange.value}px`;
    ctx.lineWidth = sizeRange.value;
  });
  opacityRange.addEventListener('input', () => {
    opacityValue.textContent = `${Math.round(opacityRange.value * 100)}%`;
    ctx.strokeStyle = applyOpacity(colorPicker.value);
  });

  modeButtons.addEventListener('click', (e) => {
    if (e.target.tagName !== 'BUTTON') return;
    [...modeButtons.children].forEach((btn) => btn.classList.remove('active'));
    e.target.classList.add('active');
    activeMode = e.target.dataset.mode;
    setMode(activeMode);
  });

  gridToggle.addEventListener('click', (e) => {
    if (e.target.tagName !== 'BUTTON') return;
    [...gridToggle.children].forEach((btn) => btn.classList.remove('active'));
    e.target.classList.add('active');
    const wrapper = document.querySelector('.canvas-wrapper');
    wrapper.classList.toggle('grid', e.target.dataset.grid === 'on');
  });

  undoBtn.addEventListener('click', undo);
  redoBtn.addEventListener('click', redo);
  clearBtn.addEventListener('click', clearCanvas);
  newCanvasBtn.addEventListener('click', resetCanvas);
  downloadBtn.addEventListener('click', downloadImage);
  refreshBtn.addEventListener('click', fetchGallery);

  saveForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = new FormData(saveForm);
    const payload = {
      title: data.get('title'),
      artist: data.get('artist'),
      notes: data.get('notes'),
      imageData: canvas.toDataURL('image/png')
    };

    const res = await fetch('/api/drawings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      saveForm.reset();
      fetchGallery();
    } else {
      alert('Could not save drawing.');
    }
  });
}

function buildPalette() {
  quickPalette.innerHTML = '';
  paletteColors.forEach((color) => {
    const btn = document.createElement('button');
    btn.style.background = color;
    btn.title = color;
    btn.addEventListener('click', () => {
      colorPicker.value = color;
      ctx.strokeStyle = applyOpacity(color);
    });
    quickPalette.appendChild(btn);
  });
}

function setMode(mode) {
  if (mode === 'eraser') {
    ctx.strokeStyle = '#ffffff';
    ctx.globalAlpha = 1;
  } else if (mode === 'highlighter') {
    ctx.strokeStyle = applyOpacity(colorPicker.value, 0.35);
  } else {
    ctx.strokeStyle = applyOpacity(colorPicker.value);
    ctx.globalAlpha = 1;
  }
}

function applyOpacity(hex, forcedAlpha) {
  const alpha = forcedAlpha ?? Number(opacityRange.value);
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function hexToRgb(hex) {
  const parsed = hex.replace('#', '');
  const bigint = parseInt(parsed, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255
  };
}

function startDraw(evt) {
  const { x, y } = getPos(evt);
  drawing = true;
  lastX = x;
  lastY = y;
  startPoint = { x, y };
  startShapeSnapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
}

function draw(evt) {
  if (!drawing) return;
  const { x, y } = getPos(evt);
  ctx.lineWidth = Number(sizeRange.value);

  if (shapeSelect.value === 'free') {
    ctx.lineTo(x, y);
    ctx.stroke();
  } else {
    ctx.putImageData(startShapeSnapshot, 0, 0);
    drawShape(shapeSelect.value, startPoint, { x, y });
  }

  lastX = x;
  lastY = y;
}

function drawShape(type, start, end) {
  const width = end.x - start.x;
  const height = end.y - start.y;
  ctx.beginPath();
  if (type === 'line') {
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
  } else if (type === 'rectangle') {
    if (fillToggle.checked) {
      ctx.fillRect(start.x, start.y, width, height);
    } else {
      ctx.strokeRect(start.x, start.y, width, height);
    }
    return;
  } else if (type === 'ellipse') {
    ctx.ellipse(start.x + width / 2, start.y + height / 2, Math.abs(width) / 2, Math.abs(height) / 2, 0, 0, Math.PI * 2);
  }
  if (fillToggle.checked) {
    ctx.fill();
  }
  ctx.stroke();
}

function endDraw() {
  if (!drawing) return;
  drawing = false;
  ctx.closePath();
  pushHistory();
}

function getPos(evt) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (evt.clientX - rect.left) * (canvas.width / rect.width),
    y: (evt.clientY - rect.top) * (canvas.height / rect.height)
  };
}

function pushHistory() {
  redoStack = [];
  history.push(canvas.toDataURL());
  if (history.length > 30) history.shift();
  updateHistoryButtons();
}

function undo() {
  if (history.length <= 1) return;
  const last = history.pop();
  redoStack.push(last);
  restoreImage(history[history.length - 1]);
  updateHistoryButtons();
}

function redo() {
  if (!redoStack.length) return;
  const image = redoStack.pop();
  history.push(image);
  restoreImage(image);
  updateHistoryButtons();
}

function restoreImage(dataUrl) {
  const img = new Image();
  img.onload = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  };
  img.src = dataUrl;
}

function clearCanvas() {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = applyOpacity(colorPicker.value);
  pushHistory();
}

function resetCanvas() {
  history = [];
  redoStack = [];
  clearCanvas();
  pushHistory();
}

function downloadImage() {
  const link = document.createElement('a');
  link.download = 'our-museum.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

async function fetchGallery() {
  const res = await fetch('/api/drawings');
  if (!res.ok) return;
  const drawings = await res.json();
  renderGallery(drawings);
}

function renderGallery(drawings) {
  galleryGrid.innerHTML = '';
  if (!drawings.length) {
    const empty = document.createElement('p');
    empty.className = 'subtle';
    empty.textContent = 'No drawings yet — be the first to hang something on the wall!';
    galleryGrid.appendChild(empty);
    return;
  }

  drawings.forEach((item) => {
    const card = cardTemplate.content.cloneNode(true);
    const img = card.querySelector('.thumb');
    img.src = item.imageData;
    img.alt = item.title;
    card.querySelector('.card-title').textContent = item.title;
    const date = new Date(item.createdAt).toLocaleString();
    const noteHint = item.notes ? ` · ${item.notes}` : '';
    card.querySelector('.card-meta').textContent = `${item.artist} · ${date}${noteHint}`;

    card.querySelector('.load').addEventListener('click', () => loadDrawing(item));
    card.querySelector('.download').addEventListener('click', () => downloadExternal(item));

    galleryGrid.appendChild(card);
  });
}

function loadDrawing(item) {
  const img = new Image();
  img.onload = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    pushHistory();
  };
  img.src = item.imageData;
}

function downloadExternal(item) {
  const link = document.createElement('a');
  link.download = `${item.title || 'drawing'}.png`;
  link.href = item.imageData;
  link.click();
}

function updateHistoryButtons() {
  undoBtn.disabled = history.length <= 1;
  redoBtn.disabled = redoStack.length === 0;
}

function updateUIFromControls() {
  sizeValue.textContent = `${sizeRange.value}px`;
  opacityValue.textContent = `${Math.round(opacityRange.value * 100)}%`;
  ctx.lineWidth = Number(sizeRange.value);
  ctx.strokeStyle = applyOpacity(colorPicker.value);
}

init();
