var User;

module.exports = function(models) {
    User = models.User;

    this.findByUsername = findByUsername;
};

function findByUsername(username, callback) {
    User.find({
        where: {
            username: username
        }
    }).complete(callback);
}