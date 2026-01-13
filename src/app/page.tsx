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
    <section className="glass" style={{ padding: '2rem' }}>
      <div className="section-header">
        <div className="section-title"><span>{icon}</span><span>{label}</span></div>
      </div>
      <div className="tag-list">
        {tags.map((tag, idx) => (
          <div key={idx} className="tag">{tag}<span className="tag-delete" onClick={() => removeTag(idx)}>&times;</span></div>
        ))}
      </div>
      <div className="input-row">
        <input type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={handleKeyDown} placeholder={placeholder} />
        <button onClick={addTag} style={{ background: 'var(--secondary)' }}>Add</button>
      </div>
    </section>
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
    alert(`A browser window will open for ${platform} login. Close the window after you finish logging in.`);
    await fetch('/api/login', {
      method: 'POST',
      body: JSON.stringify({ platform }),
      headers: { 'Content-Type': 'application/json' }
    });
    alert(`${platform} session saved!`);
  };

  if (loading || !config) return <div className="container" style={{ textAlign: 'center', marginTop: '10rem' }}>Loading Dashboard...</div>;

  return (
    <main className="container">
      <header style={{ marginBottom: '3.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="gradient-text" style={{ fontSize: '3rem', fontWeight: '800' }}>Daily Reading</h1>
          <p style={{ opacity: 0.6 }}>Real-time Intelligence Automation.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          {runningStatus && (
            <div className="glass" style={{ padding: '0.8rem 1.5rem', borderColor: 'var(--secondary)', color: 'var(--secondary)', fontWeight: 'bold' }}>
              <span className="pulse" style={{ marginRight: '0.8rem' }}>●</span>
              {runningStatus}
            </div>
          )}
          <button onClick={triggerRun} disabled={!!runningStatus} style={{ background: 'var(--accent)', fontWeight: '600', padding: '1rem 2rem', borderRadius: '14px', opacity: runningStatus ? 0.5 : 1 }}>
            {runningStatus ? 'Working...' : '▶ Start Sync'}
          </button>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
        <TagInput label="YouTube" icon="📺" tags={config.youtube_whitelist} placeholder="Handle (e.g. @a16z) or Name" onTagsChange={(tags) => setConfig({ ...config, youtube_whitelist: tags })} />
        <TagInput label="Bilibili" icon="🎬" tags={config.bilibili_whitelist} placeholder="UP MID (ID numbers, e.g. 11017)" onTagsChange={(tags) => setConfig({ ...config, bilibili_whitelist: tags })} />
        <TagInput label="RSS & Podcasts" icon="🎙️" tags={config.rss_feeds} placeholder="Feed URL" onTagsChange={(tags) => setConfig({ ...config, rss_feeds: tags })} />

        <section className="glass" style={{ padding: '2rem' }}>
          <div className="section-header"><div className="section-title"><span>📰</span><span>HN Filter</span></div></div>
          <input value={config.hn_config.keywords.join(', ')} onChange={(e) => setConfig({ ...config, hn_config: { ...config.hn_config, keywords: e.target.value.split(',').map(k => k.trim()) } })} placeholder="Keywords" />
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <input type="number" value={config.hn_config.minPoints} onChange={(e) => setConfig({ ...config, hn_config: { ...config.hn_config, minPoints: parseInt(e.target.value) } })} />
            <input type="number" value={config.hn_config.maxResults} onChange={(e) => setConfig({ ...config, hn_config: { ...config.hn_config, maxResults: parseInt(e.target.value) } })} />
          </div>
        </section>
      </div>

      {/* Manual Login Section */}
      <section className="glass" style={{ marginTop: '2rem', padding: '2rem' }}>
        <h2 style={{ marginBottom: '1rem', opacity: 0.8 }}>🔐 Session Management</h2>
        <p style={{ opacity: 0.5, marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          If scraping fails due to login requirements, click a button below to open a browser window for manual login.
          Your session will be saved and reused automatically.
        </p>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button onClick={() => triggerLogin('bilibili')} style={{ background: '#00a1d6', padding: '0.8rem 1.5rem', borderRadius: '12px' }}>
            🎬 Login to Bilibili
          </button>
          <button onClick={() => triggerLogin('youtube')} style={{ background: '#ff0000', padding: '0.8rem 1.5rem', borderRadius: '12px' }}>
            📺 Login to YouTube
          </button>
          <button onClick={() => triggerLogin('notebooklm')} style={{ background: '#4285f4', padding: '0.8rem 1.5rem', borderRadius: '12px' }}>
            📓 Login to NotebookLM
          </button>
        </div>
      </section>

      {/* Logs Section */}
      <section className="glass" style={{ marginTop: '2rem', padding: '2rem' }}>
        <h2 style={{ marginBottom: '1.5rem', opacity: 0.8 }}>Recent Activity & Details</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {logs.map((log, i) => (
            <div key={i} style={{ paddingBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <span style={{
                    color: log.status === 'success' ? 'var(--accent)' : '#ff4d4d',
                    fontWeight: '800', marginRight: '1rem'
                  }}>
                    {log.status.toUpperCase()}
                  </span>
                  <span style={{ opacity: 0.5 }}>{log.timestamp}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {/* NotebookLM 同步状态 */}
                  {log.notebookSyncStatus === 'success' && (
                    <span style={{ color: 'var(--accent)', fontSize: '0.85rem' }}>✓ Synced</span>
                  )}
                  {log.notebookSyncStatus === 'failed' && (
                    <span style={{ color: '#ff4d4d', fontSize: '0.85rem' }}>✗ Failed</span>
                  )}
                  {/* 手动 Sync 按钮始终显示（只要有内容） */}
                  {log.details && log.details.length > 0 && (
                    <button
                      onClick={async () => {
                        const res = await fetch('/api/sync', {
                          method: 'POST',
                          body: JSON.stringify({ logId: log.id }),
                          headers: { 'Content-Type': 'application/json' }
                        });
                        // 不弹窗，直接刷新数据显示状态变化
                        fetchData();
                      }}
                      style={{
                        background: log.notebookSyncStatus === 'failed' ? '#ff4d4d' : 'var(--secondary)',
                        padding: '0.5rem 1rem',
                        borderRadius: '8px',
                        fontSize: '0.85rem'
                      }}
                    >
                      📓 {log.notebookSyncStatus === 'failed' ? 'Retry Sync' : 'Sync to NotebookLM'}
                    </button>
                  )}
                  {log.notebookUrl && (
                    <a href={log.notebookUrl} target="_blank" className="tag" style={{ background: 'var(--primary)', color: 'white', textDecoration: 'none' }}>
                      Open NotebookLM ↗
                    </a>
                  )}
                </div>
              </div>

              {log.details && log.details.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                  {log.details.map((detail, di) => (
                    <a key={di} href={detail.url} target="_blank" className="glass" style={{
                      padding: '0.8rem', fontSize: '0.85rem', color: 'inherit', textDecoration: 'none',
                      display: 'flex', flexDirection: 'column', gap: '0.3rem'
                    }}>
                      <div style={{ opacity: 0.4, fontSize: '0.7rem' }}>[{detail.source}]</div>
                      <div style={{ fontWeight: '500' }}>{detail.title}</div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <footer style={{ marginTop: '3rem', display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => fetch('/api/config', { method: 'POST', body: JSON.stringify(config) }).then(() => alert('Saved'))}
          style={{ padding: '0.8rem 3rem', borderRadius: '16px', background: 'linear-gradient(135deg, var(--primary), var(--secondary))' }}>
          Apply Configuration
        </button>
      </footer>

      <style jsx>{`
        .pulse { animation: pulse-animation 2s infinite; }
        @keyframes pulse-animation {
          0% { opacity: 1; }
          50% { opacity: 0.3; }
          100% { opacity: 1; }
        }
      `}</style>
    </main>
  );
}
