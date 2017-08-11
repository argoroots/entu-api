'use strict'

if(process.env.NEW_RELIC_LICENSE_KEY) { require('newrelic') }

const bparser    = require('body-parser')
const cparser    = require('cookie-parser')
const express    = require('express')
const passport   = require('passport')
const raven      = require('raven')

const entu       = require('./helpers/entu')



// global variables (and list of all used environment variables)
const APP_VERSION = process.env.VERSION || process.env.HEROKU_SLUG_COMMIT || require('./package').version
const APP_STARTED = new Date().toISOString()
const APP_PORT = process.env.PORT || 3000
const APP_JWT_SECRET = process.env.JWT_SECRET || '123abc'

const APP_MONGODB = process.env.MONGODB || 'mongodb://entu_mongodb:27017/'

const GOOGLE_ID = process.env.GOOGLE_ID
const GOOGLE_SECRET = process.env.GOOGLE_SECRET

const FACEBOOK_ID = process.env.FACEBOOK_ID
const FACEBOOK_SECRET = process.env.FACEBOOK_SECRET

const TWITTER_KEY = process.env.TWITTER_KEY
const TWITTER_SECRET = process.env.TWITTER_SECRET

const LIVE_ID = process.env.LIVE_ID
const LIVE_SECRET = process.env.LIVE_SECRET

const TAAT_ENTRYPOINT = process.env.TAAT_ENTRYPOINT
const TAAT_ISSUER = process.env.TAAT_ISSUER
const TAAT_CERT = process.env.TAAT_CERT
const TAAT_PRIVATECERT = process.env.TAAT_PRIVATECERT

var APP_CUSTOMERS = process.env.CUSTOMERS.split(',') || []
var APP_DBS = {}


// passport (de)serialize
passport.serializeUser(function (user, done) {
    done(null, user)
})

passport.deserializeUser(function (user, done) {
    done(null, user)
})



// initialize getsentry.com client
if(process.env.SENTRY_DSN) {
    raven.config(process.env.SENTRY_DSN, {
        release: APP_VERSION,
        dataCallback: function (data) {
            delete data.request.env
            return data
        }
    }).install()
}



// start express app
var app = express()

// Hide Powered By
app.disable('x-powered-by')

// get correct client IP behind nginx
app.set('trust proxy', true)

// logs to getsentry.com - start
if(process.env.SENTRY_DSN) {
    app.use(raven.requestHandler())
}

// Initialize Passport
app.use(passport.initialize())

// parse Cookies
app.use(cparser())

// parse POST requests
app.use(bparser.json())
app.use(bparser.urlencoded({extended: true}))

// save request info to request collection, check JWT, custom JSON output
app.use(entu.requestLog)
app.use(entu.customResponder)
app.use(entu.jwtCheck)

// Redirect HTTP to HTTPS
app.use(function (req, res, next) {
    if (req.protocol.toLowerCase() !== 'https') { next([418, 'I\'m a teapot']) } else { next() }
})

// routes mapping
app.use('/', require('./routes/index'))
app.use('/auth', require('./routes/auth/index'))
app.use('/user', require('./routes/user'))
app.use('/entity', require('./routes/entity'))

// provider mapping (only if configured)
app.use('/auth/id-card', require('./routes/auth/id-card'))

if(GOOGLE_ID && GOOGLE_SECRET) { app.use('/auth/google', require('./routes/auth/google')) }
if(FACEBOOK_ID && FACEBOOK_SECRET) { app.use('/auth/facebook', require('./routes/auth/facebook')) }
if(TWITTER_KEY && TWITTER_SECRET) { app.use('/auth/twitter', require('./routes/auth/twitter')) }
if(LIVE_ID && LIVE_SECRET) { app.use('/auth/live', require('./routes/auth/live')) }
if(TAAT_ENTRYPOINT && TAAT_CERT && TAAT_PRIVATECERT) { app.use('/auth/taat', require('./routes/auth/taat')) }

// logs to getsentry.com - error
if(process.env.SENTRY_DSN) {
    app.use(raven.errorHandler())
}

// show 404
app.use(function (req, res, next) {
    next([404, 'Not found'])
})

// show error
app.use(function (err, req, res, next) {
    var code = 500
    var error = err
    if (err.constructor === Array) {
        code = err[0]
        error = err[1]
    }
    res.respond(error.toString(), code)
})

// start server
app.listen(APP_PORT, function () {
    console.log(new Date().toString() + ' started listening port ' + APP_PORT)
})
