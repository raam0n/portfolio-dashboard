import json
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import os

import sys

def plot_charts():
    json_file = "historial_portfolio.json"
    if len(sys.argv) > 1:
        json_file = sys.argv[1]
        
    if not os.path.exists(json_file):
        print(f"Error: {json_file} no existe. Ejecuta process_portfolio.py primero.")
        return
        
    print(f"Leyendo datos desde {json_file}...")
    with open(json_file, 'r') as f:
        data = json.load(f)
        
    # --- 1. GRÁFICO DE EVOLUCIÓN DIARIA ---
    evolucion = data.get("evolucion_diaria", [])
    if evolucion:
        df_ev = pd.DataFrame(evolucion)
        # Asegurarse de que las fechas sean datetime para Plotly
        df_ev['fecha'] = pd.to_datetime(df_ev['fecha'])
        
        # Graficar el total
        fig1 = px.area(df_ev, x='fecha', y='valor_total_usd', 
                      title="Evolución Histórica de la Cartera (USD)",
                      labels={'valor_total_usd': 'Valor Total (USD)', 'fecha': 'Fecha'},
                      color_discrete_sequence=['#6366f1'])
                      
        fig1.update_layout(template="plotly_dark", hovermode="x unified")
        fig1.write_html("chart_evolucion.html")
        print("-> Gráfico generado: chart_evolucion.html")
        
    # --- 2. GRÁFICO DE FLUJOS DE CAJA ---
    cashflows = data.get("cashflows_mensuales", {})
    if cashflows:
        # Convertir a DataFrame
        meses = list(cashflows.keys())
        aportes = [v["Aportes_USD"] for v in cashflows.values()]
        retiros = [-v["Retiros_USD"] for v in cashflows.values()] # Negativo para que vaya hacia abajo
        
        fig2 = go.Figure()
        fig2.add_trace(go.Bar(x=meses, y=aportes, name='Aportes', marker_color='#10b981'))
        fig2.add_trace(go.Bar(x=meses, y=retiros, name='Retiros', marker_color='#ef4444'))
        
        fig2.update_layout(
            title="Flujo de Caja Mensual (USD)",
            xaxis_title="Mes",
            yaxis_title="Monto (USD)",
            barmode='relative',
            template="plotly_dark"
        )
        fig2.write_html("chart_flujos.html")
        print("-> Gráfico generado: chart_flujos.html")
        
    # --- 3. GRÁFICO DE CAPITAL ACUMULADO Y ANÁLISIS AÑO A AÑO ---
    if cashflows:
        # Armamos un dataframe para manipular los flujos
        df_cf = pd.DataFrame([
            {"mes": mes, "aportes": v["Aportes_USD"], "retiros": v["Retiros_USD"], "neto": v["Aportes_USD"] - v["Retiros_USD"]}
            for mes, v in cashflows.items()
        ])
        # Aseguramos el orden cronológico
        df_cf = df_cf.sort_values("mes").reset_index(drop=True)
        # Acumulamos el neto a lo largo del tiempo
        df_cf["acumulado"] = df_cf["neto"].cumsum()
        
        # Generar Gráfico 3
        fig3 = px.line(df_cf, x="mes", y="acumulado", markers=True,
                      title="Capital Acumulado (Neto Histórico de Aportes menos Retiros)",
                      labels={'acumulado': 'Capital Aportado Acumulado (USD)', 'mes': 'Mes'},
                      color_discrete_sequence=['#f59e0b'])
        # Rellenar el área bajo la curva para que se vea más premium
        fig3.update_traces(fill='tozeroy', line=dict(width=3))
        fig3.update_layout(template="plotly_dark", hovermode="x unified")
        fig3.write_html("chart_capital_acumulado.html")
        print("-> Gráfico generado: chart_capital_acumulado.html")

        # Generar Análisis Año a Año
        df_cf['año'] = df_cf['mes'].str[:4]
        resumen_anual = df_cf.groupby('año').agg(
            total_aportes=('aportes', 'sum'),
            total_retiros=('retiros', 'sum'),
            neto_anual=('neto', 'sum'),
            meses_con_movimientos=('mes', 'count')
        ).reset_index()
        
        # Calcular el promedio mensual neto por año (Neto Anual / 12)
        import datetime
        current_year = str(datetime.datetime.now().year)
        current_month = datetime.datetime.now().month
        
        def calculate_avg(row):
            if row['año'] == current_year:
                # Para el año en curso, dividimos por los meses transcurridos
                return row['neto_anual'] / current_month
            else:
                # Para años cerrados, siempre dividido 12
                return row['neto_anual'] / 12.0
                
        resumen_anual['promedio_mensual_aportado'] = resumen_anual.apply(calculate_avg, axis=1)
        
        # Redondear para la visualización
        resumen_anual = resumen_anual.round(2)
        
        print("\n=== ANÁLISIS AÑO A AÑO DE APORTES (USD) ===")
        print(resumen_anual.to_string(index=False))
        
        # Guardar como Markdown
        md_content = "# Análisis Histórico de Aportes Año a Año\n\n"
        md_content += "Este documento detalla el esfuerzo de ahorro y aporte de capital realizado en la cuenta de inversión a lo largo de los años.\n\n"
        md_content += "### Resumen por Año\n\n"
        md_content += resumen_anual.to_markdown(index=False)
        md_content += f"\n\n*Nota: `promedio_mensual_aportado` se calcula dividiendo el `neto_anual` por 12. Para el año en curso ({current_year}), se divide por los meses transcurridos ({current_month}).*"
        
        with open("reporte_aportes_anual.md", "w", encoding="utf-8") as f:
            f.write(md_content)
        print("-> Reporte generado: reporte_aportes_anual.md")
        
    print("\n[OK] Gráficos interactivos generados con éxito. Ábrelos en tu navegador.")

if __name__ == "__main__":
    plot_charts()
