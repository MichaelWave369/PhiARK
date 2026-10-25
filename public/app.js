const search = document.querySelector('#search');
const resultBox = document.querySelector('#results');
const notice = document.querySelector('#notice');
const total = document.querySelector('#total');
const counter = document.querySelector('#result-count');
const state = document.querySelector('#library-state');
const connection = document.querySelector('#connection');
const label = document.querySelector('#filter-label');
const categories = document.querySelector('#categories');
let subject = 'all';
let token = 0;
const names = { all: 'All categories', survival: 'Survival', water: 'Water & sanitation', food: 'Food preservation', health: 'Health', agriculture: 'Agriculture', engineering: 'Engineering', energy: 'Energy', communications: 'Communications', science: 'Science', education: 'Education', maps: 'Maps', other: 'Other' };

function line(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text || '';
  return element;
}
function render(entries) {
  resultBox.replaceChildren();
  counter.textContent = String(entries.length);
  notice.hidden = entries.length > 0;
  if (!entries.length) notice.textContent = search.value || subject !== 'all'
    ? 'No matching local documents. Change the search or category.'
    : 'No documents are installed yet. This is an empty local vault, not a downloaded survival collection. Import trusted .txt, .md, .pdf, or .epub files using the PhiARK CLI.';
  for (const item of entries) {
    const article = line('article', 'document');
    const left = line('div');
    left.append(line('div', 'tag', (names[item.subject] || 'Other') + '  ·  ' + item.extension.slice(1).toUpperCase()));
    left.append(line('h3', '', item.title));
    if (item.excerpt) left.append(line('p', '', item.excerpt));
    left.append(line('p', 'meta', (item.author || 'Author not recorded') + ' · ' + (item.license || 'License not recorded') + ' · Review: ' + item.reviewStatus));
    if (item.sourceUrl) left.append(line('p', 'meta', 'Source: ' + item.sourceUrl));
    const link = line('a', '', 'Open local file');
    link.href = '/documents/' + item.id;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    article.append(left, link);
    resultBox.append(article);
  }
}
async function refresh() {
  const myToken = ++token;
  try {
    const [statusResponse, matchesResponse] = await Promise.all([
      fetch('/api/status', { cache: 'no-store' }),
      fetch('/api/search?q=' + encodeURIComponent(search.value) + '&subject=' + encodeURIComponent(subject), { cache: 'no-store' })
    ]);
    if (!statusResponse.ok || !matchesResponse.ok) throw new Error('Local library unavailable');
    const status = await statusResponse.json();
    const entries = await matchesResponse.json();
    if (myToken !== token) return;
    total.textContent = String(status.documents);
    state.textContent = 'LOCAL';
    connection.textContent = '● LOCAL CONNECTION';
    render(entries);
  } catch {
    if (myToken !== token) return;
    connection.textContent = 'LOCAL SERVER UNAVAILABLE';
    state.textContent = 'Offline';
    notice.hidden = false;
    notice.textContent = 'The local library service could not be reached. Start it with npm start; no external service is contacted.';
    resultBox.replaceChildren();
  }
}
search.addEventListener('input', refresh);
categories.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-subject]');
  if (!button) return;
  subject = button.dataset.subject;
  for (const b of categories.querySelectorAll('button')) b.classList.toggle('active', b === button);
  label.textContent = names[subject];
  refresh();
});
refresh();

async function refreshKiwixShelf() {
  const box = document.querySelector('#kiwix-results');
  const count = document.querySelector('#kiwix-count');
  const message = document.querySelector('#kiwix-notice');
  try {
    const response = await fetch('/api/kiwix', { cache: 'no-store' });
    if (!response.ok) throw new Error('Archive inventory unavailable');
    const data = await response.json();
    const verified = data.rows.filter(x => x.status === 'CHECKSUM_MATCHED');
    count.textContent = verified.length + ' / ' + data.rows.length + ' byte-verified';
    box.replaceChildren();
    message.hidden = true;
    for (const entry of data.rows) {
      const article = line('article', 'document kiwix-item');
      const left = line('div');
      left.append(line('div', 'tag', entry.status.replaceAll('_', ' ')));
      left.append(line('h3', '', entry.title));
      left.append(line('p', 'meta', entry.filename + ' · ' + (entry.bytes ? (entry.bytes / 1024 / 1024).toFixed(1) + ' MiB' : 'not present')));
      if (entry.reason) left.append(line('p', 'meta', 'Check failure: ' + entry.reason));
      article.append(left);
      box.append(article);
    }
  } catch {
    count.textContent = 'Inventory unavailable';
    message.hidden = false;
    message.textContent = 'Local archive inventory could not be read. This is not proof that any archive is installed.';
    box.replaceChildren();
  }
}
refreshKiwixShelf();
