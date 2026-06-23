# LiftLog 🏋️‍♂️📊

Una aplicación web (SPA) ultra ligera, rápida y moderna diseñada para registrar tus entrenamientos de levantamiento de pesas, realizar un seguimiento de tu fuerza y volumen, y monitorear tu peso corporal. Todo se procesa localmente en tu navegador sin necesidad de servidores externos.

## 🚀 Características Core

- **Bitácora de Sesión**: Inicia y detalla tus entrenamientos sobre la marcha. Guarda automáticamente tus series, repeticiones y peso en tiempo real (Autosave).
- **Sobrecarga Progresiva Automática**: Al agregar un ejercicio a tu entrenamiento actual, la app busca tus últimas repeticiones y peso registrados del historial para auto-completar los inputs de manera inteligente.
- **Gráficos e Historial**:
  - Evolución del volumen total de entrenamiento por sesión (Chart.js).
  - Progreso individual por ejercicio: visualiza el **Volumen**, **Peso Máximo** y **1RM Estimado** (usando la fórmula de Epley: $1RM = peso \times (1 + reps/30)$).
- **Registro de Peso Corporal**: Registra tu peso diario, visualiza el historial y examina un gráfico de tendencia.
- **Seguridad e Importación/Exportación**:
  - Exporta todos tus datos estructurados a un archivo `.json` de manera instantánea.
  - Importa archivos de respaldo para transferir tu progreso a otros dispositivos o navegadores sin fricción.
  - Almacenamiento 100% privado en tu navegador mediante **IndexedDB** a través de la librería **Dexie.js**.

## 🛠️ Stack Tecnológico

- **Frontend**: HTML5 semántico, CSS3 Vanilla (diseño Dark Mode premium, adaptativo y móvil-first), JavaScript Vanilla.
- **Base de Datos Local**: IndexedDB gestionada mediante [Dexie.js](https://dexie.org/).
- **Visualización**: [Chart.js](https://www.chartjs.org/) para los gráficos dinámicos de rendimiento.
- **Iconografía**: [Lucide Icons](https://lucide.dev/).
- **CI/CD**: GitHub Actions para despliegue automatizado directo a **GitHub Pages**.

## 📁 Estructura del Proyecto

```text
├── .github/workflows/
│   └── deploy.yml      # CI/CD: Automatización de despliegue en GitHub Pages
├── index.html          # Estructura e interfaz SPA de la aplicación
├── style.css           # Estilos visuales personalizados (Dark Mode, transiciones, responsive)
├── app.js              # Lógica de la aplicación, Dexie.js e integración con Chart.js
└── README.md           # Este archivo de documentación
```

## ⚙️ Despliegue en GitHub Pages

Esta aplicación cuenta con un flujo automatizado de CI/CD mediante **GitHub Actions** configurado en [.github/workflows/deploy.yml](file:///.github/workflows/deploy.yml).

Para habilitar el despliegue automático:

1. Crea un nuevo repositorio en GitHub y sube estos archivos (`git push`).
2. En GitHub, ve a la pestaña **Settings** (Ajustes) de tu repositorio.
3. En la barra lateral izquierda, selecciona **Pages**.
4. En la sección **Build and deployment** -> **Source**, selecciona **GitHub Actions** (en lugar de *Deploy from a branch*).
5. ¡Listo! Cada vez que hagas un `git push` a las ramas `main` o `master`, tu pipeline se activará y el sitio se actualizará automáticamente en unos segundos.

## 💻 Desarrollo Local

Para probar o ejecutar la aplicación en tu computadora localmente, puedes:

1. Simplemente hacer doble clic en el archivo [index.html](file:///index.html) para abrirlo en cualquier navegador moderno.
2. O bien, utilizar cualquier servidor estático rápido. Por ejemplo, si tienes Python instalado:
   ```bash
   python -m http.server 8000
   ```
   Luego abre tu navegador en `http://localhost:8000`.

## 💾 Modelo de Datos Local

La base de datos utiliza IndexedDB estructurada mediante Dexie.js con el siguiente esquema de índices:
- **`exercises`**: `++id, &name` (Nombre único para evitar duplicados).
- **`workouts`**: `++id, date, status` (Permite restaurar entrenamientos activos si se refresca la app).
- **`sets`**: `++id, workoutId, exerciseId` (Relaciones y búsquedas veloces).
- **`bodyweight`**: `++id, date` (Historial cronológico de peso corporal).
