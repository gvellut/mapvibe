import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveMapOptions } from '../src/lib/map/controlConfig.ts';
import { ReactControlHost } from '../src/lib/map/reactControlHost.ts';

test('host controls resolve options, visibility and positions without replacing built-ins', (t) => {
    const warning = t.mock.method(console, 'warn', () => {});
    const config = { controls: {
        Host: { position: 'bottom-right' as const, visible: false, options: { draggable: true } },
        zoom: true,
        Missing: true
    } };
    const original = structuredClone(config);
    const resolved = resolveMapOptions(config, { controls: { Host: true } }, ['Host', 'zoom']);
    assert.deepEqual(resolved.customControls, [{ name: 'Host', position: 'bottom-right', visible: true, options: { draggable: true } }]);
    assert.equal(resolved.controls[0].name, 'NavigationControl');
    assert.equal(warning.mock.callCount(), 1);
    assert.deepEqual(config, original);
    assert.deepEqual(resolveMapOptions({}, {}, ['Host']).customControls, []);
    assert.deepEqual(resolveMapOptions({}, { controls: { Host: true } }, ['Host']).customControls[0], { name: 'Host', position: 'top-right', visible: true, options: {} });
});

test('host controls validate position and options and preserve false overrides', (t) => {
    const warning = t.mock.method(console, 'warn', () => {});
    const result = resolveMapOptions({ controls: { Host: { position: 'outside', options: [] } } } as never, { controls: { Host: false } }, ['Host']);
    assert.deepEqual(result.customControls, [{ name: 'Host', visible: false, position: 'top-right', options: {} }]);
    assert.equal(warning.mock.callCount(), 2);
});

test('React hosts publish their corner container, isolate gestures, and clean up', (t) => {
    class Element extends EventTarget {
        className = '';
        dataset: Record<string, string> = {};
        removed = false;
        remove() { this.removed = true; }
    }
    const element = new Element();
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => element } });
    t.after(() => Reflect.deleteProperty(globalThis, 'document'));
    const hosts: (HTMLElement | null)[] = [];
    const control = new ReactControlHost('bottom-left', (host) => hosts.push(host));
    assert.equal(control.onAdd(), element);
    assert.equal(element.dataset.position, 'bottom-left');
    assert.match(element.className, /maplibregl-ctrl-group/);
    const event = new Event('wheel', { bubbles: true });
    element.dispatchEvent(event);
    assert.equal(event.cancelBubble, true);
    control.onRemove();
    assert.equal(element.removed, true);
    assert.deepEqual(hosts, [element, null]);
});
