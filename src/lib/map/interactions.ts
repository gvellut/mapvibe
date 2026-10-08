import type { Map } from 'maplibre-gl';
import type { InteractionConfig } from './controlConfig';

type InteractionMap = Pick<
    Map,
    'dragRotate' | 'touchZoomRotate' | 'touchPitch' | 'cooperativeGestures'
>;

export function applyInteractions(
    map: InteractionMap,
    interaction: Required<InteractionConfig>,
    mobile: boolean
): void {
    if (interaction.dragRotate) {
        map.dragRotate.enable();
    } else {
        map.dragRotate.disable();
    }
    // Toggle touch rotation independently, preserving pinch zoom.
    if (interaction.touchRotation) {
        map.touchZoomRotate.enableRotation();
    } else {
        map.touchZoomRotate.disableRotation();
    }
    if (interaction.touchPitch) {
        map.touchPitch.enable();
    } else {
        map.touchPitch.disable();
    }
    // Keep the existing mobile-only cooperative gestures behavior.
    if (interaction.mobileCooperativeGestures && mobile) {
        map.cooperativeGestures.enable();
    } else {
        map.cooperativeGestures.disable();
    }
}
