import type { ControlPosition, IControl } from 'maplibre-gl';

/** A MapLibre container whose React content remains in the caller's React tree. */
export class ReactControlHost implements IControl {
    private container: HTMLDivElement | undefined;

    private position: ControlPosition;
    private onHostChange: (host: HTMLElement | null) => void;
    private className: string;

    constructor(
        position: ControlPosition,
        onHostChange: (host: HTMLElement | null) => void,
        className = 'mapvibe-react-control'
    ) {
        this.position = position;
        this.onHostChange = onHostChange;
        this.className = className;
    }

    onAdd(): HTMLElement {
        this.container = document.createElement('div');
        this.container.className = `maplibregl-ctrl maplibregl-ctrl-group ${this.className}`;
        this.container.dataset.position = this.position;
        // Keep chooser clicks, scrolling, and gestures from reaching map handlers.
        for (const eventName of [
            'mousedown',
            'touchstart',
            'pointerdown',
            'click',
            'dblclick',
            'contextmenu',
            'wheel',
            'keydown'
        ]) {
            this.container.addEventListener(eventName, (event) => event.stopPropagation());
        }
        this.onHostChange(this.container);
        return this.container;
    }

    onRemove(): void {
        this.onHostChange(null);
        this.container?.remove();
        this.container = undefined;
    }
}
