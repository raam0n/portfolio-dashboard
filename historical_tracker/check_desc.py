import pandas as pd
import numpy as np

df = pd.read_excel('movimientos.xlsx')

print("=== Agrupación de todas las descripciones ===")
# Agrupar por descripción y moneda
grouped = df.groupby(['Descripcion', 'Moneda'])['Importe'].sum().reset_index()

# Filtrar las que tienen importe significativo (mayor a 1000 ARS o 10 USD)
# O simplemente ordenarlas
grouped['Abs_Importe'] = grouped['Importe'].abs()
grouped = grouped.sort_values('Abs_Importe', ascending=False)

for _, row in grouped.head(30).iterrows():
    print(f"{row['Descripcion'][:60]:<60} | {row['Moneda']:<15} | {row['Importe']:>15,.2f}")

print("\n=== Todos los importes brutos (positivos y negativos) ===")
# Miremos si la suma de ALGUNAS cosas da los ~146k
# Filtra todo lo que es estrictamente POSITIVO y NO ES Boleto, ni Dividendo, ni Renta
positivos = df[(df['Importe'] > 0) & (~df['Descripcion'].str.contains('Boleto|Dividendo|Renta', case=False, na=False))]
negativos = df[(df['Importe'] < 0) & (~df['Descripcion'].str.contains('Boleto|Dividendo|Renta', case=False, na=False))]

print("\nPOSITIVOS (No Boletos, No Dividendos, No Renta):")
pos_grouped = positivos.groupby(['Descripcion', 'Moneda'])['Importe'].sum().reset_index()
for _, row in pos_grouped.sort_values('Importe', ascending=False).iterrows():
    print(f"{row['Descripcion'][:60]:<60} | {row['Moneda']:<15} | {row['Importe']:>15,.2f}")

print("\nNEGATIVOS (No Boletos, No Dividendos, No Renta):")
neg_grouped = negativos.groupby(['Descripcion', 'Moneda'])['Importe'].sum().reset_index()
for _, row in neg_grouped.sort_values('Importe').iterrows():
    print(f"{row['Descripcion'][:60]:<60} | {row['Moneda']:<15} | {row['Importe']:>15,.2f}")

