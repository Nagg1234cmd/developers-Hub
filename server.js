const express = require('express');
const mongoose = require('mongoose');
const devuser = require('./devusermodel');
const reviewmodel = require('./reviewmodel');
const jwt = require('jsonwebtoken');
const middleware = require('./middleware');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const nodemailer = require('nodemailer'); // Import Nodemailer
require('dotenv').config();

const transporter = require('./email'); // Import email transporter

const app = express();

// Middleware to parse JSON bodies
app.use(express.json());
app.use(cors({ origin: '*' }));

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("DB is connected"))
.catch(err => console.log("Failed to connect to the database:", err));

// Send email helper function
const sendEmail = async (to, subject, text) => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      text
    });
    console.log('Email sent successfully');
  } catch (error) {
    console.error('Error sending email:', error);
  }
};


app.get('/', (req, res) => res.send("Hello World"));
app.post('/register', async (req, res) => {
  try {
    const { fullname, email, mobile, skill, password, confirmpassword } = req.body;

    const exist = await devuser.findOne({ email });
    if (exist) return res.status(400).send("User already registered");

    if (password !== confirmpassword) return res.status(403).send('Passwords do not match');

    let newUser = new devuser({ fullname, email, mobile, skill, password });
    await newUser.save();
    
    await sendEmail(email, 'Registration Successful', 'Congratulations! Your registration was successful.');

    res.status(200).send("User registered");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});


app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await devuser.findOne({ email });

    if (!user) return res.status(400).send("User does not exist");

    user.comparePassword(password, async (err, isMatch) => {
      if (err) throw err;
      if (!isMatch) return res.status(403).send("Invalid password");

      const payload = { user: { id: user.id } };
      const token = jwt.sign(payload, 'jwtPassword', { expiresIn: '10h' });

      // Send login success email
      await sendEmail(email, 'Login Successful', 'You have successfully logged in.');

      res.json({
        token,
        user: {
          fullname: user.fullname,
          email: user.email,
          mobile: user.mobile,
          skill: user.skill,
        }
      });
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

app.get('/allprofiles', middleware, async (req, res) => {
  try {
    const allprofiles = await devuser.find();
    res.json(allprofiles);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

app.get('/myprofile', middleware, async (req, res) => {
  try {
    const user = await devuser.findById(req.user.id);
    if (!user) return res.status(404).send('User not found');

    // Fetch reviews associated with the user
    const reviews = await reviewmodel.find({ taskworker: req.user.id });

    res.json({ user, reviews });
  } catch (err) {
    console.error('Error fetching profile:', err);
    res.status(500).send('Server error');
  }
});

app.get('/api/profiles', async (req, res) => {
  try {
    const profiles = await devuser.find();
    res.json(profiles);
  } catch (err) {
    res.status(500).json({ error: 'Unable to fetch profiles' });
  }
});

app.post('/addreview', middleware, async (req, res) => {
  try {
    const { taskworker, rating } = req.body;

    if (!taskworker) return res.status(400).send("Taskworker is required");
    if (!rating) return res.status(400).send("Rating is required");

    const exist = await devuser.findById(req.user.id);
    if (!exist) return res.status(404).send("User not found");

    const newReview = new reviewmodel({
      taskprovider: exist.fullname,
      taskworker,
      rating
    });

    await newReview.save();
    res.status(201).send("Review added successfully");
  } catch (err) {
    console.error("Error adding review:", err);
    res.status(500).send("Server error");
  }
});

app.get('/myreview', middleware, async (req, res) => {
  try {
    const allreviews = await reviewmodel.find();
    const myreviews = allreviews.filter(review => review.taskworker.toString() === req.user.id.toString());
    res.json(myreviews);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// Profile route to get user details by ID
app.get('/profile/:id', async (req, res) => {
  try {
    const profile = await devuser.findById(req.params.id);
    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }
    res.json(profile);
  } catch (err) {
    console.error('Error fetching profile:', err);
    res.status(500).json({ message: 'Server error' });
  }
});


// Add this route to handle admin-specific actions
app.get('/admin/users', middleware, async (req, res) => {
  try {
    // Check if user is an admin
    const user = await devuser.findById(req.user.id);
    if (!user || !user.isAdmin) {
      return res.status(403).send("Access denied. Not an admin.");
    }

    // Fetch all users
    const users = await devuser.find();
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// Route to update a user to admin status
app.post('/make-admin', middleware, async (req, res) => {
  try {
      if (!req.user.isAdmin) {
          return res.status(403).send("Access denied. Not an admin.");
      }

      const { email } = req.body;
      const user = await devuser.findOne({ email });

      if (!user) return res.status(404).send("User not found");

      user.isAdmin = true;
      await user.save();

      res.send("User is now an admin");
  } catch (err) {
      console.error(err);
      res.status(500).send("Server error");
  }
});
app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await devuser.findOne({ email });

    if (!user) return res.status(400).send("User does not exist");

    user.comparePassword(password, (err, isMatch) => {
      if (err) throw err;
      if (!isMatch) return res.status(403).send("Invalid credentials");

      if (!user.isAdmin) return res.status(403).send("Access denied. Not an admin.");

      const payload = { user: { id: user.id, isAdmin: user.isAdmin } };
      const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '10h' });

      res.json({
        token,
        user: {
          fullname: user.fullname,
          email: user.email,
          isAdmin: user.isAdmin,
        },
      });
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});





app.listen(5000, () => console.log('Server running on port 5000'));
