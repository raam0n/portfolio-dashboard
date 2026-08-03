import React, { useState, useMemo } from 'react';

export function HonorariosDashboard({
  portfolios = [],
  currentPortfolioId = 'Mi Portfolio Principal',
  allHoldings = {},
  allFlujos = {},
  allLiquidaciones = {},
  setAllLiquidaciones,
  setAllFlujos,
  prices = {},
  dailyStats = {},
  dolarMep = 1,
  fmt = (val) => val,
  fmtPct = (val) => val,
  getYahooTicker = () => null
}) {
  // Mode & Tabs inside Honorarios
  const [viewMode, setViewMode] = useState('single'); // 'single' | 'consolidated'
  const [selectedPortfolio, setSelectedPortfolio] = useState(currentPortfolioId);
  const [isPrivateMode, setIsPrivateMode] = useState(() => {
    return localStorage.getItem('advisor_private_mode') === 'true';
  });
  
  // Current year & semester selector
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1; // 1-12
  const defaultSemester = `${currentYear}-${currentMonth <= 6 ? 'H1' : 'H2'}`;
  const [selectedSemester, setSelectedSemester] = useState(defaultSemester);

  // Editable commission % (default 5%)
  const [customPct, setCustomPct] = useState('5');
  const [overrideValorInicial, setOverrideValorInicial] = useState({});

  // Helper to toggle private mode
  const togglePrivateMode = () => {
    const next = !isPrivateMode;
    setIsPrivateMode(next);
    localStorage.setItem('advisor_private_mode', next ? 'true' : 'false');
  };

  // Generate semesters list
  const semestersList = useMemo(() => {
    const list = [];
    for (let y = currentYear; y >= currentYear - 2; y--) {
      list.push(`${y}-H2`);
      list.push(`${y}-H1`);
    }
    return list;
  }, [currentYear]);

  // Semester date bounds
  const semesterDates = useMemo(() => {
    const [yearStr, semStr] = selectedSemester.split('-');
    const year = parseInt(yearStr, 10);
    if (semStr === 'H1') {
      return { start: `${year}-01-01`, end: `${year}-06-30`, name: `1º Semestre ${year} (Ene - Jun)` };
    } else {
      return { start: `${year}-07-01`, end: `${year}-12-31`, name: `2º Semestre ${year} (Jul - Dic)` };
    }
  }, [selectedSemester]);

  // Helper to compute Portfolio Valuation in ARS
  const computePortfolioValuationARS = (portId) => {
    const holdings = allHoldings[portId] || [];
    let totalARS = 0;

    holdings.forEach(h => {
      const yt = getYahooTicker(h) || h.ticker;
      const pc = h.tipo === 'efectivo' ? 1 : (prices[yt] ?? null);
      const qty = h.cantidad || 0;

      if (pc !== null) {
        const isUsdAsset = h.tipo === 'stock' || (h.tipo === 'efectivo' && h.ticker === 'USD');
        if (isUsdAsset) {
          totalARS += pc * qty * (dolarMep || 1);
        } else {
          totalARS += pc * qty;
        }
      } else {
        const isUsdAsset = h.tipo === 'stock' || (h.tipo === 'efectivo' && h.ticker === 'USD');
        if (isUsdAsset) {
          totalARS += (h.precioEntrada || 0) * qty * (dolarMep || 1);
        } else {
          totalARS += (h.precioEntrada || 0) * qty;
        }
      }
    });

    return totalARS;
  };

  // Helper to compute Cash Flows in ARS during the selected semester
  const computeSemesterFlujosARS = (portId) => {
    const flujos = allFlujos[portId] || [];
    let ingresosARS = 0;
    let extraccionesARS = 0;

    flujos.forEach(f => {
      if (f.fecha >= semesterDates.start && f.fecha <= semesterDates.end) {
        let montoARS = f.monto || 0;
        if (f.moneda === 'USD') {
          montoARS = montoARS * (f.cotizacion || dolarMep || 1);
        }
        if (f.tipo === 'ingreso') {
          ingresosARS += montoARS;
        } else {
          extraccionesARS += montoARS;
        }
      }
    });

    return { ingresosARS, extraccionesARS, netoARS: ingresosARS - extraccionesARS };
  };

  // Compute liquidation info for a portfolio and semester
  const getLiquidationDetails = (portId) => {
    const saved = allLiquidaciones?.[portId]?.[selectedSemester] || {};
    const valorActualARS = computePortfolioValuationARS(portId);
    const { ingresosARS, extraccionesARS, netoARS } = computeSemesterFlujosARS(portId);

    // Override or default initial value
    const manualValInicial = overrideValorInicial[portId];
    let valorInicialARS = saved.valorInicialARS;
    if (manualValInicial !== undefined && manualValInicial !== '') {
      valorInicialARS = parseFloat(manualValInicial);
    } else if (valorInicialARS === undefined || valorInicialARS === null) {
      // Default estimate: valorActualARS - netoARS
      valorInicialARS = Math.max(0, valorActualARS - netoARS);
    }

    const gananciaARS = valorActualARS - valorInicialARS - netoARS;
    const pct = parseFloat(saved.honorarioPct || customPct || 5);
    const honorarioARS = Math.max(0, gananciaARS * (pct / 100));
    const honorarioUSD = dolarMep > 0 ? honorarioARS / dolarMep : 0;

    const status = saved.status || 'Pendiente'; // 'Pendiente' | 'Cobrado' | 'Exento'

    return {
      valorInicialARS,
      valorActualARS,
      ingresosARS,
      extraccionesARS,
      netoARS,
      gananciaARS,
      honorarioPct: pct,
      honorarioARS,
      honorarioUSD,
      status,
      fechaCobro: saved.fechaCobro || null,
      mepCobro: saved.mepCobro || dolarMep
    };
  };

  // Handle saving / updating liquidation status
  const handleRegisterCobro = (portId) => {
    const details = getLiquidationDetails(portId);
    if (details.honorarioARS <= 0) {
      if (!window.confirm('El honorario calculado es $0 o negativo. ¿Deseas registrar el cobro de todas formas?')) {
        return;
      }
    }

    const todayStr = new Date().toISOString().split('T')[0];
    
    // 1. Add withdrawal flow to cash flow
    const newFlujo = {
      id: Date.now().toString(),
      fecha: todayStr,
      tipo: 'extraccion',
      moneda: 'ARS',
      monto: details.honorarioARS,
      cotizacion: dolarMep || 1,
      nota: `Cobro Honorarios Asesoría (${details.honorarioPct}% - ${selectedSemester})`
    };

    setAllFlujos(prev => ({
      ...prev,
      [portId]: [...(prev[portId] || []), newFlujo]
    }));

    // 2. Save liquidation status
    setAllLiquidaciones(prev => ({
      ...prev,
      [portId]: {
        ...(prev[portId] || {}),
        [selectedSemester]: {
          status: 'Cobrado',
          fechaCobro: todayStr,
          valorInicialARS: details.valorInicialARS,
          valorFinalARS: details.valorActualARS,
          gananciaARS: details.gananciaARS,
          honorarioPct: details.honorarioPct,
          honorarioARS: details.honorarioARS,
          honorarioUSD: details.honorarioUSD,
          mepCobro: dolarMep || 1
        }
      }
    }));
  };

  const handleSetStatus = (portId, newStatus) => {
    const details = getLiquidationDetails(portId);
    setAllLiquidaciones(prev => ({
      ...prev,
      [portId]: {
        ...(prev[portId] || {}),
        [selectedSemester]: {
          status: newStatus,
          valorInicialARS: details.valorInicialARS,
          valorFinalARS: details.valorActualARS,
          gananciaARS: details.gananciaARS,
          honorarioPct: details.honorarioPct,
          honorarioARS: details.honorarioARS,
          honorarioUSD: details.honorarioUSD,
          mepCobro: dolarMep || 1
        }
      }
    }));
  };

  // Helper to format values considering privacy mode
  const renderVal = (val, prefix = '$', isPct = false) => {
    if (isPrivateMode) return '••••••';
    if (val === null || val === undefined || isNaN(val)) return '—';
    if (isPct) return `${fmtPct(val)}`;
    return `${prefix}${fmt(val)}`;
  };

  // Consolidated calculations
  const consolidatedMetrics = useMemo(() => {
    let totalValorActual = 0;
    let totalGanancia = 0;
    let totalHonorariosARS = 0;
    let totalHonorariosUSD = 0;
    let totalHonorariosCobradosARS = 0;
    let totalHonorariosPendientesARS = 0;

    portfolios.forEach(p => {
      const details = getLiquidationDetails(p.id);
      totalValorActual += details.valorActualARS;
      totalGanancia += details.gananciaARS;
      totalHonorariosARS += details.honorarioARS;
      totalHonorariosUSD += details.honorarioUSD;

      if (details.status === 'Cobrado') {
        totalHonorariosCobradosARS += details.honorarioARS;
      } else if (details.status === 'Pendiente') {
        totalHonorariosPendientesARS += details.honorarioARS;
      }
    });

    return {
      totalValorActual,
      totalGanancia,
      totalHonorariosARS,
      totalHonorariosUSD,
      totalHonorariosCobradosARS,
      totalHonorariosPendientesARS
    };
  }, [portfolios, selectedSemester, allHoldings, allFlujos, allLiquidaciones, customPct, overrideValorInicial]);

  const activeDetails = getLiquidationDetails(selectedPortfolio);

  return (
    <div className="tab-pane active">
      {/* Header bar */}
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 className="section-title">Honorarios y Liquidación de Asesoría</h2>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Metodología de cobro semestral: <strong>5% sobre las ganancias en Pesos (ARS)</strong> obtenidas en el período.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Privacy toggle */}
          <button 
            className={`btn btn-sm ${isPrivateMode ? 'btn-danger' : 'btn-secondary'}`} 
            onClick={togglePrivateMode}
            title={isPrivateMode ? 'Modo Privado Activo (Montos Ocultos)' : 'Modo Privado Inactivo (Montos Visibles)'}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {isPrivateMode ? '🔒 Modo Privado: ACTIVO' : '👁️ Modo Asesor: VISIBLE'}
          </button>

          {/* Sub-view switcher */}
          <div style={{ display: 'flex', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '8px', overflow: 'hidden' }}>
            <button 
              className={`btn btn-sm ${viewMode === 'single' ? 'active' : ''}`}
              style={{ border: 'none', borderRadius: 0, background: viewMode === 'single' ? 'var(--accent)' : 'transparent', color: viewMode === 'single' ? '#fff' : 'var(--text-muted)' }}
              onClick={() => setViewMode('single')}
            >
              Cliente Individual
            </button>
            <button 
              className={`btn btn-sm ${viewMode === 'consolidated' ? 'active' : ''}`}
              style={{ border: 'none', borderRadius: 0, background: viewMode === 'consolidated' ? 'var(--accent)' : 'transparent', color: viewMode === 'consolidated' ? '#fff' : 'var(--text-muted)' }}
              onClick={() => setViewMode('consolidated')}
            >
              Visión Consolidada ({portfolios.length} Clientes)
            </button>
          </div>
        </div>
      </div>

      {/* Selectors: Semester & Portfolio */}
      <div className="glass-panel" style={{ padding: '16px', marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
        <div>
          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Período / Semestre</label>
          <select 
            value={selectedSemester} 
            onChange={e => setSelectedSemester(e.target.value)}
            style={{ padding: '8px 12px', background: 'rgba(0, 0, 0, 0.3)', border: '1px solid var(--glass-border)', color: 'var(--text-main)', borderRadius: '6px' }}
          >
            {semestersList.map(s => (
              <option key={s} value={s}>
                {s.includes('H1') ? `1º Semestre ${s.split('-')[0]} (Ene-Jun)` : `2º Semestre ${s.split('-')[0]} (Jul-Dic)`}
              </option>
            ))}
          </select>
        </div>

        {viewMode === 'single' && (
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Portfolio / Cliente</label>
            <select 
              value={selectedPortfolio} 
              onChange={e => setSelectedPortfolio(e.target.value)}
              style={{ padding: '8px 12px', background: 'rgba(0, 0, 0, 0.3)', border: '1px solid var(--glass-border)', color: 'var(--text-main)', borderRadius: '6px', minWidth: '200px' }}
            >
              {portfolios.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Comisión (%)</label>
          <input 
            type="number" 
            step="0.5" 
            value={customPct} 
            onChange={e => setCustomPct(e.target.value)}
            style={{ padding: '8px 12px', width: '90px', background: 'rgba(0, 0, 0, 0.3)', border: '1px solid var(--glass-border)', color: 'var(--text-main)', borderRadius: '6px' }}
          />
        </div>

        <div style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-muted)' }}>
          Referencia Dólar MEP: <strong style={{ color: 'var(--text-main)' }}>${fmt(dolarMep)}</strong>
        </div>
      </div>

      {/* SINGLE CLIENT VIEW */}
      {viewMode === 'single' && (
        <>
          {/* Status Badge & Banner */}
          <div className="glass-panel" style={{ padding: '16px', marginBottom: '20px', borderColor: activeDetails.status === 'Cobrado' ? 'var(--positive)' : activeDetails.status === 'Exento' ? 'var(--text-muted)' : 'var(--warning)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className={`badge ${activeDetails.status === 'Cobrado' ? 'badge-success' : activeDetails.status === 'Exento' ? 'badge-secondary' : 'badge-warning'}`} style={{ padding: '6px 12px', fontSize: '13px', borderRadius: '12px', textTransform: 'uppercase', fontWeight: 'bold' }}>
                  Estado: {activeDetails.status}
                </span>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  {semesterDates.name} · Portfolio: <strong>{selectedPortfolio}</strong>
                </span>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                {activeDetails.status !== 'Cobrado' ? (
                  <>
                    <button className="btn btn-primary" onClick={() => handleRegisterCobro(selectedPortfolio)}>
                      💰 Registrar Cobro de Honorarios
                    </button>
                    <button className="btn btn-secondary" onClick={() => handleSetStatus(selectedPortfolio, 'Exento')}>
                      🚫 Marcar Exento
                    </button>
                  </>
                ) : (
                  <button className="btn btn-secondary" onClick={() => handleSetStatus(selectedPortfolio, 'Pendiente')}>
                    🔄 Reabrir Liquidación
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginBottom: '20px' }}>
            <div className="metric-card">
              <div className="metric-title">Valuación Actual (ARS)</div>
              <div className="metric-value">{renderVal(activeDetails.valorActualARS)}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Total activos valuados a la cotización actual
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-title">Valor Inicial Estimado (ARS)</div>
              <div className="metric-value">{renderVal(activeDetails.valorInicialARS)}</div>
              <div style={{ marginTop: '6px' }}>
                <input 
                  type="number"
                  placeholder="Ajustar inicial..."
                  value={overrideValorInicial[selectedPortfolio] ?? ''}
                  onChange={e => setOverrideValorInicial({ ...overrideValorInicial, [selectedPortfolio]: e.target.value })}
                  style={{ width: '100%', fontSize: '11px', padding: '4px 8px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: '#fff', borderRadius: '4px' }}
                />
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-title">Flujos Netos Semestre (ARS)</div>
              <div className={`metric-value ${activeDetails.netoARS > 0 ? 'positive' : activeDetails.netoARS < 0 ? 'negative' : ''}`}>
                {renderVal(activeDetails.netoARS)}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Ingresos: {renderVal(activeDetails.ingresosARS)} | Retiros: {renderVal(activeDetails.extraccionesARS)}
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-title">Ganancia Obtenida (ARS)</div>
              <div className={`metric-value ${activeDetails.gananciaARS >= 0 ? 'positive' : 'negative'}`}>
                {renderVal(activeDetails.gananciaARS)}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Base imponible para honorarios
              </div>
            </div>

            <div className="metric-card" style={{ borderColor: 'var(--accent)' }}>
              <div className="metric-title">Honorario Resultante ({activeDetails.honorarioPct}%)</div>
              <div className="metric-value positive" style={{ fontSize: '22px' }}>
                {renderVal(activeDetails.honorarioARS)}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                ≈ {renderVal(activeDetails.honorarioUSD, 'US$ ')}
              </div>
            </div>
          </div>

          {/* Detailed Breakdown Card */}
          <div className="glass-panel" style={{ padding: '20px', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', marginBottom: '14px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '8px' }}>
              Fórmula y Transparencia de Liquidación
            </h3>
            <div style={{ fontFamily: 'monospace', fontSize: '13px', lineHeight: '1.8', color: 'var(--text-muted)' }}>
              <div><strong>Fórmula:</strong> Ganancia ARS = Valuación Final ARS - Valuación Inicial ARS - (Aportes ARS - Retiros ARS)</div>
              <div><strong>Ganancia Calculada:</strong> {renderVal(activeDetails.valorActualARS)} - {renderVal(activeDetails.valorInicialARS)} - {renderVal(activeDetails.netoARS)} = <span style={{ color: activeDetails.gananciaARS >= 0 ? 'var(--positive)' : 'var(--negative)' }}>{renderVal(activeDetails.gananciaARS)}</span></div>
              <div><strong>Cálculo Honorario:</strong> {renderVal(Math.max(0, activeDetails.gananciaARS))} × {activeDetails.honorarioPct}% = <strong style={{ color: 'var(--positive)' }}>{renderVal(activeDetails.honorarioARS)}</strong></div>
            </div>
          </div>
        </>
      )}

      {/* CONSOLIDATED MULTI-CLIENT VIEW */}
      {viewMode === 'consolidated' && (
        <>
          {/* Metrics summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginBottom: '20px' }}>
            <div className="metric-card">
              <div className="metric-title">Total AUM Clientes (ARS)</div>
              <div className="metric-value">{renderVal(consolidatedMetrics.totalValorActual)}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Suma de todos los portfolios
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-title">Ganancia Total Generada (ARS)</div>
              <div className={`metric-value ${consolidatedMetrics.totalGanancia >= 0 ? 'positive' : 'negative'}`}>
                {renderVal(consolidatedMetrics.totalGanancia)}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Rendimiento global del semestre
              </div>
            </div>

            <div className="metric-card" style={{ borderColor: 'var(--warning)' }}>
              <div className="metric-title">Honorarios Pendientes de Cobro</div>
              <div className="metric-value warning">
                {renderVal(consolidatedMetrics.totalHonorariosPendientesARS)}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Pendiente de liquidar
              </div>
            </div>

            <div className="metric-card" style={{ borderColor: 'var(--positive)' }}>
              <div className="metric-title">Honorarios Cobrados en Semestre</div>
              <div className="metric-value positive">
                {renderVal(consolidatedMetrics.totalHonorariosCobradosARS)}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Ingresos efectivamente liquidados
              </div>
            </div>

            <div className="metric-card" style={{ borderColor: 'var(--accent)' }}>
              <div className="metric-title">Potencial Total de Honorarios</div>
              <div className="metric-value" style={{ fontSize: '20px', color: 'var(--accent)' }}>
                {renderVal(consolidatedMetrics.totalHonorariosARS)}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                ≈ {renderVal(consolidatedMetrics.totalHonorariosUSD, 'US$ ')}
              </div>
            </div>
          </div>

          {/* Consolidated Table */}
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Cliente / Portfolio</th>
                  <th>Valuación ARS</th>
                  <th>Flujos Netos ARS</th>
                  <th>Ganancia Semestral ARS</th>
                  <th>Comisión (%)</th>
                  <th>Honorario ARS</th>
                  <th>Honorario USD</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {portfolios.map(p => {
                  const details = getLiquidationDetails(p.id);
                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: '600' }}>{p.name}</td>
                      <td>{renderVal(details.valorActualARS)}</td>
                      <td style={{ color: details.netoARS > 0 ? 'var(--positive)' : details.netoARS < 0 ? 'var(--negative)' : 'inherit' }}>
                        {renderVal(details.netoARS)}
                      </td>
                      <td style={{ color: details.gananciaARS >= 0 ? 'var(--positive)' : 'var(--negative)', fontWeight: 'bold' }}>
                        {renderVal(details.gananciaARS)}
                      </td>
                      <td>{details.honorarioPct}%</td>
                      <td style={{ fontWeight: 'bold', color: 'var(--positive)' }}>
                        {renderVal(details.honorarioARS)}
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>
                        {renderVal(details.honorarioUSD, 'US$ ')}
                      </td>
                      <td>
                        <span className={`badge ${details.status === 'Cobrado' ? 'badge-success' : details.status === 'Exento' ? 'badge-secondary' : 'badge-warning'}`}>
                          {details.status}
                        </span>
                      </td>
                      <td>
                        {details.status !== 'Cobrado' ? (
                          <button 
                            className="btn btn-sm btn-primary"
                            onClick={() => handleRegisterCobro(p.id)}
                            title="Registrar cobro de honorario"
                          >
                            💰 Cobrar
                          </button>
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--positive)' }}>✓ Cobrado</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
