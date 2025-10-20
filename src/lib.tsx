import React, { useState, useEffect, useRef, useCallback } from 'react';
import maplibregl, { LngLatBounds, type AddProtocolAction } from 'maplibre-gl';
import './style.scss';


// --- TYPE DEFINITIONS for custom config properties ---
export interface BackgroundLayerConfig {
    id: string;
    name: string;
}

export interface DataLayerConfig {
    id: string;
    name: string;
    layerIds: string[];
    interactive?: boolean;
}

export interface CustomUiConfig {
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

export interface AppConfig {
    title?: string;
    center?: [number, number];
    zoom?: number;
    bounds?: [number, number, number, number];
    sources?: any;
    layers?: any[];
    customUi: CustomUiConfig;
    customImageResources?: Array<{
        id: string;
        url: string;
        pixelRatio?: number;
    }>;
}

export interface InfoPanelData {
    title?: string;
    description?: string;
    imageUrl?: string;
    imageSize?: [number, number];
}

// Map Component Props
interface MapProps {
    mapStyle: any;
    initialViewState: {
        center?: [number, number];
        zoom?: number;
        bounds?: [number, number, number, number];
    };
    style: React.CSSProperties;
    attributionControl?: boolean;
    onLoad?: () => void;
    onClick?: (e: maplibregl.MapMouseEvent) => void;
    onDrag?: () => void;
    onDblClick?: () => void;
    onStyleImageMissing?: (e: any) => void;
    customProtocols?: Array<{ name: string, loadFn: AddProtocolAction }>;
    cooperativeGestures?: boolean;
}

// Custom Map Component
const Map = React.forwardRef<{ getMap: () => maplibregl.Map | null }, MapProps>(
    ({ mapStyle, initialViewState, style, attributionControl = true, onLoad, onClick, onDrag, onDblClick, onStyleImageMissing, customProtocols, cooperativeGestures }, ref) => {
        const mapContainer = useRef<HTMLDivElement>(null);
        const mapInstance = useRef<maplibregl.Map | null>(null);

        React.useImperativeHandle(ref, () => ({
            getMap: () => mapInstance.current
        }));

        useEffect(() => {
            if (!mapContainer.current) return;

            // Add custom protocols
            if (customProtocols) {
                customProtocols.forEach(protocol => {
                    maplibregl.addProtocol(protocol.name, protocol.loadFn);
                });
            }

            // Create map instance
            mapInstance.current = new maplibregl.Map({
                container: mapContainer.current,
                style: mapStyle,
                center: initialViewState.center,
                zoom: initialViewState.zoom,
                bounds: initialViewState.bounds,
                attributionControl: attributionControl ? {} : false,
                cooperativeGestures,
            });

            const map = mapInstance.current;

            // Set up event handlers
            if (onLoad) {
                map.on('load', onLoad);
            }

            if (onClick) {
                map.on('click', onClick);
            }

            if (onDrag) {
                map.on('drag', onDrag);
            }

            if (onDblClick) {
                map.on('dblclick', onDblClick);
            }

            if (onStyleImageMissing) {
                map.on('styleimagemissing', onStyleImageMissing);
            }

            return () => {
                map.remove();
            };
        }, []);

        return <div ref={mapContainer} style={style} />;
    }
);

Map.displayName = 'Map';

// --- REACT COMPONENTS ---
export const MapVibeApp: React.FC<{ customProtocols?: Array<{ name: string, loadFn: AddProtocolAction }> }> = ({ customProtocols }) => {
    const mapRef = useRef<{ getMap: () => maplibregl.Map | null }>(null);
    const [config, setConfig] = useState<AppConfig | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [layerChooserVisible, setLayerChooserVisible] = useState(false);
    const [infoPanelVisible, setInfoPanelVisible] = useState(false);
    const [infoPanelData, setInfoPanelData] = useState<InfoPanelData>({});
    const [selectedBackgroundLayer, setSelectedBackgroundLayer] = useState<string>('');
    const [visibleDataLayers, setVisibleDataLayers] = useState<Set<string>>(new Set());
    const [cooperativeGestures, setCooperativeGestures] = useState<boolean>(false);

    // Initialize app on mount
    useEffect(() => {
        const initializeApp = async () => {
            const urlParams = new URLSearchParams(window.location.search);
            const configUrl = urlParams.get('config');
            const cooperativeGesturesParam = urlParams.get('cooperativeGestures');
            if (cooperativeGesturesParam) {
                setCooperativeGestures(['true', '1', 'y', 'yes'].includes(cooperativeGesturesParam.toLowerCase()));
            }

            if (!configUrl) {
                setError('Error: The `config` URL parameter is missing.');
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

                setConfig(config);

                // Initialize layer states
                if (config.customUi?.backgroundLayers) {
                    const defaultBg = config.customUi.backgroundLayers.find((layer: BackgroundLayerConfig) =>
                        config.layers?.find((l: any) => l.id === layer.id && l.layout?.visibility !== 'none')
                    );
                    if (defaultBg) {
                        setSelectedBackgroundLayer(defaultBg.id);
                    }
                }

                if (config.customUi?.dataLayers) {
                    const visibleData = new Set<string>();
                    config.customUi.dataLayers.forEach((dataLayer: DataLayerConfig) => {
                        // Check if any of the referenced layers are visible
                        const hasVisibleLayers = dataLayer.layerIds.some(layerId => {
                            const layerDef = config.layers?.find((l: any) => l.id === layerId);
                            return layerDef && layerDef.layout?.visibility !== 'none';
                        });
                        if (hasVisibleLayers) {
                            visibleData.add(dataLayer.id);
                        }
                    });
                    setVisibleDataLayers(visibleData);
                }

            } catch (error) {
                setError(`Error initializing application: ${error instanceof Error ? error.message : String(error)}`);
            }
        };

        initializeApp();
    }, []);

    // Handle styleimagemissing event
    const handleStyleImageMissing = useCallback(async (e: any) => {
        const map = mapRef.current?.getMap();
        if (!map || !config) return;
        await loadCustomImageOnDemand(map, config, e.id);
    }, [config]);

    // Handle map load
    const onMapLoad = useCallback(async () => {
        const map = mapRef.current?.getMap();
        if (!map || !config) return;

        // Set initial zoom constraints based on the default active layer
        if (selectedBackgroundLayer) {
            const mapLayer = findLayerWithId(selectedBackgroundLayer, config);
            const sourceName = mapLayer.source;
            const sourceDef = config.sources && config.sources[sourceName] ? config.sources[sourceName] : {};
            const { minZoom, maxZoom } = getClampedZoomBounds(sourceDef, config.customUi);

            map.setMinZoom(minZoom ?? null);
            map.setMaxZoom(maxZoom ?? null);
        }

        // Add scale control if enabled
        if (config.customUi?.controls?.scale) {
            map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right');
        }
        // Add zoom control if enabled
        if (config.customUi?.controls?.zoom) {
            map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');
        }
        // Add attribution control if enabled
        if (config.customUi?.controls?.attribution) {
            map.addControl(new maplibregl.AttributionControl({ compact: false }), 'bottom-left');
        }

        // Add fullscreen button if enabled
        if (config.customUi?.controls?.fullscreen) {
            const fullscreenBtn = document.createElement('button');
            fullscreenBtn.className = 'maplibregl-ctrl maplibregl-ctrl-group custom-fullscreen-btn';
            fullscreenBtn.title = 'See larger';
            fullscreenBtn.innerHTML = '<span></span>';
            fullscreenBtn.onclick = () => {
                const url = new URL(window.location.href);
                url.searchParams.delete('cooperativeGestures');
                window.open(url.href, '_blank');
            };
            map.getContainer().querySelector('.maplibregl-ctrl-top-left')?.appendChild(fullscreenBtn);
        }

        // Set pointer cursor for interactive layers
        const clickableLayerIds = getClickableLayerIds(config);
        map.on('mousemove', (e) => {
            const features = map.queryRenderedFeatures(e.point, { layers: clickableLayerIds });
            map.getCanvas().style.cursor = features.length ? 'pointer' : '';
        });

        // Fit to bounds if no center/zoom specified or bounds
        if ((!(config.center && config.zoom) && !config.bounds) && config.sources) {
            await fitMapToBounds(map, config.sources);
        }
    }, [config, selectedBackgroundLayer]);

    // Handle map click
    const onMapClick = useCallback((e: maplibregl.MapMouseEvent) => {
        const map = mapRef.current?.getMap();
        if (!map || !config) return;

        // Always close layer chooser on map click
        setLayerChooserVisible(false);

        const clickableLayerIds = getClickableLayerIds(config);
        const features = map.queryRenderedFeatures(e.point, { layers: clickableLayerIds });

        if (!features.length) {
            setInfoPanelVisible(false);
            return;
        }

        const feature = features[0];
        const properties = feature.properties;

        let imageSize: [number, number] | undefined = undefined;
        if (typeof properties.imageSize === 'string') {
            const parts = properties.imageSize.split(',').map(s => parseInt(s.trim(), 10));
            if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                imageSize = [parts[0], parts[1]];
            }
        }

        setInfoPanelData({
            title: properties.title,
            description: properties.description,
            imageUrl: properties.imageUrl,
            imageSize: imageSize
        });
        setInfoPanelVisible(true);
    }, [config]);

    // Handle background layer change
    const handleBackgroundLayerChange = useCallback((layerId: string) => {
        const map = mapRef.current?.getMap();
        if (!map || !config) return;

        setSelectedBackgroundLayer(layerId);
        setLayerChooserVisible(false);

        // Update layer visibility
        config.customUi.backgroundLayers.forEach((layer: BackgroundLayerConfig) => {
            map.setLayoutProperty(layer.id, 'visibility', layer.id === layerId ? 'visible' : 'none');
        });

        // Update zoom constraints
        const mapLayer = findLayerWithId(layerId, config);
        const sourceName = mapLayer.source;
        const sourceDef = config.sources && config.sources[sourceName] ? config.sources[sourceName] : {};
        const { minZoom, maxZoom } = getClampedZoomBounds(sourceDef, config.customUi);
        const currentZoom = map.getZoom();

        map.setMinZoom(minZoom ?? null);
        map.setMaxZoom(maxZoom ?? null);

        if (maxZoom !== undefined && currentZoom > maxZoom) {
            map.zoomTo(maxZoom);
        } else if (minZoom !== undefined && currentZoom < minZoom) {
            map.zoomTo(minZoom);
        }
    }, [config]);

    // Handle data layer toggle
    const handleDataLayerToggle = useCallback((dataLayerId: string, visible: boolean) => {
        const map = mapRef.current?.getMap();
        if (!map || !config) return;

        const newVisibleLayers = new Set(visibleDataLayers);
        if (visible) {
            newVisibleLayers.add(dataLayerId);
        } else {
            newVisibleLayers.delete(dataLayerId);
        }
        setVisibleDataLayers(newVisibleLayers);

        // Find the data layer config to get the layerIds
        const dataLayer = config.customUi.dataLayers.find((layer: DataLayerConfig) => layer.id === dataLayerId);
        if (dataLayer) {
            // Toggle visibility for all layers referenced in layerIds
            dataLayer.layerIds.forEach(layerId => {
                map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
            });
        }
    }, [visibleDataLayers, config]);

    if (error) {
        return (
            <div style={{ padding: '20px', fontFamily: 'sans-serif', color: 'red' }}>
                {error}
            </div>
        );
    }

    if (!config) {
        return <div>Loading...</div>;
    }

    return (
        <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
            <Map
                ref={mapRef}
                mapStyle={config as any}
                initialViewState={{
                    center: config.center,
                    zoom: config.zoom,
                    bounds: config.bounds,
                }}
                style={{ width: '100%', height: '100%' }}
                attributionControl={false}
                cooperativeGestures={cooperativeGestures}
                onLoad={onMapLoad}
                onClick={onMapClick}
                onDrag={() => setLayerChooserVisible(false)}
                onDblClick={() => {
                    setInfoPanelVisible(false);
                    setLayerChooserVisible(false);
                }}
                onStyleImageMissing={handleStyleImageMissing}
                customProtocols={customProtocols}
            />

            {/* Controls */}
            {config.customUi?.controls && (
                <>
                    {/* Layer Chooser */}
                    {config.customUi.controls.layerChooser && (
                        <LayerChooser
                            config={config}
                            visible={layerChooserVisible}
                            onToggle={() => {
                                setLayerChooserVisible(!layerChooserVisible);
                                setInfoPanelVisible(false);
                            }}
                            selectedBackgroundLayer={selectedBackgroundLayer}
                            visibleDataLayers={visibleDataLayers}
                            onBackgroundLayerChange={handleBackgroundLayerChange}
                            onDataLayerToggle={handleDataLayerToggle}
                        />
                    )}
                </>
            )}

            {/* Info Panel */}
            {infoPanelVisible && (
                <InfoPanel
                    config={config.customUi.panel}
                    data={infoPanelData}
                    onClose={() => setInfoPanelVisible(false)}
                />
            )}
        </div>
    );
};

// Layer Chooser Component
const LayerChooser: React.FC<{
    config: AppConfig;
    visible: boolean;
    onToggle: () => void;
    selectedBackgroundLayer: string;
    visibleDataLayers: Set<string>;
    onBackgroundLayerChange: (layerId: string) => void;
    onDataLayerToggle: (layerId: string, visible: boolean) => void;
}> = ({ config, visible, onToggle, selectedBackgroundLayer, visibleDataLayers, onBackgroundLayerChange, onDataLayerToggle }) => {
    return (
        <div className="maplibregl-ctrl maplibregl-ctrl-group custom-layer-chooser"
            style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 1000 }}>
            <button
                className="layer-chooser-btn"
                type="button"
                title='Layers'
                onClick={onToggle}
            />
            {visible && (
                <div className="layer-chooser-panel visible">
                    {/* Background Layers */}
                    <h4>Background Layers</h4>
                    {config.customUi.backgroundLayers.map((layer) => (
                        <div key={layer.id}>
                            <input
                                type="radio"
                                name="background-layer"
                                id={`bg-${layer.id}`}
                                checked={selectedBackgroundLayer === layer.id}
                                onChange={() => onBackgroundLayerChange(layer.id)}
                            />
                            <label htmlFor={`bg-${layer.id}`}>{layer.name}</label>
                        </div>
                    ))}

                    {/* Data Layers */}
                    <h4>Data Layers</h4>
                    {config.customUi.dataLayers.map((layer) => (
                        <div key={layer.id}>
                            <input
                                type="checkbox"
                                id={`data-${layer.id}`}
                                checked={visibleDataLayers.has(layer.id)}
                                onChange={(e) => onDataLayerToggle(layer.id, e.target.checked)}
                            />
                            <label htmlFor={`data-${layer.id}`}>{layer.name}</label>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// Info Panel Component
const InfoPanel: React.FC<{
    config: CustomUiConfig['panel'];
    data: InfoPanelData;
    onClose: () => void;
}> = ({ config, data, onClose }) => {
    const ratio = data.imageSize ? `${data.imageSize[0]} / ${data.imageSize[1]}` : undefined;
    return (
        <div
            id="info-panel"
            style={{
                position: 'absolute',
                top: 0,
                right: 0,
                height: '100%',
                backgroundColor: config.backgroundColor,
                width: config.width,
                zIndex: 1000,
                display: 'flex'
            }}
        >
            <div id="info-panel__header">
                <button
                    id="info-panel__close-btn"
                    onClick={onClose}
                >
                </button>
            </div>
            <div id="info-panel__content">
                <div id="info-panel__content-img">
                    {data.imageUrl && (
                        <div style={{ width: '100%', aspectRatio: ratio }}>
                            <img
                                src={data.imageUrl}
                                alt={data.title || ''}
                                key={data.imageUrl}
                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            />
                        </div>
                    )}
                </div>
                <div id="info-panel__content-text">
                    {data.title && <h1>{data.title}</h1>}
                    {data.description && (
                        <div dangerouslySetInnerHTML={{ __html: data.description }} />
                    )}
                </div>
            </div>
        </div>
    );
};

// --- HELPER FUNCTIONS ---

function findLayerWithId(layerId: string, config: AppConfig) {
    return (Array.isArray(config.layers) ? config.layers.find((l: any) => l.id === layerId) : undefined) || {};
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
 * Finds layers that are interactive based on dataLayers configuration.
 */
function getClickableLayerIds(config: AppConfig): string[] {
    const clickableLayerIds: string[] = [];
    if (config.customUi && Array.isArray(config.customUi.dataLayers)) {
        config.customUi.dataLayers.forEach((dataLayer: DataLayerConfig) => {
            if (dataLayer.interactive) {
                // Add all layerIds from this interactive data layer
                clickableLayerIds.push(...dataLayer.layerIds);
            }
        });
    }
    return clickableLayerIds;
}

/**
 * Loads a custom image on demand when requested by the map style.
 */
async function loadCustomImageOnDemand(map: maplibregl.Map, config: AppConfig, imageId: string) {
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