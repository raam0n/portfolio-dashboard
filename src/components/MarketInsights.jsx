import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default function MarketInsights() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Búsqueda específica de Ticker (Sección Histórico por Ticker)
  const [tickerSearchInput, setTickerSearchInput] = useState('');
  const [activeTickerSearch, setActiveTickerSearch] = useState('');

  // Estado para controlar qué días y qué videos están colapsados/expandidos
  const [expandedDays, setExpandedDays] = useState({});
  const [expandedVideos, setExpandedVideos] = useState({});
  
  // Filtro activo para Ticker desde las tarjetas del día
  const [selectedTickerFilter, setSelectedTickerFilter] = useState(null);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('youtube_video_logs')
          .select('*')
          .order('published_at', { ascending: false })
          .limit(100);

        if (error) {
          throw new Error('Error al obtener los insights: ' + error.message);
        }
        setLogs(data || []);

        // Expandir por defecto el primer día publicado
        if (data && data.length > 0) {
          const firstDateStr = getFormattedDateKey(data[0].published_at);
          setExpandedDays({ [firstDateStr]: true });
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, []);

  const getFormattedDateKey = (dateString) => {
    if (!dateString) return 'Fecha Desconocida';
    const d = new Date(dateString);
    return d.toISOString().split('T')[0]; // YYYY-MM-DD
  };

  const formatDateTitle = (dateKey) => {
    if (!dateKey || dateKey === 'Fecha Desconocida') return 'Sin Fecha';
    const [year, month, day] = dateKey.split('-');
    const dateObj = new Date(year, month - 1, day);
    return dateObj.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  const formatVideoTime = (dateString) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  };

  // Filtrado de Logs según búsqueda general y ticker seleccionado
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const query = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || (
        (log.tickers_mentioned && log.tickers_mentioned.toLowerCase().includes(query)) ||
        (log.sector && log.sector.toLowerCase().includes(query)) ||
        (log.channel_name && log.channel_name.toLowerCase().includes(query)) ||
        (log.video_title && log.video_title.toLowerCase().includes(query))
      );

      const matchesTickerFilter = !selectedTickerFilter || (
        log.ticker_insights && log.ticker_insights.some(i => i.ticker?.toUpperCase() === selectedTickerFilter.toUpperCase())
      );

      return matchesSearch && matchesTickerFilter;
    });
  }, [logs, searchQuery, selectedTickerFilter]);

  // Agrupar Logs por Día
  const groupedByDay = useMemo(() => {
    const groups = {};
    filteredLogs.forEach(log => {
      const dayKey = getFormattedDateKey(log.published_at);
      if (!groups[dayKey]) {
        groups[dayKey] = [];
      }
      groups[dayKey].push(log);
    });
    return groups;
  }, [filteredLogs]);

  // Helper para calcular la matriz/resumen de tickers DE UN DÍA ESPECÍFICO
  const getDayTickerSummary = (dayLogs) => {
    const matrix = {};

    dayLogs.forEach(log => {
      if (log.ticker_insights && Array.isArray(log.ticker_insights)) {
        log.ticker_insights.forEach(insight => {
          const rawTicker = insight.ticker ? insight.ticker.trim().toUpperCase() : null;
          if (!rawTicker || rawTicker === 'N/A') return;

          if (!matrix[rawTicker]) {
            matrix[rawTicker] = {
              ticker: rawTicker,
              totalMentions: 0,
              actionsCount: { comprar: 0, vender: 0, mantener: 0, observar: 0 },
              channelOpinions: []
            };
          }

          matrix[rawTicker].totalMentions += 1;
          
          const act = insight.action ? insight.action.toLowerCase() : '';
          if (act.includes('comprar')) matrix[rawTicker].actionsCount.comprar += 1;
          else if (act.includes('vender')) matrix[rawTicker].actionsCount.vender += 1;
          else if (act.includes('observar')) matrix[rawTicker].actionsCount.observar += 1;
          else matrix[rawTicker].actionsCount.mantener += 1;

          matrix[rawTicker].channelOpinions.push({
            channel: log.channel_name,
            action: insight.action || 'Mantener',
            targetPrice: insight.target_price || 'N/A',
            videoId: log.video_id
          });
        });
      }
    });

    return Object.values(matrix).sort((a, b) => {
      if (b.totalMentions !== a.totalMentions) {
        return b.totalMentions - a.totalMentions; // 1. Menciones descendente
      }
      return a.ticker.localeCompare(b.ticker); // 2. Alfabético ascendente
    });
  };

  // CÁLCULO HISTÓRICO PARA LA BÚSQUEDA ESPECÍFICA POR TICKER (SECCIÓN SUPERIOR)
  const tickerHistoryData = useMemo(() => {
    if (!activeTickerSearch) return null;
    const targetTicker = activeTickerSearch.trim().toUpperCase();

    // Agrupar por días en que apareció este ticker
    const dayMap = {}; // { dayKey: { dayKey, totalMentions, actionsCount, channelOpinions: [] } }

    logs.forEach(log => {
      const dayKey = getFormattedDateKey(log.published_at);
      if (log.ticker_insights && Array.isArray(log.ticker_insights)) {
        log.ticker_insights.forEach(insight => {
          const tName = insight.ticker ? insight.ticker.trim().toUpperCase() : '';
          if (tName === targetTicker) {
            if (!dayMap[dayKey]) {
              dayMap[dayKey] = {
                dayKey: dayKey,
                totalMentions: 0,
                actionsCount: { comprar: 0, vender: 0, mantener: 0, observar: 0 },
                channelOpinions: []
              };
            }

            dayMap[dayKey].totalMentions += 1;

            const act = insight.action ? insight.action.toLowerCase() : '';
            if (act.includes('comprar')) dayMap[dayKey].actionsCount.comprar += 1;
            else if (act.includes('vender')) dayMap[dayKey].actionsCount.vender += 1;
            else if (act.includes('observar')) dayMap[dayKey].actionsCount.observar += 1;
            else dayMap[dayKey].actionsCount.mantener += 1;

            dayMap[dayKey].channelOpinions.push({
              channel: log.channel_name,
              action: insight.action || 'Mantener',
              targetPrice: insight.target_price || 'N/A',
              summary: insight.insight_summary || '',
              videoTitle: log.video_title
            });
          }
        });
      }
    });

    const daysList = Object.values(dayMap).sort((a, b) => b.dayKey.localeCompare(a.dayKey));
    return {
      ticker: targetTicker,
      totalAppearances: daysList.reduce((acc, d) => acc + d.totalMentions, 0),
      days: daysList
    };
  }, [logs, activeTickerSearch]);

  // Handlers para expandir/colapsar
  const toggleDay = (dayKey) => {
    setExpandedDays(prev => ({ ...prev, [dayKey]: !prev[dayKey] }));
  };

  const toggleVideo = (videoId) => {
    setExpandedVideos(prev => ({ ...prev, [videoId]: !prev[videoId] }));
  };

  const expandAll = () => {
    const allDays = {};
    const allVids = {};
    Object.keys(groupedByDay).forEach(d => {
      allDays[d] = true;
      groupedByDay[d].forEach(v => {
        allVids[v.video_id] = true;
      });
    });
    setExpandedDays(allDays);
    setExpandedVideos(allVids);
  };

  const collapseAll = () => {
    setExpandedDays({});
    setExpandedVideos({});
  };

  const handleTickerSearchSubmit = (e) => {
    e.preventDefault();
    if (tickerSearchInput.trim()) {
      setActiveTickerSearch(tickerSearchInput.trim().toUpperCase());
    }
  };

  const getActionBadgeStyle = (action = '') => {
    const act = action.toLowerCase();
    if (act.includes('comprar')) {
      return { bg: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', border: 'rgba(34, 197, 94, 0.3)', label: '🟢 ' + action };
    }
    if (act.includes('vender')) {
      return { bg: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: 'rgba(239, 68, 68, 0.3)', label: '🔴 ' + action };
    }
    if (act.includes('observar')) {
      return { bg: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: 'rgba(245, 158, 11, 0.3)', label: '👁️ ' + action };
    }
    return { bg: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc', border: 'rgba(99, 102, 241, 0.3)', label: '🔵 ' + action };
  };

  return (
    <div className="glass-panel" style={{ padding: '24px' }}>
      {/* Header y Controles */}
      <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '15px' }}>
        <div>
          <div className="panel-title" style={{ fontSize: '20px', fontWeight: '600' }}>Market Insights (YouTube AI)</div>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '4px 0 0 0' }}>
            Consenso diario de activos y seguimiento histórico cualitativo por canal.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {selectedTickerFilter && (
            <button 
              onClick={() => setSelectedTickerFilter(null)}
              className="badge"
              style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#a5b4fc', border: '1px solid #6366f1', cursor: 'pointer', fontSize: '12px', padding: '6px 10px' }}
            >
              ✖ Filtro: {selectedTickerFilter}
            </button>
          )}

          <input 
            type="text" 
            placeholder="🔍 Buscar en el feed..." 
            className="input-field" 
            style={{ width: '200px', fontSize: '13px', padding: '7px 12px' }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <button 
            onClick={expandAll}
            className="btn" 
            style={{ fontSize: '12px', padding: '6px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)' }}
          >
            📂 Expandir Todo
          </button>
          <button 
            onClick={collapseAll}
            className="btn" 
            style={{ fontSize: '12px', padding: '6px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)' }}
          >
            📁 Colapsar Todo
          </button>
        </div>
      </div>

      {loading && <div className="empty-state" style={{ padding: '40px' }}>Cargando análisis de canales...</div>}
      {error && <div className="empty-state" style={{ color: 'var(--negative)', padding: '40px' }}>{error}</div>}

      {!loading && !error && (
        <>
          {/* SECCIÓN NUEVA SUPERIOR: BÚSQUEDA HISTÓRICA POR TICKER */}
          <div style={{ 
            marginBottom: '25px', 
            padding: '16px', 
            background: 'rgba(15, 17, 26, 0.6)', 
            borderRadius: '12px', 
            border: '1px solid var(--glass-border)' 
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: '600', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🎯 Histórico por Ticker</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Busca una acción o cripto para ver todos los días en que fue analizada y qué dijeron los canales.
                </div>
              </div>

              <form onSubmit={handleTickerSearchSubmit} style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="text" 
                  placeholder="Ej: AAPL, NVDA, TSLA..." 
                  className="input-field" 
                  style={{ width: '180px', fontSize: '13px', padding: '6px 12px', textTransform: 'uppercase' }}
                  value={tickerSearchInput}
                  onChange={(e) => setTickerSearchInput(e.target.value)}
                />
                <button 
                  type="submit" 
                  className="btn" 
                  style={{ fontSize: '13px', padding: '6px 14px', background: '#5e6ad2', color: '#fff', fontWeight: '600' }}
                >
                  Buscar
                </button>

                {activeTickerSearch && (
                  <button 
                    type="button"
                    onClick={() => { setActiveTickerSearch(''); setTickerSearchInput(''); }}
                    className="btn"
                    style={{ fontSize: '12px', padding: '6px 10px', background: 'rgba(255,255,255,0.08)', color: '#d1d5db' }}
                  >
                    Limpiar
                  </button>
                )}
              </form>
            </div>

            {/* RESULTADOS DE LA BÚSQUEDA HISTÓRICA POR TICKER */}
            {activeTickerSearch && tickerHistoryData && (
              <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>
                    Resultados para <span style={{ color: '#818cf8', fontWeight: '700' }}>{tickerHistoryData.ticker}</span>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '10px' }}>
                    {tickerHistoryData.totalAppearances} {tickerHistoryData.totalAppearances === 1 ? 'mención en total' : 'menciones en total'} en {tickerHistoryData.days.length} {tickerHistoryData.days.length === 1 ? 'día' : 'días'}
                  </span>
                </div>

                {tickerHistoryData.days.length === 0 ? (
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '10px 0' }}>
                    No se encontraron menciones registradas para el ticker <strong>{tickerHistoryData.ticker}</strong>.
                  </div>
                ) : (
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', 
                    gap: '12px' 
                  }}>
                    {tickerHistoryData.days.map(d => (
                      <div 
                        key={d.dayKey}
                        style={{
                          padding: '12px',
                          borderRadius: '8px',
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid rgba(255, 255, 255, 0.06)',
                        }}
                      >
                        {/* Cabecera idéntica a la tarjeta de ticker: Muestra el Día */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontWeight: '700', fontSize: '13.5px', color: '#fff', textTransform: 'capitalize' }}>
                            📅 {formatDateTitle(d.dayKey)}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: '4px' }}>
                            {d.totalMentions} {d.totalMentions === 1 ? 'mención' : 'menciones'}
                          </span>
                        </div>

                        {/* Conteo de Opiniones del día */}
                        <div style={{ display: 'flex', gap: '4px', fontSize: '11px', marginBottom: '8px', flexWrap: 'wrap' }}>
                          {d.actionsCount.comprar > 0 && (
                            <span style={{ color: '#4ade80', background: 'rgba(34, 197, 94, 0.15)', padding: '1px 5px', borderRadius: '4px', fontWeight: '600' }}>
                              Comprar: {d.actionsCount.comprar}
                            </span>
                          )}
                          {d.actionsCount.vender > 0 && (
                            <span style={{ color: '#f87171', background: 'rgba(239, 68, 68, 0.15)', padding: '1px 5px', borderRadius: '4px', fontWeight: '600' }}>
                              Vender: {d.actionsCount.vender}
                            </span>
                          )}
                          {d.actionsCount.observar > 0 && (
                            <span style={{ color: '#fbbf24', background: 'rgba(245, 158, 11, 0.15)', padding: '1px 5px', borderRadius: '4px', fontWeight: '600' }}>
                              Observar: {d.actionsCount.observar}
                            </span>
                          )}
                          {d.actionsCount.mantener > 0 && (
                            <span style={{ color: '#a5b4fc', background: 'rgba(99, 102, 241, 0.15)', padding: '1px 5px', borderRadius: '4px', fontWeight: '600' }}>
                              Mantener: {d.actionsCount.mantener}
                            </span>
                          )}
                        </div>

                        {/* Qué dijo cada canal específicamente este día para este Ticker (Diseño idéntico) */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed rgba(255,255,255,0.08)' }}>
                          {d.channelOpinions.map((op, idx) => {
                            const badge = getActionBadgeStyle(op.action);
                            return (
                              <div 
                                key={idx}
                                style={{ 
                                  fontSize: '11.5px', 
                                  display: 'flex', 
                                  flexDirection: 'column',
                                  gap: '4px',
                                  background: 'rgba(0,0,0,0.2)',
                                  padding: '6px 8px',
                                  borderRadius: '5px',
                                  border: '1px solid rgba(255,255,255,0.04)'
                                }}
                              >
                                <div style={{ fontWeight: '600', color: '#e5e7eb', fontSize: '11px' }}>
                                  📺 {op.channel}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                                  <span style={{ 
                                    color: badge.color, 
                                    fontWeight: '600',
                                    background: badge.bg,
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    border: `1px solid ${badge.border}`,
                                    fontSize: '10.5px',
                                    lineHeight: '1.4',
                                    wordBreak: 'break-word',
                                    whiteSpace: 'normal',
                                    maxWidth: '100%'
                                  }}>
                                    {badge.label}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SECCIÓN PRINCIPAL: VISTA AGRUPADA POR DÍA Y REVIEWS COLAPSABLES */}
          {Object.keys(groupedByDay).length === 0 ? (
            <div className="empty-state">No se encontraron reviews que coincidan con la búsqueda.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {Object.keys(groupedByDay).sort().reverse().map(dayKey => {
                const dayLogs = groupedByDay[dayKey];
                const isDayExpanded = !!expandedDays[dayKey];
                const dayTickerSummary = getDayTickerSummary(dayLogs);

                return (
                  <div 
                    key={dayKey}
                    style={{ 
                      borderRadius: '10px', 
                      background: 'rgba(255, 255, 255, 0.02)', 
                      border: '1px solid var(--glass-border)',
                      overflow: 'hidden'
                    }}
                  >
                    {/* ACORDEÓN PRINCIPAL: CABECERA DEL DÍA */}
                    <div 
                      onClick={() => toggleDay(dayKey)}
                      style={{ 
                        padding: '14px 18px', 
                        background: 'rgba(255, 255, 255, 0.04)', 
                        cursor: 'pointer',
                        display: 'flex',
                        justify: 'space-between',
                        alignItems: 'center',
                        userSelect: 'none',
                        borderBottom: isDayExpanded ? '1px solid var(--glass-border)' : 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '16px', transition: 'transform 0.2s ease', transform: isDayExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                          ▶
                        </span>
                        <span style={{ fontSize: '15px', fontWeight: '600', color: '#fff', textTransform: 'capitalize' }}>
                          📅 {formatDateTitle(dayKey)}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span className="badge" style={{ background: 'rgba(255,255,255,0.08)', color: '#d1d5db', fontSize: '12px' }}>
                          {dayTickerSummary.length} {dayTickerSummary.length === 1 ? 'ticker analizado' : 'tickers analizados'}
                        </span>
                        <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc', fontSize: '12px' }}>
                          {dayLogs.length} {dayLogs.length === 1 ? 'video' : 'videos'}
                        </span>
                      </div>
                    </div>

                    {/* CONTENIDO DEL DÍA */}
                    {isDayExpanded && (
                      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        
                        {/* 1. SUB-SECCIÓN: RESUMEN DE TICKERS Y CONCENSO DEL DÍA */}
                        {dayTickerSummary.length > 0 && (
                          <div style={{ 
                            padding: '14px', 
                            background: 'rgba(15, 17, 26, 0.5)', 
                            borderRadius: '8px', 
                            border: '1px solid rgba(255,255,255,0.05)' 
                          }}>
                            <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>⚡ Golpes de vista del Día ({formatDateTitle(dayKey)}):</span>
                            </div>

                            <div style={{ 
                              display: 'grid', 
                              gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', 
                              gap: '10px' 
                            }}>
                              {dayTickerSummary.map(t => (
                                <div 
                                  key={t.ticker}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedTickerFilter(selectedTickerFilter === t.ticker ? null : t.ticker);
                                  }}
                                  style={{
                                    padding: '10px 12px',
                                    borderRadius: '6px',
                                    background: selectedTickerFilter === t.ticker ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                                    border: selectedTickerFilter === t.ticker ? '1px solid #6366f1' : '1px solid rgba(255, 255, 255, 0.06)',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                    <span style={{ fontWeight: '700', fontSize: '14px', color: '#fff' }}>{t.ticker}</span>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                      {t.totalMentions} {t.totalMentions === 1 ? 'mención' : 'menciones'}
                                    </span>
                                  </div>

                                  {/* Conteo de Opiniones del día */}
                                  <div style={{ display: 'flex', gap: '4px', fontSize: '11px', marginBottom: '6px', flexWrap: 'wrap' }}>
                                    {t.actionsCount.comprar > 0 && (
                                      <span style={{ color: '#4ade80', background: 'rgba(34, 197, 94, 0.15)', padding: '1px 5px', borderRadius: '4px', fontWeight: '600' }}>
                                        Comprar: {t.actionsCount.comprar}
                                      </span>
                                    )}
                                    {t.actionsCount.vender > 0 && (
                                      <span style={{ color: '#f87171', background: 'rgba(239, 68, 68, 0.15)', padding: '1px 5px', borderRadius: '4px', fontWeight: '600' }}>
                                        Vender: {t.actionsCount.vender}
                                      </span>
                                    )}
                                    {t.actionsCount.observar > 0 && (
                                      <span style={{ color: '#fbbf24', background: 'rgba(245, 158, 11, 0.15)', padding: '1px 5px', borderRadius: '4px', fontWeight: '600' }}>
                                        Observar: {t.actionsCount.observar}
                                      </span>
                                    )}
                                    {t.actionsCount.mantener > 0 && (
                                      <span style={{ color: '#a5b4fc', background: 'rgba(99, 102, 241, 0.15)', padding: '1px 5px', borderRadius: '4px', fontWeight: '600' }}>
                                        Mantener: {t.actionsCount.mantener}
                                      </span>
                                    )}
                                  </div>

                                  {/* Qué dijo cada canal específicamente este día */}
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed rgba(255,255,255,0.08)' }}>
                                    {t.channelOpinions.map((op, idx) => {
                                      const badge = getActionBadgeStyle(op.action);
                                      return (
                                        <div 
                                          key={idx}
                                          style={{ 
                                            fontSize: '11.5px', 
                                            display: 'flex', 
                                            flexDirection: 'column',
                                            gap: '4px',
                                            background: 'rgba(0,0,0,0.2)',
                                            padding: '6px 8px',
                                            borderRadius: '5px',
                                            border: '1px solid rgba(255,255,255,0.04)'
                                          }}
                                        >
                                          <div style={{ fontWeight: '600', color: '#e5e7eb', fontSize: '11px' }}>
                                            📺 {op.channel}
                                          </div>
                                          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                                            <span style={{ 
                                              color: badge.color, 
                                              fontWeight: '600',
                                              background: badge.bg,
                                              padding: '2px 8px',
                                              borderRadius: '4px',
                                              border: `1px solid ${badge.border}`,
                                              fontSize: '10.5px',
                                              lineHeight: '1.4',
                                              wordBreak: 'break-word',
                                              whiteSpace: 'normal',
                                              maxWidth: '100%'
                                            }}>
                                              {badge.label}
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 2. SUB-SECCIÓN: REVIEWS DE CANALES DEL DÍA */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            📹 Videos y Análisis de Canales ({dayLogs.length})
                          </div>

                          {dayLogs.map(log => {
                            const isVidExpanded = !!expandedVideos[log.video_id];

                            return (
                              <div 
                                key={log.video_id}
                                style={{ 
                                  borderRadius: '8px', 
                                  background: 'rgba(0, 0, 0, 0.25)', 
                                  border: '1px solid rgba(255, 255, 255, 0.06)',
                                  overflow: 'hidden'
                                }}
                              >
                                {/* CABECERA DEL VIDEO / CANAL */}
                                <div 
                                  onClick={() => toggleVideo(log.video_id)}
                                  style={{ 
                                    padding: '12px 15px', 
                                    cursor: 'pointer', 
                                    display: 'flex', 
                                    justify: 'space-between', 
                                    alignItems: 'center',
                                    flexWrap: 'wrap',
                                    gap: '10px',
                                    background: isVidExpanded ? 'rgba(255, 255, 255, 0.03)' : 'transparent'
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 300px' }}>
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', transition: 'transform 0.2s ease', transform: isVidExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                                      ▶
                                    </span>
                                    <div>
                                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#f3f4f6' }}>
                                        {log.channel_name} &bull; <span style={{ fontWeight: 'normal', color: 'var(--text-muted)', fontSize: '13px' }}>{log.video_title}</span>
                                      </div>
                                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                        Hora: {formatVideoTime(log.published_at)} | Sector: <span style={{ color: '#d1d5db' }}>{log.sector || 'General'}</span>
                                      </div>
                                    </div>
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span className="badge" style={{ background: 'rgba(255,255,255,0.08)', color: '#d1d5db', fontSize: '11px' }}>
                                      Tickers: {log.tickers_mentioned || 'N/A'}
                                    </span>
                                  </div>
                                </div>

                                {/* DETALLE EXPANDIBLE DEL VIDEO */}
                                {isVidExpanded && (
                                  <div style={{ 
                                    padding: '15px', 
                                    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                                    background: 'rgba(255, 255, 255, 0.01)'
                                  }}>
                                    {/* Resumen Tesis General */}
                                    <div style={{ marginBottom: '14px' }}>
                                      <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        📝 Tesis & Resumen del Video
                                      </div>
                                      <div style={{ fontSize: '13.5px', lineHeight: '1.5', color: '#e5e7eb' }}>
                                        {log.thesis_summary}
                                      </div>
                                    </div>

                                    {/* Detalle por Ticker */}
                                    {log.ticker_insights && log.ticker_insights.length > 0 && (
                                      <div>
                                        <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                          🎯 Análisis Detallado de Activos Mencionados
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                          {log.ticker_insights.map((insight, idx) => {
                                            const badge = getActionBadgeStyle(insight.action);
                                            return (
                                              <div 
                                                key={idx}
                                                style={{ 
                                                  padding: '10px 12px', 
                                                  borderRadius: '6px', 
                                                  background: 'rgba(255, 255, 255, 0.03)',
                                                  borderLeft: `3px solid ${badge.color}`
                                                }}
                                              >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                  <span style={{ fontWeight: '700', fontSize: '14px', color: '#fff' }}>
                                                    {insight.ticker}
                                                  </span>
                                                  <div style={{ display: 'flex', gap: '6px' }}>
                                                    <span style={{ 
                                                      fontSize: '11px', 
                                                      padding: '2px 8px', 
                                                      borderRadius: '10px', 
                                                      background: badge.bg, 
                                                      color: badge.color,
                                                      fontWeight: '600',
                                                      border: `1px solid ${badge.border}`
                                                    }}>
                                                      {badge.label}
                                                    </span>
                                                    {insight.target_price && insight.target_price !== 'N/A' && (
                                                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: 'rgba(255,255,255,0.08)', color: '#d1d5db' }}>
                                                        Precio Obj: {insight.target_price}
                                                      </span>
                                                    )}
                                                  </div>
                                                </div>
                                                <div style={{ fontSize: '13px', color: '#9ca3af', lineHeight: '1.4' }}>
                                                  {insight.insight_summary}
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
