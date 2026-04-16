import React, { useState, useEffect } from 'react';
import './index.css';

function App() {
  const [activeTab, setActiveTab] = useState('portfolio'); // 'portfolio', 'operaciones', 'watchlist', 'trades'
  
  const [holdings, setHoldings] = useState(() => JSON.parse(localStorage.getItem('portfolio_holdings') || '[]'));
  const [operaciones, setOperaciones] = useState(() => JSON.parse(localStorage.getItem('portfolio_operaciones') || '[]'));
  const [watchlist, setWatchlist] = useState(() => JSON.parse(localStorage.getItem('portfolio_watchlist') || '[]'));
  const [trades, setTrades] = useState(() => JSON.parse(localStorage.getItem('portfolio_trades') || '[]'));
  
  const [prices, setPrices] = useState(() => JSON.parse(localStorage.getItem('cached_prices') || '{}'));
  const [dailyStats, setDailyStats] = useState(() => JSON.parse(localStorage.getItem('cached_stats') || '{}'));
  const [dolarMep, setDolarMep] = useState(null);
  const [status, setStatus] = useState('loading'); // 'loading', 'ok', 'error'
  const [statusText, setStatusText] = useState('Cargando precios...');

  // UI State for collapsibles
  const [showAddHolding, setShowAddHolding] = useState(false);
  const [showAddOp, setShowAddOp] = useState(false);
  const [showAddWatchlist, setShowAddWatchlist] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddTrade, setShowAddTrade] = useState(false);

  // Trade form state
  const [tradeVentaId, setTradeVentaId] = useState('');
  const [tradeCompraId, setTradeCompraId] = useState('');

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
  const [wlFilter, setWlFilter] = useState('Todos');
  const [wlCatFilter, setWlCatFilter] = useState('Todas');

  const [importJson, setImportJson] = useState('');

  // Persist storage whenever collections change
  useEffect(() => {
    localStorage.setItem('portfolio_holdings', JSON.stringify(holdings));
    localStorage.setItem('portfolio_operaciones', JSON.stringify(operaciones));
    localStorage.setItem('portfolio_watchlist', JSON.stringify(watchlist));
    localStorage.setItem('portfolio_trades', JSON.stringify(trades));
  }, [holdings, operaciones, watchlist, trades]);

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
         while(pastPrice == null && offset < 5 && len - 1 - daysBack - offset >= 0) {
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
      
      return { price, change, changePct, hist5d, hist1m, hist6m, hist1y, hist5y };
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
    } catch(e) {
      console.warn('MEP fetch error', e);
    }

    setPrices(newPrices);
    setDailyStats(newStats);
    const ts = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    setStatus(hasError ? 'error' : 'ok');
    setStatusText(`Actualizado ${ts}`);
  };

  const fmt = (n, dec = 2) => {
    if (n == null || isNaN(n)) return '—';
    return new Intl.NumberFormat('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n);
  };

  const fmtPct = (n) => {
    if (n == null || isNaN(n)) return '—';
    const sign = n >= 0 ? '+' : '';
    return `${sign}${fmt(n, 2)}%`;
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
    const ticker = opTicker.trim().toUpperCase();
    const cant = parseFloat(opCantidad);
    const prec = parseFloat(opPrecio);

    if (!ticker || isNaN(cant) || isNaN(prec) || !opFecha) return alert('Datos incompletos.');

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
    const opVenta = operaciones.find(o => o.id === tradeVentaId);
    const opCompra = operaciones.find(o => o.id === tradeCompraId);
    if (!opVenta || !opCompra) return alert('Seleccioná una operación de venta y una de compra.');
    if (opVenta.id === opCompra.id) return alert('Seleccioná dos operaciones distintas.');

    const trade = {
      id: Date.now().toString(),
      ventaOpId: opVenta.id,
      ventaTicker: opVenta.ticker,
      ventaCantidad: opVenta.cantidad,
      ventaPrecio: opVenta.precio,
      ventaFecha: opVenta.fecha,
      compraTicker: opCompra.ticker,
      compraCantidad: opCompra.cantidad,
      compraPrecio: opCompra.precio,
      compraFecha: opCompra.fecha,
    };
    setTrades([...trades, trade]);
    setTradeVentaId('');
    setTradeCompraId('');
    setShowAddTrade(false);
  };

  const eliminarTrade = (id) => {
    if (!window.confirm('¿Eliminar este análisis de trade?')) return;
    setTrades(trades.filter(t => t.id !== id));
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
          <button className={`tab-btn ${activeTab === 'trades' ? 'active' : ''}`} onClick={() => setActiveTab('trades')}>Trades</button>
        </div>
        {dolarMep && (
          <div style={{ marginLeft: 'auto', alignSelf: 'center', fontSize: '12px', color: 'var(--text-muted)', fontWeight: '500' }}>
            Dólar MEP: <span style={{ color: 'var(--text-main)' }}>${fmt(dolarMep)}</span>
          </div>
        )}
      </nav>

      {/* Settings Panel (Global Drawer) */}
      {showSettings && (
        <div className="glass-panel collapsible-content active" style={{borderColor: 'rgba(94, 106, 210, 0.4)', marginBottom: '1.5rem'}}>
          <div className="panel-header">
            <div className="panel-title">Ajustes & Respaldo de Datos</div>
            <button className="btn btn-sm" onClick={() => setShowSettings(false)}>Cerrar</button>
          </div>
          <div className="dashboard-grid" style={{gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '1rem'}}>
            <div>
              <label>Exportar Datos (JSON)</label>
              <p className="hint" style={{marginBottom: '8px'}}>Guardá este JSON de forma segura como backup.</p>
              <textarea readOnly rows="4" style={{fontFamily: 'monospace', fontSize: '11px'}} value={JSON.stringify({ holdings, operaciones, watchlist }, null, 2)}></textarea>
              <div style={{marginTop: '8px', display: 'flex', gap: '8px'}}>
                <button className="btn" onClick={exportar}>Descargar Archivo</button>
                <button className="btn" onClick={copiarJSON}>Copiar</button>
              </div>
            </div>
            <div>
              <label>Importar Datos</label>
              <p className="hint" style={{marginBottom: '8px'}}>Atención: Pegá un JSON válido. Esto sobreescribirá todo.</p>
              <textarea rows="4" placeholder='{"holdings":[...],"operaciones":[...]}' style={{fontFamily: 'monospace', fontSize: '11px'}} value={importJson} onChange={e => setImportJson(e.target.value)}></textarea>
              <div style={{marginTop: '8px', display: 'flex', gap: '8px'}}>
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
                <div style={{fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px'}}>
                  ≈ US$ {fmt(totalValor / dolarMep)} <span style={{fontSize: '10px'}}>(MEP: ${fmt(dolarMep)})</span>
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
                        <tr key={h.ticker}>
                          <td>
                            <div className="ticker-name">{h.ticker}</div>
                            {h.nombre && <div style={{fontSize: '11px', color: 'var(--text-muted)'}}>{h.nombre}</div>}
                          </td>
                          <td><span className={`badge badge-${h.tipo}`}>{h.tipo}</span></td>
                          <td><span style={{fontSize: '11px', opacity: 0.8}}>{h.mercado || (h.tipo === 'stock' ? 'NYSE/NASDAQ' : (h.tipo === 'bono' ? 'OTC' : 'BCBA'))}</span></td>
                          <td>{fmt(h.cantidad, 0)}</td>
                          <td>${fmt(h.precioEntrada)}</td>
                          <td>
                            <strong>
                              {pc !== null ? `$${fmt(pc)}` : (
                                h.tipo === 'bono' ? (
                                  <button className="btn btn-sm" onClick={() => editBonoPrecio(h.ticker)}>Fijar P.</button>
                                ) : <span style={{fontStyle: 'italic', color: '#888'}}>cargando...</span>
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
                          <td><button className="btn btn-sm btn-danger" onClick={() => eliminarHolding(h.ticker)}>✕</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {showAddHolding && (
              <div className="collapsible-content active">
                <div className="panel-title" style={{marginBottom: '12px', fontSize: '14px'}}>Nuevo Holding</div>
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
                  <div style={{marginBottom: '12px'}}>
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
                <button className="btn" style={{marginLeft: '8px'}} onClick={() => setShowAddHolding(false)}>Cancelar</button>
              </div>
            )}
          </div>
        </>
      )}

      {/* --- TAB 2: OPERACIONES --- */}
      {activeTab === 'operaciones' && (
        <div className="glass-panel">
          <div className="panel-header">
            <div className="panel-title">Operaciones Históricas ({operaciones.length})</div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddOp(!showAddOp)}>+ Registrar</button>
          </div>

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
                  {[...operaciones].sort(sortUnified).map(op => {
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
                        <td style={{whiteSpace: 'nowrap', fontSize: '12px', color: 'var(--text-muted)'}}>{op.fecha}</td>
                        <td><strong>{op.ticker}</strong></td>
                        <td>
                          <span className={`badge badge-${op.tipo}`}>{op.tipo}</span><br/>
                          <span style={{fontSize: '12px', color: 'var(--text-muted)'}}>{fmt(op.cantidad, 0)} @ ${fmt(op.precio)}</span>
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

          {showAddOp && (
            <div className="collapsible-content active">
              <div className="panel-title" style={{marginBottom: '12px', fontSize: '14px'}}>Registrar Movimiento</div>
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
              <button className="btn" style={{marginLeft: '8px'}} onClick={() => setShowAddOp(false)}>Cancelar</button>
            </div>
          )}
        </div>
      )}

      {/* --- TAB 3: WATCHLIST --- */}
      {activeTab === 'watchlist' && (
        <div className="glass-panel">
          <div className="panel-header" style={{ alignItems: 'center' }}>
            <div className="panel-title">Lista de Seguimiento ({watchlist.length})</div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Filtros:</span>
              {/* Type Filter */}
              <select 
                value={wlFilter} 
                onChange={e => setWlFilter(e.target.value)}
                style={{ height: '32px', fontSize: '12px', background: 'rgba(255,255,255,0.05)', color: 'white', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', padding: '0 8px', outline: 'none' }}
              >
                <option value="Todos" style={{background: '#1a1d24', color: 'white'}}>Todos los tipos</option>
                <option value="accion" style={{background: '#1a1d24', color: 'white'}}>Acciones</option>
                <option value="cedear" style={{background: '#1a1d24', color: 'white'}}>CEDEARs</option>
                <option value="stock" style={{background: '#1a1d24', color: 'white'}}>Stocks US</option>
              </select>

              {/* Category Filter */}
              <select 
                value={wlCatFilter} 
                onChange={e => setWlCatFilter(e.target.value)}
                style={{ height: '32px', fontSize: '12px', background: 'rgba(255,255,255,0.05)', color: 'white', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', padding: '0 8px', outline: 'none' }}
              >
                <option value="Todas" style={{background: '#1a1d24', color: 'white'}}>Todas las categorías</option>
                {[...new Set(watchlist.map(w => w.categoria).filter(Boolean))].sort().map(cat => (
                  <option key={cat} value={cat} style={{background: '#1a1d24', color: 'white'}}>{cat}</option>
                ))}
              </select>

              <button className="btn btn-primary btn-sm" onClick={() => setShowAddWatchlist(!showAddWatchlist)}>+ Suscribir</button>
            </div>
          </div>

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
                  {[...watchlist]
                    .filter(w => wlFilter === 'Todos' || w.tipo === wlFilter)
                    .filter(w => wlCatFilter === 'Todas' || w.categoria === wlCatFilter)
                    .sort(sortUnified).map(w => {
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
                       if (val == null) return <span style={{color: '#666'}}>—</span>;
                       let css = val >= 0 ? 'positive' : 'negative';
                       return <span className={css}><strong>{fmtPct(val)}</strong></span>;
                    };

                    return (
                      <tr key={w.ticker}>
                        <td>
                          <div className="ticker-name">{w.ticker}</div>
                          {w.nombre && <div style={{fontSize: '11px', color: 'var(--text-muted)'}}>{w.nombre}</div>}
                        </td>
                        <td><span className={`badge badge-${w.tipo}`}>{w.tipo}</span></td>
                        <td><span style={{fontSize: '11px', opacity: 0.8}}>{w.mercado || (w.tipo === 'stock' ? 'NYSE/NASDAQ' : 'BCBA')}</span></td>
                        <td><span style={{ fontSize: '11px', opacity: 0.8 }}>{w.categoria || '—'}</span></td>
                        <td>
                          <strong>{pc !== null ? `$${fmt(pc)}` : <span style={{fontStyle: 'italic', color: '#888'}}>cargando...</span>}</strong>
                        </td>
                        <td className={todayCss}><strong>{todayText}</strong></td>
                        <td>{stats ? fmtHist(stats.hist5d) : '—'}</td>
                        <td>{stats ? fmtHist(stats.hist1m) : '—'}</td>
                        <td>{stats ? fmtHist(stats.hist6m) : '—'}</td>
                        <td>{stats ? fmtHist(stats.hist1y) : '—'}</td>
                        <td>{stats ? fmtHist(stats.hist5y) : '—'}</td>
                        <td><button className="btn btn-sm btn-danger" onClick={() => eliminarWatchlist(w.ticker)}>✕</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {showAddWatchlist && (
            <div className="collapsible-content active">
              <div className="panel-title" style={{marginBottom: '12px', fontSize: '14px'}}>Sincronizar Activo</div>
              <div className="form-row trio">
                <div>
                  <label>Tipo Activo</label>
                  <select value={wlTipo} onChange={(e) => {
                    const t = e.target.value;
                    setWlTipo(t);
                    if (t === 'accion' || t === 'cedear') setWlMercado('BCBA');
                    else if (t === 'stock') setWlMercado('NYSE/NASDAQ');
                  }}>
                    <option value="accion">Acción AR</option>
                    <option value="cedear">CEDEAR</option>
                    <option value="stock">Stock US</option>
                  </select>
                </div>
                <div>
                  <label>Mercado</label>
                  <select value={wlMercado} onChange={e => setWlMercado(e.target.value)}>
                    <option value="BCBA">BCBA</option>
                    <option value="NYSE/NASDAQ">NYSE/NASDAQ</option>
                    <option value="NASDAQ">NASDAQ</option>
                    <option value="NYSE">NYSE</option>
                    <option value="BYMA">BYMA</option>
                  </select>
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
              <button className="btn" style={{marginLeft: '8px'}} onClick={() => setShowAddWatchlist(false)}>Cancelar</button>
            </div>
          )}
        </div>
      )}

      {/* --- TAB 4: TRADES --- */}
      {activeTab === 'trades' && (
        <div className="glass-panel">
          <div className="panel-header">
            <div className="panel-title">Análisis de Trades y Rotaciones ({trades.length})</div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddTrade(!showAddTrade)}>+ Agregar Trade</button>
          </div>

          {/* Add Trade Form */}
          {showAddTrade && (
            <div className="collapsible-content active">
              <div className="panel-title" style={{marginBottom: '12px', fontSize: '14px'}}>Nueva Rotación</div>
              {operaciones.length < 2 ? (
                <div className="empty-state" style={{padding: '1rem'}}>
                  Necesitás al menos dos operaciones registradas en el Histórico para crear un análisis.
                </div>
              ) : (
                <>
                  <div className="form-row">
                    <div>
                      <label>Operación Vendida (¿Qué vendiste?)</label>
                      <select value={tradeVentaId} onChange={e => setTradeVentaId(e.target.value)}>
                        <option value="">— Seleccioná una venta —</option>
                        {operaciones.filter(o => o.tipo === 'venta').map(o => (
                          <option key={o.id} value={o.id}>
                            {o.fecha} · {o.ticker} · Venta {fmt(o.cantidad, 0)} @ ${fmt(o.precio)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label>Operación Comprada (¿Qué compraste?)</label>
                      <select value={tradeCompraId} onChange={e => setTradeCompraId(e.target.value)}>
                        <option value="">— Seleccioná una compra —</option>
                        {operaciones.filter(o => o.tipo === 'compra').map(o => (
                          <option key={o.id} value={o.id}>
                            {o.fecha} · {o.ticker} · Compra {fmt(o.cantidad, 0)} @ ${fmt(o.precio)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button className="btn btn-primary" onClick={agregarTrade}>Guardar Rotación</button>
                  <button className="btn" style={{marginLeft: '8px'}} onClick={() => setShowAddTrade(false)}>Cancelar</button>
                </>
              )}
            </div>
          )}

          {/* Trade Cards */}
          {trades.length === 0 && !showAddTrade ? (
            <div className="empty-state">
              Sin análisis de trades todavía. Agregá uno para comenzar.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
              {trades.map(trade => {
                const ventaBase = trade.ventaTicker.replace(/\.BA$/i, '');
                const compraBase = trade.compraTicker.replace(/\.BA$/i, '');
                const pVenta = prices[trade.ventaTicker] ?? prices[ventaBase] ?? null;
                const pCompra = prices[trade.compraTicker] ?? prices[compraBase] ?? null;

                // Opportunity cost: what you gave up by selling
                const ventaDiff = pVenta !== null ? (pVenta - trade.ventaPrecio) * trade.ventaCantidad : null;
                // Actual gain/loss: what you got by buying
                const compraDiff = pCompra !== null ? (pCompra - trade.compraPrecio) * trade.compraCantidad : null;
                // Net: did the switch beat doing nothing?
                const netOutcome = (ventaDiff !== null && compraDiff !== null) ? compraDiff - ventaDiff : null;

                return (
                  <div key={trade.id} className="glass-panel" style={{ background: 'rgba(0,0,0,0.2)', position: 'relative' }}>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem' }}>
                      <div>
                        <h3 style={{ fontSize: '15px', marginBottom: '4px' }}>
                          Rotación: <span style={{color: 'var(--negative)'}}>{trade.ventaTicker}</span> → <span style={{color: 'var(--positive)'}}>{trade.compraTicker}</span>
                        </h3>
                        <p className="hint">
                          Venta {trade.ventaTicker} {fmt(trade.ventaCantidad, 0)} @ ${fmt(trade.ventaPrecio)} ({trade.ventaFecha}) &nbsp;|&nbsp; Compra {trade.compraTicker} {fmt(trade.compraCantidad, 0)} @ ${fmt(trade.compraPrecio)} ({trade.compraFecha})
                        </p>
                      </div>
                      <button className="btn btn-sm btn-danger" onClick={() => eliminarTrade(trade.id)} style={{flexShrink: 0, marginLeft: '12px'}}>✕</button>
                    </div>

                    {/* Scenario output */}
                    {(pVenta === null || pCompra === null) ? (
                      <div className="empty-state" style={{padding: '1rem'}}>Cargando cotizaciones...</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '14px' }}>
                        {/* Line 1: Opportunity cost */}
                        <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                          Si hubieras conservado <strong>{trade.ventaTicker}</strong>, ahora tendrías {ventaDiff >= 0 ? 'una ganancia' : 'una pérdida'} de:{' '}
                          <strong className={ventaDiff >= 0 ? 'positive' : 'negative'}>
                            {ventaDiff >= 0 ? '+' : '-'}${fmt(Math.abs(ventaDiff))}
                            {dolarMep && (
                              <span style={{ fontSize: '13px', fontWeight: '400', opacity: 0.8, marginLeft: '8px' }}>
                                ≈ US$ {fmt(Math.abs(ventaDiff) / dolarMep)}
                              </span>
                            )}
                          </strong>
                          <div className="hint" style={{marginTop: '4px'}}>
                            (Precio de venta: ${fmt(trade.ventaPrecio)} vs Valor actual: ${fmt(pVenta)})
                          </div>
                        </div>

                        {/* Line 2: Actual trade result */}
                        <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                          Al haber comprado <strong>{trade.compraTicker}</strong>, obtuviste {compraDiff >= 0 ? 'una ganancia' : 'una pérdida'} de:{' '}
                          <strong className={compraDiff >= 0 ? 'positive' : 'negative'}>
                            {compraDiff >= 0 ? '+' : '-'}${fmt(Math.abs(compraDiff))}
                            {dolarMep && (
                              <span style={{ fontSize: '13px', fontWeight: '400', opacity: 0.8, marginLeft: '8px' }}>
                                ≈ US$ {fmt(Math.abs(compraDiff) / dolarMep)}
                              </span>
                            )}
                          </strong>
                          <div className="hint" style={{marginTop: '4px'}}>
                            (Precio de compra: ${fmt(trade.compraPrecio)} vs Valor actual: ${fmt(pCompra)})
                          </div>
                        </div>

                        {/* Line 3: Net impact */}
                        <div style={{ padding: '16px', background: 'rgba(94, 106, 210, 0.1)', border: '1px solid rgba(94, 106, 210, 0.3)', borderRadius: '8px' }}>
                          En resumen, el impacto de la Rotación es:{' '}
                          <strong className={netOutcome >= 0 ? 'positive' : 'negative'} style={{fontSize: '18px'}}>
                            {netOutcome >= 0 ? '+' : '-'}${fmt(Math.abs(netOutcome))}
                            {dolarMep && (
                              <span style={{ fontSize: '14px', fontWeight: '400', opacity: 0.8, marginLeft: '10px' }}>
                                ≈ US$ {fmt(Math.abs(netOutcome) / dolarMep)}
                              </span>
                            )}
                          </strong>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
}

export default App;
