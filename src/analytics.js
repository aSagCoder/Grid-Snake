export function initAnalyticsFromMeta() {
  try {
    const meta = document.querySelector('meta[name="ga-measurement-id"]');
    const id = (meta && meta.getAttribute('content') ? meta.getAttribute('content') : '').trim();
    if (!id) return;

    // Basic validation: GA4 measurement IDs usually look like G-XXXXXXXXXX.
    if (!/^G-[A-Z0-9]+$/i.test(id)) return;

    // Inject gtag.js
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    document.head.appendChild(s);

    window.dataLayer = window.dataLayer || [];
    function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer.push(arguments);
    }
    window.gtag = window.gtag || gtag;

    window.gtag('js', new Date());
    window.gtag('config', id, {
      anonymize_ip: true,
    });
  } catch {
    // No-op
  }
}
