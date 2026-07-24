/* Groundskeeper's Desk — external so the strict CSP allows it. Token in sessionStorage only. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => { const d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; };
  const ICON = { dog: '🐕', cat: '🐈', bird: '🐦', rabbit: '🐇', horse: '🐎', other: '🐾' };
  let token = sessionStorage.getItem('rb-admin') || '';

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
    const box = $('pending'); box.innerHTML = ''; $('pendCount').textContent = r.j.count;
    if (!r.j.pending.length) { box.innerHTML = '<p class="muted">Nothing awaiting review. The meadow is peaceful.</p>'; return true; }
    for (const m of r.j.pending) {
      const el = document.createElement('div'); el.className = 'card';
      const pic = m.imageUrl ? '<img class="pic" src="' + esc(m.imageUrl) + '" alt="">' : '<div class="medal">' + (ICON[m.species] || ICON.other) + '</div>';
      const yrs = (m.birth || m.passing) ? esc(m.birth || '') + ' – ' + esc(m.passing || '') : '';
      el.innerHTML = pic +
        '<div><div class="name">' + esc(m.petName) + '</div>' +
        (yrs ? '<div class="yrs">' + yrs + ' · ' + esc(m.species) + ' · ' + esc(m.tier) + '</div>' : '<div class="yrs">' + esc(m.species) + ' · ' + esc(m.tier) + '</div>') +
        (m.words ? '<div class="words">“' + esc(m.words) + '”</div>' : '') +
        '<div class="meta">' + (m.litBy ? 'placed by ' + esc(m.litBy) + ' · ' : '') + new Date(m.at).toLocaleString() + '</div></div>' +
        '<div class="acts"><button class="btn-approve">Approve</button><button class="btn-reject">Reject</button></div>';
      el.querySelector('.btn-approve').onclick = async () => { await api('/api/admin/approve', { id: m.id }); loadPending(); };
      el.querySelector('.btn-reject').onclick = async () => { if (confirm('Reject and delete this memorial submission for "' + m.petName + '"?')) { await api('/api/admin/reject', { id: m.id }); loadPending(); } };
      box.appendChild(el);
    }
    return true;
  }
  async function unlock() {
    token = $('token').value.trim(); if (!token) return;
    if (await loadPending()) { sessionStorage.setItem('rb-admin', token); $('panel').hidden = false; $('forget').hidden = false; $('token').value = ''; }
  }
  $('unlock').onclick = unlock;
  $('token').addEventListener('keydown', e => { if (e.key === 'Enter') unlock(); });
  $('forget').onclick = () => { sessionStorage.removeItem('rb-admin'); location.reload(); };
  $('refresh').onclick = loadPending;
  $('doRemove').onclick = async () => {
    const id = $('removeId').value.trim(); if (!id) { $('err').textContent = 'Enter a memorial id.'; return; }
    if (confirm('Remove memorial "' + id + '" from the meadow?')) { await api('/api/admin/remove', { id }); $('err').textContent = ''; $('removeId').value = ''; loadPending(); }
  };
  if (token) { $('token').value = ''; unlock(); }
})();
