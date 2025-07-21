# Static Geo-Interface Component

A standalone, client-side web application that displays a highly configurable, interactive map. It is designed to be easily embedded into any web page using an `<iframe>` and is configured entirely through a single JSON file.


*(Image: A brief demonstration of the interactive map, showing the layer chooser, feature-click panel, and responsive behavior.)*

## Features

*   **Fully Configurable:** Control map sources, layers, initial view, UI controls, and styling from a single `config.json` file.
*   **Embeddable:** Designed to be dropped into any website via an `<iframe>`.
*   **Interactive:** Supports feature clicking to display detailed information (title, description, image) in a side panel.
*   **Custom UI Controls:** Includes a custom-built, collapsible layer chooser for toggling background and data layers.
*   **Responsive Design:** The side panel adapts seamlessly from a sidebar on desktop to a full-screen overlay on mobile.
*   **Automatic Bounding Box:** If no center/zoom is provided, the map automatically zooms to fit all data layers.
*   **Modern Tech Stack:** Built with Vite, TypeScript, and MapLibre GL JS for a fast, type-safe, and maintainable codebase.

## How It Works

The application is loaded within an `<iframe>`. The `src` attribute of the iframe must include a URL query parameter named `config` that points to a JSON configuration file. The application fetches this file at runtime and uses it to build the entire map interface.

This architecture decouples the map's appearance and data from the page it's embedded in, allowing website maintainers to update the map without touching the parent page's code.

---

## Usage (For Website Maintainers)

To use this map component on your website, you only need to do two things:

1.  Host the contents of the `/dist` directory (generated after building the project) on your web server.
2.  Host your `config.json` file on the same server.
3.  Embed an `<iframe>` into your HTML.

#### **Embedding the Map**

Add the following HTML snippet to your web page. Adjust the `src` attribute to point to the `index.html` of the hosted application and the `config` parameter to point to your configuration file.

```html
<iframe
  src="https://your-domain.com/path-to-map/index.html?config=/path-to-your/config.json"
  width="100%"
  height="600"
  style="border: 1px solid #ccc; border-radius: 8px;"
  title="Interactive Map"
  allow="fullscreen"
></iframe>
```

---

## Configuration (`config.json`)

The application's behavior is entirely driven by a JSON file that extends the **MapLibre Style Specification** with a custom `customUi` object.

Note:

```
"line-dasharray": [2, 2]
"layout": {
    "visibility": "none"
}
```

#### **Core Structure**

The JSON file follows the standard MapLibre style, defining `sources` and `layers`. For interactivity and custom controls, the `customUi` object is used.

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
      "attribution": "© OpenStreetMap contributors"
    },
    "subway-stations": {
      "type": "geojson",
      "data": "./data/subway-stations.geojson",
      "attribution": "NYC OpenData"
    }
  },
  "layers": [
    {
      "id": "background-osm",
      "type": "raster",
      "source": "osm-background"
    },
    {
      "id": "subway-stations-layer",
      "type": "symbol",
      "source": "subway-stations",
      "layout": { "icon-image": "marker-icon" }
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
      "backgroundLayers": [
        { "id": "background-osm", "name": "Street Map" }
      ],
      "dataLayers": [
        { "id": "subway-stations-layer", "name": "Subway Stations", "visible": true }
      ]
    }
  }
}
```

#### **Special Properties:**

*   **`center` / `zoom` (Optional):** If you omit these top-level properties, the map will automatically calculate the bounding box of all GeoJSON sources and zoom to fit them with a 10% padding.

*   **Interactive Features (GeoJSON `properties`):** For a map feature to be clickable and show information in the side panel, its corresponding GeoJSON `properties` object must contain:
    *   `title`: (String) The main title shown in the panel.
    *   `description`: (String) The body content for the panel. Can contain HTML tags.
    *   `imageUrl`: (Optional String) A URL to an image to display at the top of the panel.

#### **`customUi` Object Details:**

*   **`panel`**: Configures the side info panel.
    *   `backgroundColor`: CSS color for the panel's background.
    *   `width`: CSS width (e.g., `"350px"`) for the panel on desktop.
*   **`controls`**: A set of booleans to toggle the visibility of map controls.
    *   `zoom`: The +/- zoom control (top-left).
    *   `scale`: The scale bar (bottom-left).
    *   `layerChooser`: The custom layer toggle control (top-right).
    *   `fullscreen`: A link to open the map in a new tab (bottom-right).
    *   `attribution`: The attribution display (bottom-right).
*   **`layerChooser`**: Defines the content of the layer chooser control.
    *   `backgroundLayers`: An array of layers to be controlled by radio buttons (only one can be active at a time).
    *   `dataLayers`: An array of overlay layers to be controlled by checkboxes. The `visible` property sets the initial on/off state.

---

## Development (Making Changes)

If you want to modify the application's source code, fix a bug, or add a new feature, follow these instructions.

#### **Prerequisites**

*   **Node.js**: Version 20.x or higher
*   **npm**: (Comes with Node.js)

#### **Installation**

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/my-map-interface.git
    ```

2.  **Navigate into the project directory:**
    ```bash
    cd my-map-interface
    ```

3.  **Install all dependencies:**
    ```bash
    npm install
    ```

#### **Running the Development Server**

To run the application locally with hot-reloading, use the Vite development server. This is the best way to see your changes live as you code.

```bash
npm run dev
```

The application will be available at **`http://localhost:5173`**. The server uses the `/public/config.json` file for configuration by default.

#### **Building for Production**

When you are ready to deploy your changes, run the build command:

```bash
npm run build
```

This command compiles the TypeScript and Sass, bundles everything, and outputs optimized, static files into the `/dist` directory. These are the files you would upload to a web server.

#### **Project Code Structure**

*   `index.html`: The main HTML file. Contains the `<div id="map"></div>` container.
*   `src/main.ts`: The **single TypeScript entry point** for the entire application. All logic for configuration loading, map initialization, UI control creation, and event handling resides here.
*   `src/style.scss`: The main SCSS file for all custom UI elements (side panel, layer chooser, etc.).
*   `public/`: A directory for static assets that are copied directly to the build output. This is the ideal place for your default `config.json` and any GeoJSON data files.

## Technology Stack

*   **Map Library:** [MapLibre GL JS](https://maplibre.org/)
*   **Build Tool:** [Vite](https://vitejs.dev/)
*   **Language:** [TypeScript](https://www.typescriptlang.org/)
*   **Styling:** [Sass (SCSS)](https://sass-lang.com/)
*   **Package Manager:** [npm](https://www.npmjs.com/)

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.