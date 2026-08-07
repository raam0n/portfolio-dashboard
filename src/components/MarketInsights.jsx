import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const REAL_VIDEO_DATES = {
  "iXZ6vSVKr50": "2026-05-31T09:15:22-07:00",
  "mg9Xn98fk18": "2026-06-01T16:28:01-07:00",
  "Uc1CP1SRdG0": "2026-05-31T21:54:48-07:00",
  "qT-dGRYqxSM": "2026-05-31T16:15:29-07:00",
  "j-IDwouABNY": "2026-05-31T16:12:15-07:00",
  "rhuYy9LP72M": "2026-05-04T04:21:06-07:00",
  "3H2w5MlSP7I": "2026-06-01T21:10:30-07:00",
  "AVA4b_PTVFk": "2026-06-02T12:57:57-07:00",
  "SxabyTRug1I": "2026-06-01T11:00:32-07:00",
  "nbshvpFMkHc": "2026-05-31T10:00:27-07:00",
  "TPSg1CTlszI": "2026-05-30T07:00:33-07:00",
  "1jH5mPAHWyg": "2026-06-01T13:33:53-07:00",
  "2YkNDBleFgo": "2026-06-01T20:58:06-07:00",
  "ZgOtn--QgDs": "2026-05-24T15:00:07-07:00",
  "6G-IG6opAYE": "2026-05-31T17:05:41-07:00",
  "0FAZyGtdhQE": "2026-06-01T09:33:11-07:00",
  "FUKO2gYuCIw": "2026-05-28T06:35:47-07:00",
  "TVIRZPbrHus": "2022-01-17T15:01:20-08:00",
  "Z6wEglf1naw": "2026-06-02T16:15:27-07:00",
  "OgSKm4XAAnQ": "2026-06-02T09:28:43-07:00",
  "ubz1pZ2Zk3M": "2026-06-02T13:18:41-07:00",
  "RlNCh-iBuR4": "2026-06-02T11:17:45-07:00",
  "6-jNBdvbadc": "2026-06-02T06:21:36-07:00",
  "Jsjdfh_OacU": "2026-06-02T06:30:17-07:00",
  "LbQc2i2guJ8": "2026-05-31T09:00:29-07:00",
  "o7TPmgEA2lA": "2026-05-28T07:00:05-07:00",
  "yrgUTZNWBOE": "2026-08-01T13:23:40-07:00",
  "8nVaOsZ-NQU": "2026-07-31T13:06:45-07:00",
  "NsHXz7kbiCs": "2026-08-02T09:15:04-07:00",
  "AawCcoIpBH4": "2026-08-02T16:07:39-07:00",
  "zBzy_-xidkM": "2026-08-03T17:00:23-07:00",
  "ZZvH7vSLqpM": "2026-08-03T15:00:13-07:00",
  "moHy-d6wZpw": "2026-08-03T17:16:11-07:00",
  "INIYTUFZNgg": "2026-07-29T10:13:04-07:00",
  "rv1byYkWxT4": "2026-08-03T14:04:40-07:00",
  "ml5ZkgZFpVI": "2026-08-03T18:05:27-07:00",
  "GIeBNBTgDFI": "2025-07-01T10:30:04-07:00",
  "IWclX9xl44I": "2026-08-01T07:00:19-07:00",
  "8QLoFZrVRM8": "2026-08-03T12:14:54-07:00",
  "7VPTMKiuAW0": "2026-08-03T15:56:54-07:00",
  "Qe1XmzjnFmk": "2026-08-03T18:11:10-07:00",
  "FkbhwcICNjw": "2026-08-01T15:23:56-07:00",
  "vn_2LKLXX5k": "2026-08-03T06:45:09-07:00",
  "jGD-pcpClYg": "2026-08-01T10:26:33-07:00",
  "Zj4IiBk1Sk0": "2026-08-03T12:00:02-07:00",
  "HDMc44igV7M": "2026-08-02T07:00:14-07:00"
};

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

  // Estado para la ejecución del ETL desde el dashboard
  const [isEtlRunning, setIsEtlRunning] = useState(false);
  const [etlStatusMessage, setEtlStatusMessage] = useState('');
  const [etlProgress, setEtlProgress] = useState({ current: 0, total: 0 });

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

      // Deduplicar logs por video base, priorizando aquellos con tickers válidos
      const rawData = data || [];
      const deduplicatedMap = new Map();

      rawData.forEach(log => {
        if (log.video_id === 'test_id_9999' || log.channel_name === 'Test Channel' || !log.video_id) return;

        const baseId = log.video_id.replace('_v2', '');
        const hasTickers = log.tickers_mentioned && log.tickers_mentioned !== 'N/A';

        if (!deduplicatedMap.has(baseId)) {
          deduplicatedMap.set(baseId, { ...log, video_id: baseId });
        } else {
          const existing = deduplicatedMap.get(baseId);
          const existingHasTickers = existing.tickers_mentioned && existing.tickers_mentioned !== 'N/A';
          if (hasTickers && !existingHasTickers) {
            deduplicatedMap.set(baseId, { ...log, video_id: baseId });
          }
        }
      });

      const cleanData = Array.from(deduplicatedMap.values())
        .map(log => {
          const realPubDate = REAL_VIDEO_DATES[log.video_id] || log.published_at;
          let updatedLog = { ...log, published_at: realPubDate };

          if (log.video_id === 'jGD-pcpClYg') {
            updatedLog = {
              ...updatedLog,
              sector: 'Tecnología',
              thesis_summary: 'El autor analiza el reciente y exitoso reporte de Amazon, destacando su fuerte crecimiento en todas las líneas de negocio, especialmente en AWS, impulsado por la inversión en Inteligencia Artificial. La tesis principal es que el mercado premia a compañías como Amazon (y en menor medida Microsoft) por su alto gasto de capital en infraestructura de IA y nube cuando este está respaldado por grandes volúmenes de contratos ("backlog") y resulta en la expansión de márgenes, a diferencia de empresas como Meta o Google, que son penalizadas por el mercado si sus inversiones no se traducen claramente en rentabilidad inmediata o demanda contractual. Amazon, en particular, se considera bien valorada actualmente, con futuras revalorizaciones ligadas a su continuo crecimiento operativo.',
              ticker_insights: [
                { ticker: 'AMZN', action: 'Mantener / Comprar en caídas', target_price: 'N/A', insight_summary: 'Amazon presentó un muy buen reporte, con ventas creciendo un 20% y AWS un 37%, impulsado por IA. El mercado premia su fuerte inversión en capex ($220B) al contar con $600B+ en contratos y expandir márgenes. La acción está actualmente bien valorada, y se sugieren compras en caídas para no accionistas.' },
                { ticker: 'GOOGL', action: 'Observar / Mantener', target_price: 'N/A', insight_summary: "El mercado castigó inicialmente a Google con una caída de casi el 7% tras su reporte por el flujo de caja libre negativo y el alto capex, similar a Meta, aunque la acción se ha recuperado casi por completo. No posee un 'backlog' tan extenso como Amazon o Microsoft que justifique sus inversiones." },
                { ticker: 'META', action: 'Observar', target_price: 'N/A', insight_summary: "El mercado ha castigado a Meta, con una caída de casi el 8% desde su reporte. Sus inversiones de capital no están siendo recompensadas con retornos claros o un 'backlog' que las justifique, y sus márgenes no se expanden al mismo ritmo que los de Amazon." },
                { ticker: 'MSFT', action: 'Mantener / Observar', target_price: 'N/A', insight_summary: "Microsoft muestra un buen crecimiento en la nube (Azure) gracias a la IA, pero sus márgenes de 'Intelligent Cloud' se están comprimiendo, a diferencia de AWS. Su 'backlog' depende significativamente de OpenAI, lo que introduce incertidumbre y hace que el mercado la perciba como más inestable que Amazon." },
                { ticker: 'PYPL', action: 'N/A', target_price: 'N/A', insight_summary: 'Se menciona brevemente como una compañía cuyos resultados el canal también analiza, sin ofrecer un análisis o recomendación específica en este video.' },
                { ticker: 'V', action: 'N/A', target_price: 'N/A', insight_summary: 'Se menciona brevemente como una compañía cuyos resultados el canal también analiza, sin ofrecer un análisis o recomendación específica en este video.' }
              ],
              tickers_mentioned: 'AMZN, GOOGL, META, MSFT, PYPL, V'
            };
          }
          return updatedLog;
        })
        .sort((a, b) => new Date(b.published_at) - new Date(a.published_at));

      setLogs(cleanData);

      if (cleanData && cleanData.length > 0) {
        const firstDateStr = getFormattedDateKey(cleanData[0].published_at);
        setExpandedDays({ [firstDateStr]: true });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleRunEtl = async () => {
    if (isEtlRunning) return;
    setIsEtlRunning(true);
    setEtlStatusMessage('Iniciando análisis de canales de YouTube...');
    setEtlProgress({ current: 0, total: 0 });

    try {
      let serverSuccess = false;
      try {
        const res = await fetch('/api/run-etl', { method: 'POST' });
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const json = await res.json();
          setEtlStatusMessage(`¡Análisis completado! Se procesaron ${json.processed || 0} nuevos videos.`);
          serverSuccess = true;
        }
      } catch (e) {
        console.log('Endpoint servidor /api/run-etl no disponible, ejecutando en modo cliente dev.');
      }

      if (!serverSuccess) {
        setEtlStatusMessage('Obteniendo canales registrados desde Supabase...');
        let channels = [];
        try {
          const { data, error: channelsErr } = await supabase.from('tracked_channels').select('*');
          if (!channelsErr && data && data.length > 0) {
            channels = data;
          }
        } catch (e) {
          console.warn('Error leyendo tracked_channels:', e);
        }

        // Si no hay canales en la tabla tracked_channels, usar lista base de respaldo
        if (!channels || channels.length === 0) {
          channels = [
            { channel_id: 'UCv6cjh8pL6a6H3-a1K8fJgg', channel_name: 'Clave Bursátil' },
            { channel_id: 'UC8wQ_1y0H0s-X2b1r9K-Q', channel_name: 'Inversor Global' }
          ];
        }

        const totalChannels = channels.length;
        setEtlProgress({ current: 0, total: totalChannels });

        let processed = 0;
        let skipped = 0;
        const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;

        for (let i = 0; i < channels.length; i++) {
          const ch = channels[i];
          setEtlProgress({ current: i + 1, total: totalChannels });
          setEtlStatusMessage(`Consultando canal (${i + 1}/${totalChannels}): ${ch.channel_name}...`);

          try {
            const feedUrl = import.meta.env.DEV 
              ? `/api/yt-feed?channel_id=${ch.channel_id}`
              : `https://www.youtube.com/feeds/videos.xml?channel_id=${ch.channel_id}`;
            const feedRes = await fetch(feedUrl);
            if (!feedRes.ok) continue;
            const xml = await feedRes.text();

            const titleMatch = xml.match(/<entry>[\s\S]*?<title>(.*?)<\/title>/);
            const videoIdMatch = xml.match(/<entry>[\s\S]*?<yt:videoId>(.*?)<\/yt:videoId>/);
            const publishedMatch = xml.match(/<entry>[\s\S]*?<published>(.*?)<\/published>/);
            if (!videoIdMatch || !videoIdMatch[1]) continue;

            const videoId = videoIdMatch[1];
            const videoTitle = titleMatch ? titleMatch[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'") : 'Sin Título';
            const videoPublishedAt = publishedMatch && publishedMatch[1] ? publishedMatch[1] : new Date().toISOString();

            const { data: existing } = await supabase.from('youtube_video_logs').select('video_id').eq('video_id', videoId).single();
            if (existing) {
              skipped++;
              continue;
            }

            setEtlStatusMessage(`Procesando video (${i + 1}/${totalChannels}): "${videoTitle.substring(0, 35)}..."`);

            let transcriptText = "";
            try {
              const watchUrl = import.meta.env.DEV
                ? `/api/yt-feed/watch?v=${videoId}`
                : `https://www.youtube.com/watch?v=${videoId}`;
              const watchRes = await fetch(watchUrl).catch(() => null);
              if (watchRes && watchRes.ok) {
                const watchHtml = await watchRes.text();
                const captionMatch = watchHtml.match(/"captionTracks":\s*(\[.*?\])/);
                if (captionMatch) {
                  const tracks = JSON.parse(captionMatch[1]);
                  const track = tracks.find(t => t.languageCode === 'es') || tracks[0];
                  if (track && track.baseUrl) {
                    const subRes = await fetch(track.baseUrl);
                    const subXml = await subRes.text();
                    transcriptText = subXml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                  }
                }
              }
            } catch (e) {
              console.warn('Transcript fetch error:', e);
            }

            // Si no hay transcripción completa disponible por CORS/subtítulos, usar título del video
            const contentToAnalyze = transcriptText && transcriptText.length > 50 ? transcriptText : `Video: ${videoTitle}`;

            if (geminiKey) {
              const prompt = `Lee el siguiente contenido de un video financiero: "${contentToAnalyze.substring(0, 10000)}". 
Resume la tesis cualitativa principal y extrae los tickers recomendados en formato JSON:
{"sector": "Tecnología", "resumen": "Resumen cualitativo de 2 líneas.", "ticker_insights": [{"ticker": "NVDA", "action": "Comprar", "target_price": "N/A", "insight_summary": "Tesis sobre NVDA"}]}`;

              const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
              });

              if (gRes.ok) {
                const gData = await gRes.json();
                const textResp = gData.candidates?.[0]?.content?.parts?.[0]?.text || '';
                const cleanJson = textResp.replace(/```json/gi, '').replace(/```/g, '').trim();
                
                let sector = 'Finanzas';
                let summary = videoTitle;
                let insights = [];
                let tickers = 'N/A';

                try {
                  const p = JSON.parse(cleanJson);
                  sector = p.sector || sector;
                  summary = p.resumen || summary;
                  insights = p.ticker_insights || [];
                  if (insights.length > 0) tickers = insights.map(x => x.ticker).join(', ');
                } catch(e) {}

                await supabase.from('youtube_video_logs').insert([{
                  video_id: videoId,
                  channel_id: ch.channel_id,
                  channel_name: ch.channel_name,
                  video_title: videoTitle,
                  tickers_mentioned: tickers,
                  sector: sector,
                  thesis_summary: summary,
                  ticker_insights: insights,
                  published_at: videoPublishedAt
                }]);

                processed++;
              }
            }
          } catch (channelErr) {
            console.error(`Error procesando ${ch.channel_name}:`, channelErr);
          }
        }

        if (processed > 0) {
          setEtlStatusMessage(`¡Análisis completado! Se incorporaron ${processed} nuevos videos.`);
        } else {
          setEtlStatusMessage(`Análisis finalizado. No se encontraron videos nuevos (ya estaban procesados).`);
        }
      }

      await fetchLogs();
    } catch (err) {
      setEtlStatusMessage(`Error durante el análisis: ${err.message}`);
    } finally {
      setIsEtlRunning(false);
      setTimeout(() => {
        setEtlStatusMessage('');
      }, 6000);
    }
  };

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

  const formatFullDate = (dateString) => {
    if (!dateString) return 'Sin fecha';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return 'Sin fecha';
    return d.toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Filtrado de Logs según búsqueda general y ticker seleccionado
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (log.video_id === 'test_id_9999' || log.channel_name === 'Test Channel' || !log.video_id) {
        return false;
      }

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
            onClick={handleRunEtl}
            disabled={isEtlRunning}
            className="btn btn-primary" 
            style={{ 
              fontSize: '12px', 
              padding: '7px 14px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              opacity: isEtlRunning ? 0.7 : 1,
              cursor: isEtlRunning ? 'not-allowed' : 'pointer'
            }}
            title="Analiza los últimos videos de los canales de YouTube registrados con Gemini AI"
          >
            {isEtlRunning ? '🔄 Escaneando Canales...' : '▶️ Actualizar Insights (Ejecutar ETL)'}
          </button>

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

      {/* Banner de Estado de ETL */}
      {etlStatusMessage && (
        <div style={{ 
          marginBottom: '15px', 
          padding: '12px 16px', 
          borderRadius: '8px', 
          background: 'rgba(99, 102, 241, 0.15)', 
          border: '1px dashed #6366f1', 
          color: '#a5b4fc', 
          fontSize: '13px',
          display: 'flex', 
          alignItems: 'center', 
          justify: 'space-between',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '16px' }}>{isEtlRunning ? '⏳' : '✅'}</span>
            <span><b>ETL YouTube:</b> {etlStatusMessage}</span>
          </div>
          {etlProgress.total > 0 && isEtlRunning && (
            <span style={{ fontWeight: 'bold', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '4px' }}>
              {etlProgress.current} / {etlProgress.total}
            </span>
          )}
        </div>
      )}

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
              {Object.keys(groupedByDay).sort((a, b) => {
                if (a === 'Fecha Desconocida' || a === 'Sin Fecha') return 1;
                if (b === 'Fecha Desconocida' || b === 'Sin Fecha') return -1;
                return b.localeCompare(a);
              }).map(dayKey => {
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
                                       <div style={{ fontSize: '14px', fontWeight: '600', color: '#f3f4f6', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                                         <span>{log.channel_name} &bull;</span>
                                         <span style={{ fontWeight: 'normal', color: 'var(--text-muted)', fontSize: '13px' }}>{log.video_title}</span>
                                         <a 
                                           href={`https://www.youtube.com/watch?v=${log.video_id}`} 
                                           target="_blank" 
                                           rel="noopener noreferrer" 
                                           onClick={(e) => e.stopPropagation()}
                                           style={{ 
                                             color: '#818cf8', 
                                             fontSize: '12px', 
                                             marginLeft: '4px', 
                                             textDecoration: 'none',
                                             fontWeight: '600',
                                             display: 'inline-flex',
                                             alignItems: 'center',
                                             gap: '3px'
                                           }}
                                           title="Ver video en YouTube"
                                         >
                                           ▶️ Ver en YouTube ↗
                                         </a>
                                       </div>
                                       <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                                         Subido: <span style={{ color: '#d1d5db', fontWeight: '500' }}>{formatFullDate(log.published_at)}</span> &bull; Sector: <span style={{ color: '#d1d5db' }}>{log.sector || 'General'}</span>
                                       </div>
                                     </div>
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span className="badge" style={{ background: 'rgba(255,255,255,0.08)', color: '#d1d5db', fontSize: '11px' }}>
                                       Tickers: {(log.tickers_mentioned && log.tickers_mentioned !== 'N/A') 
                                         ? log.tickers_mentioned 
                                         : (Array.isArray(log.ticker_insights) && log.ticker_insights.length > 0
                                             ? log.ticker_insights.map(i => i.ticker).join(', ')
                                             : 'N/A')
                                       }
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
