# Build And Deploy

## 1) FTP Version (Mutualized Hosting)

This creates a static website that you can upload directly by FTP.

### Commands

```bash
npm install
npm run build:ftp
npm run zip:ftp
```

### Output

- `dist/` : ready-to-upload static files
- `dist.zip` : zip archive of the same files

### FTP Upload

1. Open your FTP client.
2. Connect to your hosting account.
3. Go to your web root folder (often `public_html`, `www`, or `htdocs`).
4. Upload all contents of `dist/` (or upload/unzip `dist.zip` on server).
5. Ensure `index.html` is at web root level.

## 2) Windows Standalone (No Manual Server)

This creates a standalone folder with an executable. User double-clicks it; no terminal, no manual server start.

### Commands

```bash
npm install
npm run standalone:win
```

### Output

- `release/win-unpacked/BrutMag.exe`

### Notes

- The app is still the same web app internally, but wrapped in an executable.
- If you change app code, rebuild with:

```bash
npm run standalone:win
```

## 3) Local Standalone Dev Check

To test the standalone wrapper before packaging:

```bash
npm run standalone:dev
```

This builds the web app and opens it in an Electron window.
