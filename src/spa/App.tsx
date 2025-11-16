import React, { useState, useEffect } from 'react';
import { MapVibeMap, type AppConfig } from '../lib';

const MOBILE_COOPERATIVE_GESTURES_PARAM = "mgc";

const App: React.FC = () => {
    const [config, setConfig] = useState<AppConfig | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [mobileCooperativeGestures, setMobileCooperativeGestures] = useState<boolean>(true);

    useEffect(() => {
        const initializeApp = async () => {
            const urlParams = new URLSearchParams(window.location.search);
            const configUrl = urlParams.get('config');
            const mobileCooperativeGesturesParam = urlParams.get(MOBILE_COOPERATIVE_GESTURES_PARAM);

            if (mobileCooperativeGesturesParam) {
                setMobileCooperativeGestures(!['false', '0', 'n', 'no'].includes(mobileCooperativeGesturesParam.toLowerCase()));
            }

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

    return <MapVibeMap config={config} mobileCooperativeGestures={mobileCooperativeGestures} />;
};

export default App;
