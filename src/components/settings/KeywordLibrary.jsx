/* eslint-disable */
import React, { useState, useMemo } from 'react';
import { SECTION_KEYWORDS } from '../../data/sectionKeywords.js';
import { DEFAULT_SETTINGS } from '../../utils/storage.js';

/* ─── Section metadata ─────────────────────────────────────────────── */
const SECTION_META = {
  world:         { icon: '🌍', label: 'World',         color: '#3b82f6', desc: 'Global news & geopolitics' },
  india:         { icon: '🇮🇳', label: 'India',         color: '#f97316', desc: 'National politics & events' },
  chennai:       { icon: '🏙️', label: 'Chennai',       color: '#ec4899', desc: 'Chennai city news' },
  trichy:        { icon: '🏛️', label: 'Trichy',        color: '#8b5cf6', desc: 'Trichy district news' },
  business:      { icon: '💹', label: 'Business',      color: '#10b981', desc: 'Economy, markets & finance' },
  technology:    { icon: '💻', label: 'Technology',    color: '#06b6d4', desc: 'Tech, AI & startups' },
  entertainment: { icon: '🎬', label: 'Entertainment', color: '#f59e0b', desc: 'Movies, music & celebs' },
  sports:        { icon: '⚽', label: 'Sports',        color: '#84cc16', desc: 'Cricket, football & more' },
};

const BUZZ_REGION_META = {
  tamil:     { icon: '🎭', label: 'Tamil',     color: '#e11d48', desc: 'Kollywood & Tamil cinema' },
  hindi:     { icon: '🎪', label: 'Hindi',     color: '#f97316', desc: 'Bollywood & Hindi cinema' },
  hollywood: { icon: '🎬', label: 'Hollywood', color: '#eab308', desc: 'Hollywood & international' },
  ott:       { icon: '📺', label: 'OTT',       color: '#7c3aed', desc: 'Streaming platforms' },
};

/* ─── Keyword chip ─────────────────────────────────────────────────── */
function Chip({ keyword, isUser, onRemove, highlight }) {
  const base = isUser
    ? { bg: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.45)', text: '#c4b5fd' }
    : { bg: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', text: 'var(--text-secondary)' };
  const hiStyle = highlight ? { background: 'rgba(251,191,36,0.2)', border: '1px solid rgba(251,191,36,0.5)', color: '#fde68a' } : {};

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '3px',
      padding: '2px 8px', borderRadius: '20px', fontSize: '0.71rem',
      background: base.bg, border: base.border, color: base.text,
      margin: '2px', transition: 'opacity 0.15s', whiteSpace: 'nowrap',
      ...hiStyle,
    }}>
      {isUser && <span style={{ fontSize: '0.58rem', opacity: 0.7, marginRight: '1px' }}>+</span>}
      {keyword}
      {onRemove && (
        <button onClick={() => onRemove(keyword)} style={{
          background: 'none', border: 'none', color: '#f87171', cursor: 'pointer',
          padding: '0 0 0 2px', fontSize: '0.72rem', lineHeight: 1,
          display: 'flex', alignItems: 'center',
        }}>×</button>
      )}
    </span>
  );
}

/* ─── Inline add row ───────────────────────────────────────────────── */
function AddRow({ color, placeholder, onAdd }) {
  const [val, setVal] = useState('');
  const submit = () => {
    const v = val.trim();
    if (!v) return;
    onAdd(v);
    setVal('');
  };
  return (
    <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
      <input
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
        placeholder={placeholder}
        style={{
          flex: 1, background: 'rgba(0,0,0,0.3)', border: `1px solid ${color}44`,
          borderRadius: '8px', padding: '6px 11px', color: 'var(--text-primary)',
          fontSize: '0.8rem', outline: 'none',
        }}
      />
      <button onClick={submit} style={{
        background: color, border: 'none', borderRadius: '8px',
        color: '#fff', padding: '6px 14px', cursor: 'pointer',
        fontSize: '0.8rem', fontWeight: 700, flexShrink: 0,
      }}>+ Add</button>
    </div>
  );
}

/* ─── Section card ─────────────────────────────────────────────────── */
function SectionCard({ sectionId, meta, defaultKws, userKws, onAdd, onRemove, searchQuery }) {
  const [open, setOpen] = useState(false);

  const allKws = useMemo(() => [...new Set([...defaultKws, ...userKws])], [defaultKws, userKws]);
  const filtered = useMemo(() => {
    if (!searchQuery) return allKws;
    return allKws.filter(k => k.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [allKws, searchQuery]);

  const isUser = kw => userKws.some(u => u.toLowerCase() === kw.toLowerCase());
  const shouldOpen = open || (searchQuery && filtered.length > 0);

  // Preview — first 5 default chips shown even when collapsed
  const preview = allKws.slice(0, 6);

  return (
    <div style={{
      background: 'rgba(255,255,255,0.025)',
      border: `1px solid ${shouldOpen ? meta.color + '55' : 'rgba(255,255,255,0.07)'}`,
      borderRadius: '10px', overflow: 'hidden', transition: 'border-color 0.2s',
      flexShrink: 0,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', cursor: 'pointer' }}
        onClick={() => setOpen(v => !v)}>
        <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{meta.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.85rem' }}>{meta.label}</span>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{meta.desc}</span>
            {/* Preview chips — shown only when collapsed */}
            {!shouldOpen && preview.map(kw => (
              <Chip key={kw} keyword={kw} isUser={isUser(kw)}
                onRemove={isUser(kw) ? () => onRemove(sectionId, kw) : null} />
            ))}
            {!shouldOpen && allKws.length > 6 && (
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                +{allKws.length - 6} more…
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {userKws.length > 0 && (
            <span style={{
              background: meta.color + '30', color: meta.color,
              border: `1px solid ${meta.color}50`, borderRadius: '10px',
              padding: '1px 7px', fontSize: '0.65rem', fontWeight: 700,
            }}>+{userKws.length}</span>
          )}
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.07)', borderRadius: '8px', padding: '1px 7px' }}>
            {allKws.length}
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', transform: shouldOpen ? 'rotate(90deg)' : '', transition: 'transform 0.18s' }}>▶</span>
        </div>
      </div>

      {/* Expanded body */}
      {shouldOpen && (
        <div style={{ padding: '0 14px 12px 14px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {/* Wiring status pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '8px 0 6px 0' }}>
            <span style={{
              background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.3)',
              color: '#34d399', borderRadius: '8px', padding: '2px 9px', fontSize: '0.65rem', fontWeight: 600,
            }}>✓ Wired to section classifier</span>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Keywords are additive — built-ins always apply</span>
          </div>

          {/* All chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', marginBottom: '4px' }}>
            {filtered.map(kw => (
              <Chip key={kw}
                keyword={kw}
                isUser={isUser(kw)}
                highlight={!!searchQuery}
                onRemove={isUser(kw) ? () => onRemove(sectionId, kw) : null}
              />
            ))}
            {filtered.length === 0 && (
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', padding: '4px' }}>
                No matches for "{searchQuery}"
              </span>
            )}
          </div>
          <AddRow
            color={meta.color}
            placeholder={`Add ${meta.label} keyword… (Enter to confirm)`}
            onAdd={kw => onAdd(sectionId, kw)}
          />
        </div>
      )}
    </div>
  );
}

/* ─── Buzz region card ─────────────────────────────────────────────── */
function BuzzCard({ regionId, meta, defaultKws, userKws, onAdd, onRemove, searchQuery }) {
  const [open, setOpen] = useState(false);

  const allKws = useMemo(() => [...new Set([...defaultKws, ...userKws])], [defaultKws, userKws]);
  const filtered = useMemo(() => {
    if (!searchQuery) return allKws;
    return allKws.filter(k => k.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [allKws, searchQuery]);

  const isUser = kw => userKws.some(u => u.toLowerCase() === kw.toLowerCase());
  const shouldOpen = open || (searchQuery && filtered.length > 0);
  const preview = allKws.slice(0, 5);

  return (
    <div style={{
      background: 'rgba(255,255,255,0.025)',
      border: `1px solid ${shouldOpen ? meta.color + '55' : 'rgba(255,255,255,0.07)'}`,
      borderRadius: '10px', overflow: 'hidden', transition: 'border-color 0.2s',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', cursor: 'pointer' }}
        onClick={() => setOpen(v => !v)}>
        <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{meta.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.85rem' }}>{meta.label}</span>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{meta.desc}</span>
            {!shouldOpen && preview.map(kw => (
              <Chip key={kw} keyword={kw} isUser={isUser(kw)}
                onRemove={isUser(kw) ? () => onRemove(regionId, kw) : null} />
            ))}
            {!shouldOpen && allKws.length > 5 && (
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>+{allKws.length - 5} more…</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
          {userKws.length > 0 && (
            <span style={{ background: meta.color + '30', color: meta.color, border: `1px solid ${meta.color}50`, borderRadius: '10px', padding: '1px 7px', fontSize: '0.65rem', fontWeight: 700 }}>+{userKws.length}</span>
          )}
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.07)', borderRadius: '8px', padding: '1px 7px' }}>{allKws.length}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', transform: shouldOpen ? 'rotate(90deg)' : '', transition: 'transform 0.18s' }}>▶</span>
        </div>
      </div>

      {shouldOpen && (
        <div style={{ padding: '0 14px 12px 14px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '8px 0 6px 0' }}>
            <span style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.3)', color: '#34d399', borderRadius: '8px', padding: '2px 9px', fontSize: '0.65rem', fontWeight: 600 }}>✓ Wired to Buzz tab classifier</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', marginBottom: '4px' }}>
            {filtered.map(kw => (
              <Chip key={kw} keyword={kw} isUser={isUser(kw)} highlight={!!searchQuery}
                onRemove={isUser(kw) ? () => onRemove(regionId, kw) : null} />
            ))}
          </div>
          <AddRow color={meta.color} placeholder={`Add ${meta.label} keyword…`} onAdd={kw => onAdd(regionId, kw)} />
        </div>
      )}
    </div>
  );
}

/* ─── Export / Import ─────────────────────────────────────────────── */
function exportKeywords(settings) {
  const pack = {
    version: 1,
    exported: new Date().toISOString(),
    sectionKeywords: settings.sectionKeywords || {},
    buzzRegionKeywords: settings.buzzRegionKeywords || {},
  };
  const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `keyword-library-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

/* ─── Count only *real* user additions (not defaults re-stored in settings) ── */
function countRealUserAdditions(settings) {
  // Section keywords: anything in settings.sectionKeywords is user-added (defaults aren't stored there)
  const sectionCount = Object.values(settings.sectionKeywords || {})
    .reduce((s, arr) => s + (Array.isArray(arr) ? arr.length : 0), 0);

  // Buzz keywords: diff settings.buzzRegionKeywords against DEFAULT_SETTINGS.buzzRegionKeywords
  let buzzCount = 0;
  const defaultBuzz = DEFAULT_SETTINGS.buzzRegionKeywords || {};
  const userBuzz = settings.buzzRegionKeywords || {};
  Object.entries(userBuzz).forEach(([region, list]) => {
    if (!Array.isArray(list)) return;
    const defaults = new Set((defaultBuzz[region] || []).map(k => k.toLowerCase()));
    buzzCount += list.filter(k => !defaults.has(k.toLowerCase())).length;
  });

  return sectionCount + buzzCount;
}

/* ─── Main ─────────────────────────────────────────────────────────── */
export default function KeywordLibrary({ settings, updateNested }) {
  const [search, setSearch] = useState('');
  const [activeGroup, setActiveGroup] = useState('sections');
  const [importError, setImportError] = useState(null);
  const [importSuccess, setImportSuccess] = useState(false);

  /* ── Helpers ── */
  const getSectionUserKws = sid => {
    const l = settings.sectionKeywords?.[sid];
    return Array.isArray(l) ? l : [];
  };

  const getStrictBuzzUserKws = rid => {
    // Only items the user actually added (not re-stored defaults)
    const defaults = new Set((DEFAULT_SETTINGS.buzzRegionKeywords?.[rid] || []).map(k => k.toLowerCase()));
    const list = settings.buzzRegionKeywords?.[rid];
    if (!Array.isArray(list)) return [];
    return list.filter(k => !defaults.has(k.toLowerCase()));
  };

  const getBuzzDefaultKws = rid => DEFAULT_SETTINGS.buzzRegionKeywords?.[rid] || [];

  const handleSectionAdd = (sid, kw) => {
    const current = getSectionUserKws(sid);
    const built = SECTION_KEYWORDS[sid] || [];
    const kwL = kw.trim();
    if (!kwL) return;
    if (current.some(k => k.toLowerCase() === kwL.toLowerCase())) return;
    if (built.some(k => k.toLowerCase() === kwL.toLowerCase())) return;
    updateNested(`sectionKeywords.${sid}`, [...current, kwL]);
  };

  const handleSectionRemove = (sid, kw) => {
    updateNested(`sectionKeywords.${sid}`, getSectionUserKws(sid).filter(k => k !== kw));
  };

  const handleBuzzAdd = (rid, kw) => {
    const kwL = kw.trim().toLowerCase();
    if (!kwL) return;
    const current = getStrictBuzzUserKws(rid);
    const defaults = getBuzzDefaultKws(rid);
    if (current.some(k => k === kwL)) return;
    if (defaults.some(k => k.toLowerCase() === kwL)) return;
    updateNested(`buzzRegionKeywords.${rid}`, [...(settings.buzzRegionKeywords?.[rid] || defaults), kwL]);
  };

  const handleBuzzRemove = (rid, kw) => {
    const list = settings.buzzRegionKeywords?.[rid] || getBuzzDefaultKws(rid);
    updateNested(`buzzRegionKeywords.${rid}`, list.filter(k => k !== kw));
  };

  const handleImport = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const pack = JSON.parse(ev.target.result);
        if (pack.version !== 1 || typeof pack.sectionKeywords !== 'object') {
          setImportError('Invalid keyword pack format.'); return;
        }
        Object.entries(pack.sectionKeywords).forEach(([sec, kws]) => {
          if (!Array.isArray(kws)) return;
          const cur = getSectionUserKws(sec);
          updateNested(`sectionKeywords.${sec}`, [...new Set([...cur, ...kws])]);
        });
        if (pack.buzzRegionKeywords) {
          Object.entries(pack.buzzRegionKeywords).forEach(([rid, kws]) => {
            if (!Array.isArray(kws)) return;
            const cur = settings.buzzRegionKeywords?.[rid] || getBuzzDefaultKws(rid);
            updateNested(`buzzRegionKeywords.${rid}`, [...new Set([...cur, ...kws])]);
          });
        }
        setImportSuccess(true);
        setTimeout(() => setImportSuccess(false), 2500);
        setImportError(null);
      } catch { setImportError('Could not parse file.'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleResetAll = () => {
    if (!window.confirm('Clear all your custom keyword additions? Built-in defaults are unaffected.')) return;
    updateNested('sectionKeywords', {});
    updateNested('buzzRegionKeywords', {});
  };

  /* ── Stats (corrected) ── */
  const totalBuiltIn = useMemo(() =>
    Object.values(SECTION_KEYWORDS).reduce((s, a) => s + a.length, 0)
    + Object.values(DEFAULT_SETTINGS.buzzRegionKeywords || {}).reduce((s, a) => s + a.length, 0),
    []);

  const totalUserAdditions = useMemo(() => countRealUserAdditions(settings), [settings]);

  /* ── Search ── */
  const searchLower = search.toLowerCase();

  const sectionMatchCounts = useMemo(() => {
    if (!search) return {};
    const counts = {};
    Object.entries(SECTION_KEYWORDS).forEach(([sec, defs]) => {
      const all = [...new Set([...defs, ...getSectionUserKws(sec)])];
      counts[sec] = all.filter(k => k.toLowerCase().includes(searchLower)).length;
    });
    return counts;
  }, [search, settings.sectionKeywords]);

  const buzzMatchCounts = useMemo(() => {
    if (!search) return {};
    const counts = {};
    Object.keys(BUZZ_REGION_META).forEach(rid => {
      const all = [...new Set([...getBuzzDefaultKws(rid), ...getStrictBuzzUserKws(rid)])];
      counts[rid] = all.filter(k => k.toLowerCase().includes(searchLower)).length;
    });
    return counts;
  }, [search, settings.buzzRegionKeywords]);

  const totalMatches = useMemo(() =>
    Object.values(sectionMatchCounts).reduce((a, b) => a + b, 0)
    + Object.values(buzzMatchCounts).reduce((a, b) => a + b, 0),
    [sectionMatchCounts, buzzMatchCounts]);

  /* ── Render ── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', gap: '10px' }}>

      {/* ── Top stats strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px', flexShrink: 0 }}>
        {[
          { icon: '📚', value: totalBuiltIn, label: 'Built-in',    color: 'var(--text-secondary)' },
          { icon: '✏️',  value: totalUserAdditions, label: 'Your Additions', color: '#a5b4fc' },
          { icon: '🔢', value: totalBuiltIn + totalUserAdditions, label: 'Total', color: '#34d399' },
          { icon: '📂', value: Object.keys(SECTION_META).length + Object.keys(BUZZ_REGION_META).length, label: 'Categories', color: '#fbbf24' },
        ].map(s => (
          <div key={s.label} style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '10px', padding: '8px 12px', textAlign: 'center',
          }}>
            <div style={{ fontSize: '0.85rem' }}>{s.icon}</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: s.color, lineHeight: 1.2 }}>{s.value}</div>
            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '2px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', gap: '7px', flexShrink: 0, flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{ flex: 1, minWidth: '160px', position: 'relative' }}>
          <span style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.82rem', pointerEvents: 'none', opacity: 0.5 }}>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search all keywords…"
            style={{
              width: '100%', paddingLeft: '28px', paddingRight: search ? '60px' : '10px',
              paddingTop: '7px', paddingBottom: '7px',
              background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box',
            }}
          />
          {search && (
            <span style={{ position: 'absolute', right: '9px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.68rem', color: totalMatches > 0 ? '#34d399' : '#f87171', fontWeight: 600 }}>
              {totalMatches} hit{totalMatches !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Group toggle pills */}
        <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '3px', gap: '3px' }}>
          {[
            { id: 'sections', label: '📰 Sections' },
            { id: 'buzz', label: '⚡ Buzz' },
          ].map(g => (
            <button key={g.id} onClick={() => setActiveGroup(g.id)} style={{
              padding: '4px 11px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 600,
              background: activeGroup === g.id ? 'var(--accent-primary)' : 'transparent',
              color: activeGroup === g.id ? '#fff' : 'var(--text-secondary)',
              transition: 'background 0.15s',
            }}>{g.label}</button>
          ))}
        </div>

        {/* Action buttons */}
        <button onClick={() => exportKeywords(settings)} style={{
          background: 'rgba(16,185,129,0.13)', border: '1px solid rgba(16,185,129,0.3)',
          borderRadius: '8px', color: '#34d399', padding: '5px 11px', cursor: 'pointer', fontSize: '0.75rem',
        }}>⬇ Export</button>

        <label style={{
          background: 'rgba(99,102,241,0.13)', border: '1px solid rgba(99,102,241,0.3)',
          borderRadius: '8px', color: '#a5b4fc', padding: '5px 11px', cursor: 'pointer', fontSize: '0.75rem',
        }}>
          ⬆ Import
          <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
        </label>

        <button onClick={handleResetAll} style={{
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: '8px', color: '#f87171', padding: '5px 11px', cursor: 'pointer', fontSize: '0.75rem',
        }}>↺ Reset</button>
      </div>

      {/* Feedback */}
      {importSuccess && (
        <div style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', padding: '7px 12px', fontSize: '0.78rem', color: '#34d399', flexShrink: 0 }}>
          ✅ Keywords imported and merged.
        </div>
      )}
      {importError && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px', padding: '7px 12px', fontSize: '0.78rem', color: '#f87171', flexShrink: 0 }}>
          ❌ {importError}
        </div>
      )}

      {/* ── Card list ── */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {activeGroup === 'sections'
          ? Object.entries(SECTION_META).map(([sid, meta]) => {
              if (search && (sectionMatchCounts[sid] || 0) === 0) return null;
              return (
                <SectionCard
                  key={sid}
                  sectionId={sid}
                  meta={meta}
                  defaultKws={SECTION_KEYWORDS[sid] || []}
                  userKws={getSectionUserKws(sid)}
                  onAdd={handleSectionAdd}
                  onRemove={handleSectionRemove}
                  searchQuery={search}
                />
              );
            })
          : Object.entries(BUZZ_REGION_META).map(([rid, meta]) => {
              if (search && (buzzMatchCounts[rid] || 0) === 0) return null;
              return (
                <BuzzCard
                  key={rid}
                  regionId={rid}
                  meta={meta}
                  defaultKws={getBuzzDefaultKws(rid)}
                  userKws={getStrictBuzzUserKws(rid)}
                  onAdd={handleBuzzAdd}
                  onRemove={handleBuzzRemove}
                  searchQuery={search}
                />
              );
            })
        }

        {search && totalMatches === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🔍</div>
            <div style={{ fontSize: '0.88rem' }}>No keywords match "<strong style={{ color: 'var(--text-primary)' }}>{search}</strong>"</div>
            <div style={{ fontSize: '0.75rem', marginTop: '5px' }}>Try fewer characters, or add it as a new keyword below.</div>
          </div>
        )}
      </div>

      {/* ── Legend strip ── */}
      <div style={{
        borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px', flexShrink: 0,
        display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap',
      }}>
        <Chip keyword="built-in" />
        <span style={{ fontSize: '0.67rem', color: 'var(--text-muted)', marginLeft: '-8px' }}>Read-only defaults</span>
        <Chip keyword="custom" isUser />
        <span style={{ fontSize: '0.67rem', color: 'var(--text-muted)', marginLeft: '-8px' }}>Your additions (× removes)</span>
        <span style={{ fontSize: '0.67rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>⚡ Additive — defaults always apply</span>
      </div>
    </div>
  );
}
