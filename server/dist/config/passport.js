"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const passport_1 = __importDefault(require("passport"));
const passport_google_oauth20_1 = require("passport-google-oauth20");
const user_model_1 = __importDefault(require("../models/user.model"));
// For debugging
console.log("Setting up Google Strategy with:", {
    clientIDExists: !!process.env.GOOGLE_CLIENT_ID,
    clientSecretExists: !!process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.NODE_ENV === 'production'
        ? `${process.env.CLIENT_URL}/auth/google/callback`
        : 'http://localhost:8080/auth/google/callback'
});
passport_1.default.use(new passport_google_oauth20_1.Strategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    // Simplified callback URL construction
    callbackURL: process.env.NODE_ENV === 'production'
        ? `${process.env.CLIENT_URL}/auth/google/callback`
        : 'http://localhost:8080/auth/google/callback',
}, (accessToken, refreshToken, profile, done) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log("Google authentication succeeded, profile ID:", profile.id);
        let user = yield user_model_1.default.findOne({ googleId: profile.id });
        if (!user) {
            console.log("Creating new user for Google ID:", profile.id);
            user = yield user_model_1.default.create({
                googleId: profile.id,
                email: profile.emails[0].value,
                displayName: profile.displayName,
                profilePicture: profile.photos[0].value,
            });
        }
        else {
            console.log("Found existing user for Google ID:", profile.id);
        }
        done(null, user);
    }
    catch (error) {
        console.error("Error in Google auth strategy:", error);
        done(error, undefined);
    }
})));
passport_1.default.serializeUser((user, done) => {
    done(null, user._id);
});
passport_1.default.deserializeUser((id, done) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = yield user_model_1.default.findById(id);
        done(null, user);
    }
    catch (error) {
        console.error("Error deserializing user:", error);
        done(error, null);
    }
}));
