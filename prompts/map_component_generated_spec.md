### **Project Specification: Static Geo-Interface Component**

#### **1. High-Level Goal**

The objective is to create a static, client-side web application that displays an interactive map. This application will be embedded into other web pages using an `<iframe>`. The entire interface—including map data, styling, and UI controls—must be configurable via a single JSON file loaded at runtime. The application will be built with Vite, TypeScript, and MapLibre GL JS.

#### **2. Core Technology Stack**

*   **Package Manager:** npm
*   **Runtime Environment:** Node.js v20.x or higher
*   **Map Library:** MapLibre GL JS `^4.1.0`
*   **Language:** TypeScript `^5.4.0`
*   **Build Tool:** Vite `^5.2.0`
*   **Styling Preprocessor:** Sass (SCSS) `^1.77.0` (as a development dependency)

#### **3. Project Setup and Workflow**

**A. Initial Project Scaffolding:**

Execute the following commands in a terminal to create the project structure.

```bash
# 1. Create the project using the Vite vanilla-ts template
npm create vite@latest my-map-interface -- --template vanilla-ts

# 2. Navigate into the new project directory
cd my-map-interface
```

**B. Dependency Installation:**

Install the required runtime and development dependencies.

```bash
# 1. Install MapLibre GL JS for map rendering
npm install maplibre-gl

# 2. Install Sass as a development dependency for styling
npm install -D sass
```

**C. Development and Production Commands:**

*   **To run the local development server:**
    ```bash
    npm run dev
    ```    The application will be accessible at `http://localhost:5173`.

*   **To build the application for production:**
    ```bash
    npm run build
    ```
    This command will generate a `/dist` directory containing the optimized, static `index.html`, JavaScript, and CSS files ready for deployment.

#### **4. Application Architecture**

*   **`index.html`:** The main HTML file. It will contain a single `<div id="map"></div>` element that serves as the mount point for the MapLibre map. This div should be styled to occupy the entire viewport (`width: 100vw; height: 100vh;`).
*   **`src/main.ts`:** The single TypeScript entry point for the entire application. All application logic—including URL parameter parsing, config loading, map initialization, UI control creation, and event handling—will be contained within this file.
*   **`src/style.scss`:** The main SCSS file for all custom UI elements (e.g., the side panel, layer chooser control). This will be compiled into a single CSS file by Vite.

**Runtime Initialization Flow:**

1.  The browser loads `index.html`.
2.  The JavaScript from `src/main.ts` executes.
3.  The script retrieves the current URL's query parameters.
4.  It expects a parameter named `config` whose value is the URL to the configuration file (e.g., `?config=/path/to/my-config.json`).
5.  If the `config` parameter is missing, the application should display an error message and halt.
6.  The script performs a `fetch` request to retrieve the specified JSON configuration file.
7.  Upon successful retrieval, the script parses the JSON and uses it to initialize the map, UI components, and event listeners.

#### **5. Configuration File (`config.json`) Specification**

The application is configured using a JSON file that adheres to the **MapLibre Style Specification**, extended with a custom `customUi` object.

**Example `config.json`:**

```json
{
  "version": 8,
  "center": [-74.006, 40.7128],
  "zoom": 12,
  "sources": {
    "osm-background": {
      "type": "raster",
      "tiles": ["https://a.tile.openstreetmap.org/{z}/{x}/{y}.png"],
      "tileSize": 256,
      "attribution": "© OpenStreetMap contributors"
    },
    "subway-stations": {
      "type": "geojson",
      "data": "./data/subway-stations.geojson",
      "attribution": "NYC OpenData"
    },
    "bike-routes": {
      "type": "geojson",
      "data": "./data/bike-routes.geojson"
    }
  },
  "layers": [
    {
      "id": "background-osm",
      "type": "raster",
      "source": "osm-background"
    },
    {
      "id": "bike-routes-layer",
      "type": "line",
      "source": "bike-routes",
      "paint": {
        "line-color": "#088",
        "line-width": 3
      }
    },
    {
      "id": "subway-stations-layer",
      "type": "symbol",
      "source": "subway-stations",
      "layout": {
        "icon-image": "marker-icon",
        "icon-size": 0.8,
        "icon-allow-overlap": true
      }
    }
  ],
  "customUi": {
    "panel": {
      "backgroundColor": "#f8f9fa",
      "width": "350px"
    },
    "controls": {
      "zoom": true,
      "scale": true,
      "layerChooser": true,
      "fullscreen": true,
      "attribution": true
    },
    "layerChooser": {
       "globalMinZoom": 1,
      "globalMaxZoom": 18,
      "backgroundLayers": [
        { "id": "osm-streets", "name": "Streets" },
      ],
      "dataLayers": [
        { "id": "subway-stations-layer", "name": "Subway Stations", "visible": true },
        { "id": "bike-routes-layer", "name": "Bike Routes", "visible": false }
      ]
    }
  }
}
```

**Key Details:**
*   **`center` / `zoom` (optional):** If these are omitted, the map must automatically calculate the bounding box of all GeoJSON sources and fit the view to that extent, adding a 10% padding.
*   **GeoJSON `properties`:** For features to be interactive, their GeoJSON `properties` object should contain `title` (string), `description` (string, can contain HTML), and optionally `imageUrl` (string, a URL to an image).
*   **`icon-image`:** For point layers, the `icon-image` value (e.g., `"marker-icon"`) must be loaded into the map instance programmatically using `map.loadImage()` and `map.addImage()`. You can assume a default marker icon is available.

#### **6. Detailed UI Component Specifications**

**A. Map Controls - Positions and Behavior**

The presence of each control is dictated by the `customUi.controls` boolean flags.

1.  **Zoom Control (`zoom: true`)**
    *   **Implementation:** Use `new maplibregl.NavigationControl()`.
    *   **Position:** **Top-left**.

2.  **Combined Layer Chooser (`layerChooser: true`)**
    *   **Implementation:** This is a custom HTML/CSS/TS control.
    *   **Position:** **Top-right**.
    *   **Visual:** A single square button with a "stacked layers" icon (an embedded SVG is preferred).
    *   **Interaction:** On **click** (not hover), a panel/dropdown appears directly below the button. Clicking the icon again, or clicking anywhere on the map, should close the panel.
    *   **Panel Content:** The panel will be populated from the `customUi.layerChooser` object and will have two sections:
        *   **Background Layers:** A list of layers from `backgroundLayers` rendered with **radio buttons**. The `name` property is used as the label. Changing the selection toggles the `visibility` of the corresponding map layers.
        *   **Data Layers:** A list of layers from `dataLayers` rendered with **checkboxes**. The `name` property is the label. The initial checked state is determined by the `visible` property. Toggling a checkbox toggles the `visibility` of the corresponding map layer.

3.  **Scale Bar (`scale: true`)**
    *   **Implementation:** Use `new maplibregl.ScaleControl()`.
    *   **Position:** **Bottom-left**.

4.  **Attribution Control (`attribution: true`)**
    *   **Implementation:** Use `new maplibregl.AttributionControl({ compact: false, customAttribution: '...' })`. It will automatically collect attributions from visible sources.
    *   **Position:** **Bottom-right**.

5.  **Fullscreen Button (`fullscreen: true`)**
    *   **Implementation:** This is a custom HTML element.
    *   **Position:** **Bottom-right**, placed immediately to the right of the Attribution control.
    *   **Visual:** A simple text link or unstyled button with the exact text **"Full screen"**.
    *   **Action:** On click, it must execute `window.open(window.location.href, '_blank');`.

**B. Feature Interaction and Side Panel**

1.  **Hover and Click Behavior**
    *   A map layer is considered "clickable" if its source GeoJSON features contain a `title` or `description` property.
    *   For all clickable layers, set the map's canvas cursor to `pointer` on hover.
    *   On clicking a feature from a clickable layer, the side panel must appear.

2.  **Side Panel Specification**
    *   **Implementation:** A custom HTML element (`<div id="info-panel">...</div>`) that is created and manipulated by `main.ts` and styled by `style.scss`. It is hidden by default (`display: none`).
    *   **Desktop Layout (`@media (min-width: 769px)`):**
        *   The panel appears on the left side of the screen. Its width is set by `customUi.panel.width` and background color by `customUi.panel.backgroundColor`.
        *   When the panel is visible, the map must resize to fill the remaining space to the right, avoiding any overlap.
    *   **Mobile Layout (`@media (max-width: 768px)`):**
        *   The panel covers the **entire screen** (`position: absolute; width: 100%; height: 100%; top: 0; left: 0;`).
    *   **Content Structure and Styling:**
        *   The panel is populated from the clicked feature's `properties`.
        *   **Close Button:** A button with a left-arrow icon (`←`) must be present at the top-right of the panel to hide it.
        *   **Image:** If an `imageUrl` property exists, an `<img>` tag is created at the very top of the panel's content. It **must** be styled to be `width: 100%; height: auto; display: block;`.
        *   **Title:** The `title` property is rendered inside an `<h1>` tag, below the image.
        *   **Description:** The `description` property is rendered inside a `<div>` tag, below the title. The content is HTML and should be rendered as such (using `element.innerHTML`).