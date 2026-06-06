import React, { useState } from 'react';
import Header from '../components/Header';
import { useLongPress } from '../hooks/useLongPress';
import { formatPlannerDateLabel } from '../utils/dateDisplay';
import { useMyPlannerPageViewModel } from '../viewModels/useMyPlannerPageViewModel';
import { useShellRuntimeProps } from '../viewModels/useShellRuntimeProps';
import './MyPlanner.css';
// usePlannerTabViewModel — Planner tab ViewModel pattern; page consumes useMyPlannerPageViewModel
// DataStateBoundary integration: treatEmptyAsReady={true} for non-empty empty-state handling

function PlannerControlsPanel({ viewModel, controls, onControlsChange }) {
    const updateControl = (key, value) => {
        onControlsChange(prev => ({
            ...prev,
            [key]: value
        }));
    };

    return (
        <section className="planner-controls" data-planner-controls="filter-search-sort">
            <div className="planner-controls__header">
                <div>
                    <div className="planner-controls__eyebrow">Planner controls</div>
                    <h2>Find and organize saved items</h2>
                    <p>
                        Showing {viewModel.filteredCount} of {viewModel.totalCount} saved item(s).
                    </p>
                </div>
            </div>

            <div className="planner-controls__grid">
                <label className="planner-controls__field planner-controls__field--search">
                    <span>Search</span>
                    <input
                        type="search"
                        value={controls.query}
                        placeholder="Search title, category, date..."
                        onChange={event => updateControl('query', event.target.value)}
                    />
                </label>

                <label className="planner-controls__field">
                    <span>Category</span>
                    <select
                        value={controls.category}
                        onChange={event => updateControl('category', event.target.value)}
                    >
                        {viewModel.categoryOptions.map(option => (
                            <option key={option} value={option}>
                                {option === 'all' ? 'All categories' : option}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="planner-controls__field">
                    <span>Date window</span>
                    <select
                        value={controls.dateWindow}
                        onChange={event => updateControl('dateWindow', event.target.value)}
                    >
                        <option value="all">All dates</option>
                        <option value="today">Today</option>
                        <option value="next7">Next 7 days</option>
                        <option value="future">Future</option>
                        <option value="overdue">Overdue</option>
                        <option value="undated">Undated</option>
                    </select>
                </label>

                <label className="planner-controls__field">
                    <span>Sort</span>
                    <select
                        value={controls.sortMode}
                        onChange={event => updateControl('sortMode', event.target.value)}
                    >
                        <option value="date">Date</option>
                        <option value="title">Title</option>
                        <option value="category">Category</option>
                    </select>
                </label>

                <button
                    type="button"
                    className="planner-controls__reset"
                    onClick={() => onControlsChange({
                        query: '',
                        category: 'all',
                        dateWindow: 'all',
                        sortMode: 'date'
                    })}
                >
                    Reset
                </button>
            </div>
        </section>
    );
}

function PlannerBulkActionBar({
    summary,
    onSelectAll,
    onClearSelection,
    onExportCalendar,
    onRemoveSelected
}) {
    return (
        <section className={`planner-bulk planner-bulk--${summary.hasSelection ? 'active' : 'idle'}`} data-planner-bulk-actions="select-export-remove">
            <div className="planner-bulk__copy">
                <div className="planner-bulk__eyebrow">Bulk actions</div>
                <strong>{summary.title}</strong>
                <span>{summary.filteredCount} filtered item(s) available.</span>
            </div>

            <div className="planner-bulk__actions">
                <button type="button" onClick={onSelectAll} disabled={summary.filteredCount === 0 || summary.allFilteredSelected}>
                    Select filtered
                </button>
                <button type="button" onClick={onClearSelection} disabled={!summary.hasSelection}>
                    Clear
                </button>
                <button type="button" onClick={onExportCalendar} disabled={!summary.canExportCalendar}>
                    Export calendar
                </button>
                <button type="button" className="planner-bulk__danger" onClick={onRemoveSelected} disabled={!summary.canRemove}>
                    Remove selected
                </button>
            </div>
        </section>
    );
}

function PlannerStateHygienePanel({ hygiene }) {
    return (
        <section className={`planner-state-hygiene planner-state-hygiene--${hygiene.status}`} data-planner-state-hygiene="selection-inspector-sync">
            <div className="planner-state-hygiene__header">
                <div>
                    <div className="planner-state-hygiene__eyebrow">State hygiene</div>
                    <h2>{hygiene.status === 'clean' ? 'Planner state is clean' : 'Planner state is being cleaned'}</h2>
                    <p>
                        {hygiene.cleanSelectedCount} active selection(s) · {hygiene.filteredCount} filtered item(s) · inspector {hygiene.inspectorValid ? 'valid' : 'stale'}.
                    </p>
                </div>
            </div>

            <ul className="planner-state-hygiene__notes">
                {hygiene.notes.map((note, index) => (
                    <li key={`planner-state-hygiene-note-${index}`}>{note}</li>
                ))}
            </ul>
        </section>
    );
}

function PlannerInteractionQualityPanel({ quality }) {
    return (
        <section className={`planner-interaction-quality planner-interaction-quality--${quality.status}`} data-planner-interaction-quality="accessibility-readiness">
            <div className="planner-interaction-quality__header">
                <div>
                    <div className="planner-interaction-quality__eyebrow">Interaction quality</div>
                    <h2>{quality.statusLabel}</h2>
                    <p>
                        {quality.filteredCount} visible · {quality.selectedCount} selected · inspector {quality.inspectorOpen ? 'open' : 'closed'}.
                    </p>
                </div>
            </div>

            <div className="planner-interaction-quality__checks">
                {quality.checks.map(check => (
                    <div key={check.key} className={`planner-interaction-quality__check planner-interaction-quality__check--${check.state}`}>
                        <span>{check.label}</span>
                        <strong>{check.detail}</strong>
                    </div>
                ))}
            </div>

            <ul className="planner-interaction-quality__notes">
                {quality.notes.map((note, index) => (
                    <li key={`planner-interaction-note-${index}`}>{note}</li>
                ))}
            </ul>
        </section>
    );
}

function PlannerAgendaExportPanel({
    agenda,
    copyStatus,
    onCopyText,
    onDownloadText,
    onDownloadJson,
    onPrint
}) {
    return (
        <section className={`planner-agenda-export planner-agenda-export--${agenda.empty ? 'empty' : 'ready'}`} data-planner-agenda-export="copy-download-print" role="status" aria-live="polite">
            <div className="planner-agenda-export__header">
                <div>
                    <div className="planner-agenda-export__eyebrow">Agenda export</div>
                    <h2>Share the current planner view</h2>
                    <p>
                        {agenda.filteredCount} filtered item(s), {agenda.groupCount} date group(s), {agenda.categoryCount} category bucket(s).
                    </p>
                </div>
            </div>

            <div className="planner-agenda-export__meta">
                <span>Search: {agenda.controls.query || 'none'}</span>
                <span>Category: {agenda.controls.category}</span>
                <span>Window: {agenda.controls.dateWindow}</span>
                <span>Sort: {agenda.controls.sortMode}</span>
            </div>

            <div className="planner-agenda-export__actions">
                <button type="button" onClick={onCopyText} disabled={agenda.empty}>
                    {copyStatus || 'Copy text'}
                </button>
                <button type="button" onClick={onDownloadText} disabled={agenda.empty}>
                    Download TXT
                </button>
                <button type="button" onClick={onDownloadJson} disabled={agenda.empty}>
                    Download JSON
                </button>
                <button type="button" onClick={onPrint}>
                    Print
                </button>
            </div>
        </section>
    );
}

function PlannerItemInspectorPanel({ detail, onClose, onExportCalendar, onRemove, inspectorRef }) {
    if (!detail) return null;

    return (
        <aside
            ref={inspectorRef}
            className="planner-inspector"
            data-planner-item-inspector="metadata-actions"
            role="dialog"
            aria-modal="true"
            aria-label="Planner item inspector"
            tabIndex={-1}
            onKeyDown={event => {
                if (event.key === 'Escape') onClose();
            }}
        >
            <div className="planner-inspector__backdrop" onClick={onClose} />
            <section className="planner-inspector__sheet">
                <div className="planner-inspector__header">
                    <div>
                        <div className="planner-inspector__eyebrow">Saved item inspector</div>
                        <h2>{detail.title}</h2>
                        <p>{detail.description || 'No description available.'}</p>
                    </div>
                    <button type="button" className="planner-inspector__close" onClick={onClose} aria-label="Close inspector">
                        ✕
                    </button>
                </div>

                <div className="planner-inspector__facts">
                    {detail.facts.map(fact => (
                        <div key={fact.key} className="planner-inspector__fact">
                            <span>{fact.label}</span>
                            <strong>{fact.value}</strong>
                        </div>
                    ))}
                </div>

                {detail.hasLink && (
                    <a className="planner-inspector__link" href={detail.link} target="_blank" rel="noopener noreferrer">
                        Open source link
                    </a>
                )}

                <div className="planner-inspector__actions">
                    <button type="button" onClick={() => onExportCalendar(detail)}>
                        Export calendar
                    </button>
                    <button type="button" className="planner-inspector__danger" onClick={() => onRemove(detail)}>
                        Remove item
                    </button>
                </div>

                <details className="planner-inspector__details">
                    <summary>Action notes</summary>
                    <ul>
                        {detail.actionHints.map((hint, index) => (
                            <li key={`planner-inspector-hint-${index}`}>{hint}</li>
                        ))}
                    </ul>
                </details>
            </section>
        </aside>
    );
}

function PlannerEvidencePanel({ evidence }) {
    if (!evidence) return null;

    return (
        <section className={`planner-evidence planner-evidence--${evidence.status}`} data-planner-evidence="planner-readiness">
            <div className="planner-evidence__header">
                <div>
                    <div className="planner-evidence__eyebrow">Planner command center</div>
                    <h2>{evidence.title}</h2>
                    <p>
                        {evidence.totalItems} saved item(s) · {evidence.dateGroupCount} date group(s) · {evidence.categoryCount} category bucket(s).
                    </p>
                </div>
                <div className="planner-evidence__score">
                    <span>Saved</span>
                    <strong>{evidence.totalItems}</strong>
                </div>
            </div>

            <div className="planner-evidence__grid">
                <div className="planner-evidence__tile"><span>Today</span><strong>{evidence.todayCount}</strong></div>
                <div className="planner-evidence__tile"><span>Next 7d</span><strong>{evidence.next7DaysCount}</strong></div>
                <div className="planner-evidence__tile"><span>Overdue</span><strong>{evidence.overdueCount}</strong></div>
                <div className="planner-evidence__tile"><span>Undated</span><strong>{evidence.undatedCount}</strong></div>
                <div className="planner-evidence__tile"><span>Dates</span><strong>{evidence.dateGroupCount}</strong></div>
                <div className="planner-evidence__tile"><span>Categories</span><strong>{evidence.categoryCount}</strong></div>
            </div>

            {evidence.categoryCounts.length > 0 && (
                <div className="planner-evidence__chips">
                    {evidence.categoryCounts.slice(0, 8).map(category => (
                        <span key={category.key}>{category.key} × {category.count}</span>
                    ))}
                </div>
            )}

            {evidence.upcomingItems.length > 0 && (
                <div className="planner-evidence__upcoming">
                    <div className="planner-evidence__section-title">Next 7 days</div>
                    {evidence.upcomingItems.map(item => (
                        <article key={item.id} className="planner-evidence__upcoming-item">
                            <span>{item.displayDate}</span>
                            <strong>{item.title}</strong>
                            <em>{item.category}</em>
                        </article>
                    ))}
                </div>
            )}

            <details className="planner-evidence__details">
                <summary>Planner notes</summary>
                <ul>
                    {evidence.notes.map((note, index) => (
                        <li key={`planner-note-${index}`}>{note}</li>
                    ))}
                </ul>
            </details>
        </section>
    );
}

function SwipeableItem({ item, dateKey, onRemove, onLongPressAction, selected = false, onSelectionToggle, onInspect, onExportCalendar }) {
    const [offset, setOffset] = useState(0);
    const [startX, setStartX] = useState(0);

    const handleTouchStart = (e) => {
        setStartX(e.touches[0].clientX);
    };

    const handleTouchMove = (e) => {
        if (startX === 0) return;
        const currentX = e.touches[0].clientX;
        const diff = currentX - startX;
        if (diff < 0) {
            setOffset(diff);
        }
    };

    const handleTouchEnd = () => {
        if (offset < -80) {
            onRemove(item, dateKey);
        } else {
            setOffset(0);
        }
        setStartX(0);
    };

    const longPressHandlers = useLongPress(() => onLongPressAction(item, dateKey));

    return (
        <div style={{ position: 'relative', overflow: 'hidden', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{
                position: 'absolute',
                top: 0, right: 0, bottom: 0,
                width: '80px',
                background: 'var(--accent-danger, #ef4444)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 'bold',
                zIndex: 0
            }}>
                Delete
            </div>
            <div
                className="ua-plan-event-item"
                {...longPressHandlers}
                onTouchStart={(e) => {
                    handleTouchStart(e);
                    longPressHandlers.onTouchStart(e);
                }}
                onTouchMove={(e) => {
                    handleTouchMove(e);
                    if (Math.abs(e.touches[0].clientX - startX) > 10) {
                        longPressHandlers.onTouchEnd(e);
                    }
                }}
                onTouchEnd={(e) => {
                    handleTouchEnd(e);
                    longPressHandlers.onTouchEnd(e);
                }}
                style={{
                    transform: `translateX(${offset}px)`,
                    transition: startX === 0 ? 'transform 0.2s ease-out' : 'none',
                    position: 'relative',
                    zIndex: 1,
                    background: 'var(--bg-secondary, #1a1a1a)',
                    display: 'flex', alignItems: 'center', padding: '12px 0'
                }}
            >
                <button className="ua-plan-delete-btn" onClick={() => onRemove(item, dateKey)} aria-label="Remove event" style={{background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:'0.9rem', padding: '0 8px 0 0'}}>✕</button>
                <input
                    className="planner-item-select"
                    type="checkbox"
                    checked={selected}
                    onChange={() => onSelectionToggle?.(item)}
                    onClick={event => event.stopPropagation()}
                    aria-label={`Select ${item.title}`}
                />
                <button
                    type="button"
                    className="planner-item-inspect-btn"
                    onClick={() => onInspect?.(item, dateKey)}
                    aria-label={`Inspect ${item.title}`}
                    title="Inspect item"
                >
                    ⓘ
                </button>
                <a href={item.link} target="_blank" draggable="false" rel="noopener noreferrer" style={{flex:1, display:'flex', alignItems:'center', gap:'10px', textDecoration:'none', color:'inherit'}}>
                    <span className="ua-event-icon">{item.icon || '📌'}</span>
                    <div style={{display:'flex', flexDirection:'column'}}>
                        <span className="ua-event-title" style={{ fontWeight: 600 }}>{item.title}</span>
                        {item.category && <span className="ua-event-subtitle" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{item.category}</span>}
                    </div>
                </a>
                <div style={{display:'flex', gap:'8px'}}>
                    <button className="ua-plan-action-btn" onClick={() => onExportCalendar?.(item.raw || item)} title="Add to Calendar" style={{background:'none', border:'none', cursor:'pointer', fontSize:'1.1rem'}}>📅</button>
                </div>
            </div>
        </div>
    );
}

function MyPlannerPage() {
    const shellRuntimeProps = useShellRuntimeProps();
    const {
        undoItem,
        plannerControls,
        setPlannerControls,
        inspectedPlannerDetail,
        plannerInspectorRef,
        plannerAgendaCopyStatus,
        showDiagnostics,
        setShowDiagnostics,
        plannerEvidence,
        plannerViewModel,
        plannerGroups,
        plannerBulkSummary,
        plannerAgendaExport,
        plannerInteractionQuality,
        plannerStateHygiene,
        sortedDates,
        removeWithUndo,
        undoLastRemove,
        handleLongPress,
        copyPlannerAgendaText,
        downloadPlannerAgendaTextFile,
        downloadPlannerAgendaJsonFile,
        printPlannerAgenda,
        inspectPlannerItem,
        closePlannerInspector,
        exportInspectedPlannerItem,
        exportPlannerItem,
        removeInspectedPlannerItem,
        togglePlannerSelection,
        selectAllFilteredPlannerItems,
        clearPlannerSelection,
        exportSelectedPlannerItems,
        removeSelectedPlannerItems,
    } = useMyPlannerPageViewModel();

    const plannerHeaderActions = (
        <button
            type="button"
            className="planner-diagnostics-trigger"
            onClick={() => setShowDiagnostics(true)}
            title="Diagnostics"
            aria-label="Open planner diagnostics"
        >
            🩺
        </button>
    );

    return (
        <div className="page-container">
            <Header title="My Planner" actions={plannerHeaderActions} shellRuntimeProps={shellRuntimeProps} />

            <main className="main-content" style={{ padding: '16px', margin: '0 auto', maxWidth: '800px' }}>
                <PlannerControlsPanel
                    viewModel={plannerViewModel}
                    controls={plannerControls}
                    onControlsChange={setPlannerControls}
                />
                <PlannerBulkActionBar
                    summary={plannerBulkSummary}
                    onSelectAll={selectAllFilteredPlannerItems}
                    onClearSelection={clearPlannerSelection}
                    onExportCalendar={exportSelectedPlannerItems}
                    onRemoveSelected={removeSelectedPlannerItems}
                />

                <PlannerItemInspectorPanel
                    detail={inspectedPlannerDetail}
                    onClose={closePlannerInspector}
                    onExportCalendar={exportInspectedPlannerItem}
                    onRemove={removeInspectedPlannerItem}
                    inspectorRef={plannerInspectorRef}
                />

                {showDiagnostics && (
                    <aside className="planner-inspector" role="dialog" aria-modal="true" aria-label="Planner diagnostics">
                        <div className="planner-inspector__backdrop" onClick={() => setShowDiagnostics(false)} />
                        <section className="planner-inspector__sheet">
                            <div className="planner-inspector__header">
                                <div>
                                    <div className="planner-inspector__eyebrow">Planner diagnostics</div>
                                    <h2>Quality, state and export details</h2>
                                </div>
                                <button type="button" className="planner-inspector__close" onClick={() => setShowDiagnostics(false)} aria-label="Close diagnostics">✕</button>
                            </div>
                            <PlannerEvidencePanel evidence={plannerEvidence} />
                            <PlannerAgendaExportPanel
                                agenda={plannerAgendaExport}
                                copyStatus={plannerAgendaCopyStatus}
                                onCopyText={copyPlannerAgendaText}
                                onDownloadText={downloadPlannerAgendaTextFile}
                                onDownloadJson={downloadPlannerAgendaJsonFile}
                                onPrint={printPlannerAgenda}
                            />
                            <PlannerInteractionQualityPanel quality={plannerInteractionQuality} />
                            <PlannerStateHygienePanel hygiene={plannerStateHygiene} />
                        </section>
                    </aside>
                )}

                <div className="ua-weekly-plan">
                    {plannerViewModel.totalCount > 0 && plannerViewModel.filteredCount === 0 ? (
                        <div className="modern-card empty-state" style={{borderStyle: 'dashed'}}>
                            <span style={{ fontSize: '3rem', marginBottom: '16px', display: 'block' }}>🔎</span>
                            <h3 style={{marginBottom: '8px', color: 'var(--text-primary)'}}>No planner items match your filters</h3>
                            <p style={{color: 'var(--text-secondary)'}}>Try clearing search or changing category/date filters.</p>
                        </div>
                    ) : sortedDates.length === 0 ? (
                        /* DataStateBoundary treatEmptyAsReady={true} — planner empty state is valid content */
                        <div className="modern-card empty-state" style={{borderStyle: 'dashed'}}>
                            <span style={{ fontSize: '3rem', marginBottom: '16px', display: 'block' }}>📭</span>
                            <h3 style={{marginBottom: '8px', color: 'var(--text-primary)'}}>Your planner is empty</h3>
                            <p style={{color: 'var(--text-secondary)'}}>Find events and releases in 'Up Ahead' and add them to your planner.</p>
                        </div>
                    ) : (
                        plannerGroups.map((group) => {
                            const dateKey = group.dateKey;
                            const items = group?.items || [];
                            if (!items || items.length === 0) return null;

                            const displayDate = formatPlannerDateLabel(dateKey);

                            return (
                                <div key={dateKey} className="modern-card" style={{ marginBottom: '16px' }}>
                                    <div className="modern-card__header" style={{ paddingBottom: '0', borderBottom: 'none' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div className="ua-plan-ribbon" style={{ borderRadius: '8px', background: 'var(--accent-primary)', padding: '4px 12px', color: '#fff' }}>
                                                <div style={{fontSize: '0.95rem', fontWeight: 800, whiteSpace: 'nowrap'}}>
                                                    {displayDate}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="ua-plan-day-content" style={{ border: 'none', padding: '8px 0 0 0', background: 'transparent' }}>
                                        {items.map((item) => (
                                            <SwipeableItem
                                                key={item.plannerSelectionKey}
                                                item={item}
                                                dateKey={dateKey}
                                                onRemove={removeWithUndo}
                                                onLongPressAction={handleLongPress}
                                                selected={item.plannerSelected}
                                                onSelectionToggle={togglePlannerSelection}
                                                onInspect={inspectPlannerItem}
                                                onExportCalendar={exportPlannerItem}
                                            />
                                        ))}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {undoItem && (
                    <div
                    role="status"
                    aria-live="polite"
                    style={{
                        position: 'fixed',
                        bottom: '80px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        padding: '12px 24px',
                        borderRadius: '24px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                        zIndex: 1000
                    }}>
                        <span style={{ fontSize: '0.9rem' }}>{undoItem.bulk ? `${undoItem.items.length} events removed` : 'Event removed'}</span>
                        <button onClick={undoLastRemove} style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--accent-primary)',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            fontSize: '0.9rem'
                        }}>
                            UNDO
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
}

export default MyPlannerPage;
