'use client';

import { useState, useEffect } from 'react';
import { AppConfig, SourceItem } from '@/lib/coordinator';
import { LogEntry } from '@/lib/logger';

// ==================== Source Card 组件 ====================
interface SourceCardProps {
  source: SourceItem;
  platform: 'youtube' | 'bilibili';
  onToggle: () => void;
  onRemove: () => void;
}

function SourceCard({ source, platform, onToggle, onRemove }: SourceCardProps) {
  const defaultAvatar = platform === 'youtube' ? '📺' : '🎬';

  return (
    <div className="glass" style={{
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
      padding: '1rem',
      opacity: source.enabled ? 1 : 0.5,
      transition: 'all 0.3s ease'
    }}>
      {/* 头像 */}
      <div style={{
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        flexShrink: 0
      }}>
        {source.avatar ? (
          <img src={source.avatar} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontSize: '1.5rem' }}>{defaultAvatar}</span>
        )}
      </div>

      {/* 名称和 ID */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: '600', fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {source.name || source.id}
        </div>
        {source.name && (
          <div style={{ fontSize: '0.75rem', opacity: 0.4 }}>{source.id}</div>
        )}
      </div>

      {/* Toggle 开关 */}
      <button
        onClick={onToggle}
        style={{
          width: '44px',
          height: '24px',
          borderRadius: '12px',
          background: source.enabled ? 'hsl(var(--accent))' : 'rgba(255,255,255,0.1)',
          border: 'none',
          cursor: 'pointer',
          position: 'relative',
          transition: 'all 0.2s ease'
        }}
      >
        <div style={{
          width: '18px',
          height: '18px',
          borderRadius: '50%',
          background: 'white',
          position: 'absolute',
          top: '3px',
          left: source.enabled ? '23px' : '3px',
          transition: 'left 0.2s ease'
        }} />
      </button>

      {/* 删除按钮 */}
      <button
        onClick={onRemove}
        style={{
          width: '28px',
          height: '28px',
          borderRadius: '8px',
          background: 'transparent',
          border: '1px solid rgba(255,255,255,0.1)',
          color: 'rgba(255,255,255,0.3)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1rem',
          transition: 'all 0.2s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'hsl(var(--destructive) / 0.2)';
          e.currentTarget.style.color = 'hsl(var(--destructive))';
          e.currentTarget.style.borderColor = 'hsl(var(--destructive) / 0.5)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = 'rgba(255,255,255,0.3)';
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
        }}
      >
        ×
      </button>
    </div>
  );
}

// ==================== 添加 Source 输入组件 ====================
interface AddSourceProps {
  placeholder: string;
  onAdd: (id: string) => void;
}

function AddSource({ placeholder, onAdd }: AddSourceProps) {
  const [value, setValue] = useState('');

  const handleAdd = () => {
    const trimmed = value.trim();
    if (trimmed) {
      onAdd(trimmed);
      setValue('');
    }
  };

  return (
    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        placeholder={placeholder}
        style={{ flex: 1, fontSize: '0.85rem', padding: '0.6rem 0.8rem' }}
      />
      <button
        onClick={handleAdd}
        style={{
          padding: '0.6rem 1rem',
          background: 'hsl(var(--secondary) / 0.2)',
          border: '1px solid hsl(var(--secondary) / 0.3)',
          color: 'hsl(var(--secondary))',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '0.85rem'
        }}
      >
        + Add
      </button>
    </div>
  );
}

// ==================== 主页面 ====================
export default function Home() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [sessionStatus, setSessionStatus] = useState<Record<string, boolean>>({});
  const [loadingPlatform, setLoadingPlatform] = useState<string | null>(null);
  const [runningStatus, setRunningStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLogs, setShowLogs] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const fetchData = async () => {
    try {
      const [configRes, logsRes, statusRes] = await Promise.all([
        fetch('/api/config'),
        fetch('/api/logs'),
        fetch('/api/status')
      ]);
      setConfig(await configRes.json());
      setLogs(await logsRes.json());
      setSessionStatus(await statusRes.json());
    } catch (e) {
      console.error('Failed to fetch data:', e);
    }
  };

  useEffect(() => {
    fetchData().then(() => setLoading(false));
  }, []);

  // 自动保存 config
  useEffect(() => {
    if (!loading && config) {
      fetch('/api/config', {
        method: 'POST',
        body: JSON.stringify(config),
        headers: { 'Content-Type': 'application/json' }
      }).catch(err => console.error('Auto-save failed:', err));
    }
  }, [config, loading]);

  const triggerRun = () => {
    if (!sessionStatus.notebooklm) {
      const proceed = confirm('NotebookLM hasn\'t been authorized yet. The sync might fail. Would you like to authorize first?');
      if (proceed) {
        triggerLogin();
        return;
      }
    }

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

  const triggerLogin = async () => {
    const ok = confirm('A browser window will open for NotebookLM login. Close the window after you finish logging in. Proceed?');
    if (!ok) return;

    setLoadingPlatform('notebooklm');
    try {
      await fetch('/api/login', {
        method: 'POST',
        body: JSON.stringify({ platform: 'notebooklm' }),
        headers: { 'Content-Type': 'application/json' }
      });
      await fetchData();
    } catch (e) {
      console.error('Login failed:', e);
    } finally {
      setLoadingPlatform(null);
    }
  };

  // Source 操作函数
  const updateSources = (platform: 'youtube' | 'bilibili', sources: SourceItem[]) => {
    if (!config) return;
    setConfig({
      ...config,
      platforms: {
        ...config.platforms,
        [platform]: { sources }
      }
    });
  };

  const addSource = (platform: 'youtube' | 'bilibili', id: string) => {
    const current = config?.platforms?.[platform]?.sources || [];
    if (current.some(s => s.id === id)) return; // 避免重复
    updateSources(platform, [...current, { id, enabled: true }]);
  };

  const toggleSource = (platform: 'youtube' | 'bilibili', idx: number) => {
    const current = config?.platforms?.[platform]?.sources || [];
    const updated = [...current];
    updated[idx] = { ...updated[idx], enabled: !updated[idx].enabled };
    updateSources(platform, updated);
  };

  const removeSource = (platform: 'youtube' | 'bilibili', idx: number) => {
    const current = config?.platforms?.[platform]?.sources || [];
    updateSources(platform, current.filter((_, i) => i !== idx));
  };

  if (loading || !config) return <div style={{ display: 'grid', placeItems: 'center', height: '100vh', fontSize: '1.2rem', opacity: 0.5 }}>Loading Workspace...</div>;

  const youtubeSources = config.platforms?.youtube?.sources || [];
  const bilibiliSources = config.platforms?.bilibili?.sources || [];

  return (
    <div style={{ minHeight: '100vh', padding: '2rem 4rem' }}>
      {/* ===== Header ===== */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
        <div>
          <h1 className="gradient-text" style={{ fontSize: '2rem', marginBottom: '0.3rem' }}>Daily Reading Sync</h1>
          <p style={{ fontSize: '0.85rem', opacity: 0.4 }}>Your automated knowledge pipeline</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {runningStatus && (
            <div className="glass" style={{ padding: '0.8rem 1.5rem', color: 'hsl(var(--secondary))', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
              <div className="pulse" />
              <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>{runningStatus}</span>
            </div>
          )}

          {/* Status badges */}
          <div style={{
            padding: '0.6rem 1rem',
            borderRadius: '12px',
            background: sessionStatus.bilibili ? 'hsl(var(--accent) / 0.1)' : 'hsl(var(--destructive) / 0.15)',
            border: `1px solid ${sessionStatus.bilibili ? 'hsl(var(--accent) / 0.3)' : 'hsl(var(--destructive) / 0.3)'}`,
            fontSize: '0.8rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <span>{sessionStatus.bilibili ? '✅' : '⚠️'}</span>
            <span>Bilibili</span>
          </div>

          <button
            onClick={triggerLogin}
            disabled={loadingPlatform === 'notebooklm'}
            style={{
              padding: '0.6rem 1rem',
              borderRadius: '12px',
              background: sessionStatus.notebooklm ? 'hsl(var(--accent) / 0.1)' : 'hsl(var(--destructive) / 0.15)',
              border: `1px solid ${sessionStatus.notebooklm ? 'hsl(var(--accent) / 0.3)' : 'hsl(var(--destructive) / 0.3)'}`,
              color: 'white',
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <span>{sessionStatus.notebooklm ? '✅' : '🔐'}</span>
            <span>NotebookLM</span>
          </button>

          <button
            onClick={() => setShowSettings(!showSettings)}
            style={{
              padding: '0.6rem 1rem',
              borderRadius: '12px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'white',
              fontSize: '0.8rem',
              cursor: 'pointer'
            }}
          >
            ⚙️ Settings
          </button>

          <button onClick={triggerRun} disabled={!!runningStatus} style={{
            padding: '0.8rem 2rem',
            fontSize: '0.95rem',
            borderRadius: '12px',
            background: 'hsl(var(--accent))',
            color: 'white',
            border: 'none',
            cursor: runningStatus ? 'not-allowed' : 'pointer',
            fontWeight: '600'
          }}>
            {runningStatus ? 'Processing...' : '▶ Start Routine'}
          </button>
        </div>
      </header>

      {/* ===== Settings Panel (collapsible) ===== */}
      {showSettings && (
        <div className="glass" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '1rem', opacity: 0.6 }}>⚙️ Settings</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', opacity: 0.5, display: 'block', marginBottom: '0.5rem' }}>Bilibili SESSDATA</label>
              <input
                type="password"
                value={config.bilibili_sessdata || ''}
                onChange={(e) => setConfig({ ...config, bilibili_sessdata: e.target.value })}
                placeholder="Paste SESSDATA..."
                style={{ width: '100%', fontSize: '0.85rem', padding: '0.6rem 0.8rem' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', opacity: 0.5, display: 'block', marginBottom: '0.5rem' }}>Chrome Executable Path</label>
              <input
                value={config.chrome_exe_path || ''}
                onChange={(e) => setConfig({ ...config, chrome_exe_path: e.target.value })}
                placeholder="/Applications/Google Chrome.app/..."
                style={{ width: '100%', fontSize: '0.85rem', padding: '0.6rem 0.8rem' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ===== Main Content: Sources ===== */}
      <main style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '2rem', marginBottom: '3rem' }}>
        {/* YouTube Sources */}
        <section className="glass" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.5rem' }}>
            <span style={{ fontSize: '1.5rem' }}>📺</span>
            <h2 style={{ fontSize: '1.2rem', fontWeight: '700' }}>YouTube</h2>
            <span style={{ fontSize: '0.8rem', opacity: 0.4, marginLeft: 'auto' }}>
              {youtubeSources.filter(s => s.enabled).length}/{youtubeSources.length} active
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {youtubeSources.map((source, idx) => (
              <SourceCard
                key={source.id}
                source={source}
                platform="youtube"
                onToggle={() => toggleSource('youtube', idx)}
                onRemove={() => removeSource('youtube', idx)}
              />
            ))}
          </div>

          <AddSource placeholder="@channel_handle" onAdd={(id) => addSource('youtube', id)} />
        </section>

        {/* Bilibili Sources */}
        <section className="glass" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.5rem' }}>
            <span style={{ fontSize: '1.5rem' }}>🎬</span>
            <h2 style={{ fontSize: '1.2rem', fontWeight: '700' }}>Bilibili</h2>
            <span style={{ fontSize: '0.8rem', opacity: 0.4, marginLeft: 'auto' }}>
              {bilibiliSources.filter(s => s.enabled).length}/{bilibiliSources.length} active
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {bilibiliSources.map((source, idx) => (
              <SourceCard
                key={source.id}
                source={source}
                platform="bilibili"
                onToggle={() => toggleSource('bilibili', idx)}
                onRemove={() => removeSource('bilibili', idx)}
              />
            ))}
          </div>

          <AddSource placeholder="UP 主 UID" onAdd={(id) => addSource('bilibili', id)} />
        </section>

        {/* RSS Feeds */}
        <section className="glass" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.5rem' }}>
            <span style={{ fontSize: '1.5rem' }}>🎙️</span>
            <h2 style={{ fontSize: '1.2rem', fontWeight: '700' }}>RSS Feeds</h2>
            <span style={{ fontSize: '0.8rem', opacity: 0.4, marginLeft: 'auto' }}>
              {config.rss_feeds?.length || 0} feeds
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {(config.rss_feeds || []).map((feed, idx) => (
              <div key={idx} className="glass" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.8rem' }}>
                <span style={{ fontSize: '1.2rem' }}>📡</span>
                <div style={{ flex: 1, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {feed}
                </div>
                <button
                  onClick={() => setConfig({ ...config, rss_feeds: config.rss_feeds.filter((_, i) => i !== idx) })}
                  style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '1rem' }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <AddSource
            placeholder="RSS Feed URL"
            onAdd={(url) => setConfig({ ...config, rss_feeds: [...(config.rss_feeds || []), url] })}
          />
        </section>
      </main>

      {/* ===== Sync Logs (collapsible) ===== */}
      <section>
        <button
          onClick={() => setShowLogs(!showLogs)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.8rem',
            background: 'transparent',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            fontSize: '1rem',
            marginBottom: '1rem',
            opacity: 0.6
          }}
        >
          <span style={{ transform: showLogs ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▶</span>
          📋 Sync History ({logs.length} entries)
        </button>

        {showLogs && (
          <div className="glass" style={{ padding: '1.5rem' }}>
            {logs.length === 0 ? (
              <p style={{ opacity: 0.4, textAlign: 'center', padding: '2rem' }}>No sync history yet</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {logs.slice(0, 10).map((log, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.8rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '8px',
                      background: log.status === 'success' ? 'hsl(var(--accent) / 0.2)' : 'hsl(var(--destructive) / 0.2)',
                      display: 'grid', placeItems: 'center',
                      color: log.status === 'success' ? 'hsl(var(--accent))' : 'hsl(var(--destructive))',
                      fontSize: '0.9rem'
                    }}>
                      {log.status === 'success' ? '✓' : '!'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{log.message}</div>
                      <div style={{ fontSize: '0.75rem', opacity: 0.4 }}>{log.timestamp}</div>
                    </div>
                    {log.notebookUrl && (
                      <a href={log.notebookUrl} target="_blank" rel="noreferrer" style={{
                        padding: '0.4rem 0.8rem',
                        background: 'hsl(var(--secondary) / 0.2)',
                        border: '1px solid hsl(var(--secondary) / 0.3)',
                        borderRadius: '8px',
                        color: 'hsl(var(--secondary))',
                        textDecoration: 'none',
                        fontSize: '0.75rem'
                      }}>
                        Open Lab ↗
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
