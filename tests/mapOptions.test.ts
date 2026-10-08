import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    resolveGeolocateOptions,
    resolveMapOptions,
    type MapVibeGeolocateControlOptions
} from '../src/lib/map/controlConfig.ts';
import { applyInteractions } from '../src/lib/map/interactions.ts';
import { isMobile } from '../src/lib/utils/deviceDetection.ts';

test('missing controls enable the existing five with their previous defaults', () => {
    const options = resolveMapOptions();
    assert.deepEqual(
        options.controls.filter((control) => control.visible).map((control) => control.name),
        [
            'NavigationControl',
            'ScaleControl',
            'LayerChooserControl',
            'OpenInNewTabControl',
            'AttributionControl'
        ]
    );
    assert.deepEqual(
        options.controls.map(({ name, position }) => [name, position]),
        [
            ['NavigationControl', 'top-left'],
            ['ScaleControl', 'bottom-right'],
            ['LayerChooserControl', 'top-right'],
            ['OpenInNewTabControl', 'top-left'],
            ['AttributionControl', 'bottom-left'],
            ['GeolocateControl', 'top-left']
        ]
    );
    assert.deepEqual(options.controls[0].options, { showCompass: false });
    assert.deepEqual(options.controls[1].options, { unit: 'metric' });
    assert.deepEqual(options.controls[4].options, { compact: false });
    assert.deepEqual(options.controls[5].options, { trackUserLocation: 'auto' });
    assert.equal(options.rememberLastPosition, false);
});

test('geolocation defaults to auto for boolean and object control entries', () => {
    for (const Geolocate of [true, {}, { options: { fitBoundsOptions: { maxZoom: 13 } } }]) {
        const control = resolveMapOptions({ controls: { Geolocate } }).controls[0];
        assert.ok(control.name === 'GeolocateControl');
        assert.equal(control.visible, true);
        assert.equal(control.options.trackUserLocation, 'auto');
    }
});

test('auto and omitted tracking modes follow the device; explicit booleans override it', () => {
    const options: MapVibeGeolocateControlOptions[] = [
        {},
        { trackUserLocation: undefined },
        { trackUserLocation: 'auto' },
        { trackUserLocation: true },
        { trackUserLocation: false }
    ];
    for (const mobile of [false, true]) {
        assert.deepEqual(
            options.map((option) => resolveGeolocateOptions(option, mobile).trackUserLocation),
            [mobile, mobile, mobile, true, false]
        );
    }
});

test('resolving geolocation preserves other options and does not mutate configuration', () => {
    const options: MapVibeGeolocateControlOptions = {
        trackUserLocation: 'auto',
        positionOptions: { enableHighAccuracy: true, timeout: 10000 },
        fitBoundsOptions: { maxZoom: 13, padding: 20 },
        showUserLocation: false,
        showAccuracyCircle: false
    };
    const original = structuredClone(options);
    Object.freeze(options);
    for (const mobile of [false, true]) {
        assert.deepEqual(resolveGeolocateOptions(options, mobile), {
            ...original,
            trackUserLocation: mobile
        });
        assert.deepEqual(options, original);
    }
});

test('runtime visibility overrides preserve every configured tracking mode', () => {
    for (const trackUserLocation of [true, false, 'auto'] as const) {
        const config = {
            controls: {
                Geolocate: {
                    visible: false,
                    position: 'bottom-right' as const,
                    options: { trackUserLocation, fitBoundsOptions: { maxZoom: 13 } }
                }
            }
        };
        const original = structuredClone(config);
        const control = resolveMapOptions(config, { controls: { geolocate: true } }).controls[0];
        assert.equal(control.name, 'GeolocateControl');
        assert.equal(control.visible, true);
        assert.equal(control.position, 'bottom-right');
        assert.deepEqual(control.options, original.controls.Geolocate.options);
        assert.deepEqual(config, original);
    }
});

test('empty and partial control objects are explicit lists', () => {
    assert.deepEqual(resolveMapOptions({ controls: {} }).controls, []);
    const options = resolveMapOptions({ controls: { zoom: true, scale: false } });
    assert.deepEqual(
        options.controls.map(({ name, visible }) => [name, visible]),
        [
            ['NavigationControl', true],
            ['ScaleControl', false]
        ]
    );
});

test('the existing five boolean keys remain supported', () => {
    const options = resolveMapOptions({
        controls: {
            zoom: true,
            scale: true,
            layerChooser: true,
            fullscreen: false,
            attribution: true
        }
    });
    assert.equal(options.controls.length, 5);
    assert.equal(
        options.controls.find((control) => control.name === 'OpenInNewTabControl')?.visible,
        false
    );
});

test('full names and names without Control resolve to the same registered types', () => {
    const full = resolveMapOptions({
        controls: {
            NavigationControl: {},
            ScaleControl: {},
            LayerChooserControl: {},
            OpenInNewTabControl: {},
            AttributionControl: {},
            GeolocateControl: {}
        }
    });
    const short = resolveMapOptions({
        controls: {
            Navigation: {},
            Scale: {},
            LayerChooser: {},
            OpenInNewTab: {},
            Attribution: {},
            Geolocate: {}
        }
    });
    assert.deepEqual(short.controls, full.controls);
    assert.equal(
        short.controls.find((control) => control.name === 'GeolocateControl')?.visible,
        true
    );
});

test('hidden controls retain constructor options and positions when enabled at runtime', () => {
    const config = {
        controls: {
            Geolocate: {
                visible: false,
                position: 'bottom-right' as const,
                options: { trackUserLocation: true, positionOptions: { enableHighAccuracy: true } }
            }
        }
    };
    const result = resolveMapOptions(config, { controls: { GeolocateControl: true } });
    assert.deepEqual(result.controls, [
        {
            name: 'GeolocateControl',
            visible: true,
            position: 'bottom-right',
            options: { trackUserLocation: true, positionOptions: { enableHighAccuracy: true } }
        }
    ]);
    assert.equal(config.controls.Geolocate.visible, false);
});

test('unknown names warn without stopping processing; duplicate aliases keep the first entry', (t) => {
    const warning = t.mock.method(console, 'warn', () => {});
    const options = resolveMapOptions({
        controls: {
            MysteryControl: true,
            zoom: false,
            Navigation: true,
            Scale: { options: { unit: 'nautical' } }
        }
    } as Parameters<typeof resolveMapOptions>[0]);
    assert.deepEqual(
        options.controls.map(({ name, visible }) => [name, visible]),
        [
            ['NavigationControl', false],
            ['ScaleControl', true]
        ]
    );
    assert.equal(warning.mock.callCount(), 2);
    assert.match(String(warning.mock.calls[0].arguments[0]), /MysteryControl/);
    assert.match(String(warning.mock.calls[1].arguments[0]), /duplicate/);
});

test('malformed entries are skipped and invalid positions fall back without stopping other controls', (t) => {
    t.mock.method(console, 'warn', () => {});
    const options = resolveMapOptions({
        controls: {
            Navigation: null,
            Scale: { position: 'center', options: { maxWidth: 150 } },
            Attribution: true
        }
    } as unknown as Parameters<typeof resolveMapOptions>[0]);
    assert.equal(options.controls.length, 2);
    assert.equal(options.controls[0].position, 'bottom-right');
    assert.deepEqual(options.controls[0].options, { unit: 'metric', maxWidth: 150 });
    assert.equal(options.controls[1].name, 'AttributionControl');
});

test('runtime control visibility overrides JSON visibility and keeps JSON options', () => {
    const result = resolveMapOptions(
        {
            controls: {
                OpenInNewTab: { visible: false, position: 'bottom-left' },
                Scale: { options: { unit: 'imperial' } }
            }
        },
        { controls: { fullscreen: true, scale: false } }
    );
    assert.equal(result.controls[0].visible, true);
    assert.equal(result.controls[0].position, 'bottom-left');
    assert.equal(result.controls[1].visible, false);
    assert.deepEqual(result.controls[1].options, { unit: 'imperial' });
});

test('runtime overrides can enable omitted controls using their defaults', () => {
    const result = resolveMapOptions(
        { controls: {} },
        { controls: { zoom: true, fullscreen: true, geolocate: true } }
    );
    assert.deepEqual(
        result.controls.map(({ name, visible }) => [name, visible]),
        [
            ['NavigationControl', true],
            ['OpenInNewTabControl', true],
            ['GeolocateControl', true]
        ]
    );
    assert.deepEqual(result.controls[0].options, { showCompass: false });
    assert.equal(result.controls[1].position, 'top-left');
    assert.deepEqual(result.controls[2].options, { trackUserLocation: 'auto' });
});

test('unknown runtime controls are ignored and duplicate runtime aliases use the first value', (t) => {
    const warning = t.mock.method(console, 'warn', () => {});
    const result = resolveMapOptions({ controls: {} }, {
        controls: {
            Unknown: true,
            fullscreen: false,
            OpenInNewTab: true,
            Geolocate: true
        }
    } as Parameters<typeof resolveMapOptions>[1]);
    assert.deepEqual(
        result.controls.map(({ name, visible }) => [name, visible]),
        [
            ['OpenInNewTabControl', false],
            ['GeolocateControl', true]
        ]
    );
    assert.equal(warning.mock.callCount(), 2);
});

test('runtime settings preserve explicit false and zero over JSON settings', () => {
    const config = {
        interaction: { mobileCooperativeGestures: true },
        rememberLastPosition: 'domain' as const
    };
    const result = resolveMapOptions(
        config,
        { mobileCooperativeGestures: false, rememberLastPosition: 0 }
    );
    assert.equal(result.interaction.mobileCooperativeGestures, false);
    assert.equal(result.rememberLastPosition, 0);
    assert.equal(
        resolveMapOptions(config, { mobileCooperativeGestures: false, rememberLastPosition: false })
            .rememberLastPosition,
        false
    );
    assert.equal(resolveMapOptions(config).rememberLastPosition, 'domain');
    assert.equal(
        resolveMapOptions({ interaction: { mobileCooperativeGestures: false } }).interaction
            .mobileCooperativeGestures,
        false
    );
});

test('omitted runtime settings preserve JSON false and zero', () => {
    const result = resolveMapOptions(
        {
            controls: { fullscreen: false },
            interaction: { mobileCooperativeGestures: false },
            rememberLastPosition: 0
        },
        {}
    );
    assert.equal(result.controls[0].visible, false);
    assert.equal(result.interaction.mobileCooperativeGestures, false);
    assert.equal(result.rememberLastPosition, 0);
});

test('interaction fields independently inherit the existing defaults', () => {
    assert.deepEqual(resolveMapOptions().interaction, {
        dragRotate: false,
        touchRotation: false,
        touchPitch: false,
        mobileCooperativeGestures: true
    });
    assert.deepEqual(resolveMapOptions({ interaction: { touchPitch: true } }).interaction, {
        dragRotate: false,
        touchRotation: false,
        touchPitch: true,
        mobileCooperativeGestures: true
    });
});

function mockInteractionMap() {
    const calls: string[] = [];
    const handler = (name: string) => ({
        enable: () => calls.push(`${name}.enable`),
        disable: () => calls.push(`${name}.disable`)
    });
    const map = {
        dragRotate: handler('dragRotate'),
        touchPitch: handler('touchPitch'),
        cooperativeGestures: handler('cooperativeGestures'),
        touchZoomRotate: {
            enableRotation: () => calls.push('rotation.enable'),
            disableRotation: () => calls.push('rotation.disable'),
            enable: () => assert.fail('Pinch zoom must not be toggled'),
            disable: () => assert.fail('Pinch zoom must not be toggled')
        }
    };
    return { map: map as unknown as Parameters<typeof applyInteractions>[0], calls };
}

test('default interactions disable rotation and pitch while preserving pinch zoom', () => {
    const { map, calls } = mockInteractionMap();
    applyInteractions(map, resolveMapOptions().interaction, true);
    assert.deepEqual(calls, [
        'dragRotate.disable',
        'rotation.disable',
        'touchPitch.disable',
        'cooperativeGestures.enable'
    ]);
});

test('enabled interaction fields call their corresponding handlers', () => {
    const { map, calls } = mockInteractionMap();
    applyInteractions(
        map,
        resolveMapOptions({
            interaction: { dragRotate: true, touchRotation: true, touchPitch: true }
        }).interaction,
        false
    );
    assert.deepEqual(calls, [
        'dragRotate.enable',
        'rotation.enable',
        'touchPitch.enable',
        'cooperativeGestures.disable'
    ]);
});

test('cooperative gestures stay disabled on desktop and respect a mobile runtime override', () => {
    const desktop = mockInteractionMap();
    applyInteractions(desktop.map, resolveMapOptions().interaction, false);
    assert.equal(desktop.calls.at(-1), 'cooperativeGestures.disable');
    const mobile = mockInteractionMap();
    applyInteractions(
        mobile.map,
        resolveMapOptions({}, { mobileCooperativeGestures: false }).interaction,
        true
    );
    assert.equal(mobile.calls.at(-1), 'cooperativeGestures.disable');
});

test('iPads share mobile geolocation and cooperative gesture behavior', () => {
    for (const userAgent of [
        'Mozilla/5.0 (iPad; CPU OS 12_0 like Mac OS X)',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)'
    ]) {
        const mobile = isMobile({ userAgent, platform: 'MacIntel', maxTouchPoints: 5 }, {});
        assert.equal(
            resolveGeolocateOptions({ trackUserLocation: 'auto' }, mobile).trackUserLocation,
            true
        );
        const map = mockInteractionMap();
        applyInteractions(map.map, resolveMapOptions().interaction, mobile);
        assert.equal(map.calls.at(-1), 'cooperativeGestures.enable');
        applyInteractions(
            map.map,
            resolveMapOptions({ interaction: { mobileCooperativeGestures: false } }).interaction,
            mobile
        );
        assert.equal(map.calls.at(-1), 'cooperativeGestures.disable');
    }
});
