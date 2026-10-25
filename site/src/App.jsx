import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight, BookMarked, BookOpen, Check, CheckCircle2,
  ChevronRight, CircleAlert, ClipboardCheck, Compass, ExternalLink, FileCheck2,
  FilePlus2, FileText, Globe2, GraduationCap, HardDrive, HeartPulse, Leaf, LibraryBig,
  LockKeyhole, Radio, Search, Server, ShieldCheck, UploadCloud, Waves, Wrench,
  X, Zap, Sparkles
} from 'lucide-react';
import sourceDirectory from '../../catalog/sources.json';
import emergencyGuide from '../../starter-guides/EMERGENCY_INFORMATION_PLAN.md?raw';
import verificationGuide from '../../starter-guides/KNOWLEDGE_VERIFICATION.md?raw';
import { filterItems } from './filter.mjs';

const SUBJECTS = [
  { id: 'all', label: 'All knowledge', icon: LibraryBig },
  { id: 'survival', label: 'Survival basics', icon: Compass },
  { id: 'water', label: 'Water & sanitation', icon: Waves },
  { id: 'food', label: 'Food & preservation', icon: Leaf },
  { id: 'health', label: 'Health & first aid', icon: HeartPulse },
  { id: 'agriculture', label: 'Agriculture', icon: Leaf },
  { id: 'engineering', label: 'Engineering', icon: Wrench },
  { id: 'energy', label: 'Energy systems', icon: Zap },
  { id: 'communications', label: 'Communications', icon: Radio },
  { id: 'science', label: 'Science', icon: Sparkles },
  { id: 'education', label: 'Education', icon: GraduationCap },
  { id: 'maps', label: 'Mapping', icon: Globe2 },
  { id: 'other', label: 'Other', icon: BookOpen }
];

const SEED = [
  {
    id: 'seed-emergency', title: 'Emergency Information Plan', subject: 'survival',
    author: 'PhiARK contributors', description: 'A calm, practical starting checklist for household readiness, contacts, pets, backup information, and offline testing.',
    content: emergencyGuide, kind: 'bundled', type: 'MARKDOWN', date: '2026',
    safety: 'Educational reference', license: 'MIT (first-party text)'
  },
  {
    id: 'seed-verification', title: 'Knowledge Verification Field Notes', subject: 'education',
    author: 'PhiARK contributors', description: 'Check authorship, dates, independent evidence, safety limits, redistribution rights, and byte integrity before relying on a manual.',
    content: verificationGuide, kind: 'bundled', type: 'MARKDOWN', date: '2026',
    safety: 'Educational reference', license: 'MIT (first-party text)'
  }
];
const SOURCES = sourceDirectory.candidates.map((item, index) => ({
  id: 'source-' + index,
  name: item.name,
  subjects: item.subjects,
  summary: item.role,
  homepage: item.homepage,
  license: item.license,
  integration: item.integration
}));
const MAX_IMPORT_BYTES = 25 * 1024 * 1024;
const MAX_TEXT_BYTES = 2 * 1024 * 1024;
const CHECKS = [
  'Download and install the real local PhiARK server.',
  'Import trustworthy source files with an explicit operator action.',
  'Run SHA-256 verification on the actual stored library.',
  'Disconnect the internet and test reading, search and recovery.'
];

function Label({ children, className = '' }) {
  return <span className={'overline ' + className}>{children}</span>;
}

function DocumentBody({ content }) {
  const lines = content.split(/\r?\n/);
  return <div className="markdown-body">{lines.map((line, i) => {
    const head = /^(#{1,3})\s+(.+)$/.exec(line);
    if (head) {
      if (head[1].length === 1) return <h1 key={i}>{head[2]}</h1>;
      if (head[1].length === 2) return <h2 key={i}>{head[2]}</h2>;
      return <h3 key={i}>{head[2]}</h3>;
    }
    if (line.startsWith('- ')) return <p key={i} className="bullet">• {line.slice(2)}</p>;
    if (/^\d+\.\s/.test(line)) return <p key={i} className="bullet">{line}</p>;
    if (!line.trim()) return <div key={i} className="paragraph-break" aria-hidden="true" />;
    return <p key={i}>{line}</p>;
  })}</div>;
}

function FileBadge({ children, warn = false }) {
  return <span className={'file-badge ' + (warn ? 'muted' : '')}>{children}</span>;
}

export default function App() {
  const [view, setView] = useState('library');
  const [subject, setSubject] = useState('all');
  const [query, setQuery] = useState('');
  const [sessionFiles, setSessionFiles] = useState([]);
  const [activeDocument, setActiveDocument] = useState(null);
  const [error, setError] = useState('');
  const [drag, setDrag] = useState(false);
  const [checks, setChecks] = useState([]);
  const fileInput = useRef(null);
  const objectUrls = useRef([]);

  useEffect(() => () => { for (const url of objectUrls.current) URL.revokeObjectURL(url); }, []);

  const documents = useMemo(() => [...SEED, ...sessionFiles], [sessionFiles]);
  const matches = useMemo(() => filterItems(documents, query, subject), [documents, query, subject]);
  const matchedSources = useMemo(() => filterItems(SOURCES, query, subject), [query, subject]);
  const privateCount = sessionFiles.length;
  const selectedSubject = SUBJECTS.find((entry) => entry.id === subject)?.label || 'All knowledge';

  async function importFiles(incoming) {
    const added = [];
    const failures = [];
    for (const file of Array.from(incoming).slice(0, 12)) {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      if (!['txt', 'md', 'pdf', 'epub'].includes(ext)) {
        failures.push(file.name + ': choose TXT, MD, PDF or EPUB');
        continue;
      }
      if (file.size > MAX_IMPORT_BYTES) {
        failures.push(file.name + ': exceeds 25 MB browser-preview limit');
        continue;
      }
      try {
        const bytes = await file.arrayBuffer();
        const hashBytes = await crypto.subtle.digest('SHA-256', bytes);
        const hash = Array.from(new Uint8Array(hashBytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
        let content = '';
        if (['txt', 'md'].includes(ext) && file.size <= MAX_TEXT_BYTES) {
          content = await file.text();
        }
        added.push({
          id: 'session-' + hash,
          title: file.name,
          author: 'Your browser session',
          description: 'Personal file preview. Never uploaded, never added to the public library. Disappears when this page is closed or refreshed.',
          content,
          subject: 'other',
          kind: 'session',
          type: ext.toUpperCase(),
          size: file.size,
          sha256: hash,
          file,
          license: 'Not provided',
          safety: 'Not reviewed'
        });
      } catch {
        failures.push(file.name + ': browser could not read or hash this file');
      }
    }
    setSessionFiles((before) => {
      const known = new Set(before.map((doc) => doc.id));
      return [...before, ...added.filter((doc) => !known.has(doc.id))];
    });
    setError(failures.join('. '));
    if (added.length) {
      setView('library');
      setSubject('all');
      setQuery('');
    }
  }

  function fileDrop(event) {
    event.preventDefault();
    setDrag(false);
    importFiles(event.dataTransfer.files);
  }

  function openDocument(document) {
    if (document.kind === 'session' && !document.content) {
      const objectUrl = URL.createObjectURL(document.file);
      objectUrls.current.push(objectUrl);
      if (document.type === 'PDF') {
        // Browser PDF viewing is intentionally delegated to the built-in viewer.
        window.open(objectUrl, '_blank', 'noopener,noreferrer');
      } else {
        const link = window.document.createElement('a');
        link.href = objectUrl;
        link.download = document.title;
        window.document.body.append(link);
        link.click();
        link.remove();
      }
      return;
    }
    setActiveDocument(document);
  }

  function switchTo(next) {
    setView(next);
    setSubject('all');
    setQuery('');
    setError('');
  }

  return <div className="application">
    <aside className="sidebar">
      <a className="brand" href="https://github.com/MichaelWave369/PhiARK" target="_blank" rel="noreferrer">
        <div className="brand-icon">Φ</div>
        <div><strong>PhiARK</strong><small>THE KNOWLEDGE VAULT</small></div>
      </a>
      <div className="sidebar-main">
        <Label>WORKSPACE</Label>
        <button className={'nav-item ' + (view === 'library' ? 'selected' : '')} onClick={() => switchTo('library')}><BookOpen size={17}/> Library <ChevronRight size={15} className="nav-end" /></button>
        <button className={'nav-item ' + (view === 'sources' ? 'selected' : '')} onClick={() => switchTo('sources')}><Globe2 size={17}/> Source directory <ChevronRight size={15} className="nav-end" /></button>
        <button className={'nav-item ' + (view === 'readiness' ? 'selected' : '')} onClick={() => switchTo('readiness')}><ClipboardCheck size={17}/> Offline readiness <ChevronRight size={15} className="nav-end" /></button>

        {view !== 'readiness' && <>
          <div className="sidebar-divider" />
          <Label>TOPICS</Label>
          <div className="category-nav">{SUBJECTS.map((item) => {
            const Icon = item.icon;
            return <button key={item.id} className={'category-item ' + (subject === item.id ? 'active' : '')} onClick={() => setSubject(item.id)}><Icon size={15}/><span>{item.label}</span></button>;
          })}</div>
        </>}
      </div>
      <div className="sidebar-bottom">
        <div className="sidebar-status"><span className="status-dot" /> PUBLIC SHOWCASE</div>
        <p>Real offline documents live in your private PhiARK installation, not on GitHub Pages.</p>
        <a href="https://github.com/MichaelWave369/PhiARK" target="_blank" rel="noreferrer">VIEW ON GITHUB <ArrowRight size={13}/></a>
      </div>
    </aside>
    <div className="content-area">
      <header className="topbar">
        <div className="crumb"><span>Φ ECOSYSTEM</span><ChevronRight size={14}/><strong>KNOWLEDGE VAULT</strong></div>
        <div className="top-actions">
          <span className="mode-tag"><span className="status-dot"/> DEMO MODE</span>
          <a className="top-github" href="https://github.com/MichaelWave369/PhiARK" target="_blank" rel="noreferrer">SOURCE CODE <ExternalLink size={13}/></a>
        </div>
      </header>

      <main className="page-body">
        <section className="hero">
          <div className="hero-glow" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orb-mark">Φ</div></div>
          <div className="hero-content">
            <div className="hero-eyebrow"><span className="tiny-star">✦</span> AUTONOMOUS RESILIENCE & KNOWLEDGE <span className="hero-edition">R0.2 · REACT SHOWCASE</span></div>
            <h1>Keep the knowledge.<br/><em>Keep the future.</em></h1>
            <p>When the signal disappears, understanding shouldn't. Explore an honest preview of PhiARK, a source-aware, local-first library for PhiOS.</p>
            <div className="hero-buttons">
              <button className="primary-btn" onClick={() => { switchTo('library'); document.getElementById('workspace')?.scrollIntoView({ behavior: 'smooth' }); }}><BookOpen size={17}/> Browse library <ArrowRight size={17}/></button>
              <button className="secondary-btn" onClick={() => switchTo('readiness')}><ShieldCheck size={17}/> How offline works</button>
            </div>
          </div>
        </section>

        <div className="metrics">
          <div className="metric"><span className="metric-icon"><BookMarked size={18}/></span><div><Label>BUNDLED READS</Label><strong>{SEED.length.toString().padStart(2, '0')}</strong><small>Original, publicly included</small></div></div>
          <div className="metric"><span className="metric-icon"><Globe2 size={18}/></span><div><Label>SOURCE LEADS</Label><strong>{SOURCES.length.toString().padStart(2, '0')}</strong><small>Not downloaded or verified</small></div></div>
          <div className="metric"><span className="metric-icon"><LockKeyhole size={18}/></span><div><Label>PRIVATE FILES ONLINE</Label><strong>00</strong><small>{privateCount} temporary browser preview{privateCount === 1 ? '' : 's'}</small></div></div>
        </div>

        <div className="privacy-banner"><div className="banner-icon"><ShieldCheck size={20}/></div><div><strong>Public demonstration, private by design.</strong><p>This site includes two open starter guides and a directory of research leads. It cannot access your PhiOS server or upload your documents. Browser-selected files stay in memory for this session only.</p></div><FileCheck2 size={21} className="banner-end"/></div>

        <section className="workspace" id="workspace">
          <div className="workspace-top">
            <div><Label>YOUR KNOWLEDGE / IN REACH</Label><h2>{view === 'library' ? 'Explore the library' : view === 'sources' ? 'Source directory' : 'Offline readiness'}</h2><p className="section-copy">{view === 'library' ? 'These are real bundled reading files, plus any files you temporarily open here.' : view === 'sources' ? 'External candidates to research and license-check before downloading to your local vault.' : 'An operator checklist. Ticking a box is not proof that your hardware has passed a disconnected test.'}</p></div>
            {view === 'library' && <button className="import-btn" onClick={() => fileInput.current?.click()}><FilePlus2 size={17}/> Preview a local file</button>}
          </div>
          <input ref={fileInput} type="file" multiple accept=".txt,.md,.pdf,.epub" className="hidden-input" onChange={(event) => { importFiles(event.target.files); event.target.value = ''; }} aria-label="Choose local documents to preview in this browser session" />
          {view !== 'readiness' && <div className="toolbar"><div className="input-shell"><Search size={17}/><input type="search" aria-label="Search library" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={view === 'library' ? 'Search documents, topics or text…' : 'Search organizations and research areas…'}/>{query && <button title="Clear search" onClick={() => setQuery('')}><X size={15}/></button>}</div><span className="filter-pill">{selectedSubject}</span></div>}
          {error && <div className="error-message" role="alert"><CircleAlert size={17}/>{error}</div>}

          {view === 'library' && <>
            <div className="list-heading"><strong>{matches.length} documents</strong><span>2 bundled · {privateCount} temporary preview{privateCount === 1 ? '' : 's'}</span></div>
            <div className="card-grid">
              {matches.map((item) => <article className="doc-card" key={item.id}>
                <div className="card-top"><span className={'doc-icon ' + (item.kind === 'session' ? 'session' : '')}><FileText size={21}/></span><span className="category-tag">{SUBJECTS.find(s => s.id === item.subject)?.label || 'Other'}</span></div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                <div className="card-badges"><FileBadge>{item.type}</FileBadge><FileBadge warn>{item.kind === 'session' ? 'SESSION ONLY' : 'FIRST-PARTY'}</FileBadge></div>
                <div className="card-bottom"><span><CheckCircle2 size={14}/>{item.kind === 'session' ? 'In browser memory' : 'Bundled text'}</span><button onClick={() => openDocument(item)}>{item.kind === 'session' && !item.content ? 'Open file' : 'Read guide'}<ArrowRight size={16}/></button></div>
              </article>)}
            </div>
            {matches.length === 0 && <div className="empty-state"><Search size={30}/><h3>No matching documents</h3><p>Try another search or switch topics. External source leads are listed separately.</p><button onClick={() => { setQuery(''); setSubject('all'); }}>Clear filters</button></div>}
            <div className={'upload-zone ' + (drag ? 'dragging' : '')} onDragOver={(event) => { event.preventDefault(); setDrag(true); }} onDragLeave={(event) => { event.preventDefault(); setDrag(false); }} onDrop={fileDrop}>
              <span className="upload-icon"><UploadCloud size={24}/></span>
              <div><strong>Curious how your own files would look?</strong><p>Drop TXT, MD, PDF or EPUB files here, or pick them above. Max 25 MB each. Preview only: no saving, syncing or publishing.</p></div>
            </div>
          </>}

          {view === 'sources' && <>
            <div className="list-heading"><strong>{matchedSources.length} source leads</strong><span>External links · Requires internet to visit</span></div>
            <div className="source-list">{matchedSources.map((item) => <article className="source-card" key={item.id}><span className="source-icon"><Globe2 size={21}/></span><div className="source-details"><div className="source-title"><h3>{item.name}</h3><FileBadge warn>CANDIDATE ONLY</FileBadge></div><p>{item.summary}</p><small>Rights: {item.license}</small><div className="source-subjects">{item.subjects.map(s => <span key={s}>{s}</span>)}</div></div><a href={item.homepage} target="_blank" rel="noopener noreferrer" aria-label={'Visit ' + item.name + ' (external website)'}>VISIT SITE <ExternalLink size={15}/></a></article>)}</div>
            {matchedSources.length === 0 && <div className="empty-state"><Search size={30}/><h3>No source leads found</h3><p>Try another topic or search phrase.</p></div>}
            <div className="source-note"><CircleAlert size={18}/><p>A link here is not a downloaded document, license grant, safety endorsement, or proof of independent verification.</p></div>
          </>}

          {view === 'readiness' && <div className="readiness-grid">
            <div className="readiness-panel"><div className="readiness-top"><span className="round-icon"><ClipboardCheck size={24}/></span><span className="readiness-score">{checks.length} / {CHECKS.length}</span></div><h3>Your offline checklist</h3><p>Mark tasks yourself as you verify them. These boxes do not test your local PhiOS environment or store evidence.</p><div className="check-list">{CHECKS.map((item, index) => <label key={item}><input type="checkbox" checked={checks.includes(index)} onChange={() => setChecks((old) => old.includes(index) ? old.filter(x => x !== index) : [...old, index])}/><span className="custom-check">{checks.includes(index) ? <Check size={14}/> : null}</span>{item}</label>)}</div><p className="readiness-disclaimer">Self-reported only · resets when this page reloads</p></div>
            <div className="architecture-panel"><Label>THE ACTUAL TOPOLOGY</Label><h3>One library.<br/>Two distinct worlds.</h3><div className="architecture-steps"><div><span><Globe2 size={19}/></span><p><strong>Public GitHub Pages</strong><small>React showcase, sample guides, optional browser-only previews</small></p></div><div className="step-down">↓</div><div><span><Server size={19}/></span><p><strong>PhiOS + local PhiARK</strong><small>Private content-addressed document storage, search and SHA-256 verification</small></p></div><div className="step-down">↓</div><div><span><HardDrive size={19}/></span><p><strong>Future PhiPie / removable media</strong><small>Separate hardware testing, verified copy and bootable operating-system image</small></p></div></div></div>
          </div>}
        </section>
        <section className="bottom-panel"><div><Label>BUILT FOR THE LONG HAUL</Label><h2>Knowledge should outlive<br/><em>the connection.</em></h2><p>PhiARK is part of the PhiOS ecosystem. Download the open-source local runtime when you have internet, then use and verify your own collection offline.</p><a href="https://github.com/MichaelWave369/PhiARK" target="_blank" rel="noreferrer">EXPLORE PHIARK ON GITHUB <ArrowRight size={16}/></a></div><div className="bottom-orbit" aria-hidden="true"><BookOpen size={83} strokeWidth={1}/></div></section>
        <footer><span>Φ PhiARK / AUTONOMOUS RESILIENCE & KNOWLEDGE</span><span>LOCAL-FIRST · EVIDENCE-AWARE · NO FALSE CLAIMS</span></footer>
      </main>
    </div>
    {activeDocument && <div className="reader-backdrop" role="presentation" onMouseDown={() => setActiveDocument(null)}><section className="reader" role="dialog" aria-modal="true" aria-labelledby="reader-title" onMouseDown={(e) => e.stopPropagation()}><header><div><Label>{activeDocument.kind === 'bundled' ? 'FIRST-PARTY STARTER GUIDE' : 'SESSION-ONLY PERSONAL PREVIEW'}</Label><h2 id="reader-title">{activeDocument.title}</h2></div><button className="reader-close" aria-label="Close reader" onClick={() => setActiveDocument(null)}><X size={21}/></button></header><div className="reader-meta"><span><FileText size={14}/>{activeDocument.type}</span><span><ShieldCheck size={14}/>{activeDocument.safety}</span><span>{activeDocument.license}</span></div><div className="reader-content"><DocumentBody content={activeDocument.content || 'Text preview unavailable for this large file.'}/></div><div className="reader-foot"><span>{activeDocument.kind === 'session' ? 'Loaded only into this browser session. Not transmitted to PhiARK or GitHub.' : 'Original PhiARK educational text. Not a certified safety guide.'}</span><button onClick={() => setActiveDocument(null)}>Close guide <Check size={15}/></button></div></section></div>}
  </div>;
}
