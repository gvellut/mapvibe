import {
    AttributionControl,
    type AttributionControlOptions,
    type ControlPosition,
    type Map
} from 'maplibre-gl';

/** MapLibre attribution that starts collapsed when compact mode is enabled. */
export class InitiallyCollapsedAttributionControl extends AttributionControl {
    constructor(options: AttributionControlOptions = {}) {
        super({ compact: true, ...options });
    }

    override getDefaultPosition(): ControlPosition {
        return 'bottom-left';
    }

    override onAdd(map: Map): HTMLElement {
        const element = super.onAdd(map);
        // Scope interaction styling to this control while preserving keyboard focus.
        element.classList.add('mapvibe-initially-collapsed-attribution');
        if (this.options.compact === true) {
            // Establish compact mode even before source attribution arrives, so updates stay closed.
            element.classList.add('maplibregl-compact');
            element.classList.remove('maplibregl-compact-show');
            element.removeAttribute('open');
        }
        return element;
    }
}
