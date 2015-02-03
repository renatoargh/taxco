'use strict';

var router = require('express').Router();

module.exports.init = function(app, opcoes) {
    app.use('/users', router);
};
