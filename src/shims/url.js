exports.URL = globalThis.URL;
exports.URLSearchParams = globalThis.URLSearchParams;

exports.fileURLToPath = function (urlStr) {
  if (typeof urlStr === "string") {
    return urlStr.replace(/^file:\/\//, "");
  }
  return urlStr.pathname || "";
};

exports.pathToFileURL = function (path) {
  return new URL("file://" + path);
};

exports.format = function (obj) {
  if (!obj) return "";
  if (typeof obj === "string") return obj;
  return obj.href || obj.toString();
};

exports.parse = function (urlStr) {
  if (!urlStr) return {};
  try {
    const u = new URL(urlStr);
    return {
      href: u.href,
      protocol: u.protocol,
      slashes: true,
      host: u.host,
      hostname: u.hostname,
      port: u.port,
      pathname: u.pathname,
      search: u.search,
      hash: u.hash,
      path: u.pathname + u.search,
    };
  } catch (e) {
    return { href: urlStr, pathname: urlStr };
  }
};

exports.resolve = function (from, to) {
  return new URL(to, from).toString();
};
