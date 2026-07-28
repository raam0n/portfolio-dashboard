import pandas as pd
import json
import os
import argparse
import sys
from datetime import datetime

# Configure UTF-8 for Windows console output
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Known asset type mappings for automatic classification
KNOWN_ACCIONES = {'GGAL', 'YPFD', 'BMA', 'BBAR', 'PAMP', 'LOMA', 'SUPV', 'TGNO4', 'TGSU2', 'TRAN', 'COME', 'ALUA', 'TXAR', 'CRES', 'EDN', 'VALO', 'BYMA'}
KNOWN_CEDEARS = {'AAPL', 'SPY', 'QQQ', 'NVDA', 'VIST', 'IBIT', 'PBR', 'KO', 'MELI', 'MSFT', 'AMZN', 'GOOGL', 'TSLA', 'META', 'BABA'}
KNOWN_BONOS = {'AL30', 'GD30', 'AL29', 'GD29', 'AL35', 'GD35', 'AE38', 'GD38', 'AL41', 'GD41'}

def auto_classify_asset(ticker):
    clean_ticker = ticker.replace('.BA', '').replace('.US', '').upper()
    if clean_ticker in KNOWN_ACCIONES:
        return 'accion'
    elif clean_ticker in KNOWN_CEDEARS:
        return 'cedear'
    elif clean_ticker in KNOWN_BONOS:
        return 'bono'
    return 'accion'  # Default fallback

def format_ticker(ticker, asset_tipo):
    ticker = str(ticker).strip().upper()
    if asset_tipo in ['accion', 'cedear'] and not ticker.endswith('.BA') and not ticker.endswith('.US') and not ticker.startswith('$'):
        return f"{ticker}.BA"
    return ticker

def parse_csv_operations(csv_filepath, year=2026):
    if not os.path.exists(csv_filepath):
        print(f"❌ Error: El archivo CSV no existe en '{csv_filepath}'.")
        return []

    # Detect delimiter (, or ;)
    try:
        df = pd.read_csv(csv_filepath, sep=None, engine='python')
    except Exception as e:
        print(f"❌ Error al leer CSV: {e}")
        return []

    # Strip whitespace from column names
    df.columns = [str(c).strip() for c in df.columns]
    col_map = {c.lower(): c for c in df.columns}

    # Identify column mappings
    fecha_col = next((col_map[k] for k in ['fecha', 'date', 'concertacion', 'fecha_hora'] if k in col_map), None)
    ticker_col = next((col_map[k] for k in ['ticker', 'especie', 'simbolo', 'symbol'] if k in col_map), None)
    tipo_col = next((col_map[k] for k in ['tipo', 'operacion', 'operación', 'descripcion', 'type'] if k in col_map), None)
    cant_col = next((col_map[k] for k in ['cantidad', 'cantidad operada', 'quantity', 'cant'] if k in col_map), None)
    precio_col = next((col_map[k] for k in ['precio', 'precio operado', 'price', 'prec'] if k in col_map), None)
    asset_col = next((col_map[k] for k in ['assettipo', 'tipo de instrumento', 'asset_tipo', 'categoria'] if k in col_map), None)
    estado_col = next((col_map[k] for k in ['estado', 'status'] if k in col_map), None)

    if not (fecha_col and ticker_col and tipo_col and cant_col and precio_col):
        print("❌ Error: Falta alguna columna requerida en el CSV (Fecha, Ticker, Tipo, Cantidad, Precio).")
        print(f"Columnas detectadas: {list(df.columns)}")
        return []

    # Filter status if present
    if estado_col:
        valid_estados = ['ejecutada', 'finalizada', 'parcialmente cancelada']
        df = df[df[estado_col].astype(str).str.lower().isin(valid_estados)].copy()

    # Parse dates
    df['fecha_parsed'] = pd.to_datetime(df[fecha_col], errors='coerce')
    df = df.dropna(subset=['fecha_parsed'])

    # Filter year if specified
    if year and str(year).lower() != 'all':
        target_year = int(year)
        df = df[df['fecha_parsed'].dt.year == target_year].copy()

    ops = []
    base_id = int(datetime.now().timestamp() * 1000)

    for idx, row in df.iterrows():
        raw_tipo = str(row[tipo_col]).strip().lower()
        if 'compra' in raw_tipo or raw_tipo == 'c' or raw_tipo == 'buy':
            tipo = 'compra'
        elif 'venta' in raw_tipo or raw_tipo == 'v' or raw_tipo == 'sell':
            tipo = 'venta'
        else:
            continue # Skip non-trade operations (e.g. cash flow, dividends)

        raw_ticker = str(row[ticker_col]).strip().upper()
        cant = abs(float(row[cant_col]))
        prec = float(row[precio_col])
        if prec <= 0 or cant <= 0:
            continue

        fecha_str = row['fecha_parsed'].strftime('%Y-%m-%d')
        asset_tipo = str(row[asset_col]).strip().lower() if asset_col and pd.notna(row[asset_col]) else auto_classify_asset(raw_ticker)
        formatted_ticker = format_ticker(raw_ticker, asset_tipo)

        ops.append({
            "id": str(base_id + idx),
            "ticker": formatted_ticker,
            "assetTipo": asset_tipo,
            "tipo": tipo,
            "cantidad": cant,
            "precio": prec,
            "fecha": fecha_str
        })

    return ops

def main():
    parser = argparse.ArgumentParser(description="Importar operaciones desde CSV al portfolio JSON")
    parser.add_argument("--csv", default="data/operaciones.csv", help="Ruta al archivo CSV (por defecto: data/operaciones.csv)")
    parser.add_argument("--json", default="data/portfolio_2026-05-27.json", help="Ruta al archivo JSON del portfolio")
    parser.add_argument("--year", default="2026", help="Año a procesar (por defecto: 2026, usar 'all' para todos)")

    args = parser.parse_args()

    print(f"📊 Procesando CSV: {args.csv}")
    print(f"📅 Filtrando año: {args.year}")

    ops_nuevas = parse_csv_operations(args.csv, args.year)
    if not ops_nuevas:
        print("⚠️ No se encontraron operaciones para procesar.")
        return

    print(f"✅ Se encontraron {len(ops_nuevas)} operaciones del año {args.year} en el CSV.")

    # Read target JSON
    json_path = args.json
    data = {}
    if os.path.exists(json_path):
        with open(json_path, 'r', encoding='utf-8') as f:
            try:
                data = json.load(f)
            except Exception as e:
                print(f"⚠️ Warning: No se pudo leer {json_path}: {e}")

    # Identify format (multi-portfolio dict vs single portfolio)
    if 'allOperaciones' in data:
        target_ops = data['allOperaciones'].get("Mi Portfolio Principal", [])
    elif 'operaciones' in data:
        target_ops = data['operaciones']
    else:
        data['operaciones'] = []
        target_ops = data['operaciones']

    # Merge operations (avoiding exact duplicates)
    agregadas = 0
    duplicadas = 0
    for op in ops_nuevas:
        # Check if already exists
        exists = any(
            o.get('ticker') == op['ticker'] and
            o.get('fecha') == op['fecha'] and
            o.get('tipo') == op['tipo'] and
            abs(float(o.get('cantidad', 0)) - op['cantidad']) < 1e-4 and
            abs(float(o.get('precio', 0)) - op['precio']) < 1e-4
            for o in target_ops
        )
        if not exists:
            target_ops.append(op)
            agregadas += 1
        else:
            duplicadas += 1

    # Save back
    if 'allOperaciones' in data:
        data['allOperaciones']["Mi Portfolio Principal"] = target_ops
    else:
        data['operaciones'] = target_ops

    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print("\n--- RESUMEN DE IMPORTACIÓN ---")
    print(f"➕ Operaciones agregadas: {agregadas}")
    print(f"🔄 Duplicadas omitidas: {duplicadas}")
    print(f"📌 Total operaciones en el JSON: {len(target_ops)}")
    print(f"💾 Guardado exitosamente en: {json_path}")

if __name__ == "__main__":
    main()
