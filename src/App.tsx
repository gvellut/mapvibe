import React, { useState, useEffect } from 'react';
import { MapVibeMap, type AppConfig, type MapVibeRuntimeOptions } from './lib';
import { normalizeRememberLastPosition } from './lib/rememberLastPosition';
import { normalizeOptionalBooleanString } from './lib/stringBoolean';

const MOBILE_COOPERATIVE_GESTURES_PARAM = 'mgc';
const REMEMBER_LAST_POSITION_PARAM = 'rlp';
const FULLSCREEN_PARAM = 'fs';

const App: React.FC = () => {
    const [config, setConfig] = useState<AppConfig | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [runtimeOptions, setRuntimeOptions] = useState<MapVibeRuntimeOptions>({});

    useEffect(() => {
        const initializeApp = async () => {
            const urlParams = new URLSearchParams(window.location.search);
            const configUrl = urlParams.get('config');
            const mobileCooperativeGesturesParam = urlParams.get(MOBILE_COOPERATIVE_GESTURES_PARAM);
            const rememberLastPositionParam = urlParams.get(REMEMBER_LAST_POSITION_PARAM);
            const fullscreenParam = urlParams.get(FULLSCREEN_PARAM);

            const options: MapVibeRuntimeOptions = {};
            const mobileCooperativeGesturesOverride = normalizeOptionalBooleanString(
                mobileCooperativeGesturesParam
            );
            if (mobileCooperativeGesturesOverride !== null) {
                options.mobileCooperativeGestures = mobileCooperativeGesturesOverride;
            }
            const fullscreenOverride = normalizeOptionalBooleanString(fullscreenParam);
            if (fullscreenOverride !== null) {
                options.controls = { fullscreen: fullscreenOverride };
            }
            // Missing or invalid URL values defer to JSON instead of forcing the runtime default.
            const rememberScope = rememberLastPositionParam?.trim().toLowerCase();
            if (
                normalizeOptionalBooleanString(rememberLastPositionParam) !== null ||
                rememberScope === 'page' ||
                rememberScope === 'domain'
            ) {
                options.rememberLastPosition =
                    normalizeRememberLastPosition(rememberLastPositionParam);
            }
            setRuntimeOptions(options);

            if (!configUrl) {
                setError('Error: The `config` URL parameter is missing.');
                return;
            }

            try {
                const response = await fetch(configUrl);
                if (!response.ok) {
                    throw new Error(`Failed to fetch config file: ${response.statusText}`);
                }
                const configData = await response.json();

                if (configData.title) {
                    document.title = configData.title;
                }

                setConfig(configData);
            } catch (err) {
                setError(
                    `Error initializing application: ${err instanceof Error ? err.message : String(err)}`
                );
            }
        };

        initializeApp();
    }, []);

    if (error) {
        return (
            <div style={{ padding: '20px', fontFamily: 'sans-serif', color: 'red' }}>{error}</div>
        );
    }

    if (!config) {
        return <div>Loading...</div>;
    }

    return <MapVibeMap config={config} runtimeOptions={runtimeOptions} />;
};

export default App;
