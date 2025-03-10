import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User, { IUser } from "../models/user.model";

// For debugging
console.log("Setting up Google Strategy with:", {
  clientIDExists: !!process.env.GOOGLE_CLIENT_ID,
  clientSecretExists: !!process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.NODE_ENV === 'production'
    ? `${process.env.CLIENT_URL}/auth/google/callback`
    : 'http://localhost:8080/auth/google/callback'
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // Simplified callback URL construction
      callbackURL: process.env.NODE_ENV === 'production'
        ? `${process.env.CLIENT_URL}/auth/google/callback`
        : 'http://localhost:8080/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log("Google authentication succeeded, profile ID:", profile.id);
        let user = await User.findOne({ googleId: profile.id });

        if (!user) {
          console.log("Creating new user for Google ID:", profile.id);
          user = await User.create({
            googleId: profile.id,
            email: profile.emails![0].value,
            displayName: profile.displayName,
            profilePicture: profile.photos![0].value,
          });
        } else {
          console.log("Found existing user for Google ID:", profile.id);
        }

        done(null, user);
      } catch (error) {
        console.error("Error in Google auth strategy:", error);
        done(error as Error, undefined);
      }
    }
  )
);

passport.serializeUser((user: any, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    console.error("Error deserializing user:", error);
    done(error, null);
  }
});