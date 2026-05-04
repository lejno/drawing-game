var express = require("express");

var router = express.Router();
const room_controller = require("../controllers/roomsController");

router.get("/rooms", room_controller.fetchRooms);

module.exports = router;
