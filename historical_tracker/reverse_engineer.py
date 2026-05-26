import pandas as pd

# Estado actual según la captura / JSON del usuario
current_holdings = {
    "BBAR": 3202,
    "BMA": 5241,
    "GGAL": 2229,
    "LOMA": 12,
    "PAMP": 770,
    "SUPV": 10,
    "TGNO4": 4,
    "TGSU2": 4,
    "TRAN": 8,
    "YPFD": 663,
    "GD41": 12,
    "VIST": 419
}

print("=== RECONSTRUCCIÓN INVERSA DEL PORTFOLIO INICIAL ===")

df = pd.read_excel('movimientos.xlsx')
mask_boletos = df['Descripcion'].str.contains('Boleto', case=False, na=False)
df_boletos = df[mask_boletos].copy()

net_trades = {}
for _, row in df_boletos.iterrows():
    desc = str(row['Descripcion'])
    cantidad = abs(float(row['Cantidad'])) if pd.notna(row['Cantidad']) else 0.0
    precio = float(row['Precio']) if pd.notna(row['Precio']) else 0.0
    
    if precio <= 0 or cantidad <= 0:
        continue
        
    parts = desc.split('/')
    if len(parts) >= 5:
        operacion = parts[2].strip().upper()
        ticker_raw = parts[4].strip().upper()
        ticker = ticker_raw.split()[0].strip()
        
        if ticker not in net_trades:
            net_trades[ticker] = 0
            
        if 'COMPRA' in operacion:
            net_trades[ticker] += cantidad
        elif 'VENTA' in operacion:
            net_trades[ticker] -= cantidad

print("\n--- Nominales actuales vs Acumulados por Trades ---")
initial_holdings = {}
all_tickers = set(current_holdings.keys()).union(set(net_trades.keys()))

for t in sorted(all_tickers):
    actual = current_holdings.get(t, 0)
    acumulado = net_trades.get(t, 0)
    inicial = actual - acumulado
    
    if abs(inicial) > 0.01:
        initial_holdings[t] = inicial
    
    if actual != 0 or acumulado != 0:
        print(f"{t:<10} | Actual: {actual:>8} | Acumulado en Trades: {acumulado:>8} | -> Inicial Deducido: {inicial:>8}")

print("\n--- PORTFOLIO INICIAL DEDUCIDO ---")
for t, qty in initial_holdings.items():
    print(f"'{t}': {qty},")

