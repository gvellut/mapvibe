import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AppConfig } from '../src/lib/types.ts';
import type { Map } from 'maplibre-gl';
import { buildBackgroundCatalog, createBackgroundRuntimeState, applyBackgroundSelection } from '../src/lib/styles/backgrounds.ts';
import { createLayerState, reduceLayerState, applyDataLayerOrder } from '../src/lib/map/layerState.ts';

function fixture(): AppConfig {
    return { version: 8, layers: [{ id: 'a', type: 'background' }, { id: 'b', type: 'background' }, { id: 'red', type: 'background' }, { id: 'blue', type: 'background' }], customUi: {
        panel: { width: '300px', backgroundColor: 'white' },
        imports: [{ id: 'import', url: 'https://example.test/style.json' }],
        backgroundLayers: [{ id: 'a', name: 'A', layerIds: ['a'], thumbnailUrl: './a.png' }, { id: 'b', name: 'B', layerIds: ['b', 'import'] }],
        dataLayers: [{ id: 'red', name: 'Red', layerIds: ['red'] }, { id: 'blue', name: 'Blue', layerIds: ['blue'], visible: false, thumbnailUrl: './blue.png' }]
    } };
}

test('layer state shares normalized metadata, selection, overlays and immutable configuration', () => {
    const input = fixture();
    const original = structuredClone(input);
    const catalog = buildBackgroundCatalog(input);
    const initial = createLayerState(catalog);
    const selected = reduceLayerState(initial, { type: 'select', id: 'b' });
    const visible = reduceLayerState(selected, { type: 'visibility', id: 'blue', visible: true });
    assert.equal(initial.selectedBackgroundLayer, 'a');
    assert.equal(visible.selectedBackgroundLayer, 'b');
    assert.deepEqual([...initial.visibleDataLayers], ['red']);
    assert.deepEqual([...visible.visibleDataLayers], ['red', 'blue']);
    assert.equal(catalog.backgroundEntries[0].thumbnailUrl, './a.png');
    assert.equal(catalog.dataLayerEntries[1].thumbnailUrl, './blue.png');
    assert.deepEqual(input, original);
    assert.equal(reduceLayerState(initial, { type: 'select', id: 'missing' }), initial);
});

test('reordering stays within groups and deletion selects a fallback and retains the last background', () => {
    const catalog = buildBackgroundCatalog(fixture());
    let state = createLayerState(catalog);
    state = reduceLayerState(state, { type: 'move', group: 'background', id: 'b', toIndex: 0 });
    assert.deepEqual(state.backgroundIds, ['b', 'a']);
    assert.equal(state.selectedBackgroundLayer, 'a');
    state = reduceLayerState(state, { type: 'remove', group: 'background', id: 'a' });
    assert.equal(state.selectedBackgroundLayer, 'b');
    assert.equal(reduceLayerState(state, { type: 'remove', group: 'background', id: 'b' }), state);
    state = reduceLayerState(state, { type: 'remove', group: 'data', id: 'red' });
    assert.deepEqual(state.dataIds, ['blue']);
    assert.equal(state.visibleDataLayers.has('red'), false);
    assert.equal(reduceLayerState(state, { type: 'visibility', id: 'red', visible: true }), state);
    assert.equal(reduceLayerState(state, { type: 'move', group: 'data', id: 'blue', toIndex: 2 }), state);
    assert.deepEqual(createLayerState(catalog).backgroundIds, ['a', 'b']);
});

test('data reordering updates stacking and the boundary for later background switches/imports', () => {
    const input = fixture();
    const catalog = buildBackgroundCatalog(input);
    const runtime = createBackgroundRuntimeState();
    const order = ['a', 'b', 'red', 'blue'];
    const map = {
        getLayer: () => ({}),
        getStyle: () => ({ layers: order.map((id) => ({ id })) }),
        moveLayer: (id: string, before?: string) => {
            order.splice(order.indexOf(id), 1);
            order.splice(before ? order.indexOf(before) : order.length, 0, id);
        },
        setLayoutProperty() {}, setGlyphs() {}, getZoom: () => 5, setMinZoom() {}, setMaxZoom() {}
    } as unknown as Map;
    applyDataLayerOrder(map, catalog, ['blue', 'red'], runtime);
    assert.deepEqual(order, ['a', 'b', 'blue', 'red']);
    assert.equal(catalog.overlayBoundaryId, 'blue');
    applyBackgroundSelection(map, 'b', catalog, runtime, input.customUi);
    assert.deepEqual(order, ['a', 'b', 'blue', 'red']);
});
