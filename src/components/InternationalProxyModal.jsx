import React, { useState, useMemo } from 'react';
import { extractPortfolioInternationalProxy } from '../services/marketProxy';

export default function InternationalProxyModal({
  isOpen,
  onClose,
  holdings = [],
  allHoldings = {},
  portfolios = [],
  currentPortfolioId,
  tickerCatalog = {},
  prices = {},
  dolarMep = 1,
  onImport
}) {
  const [selectedScope, setSelectedScope] = useState('current'); // 'current' | 'all'
  const [selectedTickers, setSelectedTickers] = useState(new Set());
  const [importMode, setImportMode] = useState('append'); // 'append' | 'replace'

  // Extract source holdings based on scope
  const targetHoldings = useMemo(() => {
    if (selectedScope === 'current') {
      return holdings;
    }
    // Combine all portfolios
    const all = [];
    Object.values(allHoldings).forEach(list => {
      if (Array.isArray(list)) all.push(...list);
    });
    return all;
  }, [selectedScope, holdings, allHoldings]);

  // Extract proxy analysis
  const proxyData = useMemo(() => {
    return extractPortfolioInternationalProxy(targetHoldings, tickerCatalog, prices, dolarMep);
  }, [targetHoldings, tickerCatalog, prices, dolarMep]);

  // Initialize all mapped tickers as selected by default
  React.useEffect(() => {
    if (proxyData.mapped.length > 0) {
      setSelectedTickers(new Set(proxyData.mapped.map(m => m.usTicker)));
    }
  }, [proxyData.mapped]);

  if (!isOpen) return null;

  const toggleTicker = (usTicker) => {
    setSelectedTickers(prev => {
      const next = new Set(prev);
      if (next.has(usTicker)) next.delete(usTicker);
      else next.add(usTicker);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedTickers.size === proxyData.mapped.length) {
      setSelectedTickers(new Set());
    } else {
      setSelectedTickers(new Set(proxyData.mapped.map(m => m.usTicker)));
    }
  };

  const handleConfirm = () => {
    const itemsToImport = proxyData.mapped.filter(m => selectedTickers.has(m.usTicker));
    if (itemsToImport.length === 0) {
      alert('Por favor seleccioná al menos un activo para importar.');
      return;
    }
    onImport(itemsToImport, importMode);
    onClose();
  };

  const currentPortfolioObj = portfolios.find(p => p.id === currentPortfolioId);

  return (
    <div className="proxy-modal-overlay" onClick={onClose}>
      <div className="proxy-modal-card" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="proxy-modal-header">
          <div className="proxy-modal-title-group">
            <div className="proxy-modal-title">
              <span style={{ fontSize: '22px' }}>🌎</span>
              <span>Importar Proxy Internacional de Cartera</span>
            </div>
            <div className="proxy-modal-subtitle">
              Convertí tus acciones y CEDEARs en sus cotizaciones de Wall Street (ADRs y US Stocks) para seguir tu cartera en feriados locales.
            </div>
          </div>
          <button className="proxy-modal-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Scope Selector Bar */}
        <div className="proxy-modal-scope-bar">
          <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>Origen de Cartera:</label>
          <div className="proxy-modal-scope-buttons">
            <button
              className={`btn btn-sm ${selectedScope === 'current' ? 'btn-primary' : ''}`}
              onClick={() => setSelectedScope('current')}
            >
              Cartera Activa ({currentPortfolioObj?.name || 'Mi Portfolio'})
            </button>
            <button
              className={`btn btn-sm ${selectedScope === 'all' ? 'btn-primary' : ''}`}
              onClick={() => setSelectedScope('all')}
            >
              Todas las Carteras ({portfolios.length})
            </button>
          </div>
        </div>

        {/* Coverage Metrics Summary */}
        <div className="proxy-metrics-grid">
          <div className="proxy-metric-card highlight">
            <div className="proxy-metric-val">{proxyData.mapped.length}</div>
            <div className="proxy-metric-label">Cotizantes en Wall Street</div>
            <div className="proxy-metric-sub">{proxyData.coveragePct.toFixed(1)}% de la cartera</div>
          </div>
          <div className="proxy-metric-card">
            <div className="proxy-metric-val">{proxyData.unsupported.length}</div>
            <div className="proxy-metric-label">Locales sin ADR</div>
            <div className="proxy-metric-sub">Solo operan en BCBA</div>
          </div>
          <div className="proxy-metric-card">
            <div className="proxy-metric-val">{proxyData.ignored.length}</div>
            <div className="proxy-metric-label">Bonos / Efectivo</div>
            <div className="proxy-metric-sub">Omitidos automáticamente</div>
          </div>
        </div>

        {/* Mapped Assets Selection Table */}
        <div className="proxy-table-wrapper">
          <div className="proxy-table-header-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                id="select-all-proxy"
                checked={selectedTickers.size > 0 && selectedTickers.size === proxyData.mapped.length}
                onChange={toggleAll}
              />
              <label htmlFor="select-all-proxy" style={{ fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>
                Seleccionar todos ({selectedTickers.size} de {proxyData.mapped.length})
              </label>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Se agregarán a tu Watchlist como tickers de NYSE/NASDAQ
            </span>
          </div>

          {proxyData.mapped.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              No se encontraron acciones o CEDEARs con cotización internacional en la cartera seleccionada.
            </div>
          ) : (
            <div className="proxy-items-list">
              {proxyData.mapped.map(item => {
                const isSelected = selectedTickers.has(item.usTicker);
                return (
                  <div
                    key={item.usTicker}
                    className={`proxy-item-row ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleTicker(item.usTicker)}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleTicker(item.usTicker)}
                      onClick={e => e.stopPropagation()}
                    />
                    <div className="proxy-item-tickers">
                      <span className="proxy-ticker-us">{item.usTicker}</span>
                      <span className="proxy-ticker-arrow">←</span>
                      <span className="proxy-ticker-local">{item.rawTicker}</span>
                    </div>
                    <div className="proxy-item-badge-col">
                      <span className={`badge ${item.isAdr ? 'badge-adr' : 'badge-stock'}`}>
                        {item.isAdr ? 'ADR Argentina' : 'US Stock / ETF'}
                      </span>
                    </div>
                    <div className="proxy-item-name">{item.name}</div>
                    <div className="proxy-item-sector">{item.sector}</div>
                    <div className="proxy-item-weight">
                      <strong>{item.portfolioWeightPct.toFixed(1)}%</strong>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '3px' }}>cartera</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Unsupported & Ignored Notice */}
        {(proxyData.unsupported.length > 0 || proxyData.ignored.length > 0) && (
          <div className="proxy-excluded-summary">
            {proxyData.unsupported.length > 0 && (
              <div className="proxy-excluded-tag">
                ⚠️ Sin ADR: <strong>{proxyData.unsupported.map(u => u.rawTicker).join(', ')}</strong>
              </div>
            )}
            {proxyData.ignored.length > 0 && (
              <div className="proxy-excluded-tag">
                ⏭️ Bonos/Liquidez omitidos: <strong>{proxyData.ignored.slice(0, 5).map(u => u.rawTicker).join(', ')}{proxyData.ignored.length > 5 ? '...' : ''}</strong>
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="proxy-modal-footer">
          <div className="proxy-modal-mode-select">
            <label>
              <input
                type="radio"
                name="importMode"
                value="append"
                checked={importMode === 'append'}
                onChange={() => setImportMode('append')}
              />
              <span style={{ marginLeft: '4px' }}>Agregar a la Watchlist actual</span>
            </label>
            <label style={{ marginLeft: '12px' }}>
              <input
                type="radio"
                name="importMode"
                value="replace"
                checked={importMode === 'replace'}
                onChange={() => setImportMode('replace')}
              />
              <span style={{ marginLeft: '4px' }}>Reemplazar Watchlist</span>
            </label>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn" onClick={onClose}>Cancelar</button>
            <button
              className="btn btn-primary"
              onClick={handleConfirm}
              disabled={selectedTickers.size === 0}
            >
              🚀 Importar {selectedTickers.size} activos a Watchlist
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
