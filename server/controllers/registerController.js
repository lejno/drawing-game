const User = require("../models/user");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");

exports.register_post = [
  body("name").trim().isLength({ min: 1 }).withMessage("Name is required."),
  body("email")
    .trim()
    .isEmail()
    .withMessage("Invalid email address.")
    .normalizeEmail(),
  body("password")
    .trim()
    .notEmpty()
    .withMessage("Password is required.")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long."),

  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password } = req.body;

    try {
      const existingUser = await User.findOne({
        $or: [{ email }, { name }],
      });
      if (existingUser) {
        return res.status(400).json({ message: "User already exists." });
      }

      const newUser = new User({ name, email, password });
      await newUser.save();

      const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, {
        expiresIn: "7d",
      });

      res.status(201).json({ token });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error." });
    }
  },
];
