import express from "express";
import passport from "passport";

const router = express.Router();

// Google authentication route
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// Google authentication callback route
router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: process.env.CLIENT_URL ? `${process.env.CLIENT_URL}/login` : "http://localhost:3000/login",
    successRedirect: process.env.CLIENT_URL ? `${process.env.CLIENT_URL}/dashboard` : "http://localhost:3000/dashboard",
  })
);

// Route to check current user
router.get("/current-user", (req, res) => {
  if (req.isAuthenticated()) {
    res.json(req.user);
  } else {
    res.status(401).json({ error: "Unauthorized" });
  }
});

// Logout route
router.get("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    res.status(200).json({ status: "ok" });
  });
});

export default router;