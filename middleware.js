export default function middleware(request) {
    const ua = request.headers.get('user-agent') || '';
    const { pathname } = new URL(request.url);

    if (pathname !== '/') return;

    const isPreviewBot = /discordbot|facebookexternalhit|twitterbot|whatsapp|telegrambot/i.test(ua);
    if (isPreviewBot) {
        return Response.redirect(new URL('/pfp.jpg', request.url), 302);
    }
}

export const config = {
    matcher: '/'
};
