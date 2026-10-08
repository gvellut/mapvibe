import type * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, MapGeoJSONFeature } from 'maplibre-gl';
import type { BackgroundCatalog } from '../styles/backgrounds';
import type { DataLayerConfig } from '../types';

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

export function getInteractiveFeatureActionAtPoint(
    map: maplibregl.Map,
    point: maplibregl.Point,
    catalog: BackgroundCatalog
): InteractiveFeatureAction | null {
    if (!catalog.clickableLayerIds.length) {
        return null;
    }

    const features = map.queryRenderedFeatures(point, {
        layers: catalog.clickableLayerIds
    }) as MapGeoJSONFeature[];
    return resolveInteractiveFeatureAction(features, catalog);
}

export function resolveInteractiveFeatureAction(
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
    return (
        properties.cluster === true ||
        properties.cluster === 'true' ||
        parseNumericProperty(properties.cluster_id) !== null ||
        parseNumericProperty(properties.point_count) !== null
    );
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

export async function zoomToClusterFeature(map: maplibregl.Map, feature: MapGeoJSONFeature) {
    const properties = getFeatureProperties(feature);
    const sourceId = getFeatureSourceId(feature);
    const clusterId = parseNumericProperty(properties.cluster_id);
    const center = getPointFeatureCoordinates(feature);

    if (!sourceId || clusterId === null || !center) {
        console.warn(
            'Could not zoom to cluster because the clicked feature is missing a source id, cluster id, or point geometry.',
            feature
        );
        return;
    }

    const source = map.getSource(sourceId) as GeoJSONSource | undefined;
    if (!source || typeof source.getClusterExpansionZoom !== 'function') {
        console.warn(
            `Could not zoom to cluster because source "${sourceId}" is not a clustered GeoJSON source.`,
            feature
        );
        return;
    }

    try {
        const expansionZoom = await source.getClusterExpansionZoom(clusterId);
        map.easeTo({ center, zoom: expansionZoom });
    } catch (error) {
        console.warn(
            `Could not resolve expansion zoom for cluster "${clusterId}" in source "${sourceId}".`,
            error
        );
    }
}

function getDataLayerForMapLayerId(
    catalog: BackgroundCatalog,
    mapLayerId: string
): DataLayerConfig | undefined {
    return catalog.dataLayerEntries.find((dataLayer: DataLayerConfig) =>
        dataLayer.layerIds.includes(mapLayerId)
    );
}
