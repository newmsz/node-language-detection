node-language-detection
=======================
Language-detection library for node.js. You can find the original version (Java) at https://code.google.com/p/language-detection.

Install
=======
```
npm install langdetect
```

Usage
=====
```
var langdetect = require('langdetect');

console.log(langdetect.detect('Questo a che ora comincia?'));
```

Then you will see.

```
[ { lang: 'it', prob: 0.9999962641757836 } ]
```

Licence
=======
Apache License 2.0