const jwt = require("jsonwebtoken");

function getTokenFromCookie(cookieHeader) {
  if (typeof cookieHeader !== "string") return null;

  const tokenCookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("token="));

  return tokenCookie ? decodeURIComponent(tokenCookie.slice(6)) : null;
}

function verifyToken(token) {
  if (!token || !process.env.JWT_SECRET) return null;

  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

function authenticateRequest(req, res, next) {
  const payload = verifyToken(getTokenFromCookie(req.headers.cookie));
  if (!payload) {
    return res.status(401).json({ message: "Authentication equired." });
  }

  req.user = payload;
  next();
}

module.exports = {
  authenticateRequest,
  getTokenFromCookie,
  verifyToken,
};
