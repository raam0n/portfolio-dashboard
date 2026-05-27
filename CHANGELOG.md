# CHANGELOG - Balanz Overview

## [v1.11] - 2026-05-27 03:25

*Archivos modificados: `src/App.jsx`, `src/index.css`, `CHANGELOG.md`*

### Added
- **Campos adicionales en Watchlist:** Se añadieron los campos opcionales "Subcategoría" y "País de origen" al registrar nuevos activos en la lista de seguimiento.
- **Visualización mejorada en tabla:** Se agregaron columnas dedicadas para "Subcategoría" y "País" dentro de la tabla de la Watchlist.
- **Filtros multi-selección:** Se implementaron filtros basados en `MultiCheckDropdown` para filtrar de forma dinámica la Watchlist según la subcategoría o el país de origen de los activos.

### Changed
- **Ampliación del contenedor principal:** Se incrementó el ancho máximo de la aplicación (`.app-container`) de `1200px` a `1600px` para aprovechar mejor el espacio lateral en pantallas grandes y evitar desplazamientos horizontales incómodos en tablas extensas.

## [v1.10] - 2026-05-26 18:53

*Archivos modificados: `src/App.jsx`, `src/index.css`, `CHANGELOG.md`*

### Added
- Se incorporó un **Toggle (Interruptor)** interactivo en la cabecera de las tarjetas de métricas del portfolio, permitiendo alternar la visualización global de todos los saldos entre Pesos Argentinos (ARS) y Dólares (USD).
- **Gráfico "% por Activo":** Ahora agrupa automáticamente bajo la categoría "Otros" a todos aquellos activos que representen menos del 1% del valor total de la cartera, mejorando la legibilidad.
- **Soporte de Liquidez (Caja):** Ahora es posible cargar saldos líquidos disponibles ("Efectivo") con ticker ARS o USD. Estos se suman al total de la cartera, tienen valuación fija de 1 y contabilizan para los cálculos y gráficos de distribución global, permitiendo trackear el capital inactivo.

### Changed
- Se unificó el tamaño y peso tipográfico de las cifras en dólares y pesos en las tarjetas, logrando una estética más armónica y prolija.
- Se simplificó la vista de las métricas de "Valor Total" y "Cambio Diario" eliminando información secundaria cruzada; ahora muestran exclusivamente los valores en la moneda seleccionada en el toggle.
- La métrica de "Ganancia/Pérdida Total" fue fijada exclusivamente en moneda local (ARS) para preservar la exactitud del cálculo de rendimiento histórico acumulado.
- Reducción general de márgenes (espacios muertos) entre el infinite scroll de mercados, el toggle de monedas y las tarjetas de saldos, maximizando el espacio de lectura.

## [v1.09] - 2026-05-26 18:16

*Archivos modificados: `src/App.jsx`, `DOCUMENTACION.md`, `CHANGELOG.md`*

### Added
- Implementado el cálculo preciso del **Cambio Diario en USD (MEP)** para todo el portfolio.
- Se agregó el cálculo automático del tipo de cambio MEP implícito del cierre anterior ($dolarMepPrev$) cruzando los tickers `AL30.BA` y `AL30D.BA` de Yahoo Finance (con fallback a `GGAL.BA`/`GGAL`).
- Se incorporaron las ecuaciones de conversión bi-monetaria en el bucle de cómputo para valuar y calcular los cambios diarios separadamente según si el activo cotiza en ARS o USD (evitando distorsiones del tipo de cambio).
- Rediseño visual de la tarjeta de "Cambio Diario" para mostrar simultáneamente los resultados de la jornada en ARS y USD MEP de manera Premium y estética.

### Changed
- El "Valor Total en USD" de la cabecera ahora utiliza el cálculo acumulado neto real multimoneda (`totalValorUSD`) en lugar de dividir linealmente el valor final en pesos.

## [v1.08] - 2026-05-21 21:03

*Archivos modificados: `historical_tracker/process_movimientos.py`, `CHANGELOG.md`*

### Added
- Se incorporó la variable `SALDO_INICIAL_USD = 13394.11` en `process_movimientos.py`. Este valor es inyectado al inicio de la serie temporal (2021) para compensar el hecho de que el archivo de exportación de Balanz arranca con un balance preexistente.
- El total de capital aportado y las métricas anuales de 2021 ahora reflejan este fondeo inicial de manera correcta.

### Changed
- N/A
## [v1.07] - 2026-05-21 20:02

*Archivos modificados: `historical_tracker/plot_portfolio.py`, `historical_tracker/requirements.txt`, `CHANGELOG.md`*

### Added
- Nuevo gráfico `chart_capital_acumulado.html` generado a partir del neto histórico de aportes menos retiros.
- Generación automática del archivo `reporte_aportes_anual.md` que detalla el esfuerzo de ahorro anual.
- Se agregó el cálculo de promedios mensuales de aportes netos por año, considerando los meses activos en cada periodo.
- Librería `tabulate` añadida a `requirements.txt` para formateo de tablas en Markdown.

### Changed
- N/A
## [v1.06] - 2026-05-21 19:54

*Archivos modificados: `historical_tracker/eda_movimientos.py`, `historical_tracker/process_movimientos.py`, `historical_tracker/plot_portfolio.py`, `CHANGELOG.md`*

### Added
- Nuevo pipeline de procesamiento **paralelo** para validar una fuente de datos alternativa (`movimientos.xlsx`).
- Script `eda_movimientos.py` para comprender la estructura de flujos de caja y operaciones dentro de este nuevo archivo.
- Script `process_movimientos.py` que interpreta correctamente los "Recibo de Cobro" (Aportes), "Comprobante de Pago" (Retiros) y "Boletos" (Trades sin contar la comisión) y lo exporta a `historial_portfolio_movimientos.json`.
- Modificación en `plot_portfolio.py` para aceptar argumentos dinámicos y poder generar los gráficos `chart_evolucion.html` y `chart_flujos.html` basándose en el nuevo dataset.

### Changed
- N/A
## [v1.05] - 2026-05-21 19:24

*Archivos modificados: `historical_tracker/requirements.txt`, `historical_tracker/plot_portfolio.py`, `CHANGELOG.md`*

### Added
- Incorporación de la librería `plotly` a los requirements del backend.
- Creación y ejecución de un script de visualización independiente (`plot_portfolio.py`) para renderizar el dataset JSON (`historial_portfolio.json`) en gráficos HTML interactivos (`chart_evolucion.html` y `chart_flujos.html`). Esto permite la validación visual de los datos fuera del entorno de React antes de su integración final en el dashboard.

### Changed
- N/A
## [v1.04] - 2026-05-21 19:20

*Archivos modificados: `historical_tracker/process_portfolio.py`, `CHANGELOG.md`*

### Fixed
- Corrección de un error de codificación (UnicodeEncodeError) en la consola de Windows al finalizar la generación del JSON en el script `process_portfolio.py`.

### Added
- Ejecución completa del pipeline y generación inicial de `historial_portfolio.json` aislando flujos de caja y recomponiendo la cartera a precio de cierre diario + MEP.
## [v1.03] - 2026-05-21 19:15

*Archivos modificados: `DOCUMENTACION.md`, `CHANGELOG.md`*

### Added
- Definición formal de las Reglas de Negocio en `DOCUMENTACION.md` para el procesamiento del historial del bróker: mapeo de estados válidos (`Ejecutada`, `Finalizada`, `Parcialmente Cancelada`) y el uso estricto de los campos `Cantidad Operada` y `Precio Operado`.
- Inclusión de dos nuevos hitos analíticos en el Roadmap: "Evolución de composición de activos" y "Análisis de Flujo de Caja vs Rendimientos históricos".

### Changed
- N/A
## [v1.02] - 2026-05-21 18:59

*Archivos modificados: `historical_tracker/eda.py`, `CHANGELOG.md`*

### Added
- Creación de un script `eda.py` (Exploratory Data Analysis) dentro de la carpeta `historical_tracker` para leer la estructura, valores únicos y tipos de datos del archivo Excel del bróker y comprender los flujos transaccionales.

### Changed
- N/A
## [v1.01] - 2026-05-21 18:54

*Archivos modificados: `historical_tracker/process_portfolio.py`, `historical_tracker/requirements.txt`, `historical_tracker/README.md`, `DOCUMENTACION.md`, `CHANGELOG.md`*

### Added
- Creación de la carpeta `historical_tracker` para alojar los scripts de backend (Python) aislados del frontend de React.
- Creación de `process_portfolio.py`, un script base diseñado para leer las operaciones históricas de un Excel (`operaciones.xlsx`), obtener el histórico de precios usando `yfinance`, y calcular el Dólar MEP usando el ADR de GGAL como proxy.
- Creación de `requirements.txt` y `README.md` dentro de la nueva carpeta para documentar el entorno virtual necesario (`pandas`, `yfinance`, `openpyxl`).

### Changed
- Actualización de `DOCUMENTACION.md` incorporando la nueva carpeta en la Estructura de Archivos y marcando la tarea de inicialización del pipeline en el Estado del Proyecto.
## [v1.00] - 2026-05-21 18:09

*Archivos modificados: `DOCUMENTACION.md`, `CHANGELOG.md`*

### Added
- Creación del archivo `DOCUMENTACION.md` estableciendo el estándar técnico del proyecto, detallando la arquitectura, reglas de negocio, y el stack tecnológico basado en React y Vite.
- Creación del archivo `CHANGELOG.md` para iniciar el control de versiones semántico e histórico de modificaciones del proyecto de forma estructurada.

### Changed
- N/A

### Fixed
- N/A

### Refactor
- N/A
