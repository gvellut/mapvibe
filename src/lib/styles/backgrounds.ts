import type * as maplibregl from 'maplibre-gl';
import type {
    AppConfig,
    BackgroundLayerConfig,
    CustomUiConfig,
    DataLayerConfig,
    MapVibeImportInfo,
    StyleImportConfig
} from '../types';
import type { RuntimeImportInfo } from './styleImports';
import { cloneJson, uniqueInOrder } from './styleUtils.ts';

interface BackgroundLayerDefinition {
    id: string;
    memberIds: string[];
}

export interface BackgroundCatalog {
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

export interface BackgroundRuntimeState {
    imports: Map<string, RuntimeImportInfo>;
    loadingImports: Set<string>;
}

// --- BACKGROUND CATALOG AND RUNTIME HELPERS ---
export function createBackgroundRuntimeState(): BackgroundRuntimeState {
    return {
        imports: new Map<string, RuntimeImportInfo>(),
        loadingImports: new Set<string>()
    };
}

export function createInitialMapStyle(config: AppConfig): AppConfig {
    const initialMapStyle = cloneJson(config);

    if (Array.isArray(initialMapStyle.layers)) {
        initialMapStyle.layers = initialMapStyle.layers.map((layer: any) => {
            if (!layer || typeof layer !== 'object') {
                return layer;
            }

            return {
                ...layer,
                layout: {
                    ...layer.layout,
                    visibility: 'none'
                }
            };
        });
    }

    return initialMapStyle;
}

export function buildBackgroundCatalog(config: AppConfig): BackgroundCatalog {
    const topLayerDefinitions = new Map<string, any>();
    const importConfigs = new Map<string, StyleImportConfig>();
    const backgroundDefinitions = new Map<string, BackgroundLayerDefinition>();
    const backgroundEntries: BackgroundLayerConfig[] = [];
    const dataLayerEntries: DataLayerConfig[] = [];
    const dataLayerConfigs = new Map<string, DataLayerConfig>();
    const importEntries = Array.isArray(config.customUi?.imports) ? config.customUi.imports : [];
    const rawBackgroundEntries = Array.isArray(config.customUi?.backgroundLayers)
        ? config.customUi.backgroundLayers
        : [];
    const rawDataLayerEntries = Array.isArray(config.customUi?.dataLayers)
        ? config.customUi.dataLayers
        : [];
    const layers = Array.isArray(config.layers) ? config.layers : [];

    for (const layer of layers) {
        if (!layer || typeof layer.id !== 'string') {
            continue;
        }

        if (topLayerDefinitions.has(layer.id)) {
            console.warn(
                `Duplicate top-level layer id "${layer.id}" found in config.layers. Keeping the first definition.`
            );
            continue;
        }

        topLayerDefinitions.set(layer.id, layer);
    }

    for (const importConfig of importEntries) {
        if (
            !importConfig ||
            typeof importConfig.id !== 'string' ||
            typeof importConfig.url !== 'string'
        ) {
            console.warn(
                'Ignoring invalid customUi.imports entry because it is missing a string id or url.',
                importConfig
            );
            continue;
        }

        if (topLayerDefinitions.has(importConfig.id) || importConfigs.has(importConfig.id)) {
            console.warn(
                `Ignoring imported style "${importConfig.id}" because that id is already used elsewhere in the style.`
            );
            continue;
        }

        importConfigs.set(importConfig.id, importConfig);
    }

    for (const backgroundEntry of rawBackgroundEntries) {
        if (
            !backgroundEntry ||
            typeof backgroundEntry.id !== 'string' ||
            typeof backgroundEntry.name !== 'string' ||
            !Array.isArray(backgroundEntry.layerIds)
        ) {
            console.warn(
                'Ignoring invalid customUi.backgroundLayers entry because it is missing a string id, string name, or layerIds array.',
                backgroundEntry
            );
            continue;
        }

        if (backgroundDefinitions.has(backgroundEntry.id)) {
            console.warn(
                `Ignoring duplicate customUi.backgroundLayers entry "${backgroundEntry.id}".`
            );
            continue;
        }

        const resolvedLayerIds = uniqueInOrder(
            backgroundEntry.layerIds
                .filter((layerId): layerId is string => typeof layerId === 'string')
                .filter((layerId) => {
                    if (topLayerDefinitions.has(layerId) || importConfigs.has(layerId)) {
                        return true;
                    }

                    console.warn(
                        `Ignoring unknown background layer member "${layerId}" inside background layer "${backgroundEntry.id}".`
                    );
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
        if (
            !dataLayer ||
            typeof dataLayer.id !== 'string' ||
            typeof dataLayer.name !== 'string' ||
            !Array.isArray(dataLayer.layerIds)
        ) {
            console.warn(
                'Ignoring invalid customUi.dataLayers entry because it is missing a string id, string name, or layerIds array.',
                dataLayer
            );
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

                    console.warn(
                        `Ignoring unknown data layer member "${layerId}" inside data layer "${dataLayer.id}".`
                    );
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
            const filteredLayerIds = backgroundEntry.layerIds.filter(
                (layerId) => !overlappingLayerIds.has(layerId)
            );
            backgroundEntry.layerIds = filteredLayerIds;
            const definition = backgroundDefinitions.get(backgroundEntry.id);
            if (definition) {
                definition.memberIds = filteredLayerIds;
            }
        }

        for (const dataLayer of dataLayerEntries) {
            dataLayer.layerIds = dataLayer.layerIds.filter(
                (layerId) => !overlappingLayerIds.has(layerId)
            );
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

    const overlayBoundaryId = layers.find(
        (layer) => layer && typeof layer.id === 'string' && !managedTopLayerIds.has(layer.id)
    )?.id;

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
        console.warn(
            `Multiple backgroundLayers entries declare "visible: true". Using "${explicitlyVisibleEntries[0].id}".`
        );
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

export function getImportInfo(
    runtime: BackgroundRuntimeState,
    importId: string
): MapVibeImportInfo | null {
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

export function getBackgroundLayerIds(
    backgroundId: string,
    catalog: BackgroundCatalog,
    runtime: BackgroundRuntimeState
): string[] {
    return uniqueInOrder(resolveBackgroundLayerIds(backgroundId, catalog, runtime));
}

function resolveBackgroundLayerIds(
    backgroundId: string,
    catalog: BackgroundCatalog,
    runtime: BackgroundRuntimeState
): string[] {
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

export function applyBackgroundSelection(
    map: maplibregl.Map,
    backgroundId: string,
    catalog: BackgroundCatalog,
    runtime: BackgroundRuntimeState,
    chooserConfig: CustomUiConfig
) {
    hideAllManagedBackgroundTargets(map, catalog, runtime);

    const resolvedLayerIds = getBackgroundLayerIds(backgroundId, catalog, runtime);
    const boundaryId =
        catalog.overlayBoundaryId && map.getLayer(catalog.overlayBoundaryId)
            ? catalog.overlayBoundaryId
            : undefined;

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

    const { minZoom, maxZoom } = getBackgroundZoomBounds(
        backgroundId,
        catalog,
        runtime,
        chooserConfig
    );
    const currentZoom = map.getZoom();
    map.setMinZoom(minZoom ?? null);
    map.setMaxZoom(maxZoom ?? null);

    if (maxZoom !== undefined && currentZoom > maxZoom) {
        map.zoomTo(maxZoom);
    } else if (minZoom !== undefined && currentZoom < minZoom) {
        map.zoomTo(minZoom);
    }
}

export function applyDataLayerVisibilitySelection(
    map: maplibregl.Map,
    catalog: BackgroundCatalog,
    visibleDataLayerIds: Set<string>
) {
    for (const dataLayer of catalog.dataLayerEntries) {
        setDataLayerVisibility(map, dataLayer, visibleDataLayerIds.has(dataLayer.id));
    }
}

export function setDataLayerVisibility(
    map: maplibregl.Map,
    dataLayer: DataLayerConfig,
    visible: boolean
) {
    dataLayer.layerIds.forEach((layerId) => {
        if (map.getLayer(layerId)) {
            map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
        }
    });
}

function hideAllManagedBackgroundTargets(
    map: maplibregl.Map,
    catalog: BackgroundCatalog,
    runtime: BackgroundRuntimeState
) {
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

function findImportForLayerId(
    runtime: BackgroundRuntimeState,
    layerId: string
): RuntimeImportInfo | undefined {
    for (const importInfo of runtime.imports.values()) {
        if (importInfo.layerDefinitions.has(layerId)) {
            return importInfo;
        }
    }

    return undefined;
}

function resolveBackgroundGlyphsUrl(
    backgroundId: string,
    catalog: BackgroundCatalog,
    runtime: BackgroundRuntimeState
): string | undefined {
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
        console.warn(
            `Background layer "${backgroundId}" uses multiple imported glyph URLs. Using the last imported style's glyphs URL.`
        );
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

function getClampedZoomBounds(sourceDef: any, chooserConfig: CustomUiConfig) {
    let minZoom =
        typeof sourceDef.minzoom === 'number' ? sourceDef.minzoom : chooserConfig.globalMinZoom;
    let maxZoom =
        typeof sourceDef.maxzoom === 'number' ? sourceDef.maxzoom : chooserConfig.globalMaxZoom;
    if (typeof chooserConfig.globalMinZoom === 'number') {
        minZoom = Math.max(minZoom ?? chooserConfig.globalMinZoom, chooserConfig.globalMinZoom);
    }
    if (typeof chooserConfig.globalMaxZoom === 'number') {
        maxZoom = Math.min(maxZoom ?? chooserConfig.globalMaxZoom, chooserConfig.globalMaxZoom);
    }
    return { minZoom, maxZoom };
}
