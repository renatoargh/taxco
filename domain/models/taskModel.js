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

        isPublic: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },

        isOpen: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        }
    },{
        freezeTableName: true,
        tableName: 'tasks',
        classMethods: {
            associate: function(models) {
                Task.hasMany(models.Comment, {
                    as: 'comments'
                });

                Task.belongsToMany(models.User, {
                    as: 'visibleTo',
                    foreignKey: 'taskId',
                    through: models.Visibility
                });

                Task.belongsTo(models.User, {
                    as: 'assignedTo'
                });

                Task.belongsTo(models.User, {
                    as: 'owner'
                });
            }
        }
    });

    return Task;
};
