import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Map } from 'maplibre-gl';
import {
    cleanupImportedBackgrounds,
    loadBackgroundImport,
    normalizeImportedStyle
} from '../src/lib/styles/styleImports.ts';
import {
    buildBackgroundCatalog,
    createBackgroundRuntimeState
} from '../src/lib/styles/backgrounds.ts';
import {
    normalizeSpriteConfiguration,
    rewriteLayerImageReferences
} from '../src/lib/styles/spriteExpressions.ts';

const importConfig = { id: 'liberty', url: 'https://example.test/styles/style.json' };

test('normalization namespaces sources, layers and sprites, rebases URLs and preserves input', () => {
    const style = {
        glyphs: '../fonts/{fontstack}/{range}.pbf',
        sprite: [
            { id: 'default', url: './sprites' },
            { id: 'icons', url: '../icons' }
        ],
        sources: {
            tiles: { type: 'vector', url: './tiles.json', tiles: ['../tiles/{z}/{x}/{y}.pbf'] },
            points: { type: 'geojson', data: './points.json' }
        },
        layers: [
            {
                id: 'poi',
                type: 'symbol',
                source: 'points',
                ref: 'other',
                filter: ['all', ['>', ['get', 'rank'], 1], ['!=', 0, ['get', 'count']]],
                layout: { 'icon-image': 'icons:camera-{kind}', visibility: 'none' }
            }
        ]
    };
    const original = structuredClone(style);
    const normalized = normalizeImportedStyle(importConfig, style);
    assert.deepEqual(normalized.sourceIds, ['__imports_liberty_tiles', '__imports_liberty_points']);
    assert.deepEqual(normalized.layerIds, ['__imports_liberty_poi']);
    assert.deepEqual(
        [...normalized.spriteUrls],
        [
            ['__imports_liberty_default', 'https://example.test/styles/sprites'],
            ['__imports_liberty_icons', 'https://example.test/icons']
        ]
    );
    assert.equal(
        normalized.glyphsUrl,
        'https://example.test/fonts/%7Bfontstack%7D/%7Brange%7D.pbf'
    );
    assert.equal(
        normalized.sourceDefinitions.get('__imports_liberty_tiles').url,
        'https://example.test/styles/tiles.json'
    );
    assert.deepEqual(normalized.sourceDefinitions.get('__imports_liberty_tiles').tiles, [
        'https://example.test/tiles/%7Bz%7D/%7Bx%7D/%7By%7D.pbf'
    ]);
    assert.equal(
        normalized.sourceDefinitions.get('__imports_liberty_points').data,
        'https://example.test/styles/points.json'
    );
    const layer = normalized.layerDefinitions.get('__imports_liberty_poi');
    assert.equal(layer.source, '__imports_liberty_points');
    assert.equal(layer.ref, '__imports_liberty_other');
    assert.deepEqual(layer.filter, [
        'all',
        ['case', ['has', 'rank'], ['>', ['get', 'rank'], 1], false],
        ['case', ['has', 'count'], ['!=', 0, ['get', 'count']], true]
    ]);
    assert.deepEqual(layer.layout['icon-image'], [
        'concat',
        '__imports_liberty_icons:',
        'camera-',
        ['coalesce', ['to-string', ['get', 'kind']], '']
    ]);
    assert.equal(normalized.originalVisibilityByLayerId.get(layer.id), 'none');
    assert.equal(layer.layout.visibility, 'none');
    assert.deepEqual(style, original);
});

test('nested sprite expressions preserve conditions and numeric stops while rewriting images', () => {
    const sprites = normalizeSpriteConfiguration(
        './sprites',
        importConfig.url,
        '__imports_liberty_'
    );
    const layer = {
        layout: {
            'icon-image': [
                'step',
                ['zoom'],
                'small',
                10,
                ['match', ['get', 'kind'], 'cafe', ['image', 'coffee'], 'marker']
            ]
        },
        paint: { 'fill-pattern': ['coalesce', ['image', 'texture'], ['image', 'fallback']] }
    };
    rewriteLayerImageReferences(layer, sprites);
    assert.deepEqual(layer.layout['icon-image'], [
        'step',
        ['zoom'],
        '__imports_liberty_default:small',
        10,
        [
            'match',
            ['get', 'kind'],
            'cafe',
            ['image', '__imports_liberty_default:coffee'],
            '__imports_liberty_default:marker'
        ]
    ]);
    assert.deepEqual(layer.paint['fill-pattern'], [
        'coalesce',
        ['image', '__imports_liberty_default:texture'],
        ['image', '__imports_liberty_default:fallback']
    ]);
});

test('imports load once, materialize below overlays, reapply selection and clean up resources', async (t) => {
    const style = {
        sprite: './sprites',
        sources: { tiles: { type: 'vector', url: './tiles.json' } },
        layers: [
            { id: 'land', type: 'fill', source: 'tiles' },
            { id: 'labels', type: 'symbol', source: 'tiles' }
        ]
    };
    const fetch = t.mock.method(
        globalThis,
        'fetch',
        async () => new Response(JSON.stringify(style))
    );
    const catalog = buildBackgroundCatalog({
        glyphs: 'https://example.test/top-fonts/{fontstack}/{range}.pbf',
        layers: [{ id: 'overlay', type: 'circle' }],
        customUi: {
            panel: { width: '250px', backgroundColor: 'white' },
            imports: [importConfig],
            backgroundLayers: [{ id: 'background', name: 'Imported', layerIds: ['liberty'] }],
            dataLayers: []
        }
    });
    const runtime = createBackgroundRuntimeState();
    const calls: unknown[][] = [];
    const sprites = new Set<string>();
    const sources = new Set<string>();
    const layers = new Set<string>(['overlay']);
    const map = {
        getSprite: () => [...sprites].map((id) => ({ id })),
        getSource: (id: string) => sources.has(id),
        getLayer: (id: string) => layers.has(id),
        addSprite: (id: string) => {
            sprites.add(id);
            calls.push(['sprite', id]);
        },
        addSource: (id: string) => {
            sources.add(id);
            calls.push(['source', id]);
        },
        addLayer: (layer: { id: string }, before?: string) => {
            layers.add(layer.id);
            calls.push(['layer', layer.id, before]);
        },
        removeLayer: (id: string) => {
            layers.delete(id);
            calls.push(['removeLayer', id]);
        },
        removeSource: (id: string) => {
            sources.delete(id);
            calls.push(['removeSource', id]);
        },
        removeSprite: (id: string) => {
            sprites.delete(id);
            calls.push(['removeSprite', id]);
        },
        setGlyphs: (url?: string) => calls.push(['glyphs', url])
    } as unknown as Map;
    const reapply = t.mock.fn();
    for (let attempt = 0; attempt < 2; attempt++) {
        await loadBackgroundImport(
            importConfig,
            { current: catalog },
            { current: runtime },
            { current: { getMap: () => map } },
            { current: 'background' },
            reapply
        );
    }
    assert.equal(fetch.mock.callCount(), 1);
    assert.equal(runtime.imports.size, 1);
    assert.equal(runtime.loadingImports.size, 0);
    assert.deepEqual(calls, [
        ['sprite', '__imports_liberty_default'],
        ['source', '__imports_liberty_tiles'],
        ['layer', '__imports_liberty_land', 'overlay'],
        ['layer', '__imports_liberty_labels', 'overlay']
    ]);
    assert.deepEqual(reapply.mock.calls[0].arguments, [
        'background',
        { updateState: false, closeChooser: false }
    ]);
    calls.length = 0;
    cleanupImportedBackgrounds(map, runtime, catalog);
    assert.deepEqual(calls, [
        ['removeLayer', '__imports_liberty_labels'],
        ['removeLayer', '__imports_liberty_land'],
        ['removeSource', '__imports_liberty_tiles'],
        ['removeSprite', '__imports_liberty_default'],
        ['glyphs', catalog.topStyleGlyphsUrl]
    ]);
    assert.equal(runtime.imports.size, 0);
});
