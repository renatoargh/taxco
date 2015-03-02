module.exports = function(params) {
    if(!Array.isArray(params)) {
        params = [params];
    }

    return function(req, res, next) {
        if(!req.user || params.indexOf(req.user.role) === -1) {
            return next(new Error('Acesso Negado'));
        }

        next();
    }
}