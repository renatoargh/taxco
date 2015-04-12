'use strict';

// Shorthands (prevent require hell)
global._repository = global._repository = function(repository) {
    return require(path.join(__dirname, '/domain/repositories/', repository + 'Repository.js'));
}

// Third party dependecies
var express = require('express'),
    clickatex = require('clickatex'),
    morgan = require('morgan'),
    bodyParser = require('body-parser'),
    methodOverride = require('method-override'),
    glob = require('glob'),
    async = require('async'),
    moment = require('moment'),
    Sequelize = require('sequelize'),
    bcrypt = require('bcrypt'),

    // Node.js native dependencies
    fs = require('fs'),
    http = require('http'),
    path = require('path'),

    // Var initializations
    PORT = process.env.PORT || 9090,
    NODE_ENV = process.env.NODE_ENV,
    isProduction = NODE_ENV === 'production',
    env = require('./env.json'),
    UserRepository = _repository('user'),
    userRepository;

var clickatexClient = new clickatex.Client({
    apiId: env.clickatell.apiId,
    user: env.clickatell.user,
    password: env.clickatell.password,
    prefix: 'SISGEST: ',
    countryCode: '55'
});

http.globalAgent.maxSockets = Infinity;

var sequelize = new Sequelize(env.mysql.database, env.mysql.user, env.mysql.password, {
        host: env.mysql.host,
        port: env.mysql.port,
        logging: isProduction ? false : console.log,
        dialect: 'mysql',
        define: {
            charset: 'utf8',
            collation: 'utf8_general_ci'
        },
        pool: {
            minConnections: 0,
            maxConnections: 10,
            maxIdleTime: 10
        }
    }),
    modelsFolder = path.join(__dirname, '/domain/models'),
    models = {};

glob.sync(__dirname + '/domain/models/*Model.js').forEach(function(modelFile) {
    var model = sequelize.import(modelFile);
    models[model.name] = model;
});

Object.keys(models).forEach(function(modelName) {
    if('associate' in models[modelName]){
        models[modelName].associate(models);
    }
});

var app = express();

if(!isProduction) {
    app.use(morgan('dev'));
}

app.enable('trust proxy');

app.use(function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', [
        'GET', 'PUT' , 'POST',
        'DELETE', 'HEAD', 'OPTIONS'
    ].join(','));
    res.header('Access-Control-Allow-Headers', [
        'Content-Type', 'Authorization',
        'Content-Length', 'X-Requested-With'
    ].join(','));
    res.header('Access-Control-Expose-Headers', '');

    if ('OPTIONS' === req.method) {
        return res.status(200).end();
    }

    next();
});

app.use(function(req, res, next) {
    if(!req.headers.authorization) {
        return next(); // Forwards as anonymous request
    }

    var credentials = req.headers.authorization.replace('Basic ', '');
    credentials = new Buffer(credentials, 'base64').toString('ascii');
    credentials = credentials.trim().split(':');
    credentials = {
        email: credentials[0],
        password: credentials[1]
    };

    userRepository = new UserRepository(models);
    userRepository.find({
        email: credentials.email,
        enabled: true
    }, function(err, user) {
        if(err) {
            return next(err);
        }

        if(!user) {
            return next(new Error('Wrong username or password'));
        }

        bcrypt.compare(credentials.password, user.password, function(err, match) {
            if(err) {
                return done(err);
            }

            function recordLastInteraction() {
                user.update({
                    lastInteraction: Date.now(),
                    numberOfInteractions: sequelize.literal('numberOfInteractions + 1')
                });
            }

            if(match) {
                setImmediate(recordLastInteraction);
                req.user = user.toJSON();
                return next();
            }

            return next(new Error('Forbidden'));
        });
    });
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(methodOverride());

app.use(function(req, res, next) {
    res.removeHeader('x-powered-by');

    req.sequelize = sequelize;
    req.models = models;
    req.fullUrl = req.protocol + '://' + req.hostname;

    if(NODE_ENV === 'development') {
        req.fullUrl += ':' + PORT;
    }

    req.fullPath = req.fullUrl + req.url.split('?')[0];
    req.clickatexClient = clickatexClient;

    next();
});

glob.sync(__dirname + '/controllers/**/*Controller.js').forEach(function(controllerPath) {
    require(controllerPath).init(app, models);
});

app.use(function(req, res){
    res.status(404).json({
        message: 'Resource Not Found'
    });
});

app.use(function(err, req, res, next) {
    if(req.transaction) {
        req.transaction.rollback();
    }

    var clientError = err.name === 'HttpClientError',
        serverError = !clientError,
        statusCode = clientError ? err.statusCode : 500;

    if(isProduction) {
        res.status(statusCode).json({
            message: serverError ? 'Internal Server Error' : err.messageToClient,
            data: clientError ? err.data : {}
        });
    } else {
        console.trace(err);

        res.status(statusCode).json({
            message: err.messageToClient || err.message, // Human readable text
            data: clientError ? err.data : {}, // Machine readable data
            error: err
        });
    }
});

app.listen(PORT, function() {
    console.log('taxco running on port ' + PORT);
});

process.on('uncaughtException', function (e) {
    console.log('uncaughtException, process exiting now...');
    console.log(new Date().toString(), e.stack || e);
    process.exit(1);
});