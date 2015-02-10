'use strict';

module.exports = function(sequelize, DataTypes, options) {
    var Visibility = sequelize.define('Visibility', {
        // taskId: {
        //     primaryKey: true,
        //     type: DataTypes.INTEGER,
        //     allowNull: false,
        //     references: 'tasks',
        //     referencesKey: 'id'
        // },

        // userId: {
        //     primaryKey: true,
        //     type: DataTypes.INTEGER,
        //     allowNull: false,
        //     references: 'users',
        //     referencesKey: 'id'
        // }
    },{
        freezeTableName: true,
        timestamps: false,
        tableName: 'visibility'
    });

    return Visibility;
};
