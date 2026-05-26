import pandas as pd
import yfinance as yf
import datetime
import os
import json
import warnings

warnings.filterwarnings("ignore")

EXCEL_FILE = "movimientos.xlsx"
OUTPUT_FILE = "historial_portfolio_movimientos.json"

def calculate_historical_mep(start_date, end_date):
    print("Obteniendo Dólar MEP histórico (GGAL.BA / GGAL)...")
    try:
        ggal_ar = yf.download("GGAL.BA", start=start_date, end=end_date, progress=False)["Close"]
        ggal_us = yf.download("GGAL", start=start_date, end=end_date, progress=False)["Close"]
        
        if isinstance(ggal_ar, pd.DataFrame): ggal_ar = ggal_ar.squeeze()
        if isinstance(ggal_us, pd.DataFrame): ggal_us = ggal_us.squeeze()

        df = pd.concat([ggal_ar, ggal_us], axis=1).dropna()
        df.columns = ["GGAL_AR", "GGAL_US"]
        df["MEP"] = (df["GGAL_AR"] / df["GGAL_US"]) * 10
        
        df.index = df.index.tz_localize(None)
        
        idx = pd.date_range(start_date, end_date)
        df = df.reindex(idx).ffill().bfill()
        return df
    except Exception as e:
        print(f"Error calculando MEP: {e}")
        return pd.DataFrame()

def process_movimientos():
    if not os.path.exists(EXCEL_FILE):
        print(f"ERROR: No se encontró el archivo '{EXCEL_FILE}'.")
        return

    print(f"Leyendo operaciones desde {EXCEL_FILE}...")
    df = pd.read_excel(EXCEL_FILE)
    
    # Limpieza de fechas
    df['Fecha_Hora'] = pd.to_datetime(df['Concertacion'], errors='coerce')
    df = df.dropna(subset=['Fecha_Hora']).sort_values('Fecha_Hora').reset_index(drop=True)
    df['Fecha_str'] = df['Fecha_Hora'].dt.strftime('%Y-%m-%d')
    
    start_date = df['Fecha_Hora'].min().strftime('%Y-%m-%d')
    end_date = (datetime.datetime.now() + datetime.timedelta(days=1)).strftime('%Y-%m-%d')
    
    mep_df = calculate_historical_mep(start_date, end_date)
    
    def get_mep(date_str):
        if mep_df.empty: return 1000
        dt = pd.to_datetime(date_str)
        if dt in mep_df.index:
            return float(mep_df.loc[dt, 'MEP'])
        return float(mep_df.iloc[-1]['MEP'])

    # 1. ANÁLISIS DE FLUJO DE CAJA (Aportes vs Retiros puros)
    # Excluimos dividendos porque son rendimiento interno.
    cashflows_mensuales = {}
    
    # Inyectar Saldo Inicial
    SALDO_INICIAL_USD = 13394.11
    
    # Recibo de Cobro = Aportes (Depósitos)
    # Comprobante de Pago = Retiros (Extracciones)
    mask_flujos = df['Descripcion'].str.contains('Recibo de Cobro|Comprobante de Pago', case=False, na=False)
    df_cashflow = df[mask_flujos].copy()
    
    print(f"Datos limpios: {len(df_cashflow)} aportes/retiros detectados.")
    
    # Agregar saldo inicial al primer mes de los registros
    if not df.empty:
        primer_mes = df['Fecha_Hora'].min().strftime('%Y-%m')
        cashflows_mensuales[primer_mes] = {"Aportes_USD": SALDO_INICIAL_USD, "Retiros_USD": 0.0}

    for _, row in df_cashflow.iterrows():
        ym = row['Fecha_Hora'].strftime('%Y-%m')
        if ym not in cashflows_mensuales:
            cashflows_mensuales[ym] = {"Aportes_USD": 0.0, "Retiros_USD": 0.0}
        
        importe = float(row['Importe'])
        moneda = str(row['Moneda'])
        
        monto_usd = importe / get_mep(row['Fecha_str']) if 'Pesos' in moneda else importe
            
        if 'Recibo de Cobro' in str(row['Descripcion']):
            cashflows_mensuales[ym]["Aportes_USD"] += abs(monto_usd)
        elif 'Comprobante de Pago' in str(row['Descripcion']):
            cashflows_mensuales[ym]["Retiros_USD"] += abs(monto_usd)
            
    for ym in cashflows_mensuales:
        cashflows_mensuales[ym]["Aportes_USD"] = round(cashflows_mensuales[ym]["Aportes_USD"], 2)
        cashflows_mensuales[ym]["Retiros_USD"] = round(cashflows_mensuales[ym]["Retiros_USD"], 2)

    # 2. TRADES & VALUACIÓN DE COMPOSICIÓN (Día a Día)
    # Filtramos solo los "Boletos". Y evitamos duplicar la Cantidad por las filas de comisión (Precio == -1)
    mask_trades = df['Descripcion'].str.contains('Boleto', case=False, na=False) & (df['Precio'] > 0)
    df_trades = df[mask_trades].copy()
    df_trades = df_trades.dropna(subset=['Ticker']).copy()
    
    print(f"Boletos de mercado ejecutados: {len(df_trades)}")
    
    tickers_list = df_trades['Ticker'].unique()
    
    print("Descargando historial de precios de activos...")
    prices = {}
    for t in tickers_list:
        yahoo_ticker = str(t)
        
        # Averiguar la moneda en la que mayormente operó este ticker (o forzar búsqueda local si es arg)
        # En el archivo de Movimientos, los tickers ARS a veces se operan en pesos o en usd (AL30 / AL30D).
        # Para simplificar con YF, agregamos .BA a todos los que no parezcan Cedears o si son activos locales.
        # Generalmente yfinance requiere .BA para cotizaciones locales. 
        if not yahoo_ticker.endswith('.BA'):
            yahoo_ticker += '.BA'
            
        try:
            p_data = yf.download(yahoo_ticker, start=start_date, end=end_date, progress=False)["Close"]
            if isinstance(p_data, pd.DataFrame): p_data = p_data.squeeze()
            if not p_data.empty:
                p_data.index = p_data.index.tz_localize(None)
            prices[t] = {"data": p_data}
        except Exception as e:
            prices[t] = {"data": pd.Series()}

    all_dates = pd.date_range(start_date, end_date)
    holdings = {}
    evolucion_diaria = []
    idx_trade = 0
    total_trades = len(df_trades)
    
    print("Reconstruyendo composición de cartera cronológicamente...")
    for curr_date in all_dates:
        curr_date_str = curr_date.strftime('%Y-%m-%d')
        
        while idx_trade < total_trades:
            trade = df_trades.iloc[idx_trade]
            trade_date = trade['Fecha_str']
            if trade_date > curr_date_str:
                break
            
            t = trade['Ticker']
            cant = float(trade['Cantidad'])
            
            if t not in holdings: holdings[t] = 0.0
            # En Movimientos, Cantidad ya viene con signo: compras son positivas, ventas son negativas
            holdings[t] += cant
                
            idx_trade += 1
            
        holdings = {k: v for k, v in holdings.items() if abs(v) > 0.001}
        
        total_usd = 0.0
        compo = {}
        mep_hoy = get_mep(curr_date_str)
        
        for t, nominales in holdings.items():
            p_info = prices.get(t)
            precio = 0.0
            if p_info and not p_info["data"].empty:
                past = p_info["data"][p_info["data"].index <= curr_date]
                if not past.empty:
                    precio = float(past.iloc[-1])
            
            # Como bajamos todo de yahoo finance agregándole .BA, lo asumimos en pesos y dividimos por MEP.
            # (Excepción: si tuviéramos precios directo en USD, no dividimos).
            valor_usd = (precio * nominales) / mep_hoy
            
            if valor_usd > 0:
                compo[t] = {"nominales": round(nominales, 2), "valor_usd": round(valor_usd, 2)}
                total_usd += valor_usd
            
        evolucion_diaria.append({
            "fecha": curr_date_str,
            "valor_total_usd": round(total_usd, 2),
            "composicion": compo
        })
        
    output = {
        "cashflows_mensuales": cashflows_mensuales,
        "evolucion_diaria": evolucion_diaria
    }
    
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(output, f, indent=4)
        
    print(f"\n[OK] Dataset histórico de MOVIMIENTOS generado en: {OUTPUT_FILE}")

if __name__ == "__main__":
    process_movimientos()
