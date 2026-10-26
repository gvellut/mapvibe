Think about it 

customUi.dataLayers determines the order in the chooser.
The top-level layers array determines the map’s stacking: earlier layers are lower; later layers are higher. Initialization preserves that order. See [style initialization (line 47)](/Users/guilhem/dev/projects/github/cartesgouvfr_pwa/mapvibe_link/src/lib/styles/backgrounds.ts:47).

change : reorder the top level layers array : stacking must be reordered according to data kaeyrs / background layers : 
- background layers always at the bottom
- data layers stacking : first in the section => below in the stacking