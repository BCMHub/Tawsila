/**
 * @param {string | undefined} value
 * @returns {string | undefined}
 */
function getShareLinkOrigin(value) {
  // Require a bare HTTPS authority and optional trailing slash before URL normalization.
  if (!value || !/^https:\/\/[^/?#@\\\s]+\/?$/i.test(value)) return undefined;

  try {
    const url = new URL(value);
    return url.host ? url.origin : undefined;
  } catch {
    return undefined;
  }
}

module.exports = { getShareLinkOrigin };
