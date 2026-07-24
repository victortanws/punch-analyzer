/* The Ledger of Vanity — client. External file (not inline) so a strict CSP
   script-src 'self' can protect against injected script. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const fmt = c => '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: c % 100 ? 2 : 0 });
  const fmtDate = ts => new Date(ts).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  function esc(s) { const d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; }

  let selectedCents = 2500;
  let imageDataUrl = null;          // resized image awaiting checkout
  let stateFp = '', rollFp = '';
  let page = 1, query = '';
  let allowImages = true;
  let entryIndex = new Map();       // lowercased name -> {totalCents} for the stacking hint

  // ---- header / throne ----
  function renderState(s) {
    stateFp = s.totalCents + ':' + s.names + ':' + (s.throne ? s.throne.totalCents : 0);
    $('demoBanner').hidden = !s.demo;
    if (s.contact) { $('contactLink').href = 'mailto:' + s.contact; $('termsContact').href = 'mailto:' + s.contact; }
    allowImages = s.allowImages !== false;
    const up = $('uploadBlock'); if (up) up.hidden = !allowImages;
    const dc = $('demoCredit'); if (dc) dc.hidden = !s.demo; // CC BY-SA credit, demo portrait only
    $('throneHint').textContent = s.throneCents
      ? 'Rank I currently stands at ' + fmt(s.throneCents) + '.'
      : 'The throne is currently unclaimed.';
    $('statTotal').textContent = fmt(s.totalCents);
    $('statNames').textContent = s.names.toLocaleString('en-US');
    const t = s.throne;
    $('throne').hidden = !t;
    if (t) {
      $('throneName').textContent = t.name;
      $('throneSum').textContent = fmt(t.totalCents);
      $('throneMotto').textContent = t.motto ? '“' + t.motto + '”' : '';
      // "Rank I since" reads better than "first inscribed" when the crown turns over fast.
      $('throneSince').textContent = 'Rank I since ' + fmtDate(t.firstAt);
      const img = $('throneImg');
      if (t.imageUrl) { img.src = t.imageUrl; img.alt = 'Image for ' + t.name; img.hidden = false; }
      else img.hidden = true;
    }
  }

  // ---- the roll ----
  function renderRoll(d) {
    rollFp = d.q + ':' + d.page + ':' + d.total + ':' + (d.entries[0] ? d.entries[0].totalCents : 0);
    const roll = $('roll');
    roll.innerHTML = '';
    if (!d.entries.length) {
      roll.innerHTML = '<li class="empty">' + (d.q
        ? 'No inscription matches “' + esc(d.q) + '”. A tribute would fix that.'
        : 'The Ledger awaits its first name.<br>Immortality has never been cheaper.') + '</li>';
    }
    for (const e of d.entries) {
      const li = document.createElement('li');
      if (e.rank <= 10) li.className = 'top10';
      const pic = e.imageUrl
        ? '<img class="pic" src="' + esc(e.imageUrl) + '" alt="" loading="lazy">'
        : '<div class="mono" aria-hidden="true">' + esc((e.name[0] || '·').toUpperCase()) + '</div>';
      li.innerHTML =
        '<span class="rank">' + (e.rank <= 10 ? ROMAN[e.rank] : e.rank) + '</span>' + pic +
        '<span class="who"><span class="name">' + esc(e.name) + '</span>' +
        (e.motto ? '<div class="motto">“' + esc(e.motto) + '”</div>' : '') + '</span>' +
        '<span class="sum">' + fmt(e.totalCents) + '</span>';
      roll.appendChild(li);
    }
    // keep a small index of names on the current page for the "you're stacking" hint
    for (const e of d.entries) entryIndex.set(e.name.trim().toLowerCase(), { totalCents: e.totalCents });
    $('pager').hidden = d.pages <= 1;
    $('pgWhere').textContent = 'Page ' + d.page + ' of ' + d.pages;
    $('pgPrev').disabled = d.page <= 1;
    $('pgNext').disabled = d.page >= d.pages;
    page = d.page;
  }

  async function loadState() {
    try { const s = await (await fetch('/api/state')).json();
      if (s.totalCents + ':' + s.names + ':' + (s.throne ? s.throne.totalCents : 0) !== stateFp) renderState(s); } catch (e) {}
  }
  async function loadRoll(force) {
    try {
      const d = await (await fetch('/api/entries?page=' + page + '&q=' + encodeURIComponent(query))).json();
      const fp = d.q + ':' + d.page + ':' + d.total + ':' + (d.entries[0] ? d.entries[0].totalCents : 0);
      if (force || fp !== rollFp) renderRoll(d);
    } catch (e) {}
  }

  // search (debounced) + pagination
  let debounce;
  $('search').addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => { query = $('search').value.trim(); page = 1; loadRoll(true); }, 280);
  });
  $('pgPrev').onclick = () => { if (page > 1) { page--; loadRoll(true); } };
  $('pgNext').onclick = () => { page++; loadRoll(true); };

  // ---- modal wiring ----
  const modal = $('modal');
  $('inscribeBtn').addEventListener('click', () => { $('formError').textContent = ''; $('modalNote').hidden = true; modal.showModal(); $('name').focus(); });
  $('cancelBtn').addEventListener('click', () => modal.close());
  $('termsLink').addEventListener('click', e => { e.preventDefault(); $('termsModal').showModal(); });
  $('termsClose').addEventListener('click', () => $('termsModal').close());
  $('motto').addEventListener('input', () => { $('mottoCount').textContent = $('motto').value.length; });

  // Live "you're stacking onto an existing inscription" hint when the typed name matches.
  $('name').addEventListener('input', () => {
    const hit = entryIndex.get($('name').value.trim().toLowerCase());
    const el = $('stackHint');
    if (hit) { el.textContent = 'This name already holds ' + fmt(hit.totalCents) + '. Your tribute stacks onto it; to change its displayed message or image, your payment must exceed your own largest tribute.'; el.hidden = false; }
    else el.hidden = true;
  });

  document.querySelectorAll('.amounts button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.amounts button').forEach(b => b.classList.remove('sel'));
      btn.classList.add('sel');
      if (btn.dataset.cents === 'custom') { $('customWrap').classList.add('show'); $('customAmount').focus(); updatePayLabel(); }
      else { $('customWrap').classList.remove('show'); selectedCents = Number(btn.dataset.cents); syncPay(); }
    });
  });
  $('customAmount').addEventListener('input', updatePayLabel);
  function updatePayLabel() {
    if (!$('customWrap').classList.contains('show')) return;
    const v = parseFloat($('customAmount').value);
    selectedCents = Number.isFinite(v) ? Math.round(v * 100) : 0;
    syncPay();
  }
  // Keep the Pay button label and disabled-state honest about a valid amount.
  function syncPay() {
    const valid = selectedCents >= 100 && selectedCents <= 999900;
    $('payAmt').textContent = valid ? fmt(selectedCents) : '$—';
    $('payBtn').disabled = !valid;
  }

  // ---- image selection: resize in-browser to ≤512px JPEG ----
  $('imgBtn').addEventListener('click', () => $('imgFile').click());
  $('imgClear').addEventListener('click', () => setImage(null));
  $('imgFile').addEventListener('change', () => {
    const f = $('imgFile').files[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    const im = new Image();
    im.onload = () => {
      const max = 512, r = Math.min(1, max / Math.max(im.width, im.height));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(im.width * r)); c.height = Math.max(1, Math.round(im.height * r));
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      setImage(c.toDataURL('image/jpeg', 0.85));
      URL.revokeObjectURL(url);
    };
    im.onerror = () => { URL.revokeObjectURL(url); $('formError').textContent = 'That file could not be read as an image (HEIC is not supported — use JPEG or PNG).'; };
    im.src = url;
  });
  function setImage(dataUrl) {
    imageDataUrl = dataUrl;
    const p = $('imgPreview');
    if (dataUrl) { p.src = dataUrl; p.classList.add('show'); $('imgClear').classList.add('show'); $('imgBtn').textContent = 'Choose a different image…'; }
    else { p.classList.remove('show'); $('imgClear').classList.remove('show'); $('imgBtn').textContent = 'Choose an image…'; $('imgFile').value = ''; }
  }

  // ---- submit ----
  $('inscribeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (selectedCents < 100) { $('formError').textContent = 'Enter a tribute of at least $1.'; return; }
    const payBtn = $('payBtn');
    payBtn.disabled = true;
    $('formError').textContent = '';
    try {
      const img = allowImages ? imageDataUrl : null;
      try { localStorage.setItem('lov-draft', JSON.stringify({ name: $('name').value, motto: $('motto').value, image: img })); }
      catch (_) { localStorage.setItem('lov-draft', JSON.stringify({ name: $('name').value, motto: $('motto').value })); }
      const r = await fetch('/api/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: $('name').value, motto: $('motto').value, amountCents: selectedCents, image: img || undefined }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || 'Something went wrong.');
      window.location.href = body.url;
    } catch (err) {
      $('formError').textContent = err.message;
      payBtn.disabled = false;
    }
  });

  let toastTimer;
  function toast(html, ms) {
    const t = $('toast');
    t.innerHTML = html;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), ms || 7000);
  }
  function copyLink(btnId) {
    const b = $(btnId); if (!b) return;
    b.addEventListener('click', () => {
      navigator.clipboard && navigator.clipboard.writeText(location.origin).then(() => { b.textContent = 'Link copied ✓'; }).catch(() => {});
    });
  }

  // Build a share payload worth broadcasting — a crown flex for top ranks.
  function shareToast(name, rank) {
    const crown = rank === 1 ? ' 👑' : '';
    const brag = rank === 1
      ? 'I am Rank I 👑 — Patron Supreme of The Ledger of Vanity. It confers nothing. Dethrone me: '
      : rank <= 10
        ? 'I hold Rank ' + rank + ' on The Ledger of Vanity. It confers nothing (yet). '
        : 'I bought Rank ' + rank + ' on The Ledger of Vanity. It confers nothing. That did not stop me. ';
    const tw = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(brag + location.origin);
    toast('<b>' + esc(name) + '</b> now holds rank <b>' + rank + crown + '</b>. The Ledger has recorded your vanity. ' +
      '<a href="' + tw + '" target="_blank" rel="noopener">Announce it →</a> · <a href="#" id="copyShare">Copy link</a>', 16000);
    copyLink('copyShare');
  }

  // ---- return from checkout ----
  const q = new URLSearchParams(location.search);
  if (q.get('sid')) {
    fetch('/api/confirm?sid=' + encodeURIComponent(q.get('sid')))
      .then(r => r.json().then(b => ({ ok: r.ok, b })))
      .then(({ ok, b }) => {
        if (ok && b.ok) {
          localStorage.removeItem('lov-draft');
          loadState(); loadRoll(true);
          rememberMine(b.name);
          if (b.pending) {
            toast('<b>Tribute received.</b> Your inscription is pending review and appears on the Ledger once approved — you take your rank the moment it does. We email nothing; check back shortly.', 18000);
          } else {
            shareToast(b.name, b.rank);
          }
          history.replaceState(null, '', '/');
        } else if (b && b.conflict) {
          toast(b.error, 20000);
        } else {
          toast('<b>Confirming your tribute…</b> it has not yet been recorded. <a href="' + location.href +
            '">Check again</a> — if you were charged, your inscription WILL appear.', 20000);
        }
      })
      .catch(() => toast('<b>Confirming your tribute…</b> connection hiccup. <a href="' + location.href +
        '">Check again</a>.', 20000));
  } else if (q.get('canceled')) {
    const d = JSON.parse(localStorage.getItem('lov-draft') || 'null');
    if (d && d.name) {
      // Show the reassurance INSIDE the modal — a toast would render behind the backdrop.
      const note = $('modalNote');
      note.textContent = 'Nothing was charged — your tribute was withdrawn. Your details are kept below; adjust and try again whenever you like.';
      note.hidden = false;
      $('name').value = d.name; $('motto').value = d.motto || '';
      $('motto').dispatchEvent(new Event('input'));
      $('name').dispatchEvent(new Event('input'));
      if (d.image) setImage(d.image);
      modal.showModal();
    } else {
      toast('Tribute withdrawn — nothing was charged. The Ledger pretends not to judge.');
    }
    history.replaceState(null, '', '/');
  }

  // ---- "you've been overtaken" loop (no email needed; localStorage baseline) ----
  function getMine() { try { return JSON.parse(localStorage.getItem('lov-mine') || '[]'); } catch (e) { return []; } }
  function setMine(a) { try { localStorage.setItem('lov-mine', JSON.stringify(a.slice(-10))); } catch (e) {} }
  function rememberMine(name) {
    const a = getMine(); const key = name.trim().toLowerCase();
    if (!a.some(x => x.key === key)) a.push({ key, name, lastRank: null });
    setMine(a);
  }
  async function checkOvertake() {
    const a = getMine(); if (!a.length) return;
    for (const m of a) {
      try {
        const d = await (await fetch('/api/entries?q=' + encodeURIComponent(m.name))).json();
        const hit = d.entries.find(e => e.name.trim().toLowerCase() === m.key);
        const cur = hit ? hit.rank : null;
        if (cur && m.lastRank && cur > m.lastRank) showOvertake(m.name, m.lastRank, cur);
        m.lastRank = cur; // reset baseline to now
      } catch (e) {}
    }
    setMine(a);
  }
  function showOvertake(name, from, to) {
    if (document.getElementById('overtakeBar')) return;
    const bar = document.createElement('div');
    bar.id = 'overtakeBar'; bar.className = 'overtake-bar';
    bar.innerHTML = '<span>You’ve slipped from rank <b>' + from + '</b> to rank <b>' + to + '</b> as <b>' + esc(name) +
      '</b>. The Ledger noticed.</span> <button type="button" id="reclaimBtn">Reclaim your standing →</button>' +
      '<button type="button" id="overtakeClose" aria-label="Dismiss">✕</button>';
    document.body.insertBefore(bar, document.body.firstChild);
    document.getElementById('reclaimBtn').onclick = () => {
      $('name').value = name; $('name').dispatchEvent(new Event('input'));
      $('modalNote').hidden = true; modal.showModal(); $('name').focus(); bar.remove();
    };
    document.getElementById('overtakeClose').onclick = () => bar.remove();
  }

  syncPay();
  loadState(); loadRoll(true).then(checkOvertake);
  setInterval(() => {
    loadState();
    if (document.activeElement !== $('search')) loadRoll(false); // don't redraw under a live search
  }, 12000);
})();
