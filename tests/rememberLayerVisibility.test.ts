import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import type { AppConfig } from '../src/lib/types.ts';
import { buildBackgroundCatalog } from '../src/lib/styles/backgrounds.ts';
import { createLayerState, reduceLayerState } from '../src/lib/map/layerState.ts';
import {
    loadRememberedLayerVisibility,
    normalizeRememberLayerVisibility,
    saveRememberedLayerVisibility,
    type RememberedLayerVisibility
} from '../src/lib/map/rememberLayerVisibility.ts';
import { saveRememberedViewState } from '../src/lib/map/rememberLastPosition.ts';

function fixture(): AppConfig {
    return {
        version: 8,
        layers: ['light-style', 'dark-style', 'points-style', 'lines-style'].map((id) => ({
            id,
            type: 'background'
        })),
        customUi: {
            panel: { width: '250px', backgroundColor: 'white' },
            backgroundLayers: [
                { id: 'light', name: 'Light', layerIds: ['light-style'] },
                { id: 'dark', name: 'Dark', layerIds: ['dark-style'], visible: true }
            ],
            dataLayers: [
                { id: 'points', name: 'Points', layerIds: ['points-style'] },
                { id: 'lines', name: 'Lines', layerIds: ['lines-style'], visible: false }
            ]
        }
    };
}

function installWindow(t: TestContext) {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const stored = new Map<string, string>();
    const location = {
        hostname: 'example.test',
        pathname: '/mapvibe/',
        search: '?config=first.json'
    };
    const localStorage = {
        getItem: t.mock.fn((key: string) => stored.get(key) ?? null),
        setItem: t.mock.fn((key: string, value: string) => {
            stored.set(key, value);
        })
    };
    const browser = { location, localStorage };
    Object.defineProperty(globalThis, 'window', { configurable: true, value: browser });
    t.after(() => {
        if (original) Object.defineProperty(globalThis, 'window', original);
        else Reflect.deleteProperty(globalThis, 'window');
    });
    return { stored, location, localStorage, browser };
}

test('visibility scopes use the same boolean strings and normalization as position', () => {
    for (const value of [true, 1, 'true', '1', 'y', 'yes', ' PAGE ']) {
        assert.equal(normalizeRememberLayerVisibility(value), 'page');
    }
    for (const value of [
        false,
        0,
        'false',
        '0',
        'n',
        'no',
        null,
        undefined,
        '',
        'invalid',
        2,
        {}
    ]) {
        assert.equal(normalizeRememberLayerVisibility(value), false);
    }
    assert.equal(normalizeRememberLayerVisibility(' DOMAIN '), 'domain');
});

test('first use saves both config defaults and restores logical IDs without mutating config', (t) => {
    const { stored } = installWindow(t);
    const config = fixture();
    const original = structuredClone(config);
    const catalog = buildBackgroundCatalog(config);
    assert.equal(loadRememberedLayerVisibility('page'), undefined);
    const initial = createLayerState(catalog, loadRememberedLayerVisibility('page'));
    assert.equal(initial.selectedBackgroundLayer, 'dark');
    assert.deepEqual([...initial.visibleDataLayers], ['points']);
    saveRememberedLayerVisibility('page', initial.rememberedVisibility);
    assert.deepEqual(JSON.parse([...stored.values()][0]), {
        selectedBackgroundLayer: 'dark',
        dataLayerVisibility: { points: true, lines: false }
    });
    let state = reduceLayerState(initial, { type: 'select', id: 'light' });
    state = reduceLayerState(state, { type: 'visibility', id: 'points', visible: false });
    state = reduceLayerState(state, { type: 'visibility', id: 'lines', visible: true });
    saveRememberedLayerVisibility('page', state.rememberedVisibility);
    const restored = createLayerState(catalog, loadRememberedLayerVisibility('page'));
    assert.equal(restored.selectedBackgroundLayer, 'light');
    assert.deepEqual([...restored.visibleDataLayers], ['lines']);
    assert.deepEqual(config, original);
});

test('saved hidden values survive changed defaults and all data layers can stay hidden', () => {
    const config = fixture();
    config.customUi.dataLayers[1].visible = true;
    const state = createLayerState(buildBackgroundCatalog(config), {
        selectedBackgroundLayer: 'light',
        dataLayerVisibility: { points: false, lines: false }
    });
    assert.equal(state.selectedBackgroundLayer, 'light');
    assert.deepEqual([...state.visibleDataLayers], []);
    assert.deepEqual(state.rememberedVisibility.dataLayerVisibility, {
        points: false,
        lines: false
    });
});

test('missing backgrounds fall back to the config selection, then first background, or empty', () => {
    const config = fixture();
    const saved = { selectedBackgroundLayer: 'removed', dataLayerVisibility: { removed: true } };
    assert.equal(
        createLayerState(buildBackgroundCatalog(config), saved).selectedBackgroundLayer,
        'dark'
    );
    config.customUi.backgroundLayers[1].visible = false;
    assert.equal(
        createLayerState(buildBackgroundCatalog(config), saved).selectedBackgroundLayer,
        'light'
    );
    config.customUi.backgroundLayers = [];
    assert.equal(
        createLayerState(buildBackgroundCatalog(config), saved).selectedBackgroundLayer,
        ''
    );
});

test('config replacement discards absent IDs and gives new IDs their config defaults', () => {
    const config = fixture();
    const saved = {
        selectedBackgroundLayer: 'light',
        dataLayerVisibility: { points: false, removed: true }
    };
    config.customUi.dataLayers.push(
        { id: 'new-visible', name: 'New visible', layerIds: [] },
        { id: 'new-hidden', name: 'New hidden', layerIds: [], visible: false }
    );
    let state = createLayerState(buildBackgroundCatalog(config), saved);
    assert.deepEqual([...state.visibleDataLayers], ['new-visible']);
    assert.deepEqual(state.rememberedVisibility.dataLayerVisibility, {
        points: false,
        lines: false,
        'new-visible': true,
        'new-hidden': false
    });
    config.customUi.dataLayers = config.customUi.dataLayers.filter(({ id }) => id !== 'points');
    config.customUi.backgroundLayers = config.customUi.backgroundLayers.filter(
        ({ id }) => id !== 'light'
    );
    state = createLayerState(buildBackgroundCatalog(config), state.rememberedVisibility);
    assert.equal(state.selectedBackgroundLayer, 'dark');
    assert.equal(Object.hasOwn(state.rememberedVisibility.dataLayerVisibility, 'points'), false);
});

test('session removal and reordering never leak into subsequently saved explicit choices', () => {
    const catalog = buildBackgroundCatalog(fixture());
    let state = createLayerState(catalog);
    const remembered = state.rememberedVisibility;
    state = reduceLayerState(state, { type: 'move', group: 'background', id: 'dark', toIndex: 0 });
    state = reduceLayerState(state, { type: 'move', group: 'data', id: 'lines', toIndex: 0 });
    assert.equal(state.rememberedVisibility, remembered);
    state = reduceLayerState(state, { type: 'remove', group: 'background', id: 'dark' });
    state = reduceLayerState(state, { type: 'remove', group: 'data', id: 'points' });
    state = reduceLayerState(state, { type: 'move', group: 'background', id: 'light', toIndex: 0 });
    assert.equal(state.rememberedVisibility, remembered);
    state = reduceLayerState(state, { type: 'visibility', id: 'lines', visible: true });
    const restored = createLayerState(catalog, state.rememberedVisibility);
    assert.deepEqual(restored.backgroundIds, ['light', 'dark']);
    assert.deepEqual(restored.dataIds, ['points', 'lines']);
    assert.equal(restored.selectedBackgroundLayer, 'dark');
    assert.deepEqual([...restored.visibleDataLayers], ['points', 'lines']);
    // Explicitly choosing the session fallback replaces the saved background too.
    state = reduceLayerState(state, { type: 'select', id: 'light' });
    assert.equal(state.rememberedVisibility.selectedBackgroundLayer, 'light');
    assert.equal(reduceLayerState(state, { type: 'select', id: 'missing' }), state);
});

test('page and domain scopes match position and remain separate from its storage', (t) => {
    const { stored, location } = installWindow(t);
    const visibility = createLayerState(buildBackgroundCatalog(fixture())).rememberedVisibility;
    saveRememberedLayerVisibility('page', visibility);
    assert.ok(stored.has('mapvibe:layer-visibility:v1:example.test/mapvibe/'));
    location.search = '?config=second.json';
    assert.deepEqual(loadRememberedLayerVisibility('page'), visibility);
    location.pathname = '/other';
    assert.equal(loadRememberedLayerVisibility('page'), undefined);
    saveRememberedLayerVisibility('domain', visibility);
    assert.ok(stored.has('mapvibe:layer-visibility:v1:example.test'));
    location.pathname = '/third';
    assert.deepEqual(loadRememberedLayerVisibility('domain'), visibility);
    saveRememberedViewState('domain', [6, 45], 10);
    assert.deepEqual(JSON.parse(stored.get('mapvibe:last-position:v1:example.test')!), {
        center: [6, 45],
        zoom: 10
    });
    assert.deepEqual(loadRememberedLayerVisibility('domain'), visibility);
    location.hostname = 'different.test';
    assert.equal(loadRememberedLayerVisibility('domain'), undefined);
});

test('disabled persistence does not read, write, or delete saved choices', (t) => {
    const { stored, localStorage } = installWindow(t);
    const saved = createLayerState(buildBackgroundCatalog(fixture())).rememberedVisibility;
    saveRememberedLayerVisibility('page', saved);
    const previous = new Map(stored);
    localStorage.getItem.mock.resetCalls();
    localStorage.setItem.mock.resetCalls();
    assert.equal(loadRememberedLayerVisibility(false), undefined);
    saveRememberedLayerVisibility(false, saved);
    assert.equal(localStorage.getItem.mock.callCount(), 0);
    assert.equal(localStorage.setItem.mock.callCount(), 0);
    assert.deepEqual(stored, previous);
});

test('malformed storage falls back and string IDs such as __proto__ remain ordinary IDs', (t) => {
    const { stored } = installWindow(t);
    t.mock.method(console, 'warn', () => {});
    const key = 'mapvibe:layer-visibility:v1:example.test/mapvibe/';
    for (const value of [
        '{',
        'null',
        '[]',
        '{}',
        '{"selectedBackgroundLayer":1,"dataLayerVisibility":{}}',
        '{"selectedBackgroundLayer":"light","dataLayerVisibility":null}',
        '{"selectedBackgroundLayer":"light","dataLayerVisibility":[]}',
        '{"selectedBackgroundLayer":"light","dataLayerVisibility":{"points":"false"}}'
    ]) {
        stored.set(key, value);
        assert.equal(loadRememberedLayerVisibility('page'), undefined);
    }
    stored.set(
        key,
        '{"selectedBackgroundLayer":"light","dataLayerVisibility":{"__proto__":false}}'
    );
    const config = fixture();
    config.customUi.dataLayers.push({ id: '__proto__', name: 'Special ID', layerIds: [] });
    const state = createLayerState(
        buildBackgroundCatalog(config),
        loadRememberedLayerVisibility('page')
    );
    assert.equal(state.visibleDataLayers.has('__proto__'), false);
    assert.equal(Object.hasOwn(state.rememberedVisibility.dataLayerVisibility, '__proto__'), true);
});

test('unavailable storage, read errors and quota failures do not prevent map state creation', (t) => {
    const { browser } = installWindow(t);
    const warning = t.mock.method(console, 'warn', () => {});
    const visibility: RememberedLayerVisibility = {
        selectedBackgroundLayer: 'light',
        dataLayerVisibility: {}
    };
    Object.defineProperty(browser, 'localStorage', {
        configurable: true,
        get() {
            throw new Error('Access denied');
        }
    });
    assert.equal(loadRememberedLayerVisibility('page'), undefined);
    saveRememberedLayerVisibility('page', visibility);
    Object.defineProperty(browser, 'localStorage', {
        value: {
            getItem() {
                throw new Error('Read denied');
            },
            setItem() {
                throw new Error('Quota exceeded');
            }
        }
    });
    assert.equal(loadRememberedLayerVisibility('domain'), undefined);
    saveRememberedLayerVisibility('domain', visibility);
    assert.equal(warning.mock.callCount(), 4);
});

test('server-side use without window returns config defaults without accessing storage', () => {
    assert.equal(typeof window, 'undefined');
    assert.equal(loadRememberedLayerVisibility('page'), undefined);
    const initial = createLayerState(buildBackgroundCatalog(fixture()));
    assert.doesNotThrow(() =>
        saveRememberedLayerVisibility('domain', initial.rememberedVisibility)
    );
});
