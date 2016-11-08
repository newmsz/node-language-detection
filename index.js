var fs = require('fs'),
	unicode = require('unicode-9.0.0');
var profiles = 'profiles';

var _langlist = [];
	_wordLangProbMap = {};

var URL_REGEX = /[-a-zA-Z0-9@:%_\+.~#?&//=]{2,256}\.[a-z]{2,4}\b(\/[-a-zA-Z0-9@:%_\+.~#?&//=]*)?/gi,
	MAIL_REGEX = /(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))/gi,
	LATIN1_EXCLUDED = '\u00A0\u00AB\u00B0\u00BB',
	CJKS = '',
	N_GRAM = 3,
	TRIALS = 7,
	PROB_THRESHOLD = 0.1,
	ALPHA_DEFAULT = 0.5,
	ALPHA_WIDTH = 0.05,
	ITERATION_LIMIT = 1000,
	BASE_FREQ = 10000,
	CONV_THRESHOLD = 0.99999,
	MAX_TEXT_LENGTH = 10000;

exports.detect = function (text) {
	text = normalizeText(text);
	text = reduceSpace(text);
	text = cleanText(text);

	var ngrams = extractNGram(text);
	if(ngrams.length == 0) return null;

	var langprob = new Array(_langlist.length),
	    priorMap = null,
	    alpha = ALPHA_WIDTH;

	for(var j=0; j<langprob.length; j++) langprob[j] = 0;

	for(var i=0; i< TRIALS; i++) {
	    var prob = new Array(_langlist.length),
	        current_alpha = alpha + Math.random() * ALPHA_WIDTH;

	    var updateLangProb = function (word) {
	        if (!word || !_wordLangProbMap[word]) return false;

	        var langProbMap = _wordLangProbMap[word],
	            weight = current_alpha / BASE_FREQ;

	        for (var k=0; k<prob.length; k++) {
	            prob[k] *= weight + (langProbMap[k] ? langProbMap[k] :  0);
	        }

	        return true;
	    }, normalizeProb = function () {
	        var maxp = 0, sump = 0;
	        for(var k=0; k<prob.length; k++) sump += prob[k];
	        for(var k=0; k<prob.length; k++) {
	            var p = prob[k] / sump;
	            if (maxp < p) maxp = p;
	            prob[k] = p;
	        }
	        return maxp;
	    }

        if (priorMap) {
            for(var j=0; j<prob.length; j++) prob[j] = priorMap[j];
        } else {
            for(var j=0; j<prob.length; j++) prob[j] = 1.0 / _langlist.length;
        }

        for(var j=0;; j++) {
            var r = parseInt(Math.random() * ngrams.length);
            updateLangProb(ngrams[r]);

            if(j % 5 == 0) {
                if (normalizeProb(prob) > CONV_THRESHOLD || j >= ITERATION_LIMIT) break;
            }
        }

        for(var j=0; j<langprob.length; j++) langprob[j] += (prob[j] || 0) / TRIALS;
	}

	var retlist = [];
	for(var i=0; i<langprob.length; i++) {
	    var p = langprob[i];
	    if(p > PROB_THRESHOLD) {
	        retlist.push({
	            lang: _langlist[i],
	            prob: p
	        });
	    }
	}

	retlist.sort(function (a, b) { return b.prob - a.prob; });

	return retlist;
};

exports.detectOne = function (text) {
    var langs = exports.detect(text);
    return langs.length > 0 ? langs[0].lang : null;
};

function normalizeText (text) {
	text = text.replace(URL_REGEX, ' ');
	text = text.replace(MAIL_REGEX, ' ');

	return text;
}

function reduceSpace (text) {
	var pre = null, ret = '';
	for(var i=0; (i<text.length) && (i<MAX_TEXT_LENGTH); i++) {
		var c = text[i];
		if(c != ' ' || pre != ' ') ret += c;
		pre = c;
	}

	return ret;
}

function cleanText (text) {
	var latinCount = 0, nonLatinText = '';

	for(var i=0; i<text.length; i++) {
		var c = text[i]
		if(c <= 'z' && c >= 'A') {
			++latinCount;
		} else if (c >= '\u0300' && (getUnicodeBlock(c) != 'Latin Extended Additional')) {
			nonLatinText += c;
		}
	}

	if (latinCount * 2 < nonLatinText.length)
		return nonLatinText;

	return text;
}

function extractNGram (text) {
    var grams_ = ' ',
        capitalword_ = false,
        list = [];

	for(var i=0; i<text.length; i++) {
	    // NGram.addChar
		var ch = normalize(text[i]),
		    lastchar = grams_[grams_.length - 1],
		    do_not_add = false;

		if(lastchar == ' ') {
		    grams_ = ' ';
            capitalword_ = false;
            if (ch == ' ') do_not_add = true;
		} else if(grams_.length >= N_GRAM) {
		    grams_ = grams_.substring(1, grams_.length);
		}

		if(!do_not_add) {
		    grams_ += ch;

	        if(ch != ch.toLowerCase()) {
	            if (lastchar != lastchar.toLowerCase()) capitalword_ = true;
	        } else {
	            capitalword_ = false;
	        }
		}

		for(var n=1; n<=N_GRAM; n++) {
		    var w = null;
		    // NGram.get
		    if(!capitalword_) {
		        var len = grams_.length;
		        if(n >= 1 && n <= 3 && len >= n) {
		            if(n == 1 && grams_[len - 1] != ' ') w = grams_[len - 1];
		            else w = grams_.substring(len - n, len);
		        }
		    }

		    if(w && _wordLangProbMap[w]) list.push(w);
        }
	}

	return list;
}

function normalize (ch) {
	var ub = getUnicodeBlock(ch);
	switch(ub) {
	case 'Basic Latin': if(ch < 'A' || (ch < 'a' && ch > 'Z') || ch > 'z') ch = ' '; break;
	case 'Latin-1 Supplement': if(LATIN1_EXCLUDED.indexOf(ch) >= 0) ch = ' '; break;
	case 'Latin Extended-B':
		// normalization for Romanian
		if (ch == '\u0219') ch = '\u015f'; // Small S with comma below => with cedilla
		if (ch == '\u021b') ch = '\u0163'; // Small T with comma below => with cedilla
		break;
	case 'Latin Extended Additional': if (ch >= '\u1ea0') ch = '\u1ec3'; break;
	case 'Arabic': if (ch == '\u06cc') ch = '\u064a'; break; // Farsi yeh => Arabic yeh
	case 'Hiragana': ch = '\u3042'; break;
	case 'Katakana': ch = '\u30a2'; break;
	case 'Hangul Jamo':
	case 'Hangul Jamo Extended-A':
	case 'Hangul Jamo Extended-B':
	case 'Hangul Compatibility Jamo': ch = '\u314b'; break;
	case 'Hangul Syllables': ch = '\uac00'; break;
	case 'Bopomofo':
	case 'Bopomofo Extended': ch = '\u3105'; break;
	case 'General Punctuation':
		ch = ' ';
		break;
	}
	return ch;
}

/**
 * Unicode Initialization
 */
var UnicodeBlocks = [];
function getUnicodeBlock (char) {
	for(var i=0; i<UnicodeBlocks.length; i++) {
		if(UnicodeBlocks[i].regex.test(char)) {
			return UnicodeBlocks[i].name;
		}
	}
	return null;
}

/**
 * LangDetect Initialization
 */
function prepare() {
	var langlist = fs.readdirSync(__dirname + '/' + profiles);

	for(var i=0; i<langlist.length; i++) {
		var file = langlist[i],
			lang = file.split('.')[0],
			profile = require(__dirname + '/' + profiles + '/' + file);

		if(_langlist.indexOf[lang] >= 0) throw new Error('duplicate the same language profile');
		_langlist.push(lang);

		for(var word in profile.freq) {
			if(!_wordLangProbMap[word]) _wordLangProbMap[word] = new Array(langlist.length);
			var len = word.length;
			if (len >= 1 && len <= 3) {
				var prob = profile.freq[word] / profile.n_words[len - 1];
				_wordLangProbMap[word][i] = prob;
            }
		}
	}

	unicode.Block.forEach(function (unicode_block) {
		UnicodeBlocks.push({
			name: unicode_block,
			regex: require('unicode-9.0.0/Block/' + unicode_block + '/regex')
		});
	});
}

prepare();
