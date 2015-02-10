module.exports = function(req, res, next) {
    req.sequelize.transaction().then(function(transaction) {
        req.transaction = transaction;
    });
}