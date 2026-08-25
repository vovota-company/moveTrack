/* =========================================================
   moveTrack — vanilla JS movie tracker
   Storage: localStorage  |  UI: Tailwind + Lucide
   ========================================================= */
(function () {
  'use strict';

  /* ---------- Config ---------- */
  // Default admin password. Change it once, then it's remembered in localStorage.
  const DEFAULT_ADMIN_PASSWORD = 'admin123';

  const KEYS = {
    movies: 'movetrack.movies',
    session: 'movetrack.admin',      // '1' when signed in
    pass: 'movetrack.pass',          // stored admin password
    likedBy: 'movetrack.liked',      // which movies THIS browser liked
  };

  /* ---------- Storage helpers ---------- */
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); }
      catch { return fallback; }
    },
    set(key, val) { localStorage.setItem(key, JSON.stringify(val)); },
    raw(key, fallback) { const v = localStorage.getItem(key); return v == null ? fallback : v; },
    setRaw(key, val) { localStorage.setItem(key, val); },
  };

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  /* ---------- Data model ---------- *
     movie = {
       id, title, url, videoId, date (yyyy-mm-dd),
       likes: number,
       comments: [{ id, name, text, ts }]
     }
  */
  let movies = store.get(KEYS.movies, []);
  let likedBy = store.get(KEYS.likedBy, {});    // { movieId: true }
  let isAdmin = store.raw(KEYS.session, '0') === '1';

  const adminPassword = () => store.raw(KEYS.pass, DEFAULT_ADMIN_PASSWORD);

  function saveMovies() { store.set(KEYS.movies, movies); }
  function saveLiked() { store.set(KEYS.likedBy, likedBy); }

  /* ---------- Seed sample data on first run ---------- */
  if (!localStorage.getItem(KEYS.movies)) {
    movies = [
      {
        id: uid(),
        title: 'Big Buck Bunny',
        url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
        videoId: 'aqz-KE-bpKQ',
        date: '2008-05-20',
        likes: 3,
        comments: [
          { id: uid(), name: 'Aline', text: 'Classic! Love the animation.', ts: Date.now() - 86400000 },
        ],
      },
      {
        id: uid(),
        title: 'Sintel — Open Movie',
        url: 'https://www.youtube.com/watch?v=eRsGyueVLvQ',
        videoId: 'eRsGyueVLvQ',
        date: '2010-09-27',
        likes: 1,
        comments: [],
      },
    ];
    saveMovies();
  }

  /* ---------- YouTube helpers ---------- */
  function parseYouTubeId(url) {
    if (!url) return null;
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtube\.com\/v\/|youtu\.be\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/,
      /[?&]v=([A-Za-z0-9_-]{11})/,
    ];
    for (const p of patterns) { const m = url.match(p); if (m) return m[1]; }
    return null;
  }
  const thumb = (id) => `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  const embed = (id) => `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`;

  /* ---------- Formatting ---------- */
  function fmtDate(d) {
    if (!d) return '';
    const dt = new Date(d + 'T00:00:00');
    if (isNaN(dt)) return d;
    return dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }
  function timeAgo(ts) {
    const s = Math.floor((Date.now() - ts) / 1000);
    const units = [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60]];
    for (const [name, secs] of units) {
      const v = Math.floor(s / secs);
      if (v >= 1) return v + ' ' + name + (v > 1 ? 's' : '') + ' ago';
    }
    return 'just now';
  }
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* ---------- DOM refs ---------- */
  const $ = (sel) => document.querySelector(sel);
  const grid = $('#grid');
  const emptyState = $('#emptyState');
  const emptyHint = $('#emptyHint');
  const countLabel = $('#countLabel');
  const searchInput = $('#searchInput');
  const searchInputMobile = $('#searchInputMobile');

  let searchTerm = '';
  let currentId = null; // movie open in player

  /* ---------- Icons refresh ---------- */
  function icons() { if (window.lucide) window.lucide.createIcons(); }

  /* ---------- Toast ---------- */
  let toastTimer;
  function toast(msg, icon = 'check-circle') {
    $('#toastMsg').textContent = msg;
    $('#toastIcon').setAttribute('data-lucide', icon);
    $('#toast').classList.remove('hidden');
    icons();
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('#toast').classList.add('hidden'), 2400);
  }

  /* ---------- Render grid ---------- */
  function render() {
    const term = searchTerm.trim().toLowerCase();
    const list = movies
      .filter((m) => !term || m.title.toLowerCase().includes(term))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    countLabel.textContent = movies.length
      ? `${list.length} of ${movies.length} movie${movies.length > 1 ? 's' : ''}`
      : '';

    if (!list.length) {
      grid.innerHTML = '';
      emptyState.classList.remove('hidden');
      emptyState.classList.add('flex');
      emptyHint.textContent = movies.length
        ? 'No movies match your search.'
        : (isAdmin ? 'Click “Add movie” to create the first one.' : 'Sign in as admin to add the first movie.');
      return;
    }

    emptyState.classList.add('hidden');
    emptyState.classList.remove('flex');

    grid.innerHTML = list.map((m) => cardHtml(m)).join('');
    icons();
  }

  function cardHtml(m) {
    const liked = !!likedBy[m.id];
    const cCount = m.comments ? m.comments.length : 0;
    const adminCtrls = isAdmin
      ? `<div class="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
           <button data-edit="${m.id}" title="Edit"
             class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/95 hover:bg-white text-gink shadow-card">
             <i data-lucide="pencil" class="w-4 h-4 pointer-events-none"></i>
           </button>
           <button data-del="${m.id}" title="Delete"
             class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/95 hover:bg-white text-red-500 shadow-card">
             <i data-lucide="trash-2" class="w-4 h-4 pointer-events-none"></i>
           </button>
         </div>`
      : '';

    return `
      <article class="group bg-white rounded-2xl border border-gline shadow-card hover:shadow-cardh transition overflow-hidden">
        <div class="relative aspect-video bg-gbg cursor-pointer" data-open="${m.id}">
          <img src="${thumb(m.videoId)}" alt="" loading="lazy"
            class="w-full h-full object-cover" onerror="this.style.display='none'" />
          <div class="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition">
            <span class="inline-flex items-center justify-center w-14 h-14 rounded-full bg-white/90 text-gblue shadow-card scale-90 group-hover:scale-100 transition">
              <i data-lucide="play" class="w-6 h-6 ml-0.5 pointer-events-none" fill="currentColor"></i>
            </span>
          </div>
          ${adminCtrls}
        </div>
        <div class="p-4">
          <h3 class="font-medium leading-snug line-clamp-2 cursor-pointer hover:text-gblue transition" data-open="${m.id}">${escapeHtml(m.title)}</h3>
          <p class="text-xs text-gash mt-1 flex items-center gap-1.5">
            <i data-lucide="calendar" class="w-3.5 h-3.5"></i> ${fmtDate(m.date) || 'No date'}
          </p>
          <div class="flex items-center gap-4 mt-3 text-sm text-gash">
            <span class="inline-flex items-center gap-1.5 ${liked ? 'text-gblue' : ''}">
              <i data-lucide="thumbs-up" class="w-4 h-4"></i> ${m.likes || 0}
            </span>
            <span class="inline-flex items-center gap-1.5">
              <i data-lucide="message-circle" class="w-4 h-4"></i> ${cCount}
            </span>
            <button data-share="${m.id}" class="ml-auto inline-flex items-center gap-1.5 hover:text-green-600 transition" title="Share on WhatsApp">
              <i data-lucide="share-2" class="w-4 h-4"></i>
            </button>
          </div>
        </div>
      </article>`;
  }

  /* ---------- Grid click delegation ---------- */
  grid.addEventListener('click', (e) => {
    const openEl = e.target.closest('[data-open]');
    const editEl = e.target.closest('[data-edit]');
    const delEl = e.target.closest('[data-del]');
    const shareEl = e.target.closest('[data-share]');

    if (editEl) { e.stopPropagation(); openForm(editEl.getAttribute('data-edit')); return; }
    if (delEl) { e.stopPropagation(); askDelete(delEl.getAttribute('data-del')); return; }
    if (shareEl) { e.stopPropagation(); shareWhatsApp(shareEl.getAttribute('data-share')); return; }
    if (openEl) { openPlayer(openEl.getAttribute('data-open')); }
  });

  /* ---------- Search ---------- */
  function onSearch(v) { searchTerm = v; if (searchInput) searchInput.value = v; if (searchInputMobile) searchInputMobile.value = v; render(); }
  searchInput && searchInput.addEventListener('input', (e) => onSearch(e.target.value));
  searchInputMobile && searchInputMobile.addEventListener('input', (e) => onSearch(e.target.value));

  /* =========================================================
     PLAYER / DETAIL MODAL
     ========================================================= */
  const playerModal = $('#playerModal');
  const playerMount = $('#playerMount');

  function getMovie(id) { return movies.find((m) => m.id === id); }

  function openPlayer(id) {
    const m = getMovie(id);
    if (!m) return;
    currentId = id;

    playerMount.innerHTML =
      `<iframe class="w-full h-full" src="${embed(m.videoId)}" title="${escapeHtml(m.title)}"
        frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;

    $('#pTitle').textContent = m.title;
    $('#pDate').innerHTML = `<i data-lucide="calendar" class="w-4 h-4"></i> ${fmtDate(m.date) || 'No date'}`;
    $('#pOpenYt').href = m.url;

    // admin actions
    $('#pAdminActions').classList.toggle('hidden', !isAdmin);
    $('#pAdminActions').classList.toggle('flex', isAdmin);

    renderPlayerMeta();
    renderComments();

    playerModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    icons();
  }

  function closePlayer() {
    playerModal.classList.add('hidden');
    playerMount.innerHTML = ''; // stop video
    document.body.style.overflow = '';
    currentId = null;
  }

  function renderPlayerMeta() {
    const m = getMovie(currentId);
    if (!m) return;
    const liked = !!likedBy[m.id];
    $('#pLikeCount').textContent = m.likes || 0;
    const likeBtn = $('#pLikeBtn');
    likeBtn.classList.toggle('bg-gblue', liked);
    likeBtn.classList.toggle('text-white', liked);
    likeBtn.classList.toggle('border-gblue', liked);
  }

  function renderComments() {
    const m = getMovie(currentId);
    if (!m) return;
    const list = $('#commentList');
    const cs = (m.comments || []).slice().sort((a, b) => b.ts - a.ts);
    $('#pCommentCount').textContent = cs.length ? `(${cs.length})` : '';
    $('#noComments').classList.toggle('hidden', cs.length > 0);

    list.innerHTML = cs.map((c) => {
      const name = c.name && c.name.trim() ? c.name.trim() : 'Anonymous';
      const initial = name.charAt(0).toUpperCase();
      const adminDel = isAdmin
        ? `<button data-delc="${c.id}" class="text-gash hover:text-red-500 transition" title="Delete comment">
             <i data-lucide="trash-2" class="w-4 h-4 pointer-events-none"></i></button>`
        : '';
      return `
        <li class="flex items-start gap-3">
          <span class="mt-0.5 inline-flex items-center justify-center w-9 h-9 rounded-full bg-gblue/10 text-gblue text-sm font-medium shrink-0">${escapeHtml(initial)}</span>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium">${escapeHtml(name)}</span>
              <span class="text-xs text-gash">${timeAgo(c.ts)}</span>
              <span class="ml-auto">${adminDel}</span>
            </div>
            <p class="text-sm text-gink mt-0.5 whitespace-pre-wrap break-words">${escapeHtml(c.text)}</p>
          </div>
        </li>`;
    }).join('');
    icons();
  }

  // like
  $('#pLikeBtn').addEventListener('click', () => {
    const m = getMovie(currentId);
    if (!m) return;
    if (likedBy[m.id]) { m.likes = Math.max(0, (m.likes || 0) - 1); delete likedBy[m.id]; }
    else { m.likes = (m.likes || 0) + 1; likedBy[m.id] = true; }
    saveMovies(); saveLiked();
    renderPlayerMeta(); render();
  });

  // share from modal
  $('#pShareBtn').addEventListener('click', () => shareWhatsApp(currentId));

  // add comment
  function submitComment() {
    const m = getMovie(currentId);
    if (!m) return;
    const text = $('#cText').value.trim();
    if (!text) { $('#cText').focus(); return; }
    const name = $('#cName').value.trim();
    m.comments = m.comments || [];
    m.comments.push({ id: uid(), name, text, ts: Date.now() });
    saveMovies();
    $('#cText').value = '';
    renderComments(); render();
    toast('Comment added');
  }
  $('#cSubmit').addEventListener('click', submitComment);
  $('#cText').addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') submitComment();
  });

  // delete comment (admin), edit/delete movie from modal
  $('#commentList').addEventListener('click', (e) => {
    const del = e.target.closest('[data-delc]');
    if (del && isAdmin) {
      const m = getMovie(currentId);
      m.comments = m.comments.filter((c) => c.id !== del.getAttribute('data-delc'));
      saveMovies(); renderComments(); render(); toast('Comment deleted');
    }
  });
  $('#pEditBtn').addEventListener('click', () => { if (currentId) openForm(currentId); });
  $('#pDeleteBtn').addEventListener('click', () => { if (currentId) askDelete(currentId); });

  // close player
  document.querySelectorAll('[data-close-player]').forEach((el) => el.addEventListener('click', closePlayer));

  /* ---------- WhatsApp share ---------- */
  function shareWhatsApp(id) {
    const m = getMovie(id);
    if (!m) return;
    const text = `🎬 ${m.title}\nWatch: ${m.url}\n\nShared via moveTrack`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener');
  }

  /* =========================================================
     ADD / EDIT FORM
     ========================================================= */
  const formModal = $('#formModal');
  let editingId = null;

  function openForm(id) {
    if (!isAdmin) return;
    editingId = id || null;
    const m = id ? getMovie(id) : null;
    $('#formTitle').textContent = m ? 'Edit movie' : 'Add movie';
    $('#fTitle').value = m ? m.title : '';
    $('#fUrl').value = m ? m.url : '';
    $('#fDate').value = m ? m.date : new Date().toISOString().slice(0, 10);
    $('#fUrlHint').classList.add('hidden');
    formModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    icons();
    setTimeout(() => $('#fTitle').focus(), 50);
  }
  function closeForm() {
    formModal.classList.add('hidden');
    editingId = null;
    if (!currentId) document.body.style.overflow = '';
  }
  function saveForm() {
    const title = $('#fTitle').value.trim();
    const url = $('#fUrl').value.trim();
    const date = $('#fDate').value;
    const vid = parseYouTubeId(url);

    if (!title) { $('#fTitle').focus(); return; }
    if (!vid) { $('#fUrlHint').classList.remove('hidden'); $('#fUrl').focus(); return; }
    $('#fUrlHint').classList.add('hidden');

    if (editingId) {
      const m = getMovie(editingId);
      Object.assign(m, { title, url, videoId: vid, date });
      saveMovies();
      // refresh player if open
      if (currentId === editingId) openPlayer(editingId);
      toast('Movie updated');
    } else {
      movies.push({ id: uid(), title, url, videoId: vid, date, likes: 0, comments: [] });
      saveMovies();
      toast('Movie added');
    }
    closeForm();
    render();
  }
  $('#addBtn').addEventListener('click', () => openForm(null));
  $('#fSave').addEventListener('click', saveForm);
  document.querySelectorAll('[data-close-form]').forEach((el) => el.addEventListener('click', closeForm));
  $('#fUrl').addEventListener('input', () => $('#fUrlHint').classList.add('hidden'));

  /* =========================================================
     DELETE CONFIRM
     ========================================================= */
  const confirmModal = $('#confirmModal');
  let deletingId = null;
  function askDelete(id) {
    if (!isAdmin) return;
    deletingId = id;
    confirmModal.classList.remove('hidden');
    icons();
  }
  function closeConfirm() { confirmModal.classList.add('hidden'); deletingId = null; }
  $('#confirmYes').addEventListener('click', () => {
    if (!deletingId) return;
    movies = movies.filter((m) => m.id !== deletingId);
    delete likedBy[deletingId];
    saveMovies(); saveLiked();
    if (currentId === deletingId) closePlayer();
    closeConfirm();
    render();
    toast('Movie deleted', 'trash-2');
  });
  document.querySelectorAll('[data-close-confirm]').forEach((el) => el.addEventListener('click', closeConfirm));

  /* =========================================================
     ADMIN AUTH
     ========================================================= */
  const authModal = $('#authModal');

  function refreshAdminUI() {
    const addBtn = $('#addBtn');
    addBtn.classList.toggle('hidden', !isAdmin);
    addBtn.classList.toggle('inline-flex', isAdmin);
    $('#authBtnLabel').textContent = isAdmin ? 'Sign out' : 'Admin';
    $('#authBtn').querySelector('i').setAttribute('data-lucide', isAdmin ? 'log-out' : 'shield');
    icons();
  }

  $('#authBtn').addEventListener('click', () => {
    if (isAdmin) {
      isAdmin = false;
      store.setRaw(KEYS.session, '0');
      refreshAdminUI();
      render();
      if (currentId) openPlayer(currentId); // refresh admin controls in modal
      toast('Signed out');
    } else {
      $('#authPass').value = '';
      $('#authErr').classList.add('hidden');
      authModal.classList.remove('hidden');
      icons();
      setTimeout(() => $('#authPass').focus(), 50);
    }
  });

  function submitAuth() {
    const val = $('#authPass').value;
    if (val === adminPassword()) {
      isAdmin = true;
      store.setRaw(KEYS.session, '1');
      // Persist password (so DEFAULT stays working even if you later add change UI)
      if (!localStorage.getItem(KEYS.pass)) store.setRaw(KEYS.pass, DEFAULT_ADMIN_PASSWORD);
      authModal.classList.add('hidden');
      refreshAdminUI();
      render();
      if (currentId) openPlayer(currentId);
      toast('Signed in as admin', 'shield-check');
    } else {
      $('#authErr').classList.remove('hidden');
      $('#authPass').select();
    }
  }
  $('#authSubmit').addEventListener('click', submitAuth);
  $('#authPass').addEventListener('keydown', (e) => { if (e.key === 'Enter') submitAuth(); });
  document.querySelectorAll('[data-close-auth]').forEach((el) => el.addEventListener('click', () => authModal.classList.add('hidden')));
  $('#authToggle').addEventListener('click', () => {
    const inp = $('#authPass');
    const to = inp.type === 'password' ? 'text' : 'password';
    inp.type = to;
    $('#authToggle').querySelector('i').setAttribute('data-lucide', to === 'password' ? 'eye' : 'eye-off');
    icons();
  });

  /* ---------- Global Esc to close ---------- */
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!confirmModal.classList.contains('hidden')) return closeConfirm();
    if (!authModal.classList.contains('hidden')) return authModal.classList.add('hidden');
    if (!formModal.classList.contains('hidden')) return closeForm();
    if (!playerModal.classList.contains('hidden')) return closePlayer();
  });

  /* ---------- Boot ---------- */
  $('#year').textContent = new Date().getFullYear();
  refreshAdminUI();
  render();
  icons();
})();
