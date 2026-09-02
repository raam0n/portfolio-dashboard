import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import './index.css';
import MarketInsights from './components/MarketInsights';
import MarketTreemap from './components/MarketTreemap';
import ApiUsageDashboard from './components/ApiUsageDashboard';
import { HonorariosDashboard } from './components/HonorariosDashboard';
import { analyzeMovement } from './services/aiAnalyzer';
import { extractPortfolioDataFromImage } from './services/visionService';
import MultiPortfolioCompositions from './components/MultiPortfolioCompositions';
import { extractPortfolioInternationalProxy, calculateProxyDailyReturn } from './services/marketProxy';


// ── Pure SVG Pie Chart ────────────────────────────────────────────────────────
const CHART_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6',
  '#a855f7', '#ec4899', '#14b8a6', '#f97316', '#84cc16',
  '#06b6d4', '#e11d48', '#8b5cf6', '#22d3ee', '#fb923c',
];
const GLOBAL_INDICES = [
  // 📊 Índices de Mercado (Spot)
  { ticker: '^GSPC', name: 'S&P 500 (US 500)', category: 'indices', desc: 'Benchmark principal del mercado estadounidense de acciones de gran capitalización.' },
  { ticker: '^DJI', name: 'Dow Jones (US 30)', category: 'indices', desc: 'Índice industrial de referencia de las 30 mayores empresas de EE.UU.' },
  { ticker: '^NDX', name: 'Nasdaq 100 (US TECH 100)', category: 'indices', desc: 'Índice de las 100 mayores empresas no financieras cotizadas en Nasdaq.' },
  { ticker: '^RUT', name: 'Russell 2000 (US 2000)', category: 'indices', desc: 'Índice de referencia para 2.000 empresas de pequeña capitalización (Small Caps) de EE.UU.' },
  { ticker: '^VIX', name: 'S&P VIX (Volatilidad)', category: 'indices', desc: 'Índice de volatilidad del S&P 500; mide las expectativas de volatilidad del mercado a 30 días.' },
  { ticker: '^STOXX50E', name: 'Euro Stoxx 50', category: 'indices', desc: 'El índice más representativo de las 50 mayores empresas de la Eurozona.' },
  { ticker: 'EWZ', name: 'Bovespa (USD)', category: 'indices', desc: 'iShares MSCI Brazil ETF; usado como proxy del mercado brasileño en dólares.' },
  { ticker: 'MERVAL_USD', name: 'Merval (USD)', category: 'indices', desc: 'Índice S&P Merval dividido por el Dólar CCL. Refleja el valor real en dólares de las acciones argentinas.', isCalculated: true },

  // 📈 Futuros de Índices EE.UU.
  { ticker: 'ES=F', name: 'Futuro US 500 (E-mini S&P)', category: 'futuros', desc: 'Contrato de futuros e-mini del S&P 500 (CME). Cotiza casi 24hs al día anticipando el mercado.' },
  { ticker: 'YM=F', name: 'Futuro US 30 (E-mini Dow)', category: 'futuros', desc: 'Contrato de futuros e-mini del Dow Jones Industrial Average 30.' },
  { ticker: 'NQ=F', name: 'Futuro US TECH 100 (E-mini Nasdaq)', category: 'futuros', desc: 'Contrato de futuros e-mini del Nasdaq 100.' },
  { ticker: 'RTY=F', name: 'Futuro US 2000 (E-mini Russell)', category: 'futuros', desc: 'Contrato de futuros e-mini del Russell 2000 Small Caps.' },
  { ticker: 'VX=F', name: 'Futuro S&P VIX', category: 'futuros', desc: 'Contrato de futuros sobre el índice de volatilidad VIX.' },

  // 🌐 Commodities & Macroeconómicos
  { ticker: '^TNX', name: '10Y Yield', category: 'macro', desc: 'Rendimiento del bono del Tesoro a 10 años. Si sube, suele presionar a la baja a las acciones y encarece el crédito.' },
  { ticker: 'DX-Y.NYB', name: 'DXY (Índice Dólar)', category: 'macro', desc: 'Índice Dólar. Mide la fortaleza del dólar frente a otras divisas globales.' },
  { ticker: 'GC=F', name: 'Oro (Futuros)', category: 'macro', desc: 'Futuros del Oro. Activo refugio por excelencia ante incertidumbre o inflación.' },
  { ticker: 'CL=F', name: 'WTI Oil (Futuros)', category: 'macro', desc: 'Crudo West Texas Intermediate. Referencia principal del petróleo en EE.UU.' },
  { ticker: 'BZ=F', name: 'Brent Oil (Futuros)', category: 'macro', desc: 'Petróleo Brent. Referencia global para el mercado europeo y mundial.' },
  { ticker: 'BTC-USD', name: 'Bitcoin', category: 'macro', desc: 'Referencia principal del mercado de criptoactivos.' },
];

const cleanTickerSymbol = (t) => {
  if (!t) return '';
  return String(t).trim().toUpperCase().replace(/\.BA$/i, '');
};

// Sanitizes and deduplicates watchlist entries by clean ticker symbol
export const sanitizeWatchlist = (rawList) => {
  if (!Array.isArray(rawList)) return [];
  const seen = new Map();
  rawList.forEach(item => {
    if (!item || !item.ticker) return;
    const key = cleanTickerSymbol(item.ticker);
    if (!key) return;
    if (!seen.has(key)) {
      seen.set(key, { ...item, ticker: key });
    } else {
      const existing = seen.get(key);
      seen.set(key, {
        ...existing,
        ...item,
        ticker: key,
        nombre: existing.nombre && existing.nombre !== key ? existing.nombre : (item.nombre || existing.nombre || key),
        sector: existing.sector && existing.sector !== 'Sin Sector' && existing.sector !== 'General' ? existing.sector : (item.sector || existing.sector),
        subsector: existing.subsector && existing.subsector !== 'Sin Subsector' && existing.subsector !== 'General' ? existing.subsector : (item.subsector || existing.subsector),
        pais: existing.pais && existing.pais !== 'Desconocido' ? existing.pais : (item.pais || existing.pais),
        mercado: existing.mercado && existing.mercado !== 'NYSE/NASDAQ' ? existing.mercado : (item.mercado || existing.mercado || (item.tipo === 'stock' ? 'NASDAQ' : 'BCBA'))
      });
    }
  });
  return Array.from(seen.values());
};


const SEED_TICKER_CATALOG = {
  // Acciones Argentina (BCBA)
  'GGAL': { ticker: 'GGAL', nombre: 'Grupo Financiero Galicia', tipo: 'accion', mercado: 'BCBA', sector: 'Banking', subsector: 'Bancos', pais: 'Argentina' },
  'YPFD': { ticker: 'YPFD', nombre: 'YPF S.A.', tipo: 'accion', mercado: 'BCBA', sector: 'Energía', subsector: 'Petróleo y Gas', pais: 'Argentina' },
  'BMA': { ticker: 'BMA', nombre: 'Banco Macro S.A.', tipo: 'accion', mercado: 'BCBA', sector: 'Banking', subsector: 'Bancos', pais: 'Argentina' },
  'BBAR': { ticker: 'BBAR', nombre: 'BBVA Argentina', tipo: 'accion', mercado: 'BCBA', sector: 'Banking', subsector: 'Bancos', pais: 'Argentina' },
  'PAMP': { ticker: 'PAMP', nombre: 'Pampa Energía S.A.', tipo: 'accion', mercado: 'BCBA', sector: 'Energía', subsector: 'Energía Integrada', pais: 'Argentina' },
  'ALUA': { ticker: 'ALUA', nombre: 'Aluar Aluminio Argentino', tipo: 'accion', mercado: 'BCBA', sector: 'Minería', subsector: 'Aluminio', pais: 'Argentina' },
  'TXAR': { ticker: 'TXAR', nombre: 'Ternium Argentina S.A.', tipo: 'accion', mercado: 'BCBA', sector: 'Minería', subsector: 'Acero', pais: 'Argentina' },
  'TGSU2': { ticker: 'TGSU2', nombre: 'Transportadora de Gas del Sur', tipo: 'accion', mercado: 'BCBA', sector: 'Energía', subsector: 'Gas Utility', pais: 'Argentina' },
  'EDN': { ticker: 'EDN', nombre: 'Edenor S.A.', tipo: 'accion', mercado: 'BCBA', sector: 'Energía', subsector: 'Distribución Eléctrica', pais: 'Argentina' },
  'CEPU': { ticker: 'CEPU', nombre: 'Central Puerto S.A.', tipo: 'accion', mercado: 'BCBA', sector: 'Energía', subsector: 'Generación Eléctrica', pais: 'Argentina' },
  'CRES': { ticker: 'CRES', nombre: 'Cresud S.A.C.I.F. y A.', tipo: 'accion', mercado: 'BCBA', sector: 'Bienes Raíces', subsector: 'Agro & Real Estate', pais: 'Argentina' },
  'SUPV': { ticker: 'SUPV', nombre: 'Grupo Supervielle S.A.', tipo: 'accion', mercado: 'BCBA', sector: 'Banking', subsector: 'Bancos', pais: 'Argentina' },
  'MIRG': { ticker: 'MIRG', nombre: 'Mirgor S.A.C.I.F.I.A.', tipo: 'accion', mercado: 'BCBA', sector: 'Tech', subsector: 'Electrónica', pais: 'Argentina' },
  'COME': { ticker: 'COME', nombre: 'Sociedad Comercial del Plata', tipo: 'accion', mercado: 'BCBA', sector: 'Industrial', subsector: 'Holding', pais: 'Argentina' },

  // Bonos Soberanos USD (Ley Argentina)
  'AL30': { ticker: 'AL30', nombre: 'Bono República Argentina 2030 (AL30)', tipo: 'bono', mercado: 'BCBA', sector: 'Renta Fija Soberana', subsector: 'Bonos USD Ley Argentina', pais: 'Argentina' },
  'AL29': { ticker: 'AL29', nombre: 'Bono República Argentina 2029 (AL29)', tipo: 'bono', mercado: 'BCBA', sector: 'Renta Fija Soberana', subsector: 'Bonos USD Ley Argentina', pais: 'Argentina' },
  'AL35': { ticker: 'AL35', nombre: 'Bono República Argentina 2035 (AL35)', tipo: 'bono', mercado: 'BCBA', sector: 'Renta Fija Soberana', subsector: 'Bonos USD Ley Argentina', pais: 'Argentina' },
  'AE38': { ticker: 'AE38', nombre: 'Bono República Argentina 2038 (AE38)', tipo: 'bono', mercado: 'BCBA', sector: 'Renta Fija Soberana', subsector: 'Bonos USD Ley Argentina', pais: 'Argentina' },
  'AL41': { ticker: 'AL41', nombre: 'Bono República Argentina 2041 (AL41)', tipo: 'bono', mercado: 'BCBA', sector: 'Renta Fija Soberana', subsector: 'Bonos USD Ley Argentina', pais: 'Argentina' },

  // Bonos Soberanos USD (Ley NY / Globales)
  'GD30': { ticker: 'GD30', nombre: 'Bono Global Argentina 2030 (GD30)', tipo: 'bono', mercado: 'BCBA', sector: 'Renta Fija Soberana', subsector: 'Bonos Globales USD Ley NY', pais: 'Argentina' },
  'GD29': { ticker: 'GD29', nombre: 'Bono Global Argentina 2029 (GD29)', tipo: 'bono', mercado: 'BCBA', sector: 'Renta Fija Soberana', subsector: 'Bonos Globales USD Ley NY', pais: 'Argentina' },
  'GD35': { ticker: 'GD35', nombre: 'Bono Global Argentina 2035 (GD35)', tipo: 'bono', mercado: 'BCBA', sector: 'Renta Fija Soberana', subsector: 'Bonos Globales USD Ley NY', pais: 'Argentina' },
  'GD38': { ticker: 'GD38', nombre: 'Bono Global Argentina 2038 (GD38)', tipo: 'bono', mercado: 'BCBA', sector: 'Renta Fija Soberana', subsector: 'Bonos Globales USD Ley NY', pais: 'Argentina' },
  'GD41': { ticker: 'GD41', nombre: 'Bono Global Argentina 2041 (GD41)', tipo: 'bono', mercado: 'BCBA', sector: 'Renta Fija Soberana', subsector: 'Bonos Globales USD Ley NY', pais: 'Argentina' },

  // Bonos Pesos / CER / LECAPs / Tasa Fija / Dólar Linked
  'T2X4': { ticker: 'T2X4', nombre: 'Bono CER 2024 (T2X4)', tipo: 'bono', mercado: 'BCBA', sector: 'Renta Fija Soberana', subsector: 'Bonos CER / Inflación', pais: 'Argentina' },
  'T2X5': { ticker: 'T2X5', nombre: 'Bono CER 2025 (T2X5)', tipo: 'bono', mercado: 'BCBA', sector: 'Renta Fija Soberana', subsector: 'Bonos CER / Inflación', pais: 'Argentina' },
  'TX26': { ticker: 'TX26', nombre: 'Bono CER 2026 (TX26)', tipo: 'bono', mercado: 'BCBA', sector: 'Renta Fija Soberana', subsector: 'Bonos CER / Inflación', pais: 'Argentina' },
  'TX28': { ticker: 'TX28', nombre: 'Bono CER 2028 (TX28)', tipo: 'bono', mercado: 'BCBA', sector: 'Renta Fija Soberana', subsector: 'Bonos CER / Inflación', pais: 'Argentina' },
  'T30J7': { ticker: 'T30J7', nombre: 'Bono Tesoro Nacional Cap. 30/06/27', tipo: 'bono', mercado: 'BCBA', sector: 'Renta Fija Soberana', subsector: 'Bonos Pesos / LECAPs', pais: 'Argentina' },
  'S31O4': { ticker: 'S31O4', nombre: 'Lecap Vto Octubre 2024', tipo: 'bono', mercado: 'BCBA', sector: 'Renta Fija Soberana', subsector: 'Bonos Pesos / LECAPs', pais: 'Argentina' },
  'S28F5': { ticker: 'S28F5', nombre: 'Lecap Vto Febrero 2025', tipo: 'bono', mercado: 'BCBA', sector: 'Renta Fija Soberana', subsector: 'Bonos Pesos / LECAPs', pais: 'Argentina' },
  'TV24': { ticker: 'TV24', nombre: 'Bono Dólar Linked 2024', tipo: 'bono', mercado: 'BCBA', sector: 'Renta Fija Soberana', subsector: 'Bonos Dólar Linked', pais: 'Argentina' },
  'T2V4': { ticker: 'T2V4', nombre: 'Bono Dólar Linked Nov 2024', tipo: 'bono', mercado: 'BCBA', sector: 'Renta Fija Soberana', subsector: 'Bonos Dólar Linked', pais: 'Argentina' },
  'BP21': { ticker: 'BP21', nombre: 'Bono Provincia de Bs.As.', tipo: 'bono', mercado: 'BCBA', sector: 'Renta Fija Subsoberana', subsector: 'Bonos Subsoberanos', pais: 'Argentina' },

  // Obligaciones Negociables (ONs)
  'YCA6O': { ticker: 'YCA6O', nombre: 'ON YPF Clase 16 2026', tipo: 'bono', mercado: 'BCBA', sector: 'Renta Fija Corporativa', subsector: 'Obligaciones Negociables', pais: 'Argentina' },
  'MGC2O': { ticker: 'MGC2O', nombre: 'ON Pampa Energía 2026', tipo: 'bono', mercado: 'BCBA', sector: 'Renta Fija Corporativa', subsector: 'Obligaciones Negociables', pais: 'Argentina' },
  'IRCFO': { ticker: 'IRCFO', nombre: 'ON IRSA 2028', tipo: 'bono', mercado: 'BCBA', sector: 'Renta Fija Corporativa', subsector: 'Obligaciones Negociables', pais: 'Argentina' },

  // CEDEARs / US Stocks / ETFs
  'AAPL': { ticker: 'AAPL', nombre: 'Apple Inc.', tipo: 'cedear', mercado: 'BCBA', sector: 'Tech', subsector: 'Hardware', pais: 'USA' },
  'MSFT': { ticker: 'MSFT', nombre: 'Microsoft Corporation', tipo: 'cedear', mercado: 'BCBA', sector: 'Tech', subsector: 'Software', pais: 'USA' },
  'NVDA': { ticker: 'NVDA', nombre: 'NVIDIA Corporation', tipo: 'cedear', mercado: 'BCBA', sector: 'Tech', subsector: 'Semiconductores', pais: 'USA' },
  'AMD': { ticker: 'AMD', nombre: 'Advanced Micro Devices', tipo: 'cedear', mercado: 'BCBA', sector: 'Tech', subsector: 'Semiconductores', pais: 'USA' },
  'ASML': { ticker: 'ASML', nombre: 'ASML Holding', tipo: 'cedear', mercado: 'BCBA', sector: 'Tech', subsector: 'Semiconductores', pais: 'Países Bajos' },
  'AVGO': { ticker: 'AVGO', nombre: 'Broadcom Inc.', tipo: 'cedear', mercado: 'BCBA', sector: 'Tech', subsector: 'Semiconductores', pais: 'USA' },
  'MU': { ticker: 'MU', nombre: 'Micron Technology', tipo: 'cedear', mercado: 'BCBA', sector: 'Tech', subsector: 'Semiconductores', pais: 'USA' },
  'MRVL': { ticker: 'MRVL', nombre: 'Marvell Technology', tipo: 'cedear', mercado: 'BCBA', sector: 'Tech', subsector: 'Semiconductores', pais: 'USA' },
  'SMH': { ticker: 'SMH', nombre: 'VanEck Semiconductor ETF', tipo: 'cedear', mercado: 'BCBA', sector: 'Tech', subsector: 'Semiconductores', pais: 'USA' },
  'SNDK': { ticker: 'SNDK', nombre: 'Sandisk Corporation', tipo: 'cedear', mercado: 'BCBA', sector: 'Tech', subsector: 'Memorias', pais: 'USA' },
  'NOW': { ticker: 'NOW', nombre: 'ServiceNow Inc.', tipo: 'cedear', mercado: 'BCBA', sector: 'Tech', subsector: 'Software', pais: 'USA' },
  'ORCL': { ticker: 'ORCL', nombre: 'Oracle Corporation', tipo: 'cedear', mercado: 'BCBA', sector: 'Tech', subsector: 'Software', pais: 'USA' },
  'PLTR': { ticker: 'PLTR', nombre: 'Palantir Technologies', tipo: 'cedear', mercado: 'BCBA', sector: 'Tech', subsector: 'Software', pais: 'USA' },
  'SNOW': { ticker: 'SNOW', nombre: 'Snowflake Inc.', tipo: 'cedear', mercado: 'BCBA', sector: 'Tech', subsector: 'Software', pais: 'USA' },
  'OKLO': { ticker: 'OKLO', nombre: 'Oklo Inc.', tipo: 'cedear', mercado: 'BCBA', sector: 'Energía', subsector: 'Nuclear', pais: 'USA' },
  'MP': { ticker: 'MP', nombre: 'MP Materials', tipo: 'cedear', mercado: 'BCBA', sector: 'Minería', subsector: 'Tierras Raras', pais: 'USA' },
  'FCX': { ticker: 'FCX', nombre: 'Freeport-McMoRan', tipo: 'cedear', mercado: 'BCBA', sector: 'Minería', subsector: 'Cobre / Metales', pais: 'USA' },
  'ARCO': { ticker: 'ARCO', nombre: 'Arcos Dorados Holdings', tipo: 'cedear', mercado: 'BCBA', sector: 'Consumo', subsector: 'Alimentos', pais: 'Uruguay' },
  'BRKB': { ticker: 'BRKB', nombre: 'Berkshire Hathaway Inc.', tipo: 'cedear', mercado: 'BCBA', sector: 'Financial', subsector: 'Holding', pais: 'USA' },
  'BRK-B': { ticker: 'BRK-B', nombre: 'Berkshire Hathaway Inc.', tipo: 'cedear', mercado: 'BCBA', sector: 'Financial', subsector: 'Holding', pais: 'USA' },
  'DAL': { ticker: 'DAL', nombre: 'Delta Air Lines', tipo: 'cedear', mercado: 'BCBA', sector: 'Consumo', subsector: 'Aerolíneas', pais: 'USA' },
  'EWY': { ticker: 'EWY', nombre: 'iShares MSCI South Korea ETF', tipo: 'cedear', mercado: 'BCBA', sector: 'Index Fund', subsector: 'ETF Internacional', pais: 'Corea del Sur' },
  'AMZN': { ticker: 'AMZN', nombre: 'Amazon.com Inc.', tipo: 'cedear', mercado: 'BCBA', sector: 'Tech', subsector: 'E-commerce', pais: 'USA' },
  'GOOGL': { ticker: 'GOOGL', nombre: 'Alphabet Inc. (Google)', tipo: 'cedear', mercado: 'BCBA', sector: 'Tech', subsector: 'Internet', pais: 'USA' },
  'META': { ticker: 'META', nombre: 'Meta Platforms Inc.', tipo: 'cedear', mercado: 'BCBA', sector: 'Tech', subsector: 'Internet', pais: 'USA' },
  'TSLA': { ticker: 'TSLA', nombre: 'Tesla Inc.', tipo: 'cedear', mercado: 'BCBA', sector: 'Tech', subsector: 'Automotriz', pais: 'USA' },
  'MELI': { ticker: 'MELI', nombre: 'MercadoLibre Inc.', tipo: 'cedear', mercado: 'BCBA', sector: 'Servicios IT', subsector: 'E-commerce', pais: 'Uruguay' },
  'SPY': { ticker: 'SPY', nombre: 'SPDR S&P 500 ETF Trust', tipo: 'cedear', mercado: 'BCBA', sector: 'Index Fund', subsector: 'ETF US', pais: 'USA' },
  'QQQ': { ticker: 'QQQ', nombre: 'Invesco QQQ Trust (Nasdaq-100)', tipo: 'cedear', mercado: 'BCBA', sector: 'Index Fund', subsector: 'ETF US', pais: 'USA' },
  'IWM': { ticker: 'IWM', nombre: 'iShares Russell 2000 ETF', tipo: 'cedear', mercado: 'BCBA', sector: 'Index Fund', subsector: 'ETF US', pais: 'USA' },
  'EEM': { ticker: 'EEM', nombre: 'iShares MSCI Emerging Markets ETF', tipo: 'cedear', mercado: 'BCBA', sector: 'Index Fund', subsector: 'ETF US', pais: 'Global' },
  'KO': { ticker: 'KO', nombre: 'The Coca-Cola Company', tipo: 'cedear', mercado: 'BCBA', sector: 'Consumo', subsector: 'Alimentos', pais: 'USA' },
  'PEP': { ticker: 'PEP', nombre: 'PepsiCo Inc.', tipo: 'cedear', mercado: 'BCBA', sector: 'Consumo', subsector: 'Alimentos', pais: 'USA' },
  'JNJ': { ticker: 'JNJ', nombre: 'Johnson & Johnson', tipo: 'cedear', mercado: 'BCBA', sector: 'Consumo', subsector: 'Farmacia', pais: 'USA' },
  'PFE': { ticker: 'PFE', nombre: 'Pfizer Inc.', tipo: 'cedear', mercado: 'BCBA', sector: 'Consumo', subsector: 'Farmacia', pais: 'USA' },
  'XOM': { ticker: 'XOM', nombre: 'Exxon Mobil Corporation', tipo: 'cedear', mercado: 'BCBA', sector: 'Energía', subsector: 'Petróleo y Gas', pais: 'USA' },
  'CVX': { ticker: 'CVX', nombre: 'Chevron Corporation', tipo: 'cedear', mercado: 'BCBA', sector: 'Energía', subsector: 'Petróleo y Gas', pais: 'USA' },
  'JPM': { ticker: 'JPM', nombre: 'JPMorgan Chase & Co.', tipo: 'cedear', mercado: 'BCBA', sector: 'Banking', subsector: 'Bancos', pais: 'USA' },
  'C': { ticker: 'C', nombre: 'Citigroup Inc.', tipo: 'cedear', mercado: 'BCBA', sector: 'Banking', subsector: 'Bancos', pais: 'USA' },
  'BAC': { ticker: 'BAC', nombre: 'Bank of America Corp.', tipo: 'cedear', mercado: 'BCBA', sector: 'Banking', subsector: 'Bancos', pais: 'USA' },
  'DIS': { ticker: 'DIS', nombre: 'The Walt Disney Company', tipo: 'cedear', mercado: 'BCBA', sector: 'Entretenimiento', subsector: 'Medios', pais: 'USA' },
  'NFLX': { ticker: 'NFLX', nombre: 'Netflix Inc.', tipo: 'cedear', mercado: 'BCBA', sector: 'Entretenimiento', subsector: 'Medios', pais: 'USA' },

  // Efectivo
  'ARS': { ticker: 'ARS', nombre: 'Pesos Argentinos', tipo: 'efectivo', mercado: 'BCBA', sector: 'Efectivo', subsector: 'Pesos Argentinos', pais: 'Argentina' },
  'AR$': { ticker: 'AR$', nombre: 'Pesos Argentinos', tipo: 'efectivo', mercado: 'BCBA', sector: 'Efectivo', subsector: 'Pesos Argentinos', pais: 'Argentina' },
  'USD': { ticker: 'USD', nombre: 'Dólares Estadounidenses', tipo: 'efectivo', mercado: 'NYSE', sector: 'Efectivo', subsector: 'Dólares', pais: 'USA' }
};

const ASSET_SECTOR_FALLBACK_MAP = {
  // Tech / Semiconductores
  'NVDA': { sector: 'Tech', subsector: 'Semiconductores' },
  'MU': { sector: 'Tech', subsector: 'Semiconductores' },
  'AMD': { sector: 'Tech', subsector: 'Semiconductores' },
  'ASML': { sector: 'Tech', subsector: 'Semiconductores' },
  'MRVL': { sector: 'Tech', subsector: 'Semiconductores' },
  'TSM': { sector: 'Tech', subsector: 'Semiconductores' },
  'AVGO': { sector: 'Tech', subsector: 'Semiconductores' },
  'SMH': { sector: 'Tech', subsector: 'Semiconductores' },
  'LRCX': { sector: 'Tech', subsector: 'Semiconductores' },
  'INTC': { sector: 'Tech', subsector: 'Semiconductores' },
  'ARM': { sector: 'Tech', subsector: 'Semiconductores' },
  'QCOM': { sector: 'Tech', subsector: 'Semiconductores' },

  // Tech / Memorias & Hardware
  'SNDK': { sector: 'Tech', subsector: 'Memorias' },
  'SKHY': { sector: 'Tech', subsector: 'Memorias' },
  'DELL': { sector: 'Tech', subsector: 'Hardware' },
  'HPE': { sector: 'Tech', subsector: 'Infraestructura' },
  'GLW': { sector: 'Tech', subsector: 'Infraestructura' },
  'IBM': { sector: 'Tech', subsector: 'Hardware' },
  'AAPL': { sector: 'Tech', subsector: 'Hardware' },

  // Tech / Software & Cloud
  'MSFT': { sector: 'Tech', subsector: 'Software' },
  'ORCL': { sector: 'Tech', subsector: 'Software' },
  'PLTR': { sector: 'Tech', subsector: 'Software' },
  'SNOW': { sector: 'Tech', subsector: 'Software' },
  'NOW': { sector: 'Tech', subsector: 'Software' },
  'CRM': { sector: 'Tech', subsector: 'Software' },
  'ADBE': { sector: 'Tech', subsector: 'Software' },
  'GLOB': { sector: 'Servicios IT', subsector: 'Software' },
  'SHOP': { sector: 'Tech', subsector: 'Software' },
  'CRWD': { sector: 'Tech', subsector: 'Cyberseguridad' },
  'PANW': { sector: 'Tech', subsector: 'Cyberseguridad' },
  'FTNT': { sector: 'Tech', subsector: 'Cyberseguridad' },

  // Tech / Internet & E-commerce
  'AMZN': { sector: 'Tech', subsector: 'E-commerce' },
  'MELI': { sector: 'Servicios IT', subsector: 'E-commerce' },
  'GOOGL': { sector: 'Tech', subsector: 'Internet' },
  'GOOG': { sector: 'Tech', subsector: 'Internet' },
  'META': { sector: 'Tech', subsector: 'Internet' },
  'TSLA': { sector: 'Tech', subsector: 'Automotriz' },

  // Energía
  'OKLO': { sector: 'Energía', subsector: 'Nuclear' },
  'CEG': { sector: 'Energía', subsector: 'Eléctrica' },
  'VST': { sector: 'Energía', subsector: 'Electricidad' },
  'VIST': { sector: 'Energía', subsector: 'Petróleo y Gas' },
  'YPFD': { sector: 'Energía', subsector: 'Petróleo y Gas' },
  'YPF': { sector: 'Energía', subsector: 'Petróleo y Gas' },
  'PAMP': { sector: 'Energía', subsector: 'Energía Integrada' },
  'PAM': { sector: 'Energía', subsector: 'Energía Integrada' },
  'XOM': { sector: 'Energía', subsector: 'Petróleo y Gas' },
  'CVX': { sector: 'Energía', subsector: 'Petróleo y Gas' },
  'PBR': { sector: 'Energía', subsector: 'Petróleo y Gas' },
  'GPRK': { sector: 'Energía', subsector: 'Petróleo y Gas' },
  'ICLN': { sector: 'Energía', subsector: 'Renovable' },
  'NEE': { sector: 'Energía', subsector: 'Renovable' },
  'XLE': { sector: 'Energía', subsector: 'Energía' },
  'URA': { sector: 'Energía', subsector: 'Uranio' },
  'XLU': { sector: 'Energía', subsector: 'Utilities' },

  // Banking & Financials
  'BMA': { sector: 'Banking', subsector: 'Bancos' },
  'GGAL': { sector: 'Banking', subsector: 'Bancos' },
  'BBAR': { sector: 'Banking', subsector: 'Bancos' },
  'SUPV': { sector: 'Banking', subsector: 'Bancos' },
  'JPM': { sector: 'Banking', subsector: 'Bancos' },
  'BAC': { sector: 'Banking', subsector: 'Bancos' },
  'C': { sector: 'Banking', subsector: 'Bancos' },
  'WFC': { sector: 'Banking', subsector: 'Bancos' },
  'ITUB': { sector: 'Banking', subsector: 'Bancos' },
  'BBD': { sector: 'Banking', subsector: 'Bancos' },
  'NU': { sector: 'Banking', subsector: 'Fintech' },
  'SOFI': { sector: 'Banking', subsector: 'Fintech' },
  'CHYM': { sector: 'Banking', subsector: 'Fintech' },
  'PYPL': { sector: 'Tech', subsector: 'Fintech' },
  'HOOD': { sector: 'Financial', subsector: 'Banca de Inversión' },
  'MS': { sector: 'Financial', subsector: 'Banca de Inversión' },
  'GS': { sector: 'Financial', subsector: 'Banca de Inversión' },
  'BRKB': { sector: 'Financial', subsector: 'Holding' },
  'BRK-B': { sector: 'Financial', subsector: 'Holding' },

  // Minería & Materiales
  'MP': { sector: 'Minería', subsector: 'Tierras Raras' },
  'FCX': { sector: 'Minería', subsector: 'Metales' },
  'COPX': { sector: 'Minería', subsector: 'Cobre' },
  'ALUA': { sector: 'Minería', subsector: 'Aluminio' },
  'TXAR': { sector: 'Minería', subsector: 'Acero' },
  'RIO': { sector: 'Minería', subsector: 'Aluminio' },
  'VALE': { sector: 'Minería', subsector: 'Metales' },
  'LAC': { sector: 'Minería', subsector: 'Litio' },
  'CCJ': { sector: 'Minería', subsector: 'Uranio' },

  // Index Fund / ETFs
  'EWY': { sector: 'Index Fund', subsector: 'ETF Internacional' },
  'SPY': { sector: 'Index Fund', subsector: 'ETF US' },
  'QQQ': { sector: 'Index Fund', subsector: 'ETF US' },
  'IWM': { sector: 'Index Fund', subsector: 'ETF US' },
  'EEM': { sector: 'Index Fund', subsector: 'ETF US' },

  // Consumo & Entretenimiento
  'DAL': { sector: 'Consumo', subsector: 'Aerolíneas' },
  'ARCO': { sector: 'Consumo', subsector: 'Alimentos' },
  'KO': { sector: 'Consumo', subsector: 'Alimentos' },
  'PEP': { sector: 'Consumo', subsector: 'Alimentos' },
  'MCD': { sector: 'Consumo', subsector: 'Alimentos' },
  'JNJ': { sector: 'Consumo', subsector: 'Farmacia' },
  'PFE': { sector: 'Consumo', subsector: 'Farmacia' },
  'LLY': { sector: 'Consumo', subsector: 'Farmacia' },
  'DIS': { sector: 'Entretenimiento', subsector: 'Medios' },
  'NFLX': { sector: 'Entretenimiento', subsector: 'Medios' },

  // Crypto
  'IBIT': { sector: 'Crypto', subsector: 'Bitcoin' },
  'MSTR': { sector: 'Crypto', subsector: 'Bitcoin' },
  'BTC-USD': { sector: 'Crypto', subsector: 'Bitcoin' },
  'ETH-USD': { sector: 'Crypto', subsector: 'Criptomoneda' },

  // Cash / Liquidez
  'ARS': { sector: 'Efectivo', subsector: 'Pesos Argentinos' },
  'AR$': { sector: 'Efectivo', subsector: 'Pesos Argentinos' },
  'USD': { sector: 'Efectivo', subsector: 'Dólares' }
};

export function getAssetSectorAndSubsector(ticker, tipo, catalogInfo = {}) {
  const raw = (ticker || '').toUpperCase().trim();
  const norm = raw === 'AR$' ? 'ARS' : raw === 'BRK-B' ? 'BRKB' : raw;

  // 1. Check catalogInfo explicit sector (if valid and not 'Otros')
  if (catalogInfo.sector && catalogInfo.sector.trim() !== '' && catalogInfo.sector !== 'Otros') {
    return {
      sector: catalogInfo.sector,
      subsector: catalogInfo.subsector || catalogInfo.sector
    };
  }

  // 2. Cash / Liquidez
  if (tipo === 'efectivo' || norm === 'ARS' || norm === 'USD' || norm === 'AR$') {
    return {
      sector: 'Efectivo',
      subsector: norm === 'USD' ? 'Dólares' : 'Pesos Argentinos'
    };
  }

  // 3. Fallback dictionary map
  if (ASSET_SECTOR_FALLBACK_MAP[norm]) {
    return ASSET_SECTOR_FALLBACK_MAP[norm];
  }
  if (ASSET_SECTOR_FALLBACK_MAP[raw]) {
    return ASSET_SECTOR_FALLBACK_MAP[raw];
  }

  // 4. Bonds / Renta Fija
  if (tipo === 'bono' || norm.startsWith('AL') || norm.startsWith('GD') || norm.startsWith('AE') || norm.startsWith('T2X') || norm.startsWith('TX') || norm.startsWith('S3') || norm.startsWith('S2') || norm.startsWith('T3') || norm.startsWith('TV')) {
    if (norm.startsWith('AL') || norm.startsWith('AE')) return { sector: 'Renta Fija Soberana', subsector: 'Bonos USD Ley Argentina' };
    if (norm.startsWith('GD')) return { sector: 'Renta Fija Soberana', subsector: 'Bonos Globales USD Ley NY' };
    if (norm.startsWith('T2X') || norm.startsWith('TX')) return { sector: 'Renta Fija Soberana', subsector: 'Bonos CER / Inflación' };
    if (norm.startsWith('S3') || norm.startsWith('S2') || norm.startsWith('T3')) return { sector: 'Renta Fija Soberana', subsector: 'Bonos Pesos / LECAPs' };
    if (norm.startsWith('TV') || norm.startsWith('T2V')) return { sector: 'Renta Fija Soberana', subsector: 'Bonos Dólar Linked' };
    if (norm.endsWith('O') || norm.startsWith('BP')) return { sector: 'Renta Fija Corporativa', subsector: 'Obligaciones Negociables' };
    return { sector: 'Renta Fija Soberana', subsector: 'Bonos Soberanos' };
  }

  return {
    sector: 'Otros',
    subsector: 'Otros'
  };
}

const fmt = (n, dec = 2) => {
  if (n == null || isNaN(n)) return '—';
  return new Intl.NumberFormat('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n);
};

const fmtPct = (n) => {
  if (n == null || isNaN(n)) return '—';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${fmt(n, 2)}%`;
};



function PieChart({ data, title, twoColumns = false, forceSingleColumn = false }) {
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

  const is2ColLegend = !forceSingleColumn && (twoColumns || data.length > 6);
  const svgSize = is2ColLegend ? 180 : 160;
  const cx = svgSize / 2;
  const cy = svgSize / 2;
  const r = is2ColLegend ? 76 : 68;
  const innerR = is2ColLegend ? 40 : 36;

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
    <div className={`pie-chart-wrapper ${is2ColLegend ? 'pie-chart-wrapper--wide' : ''}`}>
      <div className="pie-chart-title">{title}</div>
      <div className={`pie-chart-body ${is2ColLegend ? 'pie-chart-body--2col' : ''}`}>
        <svg viewBox={`0 0 ${svgSize} ${svgSize}`} width={svgSize} height={svgSize} style={{ flexShrink: 0 }}>
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
              transform={hovered === i ? `translate(${Math.cos(s.midAngle) * 5},${Math.sin(s.midAngle) * 5})` : ''}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
          {/* Inner hole */}
          <circle cx={cx} cy={cy} r={innerR} fill="rgba(15,17,25,0.9)" style={{ pointerEvents: 'none' }} />
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
        <ul className={`pie-legend ${is2ColLegend ? 'pie-legend--2col' : ''}`}>
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
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [analyzeError, setAnalyzeError] = React.useState(null);
  const [analyzeResult, setAnalyzeResult] = React.useState(null);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setAnalyzeError(null);
    try {
      const dailyChange = data.changePct !== undefined ? data.changePct : 0;
      const res = await analyzeMovement(ticker, dailyChange);
      setAnalyzeResult(res);
    } catch (err) {
      setAnalyzeError(err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

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

      {/* AI Analysis Section */}
      <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h4 style={{ margin: 0, fontSize: '14px', color: 'var(--text-main)' }}>Análisis de Mercado con IA</h4>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Explica los drivers detrás de los movimientos recientes.</div>
          </div>
          <button 
            className="btn btn-primary" 
            style={{ background: 'linear-gradient(90deg, #6366f1, #a855f7)', border: 'none', color: '#fff', padding: '8px 16px', fontWeight: '600' }}
            onClick={handleAnalyze} 
            disabled={isAnalyzing}
          >
            {isAnalyzing ? '⏳ Analizando...' : '✨ Analizar Movimiento'}
          </button>
        </div>

        {analyzeError && (
          <div className="empty-state" style={{ color: 'var(--negative)', padding: '1rem', marginTop: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px' }}>
            {analyzeError}
          </div>
        )}

        {analyzeResult && (
          <div className="glass-panel" style={{ marginTop: '1.5rem', borderColor: 'var(--accent)', background: 'rgba(99, 102, 241, 0.05)', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '10px' }}>
              <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>🧠</span> Resumen Ejecutivo
              </h4>
              <div style={{ display: 'flex', gap: '8px' }}>
                <span className={`badge ${analyzeResult.nivel_certeza === 'Alta' ? 'badge-compra' : analyzeResult.nivel_certeza === 'Media' ? 'badge-bono' : 'badge-venta'}`}>
                  Certeza: {analyzeResult.nivel_certeza}
                </span>
                <span className="badge badge-accion">Catalizador: {analyzeResult.catalizador_principal}</span>
              </div>
            </div>
            
            <p style={{ fontSize: '14px', lineHeight: '1.6', marginBottom: '1.25rem' }}>
              {analyzeResult.resumen_ejecutivo}
            </p>

            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px', fontWeight: '600' }}>
                Factores Clave Identificados
              </div>
              <ul style={{ paddingLeft: '20px', fontSize: '13px', color: 'var(--text-main)', lineHeight: '1.6', margin: 0 }}>
                {analyzeResult.factores_clave?.map((factor, i) => (
                  <li key={i} style={{ marginBottom: '6px' }}>{factor}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
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

// --- LOCALSTORAGE UTILITIES & SAFETY ---
function safeSetItem(key, value) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const stringVal = typeof value === 'string' ? value : JSON.stringify(value);
    localStorage.setItem(key, stringVal);
  } catch (err) {
    console.warn(`[localStorage] Failed to save key "${key}":`, err);
    if (err && (err.name === 'QuotaExceededError' || err.code === 22 || err.code === 1014)) {
      try {
        localStorage.removeItem('cached_stats');
        localStorage.removeItem('cached_prices');
        if (key !== 'cached_stats' && key !== 'cached_prices') {
          const stringVal = typeof value === 'string' ? value : JSON.stringify(value);
          localStorage.setItem(key, stringVal);
        }
      } catch (retryErr) {
        console.error(`[localStorage] Critical: Storage full, could not save "${key}":`, retryErr);
      }
    }
  }
}

function sanitizeStatsForStorage(statsObj) {
  if (!statsObj || typeof statsObj !== 'object') return {};
  const cleanObj = {};
  for (const [key, val] of Object.entries(statsObj)) {
    if (!val || typeof val !== 'object') continue;
    const { history, timestamps, ...rest } = val;
    cleanObj[key] = rest;
  }
  return cleanObj;
}

function calculatePortfolioFlujos(flujosList, currentMep) {
  let totalIngresosUSD = 0;
  let totalExtraccionesUSD = 0;
  let totalIngresosARS = 0;
  let totalExtraccionesARS = 0;

  const mep = currentMep || 1;

  (flujosList || []).forEach(f => {
    const fMonto = parseFloat(f.monto) || 0;
    const fCotiz = parseFloat(f.cotizacion) || mep;

    let usdVal = fMonto;
    let arsVal = fMonto;

    if (f.moneda === 'ARS') {
      usdVal = fMonto / fCotiz;
      arsVal = fMonto;
    } else {
      usdVal = fMonto;
      arsVal = fMonto * fCotiz;
    }

    if (f.tipo === 'ingreso') {
      totalIngresosUSD += usdVal;
      totalIngresosARS += arsVal;
    } else {
      totalExtraccionesUSD += usdVal;
      totalExtraccionesARS += arsVal;
    }
  });

  const netFondeoUSD = totalIngresosUSD - totalExtraccionesUSD;
  const netFondeoARS = totalIngresosARS - totalExtraccionesARS;

  return {
    totalIngresosUSD,
    totalExtraccionesUSD,
    netFondeoUSD,
    totalIngresosARS,
    totalExtraccionesARS,
    netFondeoARS
  };
}

// --- MIGRATION TO PORTFOLIO NAMES AS IDS ---
function migratePortfoliosToNames() {
  try {
    const portfoliosStr = localStorage.getItem('portfolios_list');
    if (!portfoliosStr) return; // Nothing to migrate or default will be set
    const portfolios = JSON.parse(portfoliosStr);
    
    // Check if there is any portfolio with id !== name
    const needsMigration = portfolios.some(p => p.id !== p.name);
    if (!needsMigration) return;
    
    // Build ID to Name map
    const idToNameMap = {};
    const migratedPortfolios = portfolios.map(p => {
      const name = p.name ? p.name.trim() : 'Mi Portfolio Principal';
      idToNameMap[p.id] = name;
      return { id: name, name: name };
    });
    
    // Migrate current portfolio ID
    const currentId = localStorage.getItem('current_portfolio_id') || 'default';
    const newCurrentId = idToNameMap[currentId] || currentId;
    safeSetItem('current_portfolio_id', newCurrentId);
    
    // Helper to migrate keys in object
    const migrateObjectKeys = (localStorageKey) => {
      const dataStr = localStorage.getItem(localStorageKey);
      if (!dataStr) return;
      try {
        const data = JSON.parse(dataStr);
        const newData = {};
        for (const [oldId, val] of Object.entries(data)) {
          const newId = idToNameMap[oldId] || oldId;
          // Merge if newId already exists (unlikely, but safe)
          if (newData[newId]) {
            newData[newId] = [...newData[newId], ...val];
          } else {
            newData[newId] = val;
          }
        }
        safeSetItem(localStorageKey, newData);
      } catch (err) {
        console.error(`Error migrating ${localStorageKey}:`, err);
      }
    };
    
    migrateObjectKeys('all_holdings');
    migrateObjectKeys('all_operaciones');
    migrateObjectKeys('all_trades');
    migrateObjectKeys('all_evals');
    migrateObjectKeys('all_flujos');
    
    // Save updated portfolios list
    safeSetItem('portfolios_list', migratedPortfolios);
    console.log("Migration to portfolio names completed successfully!");
  } catch (e) {
    console.error("Error during portfolio migration:", e);
  }
}
// Execute migration immediately on script load
if (typeof window !== 'undefined' && window.localStorage) {
  migratePortfoliosToNames();
}

function App() {
  const [activeTab, setActiveTab] = useState('portfolio'); // 'portfolio', 'operaciones', 'watchlist', 'trades'

  const [portfolios, setPortfolios] = useState(() => JSON.parse(localStorage.getItem('portfolios_list') || '[{"id":"Mi Portfolio Principal","name":"Mi Portfolio Principal"}]'));
  const [currentPortfolioId, setCurrentPortfolioId] = useState(() => localStorage.getItem('current_portfolio_id') || 'Mi Portfolio Principal');

  const [allHoldings, setAllHoldings] = useState(() => {
    const existing = localStorage.getItem('all_holdings');
    if (existing) return JSON.parse(existing);
    return { "Mi Portfolio Principal": JSON.parse(localStorage.getItem('portfolio_holdings') || '[]') };
  });
  const holdings = allHoldings[currentPortfolioId] || [];
  const setHoldings = (val) => setAllHoldings(prev => ({ ...prev, [currentPortfolioId]: typeof val === 'function' ? val(prev[currentPortfolioId] || []) : val }));

  const [allOperaciones, setAllOperaciones] = useState(() => {
    const existing = localStorage.getItem('all_operaciones');
    if (existing) return JSON.parse(existing);
    return { "Mi Portfolio Principal": JSON.parse(localStorage.getItem('portfolio_operaciones') || '[]') };
  });
  const operaciones = allOperaciones[currentPortfolioId] || [];
  const setOperaciones = (val) => setAllOperaciones(prev => ({ ...prev, [currentPortfolioId]: typeof val === 'function' ? val(prev[currentPortfolioId] || []) : val }));

  const [allTrades, setAllTrades] = useState(() => {
    const existing = localStorage.getItem('all_trades');
    if (existing) return JSON.parse(existing);
    return { "Mi Portfolio Principal": JSON.parse(localStorage.getItem('portfolio_trades') || '[]') };
  });
  const trades = allTrades[currentPortfolioId] || [];
  const setTrades = (val) => setAllTrades(prev => ({ ...prev, [currentPortfolioId]: typeof val === 'function' ? val(prev[currentPortfolioId] || []) : val }));

  const [allEvals, setAllEvals] = useState(() => {
    const existing = localStorage.getItem('all_evals');
    if (existing) return JSON.parse(existing);
    return { "Mi Portfolio Principal": JSON.parse(localStorage.getItem('portfolio_evals') || '[]') };
  });
  const rawEvals = allEvals[currentPortfolioId] || [];
  const evals = useMemo(() => {
    const list = rawEvals.map(ev => {
      if (Array.isArray(ev.opIds)) return ev;
      return {
        id: ev.id || Date.now().toString(),
        nombre: ev.nombre || `Evaluación: ${ev.ticker || 'Operación'} (${(ev.tipo || '').toUpperCase()})`,
        fecha: ev.fecha || new Date().toISOString().split('T')[0],
        notas: '',
        opIds: ev.opId ? [ev.opId] : (ev.id ? [ev.id] : []),
        excluded: !!ev.excluded
      };
    });
    return list.sort((a, b) => {
      const dateA = a.fecha || '';
      const dateB = b.fecha || '';
      if (dateA !== dateB) {
        return dateB.localeCompare(dateA);
      }
      return String(b.id || '').localeCompare(String(a.id || ''));
    });
  }, [rawEvals]);
  const setEvals = (val) => setAllEvals(prev => ({ ...prev, [currentPortfolioId]: typeof val === 'function' ? val(prev[currentPortfolioId] || []) : val }));


  const [allFlujos, setAllFlujos] = useState(() => {
    const existing = localStorage.getItem('all_flujos');
    if (existing) return JSON.parse(existing);
    return { "Mi Portfolio Principal": JSON.parse(localStorage.getItem('portfolio_flujos') || '[]') };
  });
  const flujos = allFlujos[currentPortfolioId] || [];
  const setFlujos = (val) => setAllFlujos(prev => ({ ...prev, [currentPortfolioId]: typeof val === 'function' ? val(prev[currentPortfolioId] || []) : val }));

  const [allLiquidaciones, setAllLiquidaciones] = useState(() => {
    const existing = localStorage.getItem('all_liquidaciones');
    if (existing) return JSON.parse(existing);
    return {};
  });

  const [watchlist, setWatchlist] = useState(() => {
    const raw = JSON.parse(localStorage.getItem('portfolio_watchlist') || '[]');
    return sanitizeWatchlist(raw);
  });

  const [prices, setPrices] = useState(() => JSON.parse(localStorage.getItem('cached_prices') || '{}'));
  const [dailyStats, setDailyStats] = useState(() => JSON.parse(localStorage.getItem('cached_stats') || '{}'));
  const [dolarMep, setDolarMep] = useState(() => {
    const cached = localStorage.getItem('cached_dolar_mep');
    return cached ? JSON.parse(cached) : null;
  });
  const [dolarMepPrev, setDolarMepPrev] = useState(() => {
    const cached = localStorage.getItem('cached_dolar_mep_prev');
    return cached ? JSON.parse(cached) : null;
  });
  const [dolarCcl, setDolarCcl] = useState(() => {
    const cached = localStorage.getItem('cached_dolar_ccl');
    return cached ? JSON.parse(cached) : null;
  });

  const [status, setStatus] = useState('loading'); // 'loading', 'ok', 'error'
  const [statusText, setStatusText] = useState('Cargando precios...');

  // UI State for collapsibles
  const [showAddHolding, setShowAddHolding] = useState(false);
  const [showAddOp, setShowAddOp] = useState(false);
  const [showAddWatchlist, setShowAddWatchlist] = useState(false);
  const [wlPortfolioOnly, setWlPortfolioOnly] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddTrade, setShowAddTrade] = useState(false);
  const [showAddEval, setShowAddEval] = useState(false);
  const [expandedTicker, setExpandedTicker] = useState(null); // Ticker of the expanded row in Watchlist/Portfolio
  const [holdingsSort, setHoldingsSort] = useState('default'); // 'default', 'alpha', 'pct', 'pnlA', 'pnlP'

  // Trade & Evaluation form state
  const [tradeCompraId, setTradeCompraId] = useState('');
  const [tradeVentaId, setTradeVentaId] = useState('');
  const [tradeSelectedCompraIds, setTradeSelectedCompraIds] = useState([]);
  const [tradeSelectedVentaIds, setTradeSelectedVentaIds] = useState([]);
  const [tradeTickerFilter, setTradeTickerFilter] = useState('');
  const [searchCompraQuery, setSearchCompraQuery] = useState('');
  const [searchVentaQuery, setSearchVentaQuery] = useState('');
  const [searchTrades, setSearchTrades] = useState('');
  const [tradesSortOrder, setTradesSortOrder] = useState('dateDesc');
  const [editingTradeId, setEditingTradeId] = useState(null);
  const [expandedTradeIds, setExpandedTradeIds] = useState([]);
  const [evalNombre, setEvalNombre] = useState('');
  const [evalFecha, setEvalFecha] = useState('');
  const [evalNotas, setEvalNotas] = useState('');
  const [evalSelectedOpIds, setEvalSelectedOpIds] = useState([]);
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [evalOpSearch, setEvalOpSearch] = useState('');


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
  const [editingOpId, setEditingOpId] = useState(null);
  const [searchOpTicker, setSearchOpTicker] = useState('');

  const [editingHoldingOriginal, setEditingHoldingOriginal] = useState(null);
  const [registerPartialSale, setRegisterPartialSale] = useState(false);
  const [partialSalePrice, setPartialSalePrice] = useState('');
  const [registerPurchase, setRegisterPurchase] = useState(true);
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [purchasePrice, setPurchasePrice] = useState('');
  
  const [holdingToDelete, setHoldingToDelete] = useState(null);
  const [sellPriceForDelete, setSellPriceForDelete] = useState('');

  const [editingWatchlistOriginal, setEditingWatchlistOriginal] = useState(null);
  const [wlTicker, setWlTicker] = useState('');
  const [wlTipo, setWlTipo] = useState('accion');
  const [wlMercado, setWlMercado] = useState('BCBA');
  const [wlNombre, setWlNombre] = useState('');
  const [wlSector, setWlSector] = useState('');
  const [wlSubsector, setWlSubsector] = useState('');
  const [wlPais, setWlPais] = useState('');
  const [wlTypeFilters, setWlTypeFilters] = useState([]);
  const [wlSectorFilters, setWlSectorFilters] = useState([]);

  // Dynamic & Custom Ticker Catalog
  const [customTickers, setCustomTickers] = useState(() => JSON.parse(localStorage.getItem('custom_ticker_dictionary') || '{}'));

  const saveCustomTicker = (info) => {
    if (!info || !info.ticker) return;
    const t = info.ticker.trim().toUpperCase();
    if (!t) return;
    setCustomTickers(prev => {
      const existing = prev[t] || {};
      const updated = {
        ticker: t,
        nombre: info.nombre !== undefined && info.nombre !== '' ? info.nombre : (existing.nombre || ''),
        tipo: info.tipo || existing.tipo || 'accion',
        mercado: info.mercado || existing.mercado || 'BCBA',
        sector: info.sector || existing.sector || '',
        subsector: info.subsector || existing.subsector || '',
        pais: info.pais || existing.pais || ''
      };
      const next = { ...prev, [t]: updated };
      safeSetItem('custom_ticker_dictionary', next);
      return next;
    });
  };

  const tickerCatalog = useMemo(() => {
    const catalog = { ...SEED_TICKER_CATALOG };

    const mergeItem = (rawT, item) => {
      if (!rawT || !item) return;
      const key = rawT.trim().toUpperCase();
      const existing = catalog[key] || {};
      const fallback = getAssetSectorAndSubsector(key, item.tipo || existing.tipo, item);
      catalog[key] = {
        ticker: key,
        nombre: item.nombre || existing.nombre || '',
        tipo: item.tipo || existing.tipo || 'accion',
        mercado: item.mercado || existing.mercado || 'BCBA',
        sector: item.sector && item.sector.trim() !== '' && item.sector !== 'Otros' ? item.sector : (existing.sector || fallback.sector),
        subsector: item.subsector && item.subsector.trim() !== '' && item.subsector !== 'Otros' ? item.subsector : (existing.subsector || fallback.subsector),
        pais: item.pais || existing.pais || ''
      };
    };

    // Merge holdings
    Object.values(allHoldings).forEach(holdingsList => {
      if (Array.isArray(holdingsList)) {
        holdingsList.forEach(h => h && mergeItem(h.ticker, h));
      }
    });

    // Merge watchlist
    if (Array.isArray(watchlist)) {
      watchlist.forEach(w => w && mergeItem(w.ticker, w));
    }

    // Merge operations
    Object.values(allOperaciones).forEach(opList => {
      if (Array.isArray(opList)) {
        opList.forEach(op => op && mergeItem(op.ticker, { tipo: op.assetTipo }));
      }
    });

    // Merge custom tickers
    Object.keys(customTickers).forEach(t => mergeItem(t, customTickers[t]));

    return catalog;
  }, [allHoldings, watchlist, allOperaciones, customTickers]);

  const handleNewTickerChange = (val) => {
    const upper = val.toUpperCase();
    setNewTicker(upper);
    const match = tickerCatalog[upper.trim()];
    if (match) {
      if (match.nombre) setNewNombre(match.nombre);
      if (match.tipo) setNewTipo(match.tipo);
      if (match.mercado) setNewMercado(match.mercado);
    }
  };

  const handleWlTickerChange = (val) => {
    const upper = val.toUpperCase();
    setWlTicker(upper);
    const match = tickerCatalog[upper.trim()];
    if (match) {
      if (match.nombre) setWlNombre(match.nombre);
      if (match.tipo) setWlTipo(match.tipo);
      if (match.mercado) setWlMercado(match.mercado);
      if (match.sector) setWlSector(match.sector);
      if (match.subsector) setWlSubsector(match.subsector);
      if (match.pais) setWlPais(match.pais);
    }
  };

  const handleOpTickerChange = (val) => {
    const upper = val.toUpperCase();
    setOpTicker(upper);
    const match = tickerCatalog[upper.trim()];
    if (match) {
      if (match.tipo) setOpAssetTipo(match.tipo);
    }
  };

  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [analyzeImageError, setAnalyzeImageError] = useState(null);

  const processImageFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) {
      setAnalyzeImageError('Por favor selecciona una imagen válida.');
      return;
    }
    setIsAnalyzingImage(true);
    setAnalyzeImageError(null);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64String = reader.result.split(',')[1];
          const data = await extractPortfolioDataFromImage(base64String, file.type);
          if (Array.isArray(data) && data.length > 0) {
            if (data.length === 1) {
              const item = data[0];
              if (item.ticker) setNewTicker(item.ticker);
              if (item.cantidad !== null && item.cantidad !== undefined) setNewCantidad(item.cantidad.toString());
              if (item.precio_promedio !== null && item.precio_promedio !== undefined) setNewPrecio(item.precio_promedio.toString());
              if (item.tipo) {
                let t = item.tipo.toLowerCase();
                if (t === 'acciones') t = 'accion';
                if (t === 'cedears') t = 'cedear';
                if (t === 'bonos') t = 'bono';
                if (['accion', 'cedear', 'bono'].includes(t)) setNewTipo(t);
              }
            } else {
              setHoldings(prev => {
                let newHoldings = [...prev];
                data.forEach(item => {
                  if (!item.ticker) return;
                  const ticker = item.ticker.trim().toUpperCase();
                  const cant = parseFloat(item.cantidad);
                  const prec = parseFloat(item.precio_promedio);
                  if (isNaN(cant) || isNaN(prec)) return;

                  const existingIndex = newHoldings.findIndex(h => h.ticker === ticker);
                  if (existingIndex !== -1) {
                    newHoldings[existingIndex] = { ...newHoldings[existingIndex], cantidad: cant, precioEntrada: prec };
                  } else {
                    let tipo = item.tipo ? item.tipo.toLowerCase() : 'accion';
                    if (tipo === 'acciones') tipo = 'accion';
                    if (tipo === 'cedears') tipo = 'cedear';
                    if (tipo === 'bonos') tipo = 'bono';
                    if (!['accion', 'cedear', 'bono', 'stock', 'efectivo'].includes(tipo)) tipo = 'accion';
                    
                    newHoldings.push({ ticker, tipo, mercado: 'BCBA', nombre: '', cantidad: cant, precioEntrada: prec });
                  }
                });
                return newHoldings;
              });
              alert(`¡Se detectaron e importaron/actualizaron ${data.length} activos correctamente!`);
              setShowAddHolding(false);
            }
          } else {
            throw new Error("No se detectó ningún activo en la imagen.");
          }
          setIsAnalyzingImage(false);
        } catch (err) {
          setAnalyzeImageError(err.message);
          setIsAnalyzingImage(false);
        }
      };
      reader.onerror = () => {
        setAnalyzeImageError('Error al leer la imagen.');
        setIsAnalyzingImage(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setAnalyzeImageError(err.message);
      setIsAnalyzingImage(false);
    }
  };

  const handlePasteCapture = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        processImageFile(file);
        e.preventDefault();
        break;
      }
    }
  };
  const [wlSubsectorFilters, setWlSubsectorFilters] = useState([]);
  const [wlPaisFilters, setWlPaisFilters] = useState([]);
  const [wlExcludedTickers, setWlExcludedTickers] = useState([]);

  const [importJson, setImportJson] = useState('');
  const [currencyMode, setCurrencyMode] = useState('ARS');

  const [showAddFlujo, setShowAddFlujo] = useState(false);
  const [flujoFecha, setFlujoFecha] = useState(new Date().toISOString().split('T')[0]);
  const [flujoTipo, setFlujoTipo] = useState('ingreso');
  const [flujoMoneda, setFlujoMoneda] = useState('ARS');
  const [flujoMonto, setFlujoMonto] = useState('');
  const [flujoCotizacion, setFlujoCotizacion] = useState('');
  const [flujoNota, setFlujoNota] = useState('');

  // Persist storage whenever collections change
  useEffect(() => {
    safeSetItem('all_holdings', allHoldings);
    safeSetItem('all_operaciones', allOperaciones);
    safeSetItem('all_trades', allTrades);
    safeSetItem('all_evals', allEvals);
    safeSetItem('all_flujos', allFlujos);
    safeSetItem('all_liquidaciones', allLiquidaciones);
    safeSetItem('portfolio_watchlist', sanitizeWatchlist(watchlist));
    safeSetItem('portfolios_list', portfolios);
    safeSetItem('current_portfolio_id', currentPortfolioId);
  }, [allHoldings, allOperaciones, allTrades, allEvals, allFlujos, allLiquidaciones, watchlist, portfolios, currentPortfolioId]);

  // Persist prices and exchange rates separately whenever they are successfully updated
  useEffect(() => {
    if (Object.keys(prices).length > 0) safeSetItem('cached_prices', prices);
    if (Object.keys(dailyStats).length > 0) safeSetItem('cached_stats', sanitizeStatsForStorage(dailyStats));
    if (dolarMep !== null) safeSetItem('cached_dolar_mep', dolarMep);
    if (dolarMepPrev !== null) safeSetItem('cached_dolar_mep_prev', dolarMepPrev);
    if (dolarCcl !== null) safeSetItem('cached_dolar_ccl', dolarCcl);
  }, [prices, dailyStats, dolarMep, dolarMepPrev, dolarCcl]);



  const formatLastUpdated = (stats) => {
    if (!stats) return '—';
    const timestamp = stats.updatedAt || (stats.regularMarketTime ? stats.regularMarketTime * 1000 : null);
    if (!timestamp) return '—';
    const d = new Date(timestamp);
    const now = new Date();
    const isToday = d.getDate() === now.getDate() &&
                    d.getMonth() === now.getMonth() &&
                    d.getFullYear() === now.getFullYear();
    const timeStr = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    if (isToday) return timeStr;
    const dateStr = d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
    return `${dateStr} ${timeStr}`;
  };

  const getYahooTicker = (h) => {
    if (h.tipo === 'efectivo') return null;
    let t = h.ticker.trim().toUpperCase();
    if (h.tipo === 'accion' || h.tipo === 'cedear') return t.endsWith('.BA') ? t : t + '.BA';
    if (h.tipo === 'stock') return t;
    return null;
  };

  const fetchWithTimeout = async (url, options = {}, timeoutMs = 8000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      return response;
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  };

  const fetchPrice = async (yahooTicker) => {
    try {
      const url5y = `/api/market/v8/finance/chart/${yahooTicker}?interval=1d&range=5y`;
      const url1d = `/api/market/v8/finance/chart/${yahooTicker}?interval=1d&range=1d`;

      const [r5y, r1d] = await Promise.all([
        fetchWithTimeout(url5y, {}, 8000),
        fetchWithTimeout(url1d, {}, 8000)
      ]);

      if (!r5y.ok || !r1d.ok) {
        console.warn(`Yahoo response not ok for ${yahooTicker}: r5y=${r5y.status}, r1d=${r1d.status}`);
        return null;
      }

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

      return { price, change, changePct, hist5d, hist1m, hist6m, hist1y, hist5y, isOpen, regularMarketTime, history: closes, timestamps, prevClose };
    } catch (e) {
      console.warn("fetchPrice failed for", yahooTicker, e);
      return null;
    }
  };

  const [refreshPref, setRefreshPref] = useState(() => {
    return localStorage.getItem('refresh_preference') || 'ask'; // 'ask', 'current', 'all'
  });
  const [showRefreshModal, setShowRefreshModal] = useState(false);
  const [dontAskRefreshAgain, setDontAskRefreshAgain] = useState(false);

  const TAB_LABELS = {
    portfolio: 'Mi Portfolio',
    'multi-portfolio': 'Resumen Portfolios',
    flujos: 'Flujos de Caja',
    operaciones: 'Histórico de Operaciones',
    watchlist: 'Watchlist',
    mercados: 'Mercados & Índices Globales',
    insights: 'Insights',
    evaluacion: 'Evaluación de Cartera',
    trades: 'Trades',
    'api-dashboard': 'API Dashboard'
  };

  const [editingFlujoId, setEditingFlujoId] = useState(null);

  const refreshData = async (scope = 'all') => {
    setStatus('loading');
    setStatusText('Consultando mercado...');
    let hasError = false;
    let newPrices = { ...prices };
    let newStats = { ...dailyStats };

    const applyData = (ticker, data) => {
      newPrices[ticker] = data.price;
      newStats[ticker] = data;
    };

    try {
      let trackedItems = [];
      let shouldFetchIndices = scope === 'all' || activeTab === 'mercados';
      let shouldFetchOps = scope === 'all' || activeTab === 'operaciones';

      // Always track international proxy US counterparts so USD prices and variations are live
      const allProxyUsItems = (proxyAnalysis?.mapped || []).map(m => ({ ticker: m.usTicker, tipo: 'stock' }));

      if (scope === 'all') {
        const allHoldingsList = Object.values(allHoldings || {}).flat().filter(Boolean);
        const allOpsList = Object.values(allOperaciones || {}).flat().filter(Boolean).map(op => ({ ticker: op.ticker, tipo: op.assetTipo || 'accion' }));
        const allTradesList = Object.values(allTrades || {}).flat().filter(Boolean).map(t => ({ ticker: t.ticker || t.compraTicker, tipo: t.tipo || 'accion' }));
        trackedItems = [...allHoldingsList, ...watchlist, ...allOpsList, ...allTradesList, ...allProxyUsItems];
      } else {
        if (activeTab === 'watchlist') {
          trackedItems = [...watchlist, ...allProxyUsItems];
        } else if (activeTab === 'mercados') {
          trackedItems = [];
        } else if (activeTab === 'operaciones') {
          trackedItems = [...holdings, ...operaciones.map(op => ({ ticker: op.ticker, tipo: op.assetTipo || 'accion' }))];
        } else if (activeTab === 'trades') {
          trackedItems = [...holdings, ...trades.map(t => ({ ticker: t.ticker || t.compraTicker, tipo: t.tipo || 'accion' }))];
        } else {
          trackedItems = [...holdings, ...allProxyUsItems];
        }
      }

      // Fetch Data912 arg bonds live data
      let argBondsData = {};
      if (trackedItems.some(h => h.tipo === 'bono') || scope === 'all') {
        try {
          const bondsRes = await fetchWithTimeout('https://data912.com/live/arg_bonds', {}, 8000);
          if (bondsRes.ok) {
            const bondsArray = await bondsRes.json();
            if (Array.isArray(bondsArray)) {
              bondsArray.forEach(b => {
                if (b && b.symbol) argBondsData[b.symbol] = b;
              });
            }
          }
        } catch (e) {
          console.warn("Failed to fetch Data912 bonds:", e);
        }
      }

      // 1. Fetch trackedItems (holdings / watchlist / etc)
      const itemsToFetchYahoo = new Set();
      for (const h of trackedItems) {
        if (!h || !h.ticker) continue;
        if (h.tipo === 'bono') {
          const bondApiData = argBondsData[h.ticker];
          if (bondApiData) {
            const price = bondApiData.c / 100;
            const changePct = bondApiData.pct_change || 0;
            const prevClose = price / (1 + (changePct / 100));
            const change = price - prevClose;
            applyData(h.ticker, { price, change, changePct, isOpen: true });
          } else if (h.precioActual !== undefined) {
            applyData(h.ticker, { price: h.precioActual, change: 0, changePct: 0 });
          }
          continue;
        }
        const yt = getYahooTicker(h);
        if (yt) {
          itemsToFetchYahoo.add(yt);
        }
      }

      // Función auxiliar para procesar en lotes (chunks) paralelos
      const chunkArray = (array, size) => {
        const result = [];
        for (let i = 0; i < array.length; i += size) {
          result.push(array.slice(i, i + size));
        }
        return result;
      };

      const uniqueYahooTickers = Array.from(itemsToFetchYahoo);
      const tickerChunks = chunkArray(uniqueYahooTickers, 10);

      for (const chunk of tickerChunks) {
        await Promise.all(chunk.map(async (yt) => {
          const data = await fetchPrice(yt);
          if (data !== null) {
            applyData(yt, data);
          } else if (prices[yt]) {
            // If we have cached price, use it as fallback quietly
            newPrices[yt] = prices[yt];
          } else {
            hasError = true;
          }
        }));
      }

      // 1.5 Global Indices
      if (shouldFetchIndices) {
        const indicesToFetch = [...GLOBAL_INDICES.filter(i => !i.isCalculated).map(i => i.ticker)];
        if (GLOBAL_INDICES.some(i => i.ticker === 'MERVAL_USD')) {
          if (!indicesToFetch.includes('IMV.BA')) indicesToFetch.push('IMV.BA');
          if (!indicesToFetch.includes('^MERV')) indicesToFetch.push('^MERV');
        }
        
        await Promise.all(indicesToFetch.map(async (ticker) => {
          const data = await fetchPrice(ticker);
          if (data) applyData(ticker, data);
        }));
      }

      // 2. Fetch older operations not currently tracked manually
      if (shouldFetchOps) {
        const opsToFetch = new Set();
        for (const op of (operaciones || [])) {
          if (!op || !op.ticker) continue;
          const yt = getYahooTicker({ ticker: op.ticker, tipo: op.assetTipo || 'accion' });
          if (yt && newPrices[yt] === undefined) {
            opsToFetch.add(yt);
          }
        }

        const opsChunks = chunkArray(Array.from(opsToFetch), 10);
        for (const chunk of opsChunks) {
          await Promise.all(chunk.map(async (yt) => {
            const d1 = await fetchPrice(yt);
            if (d1 !== null) {
              applyData(yt, d1);
            } else if (prices[yt]) {
              newPrices[yt] = prices[yt];
            } else {
              hasError = true;
            }
          }));
        }
      }

      let fetchedDolarMep = null;
      try {
        const mepR = await fetchWithTimeout('https://dolarapi.com/v1/dolares/bolsa', {}, 8000);
        if (mepR.ok) {
          const mepD = await mepR.json();
          if (mepD && mepD.venta) {
            setDolarMep(mepD.venta);
            fetchedDolarMep = mepD.venta;
          }
        }

        const cclR = await fetchWithTimeout('https://dolarapi.com/v1/dolares/contadoconliqui', {}, 8000);
        if (cclR.ok) {
          const cclD = await cclR.json();
          if (cclD && cclD.venta) {
            setDolarCcl(cclD.venta);
            const mArs = newStats['IMV.BA'] || newStats['^MERV'];
            if (mArs) {
              applyData('MERVAL_USD', {
                ...mArs,
                price: mArs.price / cclD.venta,
                change: mArs.change / cclD.venta,
                history: (mArs.history || []).map(v => v ? v / cclD.venta : null)
              });
            }
          }
        }
      } catch (e) {
        console.warn('DolarAPI fetch error', e);
      }

      // Calculate implied Dolar MEP yesterday close using AL30/AL30D data912 or GGAL as fallback
      let mepPrevVal = null;
      let mepProxyTodayVal = null;
      try {
        const b_al30 = argBondsData['AL30'];
        const b_al30d = argBondsData['AL30D'];
        if (b_al30 && b_al30d && b_al30d.c > 0) {
          const al30_prev = b_al30.c / (1 + (b_al30.pct_change || 0) / 100);
          const al30d_prev = b_al30d.c / (1 + (b_al30d.pct_change || 0) / 100);
          if (al30d_prev > 0) {
            mepPrevVal = al30_prev / al30d_prev;
            mepProxyTodayVal = b_al30.c / b_al30d.c;
          }
        }
      } catch (e) {
        console.warn("Failed to fetch AL30 MEP proxy from data912:", e);
      }

      if (!mepPrevVal) {
        try {
          const [ggalAr, ggalUs] = await Promise.all([
            fetchPrice('GGAL.BA'),
            fetchPrice('GGAL')
          ]);
          if (ggalAr && ggalUs && ggalUs.prevClose > 0 && ggalUs.price > 0) {
            mepPrevVal = (ggalAr.prevClose / ggalUs.prevClose) * 10;
            mepProxyTodayVal = (ggalAr.price / ggalUs.price) * 10;
          }
        } catch (e) {
          console.warn("Failed to fetch GGAL MEP proxy:", e);
        }
      }

      if (mepPrevVal) {
        if (fetchedDolarMep && mepProxyTodayVal) {
          const ratio = mepPrevVal / mepProxyTodayVal;
          setDolarMepPrev(fetchedDolarMep * ratio);
        } else {
          setDolarMepPrev(mepPrevVal);
        }
      }

      setPrices(newPrices);
      setDailyStats(newStats);
    } catch (error) {
      console.error("Unhandled error during refreshData:", error);
      hasError = true;
    } finally {
      const ts = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
      setStatus(hasError ? 'error' : 'ok');
      const scopeLabel = scope === 'current' ? 'Vista actual' : 'Todo';
      setStatusText(`Actualizado (${scopeLabel}) ${ts}`);
    }
  };

  const refreshAll = () => refreshData('all');

  const handleRefreshClick = () => {
    if (refreshPref === 'current') {
      refreshData('current');
    } else if (refreshPref === 'all') {
      refreshData('all');
    } else {
      setShowRefreshModal(true);
    }
  };

  const executeRefreshChoice = (scope) => {
    setShowRefreshModal(false);
    if (dontAskRefreshAgain) {
      setRefreshPref(scope);
      safeSetItem('refresh_preference', scope);
    }
    refreshData(scope);
  };

  // Store the latest refreshAll to avoid stale closures in the interval
  const refreshAllRef = React.useRef(refreshAll);
  useEffect(() => {
    refreshAllRef.current = refreshAll;
  });

  // Fetch prices effect (1 vez por hora entre 11 y 19)
  useEffect(() => {
    const checkAndFetch = () => {
      const currentHour = new Date().getHours();
      if (currentHour >= 11 && currentHour <= 19) {
        refreshAllRef.current();
      }
    };

    checkAndFetch();
    const interval = setInterval(checkAndFetch, 60 * 60 * 1000); // 60 mins
    return () => clearInterval(interval);
  }, []);

  // --- HOLDINGS BUSINESS LOGIC ---
  const agregarHolding = () => {
    const ticker = newTicker.trim().toUpperCase();
    const cant = parseFloat(newCantidad);
    const prec = parseFloat(newPrecio);

    if (!ticker || isNaN(cant) || isNaN(prec)) return alert('Completá ticker, cantidad y precio.');

    let nPrices = { ...prices };
    const existingIndex = holdings.findIndex(h => h.ticker === ticker && h.mercado === newMercado);
    
    let opTicker = ticker;
    if ((newTipo === 'accion' || newTipo === 'cedear') && !opTicker.endsWith('.BA')) {
      opTicker = opTicker + '.BA';
    }
    const finalPurchasePrice = !isNaN(parseFloat(purchasePrice)) ? parseFloat(purchasePrice) : prec;
    const finalPurchaseDate = purchaseDate || new Date().toISOString().split('T')[0];

    if (existingIndex !== -1) {
      if (editingHoldingOriginal) {
        if (cant < editingHoldingOriginal.cantidad && registerPartialSale) {
          const diff = editingHoldingOriginal.cantidad - cant;
          const sp = parseFloat(partialSalePrice);
          if (!isNaN(sp)) {
            const op = { id: Date.now().toString(), ticker: opTicker, assetTipo: newTipo, tipo: 'venta', cantidad: diff, precio: sp, fecha: new Date().toISOString().split('T')[0] };
            setOperaciones(prev => [...prev, op]);
          }
        } else if (cant > editingHoldingOriginal.cantidad && registerPurchase) {
          const diff = cant - editingHoldingOriginal.cantidad;
          const op = { id: Date.now().toString(), ticker: opTicker, assetTipo: newTipo, tipo: 'compra', cantidad: diff, precio: finalPurchasePrice, fecha: finalPurchaseDate };
          setOperaciones(prev => [...prev, op]);
        }
      } else if (registerPurchase) {
        const op = { id: Date.now().toString(), ticker: opTicker, assetTipo: newTipo, tipo: 'compra', cantidad: cant, precio: finalPurchasePrice, fecha: finalPurchaseDate };
        setOperaciones(prev => [...prev, op]);
      }

      const newHoldings = [...holdings];
      newHoldings[existingIndex] = { ...newHoldings[existingIndex], cantidad: cant, precioEntrada: prec, nombre: newNombre.trim(), tipo: newTipo };
      if (newTipo === 'bono') {
        const pa = parseFloat(newPrecioActual);
        if (!isNaN(pa)) {
          newHoldings[existingIndex].precioActual = pa;
          nPrices[ticker] = pa;
        }
      }
      setHoldings(newHoldings);
    } else {
      if (registerPurchase) {
        const op = { id: Date.now().toString(), ticker: opTicker, assetTipo: newTipo, tipo: 'compra', cantidad: cant, precio: finalPurchasePrice, fecha: finalPurchaseDate };
        setOperaciones(prev => [...prev, op]);
      }

      const h = { ticker, tipo: newTipo, mercado: newMercado, nombre: newNombre.trim(), cantidad: cant, precioEntrada: prec };
      if (newTipo === 'bono') {
        const pa = parseFloat(newPrecioActual);
        if (!isNaN(pa)) {
          h.precioActual = pa;
          nPrices[ticker] = pa;
        }
      }
      setHoldings([...holdings, h]);
    }

    saveCustomTicker({ ticker, nombre: newNombre.trim(), tipo: newTipo, mercado: newMercado });
    setPrices(nPrices);
    setNewTicker(''); setNewNombre(''); setNewCantidad(''); setNewPrecio(''); setNewPrecioActual('');
    setEditingHoldingOriginal(null); setRegisterPartialSale(false); setPartialSalePrice('');
    setRegisterPurchase(true); setPurchaseDate(new Date().toISOString().split('T')[0]); setPurchasePrice('');
    setShowAddHolding(false);
  };

  const cargarEdicionHolding = (h) => {
    setEditingHoldingOriginal(h);
    setRegisterPartialSale(false);
    setPartialSalePrice('');
    setRegisterPurchase(true);
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setPurchasePrice('');
    setNewTicker(h.ticker);
    setNewTipo(h.tipo);
    setNewMercado(h.mercado);
    setNewNombre(h.nombre || '');
    setNewCantidad(h.cantidad);
    setNewPrecio(h.precioEntrada);
    if (h.tipo === 'bono' && h.precioActual !== undefined) setNewPrecioActual(h.precioActual);
    setShowAddHolding(true);
  };

  const requestEliminarHolding = (h) => {
    setHoldingToDelete(h);
    setSellPriceForDelete('');
  };

  const confirmEliminarHolding = (isVenta) => {
    if (!holdingToDelete) return;
    if (isVenta) {
      const sp = parseFloat(sellPriceForDelete);
      if (!isNaN(sp)) {
        const op = { id: Date.now().toString(), ticker: holdingToDelete.ticker, assetTipo: holdingToDelete.tipo, tipo: 'venta', cantidad: holdingToDelete.cantidad, precio: sp, fecha: new Date().toISOString().split('T')[0] };
        setOperaciones(prev => [...prev, op]);
      } else {
        alert('Ingresá un precio de venta válido.');
        return;
      }
    }
    setHoldings(holdings.filter(h => h.ticker !== holdingToDelete.ticker));
    setHoldingToDelete(null);
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
  const cargarEdicionWatchlist = (w) => {
    setEditingWatchlistOriginal(w);
    setWlTicker(w.ticker);
    setWlTipo(w.tipo || 'accion');
    setWlMercado(w.mercado || (w.tipo === 'stock' ? 'NYSE' : 'BCBA'));
    setWlNombre(w.nombre || '');
    setWlSector(w.sector || '');
    setWlSubsector(w.subsector || '');
    setWlPais(w.pais || '');
    setShowAddWatchlist(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelarEdicionWatchlist = () => {
    setEditingWatchlistOriginal(null);
    setWlTicker(''); setWlNombre(''); setWlSector(''); setWlSubsector(''); setWlPais('');
    setShowAddWatchlist(false);
  };

  const agregarWatchlist = () => {
    const ticker = cleanTickerSymbol(wlTicker);
    if (!ticker) return alert('Completá el ticker.');

    if (editingWatchlistOriginal) {
      const origKey = cleanTickerSymbol(editingWatchlistOriginal.ticker);
      const newKey = ticker;

      if (origKey !== newKey && watchlist.some(w => cleanTickerSymbol(w.ticker) === newKey)) {
        return alert('Ya existe otro activo en la watchlist con ese ticker.');
      }

      const updatedItem = {
        ...editingWatchlistOriginal,
        ticker,
        tipo: wlTipo,
        mercado: wlMercado,
        nombre: wlNombre.trim(),
        sector: wlSector.trim(),
        subsector: wlSubsector.trim(),
        pais: wlPais.trim()
      };

      saveCustomTicker({
        ticker,
        nombre: wlNombre.trim(),
        tipo: wlTipo,
        mercado: wlMercado,
        sector: wlSector.trim(),
        subsector: wlSubsector.trim(),
        pais: wlPais.trim()
      });

      setWatchlist(prev => sanitizeWatchlist(prev.map(w => (cleanTickerSymbol(w.ticker) === origKey ? updatedItem : w))));

      setEditingWatchlistOriginal(null);
      setWlTicker(''); setWlNombre(''); setWlSector(''); setWlSubsector(''); setWlPais('');
      setShowAddWatchlist(false);
      return;
    }

    if (watchlist.some(w => cleanTickerSymbol(w.ticker) === ticker)) {
      return alert('Ya está en la watchlist.');
    }

    const w = { ticker, tipo: wlTipo, mercado: wlMercado, nombre: wlNombre.trim(), sector: wlSector.trim(), subsector: wlSubsector.trim(), pais: wlPais.trim() };

    saveCustomTicker({ ticker, nombre: wlNombre.trim(), tipo: wlTipo, mercado: wlMercado, sector: wlSector.trim(), subsector: wlSubsector.trim(), pais: wlPais.trim() });
    setWatchlist(prev => sanitizeWatchlist([...prev, w]));
    setWlTicker(''); setWlNombre(''); setWlSector(''); setWlSubsector(''); setWlPais('');
    setShowAddWatchlist(false);
  };

  const eliminarWatchlist = (ticker) => {
    if (!window.confirm(`¿Remover ${ticker} de la watchlist?`)) return;
    const norm = cleanTickerSymbol(ticker);
    setWatchlist(prev => prev.filter(w => cleanTickerSymbol(w.ticker) !== norm));
  };


  // --- FLUJOS BUSINESS LOGIC ---
  const cargarEdicionFlujo = (f) => {
    setEditingFlujoId(f.id);
    setFlujoFecha(f.fecha);
    setFlujoTipo(f.tipo);
    setFlujoMoneda(f.moneda);
    setFlujoMonto(f.monto.toString());
    setFlujoCotizacion(f.cotizacion ? f.cotizacion.toString() : (dolarMep ? dolarMep.toString() : ''));
    setFlujoNota(f.nota || '');
    setShowAddFlujo(true);
  };

  const agregarFlujo = () => {
    const fMonto = parseFloat(flujoMonto);
    if (isNaN(fMonto) || fMonto <= 0) return alert('Ingresá un monto válido.');
    
    let cotiz = null;
    if (flujoMoneda === 'ARS') {
      cotiz = parseFloat(flujoCotizacion);
      if (isNaN(cotiz) || cotiz <= 0) return alert('Para ARS necesitás indicar el tipo de cambio histórico o usar el actual.');
    }

    if (editingFlujoId) {
      setFlujos(flujos.map(f => f.id === editingFlujoId ? {
        ...f,
        fecha: flujoFecha,
        tipo: flujoTipo,
        monto: fMonto,
        moneda: flujoMoneda,
        cotizacion: cotiz,
        nota: flujoNota.trim()
      } : f));
      setEditingFlujoId(null);
    } else {
      const f = { 
        id: Date.now().toString(), 
        fecha: flujoFecha, 
        tipo: flujoTipo, 
        monto: fMonto, 
        moneda: flujoMoneda, 
        cotizacion: cotiz, 
        nota: flujoNota.trim() 
      };
      setFlujos([...flujos, f]);
    }

    setFlujoMonto('');
    setFlujoCotizacion('');
    setFlujoNota('');
    setShowAddFlujo(false);
  };

  const eliminarFlujo = (id) => {
    if (!window.confirm('¿Remover este registro de flujo?')) return;
    setFlujos(flujos.filter(f => f.id !== id));
  };

  // --- OPERACIONES BUSINESS LOGIC ---
  const cargarEdicionOp = (op) => {
    setEditingOpId(op.id);
    setOpAssetTipo(op.assetTipo || 'accion');
    setOpTicker(op.ticker || '');
    setOpTipo(op.tipo || 'compra');
    setOpFecha(op.fecha ? String(op.fecha).split('T')[0] : new Date().toISOString().split('T')[0]);
    setOpCantidad(op.cantidad !== undefined ? op.cantidad.toString() : '');
    setOpPrecio(op.precio !== undefined ? op.precio.toString() : '');
    setShowAddOp(true);
  };

  const cancelarEdicionOp = () => {
    setEditingOpId(null);
    setOpTicker('');
    setOpCantidad('');
    setOpPrecio('');
    setOpFecha(new Date().toISOString().split('T')[0]);
    setOpAssetTipo('accion');
    setOpTipo('compra');
    setShowAddOp(false);
  };

  const agregarOperacion = () => {
    let ticker = opTicker.trim().toUpperCase();
    const cant = parseFloat(opCantidad);
    const prec = parseFloat(opPrecio);

    if (!ticker || isNaN(cant) || isNaN(prec) || !opFecha) return alert('Datos incompletos.');

    // Auto-append .BA for Argentine assets so we fetch BCBA prices, not ADRs
    if ((opAssetTipo === 'accion' || opAssetTipo === 'cedear') && !ticker.endsWith('.BA')) {
      ticker = ticker + '.BA';
    }

    if (editingOpId) {
      setOperaciones(operaciones.map(o => o.id === editingOpId ? {
        ...o,
        ticker,
        assetTipo: opAssetTipo,
        tipo: opTipo,
        cantidad: cant,
        precio: prec,
        fecha: opFecha
      } : o));
      setEditingOpId(null);
    } else {
      const op = { id: Date.now().toString(), ticker, assetTipo: opAssetTipo, tipo: opTipo, cantidad: cant, precio: prec, fecha: opFecha };
      setOperaciones([...operaciones, op]);
    }

    setOpTicker(''); setOpCantidad(''); setOpPrecio('');
    setShowAddOp(false);
  };

  const eliminarOp = (id) => {
    if (!window.confirm('¿Borrar registro de operación?')) return;
    setOperaciones(operaciones.filter(o => o.id !== id));
  };

  const getTradeDays = (fechaCompra, fechaVenta) => {
    if (!fechaCompra || !fechaVenta) return null;
    const parseDateStr = (dStr) => {
      const parts = String(dStr).split('T')[0].split('-');
      if (parts.length === 3) {
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      }
      return new Date(dStr);
    };
    const d1 = parseDateStr(fechaCompra);
    const d2 = parseDateStr(fechaVenta);
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return null;
    const diffTime = d2.getTime() - d1.getTime();
    const diffDays = Math.round(diffTime / (1000 * 3600 * 24));
    
    let text = `${diffDays} días`;
    if (diffDays < 0) text = `${Math.abs(diffDays)}d (inverso)`;
    else if (diffDays === 0) text = `0 días (Intradiario)`;
    else if (diffDays === 1) text = `1 día`;
    else if (diffDays >= 30 && diffDays < 365) {
      const m = (diffDays / 30.4375).toFixed(1);
      text = `${diffDays} días (~${m} meses)`;
    } else if (diffDays >= 365) {
      const y = (diffDays / 365.25).toFixed(1);
      text = `${diffDays} días (~${y} años)`;
    }

    return { days: diffDays, label: text };
  };

  // --- TRADES BUSINESS LOGIC ---
  const normalizeTrade = (t) => {
    if (!t) return null;

    let compras = [];
    let ventas = [];

    if (Array.isArray(t.compras) && Array.isArray(t.ventas)) {
      compras = t.compras;
      ventas = t.ventas;
    } else {
      if (t.compraOpId || t.compraPrecio) {
        compras.push({
          id: t.compraOpId || 'legacy-compra',
          ticker: t.compraTicker || t.ticker,
          cantidad: Number(t.compraCantidad || 0),
          precio: Number(t.compraPrecio || 0),
          fecha: t.compraFecha
        });
      }
      if (t.ventaOpId || t.ventaPrecio) {
        ventas.push({
          id: t.ventaOpId || 'legacy-venta',
          ticker: t.ventaTicker || t.ticker || t.compraTicker,
          cantidad: Number(t.ventaCantidad || 0),
          precio: Number(t.ventaPrecio || 0),
          fecha: t.ventaFecha
        });
      }
    }

    const allCleanTickers = Array.from(new Set([
      ...compras.map(c => cleanTickerSymbol(c.ticker)),
      ...ventas.map(v => cleanTickerSymbol(v.ticker))
    ])).filter(Boolean);

    let ticker = t.ticker && t.ticker !== 'VARIOS' ? cleanTickerSymbol(t.ticker) : '';
    if (!ticker) {
      ticker = allCleanTickers.length === 1 ? allCleanTickers[0] : (allCleanTickers[0] || 'VARIOS');
    }

    const totalCompraQty = compras.reduce((acc, c) => acc + Number(c.cantidad || 0), 0);
    const totalCompraMonto = compras.reduce((acc, c) => acc + (Number(c.cantidad || 0) * Number(c.precio || 0)), 0);
    const avgCompraPrecio = totalCompraQty > 0 ? totalCompraMonto / totalCompraQty : 0;
    const compraFechas = compras.map(c => c.fecha).filter(Boolean).sort();
    const primeraCompraFecha = compraFechas[0] || t.compraFecha || '';

    const totalVentaQty = ventas.reduce((acc, v) => acc + Number(v.cantidad || 0), 0);
    const totalVentaMonto = ventas.reduce((acc, v) => acc + (Number(v.cantidad || 0) * Number(v.precio || 0)), 0);
    const avgVentaPrecio = totalVentaQty > 0 ? totalVentaMonto / totalVentaQty : 0;
    const ventaFechas = ventas.map(v => v.fecha).filter(Boolean).sort();
    const ultimaVentaFecha = ventaFechas[ventaFechas.length - 1] || t.ventaFecha || '';

    const matchedQty = Math.min(totalCompraQty, totalVentaQty);
    const montoCompraOperado = avgCompraPrecio * matchedQty;
    const montoVentaOperado = avgVentaPrecio * matchedQty;
    const pnlNominal = montoVentaOperado - montoCompraOperado;
    const pnlPct = montoCompraOperado > 0 ? (pnlNominal / montoCompraOperado) * 100 : 0;

    return {
      ...t,
      id: t.id,
      ticker,
      compras,
      ventas,
      totalCompraQty,
      totalCompraMonto,
      avgCompraPrecio,
      primeraCompraFecha,
      totalVentaQty,
      totalVentaMonto,
      avgVentaPrecio,
      ultimaVentaFecha,
      matchedQty,
      montoCompraOperado,
      montoVentaOperado,
      pnlNominal,
      pnlPct,
      compraFecha: primeraCompraFecha,
      ventaFecha: ultimaVentaFecha,
      compraTicker: ticker,
      ventaTicker: ticker,
      compraPrecio: avgCompraPrecio,
      ventaPrecio: avgVentaPrecio,
      compraCantidad: totalCompraQty,
      ventaCantidad: totalVentaQty
    };
  };

  const abrirNuevoTradeModal = () => {
    setEditingTradeId(null);
    setTradeSelectedCompraIds([]);
    setTradeSelectedVentaIds([]);
    setTradeTickerFilter('');
    setSearchCompraQuery('');
    setSearchVentaQuery('');
    setShowAddTrade(true);
  };

  const editarTrade = (tradeId) => {
    const rawTrade = trades.find(t => t.id === tradeId);
    if (!rawTrade) return;
    const t = normalizeTrade(rawTrade);
    setEditingTradeId(t.id);
    setTradeSelectedCompraIds(t.compras.map(c => c.id));
    setTradeSelectedVentaIds(t.ventas.map(v => v.id));
    setTradeTickerFilter(t.ticker !== 'VARIOS' ? t.ticker : '');
    setSearchCompraQuery('');
    setSearchVentaQuery('');
    setShowAddTrade(true);
  };

  const toggleSelectCompraForTrade = (id) => {
    setTradeSelectedCompraIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectVentaForTrade = (id) => {
    setTradeSelectedVentaIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const guardarTrade = () => {
    let finalCompraIds = [...tradeSelectedCompraIds];
    let finalVentaIds = [...tradeSelectedVentaIds];
    if (finalCompraIds.length === 0 && tradeCompraId) finalCompraIds.push(tradeCompraId);
    if (finalVentaIds.length === 0 && tradeVentaId) finalVentaIds.push(tradeVentaId);

    if (finalCompraIds.length === 0 || finalVentaIds.length === 0) {
      return alert('Seleccioná al menos una operación de compra y una de venta.');
    }

    const selectedCompras = finalCompraIds
      .map(id => operaciones.find(o => o.id === id))
      .filter(Boolean)
      .map(o => ({
        id: o.id,
        ticker: o.ticker,
        cantidad: o.cantidad,
        precio: o.precio,
        fecha: o.fecha
      }));

    const selectedVentas = finalVentaIds
      .map(id => operaciones.find(o => o.id === id))
      .filter(Boolean)
      .map(o => ({
        id: o.id,
        ticker: o.ticker,
        cantidad: o.cantidad,
        precio: o.precio,
        fecha: o.fecha
      }));

    if (selectedCompras.length === 0 || selectedVentas.length === 0) {
      return alert('No se encontraron las operaciones seleccionadas.');
    }

    const rawTickersInvolved = Array.from(new Set([
      ...selectedCompras.map(c => c.ticker),
      ...selectedVentas.map(v => v.ticker)
    ]));

    const cleanTickersInvolved = Array.from(new Set([
      ...selectedCompras.map(c => cleanTickerSymbol(c.ticker)),
      ...selectedVentas.map(v => cleanTickerSymbol(v.ticker))
    ]));

    if (cleanTickersInvolved.length > 1) {
      if (!window.confirm(`Las operaciones seleccionadas corresponden a distintos activos (${rawTickersInvolved.join(', ')}). ¿Seguro que querés emparejarlas como un trade?`)) {
        return;
      }
    }

    const tradeTicker = cleanTickersInvolved.length === 1 ? cleanTickersInvolved[0] : (tradeTickerFilter ? cleanTickerSymbol(tradeTickerFilter) : 'VARIOS');

    const tradeData = {
      id: editingTradeId || Date.now().toString(),
      ticker: tradeTicker,
      compras: selectedCompras,
      ventas: selectedVentas,
      createdAt: new Date().toISOString()
    };

    if (editingTradeId) {
      setTrades(trades.map(t => t.id === editingTradeId ? tradeData : t));
    } else {
      setTrades([tradeData, ...trades]);
    }

    setShowAddTrade(false);
    setEditingTradeId(null);
    setTradeSelectedCompraIds([]);
    setTradeSelectedVentaIds([]);
    setTradeCompraId('');
    setTradeVentaId('');
  };

  const agregarTrade = guardarTrade;

  const eliminarTrade = (id) => {
    if (!window.confirm('¿Eliminar este trade cerrado?')) return;
    setTrades(trades.filter(t => t.id !== id));
  };

  const toggleExpandedTrade = (id) => {
    setExpandedTradeIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // --- EVALUATIONS BUSINESS LOGIC (GROUPED ROTATIONS) ---
  const abrirNuevaEvalModal = () => {
    setEditingGroupId(null);
    setEvalNombre('');
    setEvalFecha(new Date().toISOString().split('T')[0]);
    setEvalNotas('');
    setEvalSelectedOpIds([]);
    setEvalOpSearch('');
    setShowAddEval(true);
  };

  const abrirEditarEvalModal = (group) => {
    setEditingGroupId(group.id);
    setEvalNombre(group.nombre || '');
    setEvalFecha(group.fecha || new Date().toISOString().split('T')[0]);
    setEvalNotas(group.notas || '');
    setEvalSelectedOpIds(group.opIds || []);
    setEvalOpSearch('');
    setShowAddEval(true);
  };

  const guardarEvalGroup = () => {
    const nombreClean = evalNombre.trim();
    if (!nombreClean) return alert('Ingresá un nombre para la evaluación de rotación.');
    if (evalSelectedOpIds.length === 0) return alert('Seleccioná al menos una operación para evaluar en este grupo.');

    const fechaClean = evalFecha.trim() || new Date().toISOString().split('T')[0];

    if (editingGroupId) {
      setEvals(evals.map(g => g.id === editingGroupId ? {
        ...g,
        nombre: nombreClean,
        fecha: fechaClean,
        notas: evalNotas.trim(),
        opIds: [...evalSelectedOpIds]
      } : g));
    } else {
      const newGroup = {
        id: Date.now().toString(),
        nombre: nombreClean,
        fecha: fechaClean,
        notas: evalNotas.trim(),
        opIds: [...evalSelectedOpIds],
        excluded: false
      };
      setEvals([...evals, newGroup]);
    }

    setEvalNombre('');
    setEvalFecha('');
    setEvalNotas('');
    setEvalSelectedOpIds([]);
    setEditingGroupId(null);
    setShowAddEval(false);
  };

  const toggleSelectOpForEval = (opId) => {
    if (evalSelectedOpIds.includes(opId)) {
      setEvalSelectedOpIds(evalSelectedOpIds.filter(id => id !== opId));
    } else {
      setEvalSelectedOpIds([...evalSelectedOpIds, opId]);
    }
  };

  const eliminarEvalGroup = (id) => {
    if (!window.confirm('¿Eliminar esta evaluación de rotación?')) return;
    setEvals(evals.filter(g => g.id !== id));
  };

  const toggleEvalExclusion = (id) => {
    setEvals(evals.map(g => g.id === id ? { ...g, excluded: !g.excluded } : g));
  };



  // --- IMP/EXP LOGIC ---
  const exportar = () => {
    const json = JSON.stringify({ allHoldings, allOperaciones, allTrades, allEvals, allFlujos, allLiquidaciones, portfolios, currentPortfolioId, watchlist }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'portfolio_' + new Date().toISOString().split('T')[0] + '.json';
    a.click();
  };

  const copiarJSON = () => {
    const json = JSON.stringify({ allHoldings, allOperaciones, allTrades, allEvals, allFlujos, allLiquidaciones, portfolios, currentPortfolioId, watchlist }, null, 2);
    navigator.clipboard.writeText(json).then(() => alert('JSON Copiado'));
  };

  const migrateImportedData = (data) => {
    if (!data || !data.portfolios) return data;
    
    const needsMigration = data.portfolios.some(p => p.id !== p.name);
    if (!needsMigration) return data;
    
    const idToNameMap = {};
    const migratedPortfolios = data.portfolios.map(p => {
      const name = p.name ? p.name.trim() : 'Mi Portfolio Principal';
      idToNameMap[p.id] = name;
      return { id: name, name: name };
    });
    
    const migrateDict = (dict) => {
      if (!dict) return {};
      const newDict = {};
      for (const [oldId, val] of Object.entries(dict)) {
        const newId = idToNameMap[oldId] || oldId;
        if (newDict[newId]) {
          newDict[newId] = [...newDict[newId], ...val];
        } else {
          newDict[newId] = val;
        }
      }
      return newDict;
    };
    
    const currentId = data.currentPortfolioId || 'default';
    const newCurrentId = idToNameMap[currentId] || currentId;
    
    return {
      ...data,
      portfolios: migratedPortfolios,
      currentPortfolioId: newCurrentId,
      allHoldings: migrateDict(data.allHoldings),
      allOperaciones: migrateDict(data.allOperaciones),
      allTrades: migrateDict(data.allTrades),
      allEvals: migrateDict(data.allEvals),
      allFlujos: migrateDict(data.allFlujos),
      allLiquidaciones: migrateDict(data.allLiquidaciones)
    };
  };

  const importar = () => {
    try {
      let data = JSON.parse(importJson.trim());
      if (!window.confirm('Esto sobreescribirá todo tu portfolio actual. ¿Proceder?')) return;

      if (data.allHoldings) {
        // Run migration if needed
        data = migrateImportedData(data);
        
        setAllHoldings(data.allHoldings);
        setAllOperaciones(data.allOperaciones || {});
        setAllTrades(data.allTrades || {});
        setAllEvals(data.allEvals || {});
        setAllFlujos(data.allFlujos || {});
        setPortfolios(data.portfolios || [{id:'Mi Portfolio Principal', name:'Mi Portfolio Principal'}]);
        setCurrentPortfolioId(data.currentPortfolioId || 'Mi Portfolio Principal');
      } else if (Array.isArray(data.holdings)) {
        // Legacy format
        setAllHoldings({ "Mi Portfolio Principal": data.holdings });
        setAllOperaciones({ "Mi Portfolio Principal": data.operaciones || [] });
        setAllTrades({ "Mi Portfolio Principal": data.trades || [] });
        setAllEvals({ "Mi Portfolio Principal": data.evals || [] });
        setAllFlujos({ "Mi Portfolio Principal": data.flujos || [] });
        setPortfolios([{id:'Mi Portfolio Principal', name:'Mi Portfolio Principal'}]);
        setCurrentPortfolioId('Mi Portfolio Principal');
      } else {
        throw new Error('Estructura incorrecta');
      }

      setWatchlist(sanitizeWatchlist(Array.isArray(data.watchlist) ? data.watchlist : []));
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
      setAllHoldings({}); setAllOperaciones({}); setAllTrades({}); setAllEvals({}); setAllFlujos({}); setAllLiquidaciones({});
      setPortfolios([{id:'default', name:'Mi Portfolio Principal'}]);
      setCurrentPortfolioId('default');
      setWatchlist([]); setPrices({});
      setShowSettings(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const isExcel = file.name.endsWith('.xls') || file.name.endsWith('.xlsx');
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        let rawObjects = [];
        if (isExcel) {
          const data = new Uint8Array(event.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheet];
          rawObjects = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        } else {
          const text = event.target.result;
          const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
          if (lines.length < 2) return alert('El archivo está vacío o no contiene suficientes filas.');

          const delimiter = lines[0].includes(';') ? ';' : ',';
          const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, ''));
          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(delimiter).map(v => v.trim().replace(/^["']|["']$/g, ''));
            const obj = {};
            headers.forEach((h, idx) => { obj[h] = values[idx] || ''; });
            rawObjects.push(obj);
          }
        }

        if (!rawObjects || rawObjects.length === 0) {
          return alert('No se encontraron filas de datos en el archivo.');
        }

        // Helper to find key case-insensitively
        const findKey = (obj, keys) => {
          const lowerObj = {};
          Object.keys(obj).forEach(k => { lowerObj[k.trim().toLowerCase()] = k; });
          for (const key of keys) {
            const match = Object.keys(lowerObj).find(k => k.includes(key));
            if (match) return lowerObj[match];
          }
          return null;
        };

        const sample = rawObjects[0];
        const fechaKey = findKey(sample, ['fecha', 'date', 'concertacion']);
        const tickerKey = findKey(sample, ['ticker', 'especie', 'simbolo', 'symbol']);
        const tipoKey = findKey(sample, ['operacion', 'operación', 'tipo', 'descripcion', 'type']);
        const cantKey = findKey(sample, ['cantidad operada', 'cantidad', 'quantity', 'cant']);
        const precKey = findKey(sample, ['precio operado', 'precio', 'price', 'prec']);
        const assetKey = findKey(sample, ['assettipo', 'tipo de instrumento', 'asset_tipo', 'categoria']);
        const estadoKey = findKey(sample, ['estado', 'status']);

        if (!fechaKey || !tickerKey || !tipoKey || !cantKey || !precKey) {
          return alert('No se encontraron las columnas requeridas (Fecha, Ticker, Operacion/Tipo, Cantidad, Precio).');
        }

        const currentOps = operaciones || [];
        const newOps = [];
        let addedCount = 0;
        let dupCount = 0;

        rawObjects.forEach((row, i) => {
          if (estadoKey && row[estadoKey]) {
            const st = String(row[estadoKey]).toLowerCase();
            if (!['ejecutada', 'finalizada', 'parcialmente cancelada'].includes(st)) return;
          }

          let fechaRaw = String(row[fechaKey] || '').trim();
          let rawTicker = String(row[tickerKey] || '').trim().toUpperCase();
          let rawTipo = String(row[tipoKey] || '').trim().toLowerCase();
          let cant = parseFloat(row[cantKey]);
          let prec = parseFloat(row[precKey]);

          if (!fechaRaw || !rawTicker || isNaN(cant) || isNaN(prec) || cant <= 0 || prec <= 0) return;

          let fecha = fechaRaw.split('T')[0].split(' ')[0];
          if (fecha.includes('/')) {
            const parts = fecha.split('/');
            if (parts[0].length === 4) fecha = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
            else if (parts[2].length === 4) fecha = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }

          if (!fecha.startsWith('2026')) return;

          let tipo = (rawTipo.includes('compra') || rawTipo === 'c' || rawTipo === 'buy') ? 'compra' : 
                     (rawTipo.includes('venta') || rawTipo === 'v' || rawTipo === 'sell') ? 'venta' : null;
          if (!tipo) return;

          let assetTipo = assetKey && row[assetKey] ? String(row[assetKey]).toLowerCase() : 'accion';
          let ticker = rawTicker;
          if ((assetTipo === 'accion' || assetTipo === 'cedear') && !ticker.endsWith('.BA') && !ticker.endsWith('.US') && !ticker.startsWith('$')) {
            ticker = ticker + '.BA';
          }

          const exists = currentOps.some(o => 
            o.ticker === ticker && o.fecha === fecha && o.tipo === tipo && 
            Math.abs(o.cantidad - cant) < 0.0001 && Math.abs(o.precio - prec) < 0.0001
          );

          if (!exists) {
            newOps.push({
              id: (Date.now() + i).toString(),
              ticker,
              assetTipo,
              tipo,
              cantidad: cant,
              precio: prec,
              fecha
            });
            addedCount++;
          } else {
            dupCount++;
          }
        });

        if (addedCount === 0) {
          return alert(`No se agregaron nuevas operaciones del año 2026 (${dupCount} operaciones duplicadas/omitidas).`);
        }

        setOperaciones([...currentOps, ...newOps]);
        alert(`¡Éxito! Se agregaron ${addedCount} operaciones de 2026 al portfolio (${dupCount} omitidas por duplicadas).`);
      } catch (err) {
        alert('Error al procesar el archivo: ' + err.message);
      }
    };

    if (isExcel) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  };



  // Computations
  let totalValorARS = 0;
  let totalCostoARS = 0;
  let totalDailyChangeARS = 0;

  let totalValorUSD = 0;
  let totalCostoUSD = 0;
  let totalDailyChangeUSD = 0;

  const mepPrev = dolarMepPrev || dolarMep || 1;
  const mepToday = dolarMep || 1;

  holdings.forEach(h => {
    const yt = getYahooTicker(h) || h.ticker;
    const pc = h.tipo === 'efectivo' ? 1 : (prices[yt] ?? null);
    const stats = h.tipo === 'efectivo' ? { price: 1, change: 0, changePct: 0 } : (dailyStats[yt] ?? null);

    const qty = h.cantidad;
    const costUnit = h.precioEntrada;

    if (pc !== null) {
      const isUsdAsset = h.tipo === 'stock' || (h.tipo === 'efectivo' && h.ticker === 'USD');
      
      let valARS = 0;
      let valUSD = 0;
      let costARS = 0;
      let costUSD = 0;
      let changeARS = 0;
      let changeUSD = 0;

      if (isUsdAsset) {
        // Stock US (NYSE/NASDAQ)
        valUSD = pc * qty;
        costUSD = costUnit * qty;
        valARS = valUSD * mepToday;
        costARS = costUSD * mepToday;

        if (stats && stats.change != null && !isNaN(stats.change)) {
          changeUSD = stats.change * qty;
          const prevValUSD = valUSD - changeUSD;
          const prevValARS = prevValUSD * mepPrev;
          changeARS = valARS - prevValARS;
        }
      } else {
        // Argentine Asset (Accion, Cedear, Bono)
        valARS = pc * qty;
        costARS = costUnit * qty;
        valUSD = valARS / mepToday;
        costUSD = costARS / mepToday;

        if (stats && stats.change != null && !isNaN(stats.change)) {
          changeARS = stats.change * qty;
          const prevValARS = valARS - changeARS;
          const prevValUSD = prevValARS / mepPrev;
          changeUSD = valUSD - prevValUSD;
        }
      }

      totalValorARS += valARS;
      totalCostoARS += costARS;
      totalDailyChangeARS += changeARS;

      totalValorUSD += valUSD;
      totalCostoUSD += costUSD;
      totalDailyChangeUSD += changeUSD;
    } else {
      // pc is null, fallback just for costs
      const isUsdAsset = h.tipo === 'stock' || (h.tipo === 'efectivo' && h.ticker === 'USD');
      if (isUsdAsset) {
        totalCostoUSD += costUnit * qty;
        totalCostoARS += costUnit * qty * mepToday;
      } else {
        totalCostoARS += costUnit * qty;
        totalCostoUSD += costUnit * qty / mepToday;
      }
    }
  });

  const totalValor = totalValorARS;
  const totalCosto = totalCostoARS;
  const totalDailyChange = totalDailyChangeARS;

  // 1. P&L Posición (Resultado de tenencias abiertas respecto al costo)
  const pnlPosicion = totalValor - totalCosto;
  const pnlPosicionPct = totalCosto > 0 ? (pnlPosicion / totalCosto) * 100 : 0;

  const pnlPosicionUSD = totalValorUSD - totalCostoUSD;
  const pnlPosicionPctUSD = totalCostoUSD > 0 ? (pnlPosicionUSD / totalCostoUSD) * 100 : 0;

  // 2. P&L Total (Resultado real considerando Flujos de Caja / Fondeo Neto)
  const currentFlujosData = calculatePortfolioFlujos(flujos, dolarMep);
  const hasFlujos = flujos && flujos.length > 0;

  const pnlT = hasFlujos
    ? (totalValorARS + currentFlujosData.totalExtraccionesARS - currentFlujosData.totalIngresosARS)
    : pnlPosicion;
  const pnlTP = hasFlujos && currentFlujosData.netFondeoARS > 0
    ? (pnlT / currentFlujosData.netFondeoARS) * 100
    : pnlPosicionPct;

  const pnlTUSD = hasFlujos
    ? (totalValorUSD + currentFlujosData.totalExtraccionesUSD - currentFlujosData.totalIngresosUSD)
    : pnlPosicionUSD;
  const pnlTPUSD = hasFlujos && currentFlujosData.netFondeoUSD > 0
    ? (pnlTUSD / currentFlujosData.netFondeoUSD) * 100
    : pnlPosicionPctUSD;

  const totalPreviousValor = totalValor - totalDailyChange;
  const totalDailyChangePct = (totalPreviousValor > 0 && totalValor > 0)
    ? (totalDailyChange / totalPreviousValor) * 100
    : 0;

  // USD daily percentage calculation
  const totalPreviousValorUSD = totalValorUSD - totalDailyChangeUSD;
  const totalDailyChangePctUSD = (totalPreviousValorUSD > 0 && totalValorUSD > 0)
    ? (totalDailyChangeUSD / totalPreviousValorUSD) * 100
    : 0;

  // Portfolio equity/CEDEAR tickers (excluding cash & bonds) for quick filtering
  const portfolioTickers = useMemo(() => {
    const set = new Set();
    holdings.forEach(h => {
      if (h && h.ticker && h.tipo !== 'efectivo' && h.tipo !== 'bono') {
        const clean = h.ticker.trim().toUpperCase().replace(/\.BA$/i, '');
        set.add(clean);
      }
    });
    return set;
  }, [holdings]);

  // International Proxy analysis for holiday tracking & Wall Street proxy
  const proxyAnalysis = useMemo(() => {
    const proxy = extractPortfolioInternationalProxy(holdings, tickerCatalog, prices, dolarMep);
    const stats = calculateProxyDailyReturn(proxy.mapped, dailyStats);
    return { ...proxy, ...stats };
  }, [holdings, tickerCatalog, prices, dolarMep, dailyStats]);

  // US international counterpart items generated dynamically from active portfolio holdings
  const portfolioUsProxyItems = useMemo(() => {
    const seen = new Set();
    const items = [];
    proxyAnalysis.mapped.forEach(m => {
      const clean = cleanTickerSymbol(m.usTicker);
      if (!clean || seen.has(clean)) return;
      seen.add(clean);
      items.push({
        ticker: clean,
        nombre: m.name,
        tipo: 'stock',
        mercado: m.mercado || 'NYSE/NASDAQ',
        sector: m.sector || 'General',
        subsector: m.subsector || 'General',
        pais: m.pais || (m.isAdr ? 'Argentina' : 'USA'),
        isAdr: m.isAdr,
        isProxy: true,
        originalTicker: m.rawTicker
      });
    });
    return items;
  }, [proxyAnalysis.mapped]);

  const baseWatchlistSource = wlPortfolioOnly ? portfolioUsProxyItems : watchlist;

  // Watchlist: items visible after type + category filters (before per-ticker exclusion)
  const wlVisibleBeforeExclude = baseWatchlistSource
    .filter(w => {
      if (wlPortfolioOnly) return true; // in US portfolio mode, show all mapped US assets
      return wlTypeFilters.length === 0 || wlTypeFilters.includes(w.tipo);
    })
    .filter(w => wlSectorFilters.length === 0 || wlSectorFilters.includes(w.sector || ''))
    .filter(w => wlSubsectorFilters.length === 0 || wlSubsectorFilters.includes(w.subsector || ''))
    .filter(w => wlPaisFilters.length === 0 || wlPaisFilters.includes(w.pais || ''));

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
      <datalist id="ticker-suggestions">
        {Object.values(tickerCatalog).map(item => (
          <option key={item.ticker} value={item.ticker}>
            {item.nombre ? `${item.nombre} (${item.tipo || ''})` : item.ticker}
          </option>
        ))}
      </datalist>
      {/* Header */}
      <header className="header" style={{ marginBottom: '0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h1>Portfolio Dashboard</h1>
          <select 
            value={currentPortfolioId} 
            onChange={(e) => {
              if (e.target.value === 'NEW') {
                const name = window.prompt("Nombre del nuevo portfolio:");
                if (name && name.trim()) {
                  const trimmedName = name.trim();
                  if (trimmedName.toUpperCase() === 'NEW') {
                    alert("El nombre 'NEW' es reservado. Elegí otro nombre.");
                    return;
                  }
                  if (portfolios.some(p => p.name.toLowerCase() === trimmedName.toLowerCase())) {
                    alert("Ya existe un portfolio con ese nombre.");
                    return;
                  }
                  setPortfolios([...portfolios, {id: trimmedName, name: trimmedName}]);
                  setCurrentPortfolioId(trimmedName);
                }
              } else {
                setCurrentPortfolioId(e.target.value);
              }
            }}
            className="form-control" 
            style={{ width: 'auto', display: 'inline-block', padding: '4px 8px', fontSize: '13px', backgroundColor: '#1a1b35', color: '#ffffff', border: '1px solid var(--glass-border)', borderRadius: '6px' }}
          >
            {portfolios.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            <option value="NEW" style={{ fontWeight: 'bold' }}>+ Nuevo Portfolio</option>
          </select>
        </div>
        <div className="refresh-bar">
          <div className={`dot ${status}`}></div>
          <span id="status-text">{statusText}</span>
          <div style={{ display: 'inline-flex', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--glass-border)' }}>
            <button 
              className="btn btn-sm" 
              style={{ borderRadius: 0, borderRight: '1px solid rgba(255, 255, 255, 0.1)' }}
              onClick={handleRefreshClick}
              title={refreshPref === 'current' ? `Actualizar solo ${TAB_LABELS[activeTab] || 'vista actual'}` : refreshPref === 'all' ? 'Actualizar todo el Dashboard' : 'Preguntar qué actualizar'}
            >
              Actualizar {refreshPref === 'current' ? '⚡' : refreshPref === 'all' ? '🌐' : ''}
            </button>
            <button 
              className="btn btn-sm" 
              style={{ borderRadius: 0, padding: '4px 6px', fontSize: '10px' }}
              onClick={() => setShowRefreshModal(true)}
              title="Opciones de actualización"
            >
              ▼
            </button>
          </div>
          <button className="btn btn-sm" onClick={() => setShowSettings(!showSettings)}>Ajustes</button>
        </div>
      </header>

      {/* Refresh Selection Modal */}
      {showRefreshModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(10, 11, 26, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div className="glass-panel" style={{
            width: '90%',
            maxWidth: '440px',
            padding: '1.5rem',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            border: '1px solid rgba(94, 106, 210, 0.4)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🔄 Opciones de Actualización
              </h3>
              <button 
                style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '1.2rem' }}
                onClick={() => setShowRefreshModal(false)}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem', lineHeight: '1.4' }}>
              ¿Qué datos deseas consultar y actualizar en este momento?
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '1.25rem' }}>
              <button
                className="btn"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  gap: '12px',
                  padding: '12px 14px',
                  textAlign: 'left',
                  backgroundColor: 'rgba(94, 106, 210, 0.15)',
                  border: '1px solid rgba(94, 106, 210, 0.4)'
                }}
                onClick={() => executeRefreshChoice('current')}
              >
                <span style={{ fontSize: '1.4rem' }}>⚡</span>
                <div>
                  <div style={{ fontWeight: '600', color: '#fff', fontSize: '0.9rem' }}>
                    Actualizar solo {TAB_LABELS[activeTab] || 'vista actual'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#a0a5d0', marginTop: '2px' }}>
                    Refresco rápido de los datos pertenecientes a esta pantalla.
                  </div>
                </div>
              </button>

              <button
                className="btn"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  gap: '12px',
                  padding: '12px 14px',
                  textAlign: 'left',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--glass-border)'
                }}
                onClick={() => executeRefreshChoice('all')}
              >
                <span style={{ fontSize: '1.4rem' }}>🌐</span>
                <div>
                  <div style={{ fontWeight: '600', color: '#fff', fontSize: '0.9rem' }}>
                    Actualizar todo el Dashboard
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#a0a5d0', marginTop: '2px' }}>
                    Consulta holdings, watchlist, operaciones pasadas e índices.
                  </div>
                </div>
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <input 
                type="checkbox" 
                id="dontAskCheck"
                checked={dontAskRefreshAgain}
                onChange={(e) => setDontAskRefreshAgain(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <label htmlFor="dontAskCheck" style={{ cursor: 'pointer', userSelect: 'none' }}>
                Recordar mi elección para futuros clics
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Tabs Navigation */}
      <nav className="tabs-nav">
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button className={`tab-btn ${activeTab === 'portfolio' ? 'active' : ''}`} onClick={() => setActiveTab('portfolio')}>Mi Portfolio</button>
          <button className={`tab-btn ${activeTab === 'multi-portfolio' ? 'active' : ''}`} onClick={() => setActiveTab('multi-portfolio')}>Resumen Portfolios</button>
          <button className={`tab-btn ${activeTab === 'flujos' ? 'active' : ''}`} onClick={() => setActiveTab('flujos')}>Flujos de Caja</button>
          <button className={`tab-btn ${activeTab === 'honorarios' ? 'active' : ''}`} onClick={() => setActiveTab('honorarios')}>Honorarios / Asesoría</button>
          <button className={`tab-btn ${activeTab === 'operaciones' ? 'active' : ''}`} onClick={() => setActiveTab('operaciones')}>Histórico</button>
          <button className={`tab-btn ${activeTab === 'watchlist' ? 'active' : ''}`} onClick={() => setActiveTab('watchlist')}>Watchlist</button>
          <button className={`tab-btn ${activeTab === 'mercados' ? 'active' : ''}`} onClick={() => setActiveTab('mercados')}>Mercados</button>
          <button className={`tab-btn ${activeTab === 'insights' ? 'active' : ''}`} onClick={() => setActiveTab('insights')}>Insights</button>
          <button className={`tab-btn ${activeTab === 'evaluacion' ? 'active' : ''}`} onClick={() => setActiveTab('evaluacion')}>Evaluación</button>
          <button className={`tab-btn ${activeTab === 'trades' ? 'active' : ''}`} onClick={() => setActiveTab('trades')}>Trades</button>
          <button className={`tab-btn ${activeTab === 'api-dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('api-dashboard')}>API Dashboard</button>
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
              <label>Gestión de Portfolio</label>
              <p className="hint" style={{ marginBottom: '8px' }}>Opciones para el portfolio actual ({portfolios.find(p => p.id === currentPortfolioId)?.name}).</p>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem' }}>
                <button className="btn" onClick={() => {
                  const p = portfolios.find(p => p.id === currentPortfolioId);
                  const newName = window.prompt("Nuevo nombre:", p.name);
                  if (newName && newName.trim()) {
                    const cleanNewName = newName.trim();
                    if (cleanNewName.toUpperCase() === 'NEW') {
                      alert("El nombre 'NEW' es reservado. Elegí otro nombre.");
                      return;
                    }
                    if (cleanNewName !== p.name && portfolios.some(x => x.name.toLowerCase() === cleanNewName.toLowerCase())) {
                      alert("Ya existe un portfolio con ese nombre.");
                      return;
                    }
                    
                    const oldId = currentPortfolioId;
                    const newId = cleanNewName;
                    
                    setPortfolios(portfolios.map(item => item.id === oldId ? { id: newId, name: newId } : item));
                    
                    const renameKey = (obj) => {
                      const newObj = { ...obj };
                      if (oldId in newObj) {
                        newObj[newId] = newObj[oldId];
                        delete newObj[oldId];
                      }
                      return newObj;
                    };
                    
                    setAllHoldings(renameKey);
                    setAllOperaciones(renameKey);
                    setAllTrades(renameKey);
                    setAllEvals(renameKey);
                    setAllFlujos(renameKey);
                    setAllLiquidaciones(renameKey);
                    
                    setCurrentPortfolioId(newId);
                  }
                }}>Renombrar</button>
                <button className="btn btn-danger" disabled={portfolios.length <= 1} onClick={() => {
                  if (portfolios.length <= 1) return;
                  if (window.confirm("¿Seguro que querés eliminar el portfolio actual y todos sus datos?")) {
                    const oldId = currentPortfolioId;
                    const nextPortfolio = portfolios.filter(p => p.id !== oldId)[0];
                    
                    setPortfolios(portfolios.filter(p => p.id !== oldId));
                    
                    const deleteKey = (obj) => {
                      const newObj = { ...obj };
                      delete newObj[oldId];
                      return newObj;
                    };
                    
                    setAllHoldings(deleteKey);
                    setAllOperaciones(deleteKey);
                    setAllTrades(deleteKey);
                    setAllEvals(deleteKey);
                    setAllFlujos(deleteKey);
                    setAllLiquidaciones(deleteKey);
                    
                    setCurrentPortfolioId(nextPortfolio.id);
                  }
                }}>Eliminar Portfolio</button>
              </div>
              <label>Exportar Datos (JSON)</label>
              <p className="hint" style={{ marginBottom: '8px' }}>Guardá este JSON de forma segura como backup (incluye todos los portfolios).</p>
              <textarea readOnly rows="4" style={{ fontFamily: 'monospace', fontSize: '11px' }} value={JSON.stringify({ allHoldings, allOperaciones, allTrades, allEvals, allFlujos, portfolios, currentPortfolioId, watchlist }, null, 2)}></textarea>
              <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                <button className="btn" onClick={exportar}>Descargar Archivo</button>
                <button className="btn" onClick={copiarJSON}>Copiar</button>
              </div>
            </div>
            <div>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ fontWeight: '600', color: '#fff' }}>Importar Operaciones desde Excel / CSV (2026)</label>
                <p className="hint" style={{ marginBottom: '8px' }}>Subí tu archivo de Balanz u otro broker (.xls, .xlsx, .csv). Filtrará e incorporará operaciones de 2026.</p>
                <input 
                  type="file" 
                  accept=".xls,.xlsx,.csv" 
                  onChange={handleFileUpload}
                  style={{ fontSize: '12px', color: 'var(--text-muted)' }}
                />
              </div>
              <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--glass-border)' }}>
                <label>Importar Backup Completo (JSON)</label>
                <p className="hint" style={{ marginBottom: '8px' }}>Atención: Pegá un JSON válido. Esto sobreescribirá todo.</p>
                <textarea rows="4" placeholder='{"holdings":[...],"operaciones":[...]}' style={{ fontFamily: 'monospace', fontSize: '11px' }} value={importJson} onChange={e => setImportJson(e.target.value)}></textarea>
                <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                  <button className="btn btn-primary" onClick={importar}>Restaurar</button>
                  <button className="btn btn-danger" onClick={borrarTodo}>Reset de Fábrica</button>
                </div>
              </div>

              <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--glass-border)' }}>
                <label style={{ fontWeight: '600', color: '#fff' }}>Comportamiento de Actualización</label>
                <p className="hint" style={{ marginBottom: '8px' }}>Elige qué ocurre al hacer clic directamente en "Actualizar".</p>
                <select 
                  value={refreshPref}
                  onChange={(e) => {
                    setRefreshPref(e.target.value);
                    safeSetItem('refresh_preference', e.target.value);
                  }}
                  className="form-control"
                  style={{ width: '100%', maxWidth: '320px', padding: '6px 10px', fontSize: '13px', backgroundColor: '#1a1b35', color: '#ffffff', border: '1px solid var(--glass-border)', borderRadius: '6px' }}
                >
                  <option value="ask">❓ Preguntar siempre (Vista actual vs Todo)</option>
                  <option value="current">⚡ Actualizar siempre solo la vista actual</option>
                  <option value="all">🌐 Actualizar siempre todo el Dashboard</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* --- TAB 1: PORTFOLIO --- */}
      {activeTab === 'portfolio' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '-0.75rem', marginBottom: '0.125rem' }}>
            <div style={{ display: 'flex', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '8px', overflow: 'hidden' }}>
              <button className={`btn btn-sm ${currencyMode === 'ARS' ? 'active' : ''}`} style={{ border: 'none', borderRadius: 0, background: currencyMode === 'ARS' ? 'var(--accent)' : 'transparent', color: currencyMode === 'ARS' ? '#fff' : 'var(--text-muted)' }} onClick={() => setCurrencyMode('ARS')}>ARS</button>
              <button className={`btn btn-sm ${currencyMode === 'USD' ? 'active' : ''}`} style={{ border: 'none', borderRadius: 0, background: currencyMode === 'USD' ? 'var(--accent)' : 'transparent', color: currencyMode === 'USD' ? '#fff' : 'var(--text-muted)' }} onClick={() => setCurrencyMode('USD')}>USD</button>
            </div>
          </div>
          <div className="metrics-grid">
            <div className="glass-panel metric-card">
              <div className="metric-label">Valor Total</div>
              <div className="metric-value" id="m-total">
                {holdings.length > 0 ? (currencyMode === 'ARS' ? `$${fmt(totalValor)}` : `US$ ${fmt(totalValorUSD)}`) : '—'}
              </div>
            </div>
            <div className="glass-panel metric-card">
              <div className="metric-label">Cambio Diario</div>
              <div className="metric-value" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '6px', margin: '4px 0' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  {currencyMode === 'ARS' ? (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                      <span className={holdings.length === 0 ? '' : (totalDailyChange >= 0 ? 'positive' : 'negative')}>
                        {holdings.length > 0 ? `${totalDailyChange >= 0 ? '+$' : '-$'}${fmt(Math.abs(totalDailyChange))}` : '—'}
                      </span>
                      {holdings.length > 0 && (
                        <span className={totalDailyChangePct >= 0 ? 'positive' : 'negative'} style={{ fontSize: '18px', fontWeight: '500', marginLeft: '4px' }}>
                          ({fmtPct(totalDailyChangePct)})
                        </span>
                      )}
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '4px', textTransform: 'uppercase', fontWeight: '600' }}>ARS</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                      <span className={holdings.length === 0 ? '' : (totalDailyChangeUSD >= 0 ? 'positive' : 'negative')}>
                        {holdings.length > 0 ? `${totalDailyChangeUSD >= 0 ? '+US$ ' : '-US$ '}${fmt(Math.abs(totalDailyChangeUSD))}` : '—'}
                      </span>
                      {holdings.length > 0 && (
                        <span className={totalDailyChangePctUSD >= 0 ? 'positive' : 'negative'} style={{ fontSize: '18px', fontWeight: '500', marginLeft: '4px' }}>
                          ({fmtPct(totalDailyChangePctUSD)})
                        </span>
                      )}
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '4px', textTransform: 'uppercase', fontWeight: '600' }}>USD</span>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div>Resultado real de la jornada</div>
                {proxyAnalysis.mapped.length > 0 && (
                  <div style={{ paddingTop: '4px', borderTop: '1px dashed rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>🗽 Proxy Wall Street (EE.UU.):</span>
                    <span className={proxyAnalysis.estimatedReturn >= 0 ? 'positive' : 'negative'} style={{ fontWeight: '700' }}>
                      {fmtPct(proxyAnalysis.estimatedReturn)} <span style={{ fontSize: '9px', opacity: 0.8 }}>USD</span>
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="glass-panel metric-card">
              <div className="metric-label">P&L Total (Fondeo Neto)</div>
              <div className="metric-value">
                <span className={holdings.length === 0 ? '' : (pnlT >= 0 ? 'positive' : 'negative')}>
                  {holdings.length > 0 ? (currencyMode === 'ARS' ? `${pnlT >= 0 ? '+$' : '-$'}${fmt(Math.abs(pnlT))}` : `${pnlTUSD >= 0 ? '+US$ ' : '-US$ '}${fmt(Math.abs(pnlTUSD))}`) : '—'}
                </span>
                {holdings.length > 0 && (
                  <span className={(currencyMode === 'ARS' ? pnlTP : pnlTPUSD) >= 0 ? 'positive' : 'negative'} style={{ fontSize: '18px', fontWeight: '500', marginLeft: '4px' }}>
                    ({fmtPct(currencyMode === 'ARS' ? pnlTP : pnlTPUSD)})
                  </span>
                )}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div>
                  P&L Posición Actual: <span className={(currencyMode === 'ARS' ? pnlPosicion : pnlPosicionUSD) >= 0 ? 'positive' : 'negative'} style={{ fontWeight: '600' }}>
                    {currencyMode === 'ARS'
                      ? `${pnlPosicion >= 0 ? '+$' : '-$'}${fmt(Math.abs(pnlPosicion))} (${fmtPct(pnlPosicionPct)})`
                      : `${pnlPosicionUSD >= 0 ? '+US$ ' : '-US$ '}${fmt(Math.abs(pnlPosicionUSD))} (${fmtPct(pnlPosicionPctUSD)})`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-panel" style={{ marginTop: '0.75rem' }}>
            <div className="panel-header">
              <div className="panel-title">Tus Activos ({holdings.length})</div>
              <button className="btn btn-primary btn-sm" onClick={() => setShowAddHolding(!showAddHolding)}>+ Agregar Holding</button>
            </div>

            {showAddHolding && (
              <div className="collapsible-content active" tabIndex="0" onPaste={handlePasteCapture} style={{ outline: 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                  <div className="panel-title" style={{ fontSize: '14px', margin: 0 }}>Nuevo Holding</div>
                  <div 
                    style={{ 
                      fontSize: '12px', color: 'var(--text-muted)', 
                      display: 'flex', alignItems: 'center', gap: '8px',
                      border: '1px dashed var(--accent)', padding: '8px 12px',
                      borderRadius: '8px', backgroundColor: 'rgba(99, 102, 241, 0.05)',
                      cursor: 'text'
                    }}
                    title="Haz click en cualquier parte de este cuadro y presiona Ctrl+V"
                  >
                    <span>📸 Haz click en este recuadro y presiona <b>Ctrl + V</b> para pegar una captura del broker y autocompletar.</span>
                  </div>
                </div>
                {isAnalyzingImage && <div style={{ marginBottom: '12px', fontSize: '13px', color: 'var(--accent)', fontWeight: 'bold' }}>Analizando imagen con IA... ⏳</div>}
                {analyzeImageError && <div style={{ marginBottom: '12px', fontSize: '13px', color: 'var(--danger)' }}>{analyzeImageError}</div>}
                <div className="form-row">
                  <div>
                    <label>Tipo</label>
                    <select value={newTipo} onChange={(e) => {
                      const t = e.target.value;
                      setNewTipo(t);
                      if (t === 'accion' || t === 'cedear') setNewMercado('BCBA');
                      else if (t === 'stock') setNewMercado('NYSE/NASDAQ');
                      else if (t === 'bono') setNewMercado('OTC');
                      else if (t === 'efectivo') setNewMercado('Caja');
                    }}>
                      <option value="accion">Acción AR</option>
                      <option value="cedear">CEDEAR</option>
                      <option value="stock">Stock US</option>
                      <option value="bono">Bono</option>
                      <option value="efectivo">Efectivo</option>
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
                    <input value={newTicker} onChange={e => handleNewTickerChange(e.target.value)} list="ticker-suggestions" placeholder="ej: GGAL" />
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
                {editingHoldingOriginal && parseFloat(newCantidad) < editingHoldingOriginal.cantidad && (
                  <div style={{ marginBottom: '12px', padding: '10px', backgroundColor: 'rgba(99, 102, 241, 0.1)', borderRadius: '8px', border: '1px dashed var(--accent)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: registerPartialSale ? '8px' : '0px', fontSize: '13px' }}>
                      <input type="checkbox" checked={registerPartialSale} onChange={e => setRegisterPartialSale(e.target.checked)} />
                      Registrar la diferencia ({editingHoldingOriginal.cantidad - parseFloat(newCantidad)} nominales) como Venta en Operaciones
                    </label>
                    {registerPartialSale && (
                      <div className="form-row">
                        <div>
                          <label>Precio de Venta Unitario ($)</label>
                          <input type="number" placeholder="0.00" step="0.01" value={partialSalePrice} onChange={e => setPartialSalePrice(e.target.value)} />
                        </div>
                        <div></div>
                      </div>
                    )}
                  </div>
                )}
                {(!editingHoldingOriginal || (editingHoldingOriginal && parseFloat(newCantidad) > editingHoldingOriginal.cantidad)) && (
                  <div style={{ marginBottom: '12px', padding: '10px', backgroundColor: 'rgba(99, 102, 241, 0.1)', borderRadius: '8px', border: '1px dashed var(--accent)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: registerPurchase ? '8px' : '0px', fontSize: '13px' }}>
                      <input type="checkbox" checked={registerPurchase} onChange={e => setRegisterPurchase(e.target.checked)} />
                      {editingHoldingOriginal 
                        ? `Registrar el incremento (+${(parseFloat(newCantidad) || 0) - editingHoldingOriginal.cantidad} nominales) como Compra en Operaciones`
                        : 'Registrar también como Compra en Histórico de Operaciones'
                      }
                    </label>
                    {registerPurchase && (
                      <div className="form-row">
                        <div>
                          <label>Fecha de Compra</label>
                          <input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
                        </div>
                        <div>
                          <label>Precio Unitario Compra ($ opc.)</label>
                          <input type="number" placeholder={newPrecio || "0.00"} step="0.01" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} />
                        </div>
                      </div>
                    )}
                  </div>
                )}
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
                      <th onClick={() => setHoldingsSort('alpha')} style={{cursor: 'pointer', maxWidth: '140px'}} title="Ordenar Alfabéticamente">Activo {holdingsSort === 'alpha' ? '↓' : ''}</th>
                      <th onClick={() => setHoldingsSort('default')} style={{cursor: 'pointer'}} title="Ordenar por Tipo">Tipo {holdingsSort === 'default' ? '↓' : ''}</th>
                      <th onClick={() => setHoldingsSort('sector')} style={{cursor: 'pointer', maxWidth: '120px'}} title="Ordenar por Sector">Sector {holdingsSort === 'sector' ? '↓' : ''}</th>
                      <th onClick={() => setHoldingsSort('subsector')} style={{cursor: 'pointer', maxWidth: '135px'}} title="Ordenar por Subsector">Subsector {holdingsSort === 'subsector' ? '↓' : ''}</th>
                      <th onClick={() => setHoldingsSort('pct')} style={{cursor: 'pointer'}} title="Ordenar por % de Cartera">% {holdingsSort === 'pct' ? '↓' : ''}</th>
                      <th>Cant.</th>
                      <th>P. Compra</th>
                      <th>P. Actual</th>
                      <th>Últ. Act.</th>
                      <th>Valor ($)</th>
                      <th onClick={() => setHoldingsSort('pnlA')} style={{cursor: 'pointer'}} title="Ordenar por P&L $">P&L $ {holdingsSort === 'pnlA' ? '↓' : ''}</th>
                      <th onClick={() => setHoldingsSort('pnlP')} style={{cursor: 'pointer'}} title="Ordenar por P&L %">P&L % {holdingsSort === 'pnlP' ? '↓' : ''}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const enriched = holdings.map(h => {
                        const isEfectivo = h.tipo === 'efectivo';
                        const yt = getYahooTicker(h) || h.ticker;
                        const pc = isEfectivo ? 1 : (prices[yt] ?? null);
                        const stats = isEfectivo ? { change: 0, changePct: 0 } : (dailyStats[yt] ?? null);
                        const valor = pc !== null ? pc * h.cantidad : null;
                        const costo = h.precioEntrada * h.cantidad;
                        const pnlA = valor !== null ? valor - costo : null;
                        const pnlP = (valor !== null && costo > 0) ? (pnlA / costo) * 100 : null;
                        
                        const isUsdAsset = h.tipo === 'stock' || (isEfectivo && h.ticker === 'USD');
                        const mepToday = dolarMep || 1;
                        const valARS = valor !== null ? (isUsdAsset ? valor * mepToday : valor) : (isUsdAsset ? costo * mepToday : costo);
                        const pct = (valARS > 0 && totalValor > 0) ? (valARS / totalValor) * 100 : 0;
                        
                        const rawTicker = (h.ticker || '').toUpperCase();
                        const info = tickerCatalog[rawTicker] || {};
                        const { sector, subsector } = getAssetSectorAndSubsector(h.ticker, h.tipo, info);

                        return { h, yt, pc, stats, valor, costo, pnlA, pnlP, pct, isEfectivo, sector, subsector };
                      });
                      
                      enriched.sort((a, b) => {
                        if (holdingsSort === 'alpha') return a.h.ticker.localeCompare(b.h.ticker);
                        if (holdingsSort === 'sector') return a.sector.localeCompare(b.sector);
                        if (holdingsSort === 'subsector') return a.subsector.localeCompare(b.subsector);
                        if (holdingsSort === 'pct') return b.pct - a.pct;
                        if (holdingsSort === 'pnlA') return (b.pnlA || -Infinity) - (a.pnlA || -Infinity);
                        if (holdingsSort === 'pnlP') return (b.pnlP || -Infinity) - (a.pnlP || -Infinity);
                        return sortUnified(a.h, b.h);
                      });
                      
                      return enriched.map(({ h, yt, pc, stats, valor, costo, pnlA, pnlP, pct, isEfectivo, sector, subsector }) => {
                        const cssPnl = pnlA == null ? 'neutral' : (pnlA >= 0 ? 'positive' : 'negative');
                        const sign = pnlA >= 0 ? '+' : '';
                        
                        return (
                          <React.Fragment key={h.ticker}>
                            <tr className="expandable-row" onClick={() => setExpandedTicker(expandedTicker === h.ticker ? null : h.ticker)}>
                              <td style={{ maxWidth: '140px' }}>
                                <div className="ticker-name">{h.ticker}</div>
                                {h.nombre && (
                                  <div style={{
                                    fontSize: '11px',
                                    color: 'var(--text-muted)',
                                    maxWidth: '135px',
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    lineHeight: '1.2'
                                  }}>
                                    {h.nombre}
                                  </div>
                                )}
                              </td>
                              <td><span className={`badge badge-${h.tipo}`}>{h.tipo}</span></td>
                              <td style={{ maxWidth: '120px' }}>
                                <span className="badge badge-neutral" style={{
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  whiteSpace: 'normal',
                                  textAlign: 'center',
                                  lineHeight: '1.2',
                                  maxWidth: '115px',
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}>
                                  {sector}
                                </span>
                              </td>
                              <td style={{ maxWidth: '135px' }}>
                                <span style={{
                                  fontSize: '11px',
                                  opacity: 0.85,
                                  maxWidth: '130px',
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  lineHeight: '1.2'
                                }}>
                                  {subsector}
                                </span>
                              </td>
                              <td><span className="badge badge-neutral" style={{fontSize: '11px', padding: '2px 4px'}}>{fmtPct(pct)}</span></td>
                              <td>{fmt(h.cantidad, 0)}</td>
                              <td>${fmt(h.precioEntrada)}</td>
                              <td>
                                <strong>
                                  {pc !== null ? (isEfectivo ? '—' : `$${fmt(pc)}`) : (
                                    h.tipo === 'bono' ? (
                                      <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); editBonoPrecio(h.ticker); }}>Fijar P.</button>
                                    ) : <span style={{ fontStyle: 'italic', color: '#888' }}>cargando...</span>
                                  )}
                                </strong>
                                {stats && pc !== null && !isEfectivo && h.tipo !== 'bono' && (
                                  <div className={stats.change >= 0 ? 'positive' : 'negative'} style={{ fontSize: '11px', marginTop: '4px' }}>
                                    {fmtPct(stats.changePct)}
                                  </div>
                                )}
                              </td>
                              <td>
                                <span style={{ fontSize: '11px', opacity: 0.85 }} title={stats && (stats.updatedAt || stats.regularMarketTime) ? new Date(stats.updatedAt || stats.regularMarketTime * 1000).toLocaleString('es-AR') : ''}>
                                  {isEfectivo ? '—' : formatLastUpdated(stats)}
                                </span>
                              </td>
                              <td>{valor !== null ? '$' + fmt(valor) : '—'}</td>
                              <td className={cssPnl}>{pnlA !== null ? sign + '$' + fmt(pnlA) : '—'}</td>
                              <td className={cssPnl}><strong>{fmtPct(pnlP)}</strong></td>
                              <td>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                  <button className="btn btn-sm" title="Editar" onClick={(e) => { e.stopPropagation(); cargarEdicionHolding(h); }}>✎</button>
                                  <button className="btn btn-sm btn-danger" title="Eliminar" onClick={(e) => { e.stopPropagation(); requestEliminarHolding(h); }}>✕</button>
                                </div>
                              </td>
                            </tr>
                            {expandedTicker === h.ticker && (
                              <tr className="expanded-panel-row">
                                <td colSpan="13">
                                  <HistoricalChart data={stats} ticker={h.ticker} name={h.nombre} />
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      });
                    })()}
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
            const bySubsector = {};

            holdings.forEach(h => {
              const yt = getYahooTicker(h) || h.ticker;
              const pc = prices[yt] ?? null;
              const valor = pc !== null ? pc * h.cantidad : h.precioEntrada * h.cantidad;

              // 1. By Asset
              byAsset[h.ticker] = (byAsset[h.ticker] || 0) + valor;

              // 2. By Type
              const tipoLabel = h.tipo === 'accion' ? 'Acción AR' : h.tipo === 'stock' ? 'Stock US' : h.tipo === 'cedear' ? 'CEDEAR' : h.tipo === 'efectivo' ? 'Efectivo' : 'Bono';
              byTipo[tipoLabel] = (byTipo[tipoLabel] || 0) + valor;

              // 3. By Sector & Subsector
              const rawTicker = (h.ticker || '').toUpperCase();
              const info = tickerCatalog[rawTicker] || {};
              const { sector, subsector } = getAssetSectorAndSubsector(h.ticker, h.tipo, info);

              bySector[sector] = (bySector[sector] || 0) + valor;
              bySubsector[subsector] = (bySubsector[subsector] || 0) + valor;
            });

            // Group <1% assets into 'Otros' for % por Activo
            const threshold = totalValor * 0.01;
            const byAssetGrouped = {};
            let otrosAssetValue = 0;
            Object.entries(byAsset).forEach(([ticker, valor]) => {
              if (valor < threshold) {
                otrosAssetValue += valor;
              } else {
                byAssetGrouped[ticker] = valor;
              }
            });
            if (otrosAssetValue > 0) {
              byAssetGrouped['Otros'] = otrosAssetValue;
            }

            const toData = obj => Object.entries(obj).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);

            return (
              <div className="portfolio-charts-container">
                {/* Columna 1: % por Activo (más ancha para leyendas largas) */}
                <div className="portfolio-chart-col portfolio-chart-col--wide">
                  <PieChart data={toData(byAssetGrouped)} title="% por Activo" />
                </div>

                {/* Columna 2: % por Tipo de Activo + % por Sector (apilados) */}
                <div className="portfolio-chart-col">
                  <PieChart data={toData(byTipo)} title="% por Tipo de Activo" />
                  <PieChart data={toData(bySector)} title="% por Sector" />
                </div>

                {/* Columna 3: % por Subsector (forzando 1 columna de leyenda) */}
                <div className="portfolio-chart-col">
                  <PieChart data={toData(bySubsector)} title="% por Subsector" forceSingleColumn={true} />
                </div>
              </div>
            );
          })()}

        </>
      )}

      {/* --- TAB 2: RESUMEN PORTFOLIOS (MULTI-PORTFOLIO) --- */}
      {activeTab === 'multi-portfolio' && (() => {
        const portfolioStats = portfolios.map(p => {
          const pHoldings = allHoldings[p.id] || [];
          let totalValARS = 0;
          let totalValUSD = 0;
          let totalDailyARS = 0;
          let totalDailyUSD = 0;
          let totalCostARS = 0;
          let totalCostUSD = 0;

          pHoldings.forEach(h => {
            const isEfectivo = h.tipo === 'efectivo';
            const yt = getYahooTicker(h) || h.ticker;
            const pc = isEfectivo ? 1 : (prices[yt] ?? null);
            const stats = isEfectivo ? { change: 0, changePct: 0 } : (dailyStats[yt] ?? null);

            const isUsdAsset = h.tipo === 'stock' || (isEfectivo && h.ticker === 'USD');
            const mepToday = dolarMep || 1;

            const unitVal = pc !== null ? pc : h.precioEntrada;
            const itemVal = unitVal * h.cantidad;
            const itemCost = h.precioEntrada * h.cantidad;
            const dailyChg = stats && stats.change ? stats.change * h.cantidad : 0;

            if (isUsdAsset) {
              totalValUSD += itemVal;
              totalCostUSD += itemCost;
              totalDailyUSD += dailyChg;

              totalValARS += itemVal * mepToday;
              totalCostARS += itemCost * mepToday;
              totalDailyARS += dailyChg * mepToday;
            } else {
              totalValARS += itemVal;
              totalCostARS += itemCost;
              totalDailyARS += dailyChg;

              totalValUSD += itemVal / mepToday;
              totalCostUSD += itemCost / mepToday;
              totalDailyUSD += dailyChg / mepToday;
            }
          });

          const pFlujos = allFlujos[p.id] || [];
          const flujoData = calculatePortfolioFlujos(pFlujos, dolarMep);
          const hasPFlujos = pFlujos.length > 0;

          const pnlPosicionARS = totalValARS - totalCostARS;
          const pnlPosicionUSD = totalValUSD - totalCostUSD;
          const pnlPosicionPctARS = totalCostARS > 0 ? (pnlPosicionARS / totalCostARS) * 100 : 0;
          const pnlPosicionPctUSD = totalCostUSD > 0 ? (pnlPosicionUSD / totalCostUSD) * 100 : 0;

          const pnlTotalFlujosARS = hasPFlujos
            ? (totalValARS + flujoData.totalExtraccionesARS - flujoData.totalIngresosARS)
            : pnlPosicionARS;
          const pnlTotalFlujosPctARS = hasPFlujos && flujoData.netFondeoARS > 0
            ? (pnlTotalFlujosARS / flujoData.netFondeoARS) * 100
            : pnlPosicionPctARS;

          const pnlTotalFlujosUSD = hasPFlujos
            ? (totalValUSD + flujoData.totalExtraccionesUSD - flujoData.totalIngresosUSD)
            : pnlPosicionUSD;
          const pnlTotalFlujosPctUSD = hasPFlujos && flujoData.netFondeoUSD > 0
            ? (pnlTotalFlujosUSD / flujoData.netFondeoUSD) * 100
            : pnlPosicionPctUSD;

          const prevValUSD = totalValUSD - totalDailyUSD;
          const dailyPct = prevValUSD > 0 ? (totalDailyUSD / prevValUSD) * 100 : 0;

          return {
            id: p.id,
            name: p.name || p.id,
            activosCount: pHoldings.length,
            valARS: totalValARS,
            valUSD: totalValUSD,
            fondeoARS: hasPFlujos ? flujoData.netFondeoARS : totalCostARS,
            fondeoUSD: hasPFlujos ? flujoData.netFondeoUSD : totalCostUSD,
            hasPFlujos,
            dailyARS: totalDailyARS,
            dailyUSD: totalDailyUSD,
            dailyPct,
            pnlTotalARS: pnlTotalFlujosARS,
            pnlTotalUSD: pnlTotalFlujosUSD,
            pnlTotalPct: currencyMode === 'ARS' ? pnlTotalFlujosPctARS : pnlTotalFlujosPctUSD,
            pnlPosicionARS,
            pnlPosicionUSD,
            pnlPosicionPct: currencyMode === 'ARS' ? pnlPosicionPctARS : pnlPosicionPctUSD
          };
        });

        return (
          <div className="tab-pane active">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 className="section-title" style={{ margin: 0 }}>Resumen Comparativo de Portfolios</h2>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Vista resumida e individualizada de cada cartera de clientes
                </div>
              </div>
              <div style={{ display: 'flex', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '8px', overflow: 'hidden' }}>
                <button className={`btn btn-sm ${currencyMode === 'ARS' ? 'active' : ''}`} style={{ border: 'none', borderRadius: 0, background: currencyMode === 'ARS' ? 'var(--accent)' : 'transparent', color: currencyMode === 'ARS' ? '#fff' : 'var(--text-muted)' }} onClick={() => setCurrencyMode('ARS')}>ARS</button>
                <button className={`btn btn-sm ${currencyMode === 'USD' ? 'active' : ''}`} style={{ border: 'none', borderRadius: 0, background: currencyMode === 'USD' ? 'var(--accent)' : 'transparent', color: currencyMode === 'USD' ? '#fff' : 'var(--text-muted)' }} onClick={() => setCurrencyMode('USD')}>USD</button>
              </div>
            </div>

            {/* Tabla Comparativa Multi-Portfolio */}
            <div className="table-container" style={{ marginBottom: '2rem' }}>
              <table>
                <thead>
                  <tr>
                    <th>Portfolio</th>
                    <th>Valor Total ({currencyMode})</th>
                    <th>Fondeo ({currencyMode})</th>
                    <th>P&L Total (Fondeo)</th>
                    <th>P&L Posición</th>
                    <th>Variación Diaria ($)</th>
                    <th>Variación Diaria (%)</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolioStats.map(ps => {
                    const isSelected = ps.id === currentPortfolioId;
                    const displayVal = currencyMode === 'ARS' ? ps.valARS : ps.valUSD;
                    const displayFondeo = currencyMode === 'ARS' ? ps.fondeoARS : ps.fondeoUSD;
                    const displayDaily = currencyMode === 'ARS' ? ps.dailyARS : ps.dailyUSD;
                    const displayPnlTotal = currencyMode === 'ARS' ? ps.pnlTotalARS : ps.pnlTotalUSD;
                    const displayPnlPos = currencyMode === 'ARS' ? ps.pnlPosicionARS : ps.pnlPosicionUSD;

                    const cssDaily = ps.activosCount === 0 ? '' : (displayDaily >= 0 ? 'positive' : 'negative');
                    const cssPnlTotal = (ps.activosCount === 0 && !ps.hasPFlujos) ? '' : (displayPnlTotal >= 0 ? 'positive' : 'negative');
                    const cssPnlPos = ps.activosCount === 0 ? '' : (displayPnlPos >= 0 ? 'positive' : 'negative');

                    return (
                      <tr key={ps.id} style={{ background: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'transparent' }}>
                        <td>
                          <div style={{ fontWeight: '600', color: '#fff', fontSize: '14px' }}>
                            {ps.name} {isSelected && <span style={{ fontSize: '10px', color: 'var(--accent)', marginLeft: '6px' }}>(Activo)</span>}
                          </div>
                        </td>
                        <td><strong>{ps.activosCount > 0 ? (currencyMode === 'ARS' ? `$${fmt(displayVal)}` : `US$ ${fmt(displayVal)}`) : '—'}</strong></td>
                        <td><span style={{ color: 'var(--text-muted)', fontWeight: '500' }}>{ps.activosCount > 0 || ps.hasPFlujos ? (currencyMode === 'ARS' ? `$${fmt(displayFondeo)}` : `US$ ${fmt(displayFondeo)}`) : '—'}</span></td>
                        <td className={cssPnlTotal}>
                          {ps.activosCount > 0 || ps.hasPFlujos ? (
                            <div>
                              <div>{displayPnlTotal >= 0 ? '+' : ''}{currencyMode === 'ARS' ? `$${fmt(displayPnlTotal)}` : `US$ ${fmt(displayPnlTotal)}`}</div>
                              <span className={`badge ${displayPnlTotal >= 0 ? 'badge-compra' : 'badge-venta'}`} style={{ fontSize: '11px', marginTop: '2px' }}>{fmtPct(ps.pnlTotalPct)}</span>
                            </div>
                          ) : '—'}
                        </td>
                        <td className={cssPnlPos}>
                          {ps.activosCount > 0 ? (
                            <div>
                              <div>{displayPnlPos >= 0 ? '+' : ''}{currencyMode === 'ARS' ? `$${fmt(displayPnlPos)}` : `US$ ${fmt(displayPnlPos)}`}</div>
                              <span className={`badge ${displayPnlPos >= 0 ? 'badge-compra' : 'badge-venta'}`} style={{ fontSize: '11px', marginTop: '2px' }}>{fmtPct(ps.pnlPosicionPct)}</span>
                            </div>
                          ) : '—'}
                        </td>
                        <td className={cssDaily}>{ps.activosCount > 0 ? `${displayDaily >= 0 ? '+' : ''}${currencyMode === 'ARS' ? `$${fmt(displayDaily)}` : `US$ ${fmt(displayDaily)}`}` : '—'}</td>
                        <td>{ps.activosCount > 0 ? <span className={`badge ${displayDaily >= 0 ? 'badge-compra' : 'badge-venta'}`}>{fmtPct(ps.dailyPct)}</span> : '—'}</td>
                        <td>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => {
                              setCurrentPortfolioId(ps.id);
                              setActiveTab('portfolio');
                            }}
                          >
                            Ver Detalle 👁️
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Gráficos Comparativos Multi-Portfolio */}
            <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div className="glass-panel" style={{ padding: '1.25rem' }}>
                <div className="panel-title" style={{ fontSize: '13px', marginBottom: '1rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  📊 Rendimiento Histórico (P&L %) por Portfolio
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {portfolioStats.map(ps => (
                    <div key={ps.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                        <span style={{ fontWeight: '600' }}>{ps.name}</span>
                        <span className={ps.pnlTotalPct >= 0 ? 'positive' : 'negative'} style={{ fontWeight: '700' }}>
                          {ps.activosCount > 0 ? fmtPct(ps.pnlTotalPct) : 'Sin activos'}
                        </span>
                      </div>
                      <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: ps.activosCount > 0 ? `${Math.min(Math.max(Math.abs(ps.pnlTotalPct) * 2, 6), 100)}%` : '0%',
                            height: '100%',
                            background: ps.pnlTotalPct >= 0 ? '#10b981' : '#ef4444',
                            borderRadius: '4px',
                            transition: 'width 0.3s'
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '1.25rem' }}>
                <div className="panel-title" style={{ fontSize: '13px', marginBottom: '1rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  ⚡ Variación del Día (%) por Portfolio
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {portfolioStats.map(ps => (
                    <div key={ps.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                        <span style={{ fontWeight: '600' }}>{ps.name}</span>
                        <span className={ps.dailyPct >= 0 ? 'positive' : 'negative'} style={{ fontWeight: '700' }}>
                          {ps.activosCount > 0 ? fmtPct(ps.dailyPct) : 'Sin activos'}
                        </span>
                      </div>
                      <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: ps.activosCount > 0 ? `${Math.min(Math.max(Math.abs(ps.dailyPct) * 10, 6), 100)}%` : '0%',
                            height: '100%',
                            background: ps.dailyPct >= 0 ? '#10b981' : '#ef4444',
                            borderRadius: '4px',
                            transition: 'width 0.3s'
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Gráficos de Barras Apiladas de Composición Comparativa */}
            <MultiPortfolioCompositions
              portfolios={portfolios}
              allHoldings={allHoldings}
              prices={prices}
              dolarMep={dolarMep}
              tickerCatalog={tickerCatalog}
              currencyMode={currencyMode}
              getYahooTicker={getYahooTicker}
              onSelectPortfolio={(portfolioId) => {
                setCurrentPortfolioId(portfolioId);
                setActiveTab('portfolio');
              }}
            />
          </div>
        );
      })()}

      {/* --- TAB: OPERACIONES --- */}
      {activeTab === 'operaciones' && (() => {
        const filteredOperaciones = [...operaciones]
          .filter(op => {
            if (!searchOpTicker.trim()) return true;
            return (op.ticker || '').toLowerCase().includes(searchOpTicker.trim().toLowerCase());
          })
          .sort((a, b) => {
            if (a.fecha !== b.fecha) return b.fecha.localeCompare(a.fecha);
            return (a.ticker || '').localeCompare(b.ticker || '');
          });

        return (
          <div className="glass-panel">
            <div className="panel-header" style={{ flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: 1 }}>
                <div className="panel-title" style={{ margin: 0 }}>
                  Operaciones Históricas ({filteredOperaciones.length}{searchOpTicker.trim() ? ` / ${operaciones.length}` : ''})
                </div>
                <div style={{ position: 'relative', minWidth: '220px' }}>
                  <input
                    type="text"
                    placeholder="🔍 Buscar por ticker..."
                    value={searchOpTicker}
                    onChange={e => setSearchOpTicker(e.target.value)}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: '6px',
                      color: '#fff',
                      width: '100%'
                    }}
                  />
                  {searchOpTicker && (
                    <button
                      onClick={() => setSearchOpTicker('')}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: '#999',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                      title="Limpiar búsqueda"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => {
                if (showAddOp) {
                  cancelarEdicionOp();
                } else {
                  setEditingOpId(null);
                  setOpTicker(searchOpTicker.trim().toUpperCase() || '');
                  setOpCantidad('');
                  setOpPrecio('');
                  setShowAddOp(true);
                }
              }}>+ Registrar</button>
            </div>

            {showAddOp && (
              <div className="collapsible-content active">
                <div className="panel-title" style={{ marginBottom: '12px', fontSize: '14px' }}>
                  {editingOpId ? '✏️ Editar Operación Histórica' : 'Registrar Movimiento'}
                </div>
                <div className="form-row trio">
                  <div>
                    <label>Tipo Activo</label>
                    <select value={opAssetTipo} onChange={e => setOpAssetTipo(e.target.value)}>
                      <option value="accion">Acción AR</option>
                      <option value="cedear">CEDEAR</option>
                      <option value="stock">Stock US</option>
                      <option value="bono">Bono</option>
                      <option value="efectivo">Efectivo</option>
                    </select>
                  </div>
                  <div>
                    <label>Ticker</label>
                    <input value={opTicker} onChange={e => handleOpTickerChange(e.target.value)} list="ticker-suggestions" placeholder="GGAL" />
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
                <button className="btn btn-primary" onClick={agregarOperacion}>
                  {editingOpId ? 'Guardar Cambios' : 'Guardar Movimiento'}
                </button>
                <button className="btn" style={{ marginLeft: '8px' }} onClick={cancelarEdicionOp}>
                  Cancelar
                </button>
              </div>
            )}

            <div className="table-container">
              {operaciones.length === 0 ? (
                <div className="empty-state">Sin operaciones.</div>
              ) : filteredOperaciones.length === 0 ? (
                <div className="empty-state">
                  No se encontraron operaciones para "{searchOpTicker}".
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Activo</th>
                      <th>Detalle</th>
                      <th>Total Movido</th>
                      <th>Rendimiento Estimado</th>
                      <th style={{ width: '80px', textAlign: 'right' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOperaciones.map(op => {
                      const yt = getYahooTicker({ ticker: op.ticker, tipo: op.assetTipo || 'accion' });
                      const currentPrice = yt ? prices[yt] : (prices[op.ticker] ?? null);
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
                          <td>
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                              <button className="btn btn-sm" title="Editar operación" onClick={() => cargarEdicionOp(op)}>✎</button>
                              <button className="btn btn-sm btn-danger" title="Eliminar operación" onClick={() => eliminarOp(op.id)}>✕</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        );
      })()}

      {/* --- TAB 3: WATCHLIST --- */}
      {activeTab === 'watchlist' && (
        <>
          {/* ── Market Status Bar ── */}
          <MarketStatusBar dailyStats={dailyStats} watchlist={watchlist} />

          {/* ── Suscripción de Nuevos Activos ── */}
          <div className="glass-panel" style={{ 
            marginBottom: '16px', 
            padding: showAddWatchlist ? '1.5rem' : '0.75rem 1.5rem',
            transition: 'all 0.3s ease'
          }}>
            <div className="panel-header" style={{ 
              alignItems: 'center', 
              marginBottom: showAddWatchlist ? '1.25rem' : '0',
              transition: 'all 0.3s ease'
            }}>
              <div className="panel-title">
                {editingWatchlistOriginal ? `Editar Activo: ${editingWatchlistOriginal.ticker}` : 'Suscripción de Nuevos Activos'}
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => {
                if (showAddWatchlist) {
                  cancelarEdicionWatchlist();
                } else {
                  setShowAddWatchlist(true);
                }
              }}>
                {showAddWatchlist ? 'Ocultar Formulario' : '+ Suscribir Activo'}
              </button>
            </div>
            {showAddWatchlist && (
              <div className="collapsible-content active" style={{ marginTop: '12px' }}>
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
                    <input value={wlTicker} onChange={e => handleWlTickerChange(e.target.value)} list="ticker-suggestions" placeholder="ej: AAPL" />
                  </div>
                  <div>
                    <label>Nombre (opc.)</label>
                    <input value={wlNombre} onChange={e => setWlNombre(e.target.value)} placeholder="ej: Apple Inc" />
                  </div>
                  <div>
                    <label>Sector (ej: Tech, Banking)</label>
                    <input value={wlSector} onChange={e => setWlSector(e.target.value)} placeholder="ej: Tech" />
                  </div>
                  <div>
                    <label>Subsector</label>
                    <input value={wlSubsector} onChange={e => setWlSubsector(e.target.value)} placeholder="ej: Hardware" />
                  </div>
                  <div>
                    <label>País</label>
                    <input value={wlPais} onChange={e => setWlPais(e.target.value)} placeholder="ej: USA" />
                  </div>
                </div>
                <button className="btn btn-primary" onClick={agregarWatchlist}>
                  {editingWatchlistOriginal ? 'Guardar Cambios' : 'Guardar en Watchlist'}
                </button>
                <button className="btn" style={{ marginLeft: '8px' }} onClick={cancelarEdicionWatchlist}>
                  Cancelar
                </button>
              </div>
            )}
          </div>

          {/* ── Mode Switcher: Todos los Mercados vs Mi Cartera en Wall Street ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '6px', background: 'rgba(255,255,255,0.04)', padding: '4px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <button
                className={`btn btn-sm ${!wlPortfolioOnly ? 'btn-primary' : ''}`}
                onClick={() => setWlPortfolioOnly(false)}
                style={{
                  background: !wlPortfolioOnly ? 'var(--accent)' : 'transparent',
                  border: 'none',
                  color: !wlPortfolioOnly ? '#fff' : 'var(--text-muted)',
                  fontWeight: !wlPortfolioOnly ? '700' : '500',
                  padding: '6px 14px'
                }}
              >
                🌐 Todos los Mercados ({watchlist.length})
              </button>
              <button
                className={`btn btn-sm ${wlPortfolioOnly ? 'btn-primary' : ''}`}
                onClick={() => setWlPortfolioOnly(true)}
                style={{
                  background: wlPortfolioOnly ? 'var(--accent)' : 'transparent',
                  border: 'none',
                  color: wlPortfolioOnly ? '#fff' : 'var(--text-muted)',
                  fontWeight: wlPortfolioOnly ? '700' : '500',
                  padding: '6px 14px'
                }}
              >
                🇺🇸 Mi Cartera en Wall Street ({proxyAnalysis.mapped.length} ADRs & US)
              </button>
            </div>
            {wlPortfolioOnly && (
              <span className="badge badge-adr" style={{ fontSize: '11px', padding: '4px 10px' }}>
                🗽 Mostrando activos en USD (NYSE / NASDAQ) con cotizaciones internacionales
              </span>
            )}
          </div>

          {/* ── Treemap ──────── */}
          {(() => {
            const treemapAssets = wlPortfolioOnly
              ? proxyAnalysis.mapped.map(m => {
                  const stats = dailyStats[m.usTicker];
                  const pc = prices[m.usTicker] ?? null;
                  return {
                    ticker: m.usTicker,
                    nombre: m.name,
                    subsector: m.subsector || '',
                    yahooTicker: m.usTicker,
                    tipo: 'stock',
                    sector: m.sector || 'Sin Sector',
                    pais: m.pais || (m.isAdr ? 'Argentina' : 'USA'),
                    value: pc !== null ? pc * (m.cantidad || 1) : m.valUSD || 0,
                    changePct: stats?.changePct || 0,
                    hist5d: stats?.hist5d ?? null,
                    hist1m: stats?.hist1m ?? null,
                    hist6m: stats?.hist6m ?? null,
                    hist1y: stats?.hist1y ?? null,
                    hist5y: stats?.hist5y ?? null,
                    inPortfolio: true
                  };
                })
              : (() => {
                  const seenMap = new Map();

                  // 1. Add active holdings first (priority)
                  holdings.filter(h => h.tipo !== 'efectivo' && h.tipo !== 'bono').forEach(h => {
                    const cleanH = cleanTickerSymbol(h.ticker);
                    if (!cleanH) return;
                    const yt = getYahooTicker(h) || h.ticker;
                    const pc = prices[yt] ?? null;
                    const stats = dailyStats[yt];
                    const wlItem = watchlist.find(w => cleanTickerSymbol(w.ticker) === cleanH);

                    seenMap.set(cleanH, {
                      ticker: h.ticker,
                      nombre: h.nombre || wlItem?.nombre || '',
                      subsector: wlItem?.subsector || '',
                      yahooTicker: yt,
                      tipo: wlItem?.tipo || h.tipo || 'stock',
                      sector: wlItem?.sector || 'Sin Sector',
                      pais: wlItem?.pais || 'Argentina',
                      value: pc !== null ? pc * h.cantidad : h.precioEntrada * h.cantidad,
                      changePct: stats?.changePct || 0,
                      hist5d: stats?.hist5d ?? null,
                      hist1m: stats?.hist1m ?? null,
                      hist6m: stats?.hist6m ?? null,
                      hist1y: stats?.hist1y ?? null,
                      hist5y: stats?.hist5y ?? null,
                      inPortfolio: true
                    });
                  });

                  // 2. Add remaining watchlist items not present in holdings
                  watchlist.filter(w => w.tipo !== 'efectivo' && w.tipo !== 'bono').forEach(w => {
                    const cleanW = cleanTickerSymbol(w.ticker);
                    if (!cleanW || seenMap.has(cleanW)) return;
                    const yt = getYahooTicker(w) || w.ticker;
                    const stats = dailyStats[yt];

                    seenMap.set(cleanW, {
                      ticker: w.ticker,
                      nombre: w.nombre || '',
                      subsector: w.subsector || '',
                      yahooTicker: yt,
                      tipo: w.tipo || 'stock',
                      sector: w.sector || 'Sin Sector',
                      pais: w.pais || 'Desconocido',
                      value: 0,
                      changePct: stats?.changePct || 0,
                      hist5d: stats?.hist5d ?? null,
                      hist1m: stats?.hist1m ?? null,
                      hist6m: stats?.hist6m ?? null,
                      hist1y: stats?.hist1y ?? null,
                      hist5y: stats?.hist5y ?? null,
                      inPortfolio: false
                    });
                  });

                  return Array.from(seenMap.values());
                })();
            return <MarketTreemap assets={treemapAssets} dolarCcl={dolarCcl} />;
          })()}

          <div className="glass-panel">
            <div className="panel-header" style={{ alignItems: 'center' }}>
              <div className="panel-title">
                {wlPortfolioOnly ? `Mi Cartera en EE.UU. (${proxyAnalysis.mapped.length} ADRs & Stocks)` : `Lista de Seguimiento (${watchlist.length})`}
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', flexShrink: 0 }}>Filtros:</span>

                <button 
                  className={`btn btn-sm ${wlPortfolioOnly ? 'btn-primary' : ''}`}
                  onClick={() => setWlPortfolioOnly(!wlPortfolioOnly)}
                  style={{
                    background: wlPortfolioOnly ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
                    border: wlPortfolioOnly ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.15)',
                    color: wlPortfolioOnly ? '#fff' : 'var(--text-main)',
                    fontWeight: '600'
                  }}
                >
                  🇺🇸 Mi Cartera en EE.UU. ({proxyAnalysis.mapped.length} ADRs & US)
                </button>

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
                  options={[...new Set(baseWatchlistSource.map(w => w.sector).filter(Boolean))].sort().map(cat => ({ value: cat, label: cat }))}
                  selected={wlSectorFilters}
                  onChange={setWlSectorFilters}
                />

                <MultiCheckDropdown
                  placeholder="Todas las subcategorías"
                  options={[...new Set(baseWatchlistSource.map(w => w.subsector).filter(Boolean))].sort().map(cat => ({ value: cat, label: cat }))}
                  selected={wlSubsectorFilters}
                  onChange={setWlSubsectorFilters}
                />

                <MultiCheckDropdown
                  placeholder="Todos los países"
                  options={[...new Set(baseWatchlistSource.map(w => w.pais).filter(Boolean))].sort().map(cat => ({ value: cat, label: cat }))}
                  selected={wlPaisFilters}
                  onChange={setWlPaisFilters}
                />

                <MultiCheckDropdown
                  placeholder="Ocultar activo..."
                  options={wlVisibleBeforeExclude.map(w => ({ value: cleanTickerSymbol(w.ticker), label: w.ticker }))}
                  selected={wlExcludedTickers}
                  onChange={setWlExcludedTickers}
                />
              </div>
            </div>

            <div className="table-container">
              {wlVisibleBeforeExclude.length === 0 ? (
                <div className="empty-state">
                  {wlPortfolioOnly ? 'No se encontraron activos de tu cartera con cotización internacional.' : 'No estás siguiendo ningún activo.'}
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Activo</th>
                      <th>Tipo</th>
                      <th>Mercado</th>
                      <th>Sector</th>
                      <th>Subsector</th>
                      <th>País</th>
                      <th>P. Mercado</th>
                      <th>Últ. Actualización</th>
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
                      .filter(w => !wlExcludedTickers.includes(cleanTickerSymbol(w.ticker)))
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
                          <React.Fragment key={cleanTickerSymbol(w.ticker)}>
                            <tr className="expandable-row" onClick={() => setExpandedTicker(expandedTicker === w.ticker ? null : w.ticker)}>
                              <td>
                                <div className="ticker-name">{w.ticker}</div>
                                {w.nombre && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{w.nombre}</div>}
                              </td>
                              <td>
                                <span className={`badge ${w.isAdr ? 'badge-adr' : `badge-${w.tipo}`}`}>
                                  {w.isAdr ? 'ADR' : w.tipo === 'stock' ? 'Stock US' : w.tipo}
                                </span>
                              </td>
                              <td><span style={{ fontSize: '11px', opacity: 0.8 }}>{w.mercado || (w.tipo === 'stock' ? 'NYSE/NASDAQ' : 'BCBA')}</span></td>
                              <td><span style={{ fontSize: '11px', opacity: 0.8 }}>{w.sector || '—'}</span></td>
                              <td><span style={{ fontSize: '11px', opacity: 0.8 }}>{w.subsector || '—'}</span></td>
                              <td><span style={{ fontSize: '11px', opacity: 0.8 }}>{w.pais || '—'}</span></td>
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
                              <td>
                                <span style={{ fontSize: '11px', opacity: 0.85 }} title={stats && (stats.updatedAt || stats.regularMarketTime) ? new Date(stats.updatedAt || stats.regularMarketTime * 1000).toLocaleString('es-AR') : ''}>
                                  {formatLastUpdated(stats)}
                                </span>
                              </td>
                              <td className={todayCss}><strong>{todayText}</strong></td>
                              <td>{stats ? fmtHist(stats.hist5d) : '—'}</td>
                              <td>{stats ? fmtHist(stats.hist1m) : '—'}</td>
                              <td>{stats ? fmtHist(stats.hist6m) : '—'}</td>
                              <td>{stats ? fmtHist(stats.hist1y) : '—'}</td>
                              <td>{stats ? fmtHist(stats.hist5y) : '—'}</td>
                              <td>
                                <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                  <button 
                                    className="btn btn-sm" 
                                    onClick={(e) => { e.stopPropagation(); cargarEdicionWatchlist(w); }}
                                    title="Editar activo (sector, subsector, país, nombre)"
                                    style={{ padding: '2px 7px', fontSize: '12px' }}
                                  >
                                    ✎
                                  </button>
                                  <button 
                                    className="btn btn-sm btn-danger" 
                                    onClick={(e) => { e.stopPropagation(); eliminarWatchlist(w.ticker); }}
                                    disabled={w.isProxy}
                                    title={w.isProxy ? 'Activo de tu cartera' : 'Eliminar de watchlist'}
                                    style={{ opacity: w.isProxy ? 0.3 : 1, cursor: w.isProxy ? 'default' : 'pointer', padding: '2px 7px', fontSize: '12px' }}
                                  >
                                    {w.isProxy ? '—' : '✕'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {expandedTicker === w.ticker && (
                              <tr className="expanded-panel-row">
                                <td colSpan="15">
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
        </>
      )}

      {/* --- TAB: MERCADOS --- */}
      {activeTab === 'flujos' && (
        <div className="tab-pane active">
          <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 className="section-title">Flujos de Caja</h2>
            <button className="btn btn-primary" onClick={() => setShowAddFlujo(!showAddFlujo)}>+ Registrar Movimiento</button>
          </div>

          {(() => {
            let totalIngresosUSD = 0;
            let totalExtraccionesUSD = 0;
            
            flujos.forEach(f => {
              let usdVal = f.monto;
              if (f.moneda === 'ARS') {
                const tipoCambio = f.cotizacion || dolarMep || 1;
                usdVal = f.monto / tipoCambio;
              }
              if (f.tipo === 'ingreso') totalIngresosUSD += usdVal;
              else totalExtraccionesUSD += usdVal;
            });
            const netoUSD = totalIngresosUSD - totalExtraccionesUSD;

            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
                <div className="metric-card">
                  <div className="metric-title">Ingresos Totales (Capital)</div>
                  <div className="metric-value positive">US${fmt(totalIngresosUSD)}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-title">Extracciones Totales</div>
                  <div className="metric-value negative">US${fmt(totalExtraccionesUSD)}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-title">Flujo Neto (Capital Activo)</div>
                  <div className="metric-value">US${fmt(netoUSD)}</div>
                </div>
              </div>
            );
          })()}

          {showAddFlujo && (
            <div className="glass-panel" style={{ marginBottom: '20px', padding: '20px' }}>
              <div className="panel-title" style={{ marginBottom: '12px', fontSize: '14px' }}>
                {editingFlujoId ? '✏️ Editar Movimiento de Caja' : 'Nuevo Movimiento de Caja'}
              </div>
              <div className="form-row">
                <div>
                  <label>Fecha</label>
                  <input type="date" value={flujoFecha} onChange={e => setFlujoFecha(e.target.value)} />
                </div>
                <div>
                  <label>Tipo</label>
                  <select value={flujoTipo} onChange={e => setFlujoTipo(e.target.value)}>
                    <option value="ingreso">Ingreso (Fondeo)</option>
                    <option value="extraccion">Extracción (Retiro)</option>
                  </select>
                </div>
                <div>
                  <label>Moneda</label>
                  <select value={flujoMoneda} onChange={e => setFlujoMoneda(e.target.value)}>
                    <option value="ARS">Pesos (ARS)</option>
                    <option value="USD">Dólares (USD)</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div>
                  <label>Monto</label>
                  <input type="number" step="0.01" value={flujoMonto} onChange={e => setFlujoMonto(e.target.value)} placeholder="0.00" />
                </div>
                {flujoMoneda === 'ARS' && (
                  <div>
                    <label>Dólar Histórico ($) {dolarMep ? `(Actual: $${fmt(dolarMep)})` : ''}</label>
                    <input type="number" step="0.01" value={flujoCotizacion} onChange={e => setFlujoCotizacion(e.target.value)} placeholder="ej: 1100.50" />
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Si lo dejás vacío, usaremos el MEP en vivo actual.</div>
                  </div>
                )}
                <div style={{ flex: flujoMoneda === 'ARS' ? 1 : 2 }}>
                  <label>Nota (opcional)</label>
                  <input type="text" value={flujoNota} onChange={e => setFlujoNota(e.target.value)} placeholder="Broker local, sueldo, etc." />
                </div>
              </div>
              <div style={{ marginTop: '15px' }}>
                <button className="btn btn-primary" onClick={agregarFlujo}>{editingFlujoId ? 'Guardar Cambios' : 'Guardar Movimiento'}</button>
                <button className="btn" style={{ marginLeft: '8px' }} onClick={() => {
                  setEditingFlujoId(null);
                  setFlujoMonto('');
                  setFlujoCotizacion('');
                  setFlujoNota('');
                  setShowAddFlujo(false);
                }}>Cancelar</button>
              </div>
            </div>
          )}

          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Moneda</th>
                  <th>Monto Original</th>
                  <th>Cotización Aplicada</th>
                  <th>Equivalente USD</th>
                  <th>Nota</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {flujos.length === 0 ? (
                  <tr><td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>No hay flujos registrados</td></tr>
                ) : (
                  [...flujos].sort((a,b) => new Date(b.fecha) - new Date(a.fecha)).map(f => {
                    let usdVal = f.monto;
                    let cotiz = '—';
                    if (f.moneda === 'ARS') {
                      const tipoCambio = f.cotizacion || dolarMep || 1;
                      usdVal = f.monto / tipoCambio;
                      cotiz = `$${fmt(tipoCambio)}`;
                    }
                    return (
                      <tr key={f.id}>
                        <td>{new Date(f.fecha + 'T12:00:00Z').toLocaleDateString('es-AR')}</td>
                        <td><span className={`badge ${f.tipo === 'ingreso' ? 'badge-compra' : 'badge-venta'}`}>{f.tipo.toUpperCase()}</span></td>
                        <td>{f.moneda}</td>
                        <td><strong>${fmt(f.monto)}</strong></td>
                        <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{cotiz}</td>
                        <td className={f.tipo === 'ingreso' ? 'positive' : 'negative'}>US${fmt(usdVal)}</td>
                        <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{f.nota}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button className="btn btn-sm" title="Editar registro" onClick={() => cargarEdicionFlujo(f)}>✏️</button>
                            <button className="btn btn-sm btn-danger" title="Eliminar registro" onClick={() => eliminarFlujo(f.id)}>✕</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- TAB: HONORARIOS / ASESORÍA --- */}
      {activeTab === 'honorarios' && (
        <HonorariosDashboard
          portfolios={portfolios}
          currentPortfolioId={currentPortfolioId}
          allHoldings={allHoldings}
          allFlujos={allFlujos}
          allLiquidaciones={allLiquidaciones}
          setAllLiquidaciones={setAllLiquidaciones}
          setAllFlujos={setAllFlujos}
          prices={prices}
          dailyStats={dailyStats}
          dolarMep={dolarMep}
          fmt={fmt}
          fmtPct={fmtPct}
          getYahooTicker={getYahooTicker}
        />
      )}

      {activeTab === 'mercados' && (() => {
        const MARKET_CATEGORIES = [
          { id: 'indices', title: '📊 Índices de Mercado (Spot)', subtitle: 'Índices bursátiles de contado principales (US 500, US 30, US TECH 100, US 2000, VIX, etc.)' },
          { id: 'futuros', title: '📈 Futuros de Índices de EE.UU.', subtitle: 'Contratos de futuros e-mini (US 500, US 30, US TECH 100, US 2000, VIX) que cotizan casi 24hs al día anticipando el mercado' },
          { id: 'macro', title: '🌐 Commodities & Indicadores Macroeconómicos', subtitle: 'Tasa 10Y EE.UU., Índice Dólar (DXY), Oro, Petróleo (WTI/Brent) y Bitcoin' },
        ];

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {MARKET_CATEGORIES.map(cat => {
              const catItems = GLOBAL_INDICES.filter(i => i.category === cat.id);
              if (catItems.length === 0) return null;

              return (
                <div key={cat.id} className="glass-panel">
                  <div className="panel-header" style={{ marginBottom: '1rem' }}>
                    <div>
                      <div className="panel-title" style={{ fontSize: '18px', color: '#fff' }}>{cat.title}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{cat.subtitle}</div>
                    </div>
                    <span style={{ fontSize: '11px', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', padding: '4px 10px', borderRadius: '12px', fontWeight: '600' }}>
                      {catItems.length} activos
                    </span>
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
                        {catItems.map(idx => {
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
              );
            })}
          </div>
        );
      })()}


      {/* --- TAB INSIGHTS --- */}
      {activeTab === 'insights' && (
         <MarketInsights />
      )}

      {/* --- TAB 4: TRADES --- */}
      {activeTab === 'trades' && (
        <div className="glass-panel">
          <div className="panel-header" style={{ flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: 1 }}>
              <div className="panel-title" style={{ margin: 0 }}>Operaciones Cerradas (Trades) ({trades.length})</div>
              {trades.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative', minWidth: '220px' }}>
                    <input
                      type="text"
                      placeholder="🔍 Buscar trade por ticker o fecha..."
                      value={searchTrades}
                      onChange={e => setSearchTrades(e.target.value)}
                      style={{
                        padding: '6px 12px',
                        fontSize: '12px',
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '6px',
                        color: '#fff',
                        width: '100%'
                      }}
                    />
                    {searchTrades && (
                      <button
                        onClick={() => setSearchTrades('')}
                        style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: '12px' }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <select
                    value={tradesSortOrder}
                    onChange={e => setTradesSortOrder(e.target.value)}
                    style={{
                      padding: '6px 10px',
                      fontSize: '12px',
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: '6px',
                      color: '#fff',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="dateDesc">📅 Ordenar: 1° Compra ➔ Últ. Venta (Más recientes primero)</option>
                    <option value="dateAsc">📅 Ordenar: 1° Compra ➔ Últ. Venta (Más antiguos primero)</option>
                  </select>
                </div>
              )}
            </div>
            <button className="btn btn-primary btn-sm" onClick={abrirNuevoTradeModal}>+ Registrar Trade Cerrado</button>
          </div>

          {/* Metrics Summary Bar */}
          {trades.length > 0 && (() => {
            let totalDays = 0;
            let validCount = 0;
            let wins = 0;
            let totalProfit = 0;

            const normalizedTrades = trades.map(t => normalizeTrade(t)).filter(Boolean);

            normalizedTrades.forEach(t => {
              totalProfit += t.pnlNominal;
              if (t.pnlNominal >= 0) wins++;

              const dur = getTradeDays(t.primeraCompraFecha, t.ultimaVentaFecha);
              if (dur && dur.days >= 0) {
                totalDays += dur.days;
                validCount++;
              }
            });

            const avgDays = validCount > 0 ? Math.round(totalDays / validCount) : 0;
            const winRate = ((wins / normalizedTrades.length) * 100).toFixed(0);

            return (
              <div className="metrics-grid" style={{ marginBottom: '1.25rem', marginTop: '0.5rem' }}>
                <div className="metric-card">
                  <div className="metric-label">Trades Cerrados</div>
                  <div className="metric-value">{normalizedTrades.length}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Operaciones emparejadas</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Duración Promedio</div>
                  <div className="metric-value" style={{ color: 'var(--accent)' }}>
                    ⏱️ {avgDays} {avgDays === 1 ? 'día' : 'días'}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Tiempo medio de tenencia</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Tasa de Acierto (Win Rate)</div>
                  <div className="metric-value" style={{ color: Number(winRate) >= 50 ? 'var(--success)' : 'var(--danger)' }}>
                    {winRate}%
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{wins} ganadores de {normalizedTrades.length}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">P&L Total Cerrado</div>
                  <div className="metric-value">
                    <span className={totalProfit >= 0 ? 'positive' : 'negative'}>
                      {totalProfit >= 0 ? '+$' : '-$'}{fmt(Math.abs(totalProfit))}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Resultado neto acumulado</div>
                </div>
              </div>
            );
          })()}

          {/* Add / Edit Trade Form */}
          {showAddTrade && (() => {
            const allBuyOps = operaciones.filter(o => o.tipo === 'compra').sort((a, b) => b.fecha.localeCompare(a.fecha));
            const allSellOps = operaciones.filter(o => o.tipo === 'venta').sort((a, b) => b.fecha.localeCompare(a.fecha));

            // Extract unique tickers from operations for quick filter
            const availableTickers = Array.from(new Set(operaciones.map(o => cleanTickerSymbol(o.ticker)))).sort();

            // Filter buy ops by ticker filter and search input
            const filteredBuyOps = allBuyOps.filter(o => {
              const cleanTicker = cleanTickerSymbol(o.ticker);
              if (tradeTickerFilter && cleanTicker !== cleanTickerSymbol(tradeTickerFilter)) return false;
              if (searchCompraQuery) {
                const q = searchCompraQuery.toLowerCase();
                const matchTicker = cleanTicker.toLowerCase().includes(q) || o.ticker.toLowerCase().includes(q);
                const matchFecha = o.fecha.includes(q);
                const matchPrecio = o.precio.toString().includes(q);
                const matchCant = o.cantidad.toString().includes(q);
                return matchTicker || matchFecha || matchPrecio || matchCant;
              }
              return true;
            });

            // Filter sell ops by ticker filter and search input
            const filteredSellOps = allSellOps.filter(o => {
              const cleanTicker = cleanTickerSymbol(o.ticker);
              if (tradeTickerFilter && cleanTicker !== cleanTickerSymbol(tradeTickerFilter)) return false;
              if (searchVentaQuery) {
                const q = searchVentaQuery.toLowerCase();
                const matchTicker = cleanTicker.toLowerCase().includes(q) || o.ticker.toLowerCase().includes(q);
                const matchFecha = o.fecha.includes(q);
                const matchPrecio = o.precio.toString().includes(q);
                const matchCant = o.cantidad.toString().includes(q);
                return matchTicker || matchFecha || matchPrecio || matchCant;
              }
              return true;
            });

            // Selected objects for calculations
            const selectedBuyObjects = tradeSelectedCompraIds.map(id => operaciones.find(o => o.id === id)).filter(Boolean);
            const selectedSellObjects = tradeSelectedVentaIds.map(id => operaciones.find(o => o.id === id)).filter(Boolean);

            const totalBuyQty = selectedBuyObjects.reduce((acc, o) => acc + o.cantidad, 0);
            const totalBuyMonto = selectedBuyObjects.reduce((acc, o) => acc + (o.cantidad * o.precio), 0);
            const avgBuyPrice = totalBuyQty > 0 ? totalBuyMonto / totalBuyQty : 0;

            const totalSellQty = selectedSellObjects.reduce((acc, o) => acc + o.cantidad, 0);
            const totalSellMonto = selectedSellObjects.reduce((acc, o) => acc + (o.cantidad * o.precio), 0);
            const avgSellPrice = totalSellQty > 0 ? totalSellMonto / totalSellQty : 0;

            const previewMatchedQty = Math.min(totalBuyQty, totalSellQty);
            const previewBuyMonto = avgBuyPrice * previewMatchedQty;
            const previewSellMonto = avgSellPrice * previewMatchedQty;
            const previewDiff = previewSellMonto - previewBuyMonto;
            const previewPct = previewBuyMonto > 0 ? (previewDiff / previewBuyMonto) * 100 : 0;

            return (
              <div className="collapsible-content active" style={{ background: 'rgba(0,0,0,0.3)', padding: '1.25rem', borderRadius: '10px', border: '1px solid var(--glass-border)', marginTop: '0.5rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div className="panel-title" style={{ fontSize: '15px', color: 'var(--accent)' }}>
                    {editingTradeId ? '✏️ Editar Trade Cerrado' : '➕ Registrar Trade Cerrado (Multi-Compra / Multi-Venta)'}
                  </div>
                  {/* Ticker Filter Selector */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>Filtrar por Instrumento:</label>
                    <select
                      value={tradeTickerFilter}
                      onChange={e => setTradeTickerFilter(e.target.value)}
                      style={{ padding: '5px 10px', fontSize: '12px', background: '#16172e', border: '1px solid var(--glass-border)', borderRadius: '6px', color: '#fff' }}
                    >
                      <option value="">— Todos los tickers —</option>
                      {availableTickers.map(tk => (
                        <option key={tk} value={tk}>{tk}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {operaciones.length < 2 ? (
                  <div className="empty-state" style={{ padding: '1rem' }}>
                    Necesitás al menos dos operaciones registradas en el Histórico para crear un trade.
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', marginBottom: '1rem' }}>
                      
                      {/* COMPRAS PANEL */}
                      <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <label style={{ fontSize: '13px', fontWeight: '600', color: '#60a5fa' }}>
                            🛒 Compras / Entradas ({tradeSelectedCompraIds.length} selec.)
                          </label>
                          {tradeTickerFilter && (
                            <button
                              type="button"
                              onClick={() => {
                                const matchingIds = filteredBuyOps.map(o => o.id);
                                setTradeSelectedCompraIds(prev => Array.from(new Set([...prev, ...matchingIds])));
                              }}
                              style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline' }}
                            >
                              + Seleccionar todas ({tradeTickerFilter})
                            </button>
                          )}
                        </div>

                        <div style={{ marginBottom: '8px' }}>
                          <input
                            type="text"
                            placeholder="🔍 Buscar compras (ticker, fecha, precio)..."
                            value={searchCompraQuery}
                            onChange={e => setSearchCompraQuery(e.target.value)}
                            style={{ width: '100%', padding: '6px 10px', fontSize: '12px', background: '#16172e', border: '1px solid var(--glass-border)', borderRadius: '6px', color: '#fff' }}
                          />
                        </div>

                        {filteredBuyOps.length === 0 ? (
                          <div className="empty-state" style={{ padding: '0.75rem', fontSize: '12px' }}>No hay compras que coincidan.</div>
                        ) : (
                          <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {filteredBuyOps.map(o => {
                              const isSelected = tradeSelectedCompraIds.includes(o.id);
                              return (
                                <div
                                  key={o.id}
                                  onClick={() => toggleSelectCompraForTrade(o.id)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '6px 8px',
                                    background: isSelected ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.03)',
                                    border: isSelected ? '1px solid #3b82f6' : '1px solid transparent',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '12px'
                                  }}
                                >
                                  <input type="checkbox" checked={isSelected} readOnly style={{ cursor: 'pointer' }} />
                                  <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{o.fecha}</span>
                                  <strong style={{ color: '#fff' }}>{o.ticker.replace(/\.BA$/i, '')}</strong>
                                  <span style={{ marginLeft: 'auto', fontWeight: '500' }}>
                                    {fmt(o.cantidad, 0)} @ ${fmt(o.precio)} = ${fmt(o.cantidad * o.precio)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Selected Buys Summary */}
                        {selectedBuyObjects.length > 0 && (
                          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--glass-border)', fontSize: '12px', color: 'var(--text-muted)' }}>
                            Promedio Compra: <strong style={{ color: '#fff' }}>${fmt(avgBuyPrice)}</strong> | Cantidad Total: <strong style={{ color: '#fff' }}>{fmt(totalBuyQty, 0)}</strong>
                          </div>
                        )}
                      </div>

                      {/* VENTAS PANEL */}
                      <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <label style={{ fontSize: '13px', fontWeight: '600', color: '#f87171' }}>
                            🏷️ Ventas / Salidas ({tradeSelectedVentaIds.length} selec.)
                          </label>
                          {tradeTickerFilter && (
                            <button
                              type="button"
                              onClick={() => {
                                const matchingIds = filteredSellOps.map(o => o.id);
                                setTradeSelectedVentaIds(prev => Array.from(new Set([...prev, ...matchingIds])));
                              }}
                              style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline' }}
                            >
                              + Seleccionar todas ({tradeTickerFilter})
                            </button>
                          )}
                        </div>

                        <div style={{ marginBottom: '8px' }}>
                          <input
                            type="text"
                            placeholder="🔍 Buscar ventas (ticker, fecha, precio)..."
                            value={searchVentaQuery}
                            onChange={e => setSearchVentaQuery(e.target.value)}
                            style={{ width: '100%', padding: '6px 10px', fontSize: '12px', background: '#16172e', border: '1px solid var(--glass-border)', borderRadius: '6px', color: '#fff' }}
                          />
                        </div>

                        {filteredSellOps.length === 0 ? (
                          <div className="empty-state" style={{ padding: '0.75rem', fontSize: '12px' }}>No hay ventas que coincidan.</div>
                        ) : (
                          <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {filteredSellOps.map(o => {
                              const isSelected = tradeSelectedVentaIds.includes(o.id);
                              return (
                                <div
                                  key={o.id}
                                  onClick={() => toggleSelectVentaForTrade(o.id)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '6px 8px',
                                    background: isSelected ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.03)',
                                    border: isSelected ? '1px solid #ef4444' : '1px solid transparent',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '12px'
                                  }}
                                >
                                  <input type="checkbox" checked={isSelected} readOnly style={{ cursor: 'pointer' }} />
                                  <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{o.fecha}</span>
                                  <strong style={{ color: '#fff' }}>{o.ticker.replace(/\.BA$/i, '')}</strong>
                                  <span style={{ marginLeft: 'auto', fontWeight: '500' }}>
                                    {fmt(o.cantidad, 0)} @ ${fmt(o.precio)} = ${fmt(o.cantidad * o.precio)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Selected Sells Summary */}
                        {selectedSellObjects.length > 0 && (
                          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--glass-border)', fontSize: '12px', color: 'var(--text-muted)' }}>
                            Promedio Venta: <strong style={{ color: '#fff' }}>${fmt(avgSellPrice)}</strong> | Cantidad Total: <strong style={{ color: '#fff' }}>{fmt(totalSellQty, 0)}</strong>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Live Preview Summary Box */}
                    {tradeSelectedCompraIds.length > 0 && tradeSelectedVentaIds.length > 0 && (
                      <div style={{ padding: '12px 16px', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: '8px', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', fontSize: '13px' }}>
                        <div>
                          <strong>Previsualización de Posición:</strong>
                          <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--text-muted)' }}>
                            Promedio Compra: <strong>${fmt(avgBuyPrice)}</strong> ({selectedBuyObjects.length} compras) · Promedio Venta: <strong>${fmt(avgSellPrice)}</strong> ({selectedSellObjects.length} ventas)
                          </div>
                        </div>
                        <div>
                          Resultado Estimado: {' '}
                          <strong className={previewDiff >= 0 ? 'positive' : 'negative'} style={{ fontSize: '15px' }}>
                            {fmtPct(previewPct)} ({previewDiff >= 0 ? '+' : '-'}${fmt(Math.abs(previewDiff))})
                          </strong>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>
                            ({fmt(previewMatchedQty, 0)} nom. emparejados)
                          </span>
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn btn-primary" onClick={guardarTrade}>
                        {editingTradeId ? 'Guardar Cambios' : 'Guardar Trade Cerrado'}
                      </button>
                      <button className="btn" onClick={() => { setShowAddTrade(false); setEditingTradeId(null); }}>
                        Cancelar
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })()}

          {/* Trade Cards */}
          {trades.length === 0 && !showAddTrade ? (
            <div className="empty-state">
              Sin operaciones cerradas registradas todavía. Agregá un trade para comenzar.
            </div>
          ) : (() => {
            const filteredTrades = trades.map(t => normalizeTrade(t)).filter(Boolean).filter(t => {
              if (!searchTrades) return true;
              const q = searchTrades.toLowerCase();
              const matchTicker = (t.ticker || '').toLowerCase().includes(q);
              const matchCompraFecha = (t.primeraCompraFecha || '').includes(q);
              const matchVentaFecha = (t.ultimaVentaFecha || '').includes(q);
              return matchTicker || matchCompraFecha || matchVentaFecha;
            });

            // Sort trades by Criterion 1: primeraCompraFecha, Criterion 2: ultimaVentaFecha
            filteredTrades.sort((a, b) => {
              const dateA1 = a.primeraCompraFecha || '';
              const dateB1 = b.primeraCompraFecha || '';
              const dateA2 = a.ultimaVentaFecha || '';
              const dateB2 = b.ultimaVentaFecha || '';

              if (tradesSortOrder === 'dateAsc') {
                const comp1 = dateA1.localeCompare(dateB1);
                if (comp1 !== 0) return comp1;
                return dateA2.localeCompare(dateB2);
              } else {
                const comp1 = dateB1.localeCompare(dateA1);
                if (comp1 !== 0) return comp1;
                return dateB2.localeCompare(dateA2);
              }
            });

            if (filteredTrades.length === 0 && searchTrades) {
              return (
                <div className="empty-state">
                  No se encontraron trades cerrados que coincidan con "{searchTrades}".
                </div>
              );
            }

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
                {filteredTrades.map(trade => {
                  const isPos = trade.pnlNominal >= 0;
                  const duration = getTradeDays(trade.primeraCompraFecha, trade.ultimaVentaFecha);

                  // Annualized return (TNA simple equivalent)
                  let annualizedPct = null;
                  if (duration && duration.days > 0) {
                    annualizedPct = (trade.pnlPct / duration.days) * 365;
                  }

                  const isExpanded = expandedTradeIds.includes(trade.id);

                  return (
                    <div key={trade.id} className="glass-panel" style={{ background: 'rgba(0,0,0,0.2)', position: 'relative' }}>
                      {/* Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                          <h3 style={{ fontSize: '15px', marginBottom: '4px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                            <span style={{ opacity: 0.7 }}>{trade.primeraCompraFecha} → {trade.ultimaVentaFecha}</span>
                            {duration && (
                              <span style={{ 
                                padding: '2px 8px', 
                                borderRadius: '12px', 
                                fontSize: '11px', 
                                fontWeight: '600', 
                                backgroundColor: 'rgba(99, 102, 241, 0.15)', 
                                color: 'var(--accent)',
                                border: '1px solid rgba(99, 102, 241, 0.3)'
                              }}>
                                ⏱️ {duration.label}
                              </span>
                            )}
                            · Trade Cerrado: <span style={{ color: 'var(--accent)' }}>{trade.ticker}</span>
                          </h3>
                          <p className="hint">
                            Prom. Compra: <strong>${fmt(trade.avgCompraPrecio)}</strong> ({trade.compras.length} {trade.compras.length === 1 ? 'compra' : 'compras'}) · Prom. Venta: <strong>${fmt(trade.avgVentaPrecio)}</strong> ({trade.ventas.length} {trade.ventas.length === 1 ? 'venta' : 'ventas'})
                          </p>
                        </div>

                        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                          <button className="btn btn-sm" onClick={() => editarTrade(trade.id)} title="Editar Trade" style={{ padding: '4px 8px' }}>
                            ✏️ Editar
                          </button>
                          <button className="btn btn-sm btn-danger" onClick={() => eliminarTrade(trade.id)} title="Eliminar Trade">
                            ✕
                          </button>
                        </div>
                      </div>

                      {/* Main Metrics Output */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '14px' }}>
                        <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                          <div>
                            Promedio Compra: <strong>${fmt(trade.avgCompraPrecio)}</strong> ({fmt(trade.totalCompraQty, 0)} nom.)
                            {' ➔ '}
                            Promedio Venta: <strong>${fmt(trade.avgVentaPrecio)}</strong> ({fmt(trade.totalVentaQty, 0)} nom.)
                            {trade.totalCompraQty !== trade.totalVentaQty && (
                              <div className="hint" style={{ marginTop: '4px' }}>
                                Total Comprado: {fmt(trade.totalCompraQty, 0)} | Total Vendido: {fmt(trade.totalVentaQty, 0)}. Cálculo basado en {fmt(trade.matchedQty, 0)} nominales emparejados.
                              </div>
                            )}
                          </div>
                          {duration && (
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '6px' }}>
                              Duración: <strong style={{ color: '#fff' }}>{duration.label}</strong>
                            </div>
                          )}
                        </div>

                        <div style={{ padding: '16px', background: isPos ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', border: `1px solid ${isPos ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`, borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                          <div>
                            Resultado del Trade:{' '}
                            <strong className={isPos ? 'positive' : 'negative'} style={{ fontSize: '18px' }}>
                              {fmtPct(trade.pnlPct)} ({isPos ? '+' : '-'}${fmt(Math.abs(trade.pnlNominal))})
                            </strong>
                            {dolarMep && (
                              <span style={{ fontSize: '14px', fontWeight: '400', opacity: 0.8, marginLeft: '10px' }}>
                                ≈ US$ {fmt(Math.abs(trade.pnlNominal) / dolarMep)}
                              </span>
                            )}
                          </div>

                          {annualizedPct !== null && (
                            <div style={{ fontSize: '13px', textAlign: 'right', opacity: 0.9 }}>
                              <span className="hint">Rend. Anualizado (TNA eq.): </span>
                              <strong className={annualizedPct >= 0 ? 'positive' : 'negative'}>
                                {fmtPct(annualizedPct)} p.a.
                              </strong>
                            </div>
                          )}
                        </div>

                        {/* Expandable Operation Breakdown */}
                        <div style={{ marginTop: '4px' }}>
                          <button
                            onClick={() => toggleExpandedTrade(trade.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--accent)',
                              fontSize: '12px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: 0
                            }}
                          >
                            {isExpanded ? '▼ Ocultar detalle de ejecuciones' : `▶ Ver detalle de ejecuciones (${trade.compras.length} compras, ${trade.ventas.length} ventas)`}
                          </button>

                          {isExpanded && (
                            <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '6px', border: '1px solid var(--glass-border)' }}>
                              <div>
                                <div style={{ fontSize: '12px', fontWeight: '600', color: '#60a5fa', marginBottom: '6px' }}>🛒 Compras ({trade.compras.length})</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px' }}>
                                  {trade.compras.map((c, idx) => (
                                    <div key={c.id || idx} style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.03)', padding: '4px 8px', borderRadius: '4px' }}>
                                      <span>{c.fecha}</span>
                                      <strong>{fmt(c.cantidad, 0)} @ ${fmt(c.precio)}</strong>
                                      <span style={{ color: 'var(--text-muted)' }}>=${fmt(c.cantidad * c.precio)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <div style={{ fontSize: '12px', fontWeight: '600', color: '#f87171', marginBottom: '6px' }}>🏷️ Ventas ({trade.ventas.length})</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px' }}>
                                  {trade.ventas.map((v, idx) => (
                                    <div key={v.id || idx} style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.03)', padding: '4px 8px', borderRadius: '4px' }}>
                                      <span>{v.fecha}</span>
                                      <strong>{fmt(v.cantidad, 0)} @ ${fmt(v.precio)}</strong>
                                      <span style={{ color: 'var(--text-muted)' }}>=${fmt(v.cantidad * v.precio)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* --- TAB 5: EVALUACIÓN --- */}
      {activeTab === 'evaluacion' && (
        <div className="glass-panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">Evaluación de Rotaciones de Portfolio ({evals.length})</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Agrupá compras y ventas para evaluar el rendimiento neto de tus rotaciones de cartera a lo largo del tiempo.
              </div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={abrirNuevaEvalModal}>
              + Nueva Evaluación / Rotación
            </button>
          </div>

          {showAddEval && (
            <div className="collapsible-content active" style={{ background: 'rgba(0,0,0,0.3)', padding: '1.25rem', borderRadius: '10px', border: '1px solid var(--glass-border)', marginTop: '1rem' }}>
              <div className="panel-title" style={{ marginBottom: '12px', fontSize: '15px', color: '#6366f1' }}>
                {editingGroupId ? '✏️ Editar Evaluación / Rotación' : '➕ Crear Nueva Evaluación / Rotación'}
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600' }}>Nombre / Título de la Rotación</label>
                  <input 
                    type="text"
                    className="form-control"
                    placeholder="Ej: Rotación Bancos -> Cedears Tech (Julio 2026)" 
                    value={evalNombre} 
                    onChange={e => setEvalNombre(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', background: '#16172e', border: '1px solid var(--glass-border)', borderRadius: '6px', color: '#fff' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600' }}>Fecha</label>
                  <input 
                    type="date"
                    className="form-control"
                    value={evalFecha} 
                    onChange={e => setEvalFecha(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', background: '#16172e', border: '1px solid var(--glass-border)', borderRadius: '6px', color: '#fff' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600' }}>Notas / Racional de Inversión (Opcional)</label>
                  <input 
                    type="text"
                    className="form-control"
                    placeholder="Ej: Venta de GGAL y BMA para financiar compras de NVDA y AMD" 
                    value={evalNotas} 
                    onChange={e => setEvalNotas(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', background: '#16172e', border: '1px solid var(--glass-border)', borderRadius: '6px', color: '#fff' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '600' }}>
                    Seleccionar Operaciones para incluir en este Grupo ({evalSelectedOpIds.length} seleccionadas)
                  </label>
                  <input 
                    type="text"
                    placeholder="Filtrar por ticker o fecha..."
                    value={evalOpSearch}
                    onChange={e => setEvalOpSearch(e.target.value)}
                    style={{ padding: '4px 8px', fontSize: '12px', background: '#16172e', border: '1px solid var(--glass-border)', borderRadius: '4px', color: '#fff', width: '220px' }}
                  />
                </div>

                {operaciones.length === 0 ? (
                  <div className="empty-state" style={{ padding: '1rem' }}>No hay operaciones en el histórico para evaluar.</div>
                ) : (
                  <div style={{ maxHeight: '240px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: '6px', padding: '8px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '6px' }}>
                      {[...operaciones]
                        .sort((a, b) => b.fecha.localeCompare(a.fecha))
                        .filter(o => !evalOpSearch || o.ticker.toLowerCase().includes(evalOpSearch.toLowerCase()) || o.fecha.includes(evalOpSearch) || o.tipo.includes(evalOpSearch))
                        .map(o => {
                          const isSelected = evalSelectedOpIds.includes(o.id);
                          return (
                            <div 
                              key={o.id} 
                              onClick={() => toggleSelectOpForEval(o.id)}
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '8px', 
                                padding: '6px 10px', 
                                background: isSelected ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.03)', 
                                border: isSelected ? '1px solid #6366f1' : '1px solid transparent',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                transition: 'all 0.15s'
                              }}
                            >
                              <input 
                                type="checkbox" 
                                checked={isSelected} 
                                onChange={() => {}} 
                                style={{ cursor: 'pointer' }}
                              />
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{o.fecha}</span>
                              <strong style={{ fontSize: '13px', color: '#fff', minWidth: '60px' }}>{o.ticker.replace(/\.BA$/i, '')}</strong>
                              <span className={`badge badge-${o.tipo}`} style={{ fontSize: '10px', padding: '2px 6px' }}>{o.tipo.toUpperCase()}</span>
                              <span style={{ fontSize: '11px', marginLeft: 'auto', fontWeight: '500' }}>
                                {fmt(o.cantidad, 0)} @ ${fmt(o.precio)}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button className="btn btn-primary" onClick={guardarEvalGroup}>
                  {editingGroupId ? 'Guardar Cambios' : 'Crear Evaluación de Rotación'}
                </button>
                <button className="btn" onClick={() => { setShowAddEval(false); setEditingGroupId(null); }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {evals.length === 0 && !showAddEval ? (
            <div className="empty-state" style={{ marginTop: '1.5rem', padding: '3rem 1rem' }}>
              <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>No hay evaluaciones de rotación creadas todavía.</div>
              <p className="hint">Creá un grupo de evaluación seleccionando operaciones de compra y venta para medir el resultado neto de tus decisiones de cartera.</p>
              <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={abrirNuevaEvalModal}>
                + Crear Primera Evaluación de Rotación
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1.5rem' }}>
              {evals.map(group => {
                const groupOps = (group.opIds || []).map(id => operaciones.find(o => o.id === id)).filter(Boolean);
                const comprasOps = groupOps
                  .filter(o => o.tipo === 'compra')
                  .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '') || (a.ticker || '').localeCompare(b.ticker || ''));
                const ventasOps = groupOps
                  .filter(o => o.tipo === 'venta')
                  .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '') || (a.ticker || '').localeCompare(b.ticker || ''));

                let groupBuyCost = 0;
                let groupBuyValue = 0;
                let groupSellProceeds = 0;
                let groupSellValue = 0;

                comprasOps.forEach(op => {
                  const yt = getYahooTicker({ ticker: op.ticker, tipo: op.assetTipo || 'accion' });
                  const curPrice = yt ? prices[yt] : (prices[op.ticker] ?? null);
                  const cost = op.precio * op.cantidad;
                  groupBuyCost += cost;
                  if (curPrice !== null) {
                    groupBuyValue += curPrice * op.cantidad;
                  } else {
                    groupBuyValue += cost;
                  }
                });

                ventasOps.forEach(op => {
                  const yt = getYahooTicker({ ticker: op.ticker, tipo: op.assetTipo || 'accion' });
                  const curPrice = yt ? prices[yt] : (prices[op.ticker] ?? null);
                  const proceed = op.precio * op.cantidad;
                  groupSellProceeds += proceed;
                  if (curPrice !== null) {
                    groupSellValue += curPrice * op.cantidad;
                  } else {
                    groupSellValue += proceed;
                  }
                });

                const buyPnL = groupBuyValue - groupBuyCost;
                const salePnL = groupSellProceeds - groupSellValue; // Positive if sold above current price
                const netGroupPnL = buyPnL + salePnL;
                const baseDenom = groupBuyCost + groupSellValue;
                const netGroupPct = baseDenom > 0 ? (netGroupPnL / baseDenom) * 100 : 0;
                const isGroupPos = netGroupPnL >= 0;

                return (
                  <div 
                    key={group.id} 
                    className="glass-panel" 
                    style={{ 
                      background: 'rgba(15, 16, 35, 0.6)', 
                      border: '1px solid var(--glass-border)', 
                      padding: '1.25rem',
                      opacity: group.excluded ? 0.5 : 1,
                      transition: 'all 0.2s'
                    }}
                  >
                    {/* Header del Grupo de Evaluación */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '18px', fontWeight: '700', color: '#fff' }}>{group.nombre}</span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px' }}>
                            {group.fecha}
                          </span>
                          {comprasOps.length > 0 && ventasOps.length > 0 ? (
                            <span style={{ fontSize: '10px', background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', padding: '2px 8px', borderRadius: '12px', fontWeight: '600' }}>
                              ROTACIÓN DE CARTERA
                            </span>
                          ) : comprasOps.length > 0 ? (
                            <span style={{ fontSize: '10px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '2px 8px', borderRadius: '12px', fontWeight: '600' }}>
                              GRUPO DE COMPRAS
                            </span>
                          ) : (
                            <span style={{ fontSize: '10px', background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', padding: '2px 8px', borderRadius: '12px', fontWeight: '600' }}>
                              GRUPO DE VENTAS
                            </span>
                          )}
                        </div>
                        {group.notas && (
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', fontStyle: 'italic' }}>
                            💡 {group.notas}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label className="mcd-option" style={{ margin: 0, padding: '4px 10px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', border: '1px solid var(--glass-border)', cursor: 'pointer' }}>
                          <input 
                            type="checkbox" 
                            checked={!group.excluded} 
                            onChange={() => toggleEvalExclusion(group.id)} 
                            style={{ width: '13px', height: '13px' }} 
                          />
                          <span style={{ fontSize: '11px', marginLeft: '6px' }}>Incluir en Totales</span>
                        </label>
                        <button className="btn btn-sm" onClick={() => abrirEditarEvalModal(group)} style={{ fontSize: '11px', padding: '4px 10px' }}>
                          ✏️ Editar
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => eliminarEvalGroup(group.id)} style={{ fontSize: '11px', padding: '4px 8px' }}>
                          ✕
                        </button>
                      </div>
                    </div>

                    {/* Detalle de Operaciones en el Grupo */}
                    <div style={{ display: 'grid', gridTemplateColumns: comprasOps.length > 0 && ventasOps.length > 0 ? '1fr 1fr' : '1fr', gap: '1rem' }}>
                      
                      {/* Sección Compras */}
                      {comprasOps.length > 0 && (
                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
                          <div style={{ fontSize: '12px', fontWeight: '700', color: '#34d399', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                            <span>🛒 COMPRAS REALIZADAS ({comprasOps.length})</span>
                            <span>Invertido: ${fmt(groupBuyCost)}</span>
                          </div>
                          <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.05)', textAlign: 'left' }}>
                                <th style={{ padding: '4px' }}>Fecha</th>
                                <th style={{ padding: '4px' }}>Ticker</th>
                                <th style={{ padding: '4px', textAlign: 'right' }}>Cant. @ Precio</th>
                                <th style={{ padding: '4px', textAlign: 'right' }}>Total Operado</th>
                                <th style={{ padding: '4px', textAlign: 'right' }}>Actual</th>
                                <th style={{ padding: '4px', textAlign: 'right' }}>Resultado</th>
                              </tr>
                            </thead>
                            <tbody>
                              {comprasOps.map(op => {
                                const yt = getYahooTicker({ ticker: op.ticker, tipo: op.assetTipo || 'accion' });
                                const curPrice = yt ? prices[yt] : (prices[op.ticker] ?? null);
                                const diff = curPrice !== null ? curPrice - op.precio : null;
                                const pct = diff !== null ? (diff / op.precio) * 100 : null;
                                const pnl = diff !== null ? diff * op.cantidad : null;
                                const isPos = pnl >= 0;
                                const opTotal = op.precio * op.cantidad;

                                return (
                                  <tr key={op.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                    <td style={{ padding: '4px', color: 'var(--text-muted)', fontSize: '11px', whiteSpace: 'nowrap' }}>{op.fecha}</td>
                                    <td style={{ padding: '4px 0', fontWeight: '600' }}>{op.ticker.replace(/\.BA$/i, '')}</td>
                                    <td style={{ padding: '4px', textAlign: 'right' }}>{fmt(op.cantidad, 0)} @ ${fmt(op.precio)}</td>
                                    <td style={{ padding: '4px', textAlign: 'right', fontWeight: '600' }}>${fmt(opTotal)}</td>
                                    <td style={{ padding: '4px', textAlign: 'right' }}>{curPrice !== null ? `$${fmt(curPrice)}` : '—'}</td>
                                    <td style={{ padding: '4px', textAlign: 'right' }} className={isPos ? 'positive' : 'negative'}>
                                      {pnl !== null ? `${fmtPct(pct)} (${isPos ? '+' : '-'}${fmt(Math.abs(pnl))})` : '—'}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot style={{ borderTop: '1px solid rgba(255,255,255,0.15)', fontWeight: '700' }}>
                              <tr>
                                <td colSpan={2} style={{ padding: '6px 0', color: '#fff' }}>TOTAL COMPRAS</td>
                                <td style={{ padding: '6px', textAlign: 'right', color: 'var(--text-muted)' }}>—</td>
                                <td style={{ padding: '6px', textAlign: 'right', color: '#fff' }}>${fmt(groupBuyCost)}</td>
                                <td style={{ padding: '6px', textAlign: 'right', color: '#fff' }}>${fmt(groupBuyValue)}</td>
                                <td style={{ padding: '6px', textAlign: 'right' }} className={buyPnL >= 0 ? 'positive' : 'negative'}>
                                  {fmtPct(groupBuyCost > 0 ? (buyPnL / groupBuyCost) * 100 : 0)} ({buyPnL >= 0 ? '+' : '-'}${fmt(Math.abs(buyPnL))})
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}

                      {/* Sección Ventas */}
                      {ventasOps.length > 0 && (
                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                          <div style={{ fontSize: '12px', fontWeight: '700', color: '#f87171', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                            <span>🏷️ VENTAS REALIZADAS ({ventasOps.length})</span>
                            <span>Liberado: ${fmt(groupSellProceeds)}</span>
                          </div>
                          <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.05)', textAlign: 'left' }}>
                                <th style={{ padding: '4px' }}>Fecha</th>
                                <th style={{ padding: '4px' }}>Ticker</th>
                                <th style={{ padding: '4px', textAlign: 'right' }}>Cant. @ Venta</th>
                                <th style={{ padding: '4px', textAlign: 'right' }}>Total Operado</th>
                                <th style={{ padding: '4px', textAlign: 'right' }}>Actual</th>
                                <th style={{ padding: '4px', textAlign: 'right' }}>Resultado</th>
                              </tr>
                            </thead>
                            <tbody>
                              {ventasOps.map(op => {
                                const yt = getYahooTicker({ ticker: op.ticker, tipo: op.assetTipo || 'accion' });
                                const curPrice = yt ? prices[yt] : (prices[op.ticker] ?? null);
                                const diff = curPrice !== null ? op.precio - curPrice : null; // Positive if sold above current price
                                const pct = curPrice !== null ? ((op.precio - curPrice) / op.precio) * 100 : null;
                                const oppPnL = diff !== null ? diff * op.cantidad : null;
                                const isGoodSale = oppPnL >= 0;
                                const opTotal = op.precio * op.cantidad;

                                return (
                                  <tr key={op.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                    <td style={{ padding: '4px', color: 'var(--text-muted)', fontSize: '11px', whiteSpace: 'nowrap' }}>{op.fecha}</td>
                                    <td style={{ padding: '4px 0', fontWeight: '600' }}>{op.ticker.replace(/\.BA$/i, '')}</td>
                                    <td style={{ padding: '4px', textAlign: 'right' }}>{fmt(op.cantidad, 0)} @ ${fmt(op.precio)}</td>
                                    <td style={{ padding: '4px', textAlign: 'right', fontWeight: '600' }}>${fmt(opTotal)}</td>
                                    <td style={{ padding: '4px', textAlign: 'right' }}>{curPrice !== null ? `$${fmt(curPrice)}` : '—'}</td>
                                    <td style={{ padding: '4px', textAlign: 'right' }} className={isGoodSale ? 'positive' : 'negative'}>
                                      {oppPnL !== null ? `${fmtPct(pct)} (${isGoodSale ? '+' : '-'}${fmt(Math.abs(oppPnL))})` : '—'}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot style={{ borderTop: '1px solid rgba(255,255,255,0.15)', fontWeight: '700' }}>
                              <tr>
                                <td colSpan={2} style={{ padding: '6px 0', color: '#fff' }}>TOTAL VENTAS</td>
                                <td style={{ padding: '6px', textAlign: 'right', color: 'var(--text-muted)' }}>—</td>
                                <td style={{ padding: '6px', textAlign: 'right', color: '#fff' }}>${fmt(groupSellProceeds)}</td>
                                <td style={{ padding: '6px', textAlign: 'right', color: '#fff' }}>${fmt(groupSellValue)}</td>
                                <td style={{ padding: '6px', textAlign: 'right' }} className={salePnL >= 0 ? 'positive' : 'negative'}>
                                  {fmtPct(groupSellProceeds > 0 ? (salePnL / groupSellProceeds) * 100 : 0)} ({salePnL >= 0 ? '+' : '-'}${fmt(Math.abs(salePnL))})
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}

                    </div>

                    {/* Resumen Neto de la Rotación */}
                    <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        Impacto Neto de esta Evaluación / Rotación:
                      </div>
                      <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          Resultado Combinado:
                        </div>
                        <div className={isGroupPos ? 'positive' : 'negative'} style={{ fontSize: '18px', fontWeight: '800' }}>
                          {fmtPct(netGroupPct)} ({isGroupPos ? '+' : '-'}${fmt(Math.abs(netGroupPnL))})
                          {dolarMep && (
                            <span style={{ fontSize: '12px', fontWeight: '400', opacity: 0.8, marginLeft: '8px' }}>
                              ≈ US$ {fmt(Math.abs(netGroupPnL) / dolarMep)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

          {/* Panel Consolidado Total de Evaluaciones Activas */}
          {evals.filter(e => !e.excluded).length > 0 && (() => {
            let totalNetPnL = 0;
            let totalBuyVol = 0;
            let totalSellVol = 0;

            evals.filter(e => !e.excluded).forEach(group => {
              const groupOps = (group.opIds || []).map(id => operaciones.find(o => o.id === id)).filter(Boolean);
              
              groupOps.forEach(op => {
                const yt = getYahooTicker({ ticker: op.ticker, tipo: op.assetTipo || 'accion' });
                const curPrice = yt ? prices[yt] : (prices[op.ticker] ?? null);
                const opTotal = op.precio * op.cantidad;

                if (op.tipo === 'compra') {
                  totalBuyVol += opTotal;
                  if (curPrice !== null) {
                    totalNetPnL += (curPrice - op.precio) * op.cantidad;
                  }
                } else {
                  totalSellVol += opTotal;
                  if (curPrice !== null) {
                    totalNetPnL += (op.precio - curPrice) * op.cantidad;
                  }
                }
              });
            });

            const totalVol = totalBuyVol + totalSellVol;
            const netPct = totalBuyVol > 0 ? (totalNetPnL / totalBuyVol) * 100 : 0;
            const isPos = totalNetPnL >= 0;

            return (
              <div className="glass-panel" style={{ marginTop: '2rem', background: 'rgba(94, 106, 210, 0.08)', border: '1px solid rgba(94, 106, 210, 0.25)', padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div className="panel-title" style={{ fontSize: '18px', marginBottom: '4px' }}>
                      🌐 Resultado Neto Consolidado de las Evaluaciones Activas
                    </div>
                    <p className="hint" style={{ fontSize: '12px' }}>
                      Rendimiento total sumando todas las rotaciones y grupos de evaluación activos.
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Impacto Neto Total</div>
                    <div className={isPos ? 'positive' : 'negative'} style={{ fontSize: '28px', fontWeight: '800' }}>
                      {fmtPct(netPct)} ({isPos ? '+' : '-'}${fmt(Math.abs(totalNetPnL))})
                      {dolarMep && (
                        <span style={{ fontSize: '14px', fontWeight: '400', opacity: 0.8, marginLeft: '10px' }}>
                          ≈ US$ {fmt(Math.abs(totalNetPnL) / dolarMep)}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Volumen Compras: ${fmt(totalBuyVol)} · Volumen Ventas: ${fmt(totalSellVol)} (Total: ${fmt(totalVol)})
                    </div>
                </div>
              </div>
            </div>
          );
          })()}
        </div>
      )}

      {holdingToDelete && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(3px)' }}>
          <div className="glass-panel" style={{ width: '420px', padding: '24px', backgroundColor: 'var(--bg-main)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '8px' }}>Eliminar {holdingToDelete.ticker}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '20px' }}>¿Por qué querés eliminar este activo de tu portfolio?</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ padding: '16px', border: '1px solid var(--accent)', borderRadius: '8px', backgroundColor: 'rgba(99, 102, 241, 0.05)' }}>
                <p style={{ margin: '0 0 12px 0', fontSize: '13px' }}><strong>Vendí toda la posición</strong> <br/><span style={{opacity: 0.8}}>(Se registrará una venta por {holdingToDelete.cantidad} nominales en Operaciones)</span></p>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input type="number" placeholder="Precio Venta ($)" step="0.01" value={sellPriceForDelete} onChange={e => setSellPriceForDelete(e.target.value)} style={{ flex: 1 }} />
                  <button className="btn btn-primary" onClick={() => confirmEliminarHolding(true)}>Registrar Venta</button>
                </div>
              </div>

              <button className="btn" onClick={() => confirmEliminarHolding(false)}>Fue un error de carga (Solo borrar)</button>
            </div>
            
            <button className="btn" style={{ marginTop: '16px', width: '100%', border: 'none', background: 'transparent' }} onClick={() => setHoldingToDelete(null)}>Cancelar</button>
          </div>
        </div>
      )}

      {activeTab === 'api-dashboard' && (
        <div className="tab-content fade-in">
          <ApiUsageDashboard />
        </div>
      )}

    </div>
  );
}

export default App;
