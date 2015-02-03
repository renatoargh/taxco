'use strict';

module.exports = function(sequelize, DataTypes, options) {
    var Task = sequelize.define('Task', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            unique: true,
            primaryKey: true
        },

        title: {
            type: DataTypes.STRING(280),
            allowNull: false,
        },

        description: {
            type: DataTypes.TEXT,
            allowNull: false
        },
    },{
        freezeTableName: true,
        tableName: 'tasks',
        classMethods: {
            associate: function(models) {
                Task.hasMany(models.Comment, {
                    as: 'comments'
                });

                Task.belongsTo(models.User, {
                    as: 'owner'
                });
            }
        }
    });

    return Task;
};
