import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isMobile } from '../src/lib/utils/deviceDetection.ts';

const devices = [
    {
        name: 'iPhone',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        platform: 'iPhone',
        maxTouchPoints: 5,
        mobile: true
    },
    {
        name: 'Android tablet',
        userAgent: 'Mozilla/5.0 (Linux; Android 14)',
        platform: 'Linux armv8l',
        maxTouchPoints: 5,
        mobile: true
    },
    {
        name: 'other mobile user agent',
        userAgent: 'Mozilla/5.0 Mobile',
        platform: 'Linux',
        maxTouchPoints: 1,
        mobile: true
    },
    {
        name: 'classic iPad',
        userAgent: 'Mozilla/5.0 (iPad; CPU OS 12_0 like Mac OS X)',
        platform: 'iPad',
        maxTouchPoints: 5,
        mobile: true
    },
    {
        name: 'iPadOS desktop mode',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)',
        platform: 'MacIntel',
        maxTouchPoints: 5,
        mobile: true
    },
    {
        name: 'ordinary Mac',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)',
        platform: 'MacIntel',
        maxTouchPoints: 0,
        mobile: false
    },
    {
        name: 'single-touch Mac platform',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)',
        platform: 'MacIntel',
        maxTouchPoints: 1,
        mobile: false
    },
    {
        name: 'Windows touchscreen desktop',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        platform: 'Win32',
        maxTouchPoints: 10,
        mobile: false
    },
    {
        name: 'mobile user agent without touch support',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        platform: 'iPhone',
        maxTouchPoints: 0,
        mobile: false
    }
];

for (const { name, mobile, ...browserNavigator } of devices) {
    test(`device detection classifies ${name} as ${mobile ? 'mobile' : 'desktop'}`, () => {
        assert.equal(isMobile(browserNavigator, {}), mobile);
    });
}

test('touch event support detects mobile devices even without reported touch points', () => {
    assert.equal(
        isMobile(
            { userAgent: 'iPad', platform: 'iPad', maxTouchPoints: 0 },
            {
                ontouchstart: null
            }
        ),
        true
    );
});

test('touch event support alone does not turn a desktop into a mobile device', () => {
    assert.equal(
        isMobile(
            { userAgent: 'Macintosh', platform: 'MacIntel', maxTouchPoints: 0 },
            {
                ontouchstart: null
            }
        ),
        false
    );
});
