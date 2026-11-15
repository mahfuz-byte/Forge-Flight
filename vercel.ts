// Frontend project: proxy API requests to the separate Django Vercel project.
// Set API_ORIGIN to that project's stable HTTPS origin in Vercel settings.
const apiOrigin = process.env.API_ORIGIN;
if (!apiOrigin || !/^https:\/\/[^/]+\/?$/.test(apiOrigin)) {
  throw new Error('Set API_ORIGIN to the Django project HTTPS origin before deploying.');
}

export const config = {
  rewrites: [
    { source: '/api/:path*', destination: `${apiOrigin.replace(/\/$/, '')}/api/:path*` },
    { source: '/(.*)', destination: '/index.html' },
  ],
};
