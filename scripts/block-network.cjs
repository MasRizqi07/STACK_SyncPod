const http = require('node:http');
const https = require('node:https');
const net = require('node:net');
const dns = require('node:dns');

const ALLOWED_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

function isAllowedHost(host) {
  if (!host) return true;
  return ALLOWED_HOSTS.has(String(host).toLowerCase());
}

const origNetConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function patchedConnect(...args) {
  const first = args[0];
  let host;
  if (typeof first === 'object' && first !== null) {
    host = first.host || first.hostname;
  } else if (typeof args[1] === 'string') {
    host = args[1];
  }
  if (host && !isAllowedHost(host)) {
    throw new Error(`ERR_NETWORK_DISABLED: blocked socket connect to ${host}`);
  }
  return origNetConnect.apply(this, args);
};

const origHttpRequest = http.request;
http.request = function patchedHttp(url, options, cb) {
  const host = typeof url === 'string' ? new URL(url).hostname : (url.hostname || url.host);
  if (!isAllowedHost(host)) {
    throw new Error(`ERR_NETWORK_DISABLED: blocked http request to ${host}`);
  }
  return origHttpRequest.call(this, url, options, cb);
};

const origHttpsRequest = https.request;
https.request = function patchedHttps(url, options, cb) {
  const host = typeof url === 'string' ? new URL(url).hostname : (url.hostname || url.host);
  if (!isAllowedHost(host)) {
    throw new Error(`ERR_NETWORK_DISABLED: blocked https request to ${host}`);
  }
  return origHttpsRequest.call(this, url, options, cb);
};

if (typeof globalThis.fetch === 'function') {
  const origFetch = globalThis.fetch;
  globalThis.fetch = async function patchedFetch(input, init) {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const host = new URL(raw).hostname;
    if (!isAllowedHost(host)) {
      throw new Error(`ERR_NETWORK_DISABLED: blocked fetch to ${host}`);
    }
    return origFetch.call(this, input, init);
  };
}

const origLookup = dns.lookup;
dns.lookup = function patchedLookup(hostname, options, callback) {
  const cb = typeof options === 'function' ? options : callback;
  if (!isAllowedHost(hostname)) {
    const err = new Error(`ERR_NETWORK_DISABLED: blocked DNS lookup for ${hostname}`);
    if (typeof cb === 'function') {
      return process.nextTick(cb, err);
    }
    throw err;
  }
  return origLookup.call(this, hostname, options, callback);
};

