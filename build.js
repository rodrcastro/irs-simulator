// Inline irs.js into a single self-contained HTML file (dist/index.html)
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, 'irs.js'), 'utf8');
const out = html.replace('<script src="irs.js"></script>', () => `<script>\n${js}\n</script>`);
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist', 'index.html'), out);
console.log('dist/index.html', out.length, 'bytes');
