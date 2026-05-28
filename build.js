const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, 'public');
fs.mkdirSync(outDir, { recursive: true });

const host =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    'CHANGE-MOI.com';

const baseUrl = `https://${host.replace(/^https?:\/\//, '')}`;

let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
html = html.replace(/https:\/\/CHANGE-MOI\.com/g, baseUrl);
fs.writeFileSync(path.join(outDir, 'index.html'), html);

const pfpAliases = ['pfp.jpg', 'photo de profil.jpg', 'photo-de-profil.jpg'];
const pfpSrc = pfpAliases.find((f) => fs.existsSync(path.join(__dirname, f)));
if (pfpSrc) {
    fs.copyFileSync(path.join(__dirname, pfpSrc), path.join(outDir, 'pfp.jpg'));
}

for (const file of ['doxbinred.jpg']) {
    const src = path.join(__dirname, file);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(outDir, file));
    }
}

console.log('Build OK →', baseUrl);
