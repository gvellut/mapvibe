import type React from 'react';
import type * as maplibregl from 'maplibre-gl';
import type { MapVibeImportInfo, StyleImportConfig } from '../types';
import type { MapInstanceHandle } from '../components/MapCanvas';
import type { BackgroundCatalog, BackgroundRuntimeState } from './backgrounds';
import { normalizeSpriteConfiguration, rewriteLayerImageReferences } from './spriteExpressions.ts';
import { cloneJson, resolveMaybeRelativeUrl } from './styleUtils.ts';

const IMPORT_NAMESPACE_PREFIX = '__imports_';
type LayerVisibility = 'visible' | 'none';

export interface RuntimeImportInfo extends MapVibeImportInfo {
    originalVisibilityByLayerId: Map<string, LayerVisibility>;
    sourceDefinitions: Map<string, any>;
    layerDefinitions: Map<string, any>;
    spriteUrls: Map<string, string>;
}

export async function loadBackgroundImport(
    importConfig: StyleImportConfig,
    catalogRef: React.MutableRefObject<BackgroundCatalog>,
    runtimeRef: React.MutableRefObject<BackgroundRuntimeState>,
    mapRef: React.RefObject<MapInstanceHandle | null>,
    selectedBackgroundLayerRef: React.MutableRefObject<string>,
    applySelectedBackground: (
        backgroundId: string,
        options?: { updateState?: boolean; closeChooser?: boolean }
    ) => void
) {
    const runtime = runtimeRef.current;
    if (runtime.imports.has(importConfig.id) || runtime.loadingImports.has(importConfig.id)) {
        return;
    }

    runtime.loadingImports.add(importConfig.id);

    try {
        const response = await fetch(importConfig.url);
        if (!response.ok) {
            throw new Error(
                `Failed to fetch imported style "${importConfig.id}": ${response.status} ${response.statusText}`
            );
        }

        const styleDocument = await response.json();
        const runtimeImportInfo = normalizeImportedStyle(importConfig, styleDocument);

        const map = mapRef.current?.getMap();
        if (!map) {
            return;
        }

        materializeImportedStyle(map, runtimeImportInfo, catalogRef.current.overlayBoundaryId);
        runtime.imports.set(importConfig.id, runtimeImportInfo);

        if (
            backgroundSelectionIncludesImport(
                selectedBackgroundLayerRef.current,
                importConfig.id,
                catalogRef.current
            )
        ) {
            applySelectedBackground(selectedBackgroundLayerRef.current, {
                updateState: false,
                closeChooser: false
            });
        }
    } catch (error) {
        console.warn(
            `Could not load imported style "${importConfig.id}" from ${importConfig.url}.`,
            error
        );
    } finally {
        runtime.loadingImports.delete(importConfig.id);
    }
}

function backgroundSelectionIncludesImport(
    backgroundId: string,
    importId: string,
    catalog: BackgroundCatalog
): boolean {
    return catalog.backgroundDefinitions.get(backgroundId)?.memberIds.includes(importId) ?? false;
}

export function normalizeImportedStyle(
    importConfig: StyleImportConfig,
    styleDocument: any
): RuntimeImportInfo {
    const namespacePrefix = `${IMPORT_NAMESPACE_PREFIX}${importConfig.id}_`;
    const sourceDefinitions = new Map<string, any>();
    const layerDefinitions = new Map<string, any>();
    const originalVisibilityByLayerId = new Map<string, LayerVisibility>();
    const layerIds: string[] = [];

    const spriteMapping = normalizeSpriteConfiguration(
        styleDocument?.sprite,
        importConfig.url,
        namespacePrefix
    );
    const glyphsUrl =
        typeof styleDocument?.glyphs === 'string'
            ? resolveMaybeRelativeUrl(styleDocument.glyphs, importConfig.url)
            : undefined;

    for (const [sourceId, sourceDefinition] of Object.entries(styleDocument?.sources ?? {})) {
        if (
            typeof sourceId !== 'string' ||
            !sourceDefinition ||
            typeof sourceDefinition !== 'object'
        ) {
            continue;
        }

        const nextSourceDefinition = cloneJson(sourceDefinition);
        rebaseSourceUrls(nextSourceDefinition, importConfig.url);
        sourceDefinitions.set(`${namespacePrefix}${sourceId}`, nextSourceDefinition);
    }

    for (const layerDefinition of Array.isArray(styleDocument?.layers)
        ? styleDocument.layers
        : []) {
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
            nextLayerDefinition.filter = rewriteImportedFilterExpression(
                nextLayerDefinition.filter
            );
        }

        rewriteLayerImageReferences(nextLayerDefinition, spriteMapping);

        const originalVisibility =
            nextLayerDefinition.layout?.visibility === 'none' ? 'none' : 'visible';
        originalVisibilityByLayerId.set(nextLayerId, originalVisibility);

        nextLayerDefinition.id = nextLayerId;
        nextLayerDefinition.layout = {
            ...nextLayerDefinition.layout,
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

function materializeImportedStyle(
    map: maplibregl.Map,
    importInfo: RuntimeImportInfo,
    beforeId?: string
) {
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

export function cleanupImportedBackgrounds(
    map: maplibregl.Map,
    runtime: BackgroundRuntimeState,
    catalog: BackgroundCatalog
) {
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

function rewriteImportedFilterExpression(value: any): any {
    if (!Array.isArray(value) || value.length === 0) {
        return value;
    }

    const directGetPropertyName = getDirectGetPropertyNameForNumericComparison(value);
    if (directGetPropertyName) {
        const fallback = value[0] === '!=' ? true : false;
        return ['case', ['has', directGetPropertyName], value, fallback];
    }

    return value.map((item) =>
        Array.isArray(item) ? rewriteImportedFilterExpression(item) : item
    );
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
