import test from 'node:test';
import assert from 'node:assert/strict';
import { filterItems, normalized } from '../src/filter.mjs';

const entries = [
  { title: 'Emergency Information Plan', subject: 'survival', content: 'Meeting places and pets' },
  { title: 'Knowledge Verification', subject: 'education', content: 'Evidence provenance checks' },
  { name: 'Practical Action', subjects: ['water', 'engineering'], summary: 'Water pump design' }
];

test('search works without any service, API or network', () => {
  assert.deepEqual(filterItems(entries, 'pets').map(x => x.title), ['Emergency Information Plan']);
  assert.equal(filterItems(entries, 'water pump', 'water').length, 1);
  assert.equal(filterItems(entries, 'water pump', 'food').length, 0);
  assert.equal(filterItems(entries, 'provenance', 'education').length, 1);
  assert.equal(filterItems(entries, '').length, 3);
});

test('normalized search tolerates case and accents', () => {
  assert.equal(normalized('ÉDUCATION'), 'education');
  assert.equal(filterItems(entries, 'EMERGENCY').length, 1);
});
