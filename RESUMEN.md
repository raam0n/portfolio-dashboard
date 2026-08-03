# Resumen del Proyecto: Balanz Overview

Este documento resume todo lo que hemos construido hasta la fecha en el proyecto **Balanz Overview**, un dashboard interactivo para el seguimiento y análisis de un portfolio de inversiones.

## 1. Aplicación Principal (Frontend)
Hemos desarrollado una aplicación web moderna utilizando **React.js** y **Vite**. Sus características principales son:

- **Gestión de Portfolio:** Capacidad para cargar y visualizar tenencias de diferentes tipos de activos (Acciones, CEDEARs, Bonos, Criptomonedas y Efectivo/Caja).
- **Soporte Multimoneda Inteligente:** 
  - Cálculo en tiempo real del Dólar MEP (utilizando cruce de bonos como AL30/AL30D).
  - Un _Toggle_ (interruptor) global que permite visualizar todos los saldos y rendimientos de la aplicación entera en **Pesos (ARS)** o en **Dólares (USD)** de forma instantánea.
  - Aislamiento del efecto del tipo de cambio para calcular el rendimiento real ("Cambio Diario") de los activos que cotizan en pesos pero se analizan en dólares.
- **Visualización y UX Premium:** 
  - Gráficos integrados, como la distribución porcentual de la cartera (agrupando activos menores al 1% en "Otros").
  - Tabla de "Mis Activos" con ordenamiento dinámico por múltiples columnas (Nombre, %, P&L, etc.).
- **Watchlist Avanzada:** Lista de seguimiento de activos con campos adicionales como "País de origen" y "Subcategoría", incluyendo filtros dinámicos (MultiCheckDropdown).
- **Módulo de Honorarios y Asesoría (5% Semestral):** Solapa dedicada a la gestión de carteras de clientes que calcula la comisión semestral (5%) sobre ganancias netas en Pesos (ARS), aislando depósitos/retiros de capital, con **Modo Privado** para ocultar montos confidenciales y liquidación automática en Flujos de Caja.
- **Persistencia de Datos:** Todo se guarda localmente en el navegador (`localStorage`), por lo que no requiere de una base de datos externa para funcionar de manera individual.

## 2. Procesamiento de Datos Históricos (Backend en Python)
Hemos construido un entorno paralelo en Python (`historical_tracker/`) diseñado para analizar el historial real exportado desde el bróker:

- **Procesamiento de Archivos Excel:** Scripts (`process_movimientos.py`, `process_portfolio.py`) que leen y limpian los registros de operaciones y movimientos de fondos del bróker.
- **Histórico de Precios y MEP:** Integración con la API de Yahoo Finance (`yfinance`) para reconstruir el valor de la cartera día a día en el pasado, incluyendo el tipo de cambio histórico.
- **Cálculo de Flujos de Caja:** Detección de aportes y retiros de capital para poder determinar cuál es el rendimiento neto por sobre el capital realmente invertido (con compensación de saldos iniciales).
- **Visualizaciones Interactivas (Plotly):** Generación automática de gráficos en formato HTML (`chart_evolucion.html`, `chart_flujos.html`, `chart_capital_acumulado.html`) para validar visualmente la evolución temporal de la cuenta.

## 3. Estado de la Arquitectura y Documentación
- **Documentación Completa:** Mantenemos un archivo `DOCUMENTACION.md` con las reglas de negocio técnicas y un `CHANGELOG.md` que detalla versión a versión todas las mejoras implementadas.
- **Despliegue Listo:** La aplicación cuenta con la configuración necesaria (`vercel.json`) para ser subida a plataformas de hosting modernas, además de un script (`Start-Dashboard.bat`) para levantar el entorno local con un solo clic.

---
**En pocas palabras:** Tenemos un producto híbrido compuesto por un dashboard web estético y funcional en tiempo real, complementado por un potente motor de análisis de datos en Python para auditar la rentabilidad histórica de la cuenta.
