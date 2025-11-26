const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'drawings.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_BODY_SIZE = 5 * 1024 * 1024; // 5MB

ensureDataFile();

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const { pathname } = parsedUrl;

  if (pathname.startsWith('/api/drawings')) {
    if (req.method === 'GET') {
      return handleGet(req, res, pathname);
    }
    if (req.method === 'POST') {
      return handlePost(req, res);
    }
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  serveStatic(pathname, res);
});

server.listen(PORT, () => {
  console.log(`Our Museum running at http://localhost:${PORT}`);
});

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([]));
  }
}

function readDrawings() {
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to parse drawings file, resetting store.', err);
    fs.writeFileSync(DATA_FILE, JSON.stringify([]));
    return [];
  }
}

function writeDrawings(drawings) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(drawings, null, 2));
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function serveStatic(requestPath, res) {
  const safePath = requestPath.split('?')[0];
  const filePath = path.join(PUBLIC_DIR, safePath === '/' ? '/index.html' : safePath);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Server error');
      }
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.svg': 'image/svg+xml'
    };
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

async function handleGet(req, res, pathname) {
  const drawings = readDrawings();
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 3 && parts[1] === 'drawings') {
    const id = parts[2];
    const found = drawings.find((d) => d.id === id);
    if (!found) {
      return sendJson(res, 404, { error: 'Drawing not found' });
    }
    return sendJson(res, 200, found);
  }
  sendJson(res, 200, drawings);
}

async function handlePost(req, res) {
  try {
    const body = await readBody(req);
    const { title, artist, imageData, notes } = JSON.parse(body);
    if (!imageData || typeof imageData !== 'string') {
      return sendJson(res, 400, { error: 'imageData is required' });
    }
    const now = new Date().toISOString();
    const drawing = {
      id: generateId(),
      title: title?.trim() || 'Untitled',
      artist: artist?.trim() || 'Anonymous',
      notes: notes?.trim() || '',
      imageData,
      createdAt: now
    };
    const drawings = readDrawings();
    drawings.unshift(drawing);
    writeDrawings(drawings.slice(0, 50)); // keep a lightweight archive
    sendJson(res, 201, drawing);
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: 'Could not save drawing' });
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > MAX_BODY_SIZE) {
        reject(new Error('Payload too large'));
        req.connection.destroy();
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

module.exports = server;
