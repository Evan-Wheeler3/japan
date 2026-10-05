// Which map this page is running, chosen once at boot before the world is built: the snowy Tokyo street the shop
// stands on, or the cliff-top lot above the sea (the night parade's map, and the shop's old home).
// Everything that depends on where things are reads it from here: the world and its props, the counters, the
// stations, the belt, where guests come from and sit, the apartment, the doors, the lights and the view.
export let MAP = null;
export function setMap(m) { MAP = m; }
