import maplibregl, { LngLatBounds } from 'maplibre-gl';
import './style.scss';

// --- TYPE DEFINITIONS for custom config properties ---
interface BackgroundLayerConfig {
    id: string;
    name: string;
}

interface DataLayerConfig {
    id: string;
    name: string;
    interactive?: boolean;
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
    backgroundLayers: BackgroundLayerConfig[];
    dataLayers: DataLayerConfig[];
    globalMinZoom?: number;
    globalMaxZoom?: number;
}

// --- MAIN APPLICATION INITIALIZATION ---
// REPLACE THE OLD initializeApp WITH THIS FINAL VERSION
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

        // Set page title from config
        if (config.title) {
            document.title = config.title;
        }

        // Create the map with the original config.
        const map = new maplibregl.Map({
            container: 'map',
            style: config,
            attributionControl: false
        });

        // Dynamically load images when the style requests them.
        map.on('styleimagemissing', async (e) => {
            await loadCustomImageOnDemand(map, config, e.id);
        });

        // Once the map style is loaded, run the rest of the setup.
        map.on('load', async () => {
            if (!config.center && !config.zoom) {
                await fitMapToBounds(map, config.sources);
            }
            initializeUiComponents(map, config);
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
function initializeUiComponents(map: maplibregl.Map, config: any) {
    const uiConfig: CustomUiConfig = config.customUi;
    if (!uiConfig || !uiConfig.controls) return;

    const controls = uiConfig.controls;

    if (controls.zoom) {
        map.addControl(new maplibregl.NavigationControl({
            showCompass: false
        }), 'top-left');
    }
    if (controls.scale) {
        map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right');
    }
    if (controls.attribution) {
        map.addControl(new maplibregl.AttributionControl({ compact: false }), 'bottom-left');
    }
    if (controls.fullscreen) {
        setupFullscreenButton(map);
    }
    if (controls.layerChooser) {
        setupLayerChooser(map, config);
    }

    // Setup the side info panel (it's hidden by default)
    setupInfoPanel(uiConfig.panel);
}

function visibleBackgroundLayer(map: maplibregl.Map, uiConfig: CustomUiConfig) {
    // Find the first background layer that is visible
    const backgroundLayers = uiConfig.backgroundLayers;
    for (const layer of backgroundLayers) {
        if (map.getLayoutProperty(layer.id, 'visibility') === 'visible') {
            return layer;
        }
    }
    return null; // No visible background layer found
}

function findLayerWithId(layerId: string, config: any) {
    return (Array.isArray(config.layers) ? config.layers.find((l: any) => l.id === layerId) : undefined) || {};
}

/**
 * Creates and manages the custom layer chooser control.
 */
function setupLayerChooser(map: maplibregl.Map, config: any) {
    const chooserConfig: CustomUiConfig = config.customUi;
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

    chooserConfig.backgroundLayers.forEach((layer) => {
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = 'background-layer';
        input.id = `bg-${layer.id}`;
        input.checked = map.getLayoutProperty(layer.id, 'visibility') === 'visible';

        input.onchange = () => {
            // Set layer visibility
            chooserConfig.backgroundLayers.forEach(l => {
                map.setLayoutProperty(l.id, 'visibility', l.id === layer.id ? 'visible' : 'none');
            });

            // Find the corresponding layer definition in config.layers
            const mapLayer = findLayerWithId(layer.id, config);
            // Find the corresponding source definition in config.sources
            const sourceName = mapLayer.source;
            const sourceDef = config.sources && config.sources[sourceName] ? config.sources[sourceName] : {};
            const { minZoom, maxZoom } = getClampedZoomBounds(sourceDef, chooserConfig);
            const currentZoom = map.getZoom();

            // Enforce the new zoom boundaries on the map instance.
            map.setMinZoom(minZoom ?? null);
            map.setMaxZoom(maxZoom ?? null);

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

    // Set initial zoom constraints based on the default active layer
    // the first 
    // assume only one
    let defaultBackgroundLayer = visibleBackgroundLayer(map, chooserConfig);
    if (defaultBackgroundLayer) {
        const mapLayer = findLayerWithId(defaultBackgroundLayer.id, config);
        const sourceName = mapLayer.source;
        const sourceDef = config.sources && config.sources[sourceName] ? config.sources[sourceName] : {};
        const { minZoom, maxZoom } = getClampedZoomBounds(sourceDef, chooserConfig);
        map.setMinZoom(minZoom ?? null);
        map.setMaxZoom(maxZoom ?? null);
    }

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
        // When opening the layer chooser, close the info panel if open
        if (panel.classList.contains('visible')) {
            const infoPanel = document.getElementById('info-panel') as HTMLDivElement;
            if (infoPanel && infoPanel.style.display === 'block') {
                infoPanel.style.display = 'none';
            }
        }
    });

    // Close panel on outside click
    document.addEventListener('click', (e) => {
        if (!controlContainer.contains(e.target as Node)) {
            panel.classList.remove('visible');
        }
    });

    map.getContainer().querySelector('.maplibregl-ctrl-top-right')?.appendChild(controlContainer);

    // Helper to close the layer chooser panel if open
    function closeLayerChooserPanel() {
        panel.classList.remove('visible');
    }

    // Expose for use in other functions
    (map as any)._closeLayerChooserPanel = closeLayerChooserPanel;

    // Close panel on map double click (zoom)
    map.on('dblclick', () => {
        closeLayerChooserPanel(); // Close layer chooser on double click
    });

    // Close layer chooser on drag (pan)
    map.on('dragstart', () => {
        closeLayerChooserPanel();
    });

    map.on('click', () => {
        closeLayerChooserPanel(); // Close layer chooser on map click
    });
}

/**
 * Creates the "Full screen" button.
 */
function setupFullscreenButton(map: maplibregl.Map) {
    const fullscreenBtn = document.createElement('button');
    fullscreenBtn.className = 'maplibregl-ctrl custom-fullscreen-btn';
    fullscreenBtn.title = 'See larger';
    fullscreenBtn.innerHTML = '<span></span>';
    fullscreenBtn.onclick = () => window.open(window.location.href, '_blank');
    map.getContainer().querySelector('.maplibregl-ctrl-top-left')?.appendChild(fullscreenBtn);
}


/**
 * Creates the info panel DOM structure and appends it to the body.
 */
function setupInfoPanel(panelConfig: CustomUiConfig['panel']) {
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
        // No mapContainer class or style changes, no map.resize()
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
function setupFeatureInteraction(map: maplibregl.Map, config: any) {
    const clickableLayerIds = getClickableLayerIds(config);
    let ignoreNextClick = false;

    map.on('mousemove', (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: clickableLayerIds });
        map.getCanvas().style.cursor = features.length ? 'pointer' : '';
    });

    map.on('click', (e) => {
        if (ignoreNextClick) {
            ignoreNextClick = false;
            return;
        }
        const features = map.queryRenderedFeatures(e.point, { layers: clickableLayerIds });
        if (!features.length) {
            // Clicked outside any feature, close panel if open
            const panel = document.getElementById('info-panel') as HTMLDivElement;
            if (panel && panel.style.display === 'block') {
                panel.style.display = 'none';
                // No mapContainer class or style changes, no map.resize()
            }
            return;
        }
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

        // Show panel only, do not move or resize map
        panel.style.display = 'block';
        // No mapContainer class or style changes, no map.resize()
    });

    map.on('dblclick', () => {
        const panel = document.getElementById('info-panel') as HTMLDivElement;
        if (panel && panel.style.display === 'block') {
            panel.style.display = 'none';
            // No mapContainer class or style changes, no map.resize()
        }
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
async function fitMapToBounds(map: maplibregl.Map, sources: any) {
    const bounds = new LngLatBounds();
    const geojsonFetches: Promise<any>[] = [];

    for (const sourceName in sources) {
        const source = sources[sourceName];
        if (source.type === 'geojson' && typeof source.data === 'string') {
            // Try to get the data directly from the map's source if available
            const mapSource = map.getSource(sourceName) as maplibregl.GeoJSONSource | undefined;
            if (mapSource && typeof mapSource.getData === 'function') {
                const data = mapSource.getData();
                if (data && typeof data === 'object') {
                    geojsonFetches.push(Promise.resolve(data));
                    continue;
                }
            }
            // Fallback: fetch from URL if not present in maplibre
            geojsonFetches.push(fetch(source.data).then(res => res.json()));
        }
    }

    try {
        const geojsons = await Promise.all(geojsonFetches);
        geojsons.forEach(geojson => {
            geojson.features.forEach((feature: any) => {
                if (feature.geometry?.coordinates) {
                    if (feature.geometry.type === 'Point') {
                        bounds.extend(feature.geometry.coordinates as [number, number]);
                    } else if (feature.geometry.type === 'LineString') {
                        (feature.geometry.coordinates as [number, number][]).forEach(coord => {
                            bounds.extend(coord);
                        });
                    } else if (feature.geometry.type === 'Polygon') {
                        (feature.geometry.coordinates as [number, number][][]).forEach(ring => {
                            ring.forEach(coord => {
                                bounds.extend(coord);
                            });
                        });
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
    // Use interactive property from dataLayers
    const clickableLayerIds: string[] = [];
    if (config.customUi && Array.isArray(config.customUi.dataLayers)) {
        config.customUi.dataLayers.forEach((layer: any) => {
            if (layer.interactive) clickableLayerIds.push(layer.id);
        });
    }
    return clickableLayerIds;
}

/**
 * Loads a custom image on demand when requested by the map style.
 */
async function loadCustomImageOnDemand(map: maplibregl.Map, config: any, imageId: string) {
    const customImages = config.customImageResources;
    if (!customImages || !Array.isArray(customImages)) {
        return;
    }

    const imageInfo = customImages.find((img: any) => img.id === imageId);
    if (!imageInfo || !imageInfo.url) {
        console.warn(`Image info for "${imageId}" not found in config.customImageResources.`);
        return;
    }

    // Don't try to load the same image more than once.
    if (map.hasImage(imageId)) {
        return;
    }

    try {
        const image = await map.loadImage(imageInfo.url);
        if (map.hasImage(imageId)) {
            return;
        }
        map.addImage(imageId, image.data, { pixelRatio: imageInfo.pixelRatio || 1 });
    } catch (error) {
        console.error(`Error loading image ${imageId} from ${imageInfo.url}:`, error);
    }
}

function getClampedZoomBounds(sourceDef: any, chooserConfig: CustomUiConfig) {
    let minZoom = (typeof sourceDef.minzoom === 'number' ? sourceDef.minzoom : chooserConfig.globalMinZoom);
    let maxZoom = (typeof sourceDef.maxzoom === 'number' ? sourceDef.maxzoom : chooserConfig.globalMaxZoom);
    if (typeof chooserConfig.globalMinZoom === 'number') {
        minZoom = Math.max(minZoom ?? chooserConfig.globalMinZoom, chooserConfig.globalMinZoom);
    }
    if (typeof chooserConfig.globalMaxZoom === 'number') {
        maxZoom = Math.min(maxZoom ?? chooserConfig.globalMaxZoom, chooserConfig.globalMaxZoom);
    }
    return { minZoom, maxZoom };
}

// --- START THE APP ---
initializeApp();