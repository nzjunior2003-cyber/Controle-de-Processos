import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

// Create default transpoter if env variables exist
const getTransporter = () => {
  if (process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT),
      secure: process.env.SMTP_PORT === "465",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  // Fallback to testing/logged transporter for dev without SMTP vars
  return null;
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/send-email", async (req, res) => {
    try {
      const { to, subject, text, html } = req.body;
      
      if (!to || !subject || (!text && !html)) {
        return res.status(400).json({ error: "Missing required fields (to, subject, text/html)" });
      }

      const transporter = getTransporter();

      if (transporter) {
        const info = await transporter.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to,
          subject,
          text,
          html,
        });

        console.log("Email sent:", info.messageId);
        return res.json({ success: true, messageId: info.messageId });
      } else {
        // If SMTP vars are missing, just simulate sending email so the UI works
        console.log("[MOCK EMAIL SENT]");
        console.log("To:", to);
        console.log("Subject:", subject);
        console.log("Body:", text || html);
        return res.json({ success: true, mock: true, message: "Email simulated. Configure SMTP variables in .env to send real emails." });
      }

    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ error: "Failed to send email" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
