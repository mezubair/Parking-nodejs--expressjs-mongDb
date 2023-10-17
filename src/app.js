const express = require('express');
const path = require('path');
const app = express();
const bodyParser = require('body-parser');
const { body, validationResult } = require('express-validator');
// const routes = require('./routes'); // Import the routes module

require("./db/conn");

const Register = require("./models/register");
const  json  = require("express");

// Use the imported API routes
// app.use('/', routes);

const port = process.env.port || 3000;

const static_path = path.join(__dirname, "../public");

app.use(express.static(static_path));
app.set("view engine", "hbs");

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(bodyParser.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(bodyParser.json()); // Parse JSON



//routing
app.get("/", (req, res) => {
   res.render('index')
});

app.get("/login", (req, res) => {
   res.render('login')
});

app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const existingUser = await Register.findOne({ email });

        if (!existingUser) {
            return res.status(400).render('login', { message: 'Invalid Email' });
        }

        if (existingUser.password !== password) {
            return res.status(400).render('login', { message: 'Invalid Password' });
        }

        res.render('userafterlogin');
    } catch (error) {
        console.error("Error during login:", error);
        res.status(500).send("Internal server error. Please try again later.");
    }
});

app.get("/register", (req, res) => {
   res.render('register')
});

app.post("/register", async (req, res) => {
    try {
        const { fullName, phoneNumber, email, password, confirmPassword } = req.body;
        const existingUserEmail = await Register.findOne({ email });
        const existingUserPhone = await Register.findOne({ phoneNumber });

        if (existingUserPhone || existingUserEmail) {
            return res.status(400).render('register', { message: 'Email or Phone Number already exists', formData: req.body});
        }


        const regNewUser = new Register({
            fullName: fullName,
            phoneNumber: phoneNumber,
            email: email,
            password: password,
            confirmPassword: confirmPassword
        });

        const registered = await regNewUser.save();
        return res.status(400).render('login', { message: 'Registration Successful'});
    } catch (error) {
        console.error("Error during registration:", error);
        res.status(500).send("Internal server error. Please try again later.");
    }
});



  
 

app.get("/admin", (req, res) => {
   res.render('admin')
});

app.get("/userafterlogin", (req, res) => {
   res.render('userafterlogin')
});
app.get("/vbook", (req, res) => {
   res.render('vbook')
});



app.get("/detail", (req, res) => {
   res.render('detail')
});



app.get("/privacy", (req, res) => {
   res.render('privacy')
});


app.get("/terms", (req, res) => {
   res.render('terms')
});


app.listen(port, () => {
   console.log(`Server is running at port: ${port}`)
});  