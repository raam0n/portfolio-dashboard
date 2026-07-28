import json
import pandas as pd
import os
import sys
from datetime import datetime

# Configure UTF-8 output for Windows console
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

KNOWN_NAMES = {
    'GGAL': 'Grupo Financiero Galicia',
    'YPFD': 'YPF S.A.',
    'BMA': 'Banco Macro S.A.',
    'BBAR': 'Banco BBVA Argentina',
    'PAMP': 'Pampa Energía S.A.',
    'LOMA': 'Loma Negra C.I.A.S.A.',
    'SUPV': 'Grupo Supervielle S.A.',
    'TGNO4': 'Transportadora de Gas del Norte',
    'TGSU2': 'Transportadora de Gas del Sur',
    'TRAN': 'Transener S.A.',
    'AAPL': 'Apple Inc.',
    'SPY': 'SPDR S&P 500 ETF Trust',
    'QQQ': 'Invesco QQQ Trust',
    'NVDA': 'NVIDIA Corporation',
    'VIST': 'Vista Energy S.A.B. de C.V.',
    'IBIT': 'iShares Bitcoin Trust ETF',
    'PBR': 'Petróleo Brasileiro S.A. - Petrobras',
    'KO': 'The Coca-Cola Company',
    'MELI': 'MercadoLibre Inc.',
    'MSFT': 'Microsoft Corporation',
    'AMZN': 'Amazon.com Inc.',
    'GOOGL': 'Alphabet Inc.',
    'TSLA': 'Tesla Inc.',
    'META': 'Meta Platforms Inc.',
    'AMD': 'Advanced Micro Devices Inc.',
    'ASML': 'ASML Holding N.V.',
    'AVGO': 'Broadcom Inc.',
    'COPX': 'Global X Copper Miners ETF',
    'EWY': 'iShares MSCI South Korea ETF',
    'IWM': 'iShares Russell 2000 ETF',
    'LAC': 'Lithium Americas Corp.',
    'MP': 'MP Materials Corp.',
    'MRVL': 'Marvell Technology Inc.',
    'MU': 'Micron Technology Inc.',
    'NOW': 'ServiceNow Inc.',
    'OKLO': 'Oklo Inc.',
    'ORCL': 'Oracle Corporation',
    'PLTR': 'Palantir Technologies Inc.',
    'RGTI': 'Rigetti Computing Inc.',
    'RIO': 'Rio Tinto plc',
    'SNDK': 'SanDisk / Western Digital',
    'HOOD': 'Robinhood Markets Inc.',
    'DOLAR': 'Dólar Mep / Cable'
}

KNOWN_ACCIONES = {'GGAL', 'YPFD', 'BMA', 'BBAR', 'PAMP', 'LOMA', 'SUPV', 'TGNO4', 'TGSU2', 'TRAN', 'COME', 'ALUA', 'TXAR', 'CRES', 'EDN', 'VALO', 'BYMA'}
KNOWN_CEDEARS = {'AAPL', 'SPY', 'QQQ', 'NVDA', 'VIST', 'IBIT', 'PBR', 'KO', 'MELI', 'MSFT', 'AMZN', 'GOOGL', 'TSLA', 'META', 'BABA', 'SNDK', 'LAC', 'NOW', 'AVGO', 'IWM', 'COPX', 'RGTI', 'AMD', 'PLTR', 'COIN', 'MSTR', 'ASML', 'EWY', 'MP', 'MRVL', 'MU', 'OKLO', 'ORCL', 'RIO', 'HOOD', 'NU', 'URA', 'PSQ'}
KNOWN_BONOS = {'AL30', 'GD30', 'AL29', 'GD29', 'AL35', 'GD35', 'AE38', 'GD38', 'AL41', 'GD41', 'BPO27', 'BP21D', 'T13F6', 'T31Y7', 'TO26', 'TTD26', 'TTS26', 'TX26', 'TX28', 'TZX26', 'TZX28', 'TZXD6', 'TZXD7'}

def auto_classify_asset(ticker):
    clean = ticker.replace('.BA', '').replace('.US', '').upper()
    if clean in KNOWN_ACCIONES:
        return 'accion'
    elif clean in KNOWN_CEDEARS:
        return 'cedear'
    elif clean in KNOWN_BONOS:
        return 'bono'
    return 'cedear' if len(clean) <= 5 and not clean.endswith('4') else 'accion'

def format_op_ticker(ticker, asset_tipo):
    ticker = str(ticker).strip().upper()
    if asset_tipo in ['accion', 'cedear'] and not ticker.endswith('.BA') and not ticker.endswith('.US') and not ticker.startswith('$'):
        return f"{ticker}.BA"
    return ticker

def clean_base_ticker(t):
    return str(t).replace('.BA', '').replace('.US', '').strip().upper()

def main():
    json_path = 'data/portfolio_2026-07-28.json'
    excel_path = 'data/operaciones.xlsx'

    print(f"📖 Cargando JSON desde: {json_path}")
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    target_id = "ramon"
    if target_id not in data.get('allHoldings', {}):
        print(f"❌ Error: Portfolio '{target_id}' no encontrado.")
        return

    print(f"📖 Procesando Excel desde: {excel_path}")
    df = pd.read_excel(excel_path)
    df.columns = [str(c).strip() for c in df.columns]

    valid = df[df['Estado'].astype(str).str.lower().isin(['ejecutada', 'finalizada', 'parcialmente cancelada'])].copy()
    valid['Fecha_str'] = pd.to_datetime(valid['Fecha']).dt.strftime('%Y-%m-%d')

    def get_tipo(op):
        op = str(op).lower()
        if 'compra' in op: return 'compra'
        if 'venta' in op: return 'venta'
        return None

    valid['tipo'] = valid['Operacion'].apply(get_tipo)
    valid = valid.dropna(subset=['tipo'])
    valid['cant'] = valid['Cantidad Operada'].astype(float)
    valid['precio'] = valid['Precio Operado'].astype(float)
    valid['monto'] = valid['cant'] * valid['precio']
    valid['clean_ticker'] = valid['Ticker'].apply(clean_base_ticker)

    # Sort by date ascending
    valid = valid.sort_values(['Fecha_str', 'clean_ticker']).reset_index(drop=True)

    # --- 1. UNIFICAR OPERACIONES POR (FECHA, TICKER, TIPO) ---
    grouped = valid.groupby(['Fecha_str', 'clean_ticker', 'tipo'], sort=False).agg(
        total_cant=('cant', 'sum'),
        total_monto=('monto', 'sum'),
        count=('cant', 'count')
    ).reset_index()

    grouped['precio_promedio'] = (grouped['total_monto'] / grouped['total_cant']).round(2)

    unified_ops = []
    base_id = 1776270159288

    for idx, row in grouped.iterrows():
        base_ticker = row['clean_ticker']
        asset_tipo = auto_classify_asset(base_ticker)
        op_ticker = format_op_ticker(base_ticker, asset_tipo)

        unified_ops.append({
            "id": str(base_id + idx * 100),
            "ticker": op_ticker,
            "assetTipo": asset_tipo,
            "tipo": row['tipo'],
            "cantidad": round(float(row['total_cant']), 4),
            "precio": float(row['precio_promedio']),
            "fecha": row['Fecha_str']
        })

    print(f"\n✅ Operaciones unificadas por (Día + Ticker + Tipo):")
    print(f"   - Operaciones originales en Excel: {len(valid)}")
    print(f"   - Operaciones unificadas finales : {len(unified_ops)}")

    # --- 2. RECALCULAR TENENCIAS (HOLDINGS) EXACTAS ---
    holdings_calc = {}

    for _, row in valid.iterrows():
        t = row['clean_ticker']
        cant = row['cant']
        prec = row['precio']
        tipo = row['tipo']

        if t not in holdings_calc:
            holdings_calc[t] = {
                'cant': 0.0,
                'total_buy_cant': 0.0,
                'total_buy_cost': 0.0
            }

        if tipo == 'compra':
            holdings_calc[t]['total_buy_cant'] += cant
            holdings_calc[t]['total_buy_cost'] += cant * prec
            holdings_calc[t]['cant'] += cant
        elif tipo == 'venta':
            holdings_calc[t]['cant'] -= cant

    # Preservar efectivo existente (ARS / $ARS) de los holdings actuales de ramon
    existing_ramon_holdings = data['allHoldings'].get(target_id, [])
    cash_holdings = [h for h in existing_ramon_holdings if h['ticker'] == 'ARS' or h.get('tipo') == 'efectivo']

    updated_holdings = list(cash_holdings)

    removed_count = 0
    active_count = 0

    for t, val in sorted(holdings_calc.items()):
        net_cant = val['cant']
        if net_cant > 0.001:
            asset_tipo = auto_classify_asset(t)
            avg_ppc = (val['total_buy_cost'] / val['total_buy_cant']) if val['total_buy_cant'] > 0 else 0.0
            name = KNOWN_NAMES.get(t, t)

            updated_holdings.append({
                "ticker": t,
                "tipo": asset_tipo,
                "mercado": "BCBA",
                "nombre": name,
                "cantidad": round(net_cant, 4),
                "precioEntrada": round(avg_ppc, 2)
            })
            active_count += 1
        else:
            removed_count += 1

    print(f"\n💼 Resumen de Tenencias (Holdings):")
    print(f"   - Activos eliminados (vendidos totalmente): {removed_count}")
    print(f"   - Activos activos restantes en cartera    : {active_count}")
    print(f"   - Efectivo preservado                    : {len(cash_holdings)} registros")
    print(f"   - Total elementos en holdings final       : {len(updated_holdings)}")

    # --- 3. ACTUALIZAR SOLO RAMON Y GUARDAR ---
    data['allHoldings'][target_id] = updated_holdings
    data['allOperaciones'][target_id] = unified_ops

    # Guardar en portfolio_2026-07-28.json
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    # Guardar también en portfolio_2026-05-27.json
    with open('data/portfolio_2026-05-27.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"\n💾 Archivos JSON guardados exitosamente!")

if __name__ == "__main__":
    main()
