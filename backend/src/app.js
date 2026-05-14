import express from "express";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import compression from "compression";
import routes from "./routes/index.js";

const app = express();

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());

app.use(helmet());
app.use(cors({ origin: allowedOrigins, credentials: true, maxAge: 3600 }));
app.use(compression());

if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "ExamSync API is running." });
});

app.use("/api", routes);

export default app;
