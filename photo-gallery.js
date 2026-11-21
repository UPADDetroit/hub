(() => {
  const gallery = document.querySelector('[data-photo-gallery]');
  if (!gallery) return;

  // Paste the published Google Sheets CSV URL here once.
  const sheetUrl = '';
  const backupUrl = '/photo-gallery.csv';

  function parseCsv(csv) {
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;
    csv = csv.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n') + '\n';
    for (let i = 0; i < csv.length; i++) {
      const char = csv[i];
      if (char === '"' && quoted && csv[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (!quoted && (char === ',' || char === '\n')) {
        row.push(cell.trim());
        cell = '';
        if (char === '\n') {
          if (row.some(Boolean)) rows.push(row);
          row = [];
        }
      } else {
        cell += char;
      }
    }
    if (quoted || rows.shift()?.join(',') !== 'Type,Number,Title,URL') {
      throw new Error('Invalid photo sheet');
    }
    return rows;
  }

  async function readRows(url) {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error('Photo sheet unavailable');
    return parseCsv(await response.text());
  }

  function element(tag, text, parent) {
    const node = document.createElement(tag);
    node.textContent = text;
    parent.append(node);
    return node;
  }

  function addLink(container, value, type) {
    const accepted = type === 'google'
      ? ['photos.app.goo.gl', 'photos.google.com']
      : ['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'];
    let url;
    try { url = new URL(value); } catch {}
    if (url?.protocol !== 'https:' || !accepted.includes(url.hostname)) {
      element('p', 'Coming soon', container);
      return;
    }
    const link = element('a', type === 'google' ? 'Open Google Photos album' : 'View on Vimeo', container);
    link.href = url.href;
  }

  function render(rows) {
    gallery.replaceChildren();
    const title = rows.find(([type, , name]) => type === 'event' && name)?.[2];
    if (title) {
      document.querySelector('[data-photo-title]').textContent = title;
      if (!gallery.dataset.programIdPrefix) document.title = title + ' | UPAD';
    }
    for (const [type, , name, url] of rows) {
      if (!['google', 'guest'].includes(type) || !name) continue;
      const section = element('section', '', gallery);
      section.className = 'album';
      element('h2', name, section);
      addLink(section, url, type);
    }
    const programs = rows.filter(([type, number, name]) => type === 'program' && /^[0-9]+$/.test(number) && name)
      .sort((left, right) => Number(left[1]) - Number(right[1]));
    if (!programs.length) return;

    element('h2', 'Photos by Program', gallery);
    const label = element('label', 'Search by program name or number', gallery);
    const input = element('input', '', label);
    input.type = 'search';
    const empty = element('p', 'No matching programs.', gallery);
    empty.setAttribute('role', 'status');
    empty.hidden = true;
    const list = element('ul', '', gallery);
    const prefix = gallery.dataset.programIdPrefix;
    input.id = prefix + 'program-search';
    list.id = prefix + 'programs';
    const used = new Set();
    for (const [, number, name, url] of programs) {
      const displayNumber = String(Number(number)).padStart(2, '0');
      if (used.has(displayNumber)) continue;
      used.add(displayNumber);
      const card = element('li', '', list);
      card.id = prefix + 'program-' + displayNumber;
      const heading = 'Program ' + displayNumber + ' · ' + name;
      element('h3', heading, card);
      card.dataset.search = heading.toLowerCase();
      addLink(card, url, 'program');
    }
    input.addEventListener('input', () => {
      const query = input.value.trim().toLowerCase();
      let found = false;
      for (const card of list.children) {
        card.hidden = !card.dataset.search.includes(query);
        found ||= !card.hidden;
      }
      empty.hidden = found;
    });
    const target = document.getElementById(location.hash.slice(1));
    if (!prefix && target && list.contains(target)) target.scrollIntoView();
  }

  (sheetUrl ? readRows(sheetUrl).catch(() => readRows(backupUrl)) : readRows(backupUrl))
    .then(render)
    .catch(() => { gallery.querySelector('[role="status"]').textContent = 'Photo galleries are temporarily unavailable.'; });
})();
