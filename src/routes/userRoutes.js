const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const session = require('express-session');
const axios = require("axios");
const Razorpay = require('razorpay');

const parkingLots = require('../models/parkingLot')
const VehicleEntry = require('../models/vehicleEntry');

require("../db/conn");

const Register = require("../models/register");

router.use(express.urlencoded({ extended: true }));
router.use(express.json());

// Session configuration
router.use(
    session({
        secret: 'mySecret',
        resave: true,
        saveUninitialized: true,
        cookie: { maxAge: 24 * 60 * 1000 }
    })
);

// Admin login verification middleware for POST requests
const userDetails = (req, res, next) => {
    if (req.session.user && req.session.userDetails) {
        next();
    } else {
        return res.status(400).render('userViews/login', { message: 'Please Log In First!' });
    }
};


router.get("/", (req, res) => {
    res.render('userViews/index')
});


router.get("/login", (req, res) => {

    res.render('userViews/login');
});

router.get("/logoutuser", userDetails, (req, res) => {

    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
            return res.status(500).send('Internal server error');
        }

        // Redirect to the login page after destroying the session
        res.redirect('login');
    });
});


router.get("/register", (req, res) => {
    res.render('userViews/register')
});



router.get("/slotBooking", userDetails, (req, res) => {
    const details = req.session.user;

    res.render('userViews/slotBooking')
});

router.get("/paymentSucess", userDetails, (req, res) => {
    res.render('userViews/paymentSucess')
});


// router.post implementation


router.post('/slotBooking', async (req, res) => {
    const { userLatitude, userLongitude, city, locality } = req.body;
    const origin = `${userLatitude},${userLongitude}`;
    const filteredParkingLots = await parkingLots.find({ city, locality });

    const apiKey = '75da3d7912msh345449a21dd102fp122829jsnd22aad6e0df2';
    const host = 'trueway-matrix.p.rapidapi.com';

    try {
        const distanceCalculations = filteredParkingLots.map(async (parkingLot) => {
            const { latitude, longitude } = parkingLot;
            const url = `https://trueway-matrix.p.rapidapi.com/CalculateDrivingMatrix?origins=${origin}&destinations=${latitude},${longitude}`;

            const options = {
                method: 'GET',
                url,
                headers: {
                    'X-RapidAPI-Key': apiKey,
                    'X-RapidAPI-Host': host,
                },
            };

            const response = await axios.request(options);

            if (response.data && response.data.distances && response.data.distances[0]) {
                const distanceInMeters = response.data.distances[0];
                const distanceInKilometers = (distanceInMeters / 1000).toFixed(1);
                parkingLot.distance = distanceInKilometers;
            } else {
                parkingLot.distance = 'N/A';
            }
        });

        await Promise.all(distanceCalculations);

        // Sort filtered parking lots by distance
        filteredParkingLots.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));
        console.log(filteredParkingLots);
        res.json({ parkingLots: filteredParkingLots, searchPerformed: true });
    } catch (error) {
        console.error('Error:', error);
        res.json({ parkingLots: filteredParkingLots, searchPerformed: true });
    }
});


router.get('/vbook', userDetails, async (req, res) => {
    const lotId = req.query.lotId;

    try {
        // Use Mongoose to retrieve the data based on lotId
        const lotData = await parkingLots.findById(lotId).exec();
        console.log(lotData);

        if (lotData) {
            // Render the 'vbook' template and pass the data to it
            res.render('userViews/vbook', { lotData });
        } else {
            res.status(404).send('Lot not found'); // Handle when the lot is not found
        }
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error'); // Handle database errors
    }
});



router.get("/detail", (req, res) => {
    res.render('userViews/detail')
});



router.get("/privacy", (req, res) => {
    res.render('userViews/privacy')
});


router.get("/terms", (req, res) => {
    res.render('userViews/terms')
});

router.get("/temp", (req, res) => {
    res.render('userViews/temp')
});


router.get('/userafterlogin', userDetails, async (req, res) => {


    const user = req.session.user;


    try {
        const uservehicle = await VehicleEntry.find({
            ownerContactNumber: user.phoneNumber,
            status: "In"
        });
        console.log(uservehicle);
        // Pass user data with associated vehicle entries to the view
        res.render('userViews/userafterlogin', { user: user, userEntries: uservehicle });
    } catch (error) {
        console.error('Error fetching user data:', error);
        res.status(500).send('Internal Server Error');
    }
});


////////  Post Requests ////////////////

router.post("/login", async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await Register.findOne({
            email: email,
            password: password,
        }); // Make sure 'parkingLots' refers to the correct Mongoose model

        if (user) {
            req.session.user = user; // Store user data in the session
            req.session.userDetails = true; // Set isAdmin flag in the session
            res.redirect('/userafterlogin');
        } else {
            return res.status(400).render('userViews/login', { message: 'Invalid Credentials' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});


router.post("/register", async (req, res) => {
    try {
        const { fullName, phoneNumber, email, password, confirmPassword } = req.body;
        const existingUserEmail = await Register.findOne({ email });
        const existingUserPhone = await Register.findOne({ phoneNumber });

        if (existingUserPhone || existingUserEmail) {
            return res.status(400).render('./userViews/register', { message: 'Email or Phone Number already exists', formData: req.body });
        }


        const regNewUser = new Register({
            fullName: fullName,
            phoneNumber: phoneNumber,
            email: email,
            password: password,
            confirmPassword: confirmPassword
        });

        const registered = await regNewUser.save();
        return res.status(400).render('./userViews/login', { message: 'Registration Successful' });
    } catch (error) {
        console.error("Error during registration:", error);
        res.status(500).send("Internal server error. Please try again later.");
    }
});

router.post("/vbook", async (req, res) => {
    try {
        // Extracting necessary information from the request body
        const { plotname, ownername, ownercontno, catename, vehcomp, vehreno, model, inTime, outTime, charges } = req.body;

        // Check for an existing entry with the same registrationNumber, status 'In', and inTime
        const existingEntry = await VehicleEntry.findOne({
            parkinglotName: plotname,
            registrationNumber: vehreno,
            status: 'In',
        });
        console.log("Existing entry:", existingEntry);

        // If an existing entry is found, return a duplicate entry error message
        if (existingEntry) {
            console.log("Duplicate entry found. Please check the data.");
            return res.status(400).render('./userViews/vbook', { message: 'Duplicate entry. Please check the data.' });
        }

        // If validation is successful, redirect the user to the payment page
        return res.status(200).render('./userViews/payment', { plotname, ownername, ownercontno, catename, vehcomp, vehreno, model, inTime, outTime, charges });
    } catch (error) {
        // Handle other potential errors with a generic server error message
        console.error("Error during form validation:", error);
        console.log("Internal server error. Please try again later.");
        res.status(500).send("Internal server error. Please try again later.");
    }
});


router.get("/payment", userDetails, (req, res) => {
    res.render('userViews/payment')
});

router.post("/payment", userDetails, async (req, res) => {
    const user = req.session.user;



    try {
        // Extracting necessary information from the request body
        const { plotname, ownername, catename, vehcomp, vehreno, model, inTime, outTime, submitSource, charges } = req.body;


        console.log(submitSource);
        // Generate a random parking number and fetch the current time in Asia/Kolkata timezone
        const parkingNumber = Math.floor(10000 + Math.random() * 90000);

        let newVehicle;

        if (submitSource === 'PayNow') {
            // Create a new instance of VehicleEntry with the extracted information
            newVehicle = new VehicleEntry({
                parkinglotName: plotname,
                parkingNumber: "CA-" + parkingNumber,
                ownerName: ownername,
                ownerContactNumber: user.phoneNumber,
                registrationNumber: vehreno,
                vehicleCategory: catename,
                vehicleCompanyname: vehcomp,
                vehicleModel: model,
                inTime: inTime,
                outTime: outTime,
                paymentStatus: "paid",
                totalCharge: charges
            });


            plotname.totalSpots -= 1;
            await newVehicle.save();  // Saving the newVehicle
            await parkingLots.findOneAndUpdate(
                { name: plotname.name },
                { $inc: { totalSpots: -1 } }
            );

        } else if (submitSource === 'PayLater') {
            // Create a new instance of VehicleEntry with the extracted information
            newVehicle = new VehicleEntry({
                parkinglotName: plotname,
                parkingNumber: "CA-" + parkingNumber,
                ownerName: ownername,
                ownerContactNumber: user.phoneNumber,
                registrationNumber: vehreno,
                vehicleCategory: catename,
                vehicleCompanyname: vehcomp,
                vehicleModel: model,
                inTime: inTime,
                outTime: outTime,
                paymentStatus: "awaited",
                totalCharge: charges
            });

   

            plotname.totalSpots -= 1;
            await newVehicle.save();  // Saving the newVehicle
            await parkingLots.findOneAndUpdate(
                { name: plotname.name },
                { $inc: { totalSpots: -1 } }
            );
        }
        const parkingLotDetails = await parkingLots.findOne({ name: plotname })
        const lat = parkingLotDetails.latitude;
        const longt = parkingLotDetails.longitude;
        console.log("Vehicle entry successfully saved.");
        return res.status(200).render('./userViews/paymentSucess', { parkingNumber, inTime, outTime, submitSource, lat, longt });
    }

    catch (error) {
        console.error("Error during registration:", error);
        // Handle the error as needed
        return res.status(500).send("Internal server error. Please try again later.");
    }


});







const razorpay = new Razorpay({
    key_id: "rzp_test_esJ9zn2E77SUXk",
    key_secret: "oPKYchsY7QOvBwppBSer2ywv",
});

router.post('/create-order', (req, res) => {
    const { amount } = req.body;
    const submitSource = req.body.submitSource;


    const options = {
        amount: amount * 100, // Razorpay amount is in paise, so multiply by 100
        currency: 'INR',
        receipt: 'order_receipt', // You can generate a unique receipt ID here
    };

    razorpay.orders.create(options, (err, order) => {
        if (err) {
            console.error('Error creating Razorpay order:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }

        res.json(order);
    });
});

router.post('/Cpayment', (req, res) => {
    const { payment_id, order_id, signature } = req.body;

    // Verify the payment signature
    const generatedSignature = razorpay.webhook.verifyPaymentSignature({
        order_id: order_id,
        payment_id: payment_id,
    }, signature);

    if (!generatedSignature) {
        console.error('Invalid Razorpay payment signature');
        return res.status(400).json({ error: 'Invalid Signature' });
    }

    // Perform additional validation and save data to your database
    // ...

    res.json({ success: true, message: 'Payment successful' });
});



module.exports = router;


