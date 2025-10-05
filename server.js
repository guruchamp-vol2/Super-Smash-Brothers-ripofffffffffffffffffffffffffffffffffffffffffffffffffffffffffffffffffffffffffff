const express = require('express');
const compression = require('compression');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// gzip/brotli where supported
app.use(compression());

// serve everything in the repo root (adjust if your app is in a subfolder)
const PUB_DIR = path.join(__dirname);
app.use(express.static(PUB_DIR, {
  etag: true,
  lastModified: true,
  maxAge: '1d',
  setHeaders(res, filePath) {
    if (/\.(html)$/.test(filePath)) {
      // don’t aggressively cache HTML
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// fallback to index.html (if you ever route client-side)
app.get('*', (_req, res) => {
  res.sendFile(path.join(PUB_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`SuperStrikeUltamate running on :${PORT}`);
});
