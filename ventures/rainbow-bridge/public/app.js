/* Rainbow Bridge — client. External file so a strict CSP (script-src 'self') can run it. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const fmt = c => '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: c % 100 ? 2 : 0 });
  const esc = s => { const d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; };
  // A soft, muted paw — a gentle engraving rather than a bright cartoon — for a photo-less memorial.
  const PAW = '<svg viewBox="0 0 64 64" fill="currentColor" style="width:46%;height:46%;opacity:.6;color:var(--gold-soft)" aria-hidden="true"><ellipse cx="32" cy="43" rx="13" ry="10"/><ellipse cx="15" cy="29" rx="5.5" ry="7"/><ellipse cx="25.5" cy="20" rx="5" ry="7"/><ellipse cx="38.5" cy="20" rx="5" ry="7"/><ellipse cx="49" cy="29" rx="5.5" ry="7"/></svg>';

  let prices = { place: 1900, eternal: 2900 };
  let allowImages = true;
  let selectedTier = 'place';
  let photoDataUrl = null;
  let page = 1, query = '', stateFp = '', meadowFp = '';

  function years(m) {
    if (m.birth && m.passing) return esc(m.birth) + ' – ' + esc(m.passing);
    if (m.passing) return '– ' + esc(m.passing);
    return '';
  }
  function together(m) {
    const b = parseInt(m.birth, 10), p = parseInt(m.passing, 10);
    if (b && p && p >= b && p - b <= 60) { const n = p - b; return n <= 0 ? '' : n + (n === 1 ? ' year together' : ' years together'); }
    return '';
  }
  function locketHTML(m, cls) {
    return m.imageUrl
      ? '<img class="' + cls + '" src="' + esc(m.imageUrl) + '" alt="' + esc(m.petName) + '" loading="lazy">'
      : '<div class="' + cls + ' medallion" aria-hidden="true">' + PAW + '</div>';
  }

  // ---- state (header + today) ----
  function renderState(s) {
    stateFp = s.total + ':' + s.today.map(m => m.id).join(',');
    $('demoBanner').hidden = !s.demo;
    if (s.contact) { $('contactLink').href = 'mailto:' + s.contact; window.__contact = s.contact; }
    prices = s.prices; allowImages = s.allowImages !== false;
    $('priceP').textContent = fmt(prices.place); $('priceE').textContent = fmt(prices.eternal);
    $('photoBlock').hidden = !allowImages;
    $('count').textContent = s.total === 0 ? '' : s.total === 1 ? 'One companion rests here' : s.total.toLocaleString('en-US') + ' companions rest here';
    syncPay();
    const t = $('today');
    if (!s.today.length) { t.hidden = true; return; }
    t.hidden = false;
    const row = $('todayRow'); row.innerHTML = '';
    for (const m of s.today) {
      const el = document.createElement('div'); el.className = 'who';
      el.innerHTML = (m.imageUrl ? '<img class="mini" src="' + esc(m.imageUrl) + '" alt="">' : '<div class="mini">' + PAW + '</div>') + '<div class="nm">' + esc(m.petName) + '</div>';
      el.onclick = () => view(m.id);
      row.appendChild(el);
    }
  }

  // ---- meadow ----
  function renderMeadow(d) {
    meadowFp = d.q + ':' + d.page + ':' + d.total + ':' + (d.memorials[0] ? d.memorials[0].id : '-');
    const g = $('meadow'); g.innerHTML = '';
    if (!d.memorials.length) {
      g.innerHTML = '<div class="empty-meadow">' + (d.q
        ? 'No companion here matches “' + esc(d.q) + '” yet.'
        : 'The meadow is quiet, for now.<br>The first companion is waiting to be remembered.') + '</div>';
    }
    for (const m of d.memorials) {
      const b = document.createElement('button');
      b.className = 'plot' + (m.tier === 'eternal' ? ' eternal' : '');
      b.setAttribute('aria-label', 'Memorial for ' + m.petName);
      b.innerHTML = '<div class="locket-wrap"><div class="flame" aria-hidden="true"></div>' + locketHTML(m, 'locket') + '</div>' +
        '<div class="nm">' + esc(m.petName) + '</div><div class="yr">' + years(m) + '</div>';
      b.onclick = () => view(m.id);
      g.appendChild(b);
    }
    $('pager').hidden = d.pages <= 1;
    $('pgWhere').textContent = 'Page ' + d.page + ' of ' + d.pages;
    $('pgPrev').disabled = d.page <= 1; $('pgNext').disabled = d.page >= d.pages;
    page = d.page;
  }

  async function loadState() {
    try { const s = await (await fetch('/api/state')).json();
      if (s.total + ':' + s.today.map(m => m.id).join(',') !== stateFp) renderState(s); } catch (e) {}
  }
  async function loadMeadow(force) {
    try {
      const d = await (await fetch('/api/meadow?page=' + page + '&q=' + encodeURIComponent(query))).json();
      const fp = d.q + ':' + d.page + ':' + d.total + ':' + (d.memorials[0] ? d.memorials[0].id : '-');
      if (force || fp !== meadowFp) renderMeadow(d);
    } catch (e) {}
  }

  // ---- view a memorial ----
  async function view(id) {
    try {
      const { memorial: m } = await (await fetch('/api/memorial?id=' + encodeURIComponent(id))).json();
      if (!m) return;
      const lk = $('viewLocket');
      if (m.imageUrl) { lk.innerHTML = '<img src="' + esc(m.imageUrl) + '" alt="' + esc(m.petName) + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover">'; }
      else { lk.innerHTML = PAW; }
      $('viewName').textContent = m.petName;
      $('viewYears').textContent = m.birth && m.passing ? m.birth + ' – ' + m.passing : (m.passing ? '– ' + m.passing : '');
      $('viewTogether').textContent = together(m);
      $('viewWords').textContent = m.words ? '“' + m.words + '”' : '';
      $('viewBy').textContent = m.litBy ? 'Placed by ' + m.litBy : '';
      $('viewModal').showModal();
    } catch (e) {}
  }
  $('viewClose').onclick = () => $('viewModal').close();
  $('aboutLink').addEventListener('click', e => { e.preventDefault(); $('aboutModal').showModal(); });
  $('aboutClose').onclick = () => $('aboutModal').close();

  // ---- search + pager ----
  let deb; $('search').addEventListener('input', () => { clearTimeout(deb); deb = setTimeout(() => { query = $('search').value.trim(); page = 1; loadMeadow(true); }, 280); });
  $('pgPrev').onclick = () => { if (page > 1) { page--; loadMeadow(true); } };
  $('pgNext').onclick = () => { page++; loadMeadow(true); };

  // ---- remember form ----
  const modal = $('formModal');
  $('rememberBtn').onclick = () => { $('formError').textContent = ''; $('formNote').hidden = true; modal.showModal(); $('petName').focus(); };
  $('cancelBtn').onclick = () => modal.close();
  $('words').addEventListener('input', () => { $('wordsCount').textContent = $('words').value.length; });

  document.querySelectorAll('.tier').forEach(t => t.onclick = () => {
    document.querySelectorAll('.tier').forEach(x => x.classList.remove('sel'));
    t.classList.add('sel'); selectedTier = t.dataset.tier; syncPay(); updateWordsMax();
  });
  function syncPay() { $('payAmt').textContent = fmt(selectedTier === 'eternal' ? prices.eternal : prices.place); }
  // The eternal tier really does give room for a longer story.
  function updateWordsMax() {
    const max = selectedTier === 'eternal' ? 700 : 280;
    $('words').maxLength = max; $('wordsMax').textContent = max; $('wordsCount').textContent = $('words').value.length;
  }
  $('refundLink').addEventListener('click', e => { e.preventDefault(); $('aboutModal').showModal(); });

  // photo: resize in browser to ~640px
  $('photoBtn').onclick = () => $('photoFile').click();
  $('photoClear').onclick = () => setPhoto(null);
  $('photoFile').addEventListener('change', () => {
    const f = $('photoFile').files[0]; if (!f) return;
    const url = URL.createObjectURL(f), im = new Image();
    im.onload = () => {
      const max = 640, r = Math.min(1, max / Math.max(im.width, im.height));
      const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(im.width * r)); c.height = Math.max(1, Math.round(im.height * r));
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      setPhoto(c.toDataURL('image/jpeg', 0.86)); URL.revokeObjectURL(url);
    };
    im.onerror = () => { URL.revokeObjectURL(url); $('formError').textContent = 'We couldn’t read that photo. iPhone “HEIC” photos aren’t supported yet — uploading a screenshot of the photo works, or set Settings › Camera › Formats to “Most Compatible”. A JPEG or PNG is always fine.'; };
    im.src = url;
  });
  function setPhoto(dataUrl) {
    photoDataUrl = dataUrl; const p = $('photoPrev');
    if (dataUrl) { p.src = dataUrl; p.classList.add('show'); $('photoClear').classList.add('show'); $('photoBtn').textContent = 'Choose a different photo…'; }
    else { p.classList.remove('show'); $('photoClear').classList.remove('show'); $('photoBtn').textContent = 'Choose a photo…'; $('photoFile').value = ''; }
  }

  $('rememberForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('payBtn'); btn.disabled = true; $('formError').textContent = '';
    const payload = {
      petName: $('petName').value, species: $('species').value, birth: $('birth').value, passing: $('passing').value,
      words: $('words').value, litBy: $('litBy').value, ownerEmail: $('ownerEmail').value, tier: selectedTier,
      image: allowImages ? (photoDataUrl || undefined) : undefined,
    };
    try {
      try { localStorage.setItem('rb-draft', JSON.stringify(payload)); } catch (_) {}
      const r = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || 'Something went wrong.');
      window.location.href = body.url;
    } catch (err) { $('formError').textContent = err.message; btn.disabled = false; }
  });

  let tt; function toast(html, ms) { const t = $('toast'); t.innerHTML = html; t.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), ms || 8000); }
  // A persistent, dismissible banner — the payer always has reassurance, even after the toast would fade.
  function banner(html) { $('confirmText').innerHTML = html; $('confirmBanner').hidden = false; window.scrollTo({ top: 0, behavior: 'smooth' }); }
  $('confirmClose').onclick = () => { $('confirmBanner').hidden = true; };

  // ---- return from checkout ----
  const q = new URLSearchParams(location.search);
  if (q.get('sid')) {
    fetch('/api/confirm?sid=' + encodeURIComponent(q.get('sid'))).then(r => r.json().then(b => ({ ok: r.ok, b }))).then(({ ok, b }) => {
      if (ok && b.ok) {
        localStorage.removeItem('rb-draft');
        banner('Thank you. <b>' + esc(b.petName) + '</b> will join the meadow once we’ve gently reviewed it — usually within a day. Their place here is safe. If you need anything, <a href="mailto:' + (window.__contact || 'victortanws@gmail.com') + '">write to us</a> any time.');
        loadState(); loadMeadow(true);
        history.replaceState(null, '', '/');
      } else {
        banner('Your payment is still being confirmed. <a href="' + location.href + '">Tap to check again</a> — if you were charged, your companion’s memorial is safe and will appear after review.');
      }
    }).catch(() => banner('Your payment is still being confirmed. <a href="' + location.href + '">Tap to check again</a>.'));
  } else if (q.get('canceled')) {
    const d = JSON.parse(localStorage.getItem('rb-draft') || 'null');
    if (d && d.petName) {
      $('formNote').textContent = 'Nothing was charged. What you wrote is kept here — continue whenever you’re ready.'; $('formNote').hidden = false;
      $('petName').value = d.petName || ''; $('species').value = d.species || 'dog'; $('birth').value = d.birth || '';
      $('passing').value = d.passing || ''; $('words').value = d.words || ''; $('litBy').value = d.litBy || ''; $('ownerEmail').value = d.ownerEmail || '';
      $('words').dispatchEvent(new Event('input'));
      selectedTier = d.tier || 'place'; document.querySelectorAll('.tier').forEach(x => x.classList.toggle('sel', x.dataset.tier === selectedTier)); syncPay();
      if (d.image) setPhoto(d.image);
      modal.showModal();
    } else { toast('Nothing was charged. Your companion is waiting whenever you’re ready.'); }
    history.replaceState(null, '', '/');
  }

  updateWordsMax();
  loadState(); loadMeadow(true);
  setInterval(() => { loadState(); if (document.activeElement !== $('search')) loadMeadow(false); }, 15000);
})();
