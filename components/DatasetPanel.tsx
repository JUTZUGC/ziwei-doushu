'use client';

import { useEffect, useState } from 'react';
import type { ZiweiChart } from '@/lib/ziwei/types';

const LABELS: Record<string, string> = {
  overview: '命格总览',
  personality: '性格特质',
  love: '感情婚姻',
  career: '事业职业',
  wealth: '财富运势',
  health: '健康状况',
  family: '兄弟合伙',
  children: '子女缘分',
  move: '迁移外出',
  friends: '人际贵人',
  home: '田宅不动产',
  spirit: '精神福德',
  parents: '父母长辈',
};
const ORDER = Object.keys(LABELS);

interface DatasetResponse {
  available: boolean;
  key: string;
  error?: string;
  hints?: string[];
  dimensions?: Record<string, string>;
  offerDownload?: {
    year: number;
    tool: string;
    arguments: { year: number };
    estimatedDownloadMB: number;
    message: string;
  };
}

export default function DatasetPanel({ chart }: { chart: ZiweiChart }) {
  const [data, setData] = useState<DatasetResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState('overview');
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const b = chart.birthInfo;
    const q = new URLSearchParams({
      year: String(b.year),
      month: String(b.month),
      day: String(b.day),
      hour: String(b.hour),
      gender: b.gender,
    });
    setLoading(true);
    fetch(`/api/dataset?${q.toString()}`)
      .then(async (res) => {
        const json = (await res.json()) as DatasetResponse;
        setData(json);
        if (json.dimensions && !json.dimensions[active]) {
          setActive(Object.keys(json.dimensions)[0] ?? 'overview');
        }
      })
      .catch(() => setData({ available: false, key: '', error: '解读数据请求失败' }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chart, reloadKey]);

  const handleDownload = async () => {
    const year = data?.offerDownload?.year ?? chart.birthInfo.year;
    setFetching(true);
    setFetchError('');
    try {
      const res = await fetch('/api/dataset/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? '导入失败');
      setReloadKey((k) => k + 1);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : String(e));
    } finally {
      setFetching(false);
    }
  };

  const dims = data?.dimensions ?? {};

  return (
    <section
      style={{
        marginTop: 20,
        border: '1px solid rgba(200,160,60,0.25)',
        borderRadius: 16,
        background: 'var(--bg-card, rgba(255,255,255,0.03))',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(200,160,60,0.18)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 12, letterSpacing: '0.2em', color: '#c8a020' }}>数据集解读</span>
        <span style={{ fontSize: 10, color: '#888' }}>官方 v4.0 · CC BY 4.0</span>
        <span style={{ flex: 1 }} />
        {loading && <span style={{ fontSize: 10, color: '#888' }}>读取中…</span>}
      </div>

      {!loading && data && !data.available && (
        <div style={{ padding: 16, fontSize: 12, lineHeight: 1.8, color: '#999' }}>
          <div>{data.error ?? '本地还没有导入解读数据集'}</div>
          {data.offerDownload && (
            <div style={{ marginTop: 10 }}>
              <div style={{ color: '#c8a020' }}>{data.offerDownload.message}</div>
              <button
                onClick={handleDownload}
                disabled={fetching}
                style={{
                  marginTop: 8,
                  padding: '8px 16px',
                  borderRadius: 10,
                  fontSize: 12,
                  cursor: fetching ? 'wait' : 'pointer',
                  border: '1px solid rgba(200,160,60,0.5)',
                  background: fetching ? 'rgba(200,160,60,0.1)' : 'rgba(200,160,60,0.16)',
                  color: '#c8a020',
                }}
              >
                {fetching
                  ? '正在下载并导入，请稍候…'
                  : `下载并导入 ${data.offerDownload.year} 年数据（约 ${data.offerDownload.estimatedDownloadMB} MB）`}
              </button>
            </div>
          )}
          {fetchError && <div style={{ marginTop: 8, color: '#f87171' }}>导入失败：{fetchError}</div>}
          <div style={{ marginTop: 10, color: '#777', fontSize: 11 }}>
            也可以手动执行 npm run data:fetch -- --years {chart.birthInfo.year}
          </div>
          <div style={{ marginTop: 6 }}>导入后自动刷新；排盘与 AI 分析不受影响。</div>
        </div>
      )}

      {data?.available && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '10px 12px', borderBottom: '1px solid rgba(200,160,60,0.12)' }}>
            {ORDER.filter((k) => dims[k]).map((k) => (
              <button
                key={k}
                onClick={() => setActive(k)}
                style={{
                  padding: '4px 9px', borderRadius: 999, fontSize: 11, cursor: 'pointer',
                  border: `1px solid ${active === k ? 'rgba(200,160,60,0.6)' : 'rgba(160,160,160,0.2)'}`,
                  background: active === k ? 'rgba(200,160,60,0.12)' : 'transparent',
                  color: active === k ? '#c8a020' : '#999',
                }}
              >
                {LABELS[k] ?? k}
              </button>
            ))}
          </div>
          <div style={{ padding: '14px 16px', fontSize: 12, lineHeight: 1.85, color: 'var(--tx-2, #bbb)', whiteSpace: 'pre-wrap', maxHeight: 420, overflowY: 'auto' }}>
            {dims[active] ?? '这个维度没有内容'}
          </div>
        </>
      )}
    </section>
  );
}
