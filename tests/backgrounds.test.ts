import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Map } from 'maplibre-gl';
import type { AppConfig } from '../src/lib/types.ts';
import {
    applyBackgroundSelection,
    applyDataLayerVisibilitySelection,
    buildBackgroundCatalog,
    createBackgroundRuntimeState,
    createInitialMapStyle,
    getBackgroundLayerIds,
    getImportInfo
} from '../src/lib/styles/backgrounds.ts';
import { normalizeImportedStyle } from '../src/lib/styles/styleImports.ts';

function config(): AppConfig {
    return {
        version: 8,
        glyphs: 'https://example.test/top/{fontstack}/{range}.pbf',
        sources: { tiles: { type: 'raster', minzoom: 5, maxzoom: 12 } },
        layers: [
            { id: 'base', type: 'raster', source: 'tiles', layout: { visibility: 'visible' } },
            { id: 'routes', type: 'line', source: 'tiles' },
            { id: 'alternative', type: 'raster', source: 'tiles' },
            { id: 'points', type: 'circle' }
        ],
        customUi: {
            panel: { width: '250px', backgroundColor: 'white' },
            imports: [{ id: 'liberty', url: 'https://example.test/styles/liberty.json' }],
            backgroundLayers: [
                {
                    id: 'combined',
                    name: 'Combined',
                    layerIds: ['base', 'liberty', 'routes', 'base']
                },
                { id: 'alternative', name: 'Alternative', layerIds: ['alternative'] }
            ],
            dataLayers: [{ id: 'poi', name: 'POI', layerIds: ['points'], interactive: true }]
        }
    };
}

test('catalog preserves selection defaults, explicit visibility and member order without mutation', (t) => {
    const warning = t.mock.method(console, 'warn', () => {});
    const input = config();
    const original = structuredClone(input);
    const catalog = buildBackgroundCatalog(input);
    assert.equal(catalog.initialSelection, 'combined');
    assert.deepEqual(catalog.backgroundEntries[0].layerIds, ['base', 'liberty', 'routes']);
    assert.deepEqual([...catalog.initialVisibleDataLayerIds], ['poi']);
    assert.deepEqual(catalog.clickableLayerIds, ['points']);
    assert.equal(catalog.overlayBoundaryId, 'points');
    assert.deepEqual(input, original);

    input.customUi.backgroundLayers[1].visible = true;
    input.customUi.dataLayers[0].visible = false;
    assert.equal(buildBackgroundCatalog(input).initialSelection, 'alternative');
    assert.equal(buildBackgroundCatalog(input).initialVisibleDataLayerIds.size, 0);
    input.customUi.backgroundLayers[0].visible = true;
    assert.equal(buildBackgroundCatalog(input).initialSelection, 'combined');
    assert.equal(warning.mock.callCount(), 1);
});

test('initial style hides every top layer while preserving the original configuration', () => {
    const input = config();
    const original = structuredClone(input);
    const style = createInitialMapStyle(input);
    assert.deepEqual(
        style.layers?.map((layer) => layer.layout.visibility),
        ['none', 'none', 'none', 'none']
    );
    assert.deepEqual(input, original);
    assert.equal(style.glyphs, input.glyphs);
});

test('selection orders imported and top layers below data, restores visibility and clamps zoom', () => {
    const input = config();
    const catalog = buildBackgroundCatalog(input);
    const runtime = createBackgroundRuntimeState();
    const imported = normalizeImportedStyle(input.customUi.imports![0], {
        glyphs: './fonts/{fontstack}/{range}.pbf',
        layers: [
            { id: 'land', type: 'background' },
            { id: 'labels', type: 'symbol', layout: { visibility: 'none' } }
        ]
    });
    runtime.imports.set(imported.id, imported);
    const layerIds = ['base', '__imports_liberty_land', '__imports_liberty_labels', 'routes'];
    assert.deepEqual(getBackgroundLayerIds('combined', catalog, runtime), layerIds);
    const moves: Array<[string, string | undefined]> = [];
    const visibility = new globalThis.Map<string, string>();
    const zoomCalls: Array<[string, number | null]> = [];
    let glyphs: string | undefined;
    const map = {
        getLayer: () => ({}),
        moveLayer: (id: string, before?: string) => moves.push([id, before]),
        setLayoutProperty: (id: string, property: string, value: string) => {
            assert.equal(property, 'visibility');
            visibility.set(id, value);
        },
        setGlyphs: (value?: string) => {
            glyphs = value;
        },
        getZoom: () => 15,
        setMinZoom: (value: number | null) => zoomCalls.push(['min', value]),
        setMaxZoom: (value: number | null) => zoomCalls.push(['max', value]),
        zoomTo: (value: number) => zoomCalls.push(['zoom', value])
    } as unknown as Map;
    applyBackgroundSelection(map, 'combined', catalog, runtime, input.customUi);
    assert.deepEqual(
        moves,
        layerIds.map((id) => [id, 'points'])
    );
    assert.equal(visibility.get('alternative'), 'none');
    assert.equal(visibility.get('__imports_liberty_labels'), 'none');
    for (const id of ['base', '__imports_liberty_land', 'routes']) {
        assert.equal(visibility.get(id), 'visible');
    }
    assert.equal(glyphs, imported.glyphsUrl);
    assert.deepEqual(zoomCalls, [
        ['min', 5],
        ['max', 12],
        ['zoom', 12]
    ]);
    applyDataLayerVisibilitySelection(map, catalog, new Set());
    assert.equal(visibility.get('points'), 'none');
    applyDataLayerVisibilitySelection(map, catalog, new Set(['poi']));
    assert.equal(visibility.get('points'), 'visible');

    const info = getImportInfo(runtime, 'liberty')!;
    info.layerIds.pop();
    assert.deepEqual(imported.layerIds, ['__imports_liberty_land', '__imports_liberty_labels']);
});
