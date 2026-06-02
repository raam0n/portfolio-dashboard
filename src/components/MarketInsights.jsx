import React, { useState, useEffect } from 'react';

export default function MarketInsights() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoading(true);
        // Hacemos fetch al endpoint de nuestra API serverless
        const response = await fetch('/api/insights');
        if (!response.ok) {
          throw new Error('Error al obtener los insights');
        }
        const data = await response.json();
        setLogs(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(log => {
    const query = searchQuery.toLowerCase();
    return (
      (log.tickers_mentioned && log.tickers_mentioned.toLowerCase().includes(query)) ||
      (log.sector && log.sector.toLowerCase().includes(query)) ||
      (log.channel_name && log.channel_name.toLowerCase().includes(query)) ||
      (log.video_title && log.video_title.toLowerCase().includes(query))
    );
  });

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    return d.toLocaleDateString('es-AR', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="glass-panel">
      <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="panel-title">Market Insights (YouTube AI)</div>
        <div style={{ flex: '0 1 300px' }}>
          <input 
            type="text" 
            placeholder="Buscar ticker, sector, canal..." 
            className="input-field" 
            style={{ width: '100%', fontSize: '13px', padding: '6px 10px' }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>
      
      <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '20px' }}>
        Resúmenes generados por inteligencia artificial de los últimos videos financieros.
      </p>

      {loading && <div className="empty-state">Cargando insights...</div>}
      {error && <div className="empty-state" style={{ color: 'var(--negative)' }}>{error}</div>}
      
      {!loading && !error && filteredLogs.length === 0 && (
        <div className="empty-state">No se encontraron insights que coincidan con la búsqueda.</div>
      )}

      {!loading && !error && filteredLogs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {filteredLogs.map(log => (
            <div key={log.video_id} className="summary-card" style={{ padding: '15px', borderRadius: '8px', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: '600' }}>{log.video_title}</h3>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    <span>{log.channel_name}</span> &bull; <span>{formatDate(log.published_at)}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                   <span className="badge" style={{ backgroundColor: 'rgba(99, 102, 241, 0.2)', color: '#a5b4fc', marginBottom: '4px' }}>
                     Tickers: {log.tickers_mentioned || 'N/A'}
                   </span>
                   <br/>
                   <span className="badge" style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#6ee7b7' }}>
                     Sector: {log.sector || 'N/A'}
                   </span>
                </div>
              </div>
              <div style={{ fontSize: '14px', lineHeight: '1.5', color: '#d1d5db', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                {log.thesis_summary}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
