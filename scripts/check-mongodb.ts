import "dotenv/config";
import { mongoose } from "@typegoose/typegoose";

async function checkMongoConnection() {
  const dbUrl = process.env.DB_URL;
  if (!dbUrl) {
    console.error("❌ DB_URL is not set in .env");
    process.exit(1);
  }

  // Don't log the full URL (may contain password)
  const hasUrl = dbUrl.length > 0;
  console.log("🔌 Attempting to connect to MongoDB...");

  try {
    await mongoose.connect(dbUrl);
    console.log("✅ MongoDB connection successful!");
    const state = mongoose.connection.readyState;
    const states = ["disconnected", "connected", "connecting", "disconnecting"];
    console.log("   Ready state:", states[state] || state);
  } catch (error) {
    console.error("❌ MongoDB connection failed:");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

checkMongoConnection();
