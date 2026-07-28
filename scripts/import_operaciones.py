import pandas as pd
import json
import os
import argparse
import sys
from datetime import datetime

# Configure UTF-8 output for Windows console
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

KNOWN_ACCIONES = {'GGAL', 'YPFD', 'BMA', 'BBAR', 'PAMP', 'LOMA', 'SUPV', 'TGNO4', 'TGSU2', 'TRAN', 'COME', 'ALUA', 'TXAR', 'CRES', 'EDN', 'VALO', 'BYMA'}
KNOWN_CEDEARS = {'AAPL', 'SPY', 'QQQ', 'NVDA', 'VIST', 'IBIT', 'PBR', 'KO', 'MELI', 'MSFT', 'AMZN', 'GOOGL', 'TSLA', 'META', 'BABA', 'SNDK', 'LAC', 'NOW', 'AVGO', 'IWM', 'COPX', 'RGTI', 'AMD', 'PLTR', 'COIN', 'MSTR'}
KNOWN_BONOS = {'AL30', 'GD30', 'AL29', 'GD29', 'AL35', 'GD35', 'AE38', 'GD38', 'AL41', 'GD41', 'BPO27', 'BP21D'}

def auto_classify_asset(ticker):
    clean_ticker = ticker.replace('.BA', '').replace('.US', '').upper()
    if clean_ticker in KNOWN_ACCIONES:
        return 'accion'
    elif clean_ticker in KNOWN_CEDEARS:
        return 'cedear'
    elif clean_ticker in KNOWN_BONOS:
        return 'bono'
    return 'cedear' if len(clean_ticker) <= 5 and not clean_ticker.endswith('4') else 'accion'

def format_ticker(ticker, asset_tipo):
    ticker = str(ticker).strip().upper()
    if asset_tipo in ['accion', 'cedear'] and not ticker.endswith('.BA') and not ticker.endswith('.US') and not ticker.startswith('$'):
        return f"{ticker}.BA"
    return ticker

def read_file_to_dataframe(filepath):
    ext = os.path.splitext(filepath)[1].lower()
    
    if ext in ['.xls', '.xlsx']:
        try:
            return pd.read_excel(filepath)
        except Exception as e1:
            # Fallback 1: HTML table saved with .xls extension
            try:
                tables = pd.read_html(filepath)
                if tables:
                    return tables[0]
            except Exception:
                pass
            # Fallback 2: CSV saved with .xls extension
            try:
                return pd.read_csv(filepath, sep=None, engine='python')
            except Exception:
                pass
            raise e1
    else:
        # Default CSV reader
        try:
            return pd.read_csv(filepath, sep=None, engine='python')
        except Exception:
            return pd.read_csv(filepath, encoding='latin1', sep=None, engine='python')

def parse_operations(filepath, year=2026):
    if not os.path.exists(filepath):
        print(f"❌ Error: El archivo no existe en '{filepath}'.")
        return []

    print(f"📖 Leyendo archivo: {filepath}")
    df = read_file_to_dataframe(filepath)

    df.columns = [str(c).strip() for c in df.columns]
    col_map = {c.lower(): c for c in df.columns}

    fecha_col = next((col_map[k] for k in ['fecha', 'date', 'concertacion', 'fecha_hora'] if k in col_map), None)
    ticker_col = next((col_map[k] for k in ['ticker', 'especie', 'simbolo', 'symbol'] if k in col_map), None)
    tipo_col = next((col_map[k] for k in ['tipo', 'operacion', 'operación', 'descripcion', 'type'] if k in col_map), None)
    
    # Priority to "Cantidad Operada" over "Cantidad"
    cant_col = next((col_map[k] for k in ['cantidad operada', 'cantidad', 'quantity', 'cant'] if k in col_map), None)
    precio_col = next((col_map[k] for k in ['precio operado', 'precio', 'price', 'prec'] if k in col_map), None)
    asset_col = next((col_map[k] for k in ['assettipo', 'tipo de instrumento', 'asset_tipo', 'categoria'] if k in col_map), None)
    estado_col = next((col_map[k] for k in ['estado', 'status'] if k in col_map), None)

    if not (fecha_col and ticker_col and tipo_col and cant_col and precio_col):
        print("❌ Error: No se encontraron las columnas requeridas (Fecha, Ticker, Operacion/Tipo, Cantidad, Precio).")
        print(f"Columnas detectadas en el archivo: {list(df.columns)}")
        return []

    # Filter status if present
    if estado_col:
        valid_estados = ['ejecutada', 'finalizada', 'parcialmente cancelada']
        df = df[df[estado_col].astype(str).str.lower().isin(valid_estados)].copy()

    df['fecha_parsed'] = pd.to_datetime(df[fecha_col], errors='coerce')
    df = df.dropna(subset=['fecha_parsed'])

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
            continue

        raw_ticker = str(row[ticker_col]).strip().upper()
        try:
            cant = abs(float(row[cant_col]))
            prec = float(row[precio_col])
        except (ValueError, TypeError):
            continue

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
    parser = argparse.ArgumentParser(description="Importar operaciones desde XLS/XLSX/CSV al portfolio JSON")
    parser.add_argument("--file", default=None, help="Ruta al archivo de operaciones (.xls, .xlsx, .csv)")
    parser.add_argument("--json", default="data/portfolio_2026-05-27.json", help="Ruta al archivo JSON del portfolio")
    parser.add_argument("--year", default="2026", help="Año a procesar (por defecto: 2026, 'all' para todos)")

    args = parser.parse_args()

    # Find input file automatically if not specified
    target_file = args.file
    if not target_file:
        possible_files = ["data/operaciones.xls", "data/operaciones.xlsx", "data/operaciones.csv"]
        for f in possible_files:
            if os.path.exists(f):
                target_file = f
                break

    if not target_file:
        print("❌ Error: No se encontró ningún archivo 'operaciones.xls', 'operaciones.xlsx' o 'operaciones.csv' en la carpeta 'data/'.")
        print("Por favor, coloca el archivo en 'data/' o especifica la ruta con --file <ruta>.")
        return

    print(f"📊 Procesando archivo: {target_file}")
    print(f"📅 Filtrando operaciones del año: {args.year}")

    ops_nuevas = parse_operations(target_file, args.year)
    if not ops_nuevas:
        print("⚠️ No se encontraron operaciones para procesar.")
        return

    print(f"✅ Se procesaron {len(ops_nuevas)} operaciones del año {args.year}.")

    json_path = args.json
    data = {}
    if os.path.exists(json_path):
        with open(json_path, 'r', encoding='utf-8') as f:
            try:
                data = json.load(f)
            except Exception as e:
                print(f"⚠️ Warning: No se pudo leer {json_path}: {e}")

    # Handle multi-portfolio vs legacy structure
    if 'allOperaciones' in data:
        target_ops = data['allOperaciones'].get("Mi Portfolio Principal", [])
    elif 'operaciones' in data:
        target_ops = data['operaciones']
    else:
        data['operaciones'] = []
        target_ops = data['operaciones']

    agregadas = 0
    duplicadas = 0
    for op in ops_nuevas:
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

    if 'allOperaciones' in data:
        data['allOperaciones']["Mi Portfolio Principal"] = target_ops
    else:
        data['operaciones'] = target_ops

    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print("\n================ RESUMEN DE IMPORTACIÓN ================")
    print(f"➕ Operaciones nuevas agregadas : {agregadas}")
    print(f"🔄 Operaciones duplicadas omitidas: {duplicadas}")
    print(f"📌 Total de operaciones en JSON : {len(target_ops)}")
    print(f"💾 Guardado exitosamente en     : {json_path}")
    print("========================================================\n")

if __name__ == "__main__":
    main()
