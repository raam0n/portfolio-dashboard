import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { getAssetSectorAndSubsector } from '../App';

// Extended curated color palette for charts
const EXTENDED_PALETTE = [
  '#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ec4899',
  '#8b5cf6', '#06b6d4', '#f97316', '#14b8a6', '#eab308',
  '#d946ef', '#84cc16', '#22d3ee', '#fb7185', '#a855f7',
  '#0284c7', '#059669', '#d97706', '#db2777', '#7c3aed',
  '#2563eb', '#16a34a', '#ca8a04', '#e11d48', '#9333ea',
  '#0891b2', '#4f46e5', '#65a30d', '#c026d3', '#475569'
];

const PREDEFINED_SECTOR_COLORS = {
  'Tech': '#6366f1',
  'Banking': '#3b82f6',
  'Energía': '#f59e0b',
  'Minería': '#eab308',
  'Renta Fija Soberana': '#10b981',
  'Renta Fija Corporativa': '#14b8a6',
  'Renta Fija Subsoberana': '#059669',
  'Consumo': '#ec4899',
  'Bienes Raíces': '#f97316',
  'Servicios IT': '#8b5cf6',
  'Entretenimiento': '#d946ef',
  'Industrial': '#0284c7',
  'Index Fund': '#06b6d4',
  'Efectivo': '#64748b',
  'Otros': '#475569'
};

const PREDEFINED_TIPO_COLORS = {
  'CEDEAR': '#6366f1',
  'Acción AR': '#10b981',
  'Stock US': '#8b5cf6',
  'Bono': '#f59e0b',
  'Efectivo': '#06b6d4',
  'Otros': '#64748b'
};

// String hash for deterministic color assignment
function getDeterministicColor(str, fallbackPalette = EXTENDED_PALETTE) {
  if (!str) return '#64748b';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % fallbackPalette.length;
  return fallbackPalette[index];
}

const fmtCurrency = (n, mode = 'ARS') => {
  if (n == null || isNaN(n)) return '—';
  const formatted = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(Math.round(n));
  return mode === 'ARS' ? `$${formatted}` : `US$ ${formatted}`;
};

const fmtPct = (n) => {
  if (n == null || isNaN(n)) return '0.0%';
  if (n < 1 && n > 0) return `${n.toFixed(2)}%`;
  if (n < 10) return `${n.toFixed(2)}%`;
  return `${n.toFixed(1)}%`;
};

/**
 * Stacked Bar Chart Component for a single dimension (e.g. Sector, Asset, etc.)
 */
function StackedBarDimensionCard({
  title,
  subtitle,
  icon,
  dataByPortfolio,
  colorMap,
  currencyMode,
  onSelectPortfolio,
  highlightedCategory,
  setHighlightedCategory
}) {
  const [tooltip, setTooltip] = useState(null);

  // Collect all unique categories present in this dimension sorted alphabetically (A-Z) with 'Otros' at the end
  const globalCategoryStats = useMemo(() => {
    const totals = {};
    dataByPortfolio.forEach(p => {
      p.segments.forEach(seg => {
        totals[seg.label] = (totals[seg.label] || 0) + seg.value;
      });
    });
    return Object.entries(totals)
      .map(([label, totalVal]) => ({ label, totalVal }))
      .sort((a, b) => {
        if (a.label === 'Otros') return 1;
        if (b.label === 'Otros') return -1;
        return a.label.localeCompare(b.label, 'es', { sensitivity: 'base' });
      });
  }, [dataByPortfolio]);

  const handleSegmentMouseMove = (e, p, seg, color) => {
    setHighlightedCategory(seg.label);
    const clientX = e.clientX;
    const clientY = e.clientY;
    const isNearTop = clientY < 180;
    setTooltip({
      x: Math.max(160, Math.min(window.innerWidth - 160, clientX)),
      y: isNearTop ? clientY + 16 : clientY - 14,
      placement: isNearTop ? 'bottom' : 'top',
      portfolioName: p.name,
      label: seg.label,
      pct: seg.pct,
      value: seg.value,
      items: seg.items || [],
      color,
      isSmall: seg.pct < 5
    });
  };

  return (
    <div className="glass-panel stacked-comp-card">
      <div className="stacked-comp-header">
        <div className="stacked-comp-title-group">
          <div className="stacked-comp-title">
            <span className="stacked-comp-icon">{icon}</span>
            <span>{title}</span>
            <span className="stacked-comp-badge">{globalCategoryStats.length} categorías</span>
          </div>
          <div className="stacked-comp-subtitle">{subtitle}</div>
        </div>
      </div>

      {/* Global Category Legend with interactive hover */}
      <div className="stacked-legend-wrapper">
        <div className="stacked-legend-title">Categorías (posá el mouse para resaltar en todas las carteras):</div>
        <div className="stacked-legend-pills">
          {globalCategoryStats.map(cat => {
            const color = colorMap[cat.label] || getDeterministicColor(cat.label);
            const isHovered = highlightedCategory === cat.label;
            const isDimmed = highlightedCategory !== null && !isHovered;

            return (
              <button
                key={cat.label}
                className={`stacked-legend-pill ${isHovered ? 'active' : ''} ${isDimmed ? 'dimmed' : ''}`}
                onMouseEnter={() => setHighlightedCategory(cat.label)}
                onMouseLeave={() => setHighlightedCategory(null)}
                onClick={() => setHighlightedCategory(prev => prev === cat.label ? null : cat.label)}
                style={{
                  '--pill-color': color,
                  borderColor: isHovered ? color : 'var(--glass-border)'
                }}
              >
                <span className="stacked-legend-dot" style={{ background: color }} />
                <span className="stacked-legend-label">{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Stacked Bars per Portfolio */}
      <div className="stacked-bars-list">
        {dataByPortfolio.map(p => {
          const hasData = p.totalVal > 0 && p.segments.length > 0;
          const activeHighlightedSeg = highlightedCategory
            ? p.segments.find(s => s.label === highlightedCategory)
            : null;

          return (
            <div key={p.id} className="stacked-portfolio-row">
              <div className="stacked-portfolio-meta">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    className="stacked-portfolio-name-btn"
                    onClick={() => onSelectPortfolio && onSelectPortfolio(p.id)}
                    title={`Ver detalle de ${p.name}`}
                  >
                    <span className="stacked-portfolio-name">{p.name}</span>
                    <span className="stacked-portfolio-jump">↗</span>
                  </button>

                  {/* Quick-glance inspection badge when hovering a category */}
                  {activeHighlightedSeg && (
                    <span
                      className="stacked-hover-badge"
                      style={{
                        background: `${colorMap[activeHighlightedSeg.label] || '#6366f1'}22`,
                        borderColor: colorMap[activeHighlightedSeg.label] || '#6366f1',
                        color: '#fff'
                      }}
                    >
                      {activeHighlightedSeg.label}: <strong>{fmtPct(activeHighlightedSeg.pct)}</strong> ({fmtCurrency(activeHighlightedSeg.value, currencyMode)})
                    </span>
                  )}
                </div>

                <div className="stacked-portfolio-val">
                  {hasData ? (
                    <>
                      <strong>{fmtCurrency(p.totalVal, currencyMode)}</strong>
                      <span className="stacked-portfolio-count">({p.activosCount} {p.activosCount === 1 ? 'activo' : 'activos'})</span>
                    </>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>Sin posiciones</span>
                  )}
                </div>
              </div>

              {/* The Stacked Bar */}
              <div className="stacked-bar-track">
                {!hasData ? (
                  <div className="stacked-bar-empty">Sin activos en cartera</div>
                ) : (
                  p.segments.map((seg, idx) => {
                    const color = colorMap[seg.label] || getDeterministicColor(seg.label);
                    const isHovered = highlightedCategory === seg.label;
                    const isDimmed = highlightedCategory !== null && !isHovered;
                    const showText = seg.pct >= 4.5;

                    return (
                      <div
                        key={idx}
                        className={`stacked-bar-segment ${isHovered ? 'highlighted' : ''} ${isDimmed ? 'dimmed' : ''} ${seg.pct < 3 ? 'is-micro' : ''}`}
                        style={{
                          width: `${Math.max(seg.pct, 0.4)}%`,
                          backgroundColor: color,
                        }}
                        onMouseEnter={(e) => handleSegmentMouseMove(e, p, seg, color)}
                        onMouseMove={(e) => handleSegmentMouseMove(e, p, seg, color)}
                        onMouseLeave={() => {
                          setHighlightedCategory(null);
                          setTooltip(null);
                        }}
                      >
                        {showText && (
                          <span className="stacked-segment-label">
                            {seg.label} <small>{seg.pct.toFixed(0)}%</small>
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating Detailed Tooltip rendered at document.body via Portal to guarantee front layer */}
      {tooltip && typeof document !== 'undefined' && createPortal(
        <div
          className={`stacked-tooltip ${tooltip.placement === 'bottom' ? 'placement-bottom' : ''}`}
          style={{
            left: `${tooltip.x}px`,
            top: `${tooltip.y}px`
          }}
        >
          <div className="stacked-tooltip-header">
            <span className="stacked-tooltip-dot" style={{ background: tooltip.color }} />
            <span className="stacked-tooltip-title">{tooltip.label}</span>
            <span className="stacked-tooltip-pct">{fmtPct(tooltip.pct)}</span>
          </div>

          <div className="stacked-tooltip-pname">{tooltip.portfolioName}</div>

          <div className="stacked-tooltip-val">
            Valuación: <strong>{fmtCurrency(tooltip.value, currencyMode)}</strong>
            {tooltip.isSmall && (
              <span className="stacked-tooltip-micro-tag">🔍 Fragmento menor ({fmtPct(tooltip.pct)})</span>
            )}
          </div>

          {tooltip.items && tooltip.items.length > 0 && (
            <div className="stacked-tooltip-items">
              <div className="stacked-tooltip-items-title">
                {tooltip.items.length === 1 ? 'Activo:' : `Activos incluidos (${tooltip.items.length}):`}
              </div>
              <div className="stacked-tooltip-items-list">
                {tooltip.items.slice(0, 8).map((it, i) => (
                  <div key={i} className="stacked-tooltip-item-row">
                    <span className="stacked-tooltip-item-ticker">{it.ticker}</span>
                    <span className="stacked-tooltip-item-val">{fmtCurrency(it.valor, currencyMode)} ({fmtPct(it.pct)})</span>
                  </div>
                ))}
                {tooltip.items.length > 8 && (
                  <div className="stacked-tooltip-more">+{tooltip.items.length - 8} posiciones adicionales...</div>
                )}
              </div>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

/**
 * Main Multi-Portfolio Compositions Section Component
 */
export default function MultiPortfolioCompositions({
  portfolios = [],
  allHoldings = {},
  prices = {},
  dolarMep = 1,
  tickerCatalog = {},
  currencyMode = 'ARS',
  getYahooTicker = () => null,
  onSelectPortfolio
}) {
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'tipo' | 'sector' | 'subsector' | 'activo'
  const [highlightedCategory, setHighlightedCategory] = useState(null);

  // Compute all breakdowns across portfolios
  const processedData = useMemo(() => {
    const mep = dolarMep || 1;

    const byAssetPortfolios = [];
    const byTipoPortfolios = [];
    const bySectorPortfolios = [];
    const bySubsectorPortfolios = [];

    const allAssetLabels = new Set();
    const allTipoLabels = new Set();
    const allSectorLabels = new Set();
    const allSubsectorLabels = new Set();

    portfolios.forEach(p => {
      const pHoldings = allHoldings[p.id] || [];
      let totalVal = 0;

      const rawByAsset = {};
      const rawByTipo = {};
      const rawBySector = {};
      const rawBySubsector = {};

      pHoldings.forEach(h => {
        const isEfectivo = h.tipo === 'efectivo';
        const yt = getYahooTicker(h) || h.ticker;
        const pc = isEfectivo ? 1 : (prices[yt] ?? null);
        const unitVal = pc !== null ? pc : (h.precioEntrada || 0);
        const itemValNative = unitVal * (h.cantidad || 0);
        const isUsdAsset = h.tipo === 'stock' || (isEfectivo && h.ticker === 'USD');

        const valARS = isUsdAsset ? itemValNative * mep : itemValNative;
        const valUSD = isUsdAsset ? itemValNative : itemValNative / mep;
        const valor = currencyMode === 'ARS' ? valARS : valUSD;

        totalVal += valor;

        // 1. Activo
        const ticker = (h.ticker || 'OTRO').toUpperCase();
        if (!rawByAsset[ticker]) rawByAsset[ticker] = { valor: 0, items: [] };
        rawByAsset[ticker].valor += valor;
        const exAsset = rawByAsset[ticker].items.find(it => it.ticker === ticker);
        if (exAsset) {
          exAsset.valor += valor;
          exAsset.cantidad = (exAsset.cantidad || 0) + (h.cantidad || 0);
        } else {
          rawByAsset[ticker].items.push({ ticker, valor, cantidad: h.cantidad });
        }

        // 2. Tipo
        const tipoLabel = h.tipo === 'accion' ? 'Acción AR'
          : h.tipo === 'stock' ? 'Stock US'
          : h.tipo === 'cedear' ? 'CEDEAR'
          : h.tipo === 'efectivo' ? 'Efectivo'
          : 'Bono';
        if (!rawByTipo[tipoLabel]) rawByTipo[tipoLabel] = { valor: 0, items: [] };
        rawByTipo[tipoLabel].valor += valor;
        const exTipo = rawByTipo[tipoLabel].items.find(it => it.ticker === ticker);
        if (exTipo) {
          exTipo.valor += valor;
        } else {
          rawByTipo[tipoLabel].items.push({ ticker, valor });
        }

        // 3. Sector & Subsector
        const rawTicker = (h.ticker || '').toUpperCase();
        const info = tickerCatalog[rawTicker] || {};
        const { sector, subsector } = getAssetSectorAndSubsector(h.ticker, h.tipo, info);

        if (!rawBySector[sector]) rawBySector[sector] = { valor: 0, items: [] };
        rawBySector[sector].valor += valor;
        const exSector = rawBySector[sector].items.find(it => it.ticker === ticker);
        if (exSector) {
          exSector.valor += valor;
        } else {
          rawBySector[sector].items.push({ ticker, valor });
        }

        if (!rawBySubsector[subsector]) rawBySubsector[subsector] = { valor: 0, items: [] };
        rawBySubsector[subsector].valor += valor;
        const exSubsector = rawBySubsector[subsector].items.find(it => it.ticker === ticker);
        if (exSubsector) {
          exSubsector.valor += valor;
        } else {
          rawBySubsector[subsector].items.push({ ticker, valor });
        }
      });

      // Transform into sorted segments with percentages (alphabetically sorted, 'Otros' at the end)
      const toSegments = (rawObj, groupThresholdPct = 0) => {
        if (totalVal === 0) return [];
        let entries = Object.entries(rawObj).map(([label, data]) => ({
          label,
          value: data.valor,
          pct: (data.valor / totalVal) * 100,
          items: data.items.map(it => ({ ...it, pct: (it.valor / totalVal) * 100 })).sort((a, b) => a.ticker.localeCompare(b.ticker, 'es', { sensitivity: 'base' }))
        })).sort((a, b) => {
          if (a.label === 'Otros') return 1;
          if (b.label === 'Otros') return -1;
          return a.label.localeCompare(b.label, 'es', { sensitivity: 'base' });
        });

        if (groupThresholdPct > 0) {
          const thresholdVal = totalVal * (groupThresholdPct / 100);
          const keep = [];
          let otrosVal = 0;
          const otrosItems = [];

          entries.forEach(e => {
            if (e.value < thresholdVal) {
              otrosVal += e.value;
              otrosItems.push(...e.items);
            } else {
              keep.push(e);
            }
          });

          if (otrosVal > 0) {
            keep.push({
              label: 'Otros',
              value: otrosVal,
              pct: (otrosVal / totalVal) * 100,
              items: otrosItems.sort((a, b) => a.ticker.localeCompare(b.ticker, 'es', { sensitivity: 'base' }))
            });
          }
          entries = keep;
        }

        return entries;
      };

      const tipoSegs = toSegments(rawByTipo, 0);
      const sectorSegs = toSegments(rawBySector, 0);
      const subsectorSegs = toSegments(rawBySubsector, 0);
      const assetSegs = toSegments(rawByAsset, 1.5);

      tipoSegs.forEach(s => allTipoLabels.add(s.label));
      sectorSegs.forEach(s => allSectorLabels.add(s.label));
      subsectorSegs.forEach(s => allSubsectorLabels.add(s.label));
      assetSegs.forEach(s => allAssetLabels.add(s.label));

      const pBase = {
        id: p.id,
        name: p.name || p.id,
        totalVal,
        activosCount: pHoldings.length
      };

      byTipoPortfolios.push({ ...pBase, segments: tipoSegs });
      bySectorPortfolios.push({ ...pBase, segments: sectorSegs });
      bySubsectorPortfolios.push({ ...pBase, segments: subsectorSegs });
      byAssetPortfolios.push({ ...pBase, segments: assetSegs });
    });

    // Helper to sort labels alphabetically with 'Otros' at the end
    const sortLabelsAlpha = (labelsSet) => {
      return Array.from(labelsSet).sort((a, b) => {
        if (a === 'Otros') return 1;
        if (b === 'Otros') return -1;
        return a.localeCompare(b, 'es', { sensitivity: 'base' });
      });
    };

    // Build color mappings
    const tipoColorMap = { ...PREDEFINED_TIPO_COLORS };
    sortLabelsAlpha(allTipoLabels).forEach((l, i) => {
      if (!tipoColorMap[l]) tipoColorMap[l] = EXTENDED_PALETTE[i % EXTENDED_PALETTE.length];
    });

    const sectorColorMap = { ...PREDEFINED_SECTOR_COLORS };
    sortLabelsAlpha(allSectorLabels).forEach((l, i) => {
      if (!sectorColorMap[l]) sectorColorMap[l] = EXTENDED_PALETTE[i % EXTENDED_PALETTE.length];
    });

    const subsectorColorMap = {};
    sortLabelsAlpha(allSubsectorLabels).forEach((l, i) => {
      subsectorColorMap[l] = getDeterministicColor(l);
    });

    const assetColorMap = {};
    sortLabelsAlpha(allAssetLabels).forEach((l, i) => {
      assetColorMap[l] = l === 'Otros' ? '#64748b' : EXTENDED_PALETTE[i % EXTENDED_PALETTE.length];
    });

    return {
      byTipoPortfolios,
      bySectorPortfolios,
      bySubsectorPortfolios,
      byAssetPortfolios,
      tipoColorMap,
      sectorColorMap,
      subsectorColorMap,
      assetColorMap
    };
  }, [portfolios, allHoldings, prices, dolarMep, tickerCatalog, currencyMode, getYahooTicker]);

  return (
    <div className="multi-comp-section">
      {/* Section Header with View Mode Tabs in specified order */}
      <div className="multi-comp-header-bar">
        <div>
          <h3 className="section-title" style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>📊</span> Composiciones Comparativas por Cartera
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
            Gráficos de barras apiladas al ancho completo (100%) para comparar ponderaciones y balancear riesgos en un solo golpe de vista.
          </p>
        </div>

        <div className="multi-comp-nav">
          <button
            className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            📜 Ver Todos (Ancho Completo)
          </button>
          <button
            className={`tab-btn ${activeTab === 'tipo' ? 'active' : ''}`}
            onClick={() => setActiveTab('tipo')}
          >
            1. 🏷️ % por Tipo
          </button>
          <button
            className={`tab-btn ${activeTab === 'sector' ? 'active' : ''}`}
            onClick={() => setActiveTab('sector')}
          >
            2. 🏢 % por Sector
          </button>
          <button
            className={`tab-btn ${activeTab === 'subsector' ? 'active' : ''}`}
            onClick={() => setActiveTab('subsector')}
          >
            3. 🔬 % por Subsector
          </button>
          <button
            className={`tab-btn ${activeTab === 'activo' ? 'active' : ''}`}
            onClick={() => setActiveTab('activo')}
          >
            4. 🪙 % por Activo
          </button>
        </div>
      </div>

      {/* Cards List - 1 Full-width Card per row in user order */}
      <div className="multi-comp-grid">
        {/* 1 - % por Tipo de Activo */}
        {(activeTab === 'all' || activeTab === 'tipo') && (
          <StackedBarDimensionCard
            title="1. % por Tipo de Activo"
            subtitle="Acciones AR, CEDEARs, Stocks US, Bonos y Efectivo"
            icon="🏷️"
            dataByPortfolio={processedData.byTipoPortfolios}
            colorMap={processedData.tipoColorMap}
            currencyMode={currencyMode}
            onSelectPortfolio={onSelectPortfolio}
            highlightedCategory={highlightedCategory}
            setHighlightedCategory={setHighlightedCategory}
          />
        )}

        {/* 2 - % por Sector */}
        {(activeTab === 'all' || activeTab === 'sector') && (
          <StackedBarDimensionCard
            title="2. % por Sector"
            subtitle="Exposición sectorial: Tech, Banking, Energía, Renta Fija Soberana / Corporativa, Consumo, etc."
            icon="🏢"
            dataByPortfolio={processedData.bySectorPortfolios}
            colorMap={processedData.sectorColorMap}
            currencyMode={currencyMode}
            onSelectPortfolio={onSelectPortfolio}
            highlightedCategory={highlightedCategory}
            setHighlightedCategory={setHighlightedCategory}
          />
        )}

        {/* 3 - % por Subsector */}
        {(activeTab === 'all' || activeTab === 'subsector') && (
          <StackedBarDimensionCard
            title="3. % por Subsector"
            subtitle="Desglose por industria específica y tipo de bono (Semiconductores, Bancos, Petróleo, Bonos USD, ONs, etc.)"
            icon="🔬"
            dataByPortfolio={processedData.bySubsectorPortfolios}
            colorMap={processedData.subsectorColorMap}
            currencyMode={currencyMode}
            onSelectPortfolio={onSelectPortfolio}
            highlightedCategory={highlightedCategory}
            setHighlightedCategory={setHighlightedCategory}
          />
        )}

        {/* 4 - % por Activo */}
        {(activeTab === 'all' || activeTab === 'activo') && (
          <StackedBarDimensionCard
            title="4. % por Activo"
            subtitle="Distribución detallada por ticker individual (posiciones menores al 1.5% agrupadas en 'Otros')"
            icon="🪙"
            dataByPortfolio={processedData.byAssetPortfolios}
            colorMap={processedData.assetColorMap}
            currencyMode={currencyMode}
            onSelectPortfolio={onSelectPortfolio}
            highlightedCategory={highlightedCategory}
            setHighlightedCategory={setHighlightedCategory}
          />
        )}
      </div>
    </div>
  );
}
