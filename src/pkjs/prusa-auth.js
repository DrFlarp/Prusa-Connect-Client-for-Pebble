/**
 * Prusa Account OAuth2 Authentication Module.
 * Implements Authorization Code Flow with PKCE (RFC 7636) and Session Login.
 */
var pkce = require("./pkce");

var PRUSA_CLIENT_ID = "MRHTlZhZqkNrrQ6FUPtjyusAz8nc59ErHXP8XkS4";
var PRUSA_REDIRECT_URI = "https://connect.prusa3d.com/login/auth-callback";
var PRUSA_LOGIN_URL = "https://account.prusa3d.com/login/";
var PRUSA_AUTH_URL = "https://account.prusa3d.com/o/authorize/";
var PRUSA_TOKEN_URL = "https://account.prusa3d.com/o/token/";

function extractCode(str) {
    if (!str) return null;
    var match = str.match(/[?&]code=([^&#]+)/);
    return match ? decodeURIComponent(match[1]) : null;
}

function extractCsrfToken(html) {
    if (!html) return null;
    var match = html.match(/name=["']csrfmiddlewaretoken["']\s+value=["']([^"']+)["']/i);
    if (match) return match[1];
    var match2 = html.match(/value=["']([^"']+)["']\s+name=["']csrfmiddlewaretoken["']/i);
    return match2 ? match2[1] : null;
}

/**
 * Exchange authorization code + code_verifier for JWT access and refresh tokens.
 */
function exchangeCodeForTokens(code, verifier, callback) {
    console.log("[Auth] Exchanging authorization code for tokens...");
    var xhr = new XMLHttpRequest();
    xhr.open("POST", PRUSA_TOKEN_URL, true);
    xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
    xhr.setRequestHeader("Accept", "application/json");

    xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) {
            try {
                var data = JSON.parse(xhr.responseText);
                console.log("[Auth] Token exchange successful! Expires in " + data.expires_in + "s");
                callback(null, data);
            } catch (e) {
                callback("Failed to parse token response: " + e);
            }
        } else {
            console.log("[Auth] Token exchange failed: " + xhr.status + " " + xhr.responseText);
            callback("Token exchange error: " + xhr.status + " (" + xhr.responseText + ")");
        }
    };

    xhr.onerror = function () {
        console.log("[Auth] Network error during token exchange.");
        callback("Network error during token exchange");
    };

    var body = "grant_type=authorization_code" +
        "&code=" + encodeURIComponent(code) +
        "&client_id=" + encodeURIComponent(PRUSA_CLIENT_ID) +
        "&redirect_uri=" + encodeURIComponent(PRUSA_REDIRECT_URI) +
        "&code_verifier=" + encodeURIComponent(verifier);

    xhr.send(body);
}

/**
 * Perform explicit GET /o/authorize/ in case Step 2 did not follow all the way to redirect_uri.
 */
function requestAuthorizationCode(verifier, challenge, callback) {
    console.log("[Auth] Requesting authorization code via /o/authorize/...");
    var authParams = "response_type=code" +
        "&client_id=" + encodeURIComponent(PRUSA_CLIENT_ID) +
        "&code_challenge_method=S256" +
        "&code_challenge=" + encodeURIComponent(challenge) +
        "&redirect_uri=" + encodeURIComponent(PRUSA_REDIRECT_URI);

    var xhr = new XMLHttpRequest();
    xhr.open("GET", PRUSA_AUTH_URL + "?" + authParams, true);
    xhr.withCredentials = true;

    xhr.onload = function () {
        var finalUrl = xhr.responseURL || xhr.getResponseHeader("Location") || "";
        var bodyPreview = xhr.responseText ? xhr.responseText.substring(0, 200).replace(/\s+/g, " ") : "";
        console.log("[Auth] Step 3 status=" + xhr.status + " responseURL=" + xhr.responseURL + " Location=" + xhr.getResponseHeader("Location"));
        console.log("[Auth] Step 3 body: " + bodyPreview);

        var code = extractCode(finalUrl);
        if (!code && xhr.responseText) {
            code = extractCode(xhr.responseText);
        }

        if (code) {
            console.log("[Auth] Found authorization code from /o/authorize/");
            exchangeCodeForTokens(code, verifier, callback);
        } else {
            console.log("[Auth] Could not extract code from /o/authorize/ response. Status: " + xhr.status);
            callback("Could not obtain authorization code from Prusa Account");
        }
    };

    xhr.onerror = function () {
        console.log("[Auth] Network error during /o/authorize/");
        callback("Network error during authorization request");
    };

    xhr.send();
}

/**
 * Authenticate with Prusa Account using Email & Password via PKCE.
 * 1. Generates PKCE verifier + challenge.
 * 2. GET /login/?next=... to get CSRF token and set session cookie.
 * 3. POST /login/?next=... with credentials.
 * 4. Extracts authorization code and exchanges for tokens.
 */
function login(email, password, callback) {
    if (!email || !password) {
        callback("Missing email or password");
        return;
    }

    var verifier = pkce.generateVerifier(64);
    var challenge = pkce.generateChallenge(verifier);

    var authNext = "/o/authorize/?response_type=code" +
        "&client_id=" + encodeURIComponent(PRUSA_CLIENT_ID) +
        "&code_challenge_method=S256" +
        "&code_challenge=" + encodeURIComponent(challenge) +
        "&redirect_uri=" + encodeURIComponent(PRUSA_REDIRECT_URI);

    var fullLoginUrl = PRUSA_LOGIN_URL + "?next=" + encodeURIComponent(authNext);

    console.log("[Auth] Step 1: Fetching login page & CSRF token...");
    var getXhr = new XMLHttpRequest();
    getXhr.open("GET", fullLoginUrl, true);
    getXhr.withCredentials = true;

    getXhr.onload = function () {
        if (getXhr.status < 200 || getXhr.status >= 400) {
            callback("Failed to load login page. HTTP status: " + getXhr.status);
            return;
        }

        var csrfToken = extractCsrfToken(getXhr.responseText);
        console.log("[Auth] Step 1 status=" + getXhr.status + " csrf=" + (csrfToken ? (csrfToken.substring(0, 8) + "...") : "null") + " fetch=" + (typeof fetch));
        if (!csrfToken) {
            callback("Could not find CSRF token on Prusa login page");
            return;
        }

        console.log("[Auth] Step 2: Submitting credentials...");
        var postXhr = new XMLHttpRequest();
        postXhr.open("POST", fullLoginUrl, true);
        postXhr.withCredentials = true;
        postXhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        postXhr.setRequestHeader("Referer", fullLoginUrl);

        postXhr.onload = function () {
            var finalUrl = postXhr.responseURL || postXhr.getResponseHeader("Location") || "";
            var bodyPreview = postXhr.responseText ? postXhr.responseText.substring(0, 200).replace(/\s+/g, " ") : "";
            console.log("[Auth] Step 2 status=" + postXhr.status + " responseURL=" + postXhr.responseURL + " Location=" + postXhr.getResponseHeader("Location"));
            console.log("[Auth] Step 2 body: " + bodyPreview);

            var code = extractCode(finalUrl);
            if (!code && postXhr.responseText) {
                code = extractCode(postXhr.responseText);
            }

            if (code) {
                console.log("[Auth] Authorization code received directly after login!");
                exchangeCodeForTokens(code, verifier, callback);
            } else if (postXhr.responseText && (postXhr.responseText.indexOf("errorlist") !== -1 || postXhr.responseText.indexOf("alert-danger") !== -1 || postXhr.responseText.indexOf("Please enter a correct") !== -1)) {
                console.log("[Auth] Login rejected: Invalid credentials");
                callback("Invalid email or password");
            } else {
                console.log("[Auth] Step 3: Following up with explicit /o/authorize/...");
                requestAuthorizationCode(verifier, challenge, callback);
            }
        };

        postXhr.onerror = function () {
            console.log("[Auth] Network error submitting login form");
            callback("Network error submitting login form");
        };

        var postData = "csrfmiddlewaretoken=" + encodeURIComponent(csrfToken) +
            "&next=" + encodeURIComponent(authNext) +
            "&email=" + encodeURIComponent(email) +
            "&password=" + encodeURIComponent(password);

        postXhr.send(postData);
    };

    getXhr.onerror = function () {
        console.log("[Auth] Network error reaching Prusa login page");
        callback("Network error reaching Prusa login page");
    };

    getXhr.send();
}

/**
 * Refresh an expired JWT access token using the stored refresh token.
 */
function refresh(refreshToken, callback) {
    if (!refreshToken) {
        callback("No refresh token available");
        return;
    }

    console.log("[Auth] Refreshing access token...");
    var xhr = new XMLHttpRequest();
    xhr.open("POST", PRUSA_TOKEN_URL, true);
    xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
    xhr.setRequestHeader("Accept", "application/json");

    xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) {
            try {
                var data = JSON.parse(xhr.responseText);
                console.log("[Auth] Token refresh successful! Expires in " + data.expires_in + "s");
                callback(null, data);
            } catch (e) {
                callback("Failed to parse refresh token response: " + e);
            }
        } else {
            console.log("[Auth] Token refresh failed: " + xhr.status + " " + xhr.responseText);
            callback("Refresh error: " + xhr.status + " (" + xhr.responseText + ")");
        }
    };

    xhr.onerror = function () {
        console.log("[Auth] Network error during token refresh");
        callback("Network error during token refresh");
    };

    var body = "grant_type=refresh_token" +
        "&client_id=" + encodeURIComponent(PRUSA_CLIENT_ID) +
        "&refresh_token=" + encodeURIComponent(refreshToken);

    xhr.send(body);
}

module.exports = {
    login: login,
    refresh: refresh
};
