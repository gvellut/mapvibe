import type {
    AttributionControlOptions,
    ControlPosition,
    GeolocateControlOptions,
    NavigationControlOptions,
    ScaleControlOptions
} from 'maplibre-gl';
import type { RememberLastPositionValue } from './rememberLastPosition';

interface ControlOptionsByName {
    NavigationControl: NavigationControlOptions;
    ScaleControl: ScaleControlOptions;
    LayerChooserControl: Record<string, never>;
    OpenInNewTabControl: Record<string, never>;
    AttributionControl: AttributionControlOptions;
    GeolocateControl: GeolocateControlOptions;
}

// Register supported controls explicitly; configuration never selects arbitrary constructors.
export const CONTROL_REGISTRY = {
    NavigationControl: {
        aliases: ['Navigation', 'zoom'],
        position: 'top-left',
        options: { showCompass: false },
        visible: true
    },
    ScaleControl: {
        aliases: ['Scale', 'scale'],
        position: 'bottom-right',
        options: { unit: 'metric' },
        visible: true
    },
    LayerChooserControl: {
        aliases: ['LayerChooser', 'layerChooser'],
        position: 'top-right',
        options: {},
        visible: true
    },
    OpenInNewTabControl: {
        aliases: ['OpenInNewTab', 'fullscreen'],
        position: 'top-left',
        options: {},
        visible: true
    },
    AttributionControl: {
        aliases: ['Attribution', 'attribution'],
        position: 'bottom-left',
        options: { compact: false },
        visible: true
    },
    GeolocateControl: {
        aliases: ['Geolocate', 'geolocate'],
        position: 'top-left',
        options: {},
        visible: false
    }
} as const satisfies {
    [Name in keyof ControlOptionsByName]: {
        aliases: readonly string[];
        position: ControlPosition;
        options: ControlOptionsByName[Name];
        visible: boolean;
    };
};

export type ControlName = keyof typeof CONTROL_REGISTRY;
export type ControlAlias = ControlName | (typeof CONTROL_REGISTRY)[ControlName]['aliases'][number];

export interface ControlConfig<Options = Record<string, never>> {
    visible?: boolean;
    position?: ControlPosition;
    options?: Options;
}

export type ControlsConfig = {
    [Name in ControlName as Name | (typeof CONTROL_REGISTRY)[Name]['aliases'][number]]?:
        | boolean
        | ControlConfig<ControlOptionsByName[Name]>;
};

export type ControlVisibilityOverrides = Partial<Record<ControlAlias, boolean>>;

export interface InteractionConfig {
    dragRotate?: boolean;
    touchRotation?: boolean;
    touchPitch?: boolean;
    mobileCooperativeGestures?: boolean;
}

export interface MapVibeRuntimeOptions {
    controls?: ControlVisibilityOverrides;
    mobileCooperativeGestures?: boolean;
    rememberLastPosition?: RememberLastPositionValue;
}

export interface LegacyRuntimeOptions {
    fullscreen?: boolean | null;
    mobileCooperativeGestures?: boolean;
    rememberLastPosition?: RememberLastPositionValue;
}

export type ResolvedControl = {
    [Name in ControlName]: {
        name: Name;
        visible: boolean;
        position: ControlPosition;
        options: ControlOptionsByName[Name];
    };
}[ControlName];

export interface ResolvedMapOptions {
    controls: ResolvedControl[];
    interaction: Required<InteractionConfig>;
    rememberLastPosition: RememberLastPositionValue;
}

const DEFAULT_INTERACTION: Required<InteractionConfig> = {
    dragRotate: false,
    touchRotation: false,
    touchPitch: false,
    mobileCooperativeGestures: true
};
const CONTROL_POSITIONS: readonly ControlPosition[] = [
    'top-left',
    'top-right',
    'bottom-left',
    'bottom-right'
];

function getControlName(name: string): ControlName | undefined {
    return (Object.keys(CONTROL_REGISTRY) as ControlName[]).find(
        (controlName) =>
            controlName === name ||
            (CONTROL_REGISTRY[controlName].aliases as readonly string[]).includes(name)
    );
}

function defaultControl(name: ControlName): ResolvedControl {
    const defaults = CONTROL_REGISTRY[name];
    return {
        name,
        visible: defaults.visible,
        position: defaults.position,
        options: { ...defaults.options }
    } as ResolvedControl;
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function resolveControls(config: ControlsConfig | undefined): ResolvedControl[] {
    if (config === undefined) {
        return (Object.keys(CONTROL_REGISTRY) as ControlName[]).map(defaultControl);
    }
    if (!isObject(config)) {
        console.warn('Ignoring invalid customUi.controls: expected an object.');
        return [];
    }

    const controls: ResolvedControl[] = [];
    const seen = new Set<ControlName>();
    for (const [alias, value] of Object.entries(config)) {
        const name = getControlName(alias);
        if (!name) {
            console.warn(`Ignoring unknown MapVibe control "${alias}".`);
            continue;
        }
        if (seen.has(name)) {
            console.warn(
                `Ignoring duplicate MapVibe control "${alias}"; the first entry for ${name} wins.`
            );
            continue;
        }
        if (typeof value !== 'boolean' && !isObject(value)) {
            console.warn(`Ignoring invalid configuration for MapVibe control "${alias}".`);
            continue;
        }
        seen.add(name);

        const control = defaultControl(name);
        control.visible = typeof value === 'boolean' ? value : value.visible !== false;
        if (isObject(value)) {
            if (value.position !== undefined) {
                if (CONTROL_POSITIONS.includes(value.position as ControlPosition)) {
                    control.position = value.position as ControlPosition;
                } else {
                    console.warn(
                        `Invalid position for MapVibe control "${alias}"; using ${control.position}.`
                    );
                }
            }
            if (value.options !== undefined) {
                if (isObject(value.options)) {
                    control.options = { ...control.options, ...value.options };
                } else {
                    console.warn(`Invalid options for MapVibe control "${alias}"; using defaults.`);
                }
            }
        }
        controls.push(control);
    }
    return controls;
}

function applyVisibilityOverrides(
    controls: ResolvedControl[],
    overrides: ControlVisibilityOverrides | undefined
): void {
    if (!overrides) return;
    const seen = new Set<ControlName>();
    for (const [alias, visible] of Object.entries(overrides)) {
        const name = getControlName(alias);
        if (!name) {
            console.warn(`Ignoring unknown MapVibe control override "${alias}".`);
            continue;
        }
        if (seen.has(name)) {
            console.warn(
                `Ignoring duplicate MapVibe control override "${alias}"; the first entry for ${name} wins.`
            );
            continue;
        }
        if (typeof visible !== 'boolean') continue;
        seen.add(name);

        let control = controls.find((entry) => entry.name === name);
        if (!control) {
            control = defaultControl(name);
            controls.push(control);
        }
        control.visible = visible;
    }
}

export function resolveMapOptions(
    config: {
        controls?: ControlsConfig;
        interaction?: InteractionConfig;
        rememberLastPosition?: RememberLastPositionValue;
    } = {},
    runtimeOptions: MapVibeRuntimeOptions = {},
    legacyOptions: LegacyRuntimeOptions = {}
): ResolvedMapOptions {
    const controls = resolveControls(config.controls);
    // Apply the compatibility prop first, so the new runtime structure has precedence.
    if (legacyOptions.fullscreen != null) {
        applyVisibilityOverrides(controls, { fullscreen: legacyOptions.fullscreen });
    }
    applyVisibilityOverrides(controls, runtimeOptions.controls);

    const interaction = { ...DEFAULT_INTERACTION };
    for (const key of Object.keys(DEFAULT_INTERACTION) as (keyof InteractionConfig)[]) {
        if (typeof config.interaction?.[key] === 'boolean') {
            interaction[key] = config.interaction[key];
        }
    }
    interaction.mobileCooperativeGestures =
        runtimeOptions.mobileCooperativeGestures ??
        legacyOptions.mobileCooperativeGestures ??
        interaction.mobileCooperativeGestures;

    return {
        controls,
        interaction,
        rememberLastPosition:
            runtimeOptions.rememberLastPosition ??
            legacyOptions.rememberLastPosition ??
            config.rememberLastPosition ??
            false
    };
}
