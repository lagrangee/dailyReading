'use client';

import { useState, useEffect } from 'react';
import { AppConfig } from '@/lib/coordinator';
import { LogEntry } from '@/lib/logger';

interface TagInputProps {
  label: string;
  icon: string;
  tags: string[];
  placeholder: string;
  onTagsChange: (newTags: string[]) => void;
}

function TagInput({ label, icon, tags, placeholder, onTagsChange }: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const addTag = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onTagsChange([...tags, trimmed]);
      setInputValue('');
    }
  };
  const removeTag = (idx: number) => onTagsChange(tags.filter((_, i) => i !== idx));
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); addTag(); }
  };
  return (
    <div className="section" style={{ marginBottom: '2.5rem' }}>
      <div className="section-header" style={{ marginBottom: '1rem' }}>
        <div className="section-title" style={{ fontSize: '0.9rem', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <span>{icon}</span> <span style={{ marginLeft: '0.5rem' }}>{label}</span>
        </div>
      </div>
      <div className="tag-list">
        {tags.map((tag, idx) => (
          <div key={idx} className="tag">
            {tag}
            <span className="tag-delete" onClick={() => removeTag(idx)}>&times;</span>
          </div>
        ))}
      </div>
      <div className="input-row" style={{ marginTop: '0.5rem' }}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          style={{ fontSize: '0.85rem', padding: '0.6rem 0.8rem' }}
        />
      </div>
    </div>
  );
}

export default function Home() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [runningStatus, setRunningStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const [configRes, logsRes] = await Promise.all([fetch('/api/config'), fetch('/api/logs')]);
    setConfig(await configRes.json());
    setLogs(await logsRes.json());
  };

  useEffect(() => {
    fetchData().then(() => setLoading(false));
  }, []);

  const triggerRun = () => {
    setRunningStatus('Initializing...');
    const eventSource = new EventSource('/api/run');
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.message === 'DONE') {
        setRunningStatus(null);
        eventSource.close();
        fetchData();
      } else {
        setRunningStatus(data.message);
      }
    };
    eventSource.onerror = () => {
      setRunningStatus('Connection failed.');
      setTimeout(() => setRunningStatus(null), 3000);
      eventSource.close();
      fetchData();
    };
  };

  const triggerLogin = async (platform: 'bilibili' | 'youtube' | 'notebooklm') => {
    const ok = confirm(`A browser window will open for ${platform} login. Close the window after you finish logging in. Proceed?`);
    if (!ok) return;

    await fetch('/api/login', {
      method: 'POST',
      body: JSON.stringify({ platform }),
      headers: { 'Content-Type': 'application/json' }
    });
  };

  if (loading || !config) return <div style={{ display: 'grid', placeItems: 'center', height: '100vh', fontSize: '1.2rem', opacity: 0.5 }}>Loading Workspace...</div>;

  return (
    <div className="layout-wrapper">
      {/* 侧边栏：配置与管理 */}
      <aside className="sidebar">
        <div style={{ marginBottom: '3rem' }}>
          <h1 className="gradient-text" style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>Antigravity</h1>
          <p style={{ fontSize: '0.8rem', opacity: 0.4 }}>Real-time Intelligence Hub</p>
        </div>

        <nav>
          <TagInput label="YouTube" icon="📺" tags={config.youtube_whitelist} placeholder="Add Handle..." onTagsChange={(tags) => setConfig({ ...config, youtube_whitelist: tags })} />
          <TagInput label="Bilibili" icon="🎬" tags={config.bilibili_whitelist} placeholder="Add UP ID..." onTagsChange={(tags) => setConfig({ ...config, bilibili_whitelist: tags })} />
          <TagInput label="RSS Feeds" icon="🎙️" tags={config.rss_feeds} placeholder="Add XML URL..." onTagsChange={(tags) => setConfig({ ...config, rss_feeds: tags })} />

          <div className="section" style={{ marginBottom: '2.5rem' }}>
            <div className="section-title" style={{ fontSize: '0.9rem', opacity: 0.6, textTransform: 'uppercase', marginBottom: '1rem' }}>
              <span>📰</span> <span style={{ marginLeft: '0.5rem' }}>Hacker News</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <input
                value={config.hn_config.keywords.join(', ')}
                onChange={(e) => setConfig({ ...config, hn_config: { ...config.hn_config, keywords: e.target.value.split(',').map(k => k.trim()) } })}
                placeholder="Keywords (AI, LLM...)"
                style={{ fontSize: '0.85rem' }}
              />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.7rem', opacity: 0.4, display: 'block', marginBottom: '0.3rem' }}>Min Points</label>
                  <input type="number" value={config.hn_config.minPoints} onChange={(e) => setConfig({ ...config, hn_config: { ...config.hn_config, minPoints: parseInt(e.target.value) } })} style={{ fontSize: '0.85rem' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.7rem', opacity: 0.4, display: 'block', marginBottom: '0.3rem' }}>Max Results</label>
                  <input type="number" value={config.hn_config.maxResults} onChange={(e) => setConfig({ ...config, hn_config: { ...config.hn_config, maxResults: parseInt(e.target.value) } })} style={{ fontSize: '0.85rem' }} />
                </div>
              </div>
            </div>
          </div>
        </nav>

        <div style={{ marginTop: 'auto', paddingTop: '2rem' }}>
          <button
            onClick={() => fetch('/api/config', { method: 'POST', body: JSON.stringify(config) }).then(() => alert('Configuration Applied'))}
            style={{ width: '100%', justifyContent: 'center', marginBottom: '1rem' }}
          >
            💾 Save Config
          </button>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => triggerLogin('youtube')} style={{ flex: 1, padding: '0.6rem', fontSize: '1.2rem', justifyContent: 'center', background: '#ff000022', border: '1px solid #ff000044' }} title="Login YouTube">📺</button>
            <button onClick={() => triggerLogin('bilibili')} style={{ flex: 1, padding: '0.6rem', fontSize: '1.2rem', justifyContent: 'center', background: '#00a1d622', border: '1px solid #00a1d644' }} title="Login Bilibili">🎬</button>
            <button onClick={() => triggerLogin('notebooklm')} style={{ flex: 1, padding: '0.6rem', fontSize: '1.2rem', justifyContent: 'center', background: '#4285f422', border: '1px solid #4285f444' }} title="Login NotebookLM">📓</button>
          </div>
        </div>
      </aside>

      {/* 主内容区：活动流与状态 */}
      <main className="main-content">
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '4rem' }}>
          <div>
            <h2 style={{ fontSize: '2.5rem', fontWeight: '800' }}>Intelligence Feed</h2>
            <p style={{ opacity: 0.4 }}>Monitor your automated knowledge pipeline.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            {runningStatus && (
              <div className="glass" style={{ padding: '0.8rem 1.5rem', color: 'hsl(var(--secondary))', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <div className="pulse" />
                <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>{runningStatus}</span>
              </div>
            )}
            <button onClick={triggerRun} disabled={!!runningStatus} style={{ padding: '1rem 2.5rem', fontSize: '1rem', borderRadius: '16px' }}>
              {runningStatus ? 'Processing...' : '▶ Start Routine'}
            </button>
          </div>
        </header>

        <section className="activity-feed" style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
          {logs.map((log, i) => (
            <div key={i} className="log-entry">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '12px',
                    background: log.status === 'success' ? 'hsl(var(--accent) / 0.2)' : 'hsl(var(--destructive) / 0.2)',
                    display: 'grid', placeItems: 'center', color: log.status === 'success' ? 'hsl(var(--accent))' : 'hsl(var(--destructive))'
                  }}>
                    {log.status === 'success' ? '✓' : '!'}
                  </div>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '1.1rem' }}>{log.message}</div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.3 }}>{log.timestamp}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.8rem' }}>
                  {log.notebookSyncStatus === 'success' && (
                    <div className="tag" style={{ background: 'hsl(var(--accent) / 0.1)', borderColor: 'hsl(var(--accent) / 0.3)', color: 'hsl(var(--accent))' }}>
                      <span style={{ fontSize: '1rem' }}>📓</span> Synced
                    </div>
                  )}
                  {log.notebookUrl && (
                    <a href={log.notebookUrl} target="_blank" rel="noreferrer" className="tag" style={{ textDecoration: 'none', background: 'hsl(var(--secondary) / 0.1)', borderColor: 'hsl(var(--secondary) / 0.3)', color: 'hsl(var(--secondary))' }}>
                      Open Lab ↗
                    </a>
                  )}
                  {log.details && log.details.length > 0 && log.notebookSyncStatus !== 'success' && (
                    <button
                      onClick={async () => {
                        await fetch('/api/sync', { method: 'POST', body: JSON.stringify({ logId: log.id }), headers: { 'Content-Type': 'application/json' } });
                        fetchData();
                      }}
                      style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', background: 'hsl(var(--secondary) / 0.2)', color: 'hsl(var(--secondary))', border: '1px solid hsl(var(--secondary) / 0.3)' }}
                    >
                      Sync Now
                    </button>
                  )}
                </div>
              </div>

              {log.details && log.details.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '1.2rem', paddingLeft: '3.1rem' }}>
                  {log.details.map((detail, di) => (
                    <a key={di} href={detail.url} target="_blank" rel="noreferrer" className="glass" style={{
                      padding: '1.2rem', display: 'flex', gap: '1rem', textDecoration: 'none', color: 'inherit'
                    }}>
                      <div style={{
                        flexShrink: 0, width: '48px', height: '48px', borderRadius: '10px',
                        background: 'rgba(255,255,255,0.05)', display: 'grid', placeItems: 'center', fontSize: '1.2rem'
                      }}>
                        {detail.source === 'YouTube' ? '🎬' : detail.source === 'Bilibili' ? '📺' : '📰'}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <div style={{ opacity: 0.3, fontSize: '0.7rem', textTransform: 'uppercase', marginBottom: '0.2rem' }}>{detail.source}</div>
                        <div style={{ fontWeight: '600', fontSize: '0.9rem', lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {detail.title}
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </section>
      </main>

      <style jsx>{`
        .log-entry:not(:last-child) {
          margin-bottom: 2rem;
          padding-bottom: 3rem;
          border-bottom: 1px solid hsl(var(--border) / 0.5);
        }
      `}</style>
    </div>
  );
}
