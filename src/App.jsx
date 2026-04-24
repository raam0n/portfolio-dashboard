import React, { useState, useEffect } from 'react';
import './index.css';

// ── Pure SVG Pie Chart ────────────────────────────────────────────────────────
const CHART_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6',
  '#a855f7', '#ec4899', '#14b8a6', '#f97316', '#84cc16',
  '#06b6d4', '#e11d48', '#8b5cf6', '#22d3ee', '#fb923c',
];
const GLOBAL_INDICES = [
  { ticker: '^GSPC', name: 'S&P 500', desc: 'Benchmark principal del mercado estadounidense.' },
  { ticker: '^DJI', name: 'Dow Jones', desc: 'Índice industrial de referencia de las 30 mayores empresas de EE.UU.' },
  { ticker: '^IXIC', name: 'Nasdaq', desc: 'Índice enfocado en empresas tecnológicas y de crecimiento.' },
  { ticker: '^VIX', name: 'VIX (Miedo)', desc: 'Índice de volatilidad; clave para medir el sentimiento de "miedo" en el mercado.' },
  { ticker: '^STOXX50E', name: 'Euro Stoxx 50', desc: 'El índice más representativo de las 50 mayores empresas de la Eurozona.' },
  { ticker: 'EWZ', name: 'Bovespa (USD)', desc: 'iShares MSCI Brazil ETF; usado como proxy del mercado brasileño en dólares.' },
  { ticker: 'MERVAL_USD', name: 'Merval (USD)', desc: 'Índice S&P Merval dividido por el Dólar CCL. Refleja el valor real en dólares de las acciones argentinas.', isCalculated: true },
  { ticker: '^TNX', name: '10Y Yield', desc: 'Rendimiento del bono del Tesoro a 10 años. Si sube, suele presionar a la baja a las acciones y encarece el crédito.' },
  { ticker: 'GC=F', name: 'Oro', desc: 'Futuros del Oro. Activo refugio por excelencia ante incertidumbre o inflación.' },
  { ticker: 'DX-Y.NYB', name: 'DXY', desc: 'Índice Dólar. Mide la fortaleza del dólar frente a otras divisas. Si sube, los emergentes suelen sufrir.' },
  { ticker: 'CL=F', name: 'WTI Oil', desc: 'Crudo West Texas Intermediate. Referencia principal del petróleo en EE.UU.' },
  { ticker: 'BZ=F', name: 'Brent Oil', desc: 'Petróleo Brent. Referencia global para el mercado europeo y mundial.' },
  { ticker: 'BTC-USD', name: 'Bitcoin', desc: 'Referencia principal del mercado de criptoactivos.' },
];

const fmt = (n, dec = 2) => {
  if (n == null || isNaN(n)) return '—';
  return new Intl.NumberFormat('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n);
};

const fmtPct = (n) => {
  if (n == null || isNaN(n)) return '—';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${fmt(n, 2)}%`;
};



function PieChart({ data, title }) {
  const [hovered, setHovered] = React.useState(null);

  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0 || data.length === 0) {
    return (
      <div className="pie-chart-wrapper">
        <div className="pie-chart-title">{title}</div>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', padding: '40px 0' }}>Sin datos</div>
      </div>
    );
  }

  const cx = 80, cy = 80, r = 68;
  let cumAngle = -Math.PI / 2;
  const slices = data.map((d, i) => {
    const angle = (d.value / total) * 2 * Math.PI;
    const startAngle = cumAngle;
    cumAngle += angle;
    const endAngle = cumAngle;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = angle > Math.PI ? 1 : 0;
    const midAngle = startAngle + angle / 2;
    return { ...d, x1, y1, x2, y2, largeArc, midAngle, angle, color: CHART_COLORS[i % CHART_COLORS.length], pct: (d.value / total) * 100 };
  });

  const hov = hovered !== null ? slices[hovered] : null;

  return (
    <div className="pie-chart-wrapper">
      <div className="pie-chart-title">{title}</div>
      <div className="pie-chart-body">
        <svg viewBox="0 0 160 160" width="160" height="160" style={{ flexShrink: 0 }}>
          <circle cx={cx} cy={cy} r={r} fill="rgba(0,0,0,0.2)" />
          {slices.map((s, i) => (
            <path
              key={i}
              d={`M${cx},${cy} L${s.x1},${s.y1} A${r},${r} 0 ${s.largeArc},1 ${s.x2},${s.y2} Z`}
              fill={s.color}
              opacity={hovered === null || hovered === i ? 1 : 0.35}
              stroke="rgba(15,17,25,0.8)"
              strokeWidth="1.5"
              style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
              transform={hovered === i ? `translate(${Math.cos(s.midAngle) * 4},${Math.sin(s.midAngle) * 4})` : ''}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
          {/* Inner hole */}
          <circle cx={cx} cy={cy} r={36} fill="rgba(15,17,25,0.9)" style={{ pointerEvents: 'none' }} />
          {/* Center label */}
          {hov ? (
            <>
              <text x={cx} y={cy - 8} textAnchor="middle" fill="white" fontSize="13" fontWeight="700">{hov.pct.toFixed(1)}%</text>
              <text x={cx} y={cy + 8} textAnchor="middle" fill="#aaa" fontSize="9">{hov.label.length > 10 ? hov.label.slice(0, 10) + '…' : hov.label}</text>
            </>
          ) : (
            <text x={cx} y={cy + 4} textAnchor="middle" fill="#888" fontSize="10">{data.length} items</text>
          )}
        </svg>
        <ul className="pie-legend">
          {slices.map((s, i) => (
            <li
              key={i}
              className={`pie-legend-item ${hovered === i ? 'pie-legend-hovered' : ''}`}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <span className="pie-dot" style={{ background: s.color }} />
              <span className="pie-legend-label">{s.label}</span>
              <span className="pie-legend-pct">{s.pct.toFixed(1)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

function HistoricalChart({ data, ticker, name }) {
  const [range, setRange] = React.useState('1Y');
  const [hoverIdx, setHoverIdx] = React.useState(null);

  if (!data || !data.history || data.history.length === 0) {
    return <div className="empty-state">No hay datos históricos suficientes para graficar.</div>;
  }

  // Sync prices and timestamps, and filter nulls
  const history = data.history;
  const timestamps = data.timestamps || [];
  const fullData = history.map((p, i) => ({ p, t: timestamps[i] })).filter(d => d.p !== null);

  let selection = [];
  if (range === '1M') selection = fullData.slice(-22);
  else if (range === '6M') selection = fullData.slice(-126);
  else if (range === '1Y') selection = fullData.slice(-252);
  else selection = fullData;

  if (selection.length < 2) return <div className="empty-state">Datos insuficientes para el periodo seleccionado.</div>;

  const points = selection.map(d => d.p);
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range_val = max - min;
  const padding = range_val * 0.15;
  const yMin = min - padding;
  const yMax = max + padding;

  const width = 800;
  const height = 180;
  const margin = { left: 50, right: 10, top: 10, bottom: 10 };
  const chartW = width - margin.left - margin.right;
  const chartH = height - margin.top - margin.bottom;

  const getX = (i) => margin.left + (i / (selection.length - 1)) * chartW;
  const getY = (v) => margin.top + chartH - ((v - yMin) / (yMax - yMin)) * chartH;

  const pathData = selection.map((d, i) => `${i === 0 ? 'M' : 'L'}${getX(i)},${getY(d.p)}`).join(' ');
  const areaData = `${pathData} L${getX(selection.length - 1)},${margin.top + chartH} L${margin.left},${margin.top + chartH} Z`;

  const lastPrice = points[points.length - 1];
  const firstPrice = points[0];
  const change = lastPrice - firstPrice;
  const changePct = (change / firstPrice) * 100;

  const fmtDate = (ts) => {
    if (!ts) return '';
    const d = new Date(ts * 1000);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' });
  };

  const handleMouseMove = (e) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * width;
    if (x < margin.left) {
      setHoverIdx(null);
      return;
    }
    const chartX = x - margin.left;
    const idx = Math.max(0, Math.min(selection.length - 1, Math.round((chartX / chartW) * (selection.length - 1))));
    setHoverIdx(idx);
  };

  const hoverItem = hoverIdx !== null ? selection[hoverIdx] : null;

  return (
    <div className="expanded-panel-content">
      <div className="chart-header">
        <div className="chart-title-area">
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>Evolución de Precio</div>
          <h3>{ticker} <span style={{ fontWeight: '400', color: 'var(--text-muted)', fontSize: '14px' }}>— {name}</span></h3>
        </div>
        <div className="chart-range-selector">
          {['1M', '6M', '1Y', 'MAX'].map(r => (
            <button key={r} className={`range-btn ${range === r ? 'active' : ''}`} onClick={() => setRange(r)}>{r}</button>
          ))}
        </div>
      </div>

      <div style={{ position: 'relative', width: '100%', height: height + 'px' }}>
        <svg 
          viewBox={`0 0 ${width} ${height}`} 
          preserveAspectRatio="none" 
          style={{ width: '100%', height: '100%', display: 'block', overflow: 'visible', cursor: 'crosshair' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIdx(null)}
        >
          <defs>
            <linearGradient id={`grad-${ticker}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.4" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          
          {/* Y-Axis Labels & Grid Lines */}
          {[0, 0.25, 0.5, 0.75, 1].map(v => {
             const yPos = margin.top + chartH - (v * chartH);
             const val = yMin + (v * (yMax - yMin));
             return (
               <React.Fragment key={v}>
                 <line x1={margin.left} y1={yPos} x2={width - margin.right} y2={yPos} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                 <text x={margin.left - 8} y={yPos + 4} textAnchor="end" fill="var(--text-muted)" fontSize="10" fontFamily="inherit">${fmt(val, 0)}</text>
               </React.Fragment>
             );
          })}

          <path d={areaData} fill={`url(#grad-${ticker})`} />
          <path d={pathData} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 4px rgba(94, 106, 210, 0.3))' }} />
          
          {/* Last Price Indicator (if not hovering) */}
          {hoverIdx === null && (
            <>
              <line x1={margin.left} y1={getY(lastPrice)} x2={width - margin.right} y2={getY(lastPrice)} stroke="var(--accent)" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
              <circle cx={getX(selection.length - 1)} cy={getY(lastPrice)} r="4" fill="var(--accent)" stroke="white" strokeWidth="1.5" />
            </>
          )}

          {/* Hover Indicators */}
          {hoverIdx !== null && hoverItem && (
            <g>
              <line x1={getX(hoverIdx)} y1={margin.top} x2={getX(hoverIdx)} y2={margin.top + chartH} stroke="white" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
              <circle cx={getX(hoverIdx)} cy={getY(hoverItem.p)} r="5" fill="var(--accent)" stroke="white" strokeWidth="2" />
            </g>
          )}
        </svg>

        {/* HTML Tooltip (to avoid preserveAspectRatio="none" squashing) */}
        {hoverIdx !== null && hoverItem && (
          <div className="chart-tooltip" style={{ 
            left: `${(getX(hoverIdx) / width) * 100}%`,
            top: `${(getY(hoverItem.p) / height) * 100}%`,
            transform: `translate(${hoverIdx > selection.length / 2 ? '-110%' : '10%'}, -120%)`
          }}>
            <div className="tooltip-date">{fmtDate(hoverItem.t)}</div>
            <div className="tooltip-price">${fmt(hoverItem.p)}</div>
          </div>
        )}
      </div>

      <div className="chart-stats">
        <div className="chart-stat-item">
          <span className="chart-stat-label">Precio {hoverIdx !== null ? 'Seleccionado' : 'Actual'}</span>
          <span className="chart-stat-value">${fmt(hoverIdx !== null ? hoverItem.p : lastPrice)}</span>
        </div>
        <div className="chart-stat-item">
          <span className="chart-stat-label">Rendimiento {range}</span>
          <span className={`chart-stat-value ${change >= 0 ? 'positive' : 'negative'}`}>
            {change >= 0 ? '+' : ''}{fmt(changePct)}%
          </span>
        </div>
        <div className="chart-stat-item">
          <span className="chart-stat-label">Mín. Periodo</span>
          <span className="chart-stat-value">${fmt(min)}</span>
        </div>
        <div className="chart-stat-item">
          <span className="chart-stat-label">Máx. Periodo</span>
          <span className="chart-stat-value">${fmt(max)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Market Status Bar ─────────────────────────────────────────────────────────
function formatMarketTime(unixTs) {
  if (!unixTs) return null;
  const d = new Date(unixTs * 1000);
  const now = new Date();
  // Normalise both to midnight to compare calendar days (local time)
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tsMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((todayMidnight - tsMidnight) / 86400000);

  const timeStr = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 0) return `Hoy ${timeStr}`;
  if (diffDays === 1) return `Ayer ${timeStr}`;
  return `${d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })} ${timeStr}`;
}

function MarketStatusBar({ dailyStats, watchlist }) {
  // Find the first available stats entry for each market segment
  const usEntry = watchlist.find(w => w.tipo === 'stock');
  const arEntry = watchlist.find(w => w.tipo === 'accion' || w.tipo === 'cedear');

  const getStats = (item) => {
    if (!item) return null;
    const key = item.tipo === 'stock' ? item.ticker : item.ticker + '.BA';
    return dailyStats[key] ?? null;
  };

  const usStats = getStats(usEntry);
  const arStats = getStats(arEntry);

  // Determine open/closed for each market.
  // Use ?? null to handle old localStorage cache where isOpen may be undefined.
  // undefined !== null, so without this guard it would fall through to "Cerrado".
  const usOpen = usStats ? (usStats.isOpen ?? null) : null;
  const arOpen = arStats ? (arStats.isOpen ?? null) : null;

  const renderPill = ({ flag, name, isOpen, lastTs, alwaysOn }) => {
    let pillMod, dotMod, statusMod, statusLabel, subText;

    if (alwaysOn) {
      pillMod = 'mkt-pill--always';
      dotMod = 'mkt-pill__dot--always';
      statusMod = 'mkt-pill__status--always';
      statusLabel = '24 / 7 ON';
      subText = 'Precio en tiempo real';
    } else if (isOpen === null) {
      pillMod = '';
      dotMod = 'mkt-pill__dot--closed';
      statusMod = 'mkt-pill__status--closed';
      statusLabel = 'Cargando...';
      subText = null;
    } else if (isOpen) {
      pillMod = 'mkt-pill--open';
      dotMod = 'mkt-pill__dot--open';
      statusMod = 'mkt-pill__status--open';
      statusLabel = 'Abierto';
      subText = 'Cotizaciones en vivo';
    } else {
      pillMod = 'mkt-pill--closed';
      dotMod = 'mkt-pill__dot--closed';
      statusMod = 'mkt-pill__status--closed';
      statusLabel = 'Cerrado';
      const formatted = formatMarketTime(lastTs);
      subText = formatted ? `Último precio: ${formatted}` : 'Cotización anterior';
    }

    return (
      <div className={`mkt-pill ${pillMod}`}>
        <div className={`mkt-pill__dot ${dotMod}`} />
        <div className="mkt-pill__body">
          <span className="mkt-pill__name">
            {flag.length <= 2
              ? <span className="mkt-flag-text">{flag}</span>
              : <span>{flag}</span>
            }
            {name}
          </span>
          <span className={`mkt-pill__status ${statusMod}`}>{statusLabel}</span>
          {subText && <span className="mkt-pill__sub">{subText}</span>}
        </div>
      </div>
    );
  };

  return (
    <div className="market-status-bar">
      {renderPill({ flag: 'US', name: 'NYSE / NASDAQ', isOpen: usOpen, lastTs: usStats?.regularMarketTime })}
      {renderPill({ flag: 'AR', name: 'BCBA', isOpen: arOpen, lastTs: arStats?.regularMarketTime })}
      {renderPill({ flag: '⚡', name: 'Cripto', alwaysOn: true })}
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

// ── Multi-Check Dropdown ───────────────────────────────────────────────────────
function MultiCheckDropdown({ placeholder, options, selected, onChange }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (val) =>
    onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val]);

  const displayLabel =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? (options.find(o => o.value === selected[0])?.label ?? selected[0])
        : `${selected.length} seleccionados`;

  return (
    <div className="mcd-wrapper" ref={ref}>
      <button
        type="button"
        className={`mcd-trigger${open ? ' mcd-trigger--open' : ''}${selected.length > 0 ? ' mcd-trigger--active' : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        <span className="mcd-label">{displayLabel}</span>
        <span className="mcd-arrow">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="mcd-dropdown">
          {selected.length > 0 && (
            <button type="button" className="mcd-clear" onClick={() => onChange([])}>
              Limpiar ×
            </button>
          )}
          {options.length === 0 && (
            <div style={{ padding: '8px 10px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>Sin opciones</div>
          )}
          {options.map(opt => (
            <label key={opt.value} className="mcd-option">
              <input
                type="checkbox"
                checked={selected.includes(opt.value)}
                onChange={() => toggle(opt.value)}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

// ── Index Ticker Bar ──────────────────────────────────────────────────────────
function IndexTickerBar({ dailyStats }) {
  const sorted = [...GLOBAL_INDICES].sort((a, b) => (dailyStats[b.ticker]?.changePct ?? 0) - (dailyStats[a.ticker]?.changePct ?? 0));
  const items = [...sorted, ...sorted];
  return (
    <div className="index-ticker-bar">
      <div className="index-ticker-container">
        {items.map((idx, i) => {
          const stats = dailyStats[idx.ticker];
          if (!stats) return null;
          const isPos = stats.change >= 0;
          return (
            <div key={`${idx.ticker}-${i}`} className="index-item">
              <span className="index-name">{idx.name}</span>
              <span className="index-value">{idx.ticker === 'BTC-USD' ? '' : '$'}{fmt(stats.price, idx.ticker === 'BTC-USD' || idx.ticker === '^TNX' ? 2 : 2)}</span>
              <span className={`index-change ${isPos ? 'positive' : 'negative'}`}>
                {isPos ? '▲' : '▼'} {Math.abs(stats.changePct).toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}


function App() {
  const [activeTab, setActiveTab] = useState('portfolio'); // 'portfolio', 'operaciones', 'watchlist', 'trades'

  const [holdings, setHoldings] = useState(() => JSON.parse(localStorage.getItem('portfolio_holdings') || '[]'));
  const [operaciones, setOperaciones] = useState(() => JSON.parse(localStorage.getItem('portfolio_operaciones') || '[]'));
  const [watchlist, setWatchlist] = useState(() => JSON.parse(localStorage.getItem('portfolio_watchlist') || '[]'));
  const [trades, setTrades] = useState(() => JSON.parse(localStorage.getItem('portfolio_trades') || '[]'));
  const [evals, setEvals] = useState(() => JSON.parse(localStorage.getItem('portfolio_evals') || '[]'));

  const [prices, setPrices] = useState(() => JSON.parse(localStorage.getItem('cached_prices') || '{}'));
  const [dailyStats, setDailyStats] = useState(() => JSON.parse(localStorage.getItem('cached_stats') || '{}'));
  const [dolarMep, setDolarMep] = useState(null);
  const [dolarCcl, setDolarCcl] = useState(null);

  const [status, setStatus] = useState('loading'); // 'loading', 'ok', 'error'
  const [statusText, setStatusText] = useState('Cargando precios...');

  // UI State for collapsibles
  const [showAddHolding, setShowAddHolding] = useState(false);
  const [showAddOp, setShowAddOp] = useState(false);
  const [showAddWatchlist, setShowAddWatchlist] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddTrade, setShowAddTrade] = useState(false);
  const [showAddEval, setShowAddEval] = useState(false);
  const [expandedTicker, setExpandedTicker] = useState(null); // Ticker of the expanded row in Watchlist/Portfolio

  // Trade form state
  const [tradeCompraId, setTradeCompraId] = useState('');
  const [tradeVentaId, setTradeVentaId] = useState('');
  const [evalOpId, setEvalOpId] = useState('');

  // Form states
  const [newTipo, setNewTipo] = useState('accion');
  const [newMercado, setNewMercado] = useState('BCBA');
  const [newTicker, setNewTicker] = useState('');
  const [newNombre, setNewNombre] = useState('');
  const [newCantidad, setNewCantidad] = useState('');
  const [newPrecio, setNewPrecio] = useState('');
  const [newPrecioActual, setNewPrecioActual] = useState('');

  const [opTicker, setOpTicker] = useState('');
  const [opAssetTipo, setOpAssetTipo] = useState('accion');
  const [opTipo, setOpTipo] = useState('compra');
  const [opFecha, setOpFecha] = useState(new Date().toISOString().split('T')[0]);
  const [opCantidad, setOpCantidad] = useState('');
  const [opPrecio, setOpPrecio] = useState('');

  const [wlTicker, setWlTicker] = useState('');
  const [wlTipo, setWlTipo] = useState('accion');
  const [wlMercado, setWlMercado] = useState('BCBA');
  const [wlNombre, setWlNombre] = useState('');
  const [wlCategoria, setWlCategoria] = useState('');
  const [wlTypeFilters, setWlTypeFilters] = useState([]);
  const [wlCatFilters, setWlCatFilters] = useState([]);
  const [wlExcludedTickers, setWlExcludedTickers] = useState([]);

  const [importJson, setImportJson] = useState('');

  // Persist storage whenever collections change
  useEffect(() => {
    localStorage.setItem('portfolio_holdings', JSON.stringify(holdings));
    localStorage.setItem('portfolio_operaciones', JSON.stringify(operaciones));
    localStorage.setItem('portfolio_watchlist', JSON.stringify(watchlist));
    localStorage.setItem('portfolio_trades', JSON.stringify(trades));
    localStorage.setItem('portfolio_evals', JSON.stringify(evals));
  }, [holdings, operaciones, watchlist, trades, evals]);

  // Persist prices separately whenever they are successfully updated
  useEffect(() => {
    if (Object.keys(prices).length > 0) localStorage.setItem('cached_prices', JSON.stringify(prices));
    if (Object.keys(dailyStats).length > 0) localStorage.setItem('cached_stats', JSON.stringify(dailyStats));
  }, [prices, dailyStats]);

  // Fetch prices effect
  useEffect(() => {
    refreshAll();
    const interval = setInterval(refreshAll, 60 * 60 * 1000); // 60 mins
    return () => clearInterval(interval);
    // eslint-disable-next-line
  }, [holdings, watchlist]);

  const getYahooTicker = (h) => {
    if (h.tipo === 'accion' || h.tipo === 'cedear') return h.ticker + '.BA';
    if (h.tipo === 'stock') return h.ticker;
    return null;
  };

  const fetchPrice = async (yahooTicker) => {
    try {
      const url5y = `/api/market/v8/finance/chart/${yahooTicker}?interval=1d&range=5y`;
      const url1d = `/api/market/v8/finance/chart/${yahooTicker}?interval=1d&range=1d`;

      const [r5y, r1d] = await Promise.all([fetch(url5y), fetch(url1d)]);
      const d5y = await r5y.json();
      const d1d = await r1d.json();

      const meta1d = d1d?.chart?.result?.[0]?.meta;
      const timestamps = d5y?.chart?.result?.[0]?.timestamp || [];
      const adjquote = d5y?.chart?.result?.[0]?.indicators?.adjclose?.[0];
      const rawquote = d5y?.chart?.result?.[0]?.indicators?.quote?.[0];
      const closes = adjquote?.adjclose || rawquote?.close || [];
      const len = closes.length;

      // Robust fallback: if regularMarketPrice is missing (market closed/holiday), search backwards in 5y historicals for last valid close
      let price = meta1d?.regularMarketPrice;
      if (price === undefined || price === null) {
        if (len > 0) {
          for (let i = len - 1; i >= 0; i--) {
            if (closes[i] !== null && closes[i] !== undefined) {
              price = closes[i];
              break;
            }
          }
        }
      }

      if (price === undefined || price === null) return null;

      const prevClose = meta1d?.chartPreviousClose || price;
      const change = price - prevClose;
      const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;

      const getHistPct = (daysBack) => {
        if (len <= daysBack) return null;
        let pastPrice = closes[len - 1 - daysBack];
        let offset = 0;
        while (pastPrice == null && offset < 5 && len - 1 - daysBack - offset >= 0) {
          offset++;
          pastPrice = closes[len - 1 - daysBack - offset];
        }
        if (!pastPrice) return null;
        return ((price - pastPrice) / pastPrice) * 100;
      };

      const hist5d = getHistPct(5);
      const hist1m = getHistPct(21);
      const hist6m = getHistPct(126);
      const hist1y = getHistPct(252);
      const hist5y = len > 1000 ? getHistPct(len - 1) : null;

      // Market status:
      // Primary check: Yahoo's marketState (can sometimes be stale/wrong via proxy)
      // Secondary check: compare Date.now() against today's trading session window
      // Both are from Yahoo's own data, so no hardcoded hours needed.
      const nowSec = Math.floor(Date.now() / 1000);
      const tradingPeriod = meta1d?.currentTradingPeriod?.regular;
      const isInTradingWindow = tradingPeriod
        ? (nowSec >= tradingPeriod.start && nowSec <= tradingPeriod.end)
        : false;
      const isOpen = meta1d?.marketState === 'REGULAR' || isInTradingWindow;
      const regularMarketTime = meta1d?.regularMarketTime ?? null; // Unix timestamp

      return { price, change, changePct, hist5d, hist1m, hist6m, hist1y, hist5y, isOpen, regularMarketTime, history: closes, timestamps };
    } catch (e) {
      return null;
    }
  };

  const refreshAll = async () => {
    setStatus('loading');
    setStatusText('Consultando mercado...');
    let hasError = false;
    let newPrices = { ...prices };
    let newStats = { ...dailyStats };

    const clean = (t) => t.replace(/\.BA$/i, '');

    const applyData = (ticker, base, data) => {
      newPrices[ticker] = data.price;
      newPrices[base] = data.price;
      newStats[ticker] = data;
      newStats[base] = data;
    };

    // 1. Fetch current holdings AND watchlist items
    const trackedItems = [...holdings, ...watchlist];
    for (const h of trackedItems) {
      if (h.tipo === 'bono') {
        if (h.precioActual !== undefined) {
          applyData(h.ticker, h.ticker, { price: h.precioActual, change: 0, changePct: 0 });
        }
        continue;
      }
      const yt = getYahooTicker(h);
      if (yt) {
        const data = await fetchPrice(yt);
        if (data !== null) {
          // Use the Yahoo Ticker (yt) as the primary key to allow duplicate base tickers
          applyData(yt, yt, data);
        } else {
          hasError = true;
        }
      }
    }

    // 1.5 Global Indices
    const indicesToFetch = [...GLOBAL_INDICES.filter(i => !i.isCalculated).map(i => i.ticker)];
    if (GLOBAL_INDICES.some(i => i.ticker === 'MERVAL_USD')) {
      if (!indicesToFetch.includes('IMV.BA')) indicesToFetch.push('IMV.BA');
      if (!indicesToFetch.includes('^MERV')) indicesToFetch.push('^MERV');
    }
    for (const ticker of indicesToFetch) {
      const data = await fetchPrice(ticker);
      if (data) applyData(ticker, ticker, data);
    }

    // 2. Fetch older operations not currently tracked manually
    for (const op of operaciones) {
      const base = clean(op.ticker);
      if (newPrices[base] === undefined) {
        const d1 = await fetchPrice(base + '.BA');
        if (d1 !== null) {
          applyData(op.ticker, base, d1);
        } else {
          const d2 = await fetchPrice(base);
          if (d2 !== null) {
            applyData(op.ticker, base, d2);
          } else {
            hasError = true;
          }
        }
      }
    }

    try {
      const mepR = await fetch('https://dolarapi.com/v1/dolares/bolsa');
      const mepD = await mepR.json();
      if (mepD && mepD.venta) setDolarMep(mepD.venta);

      const cclR = await fetch('https://dolarapi.com/v1/dolares/contadoconliqui');
      const cclD = await cclR.json();
      if (cclD && cclD.venta) {
        setDolarCcl(cclD.venta);
        const mArs = newStats['IMV.BA'] || newStats['^MERV'];
        if (mArs) {
          applyData('MERVAL_USD', 'MERVAL_USD', {
            ...mArs,
            price: mArs.price / cclD.venta,
            change: mArs.change / cclD.venta,
            history: (mArs.history || []).map(v => v ? v / cclD.venta : null)
          });
        }
      }
    } catch (e) {
      console.warn('DolarAPI fetch error', e);
    }

    setPrices(newPrices);
    setDailyStats(newStats);
    const ts = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    setStatus(hasError ? 'error' : 'ok');
    setStatusText(`Actualizado ${ts}`);
  };


  // --- HOLDINGS BUSINESS LOGIC ---
  const agregarHolding = () => {
    const ticker = newTicker.trim().toUpperCase();
    const cant = parseFloat(newCantidad);
    const prec = parseFloat(newPrecio);

    if (!ticker || isNaN(cant) || isNaN(prec)) return alert('Completá ticker, cantidad y precio.');
    if (holdings.find(h => h.ticker === ticker && h.mercado === newMercado)) return alert('Este activo ya está en el portfolio con ese mercado.');

    const h = { ticker, tipo: newTipo, mercado: newMercado, nombre: newNombre.trim(), cantidad: cant, precioEntrada: prec };
    let nPrices = { ...prices };

    if (newTipo === 'bono') {
      const pa = parseFloat(newPrecioActual);
      if (!isNaN(pa)) {
        h.precioActual = pa;
        nPrices[ticker] = pa;
      }
    }

    setHoldings([...holdings, h]);
    setPrices(nPrices);

    setNewTicker(''); setNewNombre(''); setNewCantidad(''); setNewPrecio(''); setNewPrecioActual('');
    setShowAddHolding(false);
  };

  const eliminarHolding = (ticker) => {
    if (!window.confirm(`¿Remover ${ticker} del portfolio?`)) return;
    setHoldings(holdings.filter(h => h.ticker !== ticker));
  };

  const editBonoPrecio = (ticker) => {
    const hIndex = holdings.findIndex(h => h.ticker === ticker);
    if (hIndex === -1) return;
    const h = holdings[hIndex];

    const nuevo = window.prompt(`Nuevo precio unitario para ${ticker} ($):`, h.precioActual || '');
    const p = parseFloat(nuevo);
    if (!isNaN(p)) {
      const newHoldings = [...holdings];
      newHoldings[hIndex] = { ...h, precioActual: p };
      setHoldings(newHoldings);
      setPrices({ ...prices, [ticker]: p });
    }
  };

  // --- WATCHLIST BUSINESS LOGIC ---
  const agregarWatchlist = () => {
    const ticker = wlTicker.trim().toUpperCase();
    if (!ticker) return alert('Completá el ticker.');
    if (watchlist.find(w => w.ticker === ticker && w.mercado === wlMercado)) return alert('Ya está en la watchlist con ese mercado.');

    const w = { ticker, tipo: wlTipo, mercado: wlMercado, nombre: wlNombre.trim(), categoria: wlCategoria.trim() };

    setWatchlist([...watchlist, w]);
    setWlTicker(''); setWlNombre(''); setWlCategoria('');
    setShowAddWatchlist(false);
  };

  const eliminarWatchlist = (ticker) => {
    if (!window.confirm(`¿Remover ${ticker} de la watchlist?`)) return;
    setWatchlist(watchlist.filter(w => w.ticker !== ticker));
  };


  // --- OPERATIONS BUSINESS LOGIC ---
  const agregarOperacion = () => {
    let ticker = opTicker.trim().toUpperCase();
    const cant = parseFloat(opCantidad);
    const prec = parseFloat(opPrecio);

    if (!ticker || isNaN(cant) || isNaN(prec) || !opFecha) return alert('Datos incompletos.');

    // Auto-append .BA for Argentine assets so we fetch BCBA prices, not ADRs
    if ((opAssetTipo === 'accion' || opAssetTipo === 'cedear') && !ticker.endsWith('.BA')) {
      ticker = ticker + '.BA';
    }

    const op = { id: Date.now().toString(), ticker, assetTipo: opAssetTipo, tipo: opTipo, cantidad: cant, precio: prec, fecha: opFecha };
    setOperaciones([...operaciones, op]);

    setOpTicker(''); setOpCantidad(''); setOpPrecio('');
    setShowAddOp(false);
  };

  const eliminarOp = (id) => {
    if (!window.confirm('¿Borrar registro de operación?')) return;
    setOperaciones(operaciones.filter(o => o.id !== id));
  };

  // --- TRADES BUSINESS LOGIC ---
  const agregarTrade = () => {
    const opCompra = operaciones.find(o => o.id === tradeCompraId);
    const opVenta = operaciones.find(o => o.id === tradeVentaId);
    if (!opCompra || !opVenta) return alert('Seleccioná una operación de compra y una de venta.');
    if (opCompra.ticker !== opVenta.ticker) {
      if (!window.confirm('La compra y la venta son de activos distintos. ¿Seguro que querés emparejarlos como un trade?')) {
        return;
      }
    }

    const trade = {
      id: Date.now().toString(),
      compraOpId: opCompra.id,
      compraTicker: opCompra.ticker,
      compraCantidad: opCompra.cantidad,
      compraPrecio: opCompra.precio,
      compraFecha: opCompra.fecha,
      ventaOpId: opVenta.id,
      ventaTicker: opVenta.ticker,
      ventaCantidad: opVenta.cantidad,
      ventaPrecio: opVenta.precio,
      ventaFecha: opVenta.fecha,
    };
    setTrades([...trades, trade]);
    setTradeCompraId('');
    setTradeVentaId('');
    setShowAddTrade(false);
  };

  const eliminarTrade = (id) => {
    if (!window.confirm('¿Eliminar este trade cerrado?')) return;
    setTrades(trades.filter(t => t.id !== id));
  };

  // --- EVALUATIONS BUSINESS LOGIC ---
  const agregarEval = () => {
    const op = operaciones.find(o => o.id === evalOpId);
    if (!op) return alert('Seleccioná una operación del histórico.');
    if (evals.find(e => e.opId === op.id)) return alert('Esta operación ya está siendo evaluada.');

    const newEval = {
      id: Date.now().toString(),
      opId: op.id,
      ticker: op.ticker,
      cantidad: op.cantidad,
      precio: op.precio,
      fecha: op.fecha,
      tipo: op.tipo,
      excluded: false
    };

    setEvals([...evals, newEval]);
    setEvalOpId('');
    setShowAddEval(false);
  };

  const eliminarEval = (id) => {
    if (!window.confirm('¿Remover esta evaluación?')) return;
    setEvals(evals.filter(e => e.id !== id));
  };

  const toggleEvalExclusion = (id) => {
    setEvals(evals.map(e => e.id === id ? { ...e, excluded: !e.excluded } : e));
  };


  // --- IMP/EXP LOGIC ---
  const exportar = () => {
    const json = JSON.stringify({ holdings, operaciones, watchlist }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'portfolio_' + new Date().toISOString().split('T')[0] + '.json';
    a.click();
  };

  const copiarJSON = () => {
    const json = JSON.stringify({ holdings, operaciones, watchlist }, null, 2);
    navigator.clipboard.writeText(json).then(() => alert('JSON Copiado'));
  };

  const importar = () => {
    try {
      const data = JSON.parse(importJson.trim());
      if (!Array.isArray(data.holdings) || !Array.isArray(data.operaciones)) throw new Error('Estructura incorrecta');
      if (!window.confirm('Esto sobreescribirá todo tu portfolio actual. ¿Proceder?')) return;

      setHoldings(data.holdings);
      setOperaciones(data.operaciones);
      setWatchlist(Array.isArray(data.watchlist) ? data.watchlist : []);
      setPrices({});
      setImportJson('');
      setShowSettings(false);
    } catch (e) {
      alert('Archivo inválido: ' + e.message);
    }
  };

  const borrarTodo = () => {
    const typed = window.prompt('Escribí "BORRAR" para formatear todo.');
    if (typed === 'BORRAR') {
      setHoldings([]); setOperaciones([]); setWatchlist([]); setPrices({});
      setShowSettings(false);
    }
  };

  // Computations
  let totalValor = 0;
  let totalCosto = 0;

  holdings.forEach(h => {
    const yt = getYahooTicker(h) || h.ticker;
    const pc = prices[yt] ?? null;
    const valor = pc !== null ? pc * h.cantidad : null;
    const costo = h.precioEntrada * h.cantidad;

    if (valor !== null) totalValor += valor;
    totalCosto += costo;
  });

  const pnlT = totalValor - totalCosto;
  const pnlTP = totalCosto > 0 ? (pnlT / totalCosto) * 100 : 0;

  // Watchlist: items visible after type + category filters (before per-ticker exclusion)
  const wlVisibleBeforeExclude = watchlist
    .filter(w => wlTypeFilters.length === 0 || wlTypeFilters.includes(w.tipo))
    .filter(w => wlCatFilters.length === 0 || wlCatFilters.includes(w.categoria || ''));

  // Sort utility for unified grouping: type then alphabetical
  const typePriority = { 'accion': 1, 'bono': 2, 'cedear': 3, 'stock': 4 };
  const getPri = (item) => typePriority[item.tipo || item.assetTipo] || 9;
  const sortUnified = (a, b) => {
    const tA = getPri(a);
    const tB = getPri(b);
    if (tA !== tB) return tA - tB;
    return a.ticker.localeCompare(b.ticker);
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header" style={{ marginBottom: '0' }}>
        <h1>Portfolio Dashboard</h1>
        <div className="refresh-bar">
          <div className={`dot ${status}`}></div>
          <span id="status-text">{statusText}</span>
          <button className="btn btn-sm" onClick={refreshAll}>Actualizar</button>
          <button className="btn btn-sm" onClick={() => setShowSettings(!showSettings)}>Ajustes</button>
        </div>
      </header>

      {/* Tabs Navigation */}
      <nav className="tabs-nav">
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className={`tab-btn ${activeTab === 'portfolio' ? 'active' : ''}`} onClick={() => setActiveTab('portfolio')}>Mi Portfolio</button>
          <button className={`tab-btn ${activeTab === 'operaciones' ? 'active' : ''}`} onClick={() => setActiveTab('operaciones')}>Histórico</button>
          <button className={`tab-btn ${activeTab === 'watchlist' ? 'active' : ''}`} onClick={() => setActiveTab('watchlist')}>Watchlist</button>
          <button className={`tab-btn ${activeTab === 'mercados' ? 'active' : ''}`} onClick={() => setActiveTab('mercados')}>Mercados</button>
          <button className={`tab-btn ${activeTab === 'evaluacion' ? 'active' : ''}`} onClick={() => setActiveTab('evaluacion')}>Evaluación</button>
          <button className={`tab-btn ${activeTab === 'trades' ? 'active' : ''}`} onClick={() => setActiveTab('trades')}>Trades</button>
        </div>
        {dolarMep && (
          <div style={{ marginLeft: 'auto', alignSelf: 'center', fontSize: '12px', color: 'var(--text-muted)', fontWeight: '500' }}>
            Dólar MEP: <span style={{ color: 'var(--text-main)' }}>${fmt(dolarMep)}</span>
          </div>
        )}
      </nav>

      {/* Global Index Bar */}
      <IndexTickerBar dailyStats={dailyStats} />

      {/* Settings Panel (Global Drawer) */}
      {showSettings && (
        <div className="glass-panel collapsible-content active" style={{ borderColor: 'rgba(94, 106, 210, 0.4)', marginBottom: '1.5rem' }}>
          <div className="panel-header">
            <div className="panel-title">Ajustes & Respaldo de Datos</div>
            <button className="btn btn-sm" onClick={() => setShowSettings(false)}>Cerrar</button>
          </div>
          <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '1rem' }}>
            <div>
              <label>Exportar Datos (JSON)</label>
              <p className="hint" style={{ marginBottom: '8px' }}>Guardá este JSON de forma segura como backup.</p>
              <textarea readOnly rows="4" style={{ fontFamily: 'monospace', fontSize: '11px' }} value={JSON.stringify({ holdings, operaciones, watchlist }, null, 2)}></textarea>
              <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                <button className="btn" onClick={exportar}>Descargar Archivo</button>
                <button className="btn" onClick={copiarJSON}>Copiar</button>
              </div>
            </div>
            <div>
              <label>Importar Datos</label>
              <p className="hint" style={{ marginBottom: '8px' }}>Atención: Pegá un JSON válido. Esto sobreescribirá todo.</p>
              <textarea rows="4" placeholder='{"holdings":[...],"operaciones":[...]}' style={{ fontFamily: 'monospace', fontSize: '11px' }} value={importJson} onChange={e => setImportJson(e.target.value)}></textarea>
              <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                <button className="btn btn-primary" onClick={importar}>Restaurar</button>
                <button className="btn btn-danger" onClick={borrarTodo}>Reset de Fábrica</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 1: PORTFOLIO --- */}
      {activeTab === 'portfolio' && (
        <>
          <div className="metrics-grid">
            <div className="glass-panel metric-card">
              <div className="metric-label">Valor Total</div>
              <div className="metric-value" id="m-total">
                {holdings.length > 0 ? `$${fmt(totalValor)}` : '—'}
              </div>
              {dolarMep && holdings.length > 0 && (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  ≈ US$ {fmt(totalValor / dolarMep)} <span style={{ fontSize: '10px' }}>(MEP: ${fmt(dolarMep)})</span>
                </div>
              )}
            </div>
            <div className="glass-panel metric-card">
              <div className="metric-label">Ganancia/Pérdida Absoluta ($)</div>
              <div className={`metric-value ${holdings.length === 0 ? '' : (pnlT >= 0 ? 'positive' : 'negative')}`}>
                {holdings.length > 0 ? `${pnlT >= 0 ? '+$' : '-$'}${fmt(Math.abs(pnlT))}` : '—'}
              </div>
            </div>
            <div className="glass-panel metric-card">
              <div className="metric-label">Rendimiento Total (%)</div>
              <div className={`metric-value ${holdings.length === 0 ? '' : (pnlTP >= 0 ? 'positive' : 'negative')}`}>
                {holdings.length > 0 ? fmtPct(pnlTP) : '—'}
              </div>
            </div>
          </div>

          <div className="glass-panel" style={{ marginTop: '1.5rem' }}>
            <div className="panel-header">
              <div className="panel-title">Tus Activos ({holdings.length})</div>
              <button className="btn btn-primary btn-sm" onClick={() => setShowAddHolding(!showAddHolding)}>+ Agregar Holding</button>
            </div>

            {showAddHolding && (
              <div className="collapsible-content active">
                <div className="panel-title" style={{ marginBottom: '12px', fontSize: '14px' }}>Nuevo Holding</div>
                <div className="form-row">
                  <div>
                    <label>Tipo</label>
                    <select value={newTipo} onChange={(e) => {
                      const t = e.target.value;
                      setNewTipo(t);
                      if (t === 'accion' || t === 'cedear') setNewMercado('BCBA');
                      else if (t === 'stock') setNewMercado('NYSE/NASDAQ');
                      else if (t === 'bono') setNewMercado('OTC');
                    }}>
                      <option value="accion">Acción AR</option>
                      <option value="cedear">CEDEAR</option>
                      <option value="stock">Stock US</option>
                      <option value="bono">Bono</option>
                    </select>
                  </div>
                  <div>
                    <label>Mercado</label>
                    <select value={newMercado} onChange={e => setNewMercado(e.target.value)}>
                      <option value="BCBA">BCBA (Argentina)</option>
                      <option value="NYSE/NASDAQ">NYSE/NASDAQ (US)</option>
                      <option value="MAE">MAE</option>
                      <option value="OTC">OTC</option>
                    </select>
                  </div>
                  <div>
                    <label>Ticker</label>
                    <input value={newTicker} onChange={e => setNewTicker(e.target.value.toUpperCase())} placeholder="ej: GGAL" />
                  </div>
                </div>
                <div className="form-row trio">
                  <div>
                    <label>Nombre (opc.)</label>
                    <input value={newNombre} onChange={e => setNewNombre(e.target.value)} placeholder="ej: Galicia" />
                  </div>
                  <div>
                    <label>Cantidad</label>
                    <input type="number" value={newCantidad} onChange={e => setNewCantidad(e.target.value)} placeholder="100" />
                  </div>
                  <div>
                    <label>Precio Compra ($)</label>
                    <input type="number" value={newPrecio} onChange={e => setNewPrecio(e.target.value)} placeholder="0.00" step="0.01" />
                  </div>
                </div>
                {newTipo === 'bono' && (
                  <div style={{ marginBottom: '12px' }}>
                    <div className="form-row">
                      <div>
                        <label>Precio actual manual ($)</label>
                        <input type="number" value={newPrecioActual} onChange={e => setNewPrecioActual(e.target.value)} placeholder="0.00" step="0.01" />
                      </div>
                      <div></div>
                    </div>
                  </div>
                )}
                <button className="btn btn-primary" onClick={agregarHolding}>Guardar Holding</button>
                <button className="btn" style={{ marginLeft: '8px' }} onClick={() => setShowAddHolding(false)}>Cancelar</button>
              </div>
            )}

            <div className="table-container">
              {holdings.length === 0 ? (
                <div className="empty-state">Sin holdings todavía. Agrega uno para comenzar.</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Activo</th>
                      <th>Tipo</th>
                      <th>Mercado</th>
                      <th>Cant.</th>
                      <th>P. Compra</th>
                      <th>P. Actual</th>
                      <th>Valor ($)</th>
                      <th>P&L $</th>
                      <th>P&L %</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...holdings].sort(sortUnified).map(h => {
                      const yt = getYahooTicker(h) || h.ticker;
                      const pc = prices[yt] ?? null;
                      const stats = dailyStats[yt] ?? null;
                      const valor = pc !== null ? pc * h.cantidad : null;
                      const costo = h.precioEntrada * h.cantidad;
                      const pnlA = valor !== null ? valor - costo : null;
                      const pnlP = (valor !== null && costo > 0) ? (pnlA / costo) * 100 : null;
                      const cssPnl = pnlA == null ? 'neutral' : (pnlA >= 0 ? 'positive' : 'negative');
                      const sign = pnlA >= 0 ? '+' : '';

                      return (
                        <React.Fragment key={h.ticker}>
                          <tr className="expandable-row" onClick={() => setExpandedTicker(expandedTicker === h.ticker ? null : h.ticker)}>
                            <td>
                              <div className="ticker-name">{h.ticker}</div>
                              {h.nombre && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{h.nombre}</div>}
                            </td>
                            <td><span className={`badge badge-${h.tipo}`}>{h.tipo}</span></td>
                            <td><span style={{ fontSize: '11px', opacity: 0.8 }}>{h.mercado || (h.tipo === 'stock' ? 'NYSE/NASDAQ' : (h.tipo === 'bono' ? 'OTC' : 'BCBA'))}</span></td>
                            <td>{fmt(h.cantidad, 0)}</td>
                            <td>${fmt(h.precioEntrada)}</td>
                            <td>
                              <strong>
                                {pc !== null ? `$${fmt(pc)}` : (
                                  h.tipo === 'bono' ? (
                                    <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); editBonoPrecio(h.ticker); }}>Fijar P.</button>
                                  ) : <span style={{ fontStyle: 'italic', color: '#888' }}>cargando...</span>
                                )}
                              </strong>
                              {stats && pc !== null && h.tipo !== 'bono' && (
                                <div className={stats.change >= 0 ? 'positive' : 'negative'} style={{ fontSize: '11px', marginTop: '4px' }}>
                                  {fmtPct(stats.changePct)}
                                </div>
                              )}
                            </td>
                            <td>{valor !== null ? '$' + fmt(valor) : '—'}</td>
                            <td className={cssPnl}>{pnlA !== null ? sign + '$' + fmt(pnlA) : '—'}</td>
                            <td className={cssPnl}><strong>{fmtPct(pnlP)}</strong></td>
                            <td><button className="btn btn-sm btn-danger" onClick={(e) => { e.stopPropagation(); eliminarHolding(h.ticker); }}>✕</button></td>
                          </tr>
                          {expandedTicker === h.ticker && (
                            <tr className="expanded-panel-row">
                              <td colSpan="10">
                                <HistoricalChart data={stats} ticker={h.ticker} name={h.nombre} />
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* ── Pie Charts (below holdings table) ──────── */}
          {holdings.length > 0 && (() => {
            const byAsset = {};
            const byTipo = {};
            const bySector = {};

            // Map ticker to category from watchlist for sector chart
            const catMap = Object.fromEntries(watchlist.map(w => [w.ticker, w.categoria]));

            holdings.forEach(h => {
              const yt = getYahooTicker(h) || h.ticker;
              const pc = prices[yt] ?? null;
              const valor = pc !== null ? pc * h.cantidad : h.precioEntrada * h.cantidad;

              // 1. By Asset
              byAsset[h.ticker] = (byAsset[h.ticker] || 0) + valor;

              // 2. By Type
              const tipoLabel = h.tipo === 'accion' ? 'Acción AR' : h.tipo === 'stock' ? 'Stock US' : h.tipo === 'cedear' ? 'CEDEAR' : 'Bono';
              byTipo[tipoLabel] = (byTipo[tipoLabel] || 0) + valor;

              // 3. By Sector (from Watchlist Category)
              const sectorLabel = catMap[h.ticker] || 'Otros';
              bySector[sectorLabel] = (bySector[sectorLabel] || 0) + valor;
            });

            const toData = obj => Object.entries(obj).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);

            return (
              <div className="pie-charts-row">
                <PieChart data={toData(byAsset)} title="% por Activo" />
                <PieChart data={toData(byTipo)} title="% por Tipo de Activo" />
                <PieChart data={toData(bySector)} title="% por Sector" />
              </div>
            );
          })()}
        </>
      )}

      {/* --- TAB 2: OPERACIONES --- */}
      {activeTab === 'operaciones' && (
        <div className="glass-panel">
          <div className="panel-header">
            <div className="panel-title">Operaciones Históricas ({operaciones.length})</div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddOp(!showAddOp)}>+ Registrar</button>
          </div>

          {showAddOp && (
            <div className="collapsible-content active">
              <div className="panel-title" style={{ marginBottom: '12px', fontSize: '14px' }}>Registrar Movimiento</div>
              <div className="form-row trio">
                <div>
                  <label>Tipo Activo</label>
                  <select value={opAssetTipo} onChange={e => setOpAssetTipo(e.target.value)}>
                    <option value="accion">Acción AR</option>
                    <option value="cedear">CEDEAR</option>
                    <option value="stock">Stock US</option>
                    <option value="bono">Bono</option>
                  </select>
                </div>
                <div>
                  <label>Ticker</label>
                  <input value={opTicker} onChange={e => setOpTicker(e.target.value.toUpperCase())} placeholder="GGAL" />
                </div>
                <div>
                  <label>Movimiento</label>
                  <select value={opTipo} onChange={e => setOpTipo(e.target.value)}>
                    <option value="compra">Compra</option>
                    <option value="venta">Venta</option>
                  </select>
                </div>
              </div>
              <div className="form-row trio">
                <div>
                  <label>Fecha</label>
                  <input type="date" value={opFecha} onChange={e => setOpFecha(e.target.value)} />
                </div>
                <div>
                  <label>Cantidad</label>
                  <input type="number" value={opCantidad} onChange={e => setOpCantidad(e.target.value)} placeholder="Ej: 50" />
                </div>
                <div>
                  <label>Precio ($)</label>
                  <input type="number" value={opPrecio} onChange={e => setOpPrecio(e.target.value)} placeholder="0.00" step="0.01" />
                </div>
              </div>
              <button className="btn btn-primary" onClick={agregarOperacion}>Guardar Movimiento</button>
              <button className="btn" style={{ marginLeft: '8px' }} onClick={() => setShowAddOp(false)}>Cancelar</button>
            </div>
          )}

          <div className="table-container">
            {operaciones.length === 0 ? (
              <div className="empty-state">Sin operaciones.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Activo</th>
                    <th>Detalle</th>
                    <th>Total Movido</th>
                    <th>Rendimiento Estimado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {[...operaciones].sort((a, b) => {
                    if (a.fecha !== b.fecha) return b.fecha.localeCompare(a.fecha);
                    return a.ticker.localeCompare(b.ticker);
                  }).map(op => {
                    const cleanOpTicker = op.ticker.replace(/\.BA$/i, '');
                    const currentPrice = prices[op.ticker] ?? prices[cleanOpTicker] ?? null;
                    let evalCss = 'neutral';
                    let evalText = '—';

                    if (currentPrice !== null) {
                      const diff = currentPrice - op.precio;
                      const pct = (diff / op.precio) * 100;
                      const nominalDiff = diff * op.cantidad;

                      if (op.tipo === 'compra') {
                        evalCss = diff >= 0 ? 'positive' : 'negative';
                        const sign = diff >= 0 ? '+' : '-';
                        evalText = `${fmtPct(pct)} (${sign}$${fmt(Math.abs(nominalDiff))})`;
                      } else if (op.tipo === 'venta') {
                        evalCss = diff <= 0 ? 'positive' : 'negative';
                        const salePct = -pct;
                        const saleNominal = -nominalDiff;
                        const sign = saleNominal >= 0 ? '+' : '-';
                        evalText = `${fmtPct(salePct)} (${sign}$${fmt(Math.abs(saleNominal))})`;
                      }
                    }

                    return (
                      <tr key={op.id}>
                        <td style={{ whiteSpace: 'nowrap', fontSize: '12px', color: 'var(--text-muted)' }}>{op.fecha}</td>
                        <td><strong>{op.ticker}</strong></td>
                        <td>
                          <span className={`badge badge-${op.tipo}`}>{op.tipo}</span><br />
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{fmt(op.cantidad, 0)} @ ${fmt(op.precio)}</span>
                        </td>
                        <td>${fmt(op.cantidad * op.precio)}</td>
                        <td className={evalCss}><strong>{evalText}</strong></td>
                        <td><button className="btn btn-sm btn-danger" onClick={() => eliminarOp(op.id)}>✕</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* --- TAB 3: WATCHLIST --- */}
      {activeTab === 'watchlist' && (
        <div className="glass-panel">
          <div className="panel-header" style={{ alignItems: 'center' }}>
            <div className="panel-title">Lista de Seguimiento ({watchlist.length})</div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', flexShrink: 0 }}>Filtros:</span>

              <MultiCheckDropdown
                placeholder="Todos los tipos"
                options={[
                  { value: 'accion', label: 'Acciones AR' },
                  { value: 'cedear', label: 'CEDEARs' },
                  { value: 'stock', label: 'Stocks US' },
                ]}
                selected={wlTypeFilters}
                onChange={setWlTypeFilters}
              />

              <MultiCheckDropdown
                placeholder="Todas las categorías"
                options={[...new Set(watchlist.map(w => w.categoria).filter(Boolean))].sort().map(cat => ({ value: cat, label: cat }))}
                selected={wlCatFilters}
                onChange={setWlCatFilters}
              />

              <MultiCheckDropdown
                placeholder="Ocultar activo..."
                options={wlVisibleBeforeExclude.map(w => ({ value: `${w.ticker}-${w.mercado || 'BCBA'}`, label: w.ticker }))}
                selected={wlExcludedTickers}
                onChange={setWlExcludedTickers}
              />

              <button className="btn btn-primary btn-sm" onClick={() => setShowAddWatchlist(!showAddWatchlist)}>+ Suscribir</button>
            </div>
          </div>

          {/* Add Watchlist Form - shown ABOVE the table */}
          {showAddWatchlist && (
            <div className="collapsible-content active">
              <div className="panel-title" style={{ marginBottom: '12px', fontSize: '14px' }}>Sincronizar Activo</div>
              <div className="form-row trio">
                <div>
                  <label>Tipo Activo</label>
                  <select value={wlTipo} onChange={(e) => {
                    const t = e.target.value;
                    setWlTipo(t);
                    if (t === 'accion' || t === 'cedear') setWlMercado('BCBA');
                    else if (t === 'stock') setWlMercado('NYSE');
                  }}>
                    <option value="accion">Acción AR</option>
                    <option value="cedear">CEDEAR</option>
                    <option value="stock">Stock US</option>
                  </select>
                </div>
                <div>
                  <label>Mercado</label>
                  {wlTipo === 'stock' ? (
                    <select value={wlMercado} onChange={e => setWlMercado(e.target.value)}>
                      <option value="NYSE">NYSE</option>
                      <option value="NASDAQ">NASDAQ</option>
                    </select>
                  ) : (
                    <input
                      value="BCBA"
                      readOnly
                      style={{ background: 'rgba(0,0,0,0.1)', color: 'var(--text-muted)', cursor: 'not-allowed' }}
                    />
                  )}
                </div>
                <div>
                  <label>Ticker</label>
                  <input value={wlTicker} onChange={e => setWlTicker(e.target.value.toUpperCase())} placeholder="ej: AAPL" />
                </div>
                <div>
                  <label>Nombre (opc.)</label>
                  <input value={wlNombre} onChange={e => setWlNombre(e.target.value)} placeholder="ej: Apple Inc" />
                </div>
                <div>
                  <label>Categoría (ej: Tech, Banking)</label>
                  <input value={wlCategoria} onChange={e => setWlCategoria(e.target.value)} placeholder="ej: Tech" />
                </div>
              </div>
              <button className="btn btn-primary" onClick={agregarWatchlist}>Guardar en Watchlist</button>
              <button className="btn" style={{ marginLeft: '8px' }} onClick={() => setShowAddWatchlist(false)}>Cancelar</button>
            </div>
          )}

          {/* ── Market Status Bar ── */}
          <MarketStatusBar dailyStats={dailyStats} watchlist={watchlist} />

          <div className="table-container">
            {watchlist.length === 0 ? (
              <div className="empty-state">No estás siguiendo ningún activo.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Activo</th>
                    <th>Tipo</th>
                    <th>Mercado</th>
                    <th>Categoría</th>
                    <th>P. Mercado</th>
                    <th>1 Día</th>
                    <th>5 Días</th>
                    <th>1 Mes</th>
                    <th>6 Meses</th>
                    <th>1 Año</th>
                    <th>5 Años</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {wlVisibleBeforeExclude
                    .filter(w => !wlExcludedTickers.includes(`${w.ticker}-${w.mercado || 'BCBA'}`))
                    .sort((a, b) => {
                      const ytA = getYahooTicker(a) || a.ticker;
                      const ytB = getYahooTicker(b) || b.ticker;
                      const pctA = dailyStats[ytA]?.changePct ?? null;
                      const pctB = dailyStats[ytB]?.changePct ?? null;
                      if (pctA === null && pctB === null) return 0;
                      if (pctA === null) return 1;
                      if (pctB === null) return -1;
                      return pctB - pctA;
                    }).map(w => {
                      const yt = getYahooTicker(w) || w.ticker;
                      const pc = prices[yt] ?? null;
                      const stats = dailyStats[yt] ?? null;

                      let todayCss = 'neutral';
                      let todayText = '—';
                      if (stats && pc !== null) {
                        todayCss = stats.change >= 0 ? 'positive' : 'negative';
                        todayText = fmtPct(stats.changePct);
                      }

                      const fmtHist = (val) => {
                        if (val == null) return <span style={{ color: '#666' }}>—</span>;
                        let css = val >= 0 ? 'positive' : 'negative';
                        return <span className={css}><strong>{fmtPct(val)}</strong></span>;
                      };

                      return (
                        <React.Fragment key={`${w.ticker}-${w.mercado || 'BCBA'}`}>
                          <tr className="expandable-row" onClick={() => setExpandedTicker(expandedTicker === w.ticker ? null : w.ticker)}>
                            <td>
                              <div className="ticker-name">{w.ticker}</div>
                              {w.nombre && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{w.nombre}</div>}
                            </td>
                            <td><span className={`badge badge-${w.tipo}`}>{w.tipo}</span></td>
                            <td><span style={{ fontSize: '11px', opacity: 0.8 }}>{w.mercado || (w.tipo === 'stock' ? 'NYSE/NASDAQ' : 'BCBA')}</span></td>
                            <td><span style={{ fontSize: '11px', opacity: 0.8 }}>{w.categoria || '—'}</span></td>
                            <td>
                              <strong className={pc !== null && stats && !stats.isOpen ? 'price-stale' : ''}>
                                {pc !== null ? `$${fmt(pc)}` : <span style={{ fontStyle: 'italic', color: '#888' }}>cargando...</span>}
                              </strong>
                              {pc !== null && stats && (
                                <div>
                                  <span className={`mkt-price-badge mkt-price-badge--${stats.isOpen ? 'open' : 'closed'}`}>
                                    <span className="mkt-price-badge__dot" />
                                    {stats.isOpen ? 'En vivo' : 'Cierre ant.'}
                                  </span>
                                </div>
                              )}
                            </td>
                            <td className={todayCss}><strong>{todayText}</strong></td>
                            <td>{stats ? fmtHist(stats.hist5d) : '—'}</td>
                            <td>{stats ? fmtHist(stats.hist1m) : '—'}</td>
                            <td>{stats ? fmtHist(stats.hist6m) : '—'}</td>
                            <td>{stats ? fmtHist(stats.hist1y) : '—'}</td>
                            <td>{stats ? fmtHist(stats.hist5y) : '—'}</td>
                            <td><button className="btn btn-sm btn-danger" onClick={(e) => { e.stopPropagation(); eliminarWatchlist(w.ticker); }}>✕</button></td>
                          </tr>
                          {expandedTicker === w.ticker && (
                            <tr className="expanded-panel-row">
                              <td colSpan="12">
                                <HistoricalChart data={stats} ticker={w.ticker} name={w.nombre} />
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
      {/* --- TAB: MERCADOS --- */}
      {activeTab === 'mercados' && (
        <div className="glass-panel">
          <div className="panel-header">
            <div className="panel-title">Referencia de Mercados Globales</div>
          </div>
          
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Indicador</th>
                  <th>Precio</th>
                  <th>Variación Hoy</th>
                  <th>1 Mes</th>
                  <th>6 Meses</th>
                  <th>1 Año</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {[...GLOBAL_INDICES].sort((a, b) => (dailyStats[b.ticker]?.changePct ?? 0) - (dailyStats[a.ticker]?.changePct ?? 0)).map(idx => {
                  const stats = dailyStats[idx.ticker];
                  if (!stats) return null;
                  
                  const isPos = stats.change >= 0;
                  const fmtHist = (val) => {
                    if (val == null) return <span style={{ color: '#666' }}>—</span>;
                    let css = val >= 0 ? 'positive' : 'negative';
                    return <span className={css}><strong>{fmtPct(val)}</strong></span>;
                  };

                  return (
                    <React.Fragment key={idx.ticker}>
                      <tr className="expandable-row" onClick={() => setExpandedTicker(expandedTicker === idx.ticker ? null : idx.ticker)}>
                        <td>
                          <div className="ticker-name">{idx.name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{idx.ticker}</div>
                        </td>
                        <td>
                          <strong className={!stats.isOpen ? 'price-stale' : ''}>
                            {idx.ticker === 'BTC-USD' ? '' : '$'}{fmt(stats.price, idx.ticker === 'BTC-USD' || idx.ticker === '^TNX' ? 2 : 2)}
                          </strong>
                        </td>
                        <td className={isPos ? 'positive' : 'negative'}>
                          <strong>{fmtPct(stats.changePct)}</strong>
                        </td>
                        <td>{fmtHist(stats.hist1m)}</td>
                        <td>{fmtHist(stats.hist6m)}</td>
                        <td>{fmtHist(stats.hist1y)}</td>
                        <td style={{ color: 'var(--accent)', fontSize: '12px' }}>{expandedTicker === idx.ticker ? '▲ Info' : '▼ Info'}</td>
                      </tr>
                      {expandedTicker === idx.ticker && (
                        <tr className="expanded-panel-row">
                          <td colSpan="7">
                            <div className="market-detail-container">
                              <div className="market-explanation">
                                <h4>Acerca de {idx.name}</h4>
                                <p>{idx.desc}</p>
                              </div>
                              <div style={{ flex: 1 }}>
                                <HistoricalChart data={stats} ticker={idx.ticker} name={idx.name} />
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {/* --- TAB 4: TRADES --- */}
      {activeTab === 'trades' && (
        <div className="glass-panel">
          <div className="panel-header">
            <div className="panel-title">Operaciones Cerradas (Trades) ({trades.length})</div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddTrade(!showAddTrade)}>+ Agregar Trade</button>
          </div>

          {/* Add Trade Form */}
          {showAddTrade && (
            <div className="collapsible-content active">
              <div className="panel-title" style={{ marginBottom: '12px', fontSize: '14px' }}>Registrar Trade Cerrado</div>
              {operaciones.length < 2 ? (
                <div className="empty-state" style={{ padding: '1rem' }}>
                  Necesitás al menos dos operaciones registradas en el Histórico para crear un análisis.
                </div>
              ) : (
                <>
                  <div className="form-row">
                    <div>
                      <label>Operación de Compra (Entrada)</label>
                      <select value={tradeCompraId} onChange={e => setTradeCompraId(e.target.value)}>
                        <option value="">— Seleccioná una compra —</option>
                        {operaciones.filter(o => o.tipo === 'compra').sort((a, b) => b.fecha.localeCompare(a.fecha)).map(o => (
                          <option key={o.id} value={o.id}>
                            {o.fecha} · {o.ticker} · Compra {fmt(o.cantidad, 0)} @ ${fmt(o.precio)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label>Operación de Venta (Salida)</label>
                      <select value={tradeVentaId} onChange={e => setTradeVentaId(e.target.value)}>
                        <option value="">— Seleccioná una venta —</option>
                        {operaciones.filter(o => o.tipo === 'venta').sort((a, b) => b.fecha.localeCompare(a.fecha)).map(o => (
                          <option key={o.id} value={o.id}>
                            {o.fecha} · {o.ticker} · Venta {fmt(o.cantidad, 0)} @ ${fmt(o.precio)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button className="btn btn-primary" onClick={agregarTrade}>Guardar Trade</button>
                  <button className="btn" style={{ marginLeft: '8px' }} onClick={() => setShowAddTrade(false)}>Cancelar</button>
                </>
              )}
            </div>
          )}

          {/* Trade Cards */}
          {trades.length === 0 && !showAddTrade ? (
            <div className="empty-state">
              Sin operaciones cerradas registradas todavía. Agregá un trade para comenzar.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
              {trades.map(trade => {
                // Calculate PnL based on the quantity sold to match the buy price accurately.
                const qty = Math.min(trade.compraCantidad, trade.ventaCantidad);
                const montoCompraOperado = trade.compraPrecio * qty;
                const montoVentaOperado = trade.ventaPrecio * qty;
                
                const nominalDiff = montoVentaOperado - montoCompraOperado;
                const pctDiff = montoCompraOperado > 0 ? (nominalDiff / montoCompraOperado) * 100 : 0;
                
                const isPos = nominalDiff >= 0;

                return (
                  <div key={trade.id} className="glass-panel" style={{ background: 'rgba(0,0,0,0.2)', position: 'relative' }}>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem' }}>
                      <div>
                        <h3 style={{ fontSize: '15px', marginBottom: '4px' }}>
                          <span style={{ opacity: 0.7 }}>{trade.compraFecha} → {trade.ventaFecha}</span> · Trade Cerrado: <span style={{ color: 'var(--accent)' }}>{trade.compraTicker}</span>
                          {trade.compraTicker !== trade.ventaTicker && (
                            <span style={{ color: 'var(--text-muted)', fontSize: '12px', marginLeft: '6px' }}>
                              (Venta de {trade.ventaTicker})
                            </span>
                          )}
                        </h3>
                        <p className="hint">
                          Compra: ${fmt(trade.compraPrecio)} · Venta: ${fmt(trade.ventaPrecio)}
                        </p>
                      </div>
                      <button className="btn btn-sm btn-danger" onClick={() => eliminarTrade(trade.id)} style={{ flexShrink: 0, marginLeft: '12px' }}>✕</button>
                    </div>

                    {/* Scenario output */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '14px' }}>
                      <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                        Compraste a <strong>${fmt(trade.compraPrecio)}</strong> y lo vendiste a <strong>${fmt(trade.ventaPrecio)}</strong>.
                        {trade.compraCantidad !== trade.ventaCantidad && (
                          <div className="hint" style={{ marginTop: '4px' }}>
                            Cantidades originales: Compra {fmt(trade.compraCantidad, 0)} | Venta {fmt(trade.ventaCantidad, 0)}. Cálculo basado en {fmt(qty, 0)} nominales para igualar.
                          </div>
                        )}
                      </div>

                      <div style={{ padding: '16px', background: isPos ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', border: `1px solid ${isPos ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`, borderRadius: '8px' }}>
                        Resultado del Trade:{' '}
                        <strong className={isPos ? 'positive' : 'negative'} style={{ fontSize: '18px' }}>
                          {fmtPct(pctDiff)} ({isPos ? '+' : '-'}${fmt(Math.abs(nominalDiff))})
                        </strong>
                        {dolarMep && (
                          <span style={{ fontSize: '14px', fontWeight: '400', opacity: 0.8, marginLeft: '10px' }}>
                            ≈ US$ {fmt(Math.abs(nominalDiff) / dolarMep)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* --- TAB 5: EVALUACIÓN --- */}
      {activeTab === 'evaluacion' && (
        <div className="glass-panel">
          <div className="panel-header">
            <div className="panel-title">Evaluación de Operaciones Individuales ({evals.length})</div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddEval(!showAddEval)}>+ Agregar a Seguimiento</button>
          </div>

          {showAddEval && (
            <div className="collapsible-content active">
              <div className="panel-title" style={{ marginBottom: '12px', fontSize: '14px' }}>Nueva Evaluación</div>
              {operaciones.length === 0 ? (
                <div className="empty-state" style={{ padding: '1rem' }}>
                  No hay operaciones en el histórico para evaluar.
                </div>
              ) : (
                <div className="form-row">
                  <div style={{ flex: 1 }}>
                    <label>Seleccionar Operación</label>
                    <select value={evalOpId} onChange={e => setEvalOpId(e.target.value)}>
                      <option value="">— Seleccioná una operación —</option>
                      {[...operaciones].sort((a,b) => b.fecha.localeCompare(a.fecha)).map(o => (
                        <option key={o.id} value={o.id}>
                          {o.fecha} · {o.ticker} · {o.tipo.toUpperCase()} {fmt(o.cantidad, 0)} @ ${fmt(o.precio)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                    <button className="btn btn-primary" onClick={agregarEval}>Agregar</button>
                    <button className="btn" onClick={() => setShowAddEval(false)}>Cancelar</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {evals.length === 0 && !showAddEval ? (
            <div className="empty-state">
              No estás evaluando ninguna operación. Agregá una para ver su rendimiento actual.
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                {evals.map(ev => {
                  const base = ev.ticker.replace(/\.BA$/i, '');
                  const curPrice = prices[ev.ticker] ?? prices[base] ?? null;
                  const opTotal = ev.precio * ev.cantidad;
                  
                  let perfHtml = null;
                  if (curPrice === null) {
                    perfHtml = <div className="empty-state" style={{ padding: '20px' }}>Cargando cotización...</div>;
                  } else {
                    const diff = curPrice - ev.precio;
                    const pct = (diff / ev.precio) * 100;
                    const nominal = diff * ev.cantidad;

                    if (ev.tipo === 'compra') {
                      const isPos = diff >= 0;
                      perfHtml = (
                        <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Rendimiento desde la compra:</div>
                          <div className={isPos ? 'positive' : 'negative'} style={{ fontSize: '18px', fontWeight: '700' }}>
                            {fmtPct(pct)} ({isPos ? '+' : '-'}${fmt(Math.abs(nominal))})
                          </div>
                          <div className="hint" style={{ marginTop: '8px' }}>
                            Compra: ${fmt(ev.precio)} → Actual: <strong>${fmt(curPrice)}</strong>
                          </div>
                        </div>
                      );
                    } else {
                      const isGoodSale = diff <= 0;
                      const opportunity = -nominal;
                      const oppPct = -pct;
                      perfHtml = (
                        <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Análisis post-venta:</div>
                          <div className={isGoodSale ? 'positive' : 'negative'} style={{ fontSize: '18px', fontWeight: '700' }}>
                            {isGoodSale ? 'Evitaste perder' : 'Dejaste de ganar'}{' '}
                            {fmtPct(Math.abs(oppPct))} ({isGoodSale ? '+' : '-'}${fmt(Math.abs(opportunity))})
                          </div>
                          <div className="hint" style={{ marginTop: '8px' }}>
                            Venta: ${fmt(ev.precio)} → Actual: <strong>${fmt(curPrice)}</strong>
                          </div>
                        </div>
                      );
                    }
                  }

                  return (
                    <div key={ev.id} className="glass-panel" style={{ background: 'rgba(0,0,0,0.2)', position: 'relative', opacity: ev.excluded ? 0.5 : 1, transition: 'opacity 0.2s' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                        <div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>{ev.fecha}</div>
                          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{ev.ticker}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                           <label className="mcd-option" style={{ margin: 0, padding: '4px 8px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', border: '1px solid var(--glass-border)', cursor: 'pointer' }}>
                              <input type="checkbox" checked={!ev.excluded} onChange={() => toggleEvalExclusion(ev.id)} style={{ width: '12px', height: '12px' }} />
                              <span style={{ fontSize: '10px', marginLeft: '4px' }}>Incluir</span>
                           </label>
                           <button className="btn btn-sm btn-danger" onClick={() => eliminarEval(ev.id)} style={{ padding: '2px 6px' }}>✕</button>
                        </div>
                      </div>
                      <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                        <div>
                          <span className={`badge badge-${ev.tipo}`}>{ev.tipo}</span>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>{fmt(ev.cantidad, 0)} nominales</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total operado</div>
                          <div style={{ fontSize: '13px', fontWeight: '600' }}>${fmt(opTotal)}</div>
                        </div>
                      </div>
                      {perfHtml}
                    </div>
                  );
                })}
              </div>

              {/* Net Summary Panel */}
              {evals.filter(e => !e.excluded).length > 0 && (() => {
                let netResult = 0;
                let totalBuyVol = 0;
                let totalSellVol = 0;

                let totalHoldingResult = 0;
                let totalSaleResult = 0;

                evals.filter(e => !e.excluded).forEach(ev => {
                  const base = ev.ticker.replace(/\.BA$/i, '');
                  const curPrice = prices[ev.ticker] ?? prices[base] ?? null;
                  const opTotal = ev.precio * ev.cantidad;

                  if (curPrice !== null) {
                    if (ev.tipo === 'compra') {
                       const res = (curPrice - ev.precio) * ev.cantidad;
                       netResult += res;
                       totalHoldingResult += res;
                       totalBuyVol += opTotal;
                    } else {
                       const res = (ev.precio - curPrice) * ev.cantidad;
                       netResult += res;
                       totalSaleResult += res;
                       totalSellVol += opTotal;
                    }
                  }
                });

                const totalVol = totalBuyVol + totalSellVol;
                const netPct = totalBuyVol > 0 ? (netResult / totalBuyVol) * 100 : 0;

                return (
                  <div className="glass-panel" style={{ marginTop: '2rem', background: 'rgba(94, 106, 210, 0.08)', border: '1px solid rgba(94, 106, 210, 0.25)', padding: '1.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '2rem' }}>
                      
                      {/* Left: Title and Volumes */}
                      <div style={{ flex: 1 }}>
                        <div className="panel-title" style={{ fontSize: '20px', marginBottom: '6px' }}>Resultado Neto Consolidado</div>
                        <p className="hint" style={{ marginBottom: '24px', fontSize: '13px' }}>Suma de rendimientos (compras) y beneficios de oportunidad (ventas) seleccionados.</p>
                        
                        <div style={{ display: 'flex', gap: '2.5rem' }}>
                          <div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Volumen Compras</div>
                            <div style={{ fontSize: '16px', fontWeight: '700' }}>${fmt(totalBuyVol)}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Volumen Ventas</div>
                            <div style={{ fontSize: '16px', fontWeight: '700' }}>${fmt(totalSellVol)}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Total Operado</div>
                            <div style={{ fontSize: '16px', fontWeight: '700', color: '#6366f1' }}>${fmt(totalVol)}</div>
                          </div>
                        </div>
                      </div>

                      {/* Right: Specific Results and Total */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '3rem' }}>
                        
                        {/* Stacked Mid Boxes */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'right', minWidth: '160px' }}>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>Res. por Tenencia</div>
                            <div style={{ fontSize: '16px', fontWeight: '700' }} className={totalHoldingResult >= 0 ? 'positive' : 'negative'}>
                              {totalHoldingResult >= 0 ? '+' : '-'}${fmt(Math.abs(totalHoldingResult))}
                            </div>
                          </div>
                          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'right', minWidth: '160px' }}>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>Res. por Venta</div>
                            <div style={{ fontSize: '16px', fontWeight: '700' }} className={totalSaleResult >= 0 ? 'positive' : 'negative'}>
                              {totalSaleResult >= 0 ? '+' : '-'}${fmt(Math.abs(totalSaleResult))}
                            </div>
                          </div>
                        </div>

                        {/* Far Right: Total Result */}
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px', opacity: 0.8 }}>Resultado Final</div>
                          <div className={`metric-value ${netResult >= 0 ? 'positive' : 'negative'}`} style={{ fontSize: '42px', fontWeight: '800', lineHeight: '1', marginBottom: '8px' }}>
                            {netResult >= 0 ? '+' : '-'}${fmt(Math.abs(netResult))}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px' }}>
                            <span className={netResult >= 0 ? 'positive' : 'negative'} style={{ fontWeight: '700', fontSize: '18px' }}>
                               {fmtPct(netPct)}
                            </span>
                            {dolarMep && (
                              <span style={{ fontSize: '15px', color: 'var(--text-muted)', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '12px' }}>
                                ≈ US$ {fmt(Math.abs(netResult) / dolarMep)}
                              </span>
                            )}
                          </div>
                        </div>

                      </div>

                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}

    </div>
  );
}

export default App;
