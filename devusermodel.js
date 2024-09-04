// devusermodel.js
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const saltRounds = 10;

const devuserSchema = new mongoose.Schema({
    fullname: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    mobile: {
        type: String,
        required: true,
    },
    skill: {
        type: String,
        required: true,
    },
    password: {
        type: String,
        required: true,
    },
    isAdmin: {
        type: Boolean,
        default: false, // By default, users are not admins
    }
});


devuserSchema.pre('save', function(next) {
    if (!this.isModified('password')) return next();

    bcrypt.hash(this.password, saltRounds, (err, hashedPassword) => {
        if (err) return next(err);
        this.password = hashedPassword;
        next();
    });
});

devuserSchema.methods.comparePassword = function(candidatePassword, callback) {
    bcrypt.compare(candidatePassword, this.password, (err, isMatch) => {
        if (err) return callback(err);
        callback(null, isMatch);
    });
};

module.exports = mongoose.model('devuser', devuserSchema);
