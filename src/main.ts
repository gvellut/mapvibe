import maplibregl, { LngLatBounds, Map } from 'maplibre-gl';
import './style.scss';

// --- TYPE DEFINITIONS for custom config properties ---
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
    layerChooser: {
        backgroundLayers: { id: string; name: string }[];
        dataLayers: { id: string; name: string; visible: boolean }[];
    }
}

// --- MAIN APPLICATION INITIALIZATION ---
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

        // Wait for the map to load before adding controls and layers
        map.on('load', async () => {
            // If center/zoom are not in config, fit to bounds of all GeoJSON sources
            if (!config.center && !config.zoom) {
                await fitMapToBounds(map, config.sources);
            }

            // Load custom images for icons
            await loadCustomImages(map, config.layers);

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
        map.addControl(new maplibregl.NavigationControl(), 'top-left');
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
function setupLayerChooser(map: Map, chooserConfig: CustomUiConfig['layerChooser']) {
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
            chooserConfig.backgroundLayers.forEach(l => {
                map.setLayoutProperty(l.id, 'visibility', l.id === layer.id ? 'visible' : 'none');
            });
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
        input.checked = layer.visible;
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

    const closeButton = document.createElement('button');
    closeButton.id = 'info-panel__close-btn';
    closeButton.innerHTML = '←'; // Left arrow
    closeButton.onclick = () => {
        panel.style.display = 'none';
        const mapContainer = map.getContainer();
        mapContainer.classList.remove('panel-open');
        mapContainer.style.removeProperty('--panel-width');
        map.resize();
    };

    const content = document.createElement('div');
    content.id = 'info-panel__content';

    panel.appendChild(closeButton);
    panel.appendChild(content);
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
        const panelContent = document.getElementById('info-panel__content') as HTMLDivElement;

        // Build panel content
        let html = '';
        if (properties.imageUrl) {
            html += `<img src="${properties.imageUrl}" alt="${properties.title || ''}">`;
        }
        if (properties.title) {
            html += `<h1>${properties.title}</h1>`;
        }
        if (properties.description) {
            html += `<div>${properties.description}</div>`;
        }
        panelContent.innerHTML = html;

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

const MARKERS: Record<string, string> = {
    "peak": `/markers/mountain.png`
};

/**
 * Pre-loads images required for layer icons.
 */
async function loadCustomImages(map: Map, layers: any[]) {
    const imageLoadPromises: Promise<void>[] = [];
    const loadedIcons = new Set<string>();

    for (const layer of layers) {
        const iconImage = layer.layout?.['icon-image'];
        if (iconImage && !loadedIcons.has(iconImage)) {
            loadedIcons.add(iconImage);
            // For this example, we assume a generic public URL for a marker.
            // In a real app, you might have a map of icon names to URLs.
            const imageUrl = MARKERS[iconImage];

            const promise = (async () => {
                const image = await map.loadImage(imageUrl);
                map.addImage(iconImage, image.data);
            })();
            imageLoadPromises.push(promise);
        }
    }

    await Promise.all(imageLoadPromises).catch(console.error);
}


// --- START THE APP ---
initializeApp();