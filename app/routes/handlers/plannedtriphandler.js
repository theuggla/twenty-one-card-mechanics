/**
 * Handlers for the planned trip-routes.
 */

let PlannedTrip = require('../../models/PlannedTrip')
let WebHook = require('../../models/WebHook')
let ptresource = require('../../lib/resources/plannedTripCollection')
let ptsingle = require('../../lib/resources/plannedTrip')
let axios = require('axios')
let err = require('restify-errors')

module.exports.info = function (req, res, next) {
  if (req.user.authorized) {
    PlannedTrip.findOne({_id: req.params.id})
    .then((trip) => {
      return ptsingle.getExtendedTrip(trip)
    })
    .then((jsontrip) => {
      return res.send(jsontrip)
    })
    .catch((error) => {
      let e = new err.NotFoundError({message: 'No such trip. ' + error.message})
      return next(e)
    })
  } else {
    PlannedTrip.findOne({_id: req.params.id})
    .then((trip) => {
      return ptsingle.getBaseTrip(trip)
    })
    .then((tripResource) => {
      return res.send(tripResource)
    })
    .catch((error) => {
      let e = new err.NotFoundError({message: 'No such trip. ' + error.message})
      return next(e)
    })
  }
}

module.exports.update = function (req, res, next) {
  console.log('updating trip')
  res.send({message: 'trip updated'})
  next(false)
}

module.exports.delete = function (req, res, next) {
  console.log('deleting trip')
  res.send({message: 'trip deleted'})
  next(false)
}

module.exports.add = function (req, res, next) {
  sendHook('AddTrip', {message: 'tripinfo'})
  if (!req.body.from || !req.body.to || !req.body.time || !req.body.seats) {
    return next(new err.BadRequestError({message: 'Missing parameter'}))
  } else {
    let newTrip = new PlannedTrip()
    newTrip.from = req.body.from
    newTrip.to = req.body.to
    newTrip.spaces = req.body.seats
    newTrip.time = new Date(req.body.time)
    newTrip._creator = req.user._id

    newTrip.save()
    .then((result) => {
      return res.send(201, {'created_at': '/plannedtrips/' + result._id})
    })
    .catch((error) => {
      next(new err.ServiceUnavailableError({}))
    })
  }
}

module.exports.deletePassenger = function (req, res, next) {
  console.log('deleting passenger')
  res.send({message: 'passenger deleted'})
  next(false)
}

module.exports.addPassenger = function (req, res, next) {
  console.log('adding passenger')
  res.send({message: 'passenger added'})
  next(false)
}

module.exports.list = function (req, res, next) {
  PlannedTrip.find({})
  .then((allTrips) => {
    return ptresource.getList(allTrips)
  })
  .then((listresource) => {
    return res.send(listresource)
  })
}

module.exports.passengers = function (req, res, next) {
  PlannedTrip.findOne({_id: req.params.id})
  .then((trip) => {
    return ptresource.getPassengerList(trip)
  })
  .then((listresource) => {
    return res.send(listresource)
  })
  .catch((error) => {
    console.log(error)
    let e = new err.NotFoundError({message: 'No such trip.'})
    return next(e)
  })
}

module.exports.collectionByDriver = function (req, res, next) {
  PlannedTrip.find({_creator: req.user._id})
  .then((allTrips) => {
    return ptresource.getDriverList(allTrips)
  })
  .then((listresource) => {
    return res.send(listresource)
  })
  .catch((error) => {
    let e = new err.NotFoundError({message: 'No such user.'})
    return next(e)
  })
}

module.exports.collectionByPassenger = function (req, res, next) {
  PlannedTrip.find({passengers: req.user._id})
  .then((allTrips) => {
    return ptresource.getPassengersList(allTrips)
  })
  .then((listresource) => {
    return res.send(listresource)
  })
  .catch((error) => {
    console.log(error)
    let e = new err.NotFoundError({message: 'No such user.'})
    return next(e)
  })
}

module.exports.hookinfo = function (req, res, next) {
  console.log('webhook')
}

module.exports.addhook = function (req, res, next) {
  console.log('add webhook')
}

function sendHook (event, payload) {
  console.log('sending webhook notification')
  /*WebHook.find({event: event}, (hooks) => {
    return Promise.all(hooks.map((hook) => axios.post(hook.callbackURL, payload)))
  })
  .then(() => {
    console.log('all hooks sent')
  })*/
}
