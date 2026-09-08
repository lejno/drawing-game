const jwt = require("jsonwebtoken");

// Read the JWT issued during login from the HTTP-only token cookie.
function getTokenFromCookie(cookieHeader) {
  if (typeof cookieHeader !== "string") return null;

  const tokenCookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("token="));

  return tokenCookie ? decodeURIComponent(tokenCookie.slice(6)) : null;
}

// Verify the token signature and return its payload, or null when invalid.
function verifyToken(token) {
  if (!token || !process.env.JWT_SECRET) return null;

  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

// Protect an Express route by validating the JWT and exposing its payload as req.user.
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
