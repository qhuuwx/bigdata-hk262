/**
 * Async Controller Wrapper
 * Eliminates repetitive try-catch blocks in Express route handlers by forwarding errors to next(err).
 * 
 * @param {Function} fn - Async controller function (req, res, next)
 * @returns {Function} Express middleware function
 */
function asyncWrapper(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncWrapper;
