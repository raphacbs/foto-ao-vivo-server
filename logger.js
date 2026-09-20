function now() {
  return new Date().toISOString();
}

function log(level, scope, message, data) {
  if (data === undefined) {
    console[level](`[foto-ao-vivo] ${now()} [${scope}] ${message}`);
    return;
  }
  console[level](`[foto-ao-vivo] ${now()} [${scope}] ${message}`, data);
}

module.exports = {
  info(scope, message, data) {
    log('log', scope, message, data);
  },
  warn(scope, message, data) {
    log('warn', scope, message, data);
  },
  error(scope, message, data) {
    log('error', scope, message, data);
  },
};
