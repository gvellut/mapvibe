Add a parameter : it should be rememberLastPosition : "domain", "page" / false/0 (default false, like now). Also allow true/1 : same as : "page"
It should be a property like mobileCooperativeGesture. It can also be obtained from the URL (when using mavibe as an iframe) like urlParams.get(MOBILE_COOPERATIVE_GESTURES_PARAM).
When set to not false : the mapvibe component should save to LocalStorage its last location (pan , zoom) and load it when reloaded, so ignore the center or bounding Box in that case. That location should take precedence
Note that if false : even if there exists the location in LocalStorage, it should not be loaded.
The storage should be scoped to the domain/ subdomain or domain/subdomain + path of the page where mapvibe component is loaded (either as an iframe so the domain of the iframe or as a component in a larger app). So we can use the mapvibe component in multiple places but they dont walk over each other.
