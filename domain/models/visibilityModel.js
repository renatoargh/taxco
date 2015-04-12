'use strict';

module.exports = function(sequelize, DataTypes, options) {
    var Visibility = sequelize.define('Visibility', {
        numberOfVisualizations: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
        },

        visualizedAt: {
            type: DataTypes.DATE,
            allowNull: true
        },

        smsSentAt: {
            type: DataTypes.DATE,
            allowNull: true
        },

        emailSentAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
    },{
        freezeTableName: true,
        timestamps: false,
        tableName: 'visibility',
        classMethods: {
            associate: function(models) {
                Visibility.belongsTo(models.User, {
                    as: 'user',
                    foreignKey: 'userId'
                });
            }
        }
    });

    return Visibility;
};
