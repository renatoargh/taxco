'use strict';

module.exports = function(sequelize, DataTypes, options) {
    var User = sequelize.define('User', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            unique: true,
            primaryKey: true
        },

        username: {
            type: DataTypes.STRING(50),
            allowNull: false,
            unique: true
        },

        name: {
            type: DataTypes.STRING(75),
            allowNull: false
        },

        password: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
    },{
        freezeTableName: true,
        tableName: 'users'
    });

    return User;
};
