export function normalized(input) {
  return String(input ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
}

export function filterItems(items, query = '', subject = 'all') {
  const terms = normalized(query).trim().split(/\s+/).filter(Boolean);
  return items.filter((item) => {
    const subjects = Array.isArray(item.subjects)
      ? item.subjects : [item.subject || 'other'];
    if (subject !== 'all' && !subjects.includes(subject)) return false;
    const haystack = normalized([
      item.title, item.name, item.author, item.description, item.summary,
      item.sourceUrl, item.homepage, item.content, subjects.join(' ')
    ].join(' '));
    return terms.every((term) => haystack.includes(term));
  });
}
