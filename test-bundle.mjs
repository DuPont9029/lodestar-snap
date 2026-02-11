
import * as L from './node_modules/@lodestar/light-client/dist/lightclient.min.mjs';
console.log(Object.keys(L));
if (L.default) {
    console.log('Default export keys:', Object.keys(L.default));
    if (L.default.transport) console.log('Transport keys:', Object.keys(L.default.transport));
    if (L.default.utils) console.log('Utils keys:', Object.keys(L.default.utils));
}
