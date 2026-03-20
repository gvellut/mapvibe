import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import maplibregl, { LngLatBounds, type AddProtocolAction, type GeoJSONSource, type MapGeoJSONFeature } from 'maplibre-gl';
import './style.scss';
import {
    type RememberLastPositionValue,
    normalizeRememberLastPosition,
    loadRememberedViewState,
    saveRememberedViewState
} from './rememberLastPosition';

// defined in css: width of map smaller than that : infopanel takes full size
const INFO_PANEL_DESKTOP_WIDTH = 450;
// params defined in App.tsx
// TODO share?
const MOBILE_COOPERATIVE_GESTURES_PARAM = "mgc";
const FULLSCREEN_PARAM = "fs";
const IMPORT_NAMESPACE_PREFIX = "__imports_";
const DEFAULT_IMPORTED_SPRITE_ID = "default";
const RESOLVED_IMAGE_PROPERTIES = [
    'icon-image',
    'fill-pattern',
    'fill-extrusion-pattern',
    'line-pattern',
    'background-pattern'
] as const;

type LayerVisibility = 'visible' | 'none';
type SpriteConfig = string | Array<{ id: string; url: string }> | undefined;

// --- TYPE DEFINITIONS for custom config properties ---
export interface BackgroundLayerConfig {
    id: string;
    name: string;
    layerIds: string[];
    visible?: boolean;
}

export interface StyleImportConfig {
    id: string;
    url: string;
}

export interface DataLayerConfig {
    id: string;
    name: string;
    layerIds: string[];
    visible?: boolean;
    interactive?: boolean;
    clusterInteractive?: boolean;
    openUrl?: boolean;
}

export interface CustomUiConfig {
    panel: {
        backgroundColor: string;
        width: string;
        imageSizeIsMax?: boolean;
        recenterOnOpen?: boolean;
        marginRecenterOnOpen?: number;
    };
    controls: {
        zoom?: boolean;
        scale?: boolean;
        layerChooser?: boolean;
        fullscreen?: boolean;
        attribution?: boolean;
    };
    imports?: StyleImportConfig[];
    backgroundLayers: BackgroundLayerConfig[];
    dataLayers: DataLayerConfig[];
    globalMinZoom?: number;
    globalMaxZoom?: number;
}

export interface AppConfig {
    title?: string;
    version?: number;
    name?: string;
    metadata?: any;
    center?: [number, number];
    centerAltitude?: number;
    zoom?: number;
    bearing?: number;
    pitch?: number;
    roll?: number;
    bounds?: [number, number, number, number];
    state?: any;
    light?: any;
    sky?: any;
    projection?: any;
    terrain?: any;
    sources?: Record<string, any>;
    sprite?: SpriteConfig;
    glyphs?: string;
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
    imageBackgroundColor?: string;
    imageSize?: [number, number];
    imagePadding?: [number, number, number, number];
}

export interface MapVibeImportInfo {
    id: string;
    url: string;
    layerIds: string[];
    sourceIds: string[];
    spriteIds: string[];
    glyphsUrl?: string;
}

export interface MapVibeMapHandle {
    getMap: () => maplibregl.Map | null;
    getLayerIdsForBackgroundLayer: (id: string) => string[];
    getImportInfo: (id: string) => MapVibeImportInfo | null;
    closeInfoPanel: () => void;
}

export interface MapVibeMapProps {
    config: AppConfig,
    customProtocols?: Array<{ name: string, loadFn: AddProtocolAction }>,
    mobileCooperativeGestures?: boolean,
    rememberLastPosition?: RememberLastPositionValue,
    fullscreen?: boolean | null,
    ref?: React.Ref<MapVibeMapHandle>
}

interface MapInstanceHandle {
    getMap: () => maplibregl.Map | null;
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
    onMoveEnd?: () => void;
    onDblClick?: () => void;
    onStyleImageMissing?: (e: any) => void;
    customProtocols?: Array<{ name: string, loadFn: AddProtocolAction }>;
    mobileCooperativeGestures?: boolean;
    ref?: React.Ref<MapInstanceHandle>;
}

interface BackgroundLayerDefinition {
    id: string;
    memberIds: string[];
}

interface BackgroundCatalog {
    backgroundEntries: BackgroundLayerConfig[];
    backgroundDefinitions: Map<string, BackgroundLayerDefinition>;
    dataLayerEntries: DataLayerConfig[];
    dataLayerConfigs: Map<string, DataLayerConfig>;
    clickableLayerIds: string[];
    importConfigs: Map<string, StyleImportConfig>;
    topLayerDefinitions: Map<string, any>;
    topSourceDefinitions: Record<string, any>;
    managedTopLayerIds: Set<string>;
    overlayBoundaryId?: string;
    initialSelection: string;
    initialVisibleDataLayerIds: Set<string>;
    topStyleGlyphsUrl?: string;
}

interface SpriteMapping {
    ids: Map<string, string>;
    urls: Map<string, string>;
    defaultSpriteId?: string;
}

interface RuntimeImportInfo extends MapVibeImportInfo {
    originalVisibilityByLayerId: Map<string, LayerVisibility>;
    sourceDefinitions: Map<string, any>;
    layerDefinitions: Map<string, any>;
    spriteUrls: Map<string, string>;
}

interface BackgroundRuntimeState {
    imports: Map<string, RuntimeImportInfo>;
    loadingImports: Set<string>;
}

type InteractiveFeatureAction =
    | {
        kind: 'cluster-zoom';
        dataLayer: DataLayerConfig;
        feature: MapGeoJSONFeature;
    }
    | {
        kind: 'info-panel' | 'open-url';
        dataLayer: DataLayerConfig;
        feature: MapGeoJSONFeature;
        properties: Record<string, any>;
    };

// Custom Map Component
const MapCanvas = ({
    mapStyle,
    initialViewState,
    style,
    attributionControl = true,
    onLoad,
    onClick,
    onDrag,
    onMoveEnd,
    onDblClick,
    onStyleImageMissing,
    customProtocols,
    mobileCooperativeGestures,
    ref
}: MapProps) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<maplibregl.Map | null>(null);

    React.useImperativeHandle(ref, () => ({
        getMap: () => mapInstance.current
    }));

    useEffect(() => {
        if (!mapContainer.current) return;

        if (customProtocols) {
            customProtocols.forEach(protocol => {
                maplibregl.addProtocol(protocol.name, protocol.loadFn);
            });
        }

        mapInstance.current = new maplibregl.Map({
            container: mapContainer.current,
            style: mapStyle,
            center: initialViewState.center,
            zoom: initialViewState.zoom,
            bounds: initialViewState.bounds,
            attributionControl: attributionControl ? {} : false,
        });

        const map = mapInstance.current;

        if (mobileCooperativeGestures && isMobile()) {
            map.cooperativeGestures.enable();
        }

        map.dragRotate.disable();
        map.touchZoomRotate.disableRotation();
        map.touchPitch.disable();

        if (onLoad) {
            map.on('load', onLoad);
        }

        if (onClick) {
            map.on('click', onClick);
        }

        if (onDrag) {
            map.on('drag', onDrag);
        }

        if (onMoveEnd) {
            map.on('moveend', onMoveEnd);
        }

        if (onDblClick) {
            map.on('dblclick', onDblClick);
        }

        if (onStyleImageMissing) {
            map.on('styleimagemissing', onStyleImageMissing);
        }

        return () => {
            map.remove();
            mapInstance.current = null;
        };
    }, []);

    return <div ref={mapContainer} style={style} />;
};

MapCanvas.displayName = 'MapCanvas';

// --- REACT COMPONENTS ---
export const MapVibeMap = ({ config, customProtocols, mobileCooperativeGestures = true, rememberLastPosition = false, fullscreen = null, ref }: MapVibeMapProps) => {
    const backgroundCatalog = useMemo(() => buildBackgroundCatalog(config), [config]);
    const initialMapStyle = useMemo(() => createInitialMapStyle(config), [config]);
    const backgroundCatalogRef = useRef(backgroundCatalog);
    backgroundCatalogRef.current = backgroundCatalog;

    const configRef = useRef(config);
    configRef.current = config;

    const mapRef = useRef<MapInstanceHandle>(null);
    const backgroundRuntimeRef = useRef<BackgroundRuntimeState>(createBackgroundRuntimeState());

    const [layerChooserVisible, setLayerChooserVisible] = useState(false);
    const [infoPanelVisible, setInfoPanelVisible] = useState(false);
    const [infoPanelData, setInfoPanelData] = useState<InfoPanelData>({});
    const [selectedBackgroundLayer, setSelectedBackgroundLayer] = useState(backgroundCatalog.initialSelection);
    const selectedBackgroundLayerRef = useRef(backgroundCatalog.initialSelection);
    const [visibleDataLayers, setVisibleDataLayers] = useState(new Set(backgroundCatalog.initialVisibleDataLayerIds));
    const visibleDataLayersRef = useRef(new Set(backgroundCatalog.initialVisibleDataLayerIds));

    const rememberLastPositionScope = normalizeRememberLastPosition(rememberLastPosition);
    const rememberedViewState = useMemo(
        () => loadRememberedViewState(rememberLastPositionScope),
        [rememberLastPositionScope]
    );
    const hasRememberedViewState = Boolean(rememberedViewState);
    const hasConfiguredCenterZoom = Array.isArray(config.center) && typeof config.zoom === 'number';
    const hasConfiguredBounds = Array.isArray(config.bounds) && config.bounds.length === 4;
    const initialViewState = rememberedViewState
        ? { center: rememberedViewState.center, zoom: rememberedViewState.zoom }
        : hasConfiguredCenterZoom
            ? { center: config.center, zoom: config.zoom }
            : hasConfiguredBounds
                ? { bounds: config.bounds }
                : {};

    useEffect(() => {
        selectedBackgroundLayerRef.current = selectedBackgroundLayer;
    }, [selectedBackgroundLayer]);

    useEffect(() => {
        visibleDataLayersRef.current = visibleDataLayers;
    }, [visibleDataLayers]);

    useEffect(() => {
        backgroundRuntimeRef.current = createBackgroundRuntimeState();
        selectedBackgroundLayerRef.current = backgroundCatalog.initialSelection;
        visibleDataLayersRef.current = new Set(backgroundCatalog.initialVisibleDataLayerIds);
        setSelectedBackgroundLayer(backgroundCatalog.initialSelection);
        setVisibleDataLayers(new Set(backgroundCatalog.initialVisibleDataLayerIds));
    }, [backgroundCatalog]);

    React.useImperativeHandle(ref, () => ({
        getMap: () => mapRef.current?.getMap() ?? null,
        getLayerIdsForBackgroundLayer: (id: string) => getBackgroundLayerIds(id, backgroundCatalogRef.current, backgroundRuntimeRef.current),
        getImportInfo: (id: string) => getImportInfo(backgroundRuntimeRef.current, id),
        closeInfoPanel: () => setInfoPanelVisible(false)
    }), []);

    const applySelectedBackground = useCallback((backgroundId: string, options?: { updateState?: boolean; closeChooser?: boolean }) => {
        const map = mapRef.current?.getMap();
        if (!map) return;

        applyBackgroundSelection(
            map,
            backgroundId,
            backgroundCatalogRef.current,
            backgroundRuntimeRef.current,
            configRef.current.customUi
        );

        selectedBackgroundLayerRef.current = backgroundId;

        if (options?.updateState !== false) {
            setSelectedBackgroundLayer(backgroundId);
        }

        if (options?.closeChooser !== false) {
            setLayerChooserVisible(false);
        }
    }, []);

    const ensureConfiguredImportsLoaded = useCallback(() => {
        for (const importConfig of backgroundCatalogRef.current.importConfigs.values()) {
            void loadBackgroundImport(
                importConfig,
                backgroundCatalogRef,
                backgroundRuntimeRef,
                mapRef,
                selectedBackgroundLayerRef,
                applySelectedBackground
            );
        }
    }, [applySelectedBackground]);

    const handleStyleImageMissing = useCallback(async (e: any) => {
        const map = mapRef.current?.getMap();
        const currentConfig = configRef.current;
        if (!map || !currentConfig) return;
        await loadCustomImageOnDemand(map, currentConfig, e.id);
    }, []);

    const onMapLoad = useCallback(async () => {
        const map = mapRef.current?.getMap();
        const currentConfig = configRef.current;
        if (!map || !currentConfig) return;

        applyBackgroundSelection(
            map,
            selectedBackgroundLayerRef.current,
            backgroundCatalogRef.current,
            backgroundRuntimeRef.current,
            currentConfig.customUi
        );
        applyDataLayerVisibilitySelection(map, backgroundCatalogRef.current, visibleDataLayersRef.current);

        if (currentConfig.customUi?.controls?.scale) {
            map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right');
        }

        if (currentConfig.customUi?.controls?.zoom) {
            map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');
        }

        if (currentConfig.customUi?.controls?.attribution) {
            map.addControl(new maplibregl.AttributionControl({ compact: false }), 'bottom-left');
        }

        const fullscreenEnabled = fullscreen ?? currentConfig.customUi?.controls?.fullscreen ?? false;
        if (fullscreenEnabled) {
            const fullscreenBtn = document.createElement('button');
            fullscreenBtn.className = 'maplibregl-ctrl maplibregl-ctrl-group custom-fullscreen-btn';
            fullscreenBtn.title = 'See larger';
            fullscreenBtn.innerHTML = '<span></span>';
            fullscreenBtn.onclick = () => {
                const url = new URL(window.location.href);
                // make sure no cooperative gestures on full screen tab : touch is only for the map
                url.searchParams.set(MOBILE_COOPERATIVE_GESTURES_PARAM, 'no');
                url.searchParams.set(FULLSCREEN_PARAM, 'no');
                window.open(url.href, '_blank');
            };
            map.getContainer().querySelector('.maplibregl-ctrl-top-left')?.appendChild(fullscreenBtn);
        }

        map.on('mousemove', (e) => {
            const action = getInteractiveFeatureActionAtPoint(map, e.point, backgroundCatalogRef.current);
            map.getCanvas().style.cursor = action ? 'pointer' : '';
        });

        ensureConfiguredImportsLoaded();

        if (!hasRememberedViewState && !hasConfiguredCenterZoom && !hasConfiguredBounds && currentConfig.sources) {
            await fitMapToBounds(map, currentConfig.sources);
        }
    }, [ensureConfiguredImportsLoaded, fullscreen, hasConfiguredBounds, hasConfiguredCenterZoom, hasRememberedViewState]);

    const onMapMoveEnd = useCallback(() => {
        const map = mapRef.current?.getMap();
        if (!map) return;

        const center = map.getCenter();
        saveRememberedViewState(rememberLastPositionScope, [center.lng, center.lat], map.getZoom());
    }, [rememberLastPositionScope]);

    const onMapClick = useCallback(async (e: maplibregl.MapMouseEvent) => {
        const map = mapRef.current?.getMap();
        const currentConfig = configRef.current;
        if (!map || !currentConfig) return;

        setLayerChooserVisible(false);

        const action = getInteractiveFeatureActionAtPoint(map, e.point, backgroundCatalogRef.current);

        if (!action) {
            setInfoPanelVisible(false);
            return;
        }

        if (action.kind === 'cluster-zoom') {
            setInfoPanelVisible(false);
            await zoomToClusterFeature(map, action.feature);
            return;
        }

        if (action.kind === 'open-url') {
            const properties = action.properties;
            const featureUrl = typeof properties?.url === 'string' ? properties.url : undefined;
            if (!featureUrl) {
                console.warn(`Feature in data layer "${action.dataLayer.id}" is missing a string "url" property.`, action.feature);
            } else {
                window.open(featureUrl, '_blank', 'noopener,noreferrer');
            }
            return;
        }

        const properties = action.properties;
        const imageSize = parseImageSize(properties.imageSize);
        const imagePadding = parseImagePadding(properties.imagePadding);

        setInfoPanelData({
            title: properties.title,
            description: properties.description,
            imageUrl: properties.imageUrl,
            imageBackgroundColor: properties.imageBackgroundColor,
            imageSize: imageSize,
            imagePadding: imagePadding
        });
        setInfoPanelVisible(true);

        const { recenterOnOpen, marginRecenterOnOpen } = currentConfig.customUi.panel;
        if (recenterOnOpen && window.innerWidth > INFO_PANEL_DESKTOP_WIDTH) {
            const panelWidth = parseInt(currentConfig.customUi.panel.width, 10);
            const margin = marginRecenterOnOpen || 0;
            const mapContainer = map.getContainer();
            const mapWidth = mapContainer.offsetWidth;
            const mapHeight = mapContainer.offsetHeight;

            let coveredLeft = panelWidth + margin;
            let coveredRight = mapWidth - margin;
            let coveredTop = margin;
            let coveredBottom = mapHeight - margin;

            let [clickX, clickY] = [e.point.x, e.point.y];
            if (clickX < coveredLeft || clickX > coveredRight
                || clickY < coveredTop || clickY > coveredBottom) {
                const visibleWidth = mapWidth - panelWidth;
                const targetX = panelWidth + (visibleWidth / 2);
                const targetY = mapHeight / 2;

                const panX = -(targetX - clickX);
                const panY = -(targetY - clickY);

                map.panBy([panX, panY], { duration: 0 });
            }
        }
    }, []);

    const handleBackgroundLayerChange = useCallback((layerId: string) => {
        applySelectedBackground(layerId, { updateState: true, closeChooser: true });
    }, [applySelectedBackground]);

    const handleDataLayerToggle = useCallback((dataLayerId: string, visible: boolean) => {
        const map = mapRef.current?.getMap();
        const dataLayer = backgroundCatalogRef.current.dataLayerConfigs.get(dataLayerId);
        if (!map || !dataLayer) return;

        setVisibleDataLayers(previous => {
            const next = new Set(previous);
            if (visible) {
                next.add(dataLayerId);
            } else {
                next.delete(dataLayerId);
            }
            visibleDataLayersRef.current = next;
            return next;
        });

        setDataLayerVisibility(map, dataLayer, visible);
    }, []);

    useEffect(() => {
        return () => {
            const map = mapRef.current?.getMap();
            if (map) {
                cleanupImportedBackgrounds(map, backgroundRuntimeRef.current, backgroundCatalogRef.current);
            }
        };
    }, []);

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <MapCanvas
                ref={mapRef}
                mapStyle={initialMapStyle as any}
                initialViewState={initialViewState}
                style={{ width: '100%', height: '100%' }}
                attributionControl={false}
                mobileCooperativeGestures={mobileCooperativeGestures}
                onLoad={onMapLoad}
                onClick={onMapClick}
                onDrag={() => setLayerChooserVisible(false)}
                onMoveEnd={onMapMoveEnd}
                onDblClick={() => {
                    setInfoPanelVisible(false);
                    setLayerChooserVisible(false);
                }}
                onStyleImageMissing={handleStyleImageMissing}
                customProtocols={customProtocols}
            />

            {config.customUi?.controls && (
                <>
                    {config.customUi.controls.layerChooser && (
                        <LayerChooser
                            backgroundLayers={backgroundCatalog.backgroundEntries}
                            dataLayers={backgroundCatalog.dataLayerEntries}
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

MapVibeMap.displayName = 'MapVibeMap';

// Layer Chooser Component
const LayerChooser: React.FC<{
    backgroundLayers: BackgroundLayerConfig[];
    dataLayers: DataLayerConfig[];
    visible: boolean;
    onToggle: () => void;
    selectedBackgroundLayer: string;
    visibleDataLayers: Set<string>;
    onBackgroundLayerChange: (layerId: string) => void;
    onDataLayerToggle: (layerId: string, visible: boolean) => void;
}> = ({ backgroundLayers, dataLayers, visible, onToggle, selectedBackgroundLayer, visibleDataLayers, onBackgroundLayerChange, onDataLayerToggle }) => {
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
                    <h4>Background Layers</h4>
                    {backgroundLayers.map((layer) => (
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

                    <h4>Data Layers</h4>
                    {dataLayers.map((layer) => (
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
    const imagePadding = formatBoxSpacing(data.imagePadding);
    const imageContainerStyle: React.CSSProperties = config.imageSizeIsMax && data.imageSize
        ? {
            width: '100%',
            maxWidth: `${data.imageSize[0]}px`,
            marginLeft: 'auto',
            marginRight: 'auto',
            aspectRatio: ratio
        }
        : {
            width: '100%',
            aspectRatio: ratio
        };
    const imageStyle: React.CSSProperties = ratio
        ? { width: '100%', height: '100%', objectFit: 'contain', display: 'block' }
        : { width: '100%', height: 'auto', display: 'block' };
    return (
        <div
            id="info-panel"
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
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
                        <div style={{ width: '100%', padding: imagePadding, boxSizing: 'border-box', backgroundColor: data.imageBackgroundColor }}>
                            <div style={imageContainerStyle}>
                                <img
                                    src={data.imageUrl}
                                    alt={data.title || ''}
                                    key={data.imageUrl}
                                    style={imageStyle}
                                />
                            </div>
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

function createBackgroundRuntimeState(): BackgroundRuntimeState {
    return {
        imports: new Map<string, RuntimeImportInfo>(),
        loadingImports: new Set<string>()
    };
}

function getInteractiveFeatureActionAtPoint(
    map: maplibregl.Map,
    point: maplibregl.Point,
    catalog: BackgroundCatalog
): InteractiveFeatureAction | null {
    if (!catalog.clickableLayerIds.length) {
        return null;
    }

    const features = map.queryRenderedFeatures(point, { layers: catalog.clickableLayerIds }) as MapGeoJSONFeature[];
    return resolveInteractiveFeatureAction(features, catalog);
}

function resolveInteractiveFeatureAction(
    features: MapGeoJSONFeature[],
    catalog: BackgroundCatalog
): InteractiveFeatureAction | null {
    for (const feature of features) {
        const dataLayer = getDataLayerForMapLayerId(catalog, feature.layer.id);
        if (!dataLayer) {
            continue;
        }

        const properties = getFeatureProperties(feature);
        if (isGeneratedClusterFeature(properties)) {
            if (!dataLayer.clusterInteractive) {
                continue;
            }

            return {
                kind: 'cluster-zoom',
                dataLayer,
                feature
            };
        }

        return {
            kind: dataLayer.openUrl ? 'open-url' : 'info-panel',
            dataLayer,
            feature,
            properties
        };
    }

    return null;
}

function getFeatureProperties(feature: MapGeoJSONFeature): Record<string, any> {
    return (feature.properties ?? {}) as Record<string, any>;
}

function isGeneratedClusterFeature(properties: Record<string, any>): boolean {
    return properties.cluster === true
        || properties.cluster === 'true'
        || parseNumericProperty(properties.cluster_id) !== null
        || parseNumericProperty(properties.point_count) !== null;
}

function parseNumericProperty(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === 'string' && value.trim() !== '') {
        const parsedValue = Number(value);
        if (Number.isFinite(parsedValue)) {
            return parsedValue;
        }
    }

    return null;
}

function getFeatureSourceId(feature: MapGeoJSONFeature): string | null {
    if (typeof feature.source === 'string' && feature.source !== '') {
        return feature.source;
    }

    if (typeof feature.layer?.source === 'string' && feature.layer.source !== '') {
        return feature.layer.source;
    }

    return null;
}

function getPointFeatureCoordinates(feature: MapGeoJSONFeature): [number, number] | null {
    if (feature.geometry.type !== 'Point') {
        return null;
    }

    const { coordinates } = feature.geometry;
    if (!Array.isArray(coordinates) || coordinates.length < 2) {
        return null;
    }

    const [lng, lat] = coordinates;
    if (typeof lng !== 'number' || typeof lat !== 'number') {
        return null;
    }

    return [lng, lat];
}

async function zoomToClusterFeature(map: maplibregl.Map, feature: MapGeoJSONFeature) {
    const properties = getFeatureProperties(feature);
    const sourceId = getFeatureSourceId(feature);
    const clusterId = parseNumericProperty(properties.cluster_id);
    const center = getPointFeatureCoordinates(feature);

    if (!sourceId || clusterId === null || !center) {
        console.warn('Could not zoom to cluster because the clicked feature is missing a source id, cluster id, or point geometry.', feature);
        return;
    }

    const source = map.getSource(sourceId) as GeoJSONSource | undefined;
    if (!source || typeof source.getClusterExpansionZoom !== 'function') {
        console.warn(`Could not zoom to cluster because source "${sourceId}" is not a clustered GeoJSON source.`, feature);
        return;
    }

    try {
        const expansionZoom = await source.getClusterExpansionZoom(clusterId);
        map.easeTo({ center, zoom: expansionZoom });
    } catch (error) {
        console.warn(`Could not resolve expansion zoom for cluster "${clusterId}" in source "${sourceId}".`, error);
    }
}

function createInitialMapStyle(config: AppConfig): AppConfig {
    const initialMapStyle = cloneJson(config);

    if (Array.isArray(initialMapStyle.layers)) {
        initialMapStyle.layers = initialMapStyle.layers.map((layer: any) => {
            if (!layer || typeof layer !== 'object') {
                return layer;
            }

            return {
                ...layer,
                layout: {
                    ...(layer.layout ?? {}),
                    visibility: 'none'
                }
            };
        });
    }

    return initialMapStyle;
}

function buildBackgroundCatalog(config: AppConfig): BackgroundCatalog {
    const topLayerDefinitions = new Map<string, any>();
    const importConfigs = new Map<string, StyleImportConfig>();
    const backgroundDefinitions = new Map<string, BackgroundLayerDefinition>();
    const backgroundEntries: BackgroundLayerConfig[] = [];
    const dataLayerEntries: DataLayerConfig[] = [];
    const dataLayerConfigs = new Map<string, DataLayerConfig>();
    const importEntries = Array.isArray(config.customUi?.imports) ? config.customUi.imports : [];
    const rawBackgroundEntries = Array.isArray(config.customUi?.backgroundLayers) ? config.customUi.backgroundLayers : [];
    const rawDataLayerEntries = Array.isArray(config.customUi?.dataLayers) ? config.customUi.dataLayers : [];
    const layers = Array.isArray(config.layers) ? config.layers : [];

    for (const layer of layers) {
        if (!layer || typeof layer.id !== 'string') {
            continue;
        }

        if (topLayerDefinitions.has(layer.id)) {
            console.warn(`Duplicate top-level layer id "${layer.id}" found in config.layers. Keeping the first definition.`);
            continue;
        }

        topLayerDefinitions.set(layer.id, layer);
    }

    for (const importConfig of importEntries) {
        if (!importConfig || typeof importConfig.id !== 'string' || typeof importConfig.url !== 'string') {
            console.warn('Ignoring invalid customUi.imports entry because it is missing a string id or url.', importConfig);
            continue;
        }

        if (topLayerDefinitions.has(importConfig.id) || importConfigs.has(importConfig.id)) {
            console.warn(`Ignoring imported style "${importConfig.id}" because that id is already used elsewhere in the style.`);
            continue;
        }

        importConfigs.set(importConfig.id, importConfig);
    }

    for (const backgroundEntry of rawBackgroundEntries) {
        if (!backgroundEntry || typeof backgroundEntry.id !== 'string' || typeof backgroundEntry.name !== 'string' || !Array.isArray(backgroundEntry.layerIds)) {
            console.warn('Ignoring invalid customUi.backgroundLayers entry because it is missing a string id, string name, or layerIds array.', backgroundEntry);
            continue;
        }

        if (backgroundDefinitions.has(backgroundEntry.id)) {
            console.warn(`Ignoring duplicate customUi.backgroundLayers entry "${backgroundEntry.id}".`);
            continue;
        }

        const resolvedLayerIds = uniqueInOrder(
            backgroundEntry.layerIds
                .filter((layerId): layerId is string => typeof layerId === 'string')
                .filter((layerId) => {
                    if (topLayerDefinitions.has(layerId) || importConfigs.has(layerId)) {
                        return true;
                    }

                    console.warn(`Ignoring unknown background layer member "${layerId}" inside background layer "${backgroundEntry.id}".`);
                    return false;
                })
        );

        const normalizedBackgroundEntry = {
            ...backgroundEntry,
            layerIds: resolvedLayerIds
        };

        backgroundEntries.push(normalizedBackgroundEntry);
        backgroundDefinitions.set(normalizedBackgroundEntry.id, {
            id: normalizedBackgroundEntry.id,
            memberIds: normalizedBackgroundEntry.layerIds
        });
    }

    for (const dataLayer of rawDataLayerEntries) {
        if (!dataLayer || typeof dataLayer.id !== 'string' || typeof dataLayer.name !== 'string' || !Array.isArray(dataLayer.layerIds)) {
            console.warn('Ignoring invalid customUi.dataLayers entry because it is missing a string id, string name, or layerIds array.', dataLayer);
            continue;
        }

        if (dataLayerConfigs.has(dataLayer.id)) {
            console.warn(`Ignoring duplicate customUi.dataLayers entry "${dataLayer.id}".`);
            continue;
        }

        const resolvedLayerIds = uniqueInOrder(
            dataLayer.layerIds
                .filter((layerId): layerId is string => typeof layerId === 'string')
                .filter((layerId) => {
                    if (topLayerDefinitions.has(layerId)) {
                        return true;
                    }

                    console.warn(`Ignoring unknown data layer member "${layerId}" inside data layer "${dataLayer.id}".`);
                    return false;
                })
        );

        const normalizedDataLayer = {
            ...dataLayer,
            layerIds: resolvedLayerIds
        };

        dataLayerEntries.push(normalizedDataLayer);
        dataLayerConfigs.set(normalizedDataLayer.id, normalizedDataLayer);
    }

    const backgroundManagedLayerIds = new Set<string>();
    const overlappingLayerIds = new Set<string>();

    for (const backgroundEntry of backgroundEntries) {
        for (const layerId of backgroundEntry.layerIds) {
            if (topLayerDefinitions.has(layerId)) {
                backgroundManagedLayerIds.add(layerId);
            }
        }
    }

    for (const dataLayer of dataLayerEntries) {
        for (const layerId of dataLayer.layerIds) {
            if (backgroundManagedLayerIds.has(layerId)) {
                overlappingLayerIds.add(layerId);
            }
        }
    }

    if (overlappingLayerIds.size > 0) {
        console.warn(
            `Top-style layers ${[...overlappingLayerIds].map((layerId) => `"${layerId}"`).join(', ')} are referenced by both customUi.backgroundLayers and customUi.dataLayers. This configuration is unsupported, and those layer ids will be ignored.`
        );

        for (const backgroundEntry of backgroundEntries) {
            const filteredLayerIds = backgroundEntry.layerIds.filter((layerId) => !overlappingLayerIds.has(layerId));
            backgroundEntry.layerIds = filteredLayerIds;
            const definition = backgroundDefinitions.get(backgroundEntry.id);
            if (definition) {
                definition.memberIds = filteredLayerIds;
            }
        }

        for (const dataLayer of dataLayerEntries) {
            dataLayer.layerIds = dataLayer.layerIds.filter((layerId) => !overlappingLayerIds.has(layerId));
        }
    }

    const managedTopLayerIds = new Set<string>();
    for (const backgroundEntry of backgroundEntries) {
        for (const layerId of backgroundEntry.layerIds) {
            if (topLayerDefinitions.has(layerId)) {
                managedTopLayerIds.add(layerId);
            }
        }
    }

    const overlayBoundaryId = layers.find((layer) => layer && typeof layer.id === 'string' && !managedTopLayerIds.has(layer.id))?.id;

    return {
        backgroundEntries,
        backgroundDefinitions,
        dataLayerEntries,
        dataLayerConfigs,
        clickableLayerIds: uniqueInOrder(
            dataLayerEntries
                .filter((dataLayer) => dataLayer.interactive)
                .flatMap((dataLayer) => dataLayer.layerIds)
        ),
        importConfigs,
        topLayerDefinitions,
        topSourceDefinitions: config.sources ?? {},
        managedTopLayerIds,
        overlayBoundaryId,
        initialSelection: determineInitialBackgroundSelection(backgroundEntries),
        initialVisibleDataLayerIds: getInitialVisibleDataLayerIds(dataLayerEntries),
        topStyleGlyphsUrl: config.glyphs
    };
}

function determineInitialBackgroundSelection(backgroundEntries: BackgroundLayerConfig[]): string {
    const explicitlyVisibleEntries = backgroundEntries.filter((layer) => layer.visible);
    if (explicitlyVisibleEntries.length > 1) {
        console.warn(`Multiple backgroundLayers entries declare "visible: true". Using "${explicitlyVisibleEntries[0].id}".`);
    }
    if (explicitlyVisibleEntries.length > 0) {
        return explicitlyVisibleEntries[0].id;
    }

    return backgroundEntries[0]?.id ?? '';
}

function getInitialVisibleDataLayerIds(dataLayerEntries: DataLayerConfig[]): Set<string> {
    const visibleData = new Set<string>();
    dataLayerEntries.forEach((dataLayer: DataLayerConfig) => {
        if (dataLayer.visible !== false) {
            visibleData.add(dataLayer.id);
        }
    });

    return visibleData;
}

function getImportInfo(runtime: BackgroundRuntimeState, importId: string): MapVibeImportInfo | null {
    const importInfo = runtime.imports.get(importId);
    if (!importInfo) {
        return null;
    }

    return {
        id: importInfo.id,
        url: importInfo.url,
        layerIds: [...importInfo.layerIds],
        sourceIds: [...importInfo.sourceIds],
        spriteIds: [...importInfo.spriteIds],
        glyphsUrl: importInfo.glyphsUrl
    };
}

function getBackgroundLayerIds(backgroundId: string, catalog: BackgroundCatalog, runtime: BackgroundRuntimeState): string[] {
    return uniqueInOrder(resolveBackgroundLayerIds(backgroundId, catalog, runtime));
}

function resolveBackgroundLayerIds(backgroundId: string, catalog: BackgroundCatalog, runtime: BackgroundRuntimeState): string[] {
    const definition = catalog.backgroundDefinitions.get(backgroundId);
    if (!definition) {
        return [];
    }

    const layerIds: string[] = [];
    for (const memberId of definition.memberIds) {
        if (catalog.topLayerDefinitions.has(memberId)) {
            layerIds.push(memberId);
            continue;
        }

        if (catalog.importConfigs.has(memberId)) {
            layerIds.push(...(runtime.imports.get(memberId)?.layerIds ?? []));
        }
    }

    return layerIds;
}

function applyBackgroundSelection(
    map: maplibregl.Map,
    backgroundId: string,
    catalog: BackgroundCatalog,
    runtime: BackgroundRuntimeState,
    chooserConfig: CustomUiConfig
) {
    hideAllManagedBackgroundTargets(map, catalog, runtime);

    const resolvedLayerIds = getBackgroundLayerIds(backgroundId, catalog, runtime);
    const boundaryId = catalog.overlayBoundaryId && map.getLayer(catalog.overlayBoundaryId) ? catalog.overlayBoundaryId : undefined;

    for (const layerId of resolvedLayerIds) {
        if (map.getLayer(layerId)) {
            map.moveLayer(layerId, boundaryId);
        }
    }

    for (const layerId of resolvedLayerIds) {
        const importInfo = findImportForLayerId(runtime, layerId);
        if (importInfo) {
            const visibility = importInfo.originalVisibilityByLayerId.get(layerId) ?? 'visible';
            if (map.getLayer(layerId)) {
                map.setLayoutProperty(layerId, 'visibility', visibility);
            }
        } else if (catalog.topLayerDefinitions.has(layerId) && map.getLayer(layerId)) {
            map.setLayoutProperty(layerId, 'visibility', 'visible');
        }
    }

    map.setGlyphs(resolveBackgroundGlyphsUrl(backgroundId, catalog, runtime) ?? undefined);

    const { minZoom, maxZoom } = getBackgroundZoomBounds(backgroundId, catalog, runtime, chooserConfig);
    const currentZoom = map.getZoom();
    map.setMinZoom(minZoom ?? null);
    map.setMaxZoom(maxZoom ?? null);

    if (maxZoom !== undefined && currentZoom > maxZoom) {
        map.zoomTo(maxZoom);
    } else if (minZoom !== undefined && currentZoom < minZoom) {
        map.zoomTo(minZoom);
    }
}

function applyDataLayerVisibilitySelection(
    map: maplibregl.Map,
    catalog: BackgroundCatalog,
    visibleDataLayerIds: Set<string>
) {
    for (const dataLayer of catalog.dataLayerEntries) {
        setDataLayerVisibility(map, dataLayer, visibleDataLayerIds.has(dataLayer.id));
    }
}

function setDataLayerVisibility(map: maplibregl.Map, dataLayer: DataLayerConfig, visible: boolean) {
    dataLayer.layerIds.forEach((layerId) => {
        if (map.getLayer(layerId)) {
            map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
        }
    });
}

function hideAllManagedBackgroundTargets(map: maplibregl.Map, catalog: BackgroundCatalog, runtime: BackgroundRuntimeState) {
    for (const layerId of catalog.managedTopLayerIds) {
        if (map.getLayer(layerId)) {
            map.setLayoutProperty(layerId, 'visibility', 'none');
        }
    }

    for (const importInfo of runtime.imports.values()) {
        hideImportedBackground(map, importInfo);
    }
}

function hideImportedBackground(map: maplibregl.Map, importInfo: RuntimeImportInfo) {
    for (const layerId of importInfo.layerIds) {
        if (map.getLayer(layerId)) {
            map.setLayoutProperty(layerId, 'visibility', 'none');
        }
    }
}

function findImportForLayerId(runtime: BackgroundRuntimeState, layerId: string): RuntimeImportInfo | undefined {
    for (const importInfo of runtime.imports.values()) {
        if (importInfo.layerDefinitions.has(layerId)) {
            return importInfo;
        }
    }

    return undefined;
}

function resolveBackgroundGlyphsUrl(backgroundId: string, catalog: BackgroundCatalog, runtime: BackgroundRuntimeState): string | undefined {
    const definition = catalog.backgroundDefinitions.get(backgroundId);
    if (!definition) {
        return catalog.topStyleGlyphsUrl;
    }

    const glyphUrls: string[] = [];
    for (const memberId of definition.memberIds) {
        const importInfo = runtime.imports.get(memberId);
        if (importInfo?.glyphsUrl) {
            glyphUrls.push(importInfo.glyphsUrl);
        }
    }

    const distinctGlyphUrls = uniqueInOrder(glyphUrls);
    if (distinctGlyphUrls.length > 1) {
        console.warn(`Background layer "${backgroundId}" uses multiple imported glyph URLs. Using the last imported style's glyphs URL.`);
    }

    return glyphUrls[glyphUrls.length - 1] ?? catalog.topStyleGlyphsUrl;
}

function getBackgroundZoomBounds(
    backgroundId: string,
    catalog: BackgroundCatalog,
    runtime: BackgroundRuntimeState,
    chooserConfig: CustomUiConfig
) {
    const layerIds = getBackgroundLayerIds(backgroundId, catalog, runtime);

    for (const layerId of layerIds) {
        const layerDefinition = catalog.topLayerDefinitions.get(layerId);
        const sourceName = layerDefinition?.source;
        const sourceDef = sourceName ? catalog.topSourceDefinitions[sourceName] : undefined;
        if (sourceDef) {
            return getClampedZoomBounds(sourceDef, chooserConfig);
        }
    }

    return getClampedZoomBounds({}, chooserConfig);
}

async function loadBackgroundImport(
    importConfig: StyleImportConfig,
    catalogRef: React.MutableRefObject<BackgroundCatalog>,
    runtimeRef: React.MutableRefObject<BackgroundRuntimeState>,
    mapRef: React.RefObject<MapInstanceHandle | null>,
    selectedBackgroundLayerRef: React.MutableRefObject<string>,
    applySelectedBackground: (backgroundId: string, options?: { updateState?: boolean; closeChooser?: boolean }) => void
) {
    const runtime = runtimeRef.current;
    if (runtime.imports.has(importConfig.id) || runtime.loadingImports.has(importConfig.id)) {
        return;
    }

    runtime.loadingImports.add(importConfig.id);

    try {
        const response = await fetch(importConfig.url);
        if (!response.ok) {
            throw new Error(`Failed to fetch imported style "${importConfig.id}": ${response.status} ${response.statusText}`);
        }

        const styleDocument = await response.json();
        const runtimeImportInfo = normalizeImportedStyle(importConfig, styleDocument);

        const map = mapRef.current?.getMap();
        if (!map) {
            return;
        }

        materializeImportedStyle(map, runtimeImportInfo, catalogRef.current.overlayBoundaryId);
        runtime.imports.set(importConfig.id, runtimeImportInfo);

        if (backgroundSelectionIncludesImport(selectedBackgroundLayerRef.current, importConfig.id, catalogRef.current)) {
            applySelectedBackground(selectedBackgroundLayerRef.current, { updateState: false, closeChooser: false });
        }
    } catch (error) {
        console.warn(`Could not load imported style "${importConfig.id}" from ${importConfig.url}.`, error);
    } finally {
        runtime.loadingImports.delete(importConfig.id);
    }
}

function backgroundSelectionIncludesImport(backgroundId: string, importId: string, catalog: BackgroundCatalog): boolean {
    return catalog.backgroundDefinitions.get(backgroundId)?.memberIds.includes(importId) ?? false;
}

function normalizeImportedStyle(importConfig: StyleImportConfig, styleDocument: any): RuntimeImportInfo {
    const namespacePrefix = `${IMPORT_NAMESPACE_PREFIX}${importConfig.id}_`;
    const sourceDefinitions = new Map<string, any>();
    const layerDefinitions = new Map<string, any>();
    const originalVisibilityByLayerId = new Map<string, LayerVisibility>();
    const layerIds: string[] = [];

    const spriteMapping = normalizeSpriteConfiguration(styleDocument?.sprite, importConfig.url, namespacePrefix);
    const glyphsUrl = typeof styleDocument?.glyphs === 'string' ? resolveMaybeRelativeUrl(styleDocument.glyphs, importConfig.url) : undefined;

    for (const [sourceId, sourceDefinition] of Object.entries(styleDocument?.sources ?? {})) {
        if (typeof sourceId !== 'string' || !sourceDefinition || typeof sourceDefinition !== 'object') {
            continue;
        }

        const nextSourceDefinition = cloneJson(sourceDefinition);
        rebaseSourceUrls(nextSourceDefinition, importConfig.url);
        sourceDefinitions.set(`${namespacePrefix}${sourceId}`, nextSourceDefinition);
    }

    for (const layerDefinition of Array.isArray(styleDocument?.layers) ? styleDocument.layers : []) {
        if (!layerDefinition || typeof layerDefinition.id !== 'string') {
            continue;
        }

        const originalLayerId = layerDefinition.id;
        const nextLayerId = `${namespacePrefix}${originalLayerId}`;
        const nextLayerDefinition = cloneJson(layerDefinition);

        if (typeof nextLayerDefinition.source === 'string') {
            nextLayerDefinition.source = `${namespacePrefix}${nextLayerDefinition.source}`;
        }

        if (typeof nextLayerDefinition.ref === 'string') {
            nextLayerDefinition.ref = `${namespacePrefix}${nextLayerDefinition.ref}`;
        }

        if (Array.isArray(nextLayerDefinition.filter)) {
            nextLayerDefinition.filter = rewriteImportedFilterExpression(nextLayerDefinition.filter);
        }

        rewriteLayerImageReferences(nextLayerDefinition, spriteMapping);

        const originalVisibility = nextLayerDefinition.layout?.visibility === 'none' ? 'none' : 'visible';
        originalVisibilityByLayerId.set(nextLayerId, originalVisibility);

        nextLayerDefinition.id = nextLayerId;
        nextLayerDefinition.layout = {
            ...(nextLayerDefinition.layout ?? {}),
            visibility: 'none'
        };

        layerDefinitions.set(nextLayerId, nextLayerDefinition);
        layerIds.push(nextLayerId);
    }

    return {
        id: importConfig.id,
        url: importConfig.url,
        layerIds,
        sourceIds: [...sourceDefinitions.keys()],
        spriteIds: [...spriteMapping.urls.keys()],
        glyphsUrl,
        originalVisibilityByLayerId,
        sourceDefinitions,
        layerDefinitions,
        spriteUrls: spriteMapping.urls
    };
}

function materializeImportedStyle(map: maplibregl.Map, importInfo: RuntimeImportInfo, beforeId?: string) {
    const currentSpriteIds = new Set(map.getSprite().map((sprite) => sprite.id));

    for (const [spriteId, spriteUrl] of importInfo.spriteUrls.entries()) {
        if (!currentSpriteIds.has(spriteId)) {
            map.addSprite(spriteId, spriteUrl);
        }
    }

    for (const [sourceId, sourceDefinition] of importInfo.sourceDefinitions.entries()) {
        if (!map.getSource(sourceId)) {
            map.addSource(sourceId, sourceDefinition);
        }
    }

    for (const layerId of importInfo.layerIds) {
        const layerDefinition = importInfo.layerDefinitions.get(layerId);
        if (!layerDefinition || map.getLayer(layerId)) {
            continue;
        }

        map.addLayer(layerDefinition, beforeId);
    }
}

function cleanupImportedBackgrounds(map: maplibregl.Map, runtime: BackgroundRuntimeState, catalog: BackgroundCatalog) {
    for (const importInfo of runtime.imports.values()) {
        for (const layerId of [...importInfo.layerIds].reverse()) {
            if (map.getLayer(layerId)) {
                map.removeLayer(layerId);
            }
        }

        for (const sourceId of importInfo.sourceIds) {
            if (map.getSource(sourceId)) {
                map.removeSource(sourceId);
            }
        }

        const currentSpriteIds = new Set(map.getSprite().map((sprite) => sprite.id));
        for (const spriteId of importInfo.spriteIds) {
            if (currentSpriteIds.has(spriteId)) {
                map.removeSprite(spriteId);
            }
        }
    }

    runtime.imports.clear();
    runtime.loadingImports.clear();
    map.setGlyphs(catalog.topStyleGlyphsUrl ?? undefined);
}

function normalizeSpriteConfiguration(spriteConfig: SpriteConfig, baseUrl: string, namespacePrefix: string): SpriteMapping {
    const ids = new Map<string, string>();
    const urls = new Map<string, string>();
    let defaultSpriteId: string | undefined;

    if (typeof spriteConfig === 'string') {
        const runtimeSpriteId = `${namespacePrefix}${DEFAULT_IMPORTED_SPRITE_ID}`;
        ids.set(DEFAULT_IMPORTED_SPRITE_ID, runtimeSpriteId);
        urls.set(runtimeSpriteId, resolveMaybeRelativeUrl(spriteConfig, baseUrl));
        defaultSpriteId = runtimeSpriteId;
    } else if (Array.isArray(spriteConfig)) {
        for (const spriteEntry of spriteConfig) {
            if (!spriteEntry || typeof spriteEntry.id !== 'string' || typeof spriteEntry.url !== 'string') {
                continue;
            }

            const runtimeSpriteId = `${namespacePrefix}${spriteEntry.id}`;
            ids.set(spriteEntry.id, runtimeSpriteId);
            urls.set(runtimeSpriteId, resolveMaybeRelativeUrl(spriteEntry.url, baseUrl));

            if (spriteEntry.id === DEFAULT_IMPORTED_SPRITE_ID) {
                defaultSpriteId = runtimeSpriteId;
            }
        }
    }

    return { ids, urls, defaultSpriteId };
}

function rebaseSourceUrls(sourceDefinition: any, baseUrl: string) {
    if (!sourceDefinition || typeof sourceDefinition !== 'object') {
        return;
    }

    if (typeof sourceDefinition.url === 'string') {
        sourceDefinition.url = resolveMaybeRelativeUrl(sourceDefinition.url, baseUrl);
    }

    if (typeof sourceDefinition.data === 'string') {
        sourceDefinition.data = resolveMaybeRelativeUrl(sourceDefinition.data, baseUrl);
    }

    if (typeof sourceDefinition.sprite === 'string') {
        sourceDefinition.sprite = resolveMaybeRelativeUrl(sourceDefinition.sprite, baseUrl);
    }

    if (typeof sourceDefinition.glyphs === 'string') {
        sourceDefinition.glyphs = resolveMaybeRelativeUrl(sourceDefinition.glyphs, baseUrl);
    }

    if (typeof sourceDefinition.attribution === 'string') {
        sourceDefinition.attribution = sourceDefinition.attribution;
    }

    if (Array.isArray(sourceDefinition.tiles)) {
        sourceDefinition.tiles = sourceDefinition.tiles.map((tileUrl: any) =>
            typeof tileUrl === 'string' ? resolveMaybeRelativeUrl(tileUrl, baseUrl) : tileUrl
        );
    }

    if (Array.isArray(sourceDefinition.urls)) {
        sourceDefinition.urls = sourceDefinition.urls.map((item: any) =>
            typeof item === 'string' ? resolveMaybeRelativeUrl(item, baseUrl) : item
        );
    }
}

function rewriteLayerImageReferences(layerDefinition: any, spriteMapping: SpriteMapping) {
    for (const propertyName of RESOLVED_IMAGE_PROPERTIES) {
        if (layerDefinition.layout && propertyName in layerDefinition.layout) {
            layerDefinition.layout[propertyName] = rewriteResolvedImageValue(layerDefinition.layout[propertyName], spriteMapping);
        }

        if (layerDefinition.paint && propertyName in layerDefinition.paint) {
            layerDefinition.paint[propertyName] = rewriteResolvedImageValue(layerDefinition.paint[propertyName], spriteMapping);
        }
    }
}

function rewriteImportedFilterExpression(value: any): any {
    if (!Array.isArray(value) || value.length === 0) {
        return value;
    }

    const directGetPropertyName = getDirectGetPropertyNameForNumericComparison(value);
    if (directGetPropertyName) {
        const fallback = value[0] === '!=' ? true : false;
        return ['case', ['has', directGetPropertyName], value, fallback];
    }

    return value.map((item) => Array.isArray(item) ? rewriteImportedFilterExpression(item) : item);
}

function getDirectGetPropertyNameForNumericComparison(value: any[]): string | null {
    const operator = typeof value[0] === 'string' ? value[0] : undefined;
    if (!operator || !['<', '<=', '>', '>=', '==', '!='].includes(operator)) {
        return null;
    }

    if (typeof value[1] === 'number') {
        return getDirectGetPropertyName(value[2]);
    }

    if (typeof value[2] === 'number') {
        return getDirectGetPropertyName(value[1]);
    }

    return null;
}

function getDirectGetPropertyName(value: any): string | null {
    if (!Array.isArray(value) || value[0] !== 'get' || typeof value[1] !== 'string') {
        return null;
    }

    return value[1];
}

function rewriteResolvedImageValue(value: any, spriteMapping: SpriteMapping): any {
    if (typeof value === 'string') {
        return prefixImageStringReference(value, spriteMapping);
    }

    if (!Array.isArray(value)) {
        return value;
    }

    const operator = typeof value[0] === 'string' ? value[0] : undefined;
    if (operator === 'image') {
        if (value.length < 2) {
            return value;
        }

        const nextValue = [...value];
        nextValue[1] = rewriteResolvedImageStringExpression(nextValue[1], spriteMapping);
        return nextValue;
    }

    if (operator === 'step') {
        return rewriteStepResolvedImageExpression(value, spriteMapping, rewriteResolvedImageValue);
    }

    if (operator === 'interpolate') {
        return rewriteInterpolateResolvedImageExpression(value, spriteMapping, rewriteResolvedImageValue);
    }

    if (operator === 'case') {
        return rewriteCaseResolvedImageExpression(value, spriteMapping, rewriteResolvedImageValue);
    }

    if (operator === 'match') {
        return rewriteMatchResolvedImageExpression(value, spriteMapping, rewriteResolvedImageValue);
    }

    if (operator === 'coalesce') {
        return rewriteCoalesceResolvedImageExpression(value, spriteMapping, rewriteResolvedImageValue);
    }

    if (operator === 'let') {
        return rewriteLetResolvedImageExpression(value, spriteMapping, rewriteResolvedImageValue);
    }

    if (expressionContainsOperator(value, 'image')) {
        return rewriteNestedResolvedImageExpression(value, spriteMapping);
    }

    return prefixStringExpression(value, spriteMapping);
}

function rewriteNestedResolvedImageExpression(value: any, spriteMapping: SpriteMapping): any {
    if (!Array.isArray(value)) {
        return value;
    }

    const operator = typeof value[0] === 'string' ? value[0] : undefined;
    if (operator === 'image') {
        if (value.length < 2) {
            return value;
        }

        const nextValue = [...value];
        nextValue[1] = rewriteResolvedImageStringExpression(nextValue[1], spriteMapping);
        return nextValue;
    }

    return value.map((item) => Array.isArray(item) ? rewriteNestedResolvedImageExpression(item, spriteMapping) : item);
}

function rewriteResolvedImageStringExpression(value: any, spriteMapping: SpriteMapping): any {
    if (typeof value === 'string') {
        return prefixImageStringReference(value, spriteMapping);
    }

    if (!Array.isArray(value)) {
        return value;
    }

    const operator = typeof value[0] === 'string' ? value[0] : undefined;
    if (operator === 'step') {
        return rewriteStepResolvedImageExpression(value, spriteMapping, rewriteResolvedImageStringExpression);
    }

    if (operator === 'interpolate') {
        return rewriteInterpolateResolvedImageExpression(value, spriteMapping, rewriteResolvedImageStringExpression);
    }

    if (operator === 'case') {
        return rewriteCaseResolvedImageExpression(value, spriteMapping, rewriteResolvedImageStringExpression);
    }

    if (operator === 'match') {
        return rewriteMatchResolvedImageExpression(value, spriteMapping, rewriteResolvedImageStringExpression);
    }

    if (operator === 'coalesce') {
        return rewriteCoalesceResolvedImageExpression(value, spriteMapping, rewriteResolvedImageStringExpression);
    }

    if (operator === 'let') {
        return rewriteLetResolvedImageExpression(value, spriteMapping, rewriteResolvedImageStringExpression);
    }

    return prefixStringExpression(value, spriteMapping);
}

function rewriteStepResolvedImageExpression(
    value: any[],
    spriteMapping: SpriteMapping,
    rewriteValue: (branchValue: any, branchSpriteMapping: SpriteMapping) => any
): any {
    if (value.length < 3) {
        return value;
    }

    const nextValue = [...value];
    nextValue[2] = rewriteValue(nextValue[2], spriteMapping);

    for (let index = 4; index < nextValue.length; index += 2) {
        nextValue[index] = rewriteValue(nextValue[index], spriteMapping);
    }

    return nextValue;
}

function rewriteInterpolateResolvedImageExpression(
    value: any[],
    spriteMapping: SpriteMapping,
    rewriteValue: (branchValue: any, branchSpriteMapping: SpriteMapping) => any
): any {
    if (value.length < 5) {
        return value;
    }

    const nextValue = [...value];
    for (let index = 4; index < nextValue.length; index += 2) {
        nextValue[index] = rewriteValue(nextValue[index], spriteMapping);
    }

    return nextValue;
}

function rewriteCaseResolvedImageExpression(
    value: any[],
    spriteMapping: SpriteMapping,
    rewriteValue: (branchValue: any, branchSpriteMapping: SpriteMapping) => any
): any {
    if (value.length < 2) {
        return value;
    }

    const nextValue = [...value];
    for (let index = 2; index < nextValue.length - 1; index += 2) {
        nextValue[index] = rewriteValue(nextValue[index], spriteMapping);
    }

    nextValue[nextValue.length - 1] = rewriteValue(nextValue[nextValue.length - 1], spriteMapping);
    return nextValue;
}

function rewriteMatchResolvedImageExpression(
    value: any[],
    spriteMapping: SpriteMapping,
    rewriteValue: (branchValue: any, branchSpriteMapping: SpriteMapping) => any
): any {
    if (value.length < 3) {
        return value;
    }

    const nextValue = [...value];
    for (let index = 3; index < nextValue.length - 1; index += 2) {
        nextValue[index] = rewriteValue(nextValue[index], spriteMapping);
    }

    nextValue[nextValue.length - 1] = rewriteValue(nextValue[nextValue.length - 1], spriteMapping);
    return nextValue;
}

function rewriteCoalesceResolvedImageExpression(
    value: any[],
    spriteMapping: SpriteMapping,
    rewriteValue: (branchValue: any, branchSpriteMapping: SpriteMapping) => any
): any {
    if (value.length < 2) {
        return value;
    }

    const nextValue = [...value];
    for (let index = 1; index < nextValue.length; index += 1) {
        nextValue[index] = rewriteValue(nextValue[index], spriteMapping);
    }

    return nextValue;
}

function rewriteLetResolvedImageExpression(
    value: any[],
    spriteMapping: SpriteMapping,
    rewriteValue: (branchValue: any, branchSpriteMapping: SpriteMapping) => any
): any {
    if (value.length < 2) {
        return value;
    }

    const nextValue = [...value];
    for (let index = 2; index < nextValue.length - 1; index += 2) {
        nextValue[index] = rewriteValue(nextValue[index], spriteMapping);
    }

    nextValue[nextValue.length - 1] = rewriteValue(nextValue[nextValue.length - 1], spriteMapping);
    return nextValue;
}

function expressionContainsOperator(value: any, operator: string): boolean {
    if (!Array.isArray(value) || value.length === 0) {
        return false;
    }

    if (value[0] === operator) {
        return true;
    }

    return value.some((item) => Array.isArray(item) && expressionContainsOperator(item, operator));
}

function prefixStringExpression(value: any, spriteMapping: SpriteMapping): any {
    if (typeof value === 'string') {
        return prefixImageStringReference(value, spriteMapping);
    }

    if (!spriteMapping.defaultSpriteId) {
        return value;
    }

    return prependToStringExpression(`${spriteMapping.defaultSpriteId}:`, value);
}

function prefixImageStringReference(value: string, spriteMapping: SpriteMapping): any {
    if (value === '') {
        return value;
    }

    const resolvedReference = resolveSpriteReference(value, spriteMapping);
    if (!resolvedReference) {
        return value;
    }

    const imageExpression = resolvedReference.imageReference.includes('{')
        ? tokenStringToExpression(resolvedReference.imageReference)
        : resolvedReference.imageReference;

    return prependToStringExpression(`${resolvedReference.spriteId}:`, imageExpression);
}

function resolveSpriteReference(value: string, spriteMapping: SpriteMapping): { spriteId: string; imageReference: string } | null {
    const firstColonIndex = value.indexOf(':');
    if (firstColonIndex > 0) {
        const candidateSpriteId = value.slice(0, firstColonIndex);
        const mappedSpriteId = spriteMapping.ids.get(candidateSpriteId);
        if (mappedSpriteId) {
            return {
                spriteId: mappedSpriteId,
                imageReference: value.slice(firstColonIndex + 1)
            };
        }
    }

    if (!spriteMapping.defaultSpriteId) {
        return null;
    }

    return {
        spriteId: spriteMapping.defaultSpriteId,
        imageReference: value
    };
}

function tokenStringToExpression(value: string): any {
    const parts: any[] = [];
    const tokenPattern = /\{([^}]+)\}/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null = null;

    while ((match = tokenPattern.exec(value)) !== null) {
        const literalPart = value.slice(lastIndex, match.index);
        if (literalPart) {
            parts.push(literalPart);
        }

        parts.push(['coalesce', ['to-string', ['get', match[1]]], '']);
        lastIndex = match.index + match[0].length;
    }

    const trailingLiteral = value.slice(lastIndex);
    if (trailingLiteral) {
        parts.push(trailingLiteral);
    }

    if (parts.length === 0) {
        return value;
    }

    if (parts.length === 1) {
        return parts[0];
    }

    return ['concat', ...parts];
}

function prependToStringExpression(prefix: string, value: any): any {
    if (typeof value === 'string') {
        return `${prefix}${value}`;
    }

    if (Array.isArray(value) && value[0] === 'concat') {
        return ['concat', prefix, ...value.slice(1)];
    }

    return ['concat', prefix, value];
}

function resolveMaybeRelativeUrl(value: string, baseUrl: string): string {
    if (!value) {
        return value;
    }

    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value) || value.startsWith('//')) {
        return value;
    }

    try {
        return new URL(value, baseUrl).href;
    } catch {
        return value;
    }
}

function uniqueInOrder<T>(items: T[]): T[] {
    const result: T[] = [];
    const seen = new Set<T>();

    for (const item of items) {
        if (seen.has(item)) {
            continue;
        }

        seen.add(item);
        result.push(item);
    }

    return result;
}

function cloneJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
}

function extractNumericValues(value: unknown): number[] {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? [value] : [];
    }

    if (Array.isArray(value)) {
        return value
            .map(item => typeof item === 'number' ? item : Number(item))
            .filter(item => Number.isFinite(item));
    }

    if (typeof value === 'string') {
        const matches = value.match(/-?\d*\.?\d+/g);
        if (!matches) {
            return [];
        }

        return matches
            .map(item => Number(item))
            .filter(item => Number.isFinite(item));
    }

    return [];
}

function parseImageSize(value: unknown): [number, number] | undefined {
    const numbers = extractNumericValues(value);
    if (numbers.length !== 2 || numbers.some(item => item <= 0)) {
        return undefined;
    }

    return [numbers[0], numbers[1]];
}

function parseImagePadding(value: unknown): [number, number, number, number] | undefined {
    const numbers = extractNumericValues(value);
    if (numbers.length === 1 && numbers[0] >= 0) {
        return [numbers[0], numbers[0], numbers[0], numbers[0]];
    }

    if (numbers.length === 4 && numbers.every(item => item >= 0)) {
        return [numbers[0], numbers[1], numbers[2], numbers[3]];
    }

    return undefined;
}

function formatBoxSpacing(value?: [number, number, number, number]): string {
    if (!value) {
        return '0px';
    }

    return value.map(item => `${item}px`).join(' ');
}

/**
 * Calculates the bounding box of all GeoJSON sources and fits the map view.
 */
async function fitMapToBounds(map: maplibregl.Map, sources: Record<string, any>) {
    const bounds = new LngLatBounds();
    const geojsonFetches: Promise<any>[] = [];

    for (const sourceName in sources) {
        const source = sources[sourceName];
        if (source.type === 'geojson' && typeof source.data === 'string') {
            const mapSource = map.getSource(sourceName) as maplibregl.GeoJSONSource | undefined;
            if (mapSource && typeof mapSource.getData === 'function') {
                const data = mapSource.getData();
                if (data && typeof data === 'object') {
                    geojsonFetches.push(Promise.resolve(data));
                    continue;
                }
            }

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
            map.fitBounds(bounds, { padding: 100 });
        }
    } catch (error) {
        console.error("Could not fit map to bounds:", error);
    }
}

function getDataLayerForMapLayerId(catalog: BackgroundCatalog, mapLayerId: string): DataLayerConfig | undefined {
    return catalog.dataLayerEntries.find((dataLayer: DataLayerConfig) =>
        dataLayer.layerIds.includes(mapLayerId)
    );
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

function isMobile(): boolean {
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isLikelyMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);
    return hasTouch && isLikelyMobile;
}
