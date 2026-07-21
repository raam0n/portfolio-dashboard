import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default function ApiUsageDashboard() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  async function fetchLogs() {
    setLoading(true);
    try {
      const { data, error: sbError } = await supabase
        .from('api_usage_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (sbError) throw sbError;
      setLogs(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Calculate metrics
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const dailyLogs = logs.filter(log => new Date(log.created_at).getTime() >= todayStart);
  const monthlyLogs = logs.filter(log => new Date(log.created_at).getTime() >= monthStart);
  
  const dailyErrors = dailyLogs.filter(l => l.status !== 'success');
  
  const totalTokensPrompt = monthlyLogs.reduce((acc, l) => acc + (l.tokens_prompt || 0), 0);
  const totalTokensCompletion = monthlyLogs.reduce((acc, l) => acc + (l.tokens_completion || 0), 0);

  // Group by service
  const serviceStats = monthlyLogs.reduce((acc, log) => {
    if (!acc[log.service_name]) acc[log.service_name] = { count: 0, errors: 0 };
    acc[log.service_name].count += 1;
    if (log.status !== 'success') acc[log.service_name].errors += 1;
    return acc;
  }, {});

  if (loading && logs.length === 0) return <div className="empty-state">Cargando métricas...</div>;
  if (error) return <div className="empty-state negative">Error al cargar datos: {error}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header */}
      <div className="header" style={{ marginBottom: '0.5rem' }}>
        <h2 className="panel-title" style={{ fontSize: '20px' }}>Mini Dashboard de Consumo de APIs</h2>
        <button className="btn btn-primary" onClick={fetchLogs}>
          {loading ? 'Cargando...' : 'Actualizar Datos'}
        </button>
      </div>

      {logs.length === 0 && !loading && (
        <div className="glass-panel" style={{ borderColor: 'var(--warning)', background: 'rgba(245, 158, 11, 0.05)' }}>
          <h3 style={{ color: 'var(--warning)', marginBottom: '8px' }}>No se recuperaron datos de la base de datos.</h3>
          <p className="neutral">Si ves datos en el panel de Supabase pero no aquí, probablemente sea un problema de permisos de lectura (RLS). Por favor, asegúrate de correr las políticas de lectura en el SQL Editor.</p>
        </div>
      )}

      {/* Top Metrics Grid */}
      <div className="metrics-grid">
        <div className="glass-panel metric-card">
          <div className="metric-label">Ejecuciones Hoy</div>
          <div className="metric-value">{dailyLogs.length}</div>
        </div>
        <div className="glass-panel metric-card">
          <div className="metric-label">Ejecuciones este Mes</div>
          <div className="metric-value positive">{monthlyLogs.length}</div>
        </div>
        <div className="glass-panel metric-card">
          <div className="metric-label">Tokens Mensuales (Gemini)</div>
          <div className="metric-value" style={{ color: '#a78bfa' }}>
            {totalTokensPrompt.toLocaleString()} <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>In</span>
            <span style={{ margin: '0 8px', color: 'var(--glass-border)' }}>/</span>
            {totalTokensCompletion.toLocaleString()} <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Out</span>
          </div>
        </div>
      </div>

      {/* Middle Grid */}
      <div className="dashboard-grid">
        <div className="glass-panel">
          <div className="panel-header">
            <h3 className="panel-title">Desglose por Servicio (Mes)</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {Object.entries(serviceStats).map(([service, stats]) => (
              <div key={service} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid var(--glass-border)' }}>
                <div style={{ fontWeight: '600' }}>{service}</div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '14px' }}>{stats.count} llamadas</div>
                  {stats.errors > 0 && <div className="negative" style={{ fontSize: '12px' }}>{stats.errors} errores</div>}
                </div>
              </div>
            ))}
            {Object.keys(serviceStats).length === 0 && (
              <div className="empty-state" style={{ padding: '1rem' }}>No hay datos registrados este mes.</div>
            )}
          </div>
        </div>

        <div className="glass-panel">
          <div className="panel-header">
            <h3 className="panel-title">Advertencias (Límites)</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <span style={{ fontSize: '20px' }}>⚠️</span>
              <div>
                <div style={{ fontWeight: '600', marginBottom: '4px' }}>Gemini Rate Limit (ETL)</div>
                <div className="hint" style={{ marginTop: 0 }}>El proceso ETL de YouTube tiene un límite de 15 peticiones por minuto y 1,500 por día en tier gratuito.</div>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <span style={{ fontSize: '20px' }}>❗</span>
              <div>
                <div style={{ fontWeight: '600', marginBottom: '4px' }}>Errores Hoy</div>
                <div className="hint" style={{ marginTop: 0 }}>
                  Se han registrado <span className="negative" style={{ fontWeight: 'bold' }}>{dailyErrors.length}</span> errores hoy.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Table */}
      <div className="glass-panel">
        <div className="panel-header">
          <h3 className="panel-title">Últimos Registros (Top 50)</h3>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Servicio</th>
                <th>Feature / Modelo</th>
                <th>Tokens (In/Out)</th>
                <th>Status</th>
                <th>Usuario (ID)</th>
              </tr>
            </thead>
            <tbody>
              {logs.slice(0, 50).map(log => (
                <tr key={log.id}>
                  <td className="neutral">{new Date(log.created_at).toLocaleString()}</td>
                  <td style={{ fontWeight: '600', color: 'var(--text-main)' }}>{log.service_name}</td>
                  <td>
                    {log.feature}<br/>
                    <span className="hint">{log.endpoint_model}</span>
                  </td>
                  <td>
                    {(log.tokens_prompt || 0)} / {(log.tokens_completion || 0)}
                  </td>
                  <td>
                    {log.status === 'success' ? (
                      <span className="badge badge-compra">Success</span>
                    ) : (
                      <span className="badge badge-venta" title={log.error_message}>
                        {log.status}
                      </span>
                    )}
                  </td>
                  <td className="neutral" style={{ fontFamily: 'monospace' }}>
                    {log.user_id ? log.user_id.substring(0,8) + '...' : 'N/A'}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan="6" className="empty-state">No hay registros para mostrar. Ejecuta alguna acción en la aplicación.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
