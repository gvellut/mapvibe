import {
    AttributionControl,
    GeolocateControl,
    NavigationControl,
    ScaleControl,
    type IControl,
    type Map
} from 'maplibre-gl';
import { resolveGeolocateOptions, type ResolvedControl } from './controlConfig';
import { isMobile } from '../utils/deviceDetection';
import { ReactControlHost } from './reactControlHost';

export class FullscreenControl implements IControl {
    private container: HTMLDivElement | undefined;

    onAdd(): HTMLElement {
        this.container = document.createElement('div');
        this.container.className = 'maplibregl-ctrl maplibregl-ctrl-group custom-fullscreen-btn';
        const button = document.createElement('button');
        button.type = 'button';
        button.title = 'See larger';
        button.setAttribute('aria-label', button.title);
        button.appendChild(document.createElement('span'));
        button.onclick = () => {
            const url = new URL(window.location.href);
            // Disable cooperative gestures and the new-tab button in the larger view.
            url.searchParams.set('mgc', 'no');
            url.searchParams.set('fs', 'no');
            window.open(url.href, '_blank', 'noopener');
        };
        this.container.appendChild(button);
        return this.container;
    }

    onRemove(): void {
        this.container?.remove();
        this.container = undefined;
    }
}

export class LayerChooserControl extends ReactControlHost {
    constructor(
        position: import('maplibre-gl').ControlPosition,
        onHostChange: (host: HTMLElement | null) => void
    ) {
        super(position, onHostChange, 'custom-layer-chooser');
    }
}

export function installControls(
    map: Map,
    controls: ResolvedControl[],
    onLayerChooserHostChange: (host: HTMLElement | null) => void
): void {
    for (const config of controls) {
        if (!config.visible) continue;
        let control: IControl;
        // Keep construction explicit when adding new registered control types.
        switch (config.name) {
            case 'NavigationControl':
                control = new NavigationControl(config.options);
                break;
            case 'ScaleControl':
                control = new ScaleControl(config.options);
                break;
            case 'AttributionControl':
                control = new AttributionControl(config.options);
                break;
            case 'GeolocateControl':
                // Select tracking mode without activating geolocation.
                control = new GeolocateControl(resolveGeolocateOptions(config.options, isMobile()));
                break;
            case 'LayerChooserControl':
                control = new LayerChooserControl(config.position, onLayerChooserHostChange);
                break;
            case 'FullscreenControl':
                control = new FullscreenControl();
                break;
        }
        map.addControl(control, config.position);
    }
}
