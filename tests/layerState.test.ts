import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AppConfig } from '../src/lib/types.ts';
import type { Map } from 'maplibre-gl';
import { buildBackgroundCatalog, createBackgroundRuntimeState, applyBackgroundSelection, applyDataLayerVisibilitySelection } from '../src/lib/styles/backgrounds.ts';
import { loadBackgroundImport } from '../src/lib/styles/styleImports.ts';
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


test('configured entry and member order survives visibility changes and asynchronous background imports', async (t) => {
    const input = fixture();
    // Both entry order and member order deliberately differ from the root style.
    input.layers = ['blue-labels', 'b', 'red-labels', 'a', 'blue-fill', 'red-fill'].map(
        (id) => ({ id, type: 'background' })
    );
    input.customUi.dataLayers = [
        { id: 'red', name: 'Red', layerIds: ['red-fill', 'red-labels'] },
        { id: 'blue', name: 'Blue', layerIds: ['blue-fill', 'blue-labels'], visible: false }
    ];
    const original = structuredClone(input);
    const catalog = buildBackgroundCatalog(input);
    const runtime = createBackgroundRuntimeState();
    const initial = createLayerState(catalog);
    const order = input.layers.map(({ id }) => id);
    const visibility = new globalThis.Map<string, string>();
    const map = {
        getLayer: (id: string) => order.includes(id) ? { id } : undefined,
        getStyle: () => ({ layers: order.map((id) => ({ id })) }),
        moveLayer: (id: string, before?: string) => {
            order.splice(order.indexOf(id), 1);
            order.splice(before ? order.indexOf(before) : order.length, 0, id);
        },
        addLayer: (layer: { id: string }, before?: string) => {
            order.splice(before ? order.indexOf(before) : order.length, 0, layer.id);
        },
        getSprite: () => [],
        setLayoutProperty: (id: string, _property: string, value: string) => {
            visibility.set(id, value);
        },
        setGlyphs() {}, getZoom: () => 5, setMinZoom() {}, setMaxZoom() {}
    } as unknown as Map;

    applyDataLayerOrder(map, catalog, initial.dataIds, runtime);
    applyBackgroundSelection(map, initial.selectedBackgroundLayer, catalog, runtime, input.customUi);
    applyDataLayerVisibilitySelection(map, catalog, initial.visibleDataLayers);
    const dataOrder = ['red-fill', 'red-labels', 'blue-fill', 'blue-labels'];
    assert.deepEqual(order, ['b', 'a', ...dataOrder]);
    assert.equal(catalog.overlayBoundaryId, 'red-fill');
    for (const id of ['blue-fill', 'blue-labels']) assert.equal(visibility.get(id), 'none');

    const enabled = reduceLayerState(initial, { type: 'visibility', id: 'blue', visible: true });
    applyDataLayerVisibilitySelection(map, catalog, enabled.visibleDataLayers);
    assert.deepEqual(order, ['b', 'a', ...dataOrder]);
    for (const id of dataOrder) assert.equal(visibility.get(id), 'visible');
    const hidden = reduceLayerState(enabled, { type: 'visibility', id: 'red', visible: false });
    applyDataLayerVisibilitySelection(map, catalog, hidden.visibleDataLayers);
    applyDataLayerVisibilitySelection(map, catalog, enabled.visibleDataLayers);
    assert.deepEqual(order, ['b', 'a', ...dataOrder]);

    // Exercise actual import materialization against the boundary established at startup.
    t.mock.method(globalThis, 'fetch', async (url: string) => {
        assert.equal(url, input.customUi.imports![0].url);
        return new Response(JSON.stringify({
            version: 8,
            sources: {},
            layers: [{ id: 'land', type: 'background' }, { id: 'labels', type: 'background' }]
        }), { headers: { 'Content-Type': 'application/json' } });
    });
    applyBackgroundSelection(map, 'b', catalog, runtime, input.customUi);
    await loadBackgroundImport(
        input.customUi.imports![0],
        { current: catalog },
        { current: runtime },
        { current: { getMap: () => map } },
        { current: 'b' },
        (id) => applyBackgroundSelection(map, id, catalog, runtime, input.customUi)
    );
    const importedIds = ['__imports_import_land', '__imports_import_labels'];
    assert.equal(runtime.imports.size, 1);
    assert.deepEqual(order, ['a', 'b', ...importedIds, ...dataOrder]);
    for (const id of importedIds) assert.equal(visibility.get(id), 'visible');
    applyBackgroundSelection(map, 'a', catalog, runtime, input.customUi);
    assert.deepEqual(order, ['b', ...importedIds, 'a', ...dataOrder]);
    for (const id of importedIds) assert.equal(visibility.get(id), 'none');
    assert.deepEqual(input, original);
});
