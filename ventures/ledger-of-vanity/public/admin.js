/* Keeper's Desk — admin console. External file so the strict CSP (script-src 'self')
   allows it to run. The admin token lives only in sessionStorage on this device. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const fmt = c => '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: c % 100 ? 2 : 0 });
  const esc = s => { const d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; };
  let token = sessionStorage.getItem('lov-admin') || '';

  async function api(path, body) {
    const opt = body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ token }, body)) } : {};
    const url = path + (body ? '' : (path.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token));
    const r = await fetch(url, opt);
    return { ok: r.ok, status: r.status, j: await r.json().catch(() => ({})) };
  }

  async function loadPending() {
    const r = await api('/api/admin/pending');
    if (!r.ok) { $('err').textContent = r.status === 403 ? 'Invalid token.' : 'Error loading queue.'; return false; }
    $('err').textContent = '';
    const box = $('pending'); box.innerHTML = '';
    $('pendCount').textContent = r.j.count;
    if (!r.j.pending.length) { box.innerHTML = '<p class="muted">Nothing awaiting review. The desk is clear.</p>'; return true; }
    for (const p of r.j.pending) {
      const el = document.createElement('div'); el.className = 'card';
      const pic = p.imageUrl ? '<img src="' + esc(p.imageUrl) + '" alt="">' : '<div class="mono">' + esc((p.name[0] || '·').toUpperCase()) + '</div>';
      el.innerHTML = pic +
        '<div><div class="name">' + esc(p.name) + '</div>' +
        (p.motto ? '<div class="motto">“' + esc(p.motto) + '”</div>' : '') +
        '<div class="meta">' + fmt(p.amountCents) + ' · ' + new Date(p.at).toLocaleString() + '</div></div>' +
        '<div class="acts"><button class="btn-approve">Approve</button><button class="btn-reject">Reject</button></div>';
      el.querySelector('.btn-approve').onclick = async () => { await api('/api/admin/approve', { sid: p.sid }); loadPending(); };
      el.querySelector('.btn-reject').onclick = async () => { if (confirm('Reject and delete this tribute? (non-refunding)')) { await api('/api/admin/reject', { sid: p.sid }); loadPending(); } };
      box.appendChild(el);
    }
    return true;
  }

  async function unlock() {
    token = $('token').value.trim();
    if (!token) return;
    const ok = await loadPending();
    if (ok) {
      sessionStorage.setItem('lov-admin', token);
      $('panel').hidden = false; $('forget').hidden = false; $('token').value = '';
    }
  }
  $('unlock').onclick = unlock;
  $('token').addEventListener('keydown', e => { if (e.key === 'Enter') unlock(); });
  $('forget').onclick = () => { sessionStorage.removeItem('lov-admin'); location.reload(); };
  $('refresh').onclick = loadPending;

  function modAction(fn) {
    return async () => {
      const name = $('modName').value.trim();
      if (!name) { $('err').textContent = 'Enter the exact name first.'; return; }
      await fn(name); $('err').textContent = ''; loadPending();
    };
  }
  $('doRemove').onclick = modAction(async name => { if (confirm('Remove ALL payments under "' + name + '"?')) await api('/api/admin/remove', { name }); });
  $('doCensorImg').onclick = modAction(async name => { await api('/api/admin/censor', { name, image: true }); });
  $('doCensorMotto').onclick = modAction(async name => { await api('/api/admin/censor', { name, image: false, motto: true }); });

  if (token) { $('token').value = ''; unlock(); }
})();
