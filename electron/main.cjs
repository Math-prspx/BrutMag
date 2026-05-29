const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const http = require('http');
const path = require('path');

let server;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.map': 'application/json; charset=utf-8',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function resolveDistPath() {
  const appPath = app.getAppPath();
  const distPath = path.join(appPath, 'dist');

  if (!fs.existsSync(distPath)) {
    throw new Error(`Missing web build at ${distPath}. Run \"npm run build:web\" first.`);
  }

  return distPath;
}

function safeJoin(rootDir, requestPath) {
  const normalized = path.normalize(requestPath).replace(/^([.][.][/\\])+/, '');
  const absolute = path.join(rootDir, normalized);

  if (!absolute.startsWith(rootDir)) {
    return null;
  }

  return absolute;
}

function createStaticServer(rootDir) {
  return http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const relativePath = urlPath === '/' ? '/index.html' : urlPath;

    const absolutePath = safeJoin(rootDir, relativePath);
    if (!absolutePath) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    const isFile = fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile();
    const filePath = isFile ? absolutePath : path.join(rootDir, 'index.html');

    fs.readFile(filePath, (error, data) => {
      if (error) {
        res.writeHead(500);
        res.end('Internal Server Error');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
      res.writeHead(200);
      res.end(data);
    });
  });
}

function createWindow(baseUrl) {
  const win = new BrowserWindow({
    width: 1380,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.loadURL(baseUrl);
}

async function start() {
  try {
    const distPath = resolveDistPath();
    server = createStaticServer(distPath);

    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });

    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    createWindow(`http://127.0.0.1:${port}`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    app.quit();
  }
}

app.whenReady().then(start);

app.on('window-all-closed', () => {
  if (server) {
    server.close();
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0 && server) {
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    createWindow(`http://127.0.0.1:${port}`);
  }
});
