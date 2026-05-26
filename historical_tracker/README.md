# Historical Portfolio Tracker

Esta carpeta contiene los scripts en Python encargados de procesar el historial de operaciones exportado de tu bróker para generar un dataset estructurado.

## Instrucciones

1. **Ubicación del Archivo**: Coloca tu archivo exportado de Excel aquí mismo y llámalo `operaciones.xlsx`.
2. **Entorno de Python**: Asegúrate de instalar las dependencias necesarias:
   ```bash
   pip install -r requirements.txt
   ```
3. **Ejecución**:
   ```bash
   python process_portfolio.py
   ```

## Próximos pasos
Una vez que el archivo esté en esta carpeta, ajustaremos el script `process_portfolio.py` para leer correctamente los nombres de las columnas de tu reporte, obtener el histórico de precios, cruzarlo con la evolución del Dólar MEP, y generar un archivo (por ejemplo `historial_portfolio.json`) que luego será consumido por el dashboard en la web para los gráficos de evolución.
