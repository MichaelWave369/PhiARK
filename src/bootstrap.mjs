import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importDocument } from './vault.mjs';
const folder = join(dirname(fileURLToPath(import.meta.url)), '..', 'starter-guides');
const guides = [
  { file: 'EMERGENCY_INFORMATION_PLAN.md', title: 'Emergency Information Plan', subject: 'survival', safety: 'reference' },
  { file: 'KNOWLEDGE_VERIFICATION.md', title: 'Knowledge Verification Field Notes', subject: 'education', safety: 'general' }
];
for (const item of guides) {
  const result = await importDocument({
    filename: join(folder, item.file), title: item.title, subject: item.subject, safety: item.safety,
    author: 'PhiARK contributors', source: 'https://github.com/MichaelWave369/PhiARK',
    license: 'MIT (original PhiARK starter guide)'
  });
  console.log((result.imported ? 'IMPORTED ' : 'EXISTS   ') + result.entry.title);
}
