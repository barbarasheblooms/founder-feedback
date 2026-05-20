'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const SOURCE_LABELS = { linkedin: 'LinkedIn', sembly: 'Sembly meeting', email: 'Email', other: 'Other' };
const SOURCE_ICONS  = { linkedin: '🔗', sembly: '🎙️', email: '📧', other: '💬' };
const SUGGESTIONS   = [
  'What are the most critical pain points?',
  'What features do founders request most?',
  "What's the profile of founders reaching out?",
  'What gaps does SheBlooms need to fix urgently?',
  'What should I prioritize in the product now?',
];

function toB64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res(r.result.split(',')[1]);
    r.onerror = () => rej(new Error('read failed'));
    r.readAsDataURL(file);
  });
}

function buildLibraryContext(entries) {
  if (!entries.length) return 'No feedback in the library yet.';
  return entries.map(e => `[${e.name} | ${SOURCE_LABELS[e.source] || e.source} | added by ${e.added_by || 'unknown'} | ${e.entry_date}]
Profile: ${e.analysis?.profile || 'unknown'}
Summary: ${e.analysis?.summary || ''}
Themes: ${(e.analysis?.themes || []).map(t => t.theme + ' (' + t.relevance + ')').join(', ')}
Pain points: ${(e.analysis?.pain_points || []).map(p => p.pain + ' [' + p.intensity + ']').join(' | ')}
Requests: ${(e.analysis?.requests || []).join(' | ')}
Opportunities: ${(e.analysis?.opportunities || []).join(' | ')}`).join('\n\n---\n\n');
}

export default function FeedbackHub() {
  const [tab,         setTab]         = useState('add');
  const [entries,     setEntries]     = useState([]);
  const [addedBy,     setAddedBy]     = useState('');
  const [source,      setSource]      = useState('linkedin');
  const [inputMode,   setInputMode]   = useState('text');
  const [feedbackText,setFeedbackText]= useState('');
  const [entryName,   setEntryName]   = useState('');
  const [file,        setFile]        = useState(null);
  const [analyzing,   setAnalyzing]   = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput,   setChatInput]   = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [diagnosis,   setDiagnosis]   = useState(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const chatEndRef  = useRef(null);
  const fileInputRef= useRef(null);

  // Load saved "who am I" from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('sb_added_by');
    if (saved) setAddedBy(saved);
  }, []);

  const saveWho = (val) => {
    setAddedBy(val);
    localStorage.setItem('sb_added_by', val);
  };

  // Load entries from Supabase
  const loadEntries = useCallback(async () => {
    const { data } = await supabase
      .from('feedback_entries')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setEntries(data);
  }, []);

  // Realtime subscription — new entries from teammates appear instantly
  useEffect(() => {
    loadEntries();
    const channel = supabase
      .channel('feedback_entries_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feedback_entries' }, loadEntries)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [loadEntries]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatHistory]);

  // Analyze feedback
  async function analyze() {
    if (!addedBy.trim()) { alert('Please enter your name first.'); return; }
    const name = entryName.trim() || `Feedback ${entries.length + 1}`;
    let body;
    if (inputMode === 'text') {
      if (!feedbackText.trim()) return;
      body = { textContent: feedbackText.slice(0, 4000), source: SOURCE_LABELS[source], name, inputMode: 'text' };
    } else {
      if (!file) { alert('Please select a file first.'); return; }
      const fileData = await toB64(file);
      body = { source: SOURCE_LABELS[source], name, inputMode, fileData, fileType: file.type };
    }

    setAnalyzing(true);
    try {
      const res      = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const { analysis } = await res.json();
      await supabase.from('feedback_entries').insert({
        name,
        source,
        source_label: SOURCE_LABELS[source],
        added_by: addedBy.trim(),
        analysis,
        entry_date: new Date().toLocaleDateString('en-US'),
      });
      setFeedbackText(''); setEntryName(''); setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTab('library');
    } catch { alert('Error analyzing feedback. Please try again.'); }
    setAnalyzing(false);
  }

  // Delete entry
  async function deleteEntry(id) {
    await supabase.from('feedback_entries').delete().eq('id', id);
  }

  // Chat
  async function sendChat(text) {
    const msg = (text || chatInput).trim();
    if (!msg || !entries.length) { if (!entries.length) alert('Add feedback to the library first.'); return; }
    const next = [...chatHistory, { role: 'user', content: msg }];
    setChatHistory(next);
    setChatInput('');
    setChatLoading(true);
    try {
      const res   = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next.map(m => ({ role: m.role, content: m.content })), libraryContext: buildLibraryContext(entries), entryCount: entries.length }) });
      const { reply } = await res.json();
      setChatHistory(h => [...h, { role: 'assistant', content: reply }]);
    } catch { setChatHistory(h => [...h, { role: 'assistant', content: 'Error. Please try again.' }]); }
    setChatLoading(false);
  }

  // Diagnosis
  async function generateDiagnosis() {
    if (entries.length < 2) return;
    setDiagLoading(true); setDiagnosis(null);
    try {
      const res = await fetch('/api/diagnosis', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ libraryContext: buildLibraryContext(entries), entryCount: entries.length }) });
      const { diagnosis: d } = await res.json();
      setDiagnosis(d);
    } catch { setDiagnosis(null); }
    setDiagLoading(false);
  }

  useEffect(() => { if (tab === 'diagnosis' && entries.length >= 2 && !diagnosis && !diagLoading) generateDiagnosis(); }, [tab]);

  const counts = {
    total:    entries.length,
    linkedin: entries.filter(e => e.source === 'linkedin').length,
    meetings: entries.filter(e => e.source === 'sembly').length,
    pains:    entries.reduce((s, e) => s + (e.analysis?.pain_points?.length || 0), 0),
  };

  return (
    <div className="hub-wrap">
      {/* Header */}
      <div className="hub-header">
        <div className="hub-logo">🌸</div>
        <div>
          <div className="hub-title">SheBlooms Feedback Hub</div>
          <div className="hub-sub">
            <span className="live-dot" />
            Team tool · {entries.length} feedback{entries.length !== 1 ? 's' : ''} collected
          </div>
        </div>
      </div>

      {/* Who am I */}
      <div className="who-bar">
        <span style={{ fontSize: 14, color: 'var(--purple-text)', whiteSpace: 'nowrap' }}>👤 You are:</span>
        <input
          value={addedBy}
          onChange={e => saveWho(e.target.value)}
          placeholder="Enter your name (saved automatically)"
        />
      </div>

      {/* Tabs */}
      <div className="tab-bar">
        {[
          { key: 'add',       label: 'New feedback',  icon: '＋' },
          { key: 'library',   label: 'Library',       icon: '🗂', count: entries.length },
          { key: 'chat',      label: 'Ask AI',         icon: '💬' },
          { key: 'diagnosis', label: 'Diagnosis',     icon: '📊' },
        ].map(t => (
          <button key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.icon} {t.label}
            {t.count !== undefined && <span className="count-badge">{t.count}</span>}
          </button>
        ))}
      </div>

      {/* ── ADD TAB ── */}
      {tab === 'add' && (
        <div>
          <div className="card">
            <span className="field-label">Feedback source</span>
            <div className="source-row">
              {Object.entries(SOURCE_LABELS).map(([key, label]) => (
                <button key={key} className={`src-btn ${source === key ? 'active' : ''}`} onClick={() => setSource(key)}>
                  {SOURCE_ICONS[key]} {label}
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <span className="field-label">Founder name / identifier (optional)</span>
            <input type="text" value={entryName} onChange={e => setEntryName(e.target.value)} placeholder="e.g. Ana Lima — Seed stage, SaaS" />
          </div>

          <div className="card">
            <span className="field-label">Input type</span>
            <div className="mode-row">
              {[['text','📝','Text'],['pdf','📄','PDF'],['img','🖼️','Image / screenshot']].map(([m,icon,lbl]) => (
                <button key={m} className={`mode-btn ${inputMode === m ? 'active' : ''}`} onClick={() => { setInputMode(m); setFile(null); if (fileInputRef.current) fileInputRef.current.value=''; }}>
                  {icon} {lbl}
                </button>
              ))}
            </div>

            {inputMode === 'text' ? (
              <>
                <span className="field-label">Paste feedback text or transcript</span>
                <textarea value={feedbackText} onChange={e => setFeedbackText(e.target.value)} placeholder="Paste LinkedIn message, Sembly summary, transcript, notes..." />
              </>
            ) : (
              <>
                <div className={`upload-zone ${file ? 'has-file' : ''}`} onClick={() => fileInputRef.current?.click()}>
                  <span className="upload-icon">{file ? '✅' : '⬆️'}</span>
                  <div className="upload-title">{file ? file.name : 'Click to select file'}</div>
                  <div className="upload-hint">{file ? (file.size/1024/1024).toFixed(2)+' MB' : inputMode === 'pdf' ? 'PDF up to 5MB' : 'PNG, JPG or screenshot'}</div>
                </div>
                <input ref={fileInputRef} type="file" style={{ display: 'none' }} accept={inputMode === 'pdf' ? '.pdf' : 'image/*'} onChange={e => setFile(e.target.files[0] || null)} />
              </>
            )}

            {analyzing && (
              <div style={{ marginTop: 8 }}>
                <div className="load-bar"><div className="load-fill" /></div>
                <p className="load-note">AI is analyzing the feedback...</p>
              </div>
            )}
          </div>

          <div className="btn-row">
            <button className="btn btn-primary" onClick={analyze} disabled={analyzing}>
              ✨ Analyze with AI
            </button>
          </div>
        </div>
      )}

      {/* ── LIBRARY TAB ── */}
      {tab === 'library' && (
        <div>
          <div className="metric-grid">
            <div className="metric"><div className="metric-val">{counts.total}</div><div className="metric-lbl">total feedbacks</div></div>
            <div className="metric"><div className="metric-val">{counts.linkedin}</div><div className="metric-lbl">LinkedIn</div></div>
            <div className="metric"><div className="metric-val">{counts.meetings}</div><div className="metric-lbl">meetings</div></div>
            <div className="metric"><div className="metric-val">{counts.pains}</div><div className="metric-lbl">pain points</div></div>
          </div>

          {entries.length === 0 ? (
            <div className="empty">
              <span className="empty-icon">📭</span>
              No feedback yet. Add the first one in "New feedback".
            </div>
          ) : (
            <div className="entry-list">
              {entries.map(e => {
                const critical = (e.analysis?.pain_points || []).filter(p => p.intensity === 'high').length;
                const themes   = (e.analysis?.themes || []).slice(0, 3);
                return (
                  <div key={e.id} className="entry-item">
                    <div className="entry-header">
                      <span style={{ fontSize: 18, marginTop: 2 }}>{SOURCE_ICONS[e.source] || '💬'}</span>
                      <div className="entry-meta">
                        <div className="entry-name">{e.name}</div>
                        <div className="entry-sub">
                          {SOURCE_LABELS[e.source] || e.source} · {e.entry_date} · added by <strong>{e.added_by || 'unknown'}</strong>
                          {e.analysis?.profile && ` · ${e.analysis.profile}`}
                        </div>
                        {e.analysis?.summary && <div className="entry-summary">{e.analysis.summary}</div>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {critical > 0 && <span className="badge badge-coral">⚠ {critical} critical</span>}
                        <button className="del-btn" onClick={() => deleteEntry(e.id)} title="Remove">🗑</button>
                      </div>
                    </div>
                    {themes.length > 0 && (
                      <div className="chip-row">
                        {themes.map((t, i) => <span key={i} className="chip">{t.theme}</span>)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── CHAT TAB ── */}
      {tab === 'chat' && (
        <div className="card" style={{ padding: '1rem' }}>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>
            Ask anything about your feedback library. The AI answers based on what the team has collected.
          </p>
          <div className="suggestions">
            {SUGGESTIONS.map((s, i) => (
              <button key={i} className="sug-chip" onClick={() => sendChat(s)}>{s}</button>
            ))}
          </div>

          <div className="chat-messages">
            {chatHistory.length === 0 && (
              <div className="empty" style={{ padding: '1.5rem 1rem' }}>
                <span className="empty-icon">💬</span>
                Ask a question about your feedback library.
              </div>
            )}
            {chatHistory.map((m, i) => (
              <div key={i} className={`msg ${m.role === 'user' ? 'user' : 'ai'}`}>
                <div className={`avatar ${m.role === 'user' ? 'user' : 'ai'}`}>
                  {m.role === 'user' ? '👤' : '✨'}
                </div>
                <div className="bubble" dangerouslySetInnerHTML={{ __html: m.content.replace(/\n/g,'<br>').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>') }} />
              </div>
            ))}
            {chatLoading && (
              <div className="msg ai">
                <div className="avatar ai">✨</div>
                <div className="bubble" style={{ color: 'var(--text-muted)' }}>
                  <div className="load-bar" style={{ width: 80 }}><div className="load-fill" /></div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="chat-input-row">
            <textarea
              className="chat-input"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
              placeholder="Ask about pain points, opportunities, founder profiles..."
              rows={1}
            />
            <button className="btn btn-primary" onClick={() => sendChat()} disabled={chatLoading} style={{ alignSelf: 'flex-end', padding: '10px 14px' }}>
              ↑
            </button>
          </div>
        </div>
      )}

      {/* ── DIAGNOSIS TAB ── */}
      {tab === 'diagnosis' && (
        <div>
          {entries.length < 2 ? (
            <div className="empty">
              <span className="empty-icon">📊</span>
              Add at least 2 feedbacks to generate the consolidated diagnosis.
            </div>
          ) : (
            <>
              <div className="btn-row" style={{ marginBottom: '1rem' }}>
                <button className="btn" onClick={generateDiagnosis} disabled={diagLoading}>
                  🔄 Re-analyze
                </button>
              </div>

              {diagLoading && (
                <div className="card">
                  <div className="load-bar"><div className="load-fill" /></div>
                  <p className="load-note">Consolidating all {entries.length} feedback entries...</p>
                </div>
              )}

              {diagnosis && !diagLoading && (
                <div>
                  {diagnosis.exec_summary && (
                    <div className="diag-summary">{diagnosis.exec_summary}</div>
                  )}

                  <div className="diag-grid">
                    {/* Pain points */}
                    <div className="card">
                      <div className="section-title">🔥 Top pain points</div>
                      {(diagnosis.top_pains || []).map((p, i) => (
                        <div key={i} className="pain-row">
                          <div className={`pain-dot dot-${p.intensity === 'high' ? 'high' : 'medium'}`} />
                          <div>
                            <div className="pain-text">{p.pain}</div>
                            <div className="pain-impl">{p.implication}</div>
                            {p.frequency > 1 && <span className="badge badge-gray" style={{ marginTop: 4, fontSize: 10 }}>{p.frequency}x mentioned</span>}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Themes */}
                    <div className="card">
                      <div className="section-title">🏷 Recurring themes</div>
                      {(diagnosis.top_themes || []).map((t, i) => (
                        <div key={i} className="freq-item">
                          <div className="freq-label">
                            <span>{t.theme}</span>
                            <span style={{ color: 'var(--text-muted)' }}>{t.mentions}x</span>
                          </div>
                          <div className="freq-bar">
                            <div className="freq-fill" style={{ width: `${Math.min(100, Math.round(t.mentions / entries.length * 100))}%` }} />
                          </div>
                        </div>
                      ))}
                      {diagnosis.founder_profiles?.length > 0 && (
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>
                          <strong>Profiles:</strong> {diagnosis.founder_profiles.join(' · ')}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Opportunities */}
                  <div className="card" style={{ marginBottom: '1rem' }}>
                    <div className="section-title">💡 Product opportunities</div>
                    {(diagnosis.product_opportunities || []).map((o, i) => (
                      <div key={i} className="opp-row">
                        <div className="opp-num">{i + 1}</div>
                        <div>
                          <div className="opp-text">{o.opportunity}</div>
                          <div className="opp-sub">
                            <span className={`badge ${o.urgency === 'immediate' ? 'badge-coral' : o.urgency === 'next_sprint' ? 'badge-amber' : 'badge-gray'}`} style={{ fontSize: 10 }}>
                              {o.urgency === 'immediate' ? 'Immediate' : o.urgency === 'next_sprint' ? 'Next sprint' : 'Backlog'}
                            </span>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{o.rationale}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Gaps */}
                  {diagnosis.platform_gaps?.length > 0 && (
                    <div className="card">
                      <div className="section-title">⚠️ Critical gaps</div>
                      {diagnosis.platform_gaps.map((g, i) => (
                        <div key={i} className="gap-row">
                          <div className="gap-dot" />
                          <span style={{ fontSize: 14 }}>{g}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
