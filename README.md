# Calculadora CVU + Honorarios (App estática)

App **100% estática** lista para **GitHub Pages** (sin build, sin dependencias). Permite:

- Calcular **Valor Unitario (CVU)** por partidas (7 columnas), **sumando por columna** y permitiendo **intercalados**.
- Aplicar la regla CVU: **si eliges A en “Muros y Columnas”**, el **techo está incluido** (no suma “Techos”).
- Ajustar **cimentación** según **tipo de suelo** y **sistema de cimentación** (factor editable) aplicándolo solo a una **porción configurable** de “Muros y Columnas”.
- Aplicar la regla: **+5% desde el 5to piso** (automático o manual).
- Calcular **honorarios** como % del costo de obra según **área (m²)**.
- Desglosar **cobro por fases** y generar una **propuesta imprimible** (PDF vía imprimir del navegador).
- Guardado automático en el navegador (localStorage) y exportación/importación de proyecto (JSON).

## 1) Ejecutar localmente

> Para que funcione `fetch()` de los archivos JSON, ejecuta un servidor local.

### Opción A: Python
```bash
python -m http.server 8000
```
Abre:
- http://localhost:8000

### Opción B: VS Code Live Server
- Instala la extensión “Live Server” y ejecuta “Open with Live Server”.

## 2) Subir a GitHub Pages (rápido)

1. Crea un repositorio (ej.: `cvu-honorarios-app`).
2. Sube TODO el contenido de este ZIP al repo.
3. Ve a **Settings → Pages**.
4. En **Build and deployment** elige:
   - **Source:** Deploy from a branch
   - **Branch:** `main` / root (`/`)
5. Guarda. En 1–2 minutos se publica.

## 3) Editar datos

Los catálogos se encuentran en `/data/`:

- `cvu_lima_callao_2025_12.json` (CVU diciembre 2025, Lima/Callao)
- `honorarios_por_area.json` (% por m²)
- `fases_cobro.json` (guía de cobro por fases)
- `tipos_obra.json` (catálogo de tipos de obra)
- `cimentacion_defaults.json` (matriz sugerida suelo × cimentación)

## 4) Notas de alcance

- La cimentación se modela como un **ajuste** (factor editable) sobre una **porción** de “Muros y Columnas”.
- Para una cotización final, calibra con:
  - Estudio de Mecánica de Suelos (EMS)
  - Diseño estructural
  - Especialidades / nivel de detalle del expediente

## Licencia

MIT.
