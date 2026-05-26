import pandas as pd

file_path = "operaciones.xlsx"
print(f"--- Análisis Exploratorio de {file_path} ---")

try:
    df = pd.read_excel(file_path)
    
    print("\n[1] INFORMACIÓN GENERAL:")
    print(f"Filas: {df.shape[0]}, Columnas: {df.shape[1]}")
    
    print("\n[2] COLUMNAS Y TIPOS DE DATOS:")
    for col in df.columns:
        null_count = df[col].isnull().sum()
        print(f"- {col}: {df[col].dtype} (Nulos: {null_count})")
        
    print("\n[3] MUESTRA DE DATOS (Primeras 3 filas):")
    print(df.head(3).to_string())
    
    print("\n[4] RESUMEN DE COLUMNAS CATEGÓRICAS (si existen):")
    for col in df.select_dtypes(include=['object', 'category']).columns:
        unique_vals = df[col].nunique()
        if 1 < unique_vals < 20: # Si tiene pocos valores únicos, mostramos su distribución
            print(f"\n--- Columna: {col} ---")
            print(df[col].value_counts().to_string())
            
except Exception as e:
    print(f"Error leyendo el archivo: {e}")
