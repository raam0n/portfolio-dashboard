import json
import pandas as pd
import os
import sys

# Configure UTF-8 for Windows console
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

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

    if not os.path.exists(json_path):
        print(f"❌ Error: No existe {json_path}")
        return

    if not os.path.exists(excel_path):
        print(f"❌ Error: No existe {excel_path}")
        return

    print(f"📖 Leyendo JSON desde: {json_path}")
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    target_id = "ramon"

    print(f"📖 Leyendo Excel desde: {excel_path}")
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

    # Unify operations by (Fecha, Ticker, Tipo)
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

    print(f"\n✅ Operaciones unificadas (Día + Ticker + Tipo): {len(unified_ops)}")

    # IMPORTANTE: NO MODIFICAR HOLDINGS. Se conservan intactos.
    print(f"🔒 Holdings de '{target_id}' CONSERVADOS INTACTOS ({len(data['allHoldings'].get(target_id, []))} activos).")

    # Actualizar UNICAMENTE allOperaciones['ramon']
    data['allOperaciones'][target_id] = unified_ops

    # Guardar en portfolio_2026-07-28.json
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    # Guardar en portfolio_2026-05-27.json
    with open('data/portfolio_2026-05-27.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"💾 Guardado exitoso en {json_path}")

if __name__ == "__main__":
    main()
