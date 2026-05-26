import pandas as pd
import yfinance as yf
import datetime
import os

EXCEL_FILE = "movimientos.xlsx"
OUTPUT_FILE = "auditoria_completa_movimientos.xlsx"

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

def clasificar_movimiento(desc):
    desc = str(desc).lower()
    if 'recibo de cobro' in desc:
        return 'Aporte (Fondeo)'
    elif 'comprobante de pago' in desc:
        return 'Retiro (Extracción)'
    elif 'boleto' in desc:
        return 'Trade (Compra/Venta)'
    elif 'dividendo' in desc:
        return 'Rendimiento (Dividendo)'
    elif 'renta' in desc:
        return 'Rendimiento (Renta)'
    else:
        return 'Ignorado (Movimiento Contable Interno)'

def main():
    print(f"Leyendo operaciones desde {EXCEL_FILE}...")
    df = pd.read_excel(EXCEL_FILE)
    
    df['Fecha_Hora'] = pd.to_datetime(df['Concertacion'], errors='coerce')
    df_valid = df.dropna(subset=['Fecha_Hora']).sort_values('Fecha_Hora')
    
    start_date = df_valid['Fecha_Hora'].min().strftime('%Y-%m-%d')
    end_date = (datetime.datetime.now() + datetime.timedelta(days=1)).strftime('%Y-%m-%d')
    
    mep_df = calculate_historical_mep(start_date, end_date)
    
    def get_mep(date_val):
        if pd.isna(date_val) or mep_df.empty: return None
        dt = pd.to_datetime(date_val.strftime('%Y-%m-%d'))
        if dt in mep_df.index:
            return float(mep_df.loc[dt, 'MEP'])
        return float(mep_df.iloc[-1]['MEP'])

    print("Procesando y clasificando fila por fila...")
    
    df['TC_MEP_Dia'] = df['Fecha_Hora'].apply(get_mep)
    df['Clasificacion_Nuestra'] = df['Descripcion'].apply(clasificar_movimiento)
    
    def calcular_usd(row):
        clasif = row['Clasificacion_Nuestra']
        if clasif in ['Aporte (Fondeo)', 'Retiro (Extracción)']:
            importe = float(row['Importe'])
            moneda = str(row['Moneda'])
            
            if 'Pesos' in moneda:
                tc = row['TC_MEP_Dia']
                if pd.notna(tc) and tc > 0:
                    return importe / tc
            else:
                return importe
        return 0.0

    df['Importe_USD_Real_Dashboard'] = df.apply(calcular_usd, axis=1)
    
    # Reordenar columnas para mejor lectura en Excel
    cols = ['Concertacion', 'Descripcion', 'Ticker', 'Tipo de Instrumento', 'Cantidad', 'Precio', 'Liquidacion', 'Moneda', 'Importe', 'Clasificacion_Nuestra', 'TC_MEP_Dia', 'Importe_USD_Real_Dashboard']
    df_export = df[cols].copy()
    
    df_export.to_excel(OUTPUT_FILE, index=False)
    print(f"\n[OK] Archivo de auditoría generado: {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
