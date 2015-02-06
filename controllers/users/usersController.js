'use strict';

var _ = require('underscore'),
    async = require('async'),
    bcrypt = require('bcrypt'),
    router = require('express').Router(),
    UserReposiroty = _repository('user'),
    userRepository,
    userPrivateAttributes = ['password'];

module.exports.init = function(app, models) {
    userRepository = new UserReposiroty(models);

    router.post('/', postUser);
    router.get('/me', getMe);

    app.use('/users', router);
};

function postUser(req, res, next) {
    var user = req.body,
        salt = _.partial(bcrypt.genSalt, 12),
        hash = _.partial(bcrypt.hash, user.password);

    async.waterfall([salt, hash], function(err, password) {
        user.enabled = false;
        user.password = password;

        userRepository.create(user, function(err, _user) {
            if(err) {
                return next(err);
            }

            _user = _user.toJSON();

            res.json({
                id: _user.id
            });
        });
    });
}

function getMe(req, res, next) {
    var user = req.user;

    if(user) {
        return res.json(_.omit(user, userPrivateAttributes));
    } else {
        return next();
    }
}