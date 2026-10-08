export function isMobile(
    browserNavigator: Pick<Navigator, 'userAgent' | 'platform' | 'maxTouchPoints'> = navigator,
    browserWindow: object = window
): boolean {
    const hasTouch = 'ontouchstart' in browserWindow || browserNavigator.maxTouchPoints > 0;
    const isLikelyMobile = /Mobi|Android|iPhone|iPad/i.test(browserNavigator.userAgent);
    // iPadOS can identify as a Mac when requesting desktop websites.
    const isDesktopModeIPad =
        browserNavigator.platform === 'MacIntel' && browserNavigator.maxTouchPoints > 1;
    return hasTouch && (isLikelyMobile || isDesktopModeIPad);
}
