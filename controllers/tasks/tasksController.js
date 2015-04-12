'use strict';

var gammautils = require('gammautils'),
    HttpClientError = gammautils.error.HttpClientError,
    async = require('async'),
    router = require('express').Router(),
    auth = require('../../middlewares/authenticationMiddleware'),
    transaction = require('../../middlewares/transactionMiddleware'),
    sequelize;

module.exports.init = function(app, opcoes) {
    router.get('/', auth(['admin', 'user']), getTasks);
    router.get('/:id', auth(['admin', 'user']), getTaskById);
    router.get('/:id/comments', transaction, getCommentsByTaskId);
    router.get('/:id/visibility', transaction, getVisibilityByTaskId);

    router.post('/', auth('admin'), transaction, postTask);

    router.put('/:id', auth(['admin']), transaction, putTask);
    router.put('/:id/notify', auth(['admin']), transaction, putNotifyTask);
    router.put('/:id/comments', transaction, putComment);
    router.put('/:id/mark-visualized', transaction, putMarkVisualized);

    router.delete('/:id', auth(['admin']), transaction, deleteTask);

    app.use('/tasks', router);
};

function putMarkVisualized(req, res, next) {
    var Visibility = req.models.Visibility,
        sequelize = req.sequelize,
        user = req.user;

    var update = Visibility.update({
        numberOfVisualizations: sequelize.literal('numberOfVisualizations + 1'),
        visualizedAt: sequelize.literal('CASE WHEN visualizedAt IS NULL THEN NOW() ELSE visualizedAt END')
    }, {
        where: {
            userId: user.id,
            taskId: req.params.id
        }
    });

    update.complete(function(err) {
        if(err) {
            return next(err);
        }

        res.json({});
    });
}

function getVisibilityByTaskId(req, res, next) {
    var User = req.models.User,
        Visibility = req.models.Visibility,
        Comment = req.models.Comment;

    var findAll = Visibility.findAll({
        where: {
            taskId: req.params.id
        },
        include: [{
            model: User,
            as: 'user',
            attributes: [
                'name',
                'email'
            ]
        }]
    });

    findAll.complete(function(err, visibilities) {
        if(err) {
            return next(err);
        }

        res.json(visibilities);
    });
}

function getCommentsByTaskId(req, res, next) {
    var User = req.models.User,
        Comment = req.models.Comment;

    var findAll = Comment.findAll({
        where: {
            TaskId: req.params.id
        },
        include: [{
            model: User,
            as: 'owner',
            attributes: [
                'name',
                'email'
            ]
        }]
    });

    findAll.complete(function(err, comments) {
        if(err) {
            return next(err);
        }

        comments = comments.map(function(comment) {
            comment = comment.toJSON ? comment.toJSON() : comment;
            comment.owner.emailMd5 = gammautils.crypto.md5(comment.owner.email);
            return comment;
        });

        res.json(comments);
    });
}

function putComment(req, res, next) {
    var comment = req.body,
        Comment = req.models.Comment;

    comment.TaskId = req.params.id;
    comment.ownerId = req.user.id;

    var create = Comment.create(comment);

    create.complete(function(err) {
        if(err) {
            return next(err);
        }

        res.json({});
    });
}

function putNotifyTask(req, res, next) {
    // TODO: Move database logic into repository (DUPLICACAO)

    var Task = req.models.Task,
        User = req.models.User,
        Visibility = req.models.Visibility,
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
                'isPublic',
                'isOpen',
                'createdAt',
                'updatedAt'
            ],
            include: [{
                model: User,
                as: 'visibleTo',
                attributes: [
                    'id',
                    'name',
                    'role',
                    'enabled',
                    'telefone',
                    'email'
                ]
            }, {
                model: User,
                as: 'owner',
                attributes: ['name']
            }, {
                model: User,
                as: 'assignedTo',
                attributes: [
                    'name',
                    'email',
                    'telefone'
                ]
            }]
        });

    find.complete(function(err, task) {
        if(err) {
            return next(err);
        }

        var usersToBeNotified = [];

        function sendSms() {
            async.eachSeries(usersToBeNotified, function(user, cb) {
                setTimeout(function() {
                    req.clickatexClient.send({
                        to: '55' + user.telefone,
                        text: 'SISGEST: Nova tarefa "' + gammautils.string.removeDiacritics(task.title).toUpperCase() + '" em http://sisgest.bmsilva.com.br'
                    }, function(err) {
                        if(err) {
                            console.log(err); // TODO: Log distribuido
                        }
                    });
                }, 1000);
            });
        }

        if(task.isPublic) {
            var findAll = User.findAll({
                where: {
                    enabled: true
                }
            });

            findAll.complete(function(err, users) {
                if(err) {
                    return next(err);
                }

                usersToBeNotified = usersToBeNotified.concat(users);
                sendSms();
            });
        } else {
            if(task.visibleTo) {
                usersToBeNotified = usersToBeNotified.concat(task.visibleTo.filter(function(user) {
                    return user.telefone;
                }));
            }

            task.assignedTo && usersToBeNotified.push(task.assignedTo);

            sendSms();
        }

        res.end();
    });
}

function deleteTask(req, res, next) {
    var Task = req.models.Task,
        Comment = req.models.Comment,
        Visibility = req.models.Visibility,
        taskId = req.params.id,
        transaction = req.transaction;

    // TODO: Add validation wether the current user is the task owner or not
    // TODO: async nesse spaghetti!

    var destroyComments = Comment.destroy({
        where: {
            TaskId: taskId
        },
        transaction: transaction
    });

    destroyComments.complete(function(err) {
        if(err) {
            return next(err);
        }

        var destroyVisibility = Visibility.destroy({
            where: {
                taskId: taskId
            },
            transaction: transaction
        });

        destroyVisibility.complete(function(err) {
            if(err) {
                return next(err);
            }

            var destroyTask = Task.destroy({
                where: {
                    id: taskId
                },
                transaction: transaction
            });

            destroyTask.complete(function(err) {
                if(err) {
                    return next(err);
                }

                transaction.commit();
                res.json({});
            });
        });
    });
}

function putTask(req, res, next) {
    var Task = req.models.Task,
        Visibility = req.models.Visibility,
        task = req.body,
        taskId = req.params.id,
        currentUser = req.user,
        visibleTo = task.visibleToId || [];

    task.isPublic = visibleTo.indexOf('ALL') > -1;
    if(task.isPublic) {
        visibleTo = [];
    }

    task.assignedToId = task.assignedToId ? parseInt(task.assignedToId, 10) : null;

    Task.update(task, {
        where: {
            id: taskId,
            ownerId: currentUser.id
        },
        transaction: req.transaction
    }).complete(function(err, rows) {
        if(err) {
            return next(err);
        }

        Visibility.destroy({
            where: {
                taskId: taskId
            },
            transaction: req.transaction
        }).complete(function(err) {
            if(err) {
                return next(err);
            }

            visibleTo = visibleTo.map(Number).filter(function(userId) {
                return userId !== task.ownerId && userId !== task.assignedToId;
            }).map(function(userId) {
                return {
                    userId: userId,
                    taskId: taskId
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
                res.json({});
            });
        });
    });
}

function postTask(req, res, next) {
    var Task = req.models.Task,
        Visibility = req.models.Visibility,
        task = req.body,
        currentUser = req.user,
        visibleTo = task.visibleToId || [];

    task.isPublic = visibleTo.indexOf('ALL') > -1;
    if(task.isPublic) {
        visibleTo = [];
    }

    if(typeof task.isOpen === 'undefined') {
        task.isOpen = true;
    } else {
        if(typeof task.isOpen === 'string') {
            task.isOpen = task.isOpen === 'true';
        }
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
            'SELECT DISTINCT tasks.*, ',
            '`owner`.`name` as `owner.name`, ',
            '`owner`.`id` as `owner.id`, ',
            '`assignedTo`.`name` as `assignedTo.name`, ',
            '`assignedTo`.`id` as `assignedTo.id` ',
            'FROM tasks',
            'LEFT JOIN visibility as `visibility` ON visibility.taskId = tasks.id',
            'INNER JOIN users as `owner` ON `owner`.id = tasks.ownerId',
            'LEFT JOIN users as `assignedTo` ON `assignedTo`.id = tasks.assignedToId',
            'WHERE tasks.ownerId = :userId OR tasks.assignedToId = :userId OR visibility.userId = :userId OR tasks.isPublic = 1',
            // 'ORDER BY tasks.createdAt DESC'
            'ORDER BY tasks.title ASC'
        ].join(' '), null, {
            raw: true,
            nest: true
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
        Visibility = req.models.Visibility,
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
                'isPublic',
                'isOpen',
                'createdAt',
                'updatedAt'
            ],
            include: [{
                model: User,
                as: 'visibleTo',
                attributes: [
                    'id',
                    'name',
                    'role',
                    'enabled',
                    'email'
                ]
            }, {
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

        if(!task) {
            return next(HttpClientError('', 404));
        }

        res.json(task);
    });
}