// reviewmodel.js
const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema({
    taskprovider: {
        type: String,
        required: true
    },
    taskworker: {
        type: String,
        required: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    }
}, { timestamps: true });

module.exports = mongoose.model("UserReview", reviewSchema);
