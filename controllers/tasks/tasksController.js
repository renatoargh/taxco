'use strict';

var router = require('express').Router(),
    auth = require('../../middlewares/authenticationMiddleware'),
    transaction = require('../../middlewares/transactionMiddleware'),
    sequelize;

module.exports.init = function(app, opcoes) {
    router.post('/', auth('admin'), transaction, postTask);
    // router.post('/:id/comment', auth([ 'admin', 'user' ]), transaction, putComment);

    router.get('/', auth(['admin', 'user']), getTasks);
    router.get('/:id', auth(['admin', 'user']), getTaskById);

    router.put('/:id', auth(['admin']), putTask);

    app.use('/tasks', router);
};

function putTask(req, res, next) {
    res.json({});
}

function postTask(req, res, next) {
    var Task = req.models.Task,
        Visibility = req.models.Visibility,
        task = req.body,
        currentUser = req.user,
        visibleTo = task.visibleToId;

    task.isPublic = visibleTo.indexOf('ALL') > -1;
    if(task.isPublic) {
        visibleTo = [];
    }

    task.ownerId = currentUser.id;
    task.assignedToId = task.assignedToId ? parseInt(task.assignedToId, 10) : null;

    Task.create(task, {
        transaction: req.transaction
    }).complete(function(err, _task) {
        if(err) {
            return next(err);
        }

        _task = _task.toJSON();

        visibleTo = visibleTo.map(Number).filter(function(userId) {
            return userId !== task.ownerId && userId !== task.assignedToId;
        }).map(function(userId) {
            return {
                userId: userId,
                taskId: _task.id
            }
        });

        var bulkCreate = Visibility.bulkCreate(visibleTo, {
            transaction: req.transaction
        });

        bulkCreate.complete(function(err) {
            if(err) {
                return next(err);
            }

            req.transaction.commit();
            res.json(_task);
        });
    });
}

function getTasks(req, res, next) {
    var currentUser = req.user,
        query = req.sequelize.query([
            'SELECT DISTINCT tasks.*, `owner`.`name` as `owner.name` FROM tasks',
            'LEFT JOIN visibility as `visibility` ON visibility.taskId = tasks.id',
            'INNER JOIN users as `owner` ON `owner`.id = tasks.ownerId',
            'WHERE tasks.ownerId = :userId OR tasks.assignedToId = :userId OR visibility.userId = :userId OR tasks.isPublic = 1',
            'ORDER BY tasks.createdAt DESC'
        ].join(' '), null, {
            raw: true
        }, {
            userId: currentUser.id
        });

    query.complete(function(err, tasks) {
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