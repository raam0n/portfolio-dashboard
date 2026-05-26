import pandas as pd
import sys

def main():
    file_path = "movimientos.xlsx"
    try:
        df = pd.read_excel(file_path)
        print("=== ANÁLISIS EXPLORATORIO DE MOVIMIENTOS ===")
        print(f"Total de registros: {len(df)}")
        print("\nColumnas disponibles:")
        print(list(df.columns))
        
        print("\nTipos de datos:")
        print(df.dtypes)
        
        print("\nPrimeros 3 registros:")
        print(df.head(3).to_string())
        
        print("\nValores únicos para 'Moneda':")
        print(df['Moneda'].unique())
        print("\nValores únicos para 'Tipo de Instrumento':")
        print(df['Tipo de Instrumento'].unique())
        
        # Filtrar liquidez
        recibos = df[df['Descripcion'].str.contains('Recibo de Cobro', na=False)]
        pagos = df[df['Descripcion'].str.contains('Comprobante de Pago', na=False)]
        
        print(f"\nRecibos de Cobro encontrados: {len(recibos)}")
        if len(recibos) > 0:
            print(recibos[['Descripcion', 'Cantidad', 'Importe', 'Moneda']].head())
            
        print(f"\nComprobantes de Pago encontrados: {len(pagos)}")
        if len(pagos) > 0:
            print(pagos[['Descripcion', 'Cantidad', 'Importe', 'Moneda']].head())
            
        # Filtrar trades
        boletos = df[df['Descripcion'].str.contains('Boleto', na=False)]
        print(f"\nBoletos (Trades) encontrados: {len(boletos)}")
        if len(boletos) > 0:
            print(boletos[['Descripcion', 'Ticker', 'Cantidad', 'Precio', 'Importe']].head(10).to_string())
            
        # Verificar Dividendos
        divs = df[df['Descripcion'].str.contains('Dividendo', na=False)]
        print(f"\nDividendos encontrados: {len(divs)}")
        if len(divs) > 0:
            print(divs[['Descripcion', 'Ticker', 'Importe', 'Moneda']].head())
                    
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
