import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Map, MapGeoJSONFeature } from 'maplibre-gl';
import { buildBackgroundCatalog } from '../src/lib/styles/backgrounds.ts';
import {
    resolveInteractiveFeatureAction,
    zoomToClusterFeature
} from '../src/lib/map/featureInteractions.ts';

function catalog(clusterInteractive = true, openUrl = false) {
    return buildBackgroundCatalog({
        layers: [
            { id: 'clusters', type: 'circle' },
            { id: 'leaves', type: 'symbol' }
        ],
        customUi: {
            panel: { width: '250px', backgroundColor: 'white' },
            backgroundLayers: [],
            dataLayers: [
                {
                    id: 'poi',
                    name: 'POI',
                    layerIds: ['clusters', 'leaves'],
                    interactive: true,
                    clusterInteractive,
                    openUrl
                }
            ]
        }
    });
}

function feature(layer: string, properties: Record<string, unknown>): MapGeoJSONFeature {
    return {
        type: 'Feature',
        layer: { id: layer },
        source: 'poi',
        properties,
        geometry: { type: 'Point', coordinates: [6, 45] }
    } as MapGeoJSONFeature;
}

const cluster = feature('clusters', { cluster: true, cluster_id: '12', point_count: 20 });
const leaf = feature('leaves', { title: 'POI', url: 'https://example.test/poi' });

test('opted-in clusters zoom while leaves retain panel or URL actions', () => {
    assert.equal(resolveInteractiveFeatureAction([cluster, leaf], catalog())?.kind, 'cluster-zoom');
    assert.equal(resolveInteractiveFeatureAction([leaf], catalog())?.kind, 'info-panel');
    assert.equal(resolveInteractiveFeatureAction([leaf], catalog(true, true))?.kind, 'open-url');
    assert.equal(
        resolveInteractiveFeatureAction([cluster], catalog(true, true))?.kind,
        'cluster-zoom'
    );
});

test('clusters without opt-in are skipped so an underlying leaf remains actionable', () => {
    const action = resolveInteractiveFeatureAction([cluster, leaf], catalog(false));
    assert.equal(action?.kind, 'info-panel');
    assert.equal(action?.feature, leaf);
    assert.equal(resolveInteractiveFeatureAction([cluster], catalog(false)), null);
    assert.equal(resolveInteractiveFeatureAction([feature('unmanaged', {})], catalog()), null);
});

test('cluster expansion uses the source, numeric cluster id and point coordinates', async () => {
    let expandedId: number | undefined;
    let view: unknown;
    const map = {
        getSource: (id: string) => {
            assert.equal(id, 'poi');
            return {
                getClusterExpansionZoom: async (clusterId: number) => {
                    expandedId = clusterId;
                    return 14;
                }
            };
        },
        easeTo: (options: unknown) => {
            view = options;
        }
    } as unknown as Map;
    await zoomToClusterFeature(map, cluster);
    assert.equal(expandedId, 12);
    assert.deepEqual(view, { center: [6, 45], zoom: 14 });
});

test('cluster expansion failures warn without moving the map', async (t) => {
    const warning = t.mock.method(console, 'warn', () => {});
    const easeTo = t.mock.fn();
    const map = {
        getSource: () => ({
            getClusterExpansionZoom: async () => {
                throw new Error('unavailable');
            }
        }),
        easeTo
    } as unknown as Map;
    await zoomToClusterFeature(map, cluster);
    assert.equal(warning.mock.callCount(), 1);
    assert.equal(easeTo.mock.callCount(), 0);
});
