'use strict';

module.exports = function(sequelize, DataTypes, options) {
    var Comment = sequelize.define('Comment', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            unique: true,
            primaryKey: true
        },

        content: {
            type: DataTypes.TEXT,
            allowNull: false,
        }
    },{
        freezeTableName: true,
        tableName: 'comments',
        classMethods: {
            associate: function(models) {
                Comment.belongsTo(models.User, {
                    as: 'owner'
                });
            }
        }
    });

    return Comment;
};
