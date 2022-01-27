// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// Implementation of the API backend for locations

const handlers = require('./handlers');
const express = require('express');
const bodyParser = require('body-parser');
const { metricScope, createMetricsLogger } = require("aws-embedded-metrics");
const AWSXRay = require("aws-xray-sdk");

// App
const app = express();
const jsonParser = bodyParser.json()

const logBusinessMetric = metricScope(metrics => function (req, res, next) {
    metrics.putMetric("ProcessedBookings", 1, "Count");
    metrics.setProperty("requestId", req.get('requestId'));
    metrics.setProperty('method', req.method);
    metrics.setProperty("routeKey", req.originalUrl);
    next();
});

app.use(AWSXRay.express.openSegment('bookings-service'));

app.get('/health', (req, res) => {
    res.status(200).send('Ok');
});

app.get('/locations/:locationID/resources/:resourceID/bookings', logBusinessMetric, async (req, res, next) => {
    try {
        const { locationID, resourceID } = req.params;

        // Get bookings
        const bookings = await handlers.getBookingsByResource(resourceID);

        res.json(bookings);
    }
    catch (err) {
        next(err)
    }
});

app.get('/users/:userID/bookings', logBusinessMetric, async (req, res, next) => {
    try {
        const { userID } = req.params;

        // Get bookings
        const bookings = await handlers.getBookingsByUser(userID);

        res.json(bookings);
    }
    catch (err) {
        next(err)
    }
});

app.get('/users/:userID/bookings/:bookingID', logBusinessMetric, async (req, res, next) => { 
    try {
        const { bookingID } = req.params;

        // Get booking
        const resource = await handlers.getBooking(bookingID);

        res.json(resource);
    }
    catch (err) {
        next(err)
    }
});

app.put('/users/:userID/bookings/:bookingID?', logBusinessMetric, jsonParser, async (req, res, next) => {
    try {
        const { userID, bookingID } = req.params;
        const { resourceID, starttimeepochtime} = req.body;

        // Create booking
        const booking = await handlers.upsertBooking(bookingID, userID, resourceID, starttimeepochtime);

        res.status(201).json(booking);
    }
    catch (err) {
        next(err)
    }
});

app.delete('/users/:userID/bookings/:bookingID', logBusinessMetric, async (req, res, next) => {
    try {
        const { bookingID } = req.params;

        // Delete booking
        await handlers.deleteBooking(bookingID);

        res.status(200).send();
    }
    catch (err) {
        next(err)
    }
});

app.use(AWSXRay.express.closeSegment());

app.use(function (err, req, res, next) {
    const metricsLogger = createMetricsLogger();
    metricsLogger.putMetric("BookingsErrors", 1, "Count");
    metricsLogger.setProperty("requestId", req.get('requestId'));
    metricsLogger.setProperty('method', req.method);
    metricsLogger.setProperty("routeKey", req.originalUrl);
    metricsLogger.flush();

    console.error(err.stack)
    if (err instanceof handlers.ItemNotFoundError) {
        res.status(404).send(err.message);
    }
    else {
        res.status(500).send('Something broke!')
    }
  })

exports.app = app;