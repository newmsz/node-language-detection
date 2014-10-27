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

console.log(langdetect.detect('Questo a che ora comincia? I don\'t know'));

/**
 * [ { lang: 'it', prob: 0.5714266536058858 }, { lang: 'en', prob: 0.42857225563212514 } ]
 */
 
console.log(langdetect.detectOne('Questo a che ora comincia?'));

/**
 * 'it'
 */
```

Licence
=======
Apache License 2.0