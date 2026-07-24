/* legal.html helpers, external so the strict CSP allows them. */
document.getElementById('today').textContent = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
fetch('/api/state').then(r => r.json()).then(s => {
  if (s.contact) { const a = document.getElementById('contact'); a.href = 'mailto:' + s.contact; a.textContent = s.contact; }
}).catch(() => {});
