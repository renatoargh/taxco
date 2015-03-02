'use strict';

var _ = require('underscore'),
    async = require('async'),
    bcrypt = require('bcrypt'),
    router = require('express').Router(),
    auth = require('../../middlewares/authenticationMiddleware'),
    UserReposiroty = _repository('user'),
    userRepository,
    userPrivateAttributes = ['password'];

module.exports.init = function(app, models) {
    userRepository = new UserReposiroty(models);

    router.post('/', postUser);
    router.put('/:id', auth('admin'), putUser);
    router.get('/me', getMe);
    router.get('/', auth('admin'), getUsers);

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

function putUser(req, res, next) {
    var user = req.body;

    delete user.password;
    delete user.lastInteraction;
    user.enabled = user.enabled === 'true';

    userRepository.update(user, {
        id: user.id
    }, function(err, recordsChanged) {
        if(err) {
            return next(err);
        }

        if(!recordsChanged) {
            return next();
        }

        res.json({});
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

function getUsers(req, res, next) {
    var query = req.query;

    if(query.enabled) {
        query.enabled = query.enabled === 'true';
    }

    userRepository.findAll(query, function(err, users) {
        if(err) {
            return next(err);
        }

        res.json(users);
    });
}