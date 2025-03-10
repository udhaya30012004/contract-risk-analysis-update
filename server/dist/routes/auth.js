"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const passport_1 = __importDefault(require("passport"));
const router = express_1.default.Router();
// Debug route to check if auth routes are accessible
router.get("/test", (req, res) => {
    res.json({
        message: "Auth routes are working",
        authRoutes: [
            "/auth/google",
            "/auth/google/callback",
            "/auth/current-user",
            "/auth/logout"
        ],
        env: {
            NODE_ENV: process.env.NODE_ENV || "development",
            clientUrl: process.env.CLIENT_URL || "http://localhost:3000",
            hasGoogleCredentials: !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET
        }
    });
});
// Google authentication route
router.get("/google", (req, res, next) => {
    console.log("Google auth route accessed");
    next();
}, passport_1.default.authenticate("google", { scope: ["profile", "email"] }));
// Google authentication callback route
router.get("/google/callback", (req, res, next) => {
    console.log("Google callback route accessed");
    next();
}, passport_1.default.authenticate("google", {
    failureRedirect: process.env.CLIENT_URL ? `${process.env.CLIENT_URL}/login` : "http://localhost:3000/login",
    successRedirect: process.env.CLIENT_URL ? `${process.env.CLIENT_URL}/dashboard` : "http://localhost:3000/dashboard",
}));
// Route to check current user
router.get("/current-user", (req, res) => {
    if (req.isAuthenticated()) {
        res.json(req.user);
    }
    else {
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
exports.default = router;
