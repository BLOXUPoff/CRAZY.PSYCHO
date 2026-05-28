const fs = require('fs');
const path = require('path');

const IMAGE_PATH = path.join(__dirname, 'pfp-data.jpg');

function getHomeUrl() {
    const host =
        process.env.VERCEL_PROJECT_PRODUCTION_URL ||
        process.env.VERCEL_URL ||
        '';
    if (!host) return '/';
    return `https://${host.replace(/^https?:\/\//, '')}/`;
}

module.exports = async (req, res) => {
    const ua = req.headers['user-agent'] || '';
    const isPreviewBot = /discordbot|facebookexternalhit|twitterbot|whatsapp|telegrambot/i.test(ua);

    if (!isPreviewBot) {
        res.writeHead(302, { Location: getHomeUrl() });
        return res.end();
    }

    try {
        const image = fs.readFileSync(IMAGE_PATH);
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.end(image);
    } catch {
        return res.status(404).json({ error: 'Image introuvable' });
    }
};
