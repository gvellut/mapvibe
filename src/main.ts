import maplibregl, { LngLatBounds, Map } from 'maplibre-gl';
import './style.scss';

// --- TYPE DEFINITIONS for custom config properties ---
interface BackgroundLayerConfig {
    id: string;
    name: string;
    minZoom?: number;
    maxZoom?: number;
}

interface LayerChooserConfig {
    backgroundLayers: BackgroundLayerConfig[];
    dataLayers: { id: string; name: string; visible: boolean }[];
    globalMinZoom?: number;
    globalMaxZoom?: number;
}

interface CustomUiConfig {
    panel: {
        backgroundColor: string;
        width: string;
    };
    controls: {
        zoom?: boolean;
        scale?: boolean;
        layerChooser?: boolean;
        fullscreen?: boolean;
        attribution?: boolean;
    };
    layerChooser: LayerChooserConfig;
}

// --- MAIN APPLICATION INITIALIZATION ---
// REPLACE THE OLD initializeApp WITH THIS ONE
async function initializeApp() {
    const urlParams = new URLSearchParams(window.location.search);
    const configUrl = urlParams.get('config');

    if (!configUrl) {
        displayError('Error: The `config` URL parameter is missing.');
        return;
    }

    try {
        const response = await fetch(configUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch config file: ${response.statusText}`);
        }
        const config = await response.json();

        // Create the map
        const map = new Map({
            container: 'map',
            style: config,
            attributionControl: false // We add it manually based on config
        });


        // Set up the on-demand image loading *before* the map's 'load' event.
        // This ensures the listener is ready as soon as the map starts parsing the style.
        setupImageLoading(map);


        // Wait for the map to load before adding controls and layers
        map.on('load', async () => {
            // If center/zoom are not in config, fit to bounds of all GeoJSON sources
            if (!config.center && !config.zoom) {
                await fitMapToBounds(map, config.sources);
            }

            // Initialize all UI components based on the config
            initializeUiComponents(map, config);

            // Setup feature interaction (hover cursor and click panel)
            setupFeatureInteraction(map, config);
        });

    } catch (error) {
        displayError(`Error initializing application: ${error instanceof Error ? error.message : String(error)}`);
    }
}

// --- UI INITIALIZATION & SETUP ---

/**
 * Initializes all UI components like controls and panels.
 */
function initializeUiComponents(map: Map, config: any) {
    const uiConfig: CustomUiConfig = config.customUi;
    if (!uiConfig || !uiConfig.controls) return;

    const controls = uiConfig.controls;

    if (controls.zoom) {
        map.addControl(new maplibregl.NavigationControl({
            showCompass: false
        }), 'top-left');
    }
    if (controls.scale) {
        map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
    }
    if (controls.attribution) {
        map.addControl(new maplibregl.AttributionControl({ compact: false }), 'bottom-right');
    }
    if (controls.fullscreen) {
        setupFullscreenButton(map);
    }
    if (controls.layerChooser) {
        setupLayerChooser(map, uiConfig.layerChooser);
    }

    // Setup the side info panel (it's hidden by default)
    setupInfoPanel(map, uiConfig.panel);
}

/**
 * Creates and manages the custom layer chooser control.
 */
function setupLayerChooser(map: Map, chooserConfig: LayerChooserConfig) {
    const controlContainer = document.createElement('div');
    controlContainer.className = 'maplibregl-ctrl maplibregl-ctrl-group custom-layer-chooser';

    const button = document.createElement('button');
    button.className = 'layer-chooser-btn';
    button.type = 'button';

    const panel = document.createElement('div');
    panel.className = 'layer-chooser-panel';

    // Background Layers (Radio Buttons)
    const bgHeader = document.createElement('h4');
    bgHeader.textContent = 'Background Layers';
    panel.appendChild(bgHeader);

    chooserConfig.backgroundLayers.forEach((layer, index) => {
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = 'background-layer';
        input.id = `bg-${layer.id}`;
        input.checked = index === 0; // First one is active by default
        input.onchange = () => {
            // Set layer visibility
            chooserConfig.backgroundLayers.forEach(l => {
                map.setLayoutProperty(l.id, 'visibility', l.id === layer.id ? 'visible' : 'none');
            });

            // Adjust map zoom to fit the new layer's constraints
            // "globalMinZoom": 5,
            // "globalMaxZoom": 18,
            // "backgroundLayers": [
            //   { "id": "osm-streets", "name": "Streets" },
            //   { "id": "satellite", "name": "Satellite", "minZoom": 8, "maxZoom": 20 },
            //   { "id": "topo", "name": "Topographic", "maxZoom": 15 }
            // ],
            const minZoom = layer.minZoom ?? chooserConfig.globalMinZoom;
            const maxZoom = layer.maxZoom ?? chooserConfig.globalMaxZoom;
            const currentZoom = map.getZoom();

            if (maxZoom !== undefined && currentZoom > maxZoom) {
                map.zoomTo(maxZoom);
            } else if (minZoom !== undefined && currentZoom < minZoom) {
                map.zoomTo(minZoom);
            }
        };
        const label = document.createElement('label');
        label.htmlFor = input.id;
        label.textContent = layer.name;

        const div = document.createElement('div');
        div.appendChild(input);
        div.appendChild(label);
        panel.appendChild(div);
    });

    // Data Layers (Checkboxes)
    const dataHeader = document.createElement('h4');
    dataHeader.textContent = 'Data Layers';
    panel.appendChild(dataHeader);

    chooserConfig.dataLayers.forEach(layer => {
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = `data-${layer.id}`;
        input.checked = map.getLayoutProperty(layer.id, 'visibility') === 'visible';
        input.onchange = (e) => {
            const isVisible = (e.target as HTMLInputElement).checked;
            map.setLayoutProperty(layer.id, 'visibility', isVisible ? 'visible' : 'none');
        };

        const label = document.createElement('label');
        label.htmlFor = input.id;
        label.textContent = layer.name;

        const div = document.createElement('div');
        div.appendChild(input);
        div.appendChild(label);
        panel.appendChild(div);
    });

    controlContainer.appendChild(button);
    controlContainer.appendChild(panel);

    // Toggle panel visibility
    button.addEventListener('click', (e) => {
        e.stopPropagation();
        panel.classList.toggle('visible');
    });

    // Close panel on outside click
    document.addEventListener('click', (e) => {
        if (!controlContainer.contains(e.target as Node)) {
            panel.classList.remove('visible');
        }
    });

    map.getContainer().querySelector('.maplibregl-ctrl-top-right')?.appendChild(controlContainer);
}

/**
 * Creates the "Full screen" button.
 */
function setupFullscreenButton(map: Map) {
    const fullscreenBtn = document.createElement('button');
    fullscreenBtn.className = 'maplibregl-ctrl custom-fullscreen-btn';
    fullscreenBtn.textContent = 'Full screen';
    fullscreenBtn.onclick = () => window.open(window.location.href, '_blank');

    // Add it to the bottom-right container, next to attribution
    map.getContainer().querySelector('.maplibregl-ctrl-bottom-right')?.appendChild(fullscreenBtn);
}


/**
 * Creates the info panel DOM structure and appends it to the body.
 */
function setupInfoPanel(map: Map, panelConfig: CustomUiConfig['panel']) {
    const panel = document.createElement('div');
    panel.id = 'info-panel';
    panel.style.backgroundColor = panelConfig.backgroundColor;
    panel.style.width = panelConfig.width;

    const panelHeader = document.createElement('div');
    panelHeader.id = 'info-panel__header';

    const closeButton = document.createElement('button');
    closeButton.id = 'info-panel__close-btn';
    closeButton.innerHTML = '✕';
    closeButton.onclick = () => {
        panel.style.display = 'none';
        const mapContainer = map.getContainer();
        mapContainer.classList.remove('panel-open');
        mapContainer.style.removeProperty('--panel-width');
        map.resize();
    };

    panelHeader.appendChild(closeButton);
    panel.appendChild(panelHeader);

    const contentImg = document.createElement('div');
    contentImg.id = 'info-panel__content-img';

    panel.appendChild(contentImg);

    const contentText = document.createElement('div');
    contentText.id = 'info-panel__content-text';

    panel.appendChild(contentText);

    document.body.appendChild(panel);
}

/**
 * Manages hover and click events on the map to show feature info.
 */
function setupFeatureInteraction(map: Map, config: any) {
    const clickableLayerIds = getClickableLayerIds(config);

    map.on('mousemove', (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: clickableLayerIds });
        map.getCanvas().style.cursor = features.length ? 'pointer' : '';
    });

    map.on('click', (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: clickableLayerIds });
        if (!features.length) return;

        const feature = features[0];
        const properties = feature.properties;

        const panel = document.getElementById('info-panel') as HTMLDivElement;
        const panelContentImg = document.getElementById('info-panel__content-img') as HTMLDivElement;
        const panelContentText = document.getElementById('info-panel__content-text') as HTMLDivElement;

        let htmlImg = '';
        if (properties.imageUrl) {
            htmlImg += `<img src="${properties.imageUrl}" alt="${properties.title || ''}" style="width: 100%; height: auto; display: block;">`;
        }
        panelContentImg.innerHTML = htmlImg

        let html = '';
        if (properties.title) {
            html += `<h1>${properties.title}</h1>`;
        }
        if (properties.description) {
            html += `<div>${properties.description}</div>`;
        }
        panelContentText.innerHTML = html;

        // Show panel and resize map
        panel.style.display = 'block';
        const mapContainer = map.getContainer();
        mapContainer.classList.add('panel-open');
        mapContainer.style.setProperty('--panel-width', panel.style.width); // for scss
        map.resize();
    });
}

// --- HELPER FUNCTIONS ---

/**
 * Displays an error message in the map container.
 */
function displayError(message: string) {
    const mapContainer = document.getElementById('map');
    if (mapContainer) {
        mapContainer.innerHTML = `<div style="padding: 20px; font-family: sans-serif; color: red;">${message}</div>`;
    }
}

/**
 * Calculates the bounding box of all GeoJSON sources and fits the map view.
 */
async function fitMapToBounds(map: Map, sources: any) {
    const bounds = new LngLatBounds();
    const geojsonFetches: Promise<any>[] = [];

    for (const sourceName in sources) {
        const source = sources[sourceName];
        if (source.type === 'geojson' && typeof source.data === 'string') {
            geojsonFetches.push(fetch(source.data).then(res => res.json()));
        }
    }

    try {
        const geojsons = await Promise.all(geojsonFetches);
        geojsons.forEach(geojson => {
            geojson.features.forEach((feature: any) => {
                if (feature.geometry?.coordinates) {
                    // This is a simplified bounds extension. For production, use a library 
                    // or more robust logic to handle all geometry types (LineString, Polygon, etc).
                    if (feature.geometry.type === 'Point') {
                        bounds.extend(feature.geometry.coordinates as [number, number]);
                    }
                }
            });
        });

        if (!bounds.isEmpty()) {
            map.fitBounds(bounds, { padding: 100 }); // 10% padding approximation
        }
    } catch (error) {
        console.error("Could not fit map to bounds:", error);
    }
}


/**
 * Finds layers that are interactive based on GeoJSON properties.
 */
function getClickableLayerIds(config: any): string[] {
    const clickableSourceNames: string[] = [];
    // This is a simplification. A more robust way would be to fetch and inspect GeoJSON.
    // Here we assume if a layer is in the layerChooser, it might be clickable.
    // A better check would be to see if its source features have title/description.
    // For this project, we'll link 'clickability' to being a data layer.
    config.customUi.layerChooser.dataLayers.forEach((layer: any) => {
        clickableSourceNames.push(layer.id);
    });
    return clickableSourceNames;
}

interface MarkerInfo {
    url: string;
    pixelRatio?: number;
}

const MARKERS: Record<string, MarkerInfo> = {
    "peak": { url: `assets/markers/mountain.png`, pixelRatio: 2 }
};

function setupImageLoading(map: Map) {
    map.on('styleimagemissing', async (e) => {
        const imageId = e.id;

        // Check if the missing image is one of our custom markers
        const markerInfo = MARKERS[imageId];
        if (!markerInfo) return;

        console.log("missing " + e.id);

        try {
            // Asynchronously load the image
            const image = await map.loadImage(markerInfo.url);

            // Check if the image has already been added to prevent errors
            // in case this event fires multiple times for the same image.
            if (!map.hasImage(imageId)) {
                map.addImage(imageId, image.data, { pixelRatio: markerInfo.pixelRatio || 1 });
            }
        } catch (error) {
            console.error(`Failed to load image "${imageId}":`, error);
        }
    });
}

// --- START THE APP ---
initializeApp();