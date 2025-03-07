import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import mongoose from "mongoose";
import passport from "passport";
import session from "express-session";
import MongoStore from "connect-mongo";
import "./config/passport";

// routes 
import authRoute from "./routes/auth";
import contractsRoute from "./routes/contracts";
import paymentsRoute from "./routes/payments";
import { handleWebhook } from "./controllers/payment.controller";

const app = express();

mongoose
  .connect(process.env.MONGODB_URI!)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error(err));

// Improved CORS configuration
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

// Log environment variables for debugging
console.log("Server environment:", {
  NODE_ENV: process.env.NODE_ENV,
  CLIENT_URL: process.env.CLIENT_URL || "http://localhost:3000",
  PORT: process.env.PORT || 8080
});

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(morgan("dev"));

app.post(
  "/payments/webhook",
  express.raw({ type: "application/json" }),
  handleWebhook
);

app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET || "9450e352b5d26c30e31bddb726d4a4fe67897de8bd00da8ab7d55a08a9343d76",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI! }),
    cookie: {
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

// Add a status route for easy testing
app.get("/status", (req, res) => {
  res.json({ status: "ok", message: "API server is running" });
});

app.use("/auth", authRoute);
app.use("/contracts", contractsRoute);
app.use("/payments", paymentsRoute);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
  console.log(`API accessible at http://localhost:${PORT}`);
  console.log(`Make sure your frontend is configured to connect to this URL`);
});