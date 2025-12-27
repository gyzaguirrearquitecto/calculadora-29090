# Calculadora 29090 – MVP (PWA)

Este paquete es una **PWA** (web‑app instalable) con dos módulos:

1) **Calculadora (plantilla)**: usa catálogos de tipologías (FUE/FUHU) y aplica reglas básicas (p. ej. método de estimación del valor de obra por tipo de intervención).
2) **Observatorio (demo)**: filtros desplegables sobre un CSV (`data/licencias_sample.csv`).

## Abrir en PC (rápido)
- Doble clic en `index.html` (funciona, pero el modo offline puede depender del navegador).
- Recomendado: levantar un servidor local.

## Servidor local (recomendado)
Si tienes Python instalado:
```bash
cd licencias_pwa_29090
python -m http.server 8000
```
Luego abre: `http://localhost:8000`

## Instalar en celular
- Android: abre la URL en Chrome → menú → “Agregar a pantalla de inicio”.
- iPhone: abre en Safari → compartir → “Añadir a pantalla de inicio”.

## Editar catálogos y reglas
- Catálogos: `catalog/*.json`
- Reglas: `rules/rules.json`

## Cargar datos reales de licencias
Reemplaza `data/licencias_sample.csv` manteniendo los encabezados o usa el botón “Descargar plantilla CSV”.

