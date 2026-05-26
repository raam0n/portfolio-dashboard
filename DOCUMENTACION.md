# 📈 Balanz Overview - Dashboard de Inversiones

## 🌟 Descripción General
Balanz Overview es una aplicación web interactiva (dashboard) diseñada para la gestión, seguimiento y análisis de un portfolio de inversiones. Permite a los usuarios registrar sus tenencias (acciones, CEDEARs, bonos, criptomonedas), monitorear operaciones históricas, administrar una watchlist de activos y visualizar en tiempo real o diferido las cotizaciones tanto del mercado local (Argentina) como internacional (EE.UU.), incluyendo el cálculo automático de tipos de cambio financieros como Dólar MEP y CCL.

## 🏗️ Arquitectura Técnica
- **Frontend**: React.js (v19) moderno con Functional Components y Hooks (`useState`, `useEffect`).
- **Build Tool**: Vite (v8) para un entorno de desarrollo ultra rápido y construcción optimizada.
- **Estilos**: Vanilla CSS (`index.css`, `App.css`) enfocado en variables CSS, flexbox y estética premium.
- **Consumo de APIs**: 
  - Yahoo Finance (a través de un proxy/endpoint local) para cotizaciones históricas y en tiempo real.
  - DolarAPI (`dolarapi.com`) para tipos de cambio locales (MEP y CCL).
- **Despliegue**: Preparado para Vercel (evidenciado por `vercel.json`).

## 💾 Detalle de la Base de Datos o Almacenamiento
El sistema no utiliza una base de datos relacional tradicional, sino que confía en la persistencia local en el navegador del usuario a través de `localStorage` utilizando estructuras JSON.

### Colecciones Principales (localStorage):
- `portfolio_holdings`: Arreglo de objetos con los activos actuales. Campos: `ticker`, `tipo`, `mercado`, `nombre`, `cantidad`, `precioEntrada`, `precioActual` (para bonos).
- `portfolio_operaciones`: Arreglo de objetos con el historial de compras/ventas. Campos: `id`, `ticker`, `assetTipo`, `tipo` (compra/venta), `cantidad`, `precio`, `fecha`.
- `portfolio_watchlist`: Arreglo de activos en seguimiento. Campos: `ticker`, `tipo`, `mercado`, `nombre`, `categoria`.
- `portfolio_trades`: Registro de operaciones de "Trade" cerradas (compra y venta emparejadas).
- `portfolio_evals`: Registro de evaluaciones de rendimiento o notas de trades.
- `cached_prices` / `cached_stats`: Caché de precios y estadísticas diarias consultadas a las APIs para evitar llamadas innecesarias y acelerar la carga.

## 📁 Estructura de Archivos

### Core de la Aplicación (Frontend)
- `src/App.jsx`: Componente principal. Contiene toda la lógica de negocio, cálculos de portfolio, llamadas a APIs, y renderizado de la UI.
- `src/main.jsx`: Punto de entrada de React que monta la aplicación en el DOM.

### Lógica y Algoritmos
- Incluidos dentro de `App.jsx`, abarcando desde funciones matemáticas para cálculo de promedios, rendimientos (`changePct`), hasta transformaciones de tickers (e.g. agregar `.BA` para mercado local).

### Estilos y Diseño
- `src/index.css`: Sistema de diseño principal, variables CSS globales, colores, tipografía y estilos base.
- `src/App.css`: Estilos específicos de componentes de la aplicación.

### Configuración y Despliegue
- `package.json`: Dependencias del proyecto y scripts de ejecución.
- `vite.config.js`: Configuración del empaquetador Vite.
- `vercel.json`: Reglas de enrutamiento y configuración para el host Vercel.
- `Start-Dashboard.bat`: Script de Windows para levantar el entorno local rápidamente.

### Procesamiento de Datos Históricos (Backend)
- `historical_tracker/`: Carpeta destinada a los scripts de Python para procesar el archivo Excel de operaciones del bróker.
  - `process_portfolio.py`: Script principal que utilizará pandas y yfinance para calcular tenencias diarias y Dólar MEP histórico.
  - `requirements.txt`: Dependencias de Python necesarias.

## ⚙️ Reglas del Sistema / Reglas de Negocio
- **Sincronización de Mercado**: El sistema identifica automáticamente si el activo es local o internacional. A los activos locales (`accion`, `cedear`) se les añade el sufijo `.BA` antes de consultar la API de Yahoo Finance, excepto a los que se definen como `stock` (EE.UU.).
- **Conversión de Moneda y Multi-divisa**: 
  - Las métricas de mercado locales y el índice Merval se ajustan contra el Dólar CCL o MEP en tiempo real para reflejar su valor duro en USD.
  - **Cálculo de Cambio Diario Multi-divisa (ARS / USD)**: La aplicación realiza una separación estricta por tipo de moneda de cada activo. Para los activos locales (ARS), el valor se convierte usando el Dólar MEP del cierre anterior ($dolarMepPrev$) y el MEP actual para aislar el movimiento real de los activos en dólares del efecto distorsivo del tipo de cambio. El dólar MEP del cierre anterior se calcula dinámicamente cruzando las cotizaciones del bono AL30 en Pesos y Dólares (`AL30.BA` / `AL30D.BA`) desde Yahoo Finance.
- **Persistencia Reactiva**: Cualquier modificación en el estado de las tenencias, operaciones o watchlist desencadena un guardado inmediato en `localStorage`.
- **Caché Inteligente**: El sistema guarda los últimos precios conocidos (`cached_prices`). Si las APIs fallan o el mercado está cerrado, se utilizan estos valores de respaldo.
- **Cálculos de Rendimiento**: El sistema calcula el "Precio Promedio de Compra" (PPC) dinámicamente y muestra ganancias/pérdidas tanto en valor nominal como porcentual.
- **Procesamiento de Histórico (Broker)**:
  - Se consideran exitosas las operaciones en estado `Ejecutada`, `Finalizada` y `Parcialmente Cancelada`.
  - Se ignoran las operaciones `Cancelada` y `Rechazada`.
  - Para cálculos de volumen y montos, se utilizan estrictamente los campos `Cantidad Operada` y `Precio Operado` (crucial para las parcialmente canceladas).
  - Los depósitos pueden figurar tanto como `Finalizada` o `Ejecutada`.

## 🚀 Configuración y Uso
1. **Clonar el Repositorio** (o descargar los archivos).
2. **Instalar Dependencias**: Abre una terminal en la raíz del proyecto y ejecuta:
   ```bash
   npm install
   ```
3. **Ejecutar Localmente**: Puedes iniciar la aplicación mediante el script proporcionado:
   - Haz doble clic en `Start-Dashboard.bat`.
   - O bien, desde la terminal ejecuta: `npm run dev`.
4. **Acceder**: Abre tu navegador y navega a `http://localhost:5173/` (o el puerto que indique Vite).

## ✅ Estado del Proyecto
- [x] Inicialización del entorno de Vite y React.
- [x] Configuración de UI/UX premium y estilos base (`index.css`).
- [x] Implementación de lógica de Portfolio y Watchlist.
- [x] Integración con APIs de mercado (Yahoo Finance proxy, DolarAPI).
- [x] Persistencia de datos en LocalStorage.
- [x] Lógica de Cambio Diario en USD (MEP) real aislando variaciones de tipo de cambio mediante implícitos (`AL30.BA`/`AL30D.BA`).
- [x] Documentación y Changelog actualizados.
- [x] Creación de entorno y pipeline Python base (`historical_tracker`) para procesar dataset histórico de la cartera.
- [ ] Construir lógica en Python para evolución de composición de activos (Día a Día).
- [ ] Construir lógica en Python para análisis de Flujo de Caja (Aportes vs Rendimientos por Año/Mes).
- [ ] Refactorización: Modularizar `App.jsx` en componentes más pequeños (sugerido para escalabilidad futura).
- [ ] Soporte de Backend real / Base de Datos en la nube (opcional, roadmap).

*Documentación generada automáticamente por Antigravity AI.*
