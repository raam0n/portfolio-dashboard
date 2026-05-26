import pandas as pd

df = pd.read_excel('movimientos.xlsx')

print("--- ANÁLISIS DE DEPÓSITOS Y EXTRACCIONES (BALANZ VS NOSOTROS) ---")

mask_aportes = df['Descripcion'].str.contains('Recibo de Cobro', case=False, na=False)
mask_retiros = df['Descripcion'].str.contains('Comprobante de Pago', case=False, na=False)

aportes = df[mask_aportes]
retiros = df[mask_retiros]

aportes_usd = aportes[aportes['Moneda'].str.contains('Dólar|Dollar', case=False, na=False)]['Importe'].sum()
aportes_ars = aportes[aportes['Moneda'].str.contains('Pesos', case=False, na=False)]['Importe'].sum()

retiros_usd = retiros[retiros['Moneda'].str.contains('Dólar|Dollar', case=False, na=False)]['Importe'].sum()
retiros_ars = retiros[retiros['Moneda'].str.contains('Pesos', case=False, na=False)]['Importe'].sum()

print(f"Total Recibos de Cobro (Aportes): USD {aportes_usd:,.2f} + ARS {aportes_ars:,.2f}")
print(f"Total Comprobantes (Retiros): USD {retiros_usd:,.2f} + ARS {retiros_ars:,.2f}")

# Ahora busquemos si hay "Transferencias de Títulos"
mask_titulos = df['Descripcion'].str.contains('Transferencia', case=False, na=False)
print(f"\nTransferencias de Títulos u otros encontradas: {len(df[mask_titulos])}")
if len(df[mask_titulos]) > 0:
    print(df[mask_titulos][['Descripcion', 'Moneda', 'Importe', 'Cantidad']].head())

# Busquemos "Suscripciones" y "Rescates"
mask_suscrip = df['Descripcion'].str.contains('Suscripción|Rescate|Suscripcion', case=False, na=False)
print(f"\nSuscripciones/Rescates encontrados: {len(df[mask_suscrip])}")
if len(df[mask_suscrip]) > 0:
    print(df[mask_suscrip][['Descripcion', 'Importe']].head(10))

# Veamos cómo llegamos a 146k
# Para llegar a 146k USD con aportes_usd + (aportes_ars / X) = 146,574
print("\nSi Balanz llega a 146.574 USD, ¿Qué tipo de cambio implícito en ARS está usando para los aportes?")
if aportes_ars > 0:
    # 146574 = aportes_usd + (aportes_ars / TC) => TC = aportes_ars / (146574 - aportes_usd)
    tc_implicito = aportes_ars / (146574 - aportes_usd)
    print(f"Tipo de cambio implícito promedio para Aportes: {tc_implicito:,.2f} ARS/USD")

if retiros_ars < 0:
    tc_implicito_ret = abs(retiros_ars) / (87603 - abs(retiros_usd))
    print(f"Tipo de cambio implícito promedio para Retiros: {tc_implicito_ret:,.2f} ARS/USD")

