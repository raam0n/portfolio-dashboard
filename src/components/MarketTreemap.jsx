import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';

// ── Squarified Treemap Layout Algorithm (pure JS, zero dependencies) ──────────
function squarify(items, x, y, w, h) {
  if (!items.length || w <= 0 || h <= 0) return [];
  const total = items.reduce((s, it) => s + it.size, 0);
  if (total <= 0) return [];

  const rects = [];
  let remaining = [...items];
  let cx = x, cy = y, cw = w, ch = h;

  while (remaining.length > 0) {
    const remTotal = remaining.reduce((s, it) => s + it.size, 0);
    const isVertical = cw >= ch;
    const side = isVertical ? ch : cw;

    // Greedy: keep adding items to the current row while the aspect ratio improves
    let row = [remaining[0]];
    let bestWorst = worstAspect(row, side, remTotal, cw * ch);

    for (let i = 1; i < remaining.length; i++) {
      const candidate = [...row, remaining[i]];
      const candidateWorst = worstAspect(candidate, side, remTotal, cw * ch);
      if (candidateWorst <= bestWorst) {
        row = candidate;
        bestWorst = candidateWorst;
      } else {
        break;
      }
    }

    // Layout the row
    const rowSum = row.reduce((s, it) => s + it.size, 0);
    const rowFrac = rowSum / remTotal;

    let rx = cx, ry = cy;
    if (isVertical) {
      const rowWidth = cw * rowFrac;
      let runY = cy;
      for (const item of row) {
        const itemFrac = item.size / rowSum;
        const itemH = ch * itemFrac;
        rects.push({ ...item, x: rx, y: runY, w: rowWidth, h: itemH });
        runY += itemH;
      }
      cx += rowWidth;
      cw -= rowWidth;
    } else {
      const rowHeight = ch * rowFrac;
      let runX = cx;
      for (const item of row) {
        const itemFrac = item.size / rowSum;
        const itemW = cw * itemFrac;
        rects.push({ ...item, x: runX, y: ry, w: itemW, h: rowHeight });
        runX += itemW;
      }
      cy += rowHeight;
      ch -= rowHeight;
    }

    remaining = remaining.slice(row.length);
  }

  return rects;
}

function worstAspect(row, side, total, area) {
  let worst = 0;
  const rowSum = row.reduce((s, it) => s + it.size, 0);
  const rowFrac = rowSum / total;
  const rowSide = area * rowFrac / side;

  for (const item of row) {
    const itemFrac = item.size / rowSum;
    const other = side * itemFrac;
    if (other === 0 || rowSide === 0) continue;
    const ar = Math.max(other / rowSide, rowSide / other);
    worst = Math.max(worst, ar);
  }
  return worst;
}

// ── Color helpers ─────────────────────────────────────────────────────────────
function getBlockColor(changePct) {
  if (changePct === undefined || changePct === null) return '#3a3a4a';
  if (changePct >= 3) return '#006d32';
  if (changePct >= 1) return '#27a844';
  if (changePct > 0) return '#5cb85c';
  if (changePct === 0) return '#4a4a5a';
  if (changePct > -1) return '#d9534f';
  if (changePct > -3) return '#c9302c';
  return '#8b1a1a';
}

// ── GROUP HEADER COLORS ──────────────────────────────────────────────────────
const GROUP_COLORS = [
  'rgba(99,102,241,0.35)',
  'rgba(236,72,153,0.30)',
  'rgba(16,185,129,0.30)',
  'rgba(245,158,11,0.30)',
  'rgba(59,130,246,0.30)',
  'rgba(168,85,247,0.30)',
  'rgba(20,184,166,0.30)',
  'rgba(239,68,68,0.30)',
];

// ── TYPE FILTER DEFINITIONS ──────────────────────────────────────────────────
const TYPE_OPTIONS = [
  { value: 'accion', label: 'Acciones AR', emoji: '🇦🇷' },
  { value: 'cedear', label: 'CEDEARs', emoji: '📜' },
  { value: 'stock', label: 'Stocks US', emoji: '🇺🇸' },
];

// ── Tooltip component ─────────────────────────────────────────────────────────
const Tooltip = ({ data, mousePos, containerRect, period = '1d' }) => {
  if (!data || !containerRect) return null;
  
  const estimatedWidth = 240;
  const estimatedHeight = 220;
  let left = mousePos.x - containerRect.left + 12;
  let top = mousePos.y - containerRect.top - 10;
  
  if (left + estimatedWidth > containerRect.width) {
    left = mousePos.x - containerRect.left - estimatedWidth - 12;
  }
  
  if (top + estimatedHeight > containerRect.height) {
    top = mousePos.y - containerRect.top - estimatedHeight + 10;
  }

  const fmtMcap = (v, curr = 'USD') => {
    if (!v) return 'N/A';
    if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T (${curr})`;
    if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B (${curr})`;
    if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M (${curr})`;
    return `$${v.toLocaleString()} (${curr})`;
  };

  const tipoLabels = { accion: 'Acción AR', cedear: 'CEDEAR', stock: 'Stock US' };

  const periodLabels = {
    '1d': '1D',
    '5d': '5D',
    '1m': '1M',
    '6m': '6M',
    '1y': '1A',
    '5y': '5A'
  };

  return (
    <div style={{
      position: 'absolute', left, top, zIndex: 100, pointerEvents: 'none',
      background: 'rgba(20,20,30,0.95)', border: '1px solid rgba(255,255,255,0.15)',
      borderRadius: '8px', padding: '12px 16px', color: '#fff',
      fontSize: '13px', minWidth: '180px', maxWidth: '280px',
      backdropFilter: 'blur(12px)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    }}>
      <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '2px', lineHeight: '1.2' }}>{data.nombre || data.name}</div>
      <div style={{ color: '#aaa', fontSize: '11px', marginBottom: '8px', letterSpacing: '0.5px' }}>{data.name}</div>
      {data.tipo && <div style={{ color: '#ccc', marginBottom: '2px' }}>Tipo: <span style={{color: '#fff'}}>{tipoLabels[data.tipo] || data.tipo}</span></div>}
      {data.sector && <div style={{ color: '#ccc', marginBottom: '2px' }}>Sector: <span style={{color: '#fff'}}>{data.sector}</span></div>}
      {data.subsector && <div style={{ color: '#ccc', marginBottom: '2px' }}>Subsector: <span style={{color: '#fff'}}>{data.subsector}</span></div>}
      {data.pais && <div style={{ color: '#ccc', marginBottom: '2px' }}>País: <span style={{color: '#fff'}}>{data.pais}</span></div>}
      <div style={{ marginBottom: '2px' }}>
        Cambio ({periodLabels[period] || '1D'}): <strong style={{ color: data.changePct > 0 ? '#28a745' : data.changePct < 0 ? '#dc3545' : '#aaa' }}>
          {data.changePct != null ? `${data.changePct > 0 ? '+' : ''}${data.changePct.toFixed(2)}%` : 'N/A'}
        </strong>
      </div>
      {data.marketCap > 0 && <div>Market Cap: {fmtMcap(data.marketCap, data.marketCapCurrency)}</div>}
      {data.portfolioValue > 0 && <div style={{ marginTop: '4px' }}>Valor Portafolio: ${data.portfolioValue.toLocaleString()}</div>}
    </div>
  );
};

// ── Toggle Button for type filter ────────────────────────────────────────────
const TypeToggle = ({ option, active, onClick }) => (
  <button
    onClick={onClick}
    style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '5px 12px', borderRadius: '20px',
      fontSize: '12px', fontWeight: active ? 600 : 400,
      cursor: 'pointer',
      border: active ? '1.5px solid rgba(99,102,241,0.7)' : '1px solid rgba(255,255,255,0.12)',
      background: active ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.04)',
      color: active ? '#c7c7ff' : 'rgba(255,255,255,0.5)',
      transition: 'all 0.2s ease',
      outline: 'none',
    }}
    onMouseEnter={e => {
      if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
    }}
    onMouseLeave={e => {
      if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
    }}
  >
    <span style={{ fontSize: '13px' }}>{option.emoji}</span>
    {option.label}
  </button>
);

// ── Main Component ────────────────────────────────────────────────────────────
const MarketTreemap = ({ assets = [], dolarCcl }) => {
  const [grouping, setGrouping] = useState('sector');
  const [sizing, setSizing] = useState('marketCap');
  const [period, setPeriod] = useState('1d');
  const [activeTypes, setActiveTypes] = useState(['accion', 'cedear', 'stock']); // all active by default
  const [marketCaps, setMarketCaps] = useState({});
  const [loadingCaps, setLoadingCaps] = useState(false);
  const [hoveredItem, setHoveredItem] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  const periodLabels = {
    '1d': '1D',
    '5d': '5D',
    '1m': '1M',
    '6m': '6M',
    '1y': '1A',
    '5y': '5A'
  };

  // Toggle a type filter
  const toggleType = useCallback((tipo) => {
    setActiveTypes(prev => {
      if (prev.includes(tipo)) {
        // Don't allow deselecting ALL — keep at least one
        if (prev.length <= 1) return prev;
        return prev.filter(t => t !== tipo);
      } else {
        return [...prev, tipo];
      }
    });
  }, []);

  // Filter assets by selected types
  const filteredAssets = useMemo(() => {
    return assets.filter(a => activeTypes.includes(a.tipo));
  }, [assets, activeTypes]);

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerSize({ w: entry.contentRect.width, h: entry.contentRect.height });
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Fetch Market Caps — use yahooTicker for the API call
  useEffect(() => {
    const fetchMarketCaps = async () => {
      // Build a map from yahooTicker → local ticker for deduplication
      const yahooTickers = [...new Set(filteredAssets.map(a => a.yahooTicker).filter(Boolean))];
      if (yahooTickers.length === 0) return;

      setLoadingCaps(true);
      try {
        const chunks = [];
        for (let i = 0; i < yahooTickers.length; i += 50) {
          chunks.push(yahooTickers.slice(i, i + 50));
        }
        const newCaps = { ...marketCaps };
        for (const chunk of chunks) {
          try {
            const url = `/api/market/v11/finance/quote?symbols=${chunk.join(',')}`;
            const res = await fetch(url);
            const data = await res.json();
            const results = data?.quoteResponse?.result || [];
            for (const item of results) {
              if (item.symbol && item.marketCap) {
                newCaps[item.symbol] = {
                  marketCap: item.marketCap,
                  currency: item.currency || 'USD'
                };
              }
            }
          } catch (e) {
            console.warn('Chunk fetch failed:', e);
          }
        }
        setMarketCaps(newCaps);
      } catch (err) {
        console.error('Failed to fetch market caps:', err);
      } finally {
        setLoadingCaps(false);
      }
    };

    fetchMarketCaps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredAssets.map(a => a.yahooTicker).sort().join(',')]);

  // Build grouped data
  const groupedData = useMemo(() => {
    const getCapTier = (cap, currency) => {
      if (!cap) return 'Desconocido';
      let checkCap = cap;
      if (currency === 'ARS') {
        checkCap = cap / (dolarCcl || 1200);
      }
      if (checkCap > 200e9) return 'Mega Cap (>200B)';
      if (checkCap > 10e9) return 'Large Cap (10B-200B)';
      if (checkCap > 2e9) return 'Mid Cap (2B-10B)';
      return 'Small/Micro Cap (<2B)';
    };

    const groups = {};
    for (const a of filteredAssets) {
      // Look up market cap by yahooTicker (the key Yahoo returns)
      const capInfo = marketCaps[a.yahooTicker];
      const mcapRaw = capInfo ? capInfo.marketCap : 0;
      const currency = capInfo ? capInfo.currency : 'USD';

      // Normalize to USD for size comparison if currency is ARS
      let mcap = mcapRaw;
      if (currency === 'ARS') {
        mcap = mcapRaw / (dolarCcl || 1200);
      }

      let groupKey = 'Otros';
      if (grouping === 'sector') groupKey = a.sector || 'Sin Sector';
      else if (grouping === 'subsector') groupKey = a.subsector || 'Sin Subsector';
      else if (grouping === 'pais') groupKey = a.pais || 'Desconocido';
      else if (grouping === 'marketCapTier') groupKey = getCapTier(mcapRaw, currency);

      if (!groups[groupKey]) groups[groupKey] = [];

      let calcSize = 1;
      if (sizing === 'marketCap') {
        // Enforce square root scaling so that wide-range caps are visible without shrinking smaller caps to 0 width/height.
        // Fallback to 500M USD if market cap is missing, so it doesn't get squished to invisibility.
        const sizeVal = mcap > 0 ? mcap : 500e6;
        calcSize = Math.sqrt(sizeVal);
      } else if (sizing === 'portfolioValue') {
        calcSize = a.value > 0 ? a.value : 0;
      }

      let activeChange = a.changePct;
      if (period === '5d') activeChange = a.hist5d;
      else if (period === '1m') activeChange = a.hist1m;
      else if (period === '6m') activeChange = a.hist6m;
      else if (period === '1y') activeChange = a.hist1y;
      else if (period === '5y') activeChange = a.hist5y;

      const existing = groups[groupKey].find(item => item.name === a.ticker);
      if (existing) {
        existing.portfolioValue = (existing.portfolioValue || 0) + (a.value || 0);
        if (sizing === 'portfolioValue') existing.size = Math.max(1, existing.portfolioValue);
      } else {
        if (sizing === 'portfolioValue' && calcSize <= 0) continue;
        groups[groupKey].push({
          name: a.ticker,
          nombre: a.nombre,
          subsector: a.subsector,
          size: Math.max(1, calcSize),
          changePct: activeChange,
          sector: a.sector,
          pais: a.pais,
          tipo: a.tipo,
          marketCap: mcapRaw,
          marketCapCurrency: currency,
          portfolioValue: a.value || 0,
        });
      }
    }

    return Object.entries(groups)
      .map(([name, children]) => ({ name, children: children.sort((a, b) => b.size - a.size) }))
      .filter(g => g.children.length > 0)
      .sort((a, b) => {
        const sa = a.children.reduce((s, c) => s + c.size, 0);
        const sb = b.children.reduce((s, c) => s + c.size, 0);
        return sb - sa;
      });
  }, [filteredAssets, grouping, sizing, period, marketCaps, dolarCcl]);

  // Compute layout
  const layout = useMemo(() => {
    const { w, h } = containerSize;
    if (w <= 0 || h <= 0 || groupedData.length === 0) return [];

    const HEADER_H = 22;
    // First, layout groups as top-level blocks
    const groupItems = groupedData.map(g => ({
      ...g,
      size: g.children.reduce((s, c) => s + c.size, 0),
    }));

    const groupRects = squarify(groupItems, 0, 0, w, h);

    // Then, layout children inside each group rect
    const result = [];
    groupRects.forEach((gr, gi) => {
      const innerY = gr.y + HEADER_H;
      const innerH = gr.h - HEADER_H;
      const childRects = innerH > 5
        ? squarify(gr.children, gr.x + 1, innerY, gr.w - 2, innerH - 1)
        : [];

      result.push({
        type: 'group',
        name: gr.name,
        x: gr.x, y: gr.y, w: gr.w, h: gr.h,
        colorIdx: gi,
      });
      childRects.forEach(cr => {
        result.push({
          type: 'leaf',
          ...cr,
        });
      });
    });

    return result;
  }, [containerSize, groupedData]);

  const handleMouseMove = useCallback((e) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  }, []);

  const containerRect = containerRef.current?.getBoundingClientRect();

  // Count assets per type for badge display
  const typeCounts = useMemo(() => {
    const counts = {};
    for (const a of assets) {
      counts[a.tipo] = (counts[a.tipo] || 0) + 1;
    }
    return counts;
  }, [assets]);

  return (
    <div className="glass-panel" style={{ padding: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div className="panel-title" style={{ fontSize: '18px', marginBottom: '4px' }}>
            🗺️ Mapa de Mercado
          </div>
          <p className="hint" style={{ margin: 0, fontSize: '12px' }}>
            Tamaño proporcional al {sizing === 'marketCap' ? 'market cap' : 'valor en portafolio'}. Color = cambio ({periodLabels[period] || '1D'}).
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: '11px', marginRight: '5px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Periodo:</label>
            <select
              value={period}
              onChange={e => setPeriod(e.target.value)}
              style={{
                padding: '6px 10px', borderRadius: '6px',
                backgroundColor: '#1a1a2e', color: '#fff',
                border: '1px solid rgba(255,255,255,0.15)', fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              <option value="1d" style={{ backgroundColor: '#1a1a2e', color: '#fff' }}>1 Día</option>
              <option value="5d" style={{ backgroundColor: '#1a1a2e', color: '#fff' }}>5 Días</option>
              <option value="1m" style={{ backgroundColor: '#1a1a2e', color: '#fff' }}>1 Mes</option>
              <option value="6m" style={{ backgroundColor: '#1a1a2e', color: '#fff' }}>6 Meses</option>
              <option value="1y" style={{ backgroundColor: '#1a1a2e', color: '#fff' }}>1 Año</option>
              <option value="5y" style={{ backgroundColor: '#1a1a2e', color: '#fff' }}>5 Años</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '11px', marginRight: '5px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Agrupar:</label>
            <select
              value={grouping}
              onChange={e => setGrouping(e.target.value)}
              style={{
                padding: '6px 10px', borderRadius: '6px',
                backgroundColor: '#1a1a2e', color: '#fff',
                border: '1px solid rgba(255,255,255,0.15)', fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              <option value="sector" style={{ backgroundColor: '#1a1a2e', color: '#fff' }}>Sector</option>
              <option value="subsector" style={{ backgroundColor: '#1a1a2e', color: '#fff' }}>Subsector</option>
              <option value="pais" style={{ backgroundColor: '#1a1a2e', color: '#fff' }}>País</option>
              <option value="marketCapTier" style={{ backgroundColor: '#1a1a2e', color: '#fff' }}>Market Cap (Tiers)</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '11px', marginRight: '5px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tamaño:</label>
            <select
              value={sizing}
              onChange={e => setSizing(e.target.value)}
              style={{
                padding: '6px 10px', borderRadius: '6px',
                backgroundColor: '#1a1a2e', color: '#fff',
                border: '1px solid rgba(255,255,255,0.15)', fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              <option value="marketCap" style={{ backgroundColor: '#1a1a2e', color: '#fff' }}>Market Cap (Global)</option>
              <option value="portfolioValue" style={{ backgroundColor: '#1a1a2e', color: '#fff' }}>Valor en Mi Portafolio</option>
            </select>
          </div>
        </div>
      </div>

      {/* Type Filter Toggles */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginRight: '4px' }}>Mostrar:</span>
        {TYPE_OPTIONS.map(opt => (
          <TypeToggle
            key={opt.value}
            option={{ ...opt, label: `${opt.label} (${typeCounts[opt.value] || 0})` }}
            active={activeTypes.includes(opt.value)}
            onClick={() => toggleType(opt.value)}
          />
        ))}
      </div>

      {loadingCaps && Object.keys(marketCaps).length === 0 && (
        <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '10px' }}>
          ⏳ Cargando Market Caps desde Yahoo Finance...
        </div>
      )}

      {/* Treemap Canvas */}
      <div
        ref={containerRef}
        style={{ width: '100%', height: '800px', position: 'relative', borderRadius: '8px', overflow: 'hidden', background: 'rgba(0,0,0,0.2)' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredItem(null)}
      >
        {containerSize.w > 0 && layout.length > 0 ? (
          <svg width={containerSize.w} height={containerSize.h} style={{ display: 'block' }}>
            {layout.map((item, i) => {
              if (item.type === 'group') {
                return (
                  <g key={`g-${i}`}>
                    {/* Group background */}
                    <rect
                      x={item.x} y={item.y}
                      width={Math.max(0, item.w)} height={Math.max(0, item.h)}
                      fill={GROUP_COLORS[item.colorIdx % GROUP_COLORS.length]}
                      stroke="rgba(255,255,255,0.08)" strokeWidth="1"
                    />
                    {/* Group header label */}
                    {item.w > 40 && (
                      <text
                        x={item.x + 8} y={item.y + 15}
                        fill="rgba(255,255,255,0.75)" fontSize="12" fontWeight="600"
                        style={{ pointerEvents: 'none', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}
                      >
                        {item.name.length > item.w / 7 ? item.name.slice(0, Math.floor(item.w / 7)) + '…' : item.name}
                      </text>
                    )}
                  </g>
                );
              }

              // Leaf node
              const isHovered = hoveredItem?.name === item.name;
              return (
                <g
                  key={`l-${i}`}
                  onMouseEnter={() => setHoveredItem(item)}
                  onMouseLeave={() => setHoveredItem(null)}
                  style={{ cursor: 'pointer' }}
                >
                  <rect
                    x={item.x + 1} y={item.y + 1}
                    width={Math.max(0, item.w - 2)} height={Math.max(0, item.h - 2)}
                    rx="3" ry="3"
                    fill={getBlockColor(item.changePct)}
                    stroke={isHovered ? '#fff' : 'rgba(0,0,0,0.4)'}
                    strokeWidth={isHovered ? 2 : 1}
                    opacity={hoveredItem && !isHovered ? 0.6 : 1}
                    style={{ transition: 'opacity 0.15s, stroke 0.15s' }}
                  />
                  {/* Ticker name */}
                  {item.w > 35 && item.h > 28 && (
                    <text
                      x={item.x + item.w / 2} y={item.y + item.h / 2 - (item.h > 45 ? 4 : 0)}
                      textAnchor="middle" dominantBaseline="central"
                      fill="#fff" fontSize={item.w > 80 ? 14 : 11} fontWeight="700"
                      style={{ pointerEvents: 'none', textShadow: '0 1px 4px rgba(0,0,0,0.7)' }}
                    >
                      {item.name}
                    </text>
                  )}
                  {/* Change % */}
                  {item.w > 45 && item.h > 45 && (
                    <text
                      x={item.x + item.w / 2} y={item.y + item.h / 2 + 14}
                      textAnchor="middle" dominantBaseline="central"
                      fill="rgba(255,255,255,0.85)" fontSize={item.w > 80 ? 12 : 10}
                      style={{ pointerEvents: 'none' }}
                    >
                      {item.changePct != null ? `${item.changePct > 0 ? '+' : ''}${item.changePct.toFixed(2)}%` : '—'}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        ) : (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            {filteredAssets.length === 0 ? 'No hay activos del tipo seleccionado. Probá activando otro filtro.' : 'Cargando mapa...'}
          </div>
        )}

        {/* Hover Tooltip */}
        <Tooltip data={hoveredItem} mousePos={mousePos} containerRect={containerRect} period={period} />
      </div>
    </div>
  );
};

export default MarketTreemap;
