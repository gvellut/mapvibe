import React, { useState, useEffect } from 'react';
import { MapVibeMap, type AppConfig } from './lib';
import {
    type RememberLastPositionScope,
    normalizeRememberLastPosition
} from './lib/rememberLastPosition';
import { normalizeOptionalBooleanString } from './lib/stringBoolean';

const MOBILE_COOPERATIVE_GESTURES_PARAM = "mgc";
const REMEMBER_LAST_POSITION_PARAM = "rlp";
const FULLSCREEN_PARAM = "fs";

const App: React.FC = () => {
    const [config, setConfig] = useState<AppConfig | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [mobileCooperativeGestures, setMobileCooperativeGestures] = useState<boolean>(true);
    const [rememberLastPosition, setRememberLastPosition] = useState<RememberLastPositionScope>(false);
    const [fullscreen, setFullscreen] = useState<boolean | null>(null);

    useEffect(() => {
        const initializeApp = async () => {
            const urlParams = new URLSearchParams(window.location.search);
            const configUrl = urlParams.get('config');
            const mobileCooperativeGesturesParam = urlParams.get(MOBILE_COOPERATIVE_GESTURES_PARAM);
            const rememberLastPositionParam = urlParams.get(REMEMBER_LAST_POSITION_PARAM);
            const fullscreenParam = urlParams.get(FULLSCREEN_PARAM);

            const mobileCooperativeGesturesOverride = normalizeOptionalBooleanString(mobileCooperativeGesturesParam);
            if (mobileCooperativeGesturesOverride !== null) {
                setMobileCooperativeGestures(mobileCooperativeGesturesOverride);
            }
            setRememberLastPosition(normalizeRememberLastPosition(rememberLastPositionParam));
            setFullscreen(normalizeOptionalBooleanString(fullscreenParam));

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
                setError(`Error initializing application: ${err instanceof Error ? err.message : String(err)}`);
            }
        };

        initializeApp();
    }, []);

    if (error) {
        return <div style={{ padding: '20px', fontFamily: 'sans-serif', color: 'red' }}>{error}</div>;
    }

    if (!config) {
        return <div>Loading...</div>;
    }

    return (
        <MapVibeMap
            config={config}
            mobileCooperativeGestures={mobileCooperativeGestures}
            rememberLastPosition={rememberLastPosition}
            fullscreen={fullscreen}
        />
    );
};

export default App;
