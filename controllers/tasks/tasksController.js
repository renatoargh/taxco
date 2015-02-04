'use strict';

var router = require('express').Router();

module.exports.init = function(app, opcoes) {
    router.get('/', getTasks);
    router.get('/:id', getTaskById);
    app.use('/tasks', router);
};

function getTasks(req, res, next) {
    // TODO: Move database logic into repository

    var Task = req.models.Task,
        User = req.models.User,
        findAll = Task.findAll({
            order: [
                ['createdAt', 'desc']
            ],
            attributes: [
                'id',
                'title',
                'description',
                'isOpen',
                'createdAt',
                'updatedAt'
            ],
            include: [{
                model: User,
                as: 'owner',
                attributes: ['name']
            }]
        });

    findAll.complete(function(err, tasks) {
        if(err) {
            return next(err);
        }

        res.json(tasks);
    });
}

function getTaskById(req, res, next) {
    // TODO: Move database logic into repository

    var Task = req.models.Task,
        User = req.models.User,
        Comment = req.models.Comment,
        id = req.params.id,
        find = Task.find({
            where: {
                id: id
            },
            attributes: [
                'id',
                'title',
                'description',
                'createdAt',
                'updatedAt'
            ],
            include: [{
                model: User,
                as: 'owner',
                attributes: ['name']
            }, {
                model: Comment,
                as: 'comments',
                attributes: [
                    'id',
                    'content',
                    'createdAt'
                ],
                include: {
                    model: User,
                    as: 'owner',
                    attributes: ['name']
                }
            }]
        });

    find.complete(function(err, task) {
        if(err) {
            return next(err);
        }

        res.json(task);
    });
}