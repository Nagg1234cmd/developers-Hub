const jwt = require('jsonwebtoken');
const devuser = require('./devusermodel');

module.exports = async function (req, res, next) {
    try {
        let token = req.header('Authorization');

        if (!token) {
            return res.status(401).send('Access denied. No token provided.');
        }

        if (token.startsWith('Bearer ')) {
            token = token.slice(7, token.length).trim();
        }

        const decoded = jwt.verify(token, 'jwtPassword');
        req.user = decoded.user;

        const user = await devuser.findById(req.user.id);
        if (!user) {
            return res.status(401).send('User not found.');
        }

        req.user.isAdmin = user.isAdmin;

        next();
    } catch (err) {
        return res.status(400).send('Authentication error');
    }
};
