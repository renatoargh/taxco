'use strict';

var _ = require('underscore'),
    async = require('async'),
    gammautils = require('gammautils'),
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
        salt = _.partial(bcrypt.genSalt, 2), // TODO: Trocar para 12 quando o mecanismo de login estiver similar ao GammaERP
        hash = _.partial(bcrypt.hash, user.password);

    async.waterfall([salt, hash], function(err, password) {
        user.enabled = false;
        user.password = password;

        userRepository.create(user, function(err, _user) {
            if(err) {
                return next(err);
            }

            _user = _user.toJSON();

            var textoDeNotificacao = [
                'SISGEST: Novo usuario cadastrado - ',
                _user.name,
                ' (' + _user.email
            ];

            _user.telefone && textoDeNotificacao.push(' - ' + _user.telefone);
            textoDeNotificacao.push(')');

            req.clickatexClient.send({
                to: '556199829856',
                text: textoDeNotificacao.join('')
            }, function(err) {
                if(err) {
                    console.log(err); // TODO: Log distribuído
                }
            });

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
    user.emailMd5 = gammautils.crypto.md5(user.email);

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