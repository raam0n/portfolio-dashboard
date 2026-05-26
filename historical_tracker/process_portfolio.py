import pandas as pd
import yfinance as yf
import datetime
import os
import json
import warnings

warnings.filterwarnings("ignore")

EXCEL_FILE = "operaciones.xlsx"
OUTPUT_FILE = "historial_portfolio.json"

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
        
        # Rellenar fines de semana para tener MEP constante esos días
        idx = pd.date_range(start_date, end_date)
        df = df.reindex(idx).ffill().bfill()
        return df
    except Exception as e:
        print(f"Error calculando MEP: {e}")
        return pd.DataFrame()

def process_operations():
    if not os.path.exists(EXCEL_FILE):
        print(f"ERROR: No se encontró el archivo '{EXCEL_FILE}'. Por favor, colócalo en esta carpeta.")
        return

    print(f"Leyendo operaciones desde {EXCEL_FILE}...")
    df = pd.read_excel(EXCEL_FILE)
    
    # 1. LIMPIEZA
    df = df[df['Estado'].isin(['Ejecutada', 'Finalizada', 'Parcialmente Cancelada'])].copy()
    df['Fecha_Hora'] = pd.to_datetime(df['Fecha'].astype(str) + ' ' + df['Hora'].astype(str), errors='coerce')
    df = df.dropna(subset=['Fecha_Hora']).sort_values('Fecha_Hora').reset_index(drop=True)
    df['Fecha_str'] = df['Fecha_Hora'].dt.strftime('%Y-%m-%d')
    
    start_date = df['Fecha_Hora'].min().strftime('%Y-%m-%d')
    end_date = (datetime.datetime.now() + datetime.timedelta(days=1)).strftime('%Y-%m-%d')
    
    # 2. SEPARAR CASHFLOW VS TRADES
    liquidez_ops = ['Depósito', 'Transferencia']
    df_cashflow = df[df['Operacion'].isin(liquidez_ops)].copy()
    df_trades = df[~df['Operacion'].isin(liquidez_ops)].copy()
    
    print(f"Datos limpios: {len(df_cashflow)} aportes/retiros y {len(df_trades)} operaciones de mercado.")
    
    # Descargar MEP Histórico
    mep_df = calculate_historical_mep(start_date, end_date)
    
    def get_mep(date_str):
        if mep_df.empty: return 1000 # Fallback extremo
        dt = pd.to_datetime(date_str)
        if dt in mep_df.index:
            return float(mep_df.loc[dt, 'MEP'])
        return float(mep_df.iloc[-1]['MEP'])

    # 3. ANÁLISIS DE FLUJO DE CAJA (Aportes vs Retiros)
    cashflows_mensuales = {}
    for _, row in df_cashflow.iterrows():
        ym = row['Fecha_Hora'].strftime('%Y-%m')
        if ym not in cashflows_mensuales:
            cashflows_mensuales[ym] = {"Aportes_USD": 0.0, "Retiros_USD": 0.0}
        
        monto = float(row['Monto'])
        cant = float(row['Cantidad Operada'])
        # Identificar retiros: cantidad negativa, o transferencia de salida
        is_retiro = (cant < 0) or ("Transferencia" in str(row['Operacion']) and cant < 0)
        
        monto_usd = monto / get_mep(row['Fecha_str']) if row['Moneda'] == 'Pesos' else monto
            
        if is_retiro:
            cashflows_mensuales[ym]["Retiros_USD"] += abs(monto_usd)
        else:
            cashflows_mensuales[ym]["Aportes_USD"] += abs(monto_usd)
            
    for ym in cashflows_mensuales:
        cashflows_mensuales[ym]["Aportes_USD"] = round(cashflows_mensuales[ym]["Aportes_USD"], 2)
        cashflows_mensuales[ym]["Retiros_USD"] = round(cashflows_mensuales[ym]["Retiros_USD"], 2)

    # 4. TRADES & VALUACIÓN DE COMPOSICIÓN (Día a Día)
    df_trades = df_trades.dropna(subset=['Ticker']).copy()
    tickers_list = df_trades['Ticker'].unique()
    
    print("Descargando historial de precios de activos...")
    prices = {}
    for t in tickers_list:
        yahoo_ticker = str(t)
        moneda_op = df_trades[df_trades['Ticker'] == t]['Moneda'].iloc[0]
        is_pesos = moneda_op == 'Pesos'
        
        # Corrección sufijo local
        if is_pesos and not yahoo_ticker.endswith('.BA'):
            yahoo_ticker += '.BA'
            
        try:
            p_data = yf.download(yahoo_ticker, start=start_date, end=end_date, progress=False)["Close"]
            if isinstance(p_data, pd.DataFrame): p_data = p_data.squeeze()
            if not p_data.empty:
                p_data.index = p_data.index.tz_localize(None)
            prices[t] = {"data": p_data, "is_pesos": is_pesos}
        except Exception as e:
            prices[t] = {"data": pd.Series(), "is_pesos": is_pesos}

    all_dates = pd.date_range(start_date, end_date)
    holdings = {}
    evolucion_diaria = []
    idx_trade = 0
    total_trades = len(df_trades)
    
    print("Reconstruyendo composición de cartera cronológicamente...")
    for curr_date in all_dates:
        curr_date_str = curr_date.strftime('%Y-%m-%d')
        
        # Aplicar trades ocurridos hasta el día actual
        while idx_trade < total_trades:
            trade = df_trades.iloc[idx_trade]
            trade_date = trade['Fecha_str']
            if trade_date > curr_date_str:
                break # Rompe porque los datos están ordenados
            
            t = trade['Ticker']
            cant = float(trade['Cantidad Operada'])
            op = str(trade['Operacion']).lower()
            
            if t not in holdings: holdings[t] = 0.0
            if 'compra' in op: holdings[t] += cant
            elif 'venta' in op: holdings[t] -= cant
                
            idx_trade += 1
            
        # Limpiar activos vendidos completamente
        holdings = {k: v for k, v in holdings.items() if abs(v) > 0.001}
        
        # Valuar la cartera al cierre del día
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
            
            is_pesos = p_info["is_pesos"] if p_info else False
            valor_usd = (precio * nominales) / mep_hoy if is_pesos else (precio * nominales)
            
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
        
    print(f"\n[OK] Dataset histórico generado exitosamente en: {OUTPUT_FILE}")
    print("Este JSON contiene tanto los aportes mensuales separados como la valuación día por día, listo para el dashboard.")

if __name__ == "__main__":
    process_operations()

