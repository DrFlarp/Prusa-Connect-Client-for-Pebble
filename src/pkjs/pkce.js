/**
 * PKCE (Proof Key for Code Exchange) RFC 7636 generator for Prusa Connect OAuth2.
 * Pure JavaScript, zero external dependencies (no Node 'crypto' or 'js-sha256').
 */

var BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function btoaPolyfill(str) {
    var out = "";
    var i = 0;
    while (i < str.length) {
        var c1 = str.charCodeAt(i++) & 0xff;
        if (i === str.length) {
            out += BASE64_CHARS.charAt(c1 >> 2);
            out += BASE64_CHARS.charAt((c1 & 3) << 4);
            out += "==";
            break;
        }
        var c2 = str.charCodeAt(i++) & 0xff;
        if (i === str.length) {
            out += BASE64_CHARS.charAt(c1 >> 2);
            out += BASE64_CHARS.charAt(((c1 & 3) << 4) | (c2 >> 4));
            out += BASE64_CHARS.charAt((c2 & 15) << 2);
            out += "=";
            break;
        }
        var c3 = str.charCodeAt(i++) & 0xff;
        out += BASE64_CHARS.charAt(c1 >> 2);
        out += BASE64_CHARS.charAt(((c1 & 3) << 4) | (c2 >> 4));
        out += BASE64_CHARS.charAt(((c2 & 15) << 2) | (c3 >> 6));
        out += BASE64_CHARS.charAt(c3 & 63);
    }
    return out;
}

/**
 * Computes SHA-256 digest of an ASCII string and returns an array of 32 bytes (0-255).
 * Standard FIPS 180-2 implementation.
 */
function sha256Bytes(ascii) {
    function rightRotate(value, amount) {
        return (value >>> amount) | (value << (32 - amount));
    }

    var mathPow = Math.pow;
    var maxWord = mathPow(2, 32);
    var words = [];
    var asciiBitLength = ascii.length * 8;

    var hash = [];
    var k = [];
    var primeCounter = 0;

    var isComposite = {};
    for (var candidate = 2; primeCounter < 64; candidate++) {
        if (!isComposite[candidate]) {
            for (var cIdx = 0; cIdx < 313; cIdx += candidate) {
                isComposite[cIdx] = candidate;
            }
            hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
            k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
        }
    }

    ascii += "\x80";
    while ((ascii.length % 64) !== 56) {
        ascii += "\x00";
    }
    for (var i = 0; i < ascii.length; i++) {
        var j = ascii.charCodeAt(i);
        words[i >> 2] |= j << ((3 - i) % 4) * 8;
    }
    words[words.length] = ((asciiBitLength / maxWord) | 0);
    words[words.length] = asciiBitLength;

    for (var chunk = 0; chunk < words.length;) {
        var w = words.slice(chunk, chunk += 16);
        var oldHash = hash;
        hash = hash.slice(0, 8);

        for (var round = 0; round < 64; round++) {
            var w15 = w[round - 15];
            var w2 = w[round - 2];
            var a = hash[0];
            var e = hash[4];
            var temp1 = hash[7]
                + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25))
                + ((e & hash[5]) ^ ((~e) & hash[6]))
                + k[round]
                + (w[round] = (round < 16) ? w[round] : (
                        w[round - 16]
                        + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3))
                        + w[round - 7]
                        + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))
                    ) | 0
                );
            var temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22))
                + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

            hash = [(temp1 + temp2) | 0].concat(hash);
            hash[4] = (hash[4] + temp1) | 0;
        }

        for (var hIdx = 0; hIdx < 8; hIdx++) {
            hash[hIdx] = (hash[hIdx] + oldHash[hIdx]) | 0;
        }
    }

    var bytes = [];
    for (var outIdx = 0; outIdx < 8; outIdx++) {
        for (var bIdx = 3; bIdx >= 0; bIdx--) {
            bytes.push((hash[outIdx] >> (8 * bIdx)) & 255);
        }
    }
    return bytes;
}

function generateVerifier(length) {
    length = length || 64;
    var charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
    var result = "";
    for (var i = 0; i < length; i++) {
        var idx = Math.floor(Math.random() * charset.length);
        result += charset.charAt(idx);
    }
    return result;
}

function generateChallenge(verifier) {
    var hashBytes = sha256Bytes(verifier);
    var binary = "";
    for (var i = 0; i < hashBytes.length; i++) {
        binary += String.fromCharCode(hashBytes[i]);
    }
    var base64 = (typeof btoa === "function") ? btoa(binary) : btoaPolyfill(binary);
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

module.exports = {
    generateVerifier: generateVerifier,
    generateChallenge: generateChallenge,
    sha256Bytes: sha256Bytes
};
