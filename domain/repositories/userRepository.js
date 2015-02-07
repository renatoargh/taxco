'use strict';

var User;

module.exports = function(models) {
    User = models.User;

    this.create = create;
    this.find = find;
    this.findAll = findAll;
};

function create(user, options, callback) {
    if(typeof options === 'function') {
        callback = options;
        options = {};
    }

    User.create(user).complete(callback);
}

function find(where, options, callback) {
    if(typeof options === 'function') {
        callback = options;
        options = {};
    }

    User.find({
        where: where
    }).complete(callback);
}

function findAll(where, options, callback) {
    if(typeof options === 'function') {
        callback = options;
        options = {};
    }

    User.findAll({
        where: where,
        attributes: ['id', 'name', 'email', 'role', 'enabled', 'lastInteraction']
    }).complete(callback);
}