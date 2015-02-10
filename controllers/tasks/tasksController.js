'use strict';

var router = require('express').Router();

module.exports.init = function(app, opcoes) {
    router.post('/', postTask);
    router.get('/', getTasks);
    router.get('/:id', getTaskById);

    app.use('/tasks', router);
};

function postTask(req, res, next) {
    var Task = req.models.Task,
        Visibility = req.models.Visibility,
        task = req.body,
        currentUser = req.user,
        visibleTo = task.visibleToId;

    task.ownerId = currentUser.id;
    task.assignedToId = task.assignedToId ? parseInt(task.assignedToId, 10) : null;

    Task.create(task).complete(function(err, _task) {
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

        var bulkCreate = Visibility.bulkCreate(visibleTo);

        bulkCreate.complete(function(err) {
            if(err) {
                return next(err);
            }


            res.json(_task);
        });
    });
}

function getTasks(req, res, next) {
    var Task = req.models.Task,
        User = req.models.User,
        Visibility = req.models.Visibility,
        currentUser = req.user,
        findAll = Task.findAll({
            where: [
                'assignedToId=? OR ownerId=?',
                currentUser.id,
                currentUser.id,
            ],
            order: [
                [ 'createdAt', 'desc' ]
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
                attributes: [ 'name' ]
            }]
        });

// SELECT DISTINCT tasks.* FROM tasks
// LEFT JOIN visibility ON visibility.userId = 2
// WHERE tasks.ownerId = 2 OR tasks.assignedToId = 2 OR (visibility.userId = 2 AND tasks.ownerId <> 2 AND tasks.assignedToId <> 2)

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