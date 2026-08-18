/**
 * International Market Proxy Service
 * Maps Argentine equities to US ADRs and resolves CEDEARs to their US underlying stocks.
 */

// Argentine BCBA Equities to US ADR Ticker mapping
export const ARG_TO_US_ADR_MAP = {
  'YPFD': { usTicker: 'YPF', name: 'YPF S.A. (ADR)', mercado: 'NYSE', pais: 'Argentina', sector: 'Energía', subsector: 'Petróleo y Gas' },
  'YPF': { usTicker: 'YPF', name: 'YPF S.A. (ADR)', mercado: 'NYSE', pais: 'Argentina', sector: 'Energía', subsector: 'Petróleo y Gas' },
  'GGAL': { usTicker: 'GGAL', name: 'Grupo Financiero Galicia (ADR)', mercado: 'NASDAQ', pais: 'Argentina', sector: 'Banking', subsector: 'Bancos' },
  'BMA': { usTicker: 'BMA', name: 'Banco Macro (ADR)', mercado: 'NYSE', pais: 'Argentina', sector: 'Banking', subsector: 'Bancos' },
  'BBAR': { usTicker: 'BBAR', name: 'BBVA Argentina (ADR)', mercado: 'NYSE', pais: 'Argentina', sector: 'Banking', subsector: 'Bancos' },
  'SUPV': { usTicker: 'SUPV', name: 'Grupo Supervielle (ADR)', mercado: 'NYSE', pais: 'Argentina', sector: 'Banking', subsector: 'Bancos' },
  'PAMP': { usTicker: 'PAM', name: 'Pampa Energía (ADR)', mercado: 'NYSE', pais: 'Argentina', sector: 'Energía', subsector: 'Energía Integrada' },
  'PAM': { usTicker: 'PAM', name: 'Pampa Energía (ADR)', mercado: 'NYSE', pais: 'Argentina', sector: 'Energía', subsector: 'Energía Integrada' },
  'TGSU2': { usTicker: 'TGS', name: 'Transportadora de Gas del Sur (ADR)', mercado: 'NYSE', pais: 'Argentina', sector: 'Energía', subsector: 'Gas Utility' },
  'TGS': { usTicker: 'TGS', name: 'Transportadora de Gas del Sur (ADR)', mercado: 'NYSE', pais: 'Argentina', sector: 'Energía', subsector: 'Gas Utility' },
  'TECO2': { usTicker: 'TEO', name: 'Telecom Argentina (ADR)', mercado: 'NYSE', pais: 'Argentina', sector: 'Telecomunicaciones', subsector: 'Telecomunicaciones' },
  'TEO': { usTicker: 'TEO', name: 'Telecom Argentina (ADR)', mercado: 'NYSE', pais: 'Argentina', sector: 'Telecomunicaciones', subsector: 'Telecomunicaciones' },
  'EDN': { usTicker: 'EDN', name: 'Edenor (ADR)', mercado: 'NYSE', pais: 'Argentina', sector: 'Energía', subsector: 'Distribución Eléctrica' },
  'CEPU': { usTicker: 'CEPU', name: 'Central Puerto (ADR)', mercado: 'NYSE', pais: 'Argentina', sector: 'Energía', subsector: 'Generación Eléctrica' },
  'CRES': { usTicker: 'CRES', name: 'Cresud (ADR)', mercado: 'NASDAQ', pais: 'Argentina', sector: 'Bienes Raíces', subsector: 'Agro & Real Estate' },
  'IRSA': { usTicker: 'IRS', name: 'IRSA Inversiones y Representaciones (ADR)', mercado: 'NYSE', pais: 'Argentina', sector: 'Bienes Raíces', subsector: 'Real Estate' },
  'IRS': { usTicker: 'IRS', name: 'IRSA Inversiones y Representaciones (ADR)', mercado: 'NYSE', pais: 'Argentina', sector: 'Bienes Raíces', subsector: 'Real Estate' },
  'LOMA': { usTicker: 'LOMA', name: 'Loma Negra (ADR)', mercado: 'NYSE', pais: 'Argentina', sector: 'Industrial', subsector: 'Cemento & Materiales' },
  'TXAR': { usTicker: 'TX', name: 'Ternium S.A. (Proxy ADR)', mercado: 'NYSE', pais: 'Argentina', sector: 'Minería', subsector: 'Acero' },
  'BIOX': { usTicker: 'BIOX', name: 'Bioceres Crop Solutions', mercado: 'NASDAQ', pais: 'Argentina', sector: 'Consumo', subsector: 'Agro & Biotecnología' },
  'DESP': { usTicker: 'DESP', name: 'Despegar.com', mercado: 'NYSE', pais: 'Argentina', sector: 'Tech', subsector: 'Turismo & E-commerce' },
  'GLOB': { usTicker: 'GLOB', name: 'Globant S.A.', mercado: 'NYSE', pais: 'Argentina', sector: 'Servicios IT', subsector: 'Software' },
  'MELI': { usTicker: 'MELI', name: 'MercadoLibre Inc.', mercado: 'NASDAQ', pais: 'Uruguay', sector: 'Servicios IT', subsector: 'E-commerce' },
  'VIST': { usTicker: 'VIST', name: 'Vista Energy S.A.B.', mercado: 'NYSE', pais: 'México/Arg', sector: 'Energía', subsector: 'Petróleo y Gas' },
  'CAAP': { usTicker: 'CAAP', name: 'Corporación América Airports', mercado: 'NYSE', pais: 'Argentina', sector: 'Industrial', subsector: 'Aeropuertos & Infraestructura' },
  'ARCO': { usTicker: 'ARCO', name: 'Arcos Dorados Holdings', mercado: 'NYSE', pais: 'Uruguay', sector: 'Consumo', subsector: 'Alimentos' },
  'AGRO': { usTicker: 'AGR', name: 'Adecoagro S.A.', mercado: 'NYSE', pais: 'Argentina', sector: 'Consumo', subsector: 'Agroindustria' },
  'AGR': { usTicker: 'AGR', name: 'Adecoagro S.A.', mercado: 'NYSE', pais: 'Argentina', sector: 'Consumo', subsector: 'Agroindustria' }
};

// Known local-only Argentine stocks that have NO US ADR listing
export const LOCAL_ONLY_STOCKS = new Set([
  'ALUA', 'MIRG', 'COME', 'VALO', 'BYMA', 'TGNO4', 'TRAN', 'CGPA2', 'DGCU2',
  'MOLI', 'AUSO', 'GCLA', 'HAVA', 'INVJ', 'LEDE', 'LONG', 'METR', 'MORI',
  'OEST', 'PATA', 'RIGO', 'SAMI', 'SEMI', 'BOLT', 'BPAT'
]);

/**
 * Resolves a portfolio holding to its international market counterpart (US Stock / ADR).
 * Returns null if the asset is cash, local bond, or has no international listing.
 */
export function resolveInternationalProxy(holding, catalog = {}) {
  if (!holding || !holding.ticker) return null;

  const rawTicker = holding.ticker.trim().toUpperCase().replace(/\.BA$/i, '');
  const tipo = holding.tipo || 'accion';

  // 1. Ignore Cash and Bonds
  if (tipo === 'efectivo' || tipo === 'bono' || rawTicker === 'ARS' || rawTicker === 'USD' || rawTicker === 'AR$') {
    return {
      status: 'ignored',
      reason: tipo === 'bono' ? 'Bono de Renta Fija local' : 'Efectivo / Liquidez',
      rawTicker,
      holding
    };
  }

  // 2. Already a US Stock
  if (tipo === 'stock') {
    const catalogInfo = catalog[rawTicker] || {};
    return {
      status: 'mapped',
      isAdr: false,
      rawTicker,
      usTicker: rawTicker,
      name: holding.nombre || catalogInfo.nombre || rawTicker,
      tipo: 'stock',
      mercado: holding.mercado || catalogInfo.mercado || 'NYSE/NASDAQ',
      sector: holding.sector || catalogInfo.sector || 'Tech',
      subsector: holding.subsector || catalogInfo.subsector || 'General',
      pais: holding.pais || catalogInfo.pais || 'USA',
      holding
    };
  }

  // 3. CEDEAR -> Underlying US Stock / ETF
  if (tipo === 'cedear') {
    const catalogInfo = catalog[rawTicker] || {};
    const cleanUsTicker = rawTicker === 'BRKB' ? 'BRK-B' : rawTicker;
    return {
      status: 'mapped',
      isAdr: false,
      rawTicker,
      usTicker: cleanUsTicker,
      name: holding.nombre || catalogInfo.nombre || `${cleanUsTicker} (Subyacente CEDEAR)`,
      tipo: 'stock',
      mercado: 'NYSE/NASDAQ',
      sector: holding.sector || catalogInfo.sector || 'General',
      subsector: holding.subsector || catalogInfo.subsector || 'General',
      pais: catalogInfo.pais || 'USA',
      holding
    };
  }

  // 4. Argentine Local Stock (Acción AR)
  if (tipo === 'accion') {
    // Check if it has a US ADR
    if (ARG_TO_US_ADR_MAP[rawTicker]) {
      const adrInfo = ARG_TO_US_ADR_MAP[rawTicker];
      return {
        status: 'mapped',
        isAdr: true,
        rawTicker,
        usTicker: adrInfo.usTicker,
        name: adrInfo.name,
        tipo: 'stock',
        mercado: adrInfo.mercado,
        sector: adrInfo.sector,
        subsector: adrInfo.subsector,
        pais: adrInfo.pais,
        holding
      };
    }

    // Explicitly local only
    if (LOCAL_ONLY_STOCKS.has(rawTicker)) {
      return {
        status: 'unsupported',
        reason: 'Acción local sin ADR cotizante en Wall Street',
        rawTicker,
        holding
      };
    }

    // Unknown local stock fallback
    return {
      status: 'unsupported',
      reason: 'Sin ADR registrado en EE.UU.',
      rawTicker,
      holding
    };
  }

  return null;
}

/**
 * Extracts and categorizes all holdings from one or multiple portfolios
 * for international proxy synchronization.
 */
export function extractPortfolioInternationalProxy(holdings = [], catalog = {}, prices = {}, dolarMep = 1) {
  const mapped = [];
  const unsupported = [];
  const ignored = [];

  let totalPortfolioValue = 0;
  let totalMappedValue = 0;
  const mep = Number(dolarMep) > 0 ? Number(dolarMep) : 1;

  holdings.forEach(h => {
    if (!h || !h.ticker) return;

    const rawTicker = h.ticker.trim().toUpperCase().replace(/\.BA$/i, '');
    const isEfectivo = h.tipo === 'efectivo' || rawTicker === 'ARS' || rawTicker === 'USD' || rawTicker === 'AR$';
    const isUsd = h.tipo === 'stock' || (isEfectivo && rawTicker === 'USD');

    // Get current price with robust fallback (.BA, raw ticker, or entry price)
    const ytBA = (h.tipo === 'accion' || h.tipo === 'cedear' || !h.tipo) ? `${rawTicker}.BA` : rawTicker;
    const pc = isEfectivo 
      ? 1 
      : (prices[ytBA] ?? prices[rawTicker] ?? prices[h.ticker] ?? h.precioEntrada ?? 0);

    const cantidad = Number(h.cantidad) || 0;
    const unitPrice = pc !== null && !isNaN(pc) ? Number(pc) : (Number(h.precioEntrada) || 0);
    const nativeVal = unitPrice * cantidad;
    const valUSD = isUsd ? nativeVal : nativeVal / mep;

    totalPortfolioValue += valUSD;

    const res = resolveInternationalProxy(h, catalog);
    if (!res) return;

    if (res.status === 'mapped') {
      totalMappedValue += valUSD;
      mapped.push({
        ...res,
        valUSD,
        cantidad: h.cantidad
      });
    } else if (res.status === 'unsupported') {
      unsupported.push({
        ...res,
        valUSD
      });
    } else if (res.status === 'ignored') {
      ignored.push({
        ...res,
        valUSD
      });
    }
  });

  // Calculate relative weight
  mapped.forEach(m => {
    m.portfolioWeightPct = totalPortfolioValue > 0 ? (m.valUSD / totalPortfolioValue) * 100 : 0;
    m.proxyWeightPct = totalMappedValue > 0 ? (m.valUSD / totalMappedValue) * 100 : 0;
  });

  const coveragePct = totalPortfolioValue > 0
    ? (totalMappedValue / totalPortfolioValue) * 100
    : (mapped.length > 0 ? 100 : 0);

  return {
    mapped,
    unsupported,
    ignored,
    totalPortfolioValue,
    totalMappedValue,
    coveragePct
  };
}

/**
 * Calculates the estimated weighted daily return of the portfolio's international proxy.
 */
export function calculateProxyDailyReturn(mappedItems = [], dailyStats = {}) {
  let totalWeight = 0;
  let weightedDailyReturn = 0;
  const movers = [];

  mappedItems.forEach(item => {
    const stats = dailyStats[item.usTicker] || dailyStats[item.rawTicker] || dailyStats[`${item.rawTicker}.BA`];
    const changePct = stats?.changePct;

    if (changePct !== undefined && changePct !== null && !isNaN(changePct)) {
      const weight = item.proxyWeightPct || 1;
      totalWeight += weight;
      weightedDailyReturn += (weight * changePct);

      movers.push({
        usTicker: item.usTicker,
        rawTicker: item.rawTicker,
        name: item.name,
        isAdr: item.isAdr,
        changePct,
        weight
      });
    }
  });

  const estimatedReturn = totalWeight > 0 ? weightedDailyReturn / totalWeight : 0;
  movers.sort((a, b) => b.changePct - a.changePct);

  return {
    estimatedReturn,
    coveredWeightPct: totalWeight,
    movers,
    topGainer: movers.length > 0 ? movers[0] : null,
    topLoser: movers.length > 0 ? movers[movers.length - 1] : null
  };
}
