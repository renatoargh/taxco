'use strict';
var brasil = require('brasil');

module.exports = function(sequelize, DataTypes, options) {
    var User = sequelize.define('User', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            unique: true,
            primaryKey: true
        },

        name: {
            type: DataTypes.STRING(75),
            allowNull: false
        },

        email: {
            type: DataTypes.STRING(50),
            allowNull: false,
            unique: true,
            validate: {
                isEmail: true
            }
        },

        telefone: {
            type: DataTypes.STRING(10),
            allowNull: true,
            validate: {
                eTelefone: function(value, next) {
                    if(!value) {
                        return next();
                    }

                    if(!brasil.validacoes.eTelefone(value)) {
                        return next('Telefone inválido');
                    }

                    next();
                }
            }
        },

        role: {
            type: DataTypes.ENUM('admin', 'user'),
            allowNull: false,
            defaultValue: 'user'
        },

        password: {
            type: DataTypes.STRING(255),
            allowNull: false
        },

        enabled: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },

        lastInteraction: {
            type: DataTypes.DATE,
            allowNull: true
        },

        numberOfInteractions: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        }
    },{
        freezeTableName: true,
        tableName: 'users',
        classMethods: {
            associate: function(models) {
                User.belongsToMany(models.Task, {
                    as: 'visibleTo',
                    foreignKey: 'userId',
                    through: models.Visibility
                });
            }
        }
    });

    return User;
};
