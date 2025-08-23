// ===== Playlist page logic (respects sort; supports drag in Custom mode) =====

// Utility: sort by mode (mirrors base)
function sortTracks(tracks, mode) {
  switch (mode) {
    case 'date_desc':
      return [...tracks].sort((a,b)=>{
        const da=a.date?.getTime()||0, db=b.date?.getTime()||0;
        if (db!==da) return db-da;
        return withinDayIndexFromName(b.name)-withinDayIndexFromName(a.name) || b.name.localeCompare(a.name);
      });
    case 'date_asc':
      return [...tracks].sort((a,b)=>{
        const da=a.date?.getTime()||0, db=b.date?.getTime()||0;
        if (da!==db) return da-db;
        return withinDayIndexFromName(a.name)-withinDayIndexFromName(b.name) || a.name.localeCompare(b.name);
      });
    case 'bpm_desc': return [...tracks].sort((a,b)=> bpmSortValue(b)-bpmSortValue(a));
    case 'bpm_asc':  return [...tracks].sort((a,b)=> bpmSortValue(a)-bpmSortValue(b));
    case 'len_desc': return [...tracks].sort((a,b)=> (b.length||0)-(a.length||0));
    case 'len_asc':  return [...tracks].sort((a,b)=> (a.length||0)-(b.length||0));
    case 'custom':
    default: return tracks; // preserve incoming order
  }
}

// Minimal helpers using base globals
function collectTracksByNames(names) {
  const byName = new Map(state.tracks.map(t => [t.name, t]));
  const out = [];
  for (const n of names) { const t = byName.get(n); if (t) out.push(t); }
  return out;
}
function filterTracksByTokens(tokens) {
  const tok = tokens.map(s => s.toLowerCase());
  return state.tracks.filter(t => matchesSearchTokens(t, tok));
}
function renderRowsInto(container, tracks) {
  if (!tracks.length) {
    container.innerHTML = '<div class="row"><div></div><div>No items.</div></div>';
    return;
  }
  container.innerHTML = tracks.map(t => rowHTML(t, false)).join('');
}

// Enable drag-and-drop reordering in-place
function enableDrag(container, onReorder) {
  let dragEl = null;
  container.querySelectorAll('.row').forEach(row => {
    row.setAttribute('draggable', 'true');

    row.addEventListener('dragstart', e => {
      dragEl = row;
      row.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', row.getAttribute('data-id'));
    });

    row.addEventListener('dragend', () => {
      if (dragEl) dragEl.classList.remove('dragging');
      dragEl = null;
    });

    row.addEventListener('dragover', e => {
      e.preventDefault();
      const over = row;
      if (!dragEl || over === dragEl) return;
      const bounds = over.getBoundingClientRect();
      const before = (e.clientY - bounds.top) < bounds.height / 2;
      over.parentNode.insertBefore(dragEl, before ? over : over.nextSibling);
    });

    row.addEventListener('drop', e => {
      e.preventDefault();
      const newOrderIds = [...container.querySelectorAll('.row')].map(el => +el.getAttribute('data-id'));
      onReorder(newOrderIds);
    });
  });
}

// Main loader, called by base init hook
async function loadPlaylist(rootEl){
  const list = rootEl.querySelector('[data-playlist-list]');
  const input = rootEl.querySelector('#playlistSearch');
  const sortSel = rootEl.querySelector('#playlistSort');
  const dragHint = rootEl.querySelector('#dragHint');

  // Default to current home sort if present
  if (els && els.sort && els.sort.value) sortSel.value = els.sort.value;

  function getFavoritesAsTracks() {
    const favNames = (state.favOrder || []).filter(n => state.favorites.has(n));
    return collectTracksByNames(favNames);
  }

  function renderPlaylist() {
    const q = (input.value || '').trim();
    const tokens = q ? q.split(/\s+/).filter(Boolean) : [];
    const hasHash = tokens.some(t => t.startsWith('#'));
    const mode = sortSel.value;

    let rows = [];
    if (hasHash) {
      // filter across full catalog then sort (ignore 'custom' here)
      rows = filterTracksByTokens(tokens);
      rows = sortTracks(rows, mode === 'custom' ? 'date_desc' : mode);
      dragHint.style.display = 'none';
    } else {
      // favorites only
      rows = getFavoritesAsTracks();
      rows = sortTracks(rows, mode);
      dragHint.style.display = (mode === 'custom' && rows.length > 1) ? 'block' : 'none';
    }

    renderRowsInto(list, rows);

    // clicking a row should play it (handled by base doc-level click)
    // enable drag only for custom/no-hash
    if (!hasHash && mode === 'custom') {
      enableDrag(list, (newOrderIds) => {
        // Map row IDs to track names
        const idToName = new Map(state.tracks.map(t => [t.id, t.name]));
        const domOrderFavs = newOrderIds
          .map(id => idToName.get(id))
          .filter(n => n && state.favorites.has(n));

        // Persist: set favOrder to dragged order first, then append any other saved faves
        const remainder = (state.favOrder || []).filter(n => !domOrderFavs.includes(n));
        state.favOrder = domOrderFavs.concat(remainder);
        localStorage.setItem('vvip25:favOrder', JSON.stringify(state.favOrder));

        // Re-render in case badges/actives need refresh
        renderPlaylist();
      });
    }
  }

  sortSel.addEventListener('change', renderPlaylist);
  input.addEventListener('input', debounce(renderPlaylist, 150));

  // Deep link support: /playlist/?q=#tag
  try {
    const u = new URL(location.href);
    const qParam = u.searchParams.get('q');
    if (qParam) input.value = qParam;
  } catch {}

  renderPlaylist();
}

// Hook into your existing per-page init
(function attachPlaylistInit(){
  const prev = window.initPage;
  window.initPage = function(nextRoot){
    if (typeof prev === 'function') prev(nextRoot);
    if (nextRoot && nextRoot.dataset && nextRoot.dataset.page === 'playlist') {
      loadPlaylist(nextRoot);
    }
  };
})();