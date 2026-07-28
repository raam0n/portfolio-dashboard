import json
import pandas as pd
import os
import sys
from datetime import datetime

# Configure UTF-8 for Windows console
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

KNOWN_ACCIONES = {'GGAL', 'YPFD', 'BMA', 'BBAR', 'PAMP', 'LOMA', 'SUPV', 'TGNO4', 'TGSU2', 'TRAN', 'COME', 'ALUA', 'TXAR', 'CRES', 'EDN', 'VALO', 'BYMA'}
KNOWN_CEDEARS = {'AAPL', 'SPY', 'QQQ', 'NVDA', 'VIST', 'IBIT', 'PBR', 'KO', 'MELI', 'MSFT', 'AMZN', 'GOOGL', 'TSLA', 'META', 'BABA', 'SNDK', 'LAC', 'NOW', 'AVGO', 'IWM', 'COPX', 'RGTI', 'AMD', 'PLTR', 'COIN', 'MSTR', 'ASML', 'EWY', 'MP', 'MRVL', 'MU', 'OKLO', 'ORCL', 'RIO'}
KNOWN_BONOS = {'AL30', 'GD30', 'AL29', 'GD29', 'AL35', 'GD35', 'AE38', 'GD38', 'AL41', 'GD41', 'BPO27', 'BP21D'}

def auto_classify_asset(ticker):
    clean = ticker.replace('.BA', '').replace('.US', '').upper()
    if clean in KNOWN_ACCIONES:
        return 'accion'
    elif clean in KNOWN_CEDEARS:
        return 'cedear'
    elif clean in KNOWN_BONOS:
        return 'bono'
    return 'cedear' if len(clean) <= 5 and not clean.endswith('4') else 'accion'

def format_ticker(ticker, asset_tipo):
    ticker = str(ticker).strip().upper()
    if asset_tipo in ['accion', 'cedear'] and not ticker.endswith('.BA') and not ticker.endswith('.US') and not ticker.startswith('$'):
        return f"{ticker}.BA"
    return ticker

def clean_ticker_for_matching(t):
    return str(t).replace('.BA', '').replace('.US', '').strip().upper()

def main():
    json_path = 'data/portfolio_2026-07-28.json'
    excel_path = 'data/operaciones.xlsx'

    if not os.path.exists(json_path):
        print(f"❌ Error: No se encontró {json_path}")
        return

    if not os.path.exists(excel_path):
        print(f"❌ Error: No se encontró {excel_path}")
        return

    print(f"📖 Cargando portfolio desde: {json_path}")
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    target_portfolio_id = "ramon"
    if target_portfolio_id not in data.get('allHoldings', {}):
        print(f"❌ Error: No se encontró el portfolio '{target_portfolio_id}' en allHoldings")
        return

    existing_holdings = data['allHoldings'][target_portfolio_id]
    existing_ops = data['allOperaciones'].get(target_portfolio_id, [])

    print(f"📊 Portfolio '{target_portfolio_id}' actual:")
    print(f"   - Tenencias actuales: {len(existing_holdings)} activos")
    print(f"   - Operaciones actuales: {len(existing_ops)} operaciones en histórico")

    # 1. Cargar operaciones nuevas del Excel
    print(f"\n📖 Procesando operaciones desde: {excel_path}")
    df_excel = pd.read_excel(excel_path)
    df_excel.columns = [str(c).strip() for c in df_excel.columns]

    valid_estados = ['ejecutada', 'finalizada', 'parcialmente cancelada']
    if 'Estado' in df_excel.columns:
        df_excel = df_excel[df_excel['Estado'].astype(str).str.lower().isin(valid_estados)].copy()

    df_excel['fecha_parsed'] = pd.to_datetime(df_excel['Fecha'], errors='coerce')
    df_excel = df_excel.dropna(subset=['fecha_parsed']).sort_values('fecha_parsed')

    new_ops_added = 0
    dup_ops_skipped = 0
    base_id = int(datetime.now().timestamp() * 1000)

    updated_ops = list(existing_ops)

    for idx, row in df_excel.iterrows():
        raw_tipo = str(row['Operacion']).strip().lower()
        if 'compra' in raw_tipo:
            tipo = 'compra'
        elif 'venta' in raw_tipo:
            tipo = 'venta'
        else:
            continue

        raw_ticker = str(row['Ticker']).strip().upper()
        cant = float(row.get('Cantidad Operada', row.get('Cantidad', 0)))
        prec = float(row.get('Precio Operado', row.get('Precio', 0)))
        if cant <= 0 or prec <= 0:
            continue

        fecha_str = row['fecha_parsed'].strftime('%Y-%m-%d')
        asset_tipo = auto_classify_asset(raw_ticker)
        formatted_ticker = format_ticker(raw_ticker, asset_tipo)

        # Check duplicate
        is_dup = any(
            o.get('ticker') == formatted_ticker and
            o.get('fecha') == fecha_str and
            o.get('tipo') == tipo and
            abs(float(o.get('cantidad', 0)) - cant) < 1e-4 and
            abs(float(o.get('precio', 0)) - prec) < 1e-4
            for o in updated_ops
        )

        if not is_dup:
            updated_ops.append({
                "id": str(base_id + idx),
                "ticker": formatted_ticker,
                "assetTipo": asset_tipo,
                "tipo": tipo,
                "cantidad": cant,
                "precio": prec,
                "fecha": fecha_str
            })
            new_ops_added += 1
        else:
            dup_ops_skipped += 1

    print(f"\n🔄 Resumen de Operaciones:")
    print(f"   ➕ Operaciones nuevas incorporadas: {new_ops_added}")
    print(f"   🔄 Duplicadas omitidas: {dup_ops_skipped}")
    print(f"   📌 Total operaciones en histórico: {len(updated_ops)}")

    # 2. Recalcular Tenencias (Holdings)
    # Partimos de las tenencias actuales y aplicamos compras/ventas
    holdings_dict = {}
    for h in existing_holdings:
        clean_t = clean_ticker_for_matching(h['ticker'])
        holdings_dict[clean_t] = {
            "ticker": h['ticker'].replace('.BA', ''), # Base ticker for UI
            "tipo": h.get('tipo', auto_classify_asset(clean_t)),
            "mercado": h.get('mercado', 'BCBA'),
            "nombre": h.get('nombre', clean_t),
            "cantidad": float(h['cantidad']),
            "precioEntrada": float(h.get('precioEntrada', 0))
        }

    # Aplicar operaciones ordenadas por fecha
    # Para saber si compras/ventas recientes afectaron la cantidad final
    # Ordenamos operaciones por fecha
    sorted_ops = sorted(updated_ops, key=lambda x: x['fecha'])

    # Re-evaluar cantidades de cada activo basándonos en compras y ventas
    # Si tenemos un activo en holdings, aplicamos las operaciones recientes (o podemos recalcular neto si conocemos punto de partida)
    # Apliquemos los deltas de las operaciones agregadas desde el Excel
    # Para cada operación agregada:
    # Si es compra: suma cantidad a holdings.
    # Si es venta: resta cantidad a holdings.
    
    # Vamos a procesar cada operación del Excel (ordenada por fecha) para ajustar la cantidad y el precio promedio
    # Primero identifiquemos qué operaciones son nuevas
    for op in updated_ops:
        if op in existing_ops:
            continue # Ya reflejada en las tenencias iniciales
        clean_t = clean_ticker_for_matching(op['ticker'])
        cant = float(op['cantidad'])
        prec = float(op['precio'])
        tipo = op['tipo']

        if clean_t not in holdings_dict:
            if tipo == 'compra':
                holdings_dict[clean_t] = {
                    "ticker": clean_t,
                    "tipo": op.get('assetTipo', auto_classify_asset(clean_t)),
                    "mercado": "BCBA",
                    "nombre": clean_t,
                    "cantidad": cant,
                    "precioEntrada": prec
                }
        else:
            curr = holdings_dict[clean_t]
            if tipo == 'compra':
                total_cost = (curr['cantidad'] * curr['precioEntrada']) + (cant * prec)
                new_cant = curr['cantidad'] + cant
                curr['cantidad'] = new_cant
                curr['precioEntrada'] = round(total_cost / new_cant, 2) if new_cant > 0 else prec
            elif tipo == 'venta':
                new_cant = curr['cantidad'] - cant
                curr['cantidad'] = max(0.0, new_cant)

    # Filtrar tenencias con cantidad > 0
    updated_holdings = []
    removed_assets = []

    for clean_t, h_data in holdings_dict.items():
        if h_data['cantidad'] > 0.001:
            updated_holdings.append({
                "ticker": h_data['ticker'],
                "tipo": h_data['tipo'],
                "mercado": h_data['mercado'],
                "nombre": h_data['nombre'],
                "cantidad": round(h_data['cantidad'], 4),
                "precioEntrada": round(h_data['precioEntrada'], 2)
            })
        else:
            removed_assets.append(clean_t)

    print(f"\n💼 Resumen de Tenencias (Holdings):")
    print(f"   🗑️ Activos eliminados (vendidos totalmente): {len(removed_assets)} -> {removed_assets}")
    print(f"   ✅ Activos en cartera activos: {len(updated_holdings)}")

    # 3. Guardar cambios en el JSON
    data['allHoldings'][target_portfolio_id] = updated_holdings
    data['allOperaciones'][target_portfolio_id] = updated_ops

    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"\n💾 Archivo {json_path} actualizado con éxito!")

if __name__ == "__main__":
    main()
