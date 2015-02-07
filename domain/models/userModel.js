'use strict';

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
            unique: true
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
        }
    },{
        freezeTableName: true,
        tableName: 'users'
    });

    return User;
};
