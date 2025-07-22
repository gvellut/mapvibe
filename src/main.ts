import maplibregl, { LngLatBounds } from 'maplibre-gl';
import './style.scss';

// --- TYPE DEFINITIONS for custom config properties ---
interface BackgroundLayerConfig {
    id: string;
    name: string;
    minZoom?: number;
    maxZoom?: number;
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

        // --- THE PLACEHOLDER STRATEGY ---
        // This prevents the map from trying to load icons before we've added them.
        // warning in console :
        // "peak" could not be loaded. Please make sure you have added the image with map.addImage() or a "sprite" property in your style.
        // You can provide missing images by listening for the "styleimagemissing" map event.
        // although it does not cause error

        // 1. PREPARE THE CONFIG
        const PLACEHOLDER_ID = 'placeholder-icon-sync';
        // Get the set of all icon IDs we need to manage.
        const customImageIds = new Set((config.customImageResources || []).map((img: any) => img.id));
        // This will store the original icon for each layer we modify.
        const originalLayerIcons = new Map<string, string>();

        // Loop through layers IN MEMORY and temporarily replace custom icons.
        for (const layer of config.layers) {
            const iconImage = layer.layout?.['icon-image'];
            if (iconImage && customImageIds.has(iconImage)) {
                originalLayerIcons.set(layer.id, iconImage); // Save original icon
                layer.layout['icon-image'] = PLACEHOLDER_ID; // Set placeholder
            }
        }

        // 2. CREATE THE MAP with the modified config.
        // All sources and layers will load, but pointing to a safe placeholder.
        const map = new maplibregl.Map({
            container: 'map',
            style: config, // Use the MODIFIED config
            attributionControl: false
        });

        // 3. ADD THE PLACEHOLDER IMAGE IMMEDIATELY AND SYNCHRONOUSLY
        // This is the key to preventing the error. It happens right after map creation,
        // before the first render can fail. We add a single 1x1 transparent pixel.
        map.addImage(PLACEHOLDER_ID, {
            width: 1,
            height: 1,
            data: new Uint8Array(4) // A single transparent RGBA pixel
        });

        // 4. START LOADING THE REAL IMAGES IN THE BACKGROUND
        // Now that the map exists, we can call our function. This returns a promise.
        const imagesLoadedPromise = loadCustomImagesFromConfig(map, config);

        // 5. ONCE THE MAP STYLE IS LOADED, SWAP THE ICONS BACK
        map.on('load', async () => {
            // Wait for the background image loading to complete.
            await imagesLoadedPromise;

            // Now that the real images are in the map's registry, swap the icons back.
            for (const [layerId, originalIconId] of originalLayerIcons.entries()) {
                map.setLayoutProperty(layerId, 'icon-image', originalIconId);
            }

            // Finally, with the map fully and correctly rendered, run the rest of the setup.
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
        setupLayerChooser(map, uiConfig);
    }

    // Setup the side info panel (it's hidden by default)
    setupInfoPanel(map, uiConfig.panel);
}

/**
 * Creates and manages the custom layer chooser control.
 */
function setupLayerChooser(map: maplibregl.Map, uiConfig: CustomUiConfig) {
    const chooserConfig = uiConfig;
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


    let defaultActiveLayerIndex = 0;
    chooserConfig.backgroundLayers.forEach((layer, index) => {
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
    const defaultLayer = chooserConfig.backgroundLayers[defaultActiveLayerIndex];
    if (defaultLayer) {
        const minZoom = defaultLayer.minZoom ?? chooserConfig.globalMinZoom;
        const maxZoom = defaultLayer.maxZoom ?? chooserConfig.globalMaxZoom;
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
function setupInfoPanel(map: maplibregl.Map, panelConfig: CustomUiConfig['panel']) {
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

    // Helper to close layer chooser if open
    function closeLayerChooserIfOpen() {
        if ((map as any)._closeLayerChooserPanel) {
            (map as any)._closeLayerChooserPanel();
        }
    }

    map.on('mousemove', (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: clickableLayerIds });
        map.getCanvas().style.cursor = features.length ? 'pointer' : '';
    });

    map.on('click', (e) => {
        closeLayerChooserIfOpen(); // Close layer chooser on map click
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

    // Close panel on map double click (zoom)
    map.on('dblclick', () => {
        closeLayerChooserIfOpen(); // Close layer chooser on double click
        const panel = document.getElementById('info-panel') as HTMLDivElement;
        if (panel && panel.style.display === 'block') {
            panel.style.display = 'none';
            // No mapContainer class or style changes, no map.resize()
        }
    });

    // Close layer chooser on drag (pan)
    map.on('dragstart', () => {
        closeLayerChooserIfOpen();
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
 * Reads image definitions from the config, loads them, and adds them to the map.
 * This should be called after the map's style is loaded.
 */
async function loadCustomImagesFromConfig(map: maplibregl.Map, config: any) {
    // TODO check which images are referenced from data in config
    const customImages = config.customImageResources;
    if (!customImages || !Array.isArray(customImages)) {
        return; // No custom images to load
    }

    const imageLoadPromises: Promise<void>[] = [];

    for (const imageInfo of customImages) {
        if (!imageInfo.id || !imageInfo.url) continue;

        const promise = (async () => {
            try {
                const image = await map.loadImage(imageInfo.url);
                if (!map.hasImage(imageInfo.id)) {
                    map.addImage(imageInfo.id, image.data, { pixelRatio: imageInfo.pixelRatio || 1 });
                }
            } catch (error) {
                console.error(`Error loading image ${imageInfo.id} from ${imageInfo.url}:`, error);
            }
        })();
        imageLoadPromises.push(promise);
    }

    // Wait for all images to be loaded and added before proceeding
    await Promise.all(imageLoadPromises);
}

// --- START THE APP ---
initializeApp();