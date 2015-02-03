'use strict';

// Third party dependecies
var express = require('express'),
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
    path = require('path'),

    // Var initializations
    PORT = process.env.PORT || 9090,
    NODE_ENV = process.env.NODE_ENV,
    isProduction = NODE_ENV === 'production',
    env = require('./env.json');

// Shorthands (prevent require hell)
global._repository = global._repository = function(repository) {
    return require(path.join(__dirname, '/domain/repositories/', repository + 'Repository.js'));
}

// Database initialization
var sequelize = new Sequelize(env.mysql.database, env.mysql.user, env.mysql.password, {
        host: env.mysql.host,
        port: env.mysql.port,
        logging: isProduction ? false : console.log,
        dialect: 'mysql',
        define: {
            charset: 'utf8',
            collation: 'utf8_general_ci'
        },
        dialectOptions: {
            multipleStatements: !isProduction
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

function dropDatabase(callback) {
    var dropAllTables = [
            'SET FOREIGN_KEY_CHECKS = 0;',
            'SET GROUP_CONCAT_MAX_LEN = 32768;',
            'SET @tables = NULL;',
            "SELECT GROUP_CONCAT('`', table_name, '`') INTO @tables FROM information_schema.tables WHERE table_schema = (SELECT DATABASE());",
            "SET @tables = CONCAT('DROP TABLE IF EXISTS ', @tables);",
            "SELECT IFNULL(@tables, 'SELECT 1') INTO @tables;",
            'PREPARE stmt FROM @tables;',
            'EXECUTE stmt;',
            'DEALLOCATE PREPARE stmt;',
            'SET FOREIGN_KEY_CHECKS = 1;',
            "SET GLOBAL sql_mode = 'STRICT_ALL_TABLES';"
        ].join(' ');

    sequelize
        .query(dropAllTables)
        .then(function() {
            return sequelize.sync({ logging: console.log, force: true }); //TODO: Implementar log distribuido
        })
        // .then(function() {
        //     return sequelize.query([

        //     ].join(';'));
        // })
        .then(function() {
            console.log('Database recreated!');
            callback();
        }, function(err) {
            console.log('Error while recreating database:'); //TODO: Implementar log distribuido
            throw err;
        });
}

// Http server initialization
var app = express();

if(!isProduction) {
    // Logging middleware used only in development
    app.use(morgan('dev'));
}

app.use(function(req, res, next) {
    if(!req.headers.authorization) {
        // Forwards as anonymous request
        return next();
    }

    var credentials = req.headers.authorization.replace('Basic ', '');
    credentials = new Buffer(credentials, 'base64').toString('ascii'); //TODO: Pegar do gammautils
    credentials = credentials.split(':');
    credentials = {
        username: credentials[0],
        password: credentials[1]
    };

    userRepository.findByUsername(credentials.username, function(err, user) {
        if(err) {
            return next(err);
        }

        if(!user) {
            return next(new Error('Wrong username or password'));
        }

        bcrypt.compare(password, user.password, function(err, match) {
            if(err) {
                return done(err);
            }

            if(match) {
                req.user = user;
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

    req.models = models;
    req.fullUrl = req.protocol + '://' + req.hostname;
    req.fullPath = req.fullUrl + req.url.split('?')[0];

    next();
});

// Initializing controllers
glob.sync(__dirname + '/controllers/**/*Controller.js').forEach(function(controllerPath) {
    require(controllerPath).init(app);
});

app.use(function(req, res){
    res.status(404).json({
        message: 'Resource Not FOund'
    });
});

// Generic error middleware
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

if(process.argv[2] && process.argv[2].toLowerCase() === 'sync') {
    if(isProduction) {
        var message = [
            'Database can only be recreated in development mode (NODE_ENV=development)',
        ];

        throw new Error(message.join(' '));
    }

    dropDatabase(startServer);
} else {
    startServer();
}

function startServer() {
    app.listen(PORT, function() {
        console.log('taxco running on port ' + PORT);
    });
};

process.on('uncaughtException', function (e) {
    console.log('uncaughtException, process exiting now...');
    console.log(new Date().toString(), e.stack || e);
    process.exit(1);
});