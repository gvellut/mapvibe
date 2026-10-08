import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type * as maplibregl from 'maplibre-gl';
import {
    normalizeRememberLastPosition,
    loadRememberedViewState,
    saveRememberedViewState
} from '../map/rememberLastPosition';
// URL overrides are parsed by App; the new-tab control sets mgc/fs in controls.ts.
import { resolveMapOptions } from '../map/controlConfig';
import { installControls } from '../map/controls';
import type { InfoPanelData, MapVibeMapProps } from '../types';
import { MapCanvas, type MapInstanceHandle } from './MapCanvas';
import { LayerChooser } from './LayerChooser';
import { InfoPanel, parseImageSize, parseImagePadding } from './InfoPanel';
import {
    createBackgroundRuntimeState,
    createInitialMapStyle,
    buildBackgroundCatalog,
    getImportInfo,
    getBackgroundLayerIds,
    applyBackgroundSelection,
    applyDataLayerVisibilitySelection,
    setDataLayerVisibility,
    type BackgroundRuntimeState
} from '../styles/backgrounds';
import { loadBackgroundImport, cleanupImportedBackgrounds } from '../styles/styleImports';
import {
    getInteractiveFeatureActionAtPoint,
    zoomToClusterFeature
} from '../map/featureInteractions';
import { fitMapToBounds, loadCustomImageOnDemand } from '../map/mapResources';

// defined in css: width of map smaller than that : infopanel takes full size
const INFO_PANEL_DESKTOP_WIDTH = 450;

// --- MAP ORCHESTRATION COMPONENT ---
export const MapVibeMap = ({ config, customProtocols, runtimeOptions, ref }: MapVibeMapProps) => {
    // Map options are resolved once, matching the map's initialization-based lifecycle.
    const [resolvedOptions] = useState(() => resolveMapOptions(config.customUi, runtimeOptions));
    const backgroundCatalog = useMemo(() => buildBackgroundCatalog(config), [config]);
    const initialMapStyle = useMemo(() => createInitialMapStyle(config), [config]);
    const backgroundCatalogRef = useRef(backgroundCatalog);
    const configRef = useRef(config);

    const mapRef = useRef<MapInstanceHandle>(null);
    const backgroundRuntimeRef = useRef<BackgroundRuntimeState>(createBackgroundRuntimeState());

    const [layerChooserVisible, setLayerChooserVisible] = useState(false);
    const [layerChooserHost, setLayerChooserHost] = useState<HTMLElement | null>(null);
    const [infoPanelVisible, setInfoPanelVisible] = useState(false);
    const [infoPanelData, setInfoPanelData] = useState<InfoPanelData>({});
    const [selectedBackgroundLayer, setSelectedBackgroundLayer] = useState(
        backgroundCatalog.initialSelection
    );
    const selectedBackgroundLayerRef = useRef(backgroundCatalog.initialSelection);
    const [visibleDataLayers, setVisibleDataLayers] = useState(
        new Set(backgroundCatalog.initialVisibleDataLayerIds)
    );
    const visibleDataLayersRef = useRef(new Set(backgroundCatalog.initialVisibleDataLayerIds));
    const [previousBackgroundCatalog, setPreviousBackgroundCatalog] = useState(backgroundCatalog);

    // Reset chooser state before committing a render with a new configuration.
    if (previousBackgroundCatalog !== backgroundCatalog) {
        setPreviousBackgroundCatalog(backgroundCatalog);
        setSelectedBackgroundLayer(backgroundCatalog.initialSelection);
        setVisibleDataLayers(new Set(backgroundCatalog.initialVisibleDataLayerIds));
    }

    const rememberLastPositionScope = normalizeRememberLastPosition(
        resolvedOptions.rememberLastPosition
    );
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

    // Map callbacks read the latest committed configuration and selection.
    useLayoutEffect(() => {
        backgroundCatalogRef.current = backgroundCatalog;
        configRef.current = config;
    }, [backgroundCatalog, config]);

    useLayoutEffect(() => {
        selectedBackgroundLayerRef.current = selectedBackgroundLayer;
    }, [selectedBackgroundLayer]);

    useLayoutEffect(() => {
        visibleDataLayersRef.current = visibleDataLayers;
    }, [visibleDataLayers]);

    useLayoutEffect(() => {
        backgroundRuntimeRef.current = createBackgroundRuntimeState();
    }, [backgroundCatalog]);

    React.useImperativeHandle(
        ref,
        () => ({
            getMap: () => mapRef.current?.getMap() ?? null,
            getLayerIdsForBackgroundLayer: (id: string) =>
                getBackgroundLayerIds(
                    id,
                    backgroundCatalogRef.current,
                    backgroundRuntimeRef.current
                ),
            getImportInfo: (id: string) => getImportInfo(backgroundRuntimeRef.current, id),
            closeInfoPanel: () => setInfoPanelVisible(false)
        }),
        []
    );

    const applySelectedBackground = useCallback(
        (backgroundId: string, options?: { updateState?: boolean; closeChooser?: boolean }) => {
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
        },
        []
    );

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

    const resolveMissingStyleImage = useCallback(async (imageId: string) => {
        const map = mapRef.current?.getMap();
        const currentConfig = configRef.current;
        if (!map || !currentConfig) return;
        await loadCustomImageOnDemand(map, currentConfig, imageId);
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
        applyDataLayerVisibilitySelection(
            map,
            backgroundCatalogRef.current,
            visibleDataLayersRef.current
        );

        installControls(map, resolvedOptions.controls, setLayerChooserHost);

        map.on('mousemove', (e) => {
            const action = getInteractiveFeatureActionAtPoint(
                map,
                e.point,
                backgroundCatalogRef.current
            );
            map.getCanvas().style.cursor = action ? 'pointer' : '';
        });

        ensureConfiguredImportsLoaded();

        if (
            !hasRememberedViewState &&
            !hasConfiguredCenterZoom &&
            !hasConfiguredBounds &&
            currentConfig.sources
        ) {
            await fitMapToBounds(map, currentConfig.sources);
        }
    }, [
        ensureConfiguredImportsLoaded,
        resolvedOptions.controls,
        hasConfiguredBounds,
        hasConfiguredCenterZoom,
        hasRememberedViewState
    ]);

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

        const action = getInteractiveFeatureActionAtPoint(
            map,
            e.point,
            backgroundCatalogRef.current
        );

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
                console.warn(
                    `Feature in data layer "${action.dataLayer.id}" is missing a string "url" property.`,
                    action.feature
                );
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
            if (
                clickX < coveredLeft ||
                clickX > coveredRight ||
                clickY < coveredTop ||
                clickY > coveredBottom
            ) {
                const visibleWidth = mapWidth - panelWidth;
                const targetX = panelWidth + visibleWidth / 2;
                const targetY = mapHeight / 2;

                const panX = -(targetX - clickX);
                const panY = -(targetY - clickY);

                map.panBy([panX, panY], { duration: 0 });
            }
        }
    }, []);

    const handleBackgroundLayerChange = useCallback(
        (layerId: string) => {
            applySelectedBackground(layerId, { updateState: true, closeChooser: true });
        },
        [applySelectedBackground]
    );

    const handleDataLayerToggle = useCallback((dataLayerId: string, visible: boolean) => {
        const map = mapRef.current?.getMap();
        const dataLayer = backgroundCatalogRef.current.dataLayerConfigs.get(dataLayerId);
        if (!map || !dataLayer) return;

        setVisibleDataLayers((previous) => {
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
        // Retain this mounted map handle for cleanup even if the ref changes later.
        const mapHandle = mapRef.current;
        return () => {
            const map = mapHandle?.getMap();
            if (map) {
                cleanupImportedBackgrounds(
                    map,
                    backgroundRuntimeRef.current,
                    backgroundCatalogRef.current
                );
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
                interaction={resolvedOptions.interaction}
                onLoad={onMapLoad}
                onClick={onMapClick}
                onDrag={() => setLayerChooserVisible(false)}
                onMoveEnd={onMapMoveEnd}
                onDblClick={() => {
                    setInfoPanelVisible(false);
                    setLayerChooserVisible(false);
                }}
                resolveMissingStyleImage={resolveMissingStyleImage}
                customProtocols={customProtocols}
            />

            {layerChooserHost &&
                createPortal(
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
                    />,
                    layerChooserHost
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
