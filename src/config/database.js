import mongoose from "mongoose";

const connectDatabase = async () => {
  try {
    // Default connection string with database name
    const defaultUri ="";
    let mongoUri = process.env.MONGODB_URI || defaultUri;

    if (!mongoUri) {
      throw new Error("MONGODB_URI is not defined in environment variables");
    }

    // Validate connection string format
    if (
      !mongoUri.startsWith("mongodb://") &&
      !mongoUri.startsWith("mongodb+srv://")
    ) {
      throw new Error(
        "Invalid MongoDB connection string format. Must start with mongodb:// or mongodb+srv://"
      );
    }

    // Clean up the connection string - remove any whitespace
    mongoUri = mongoUri.trim();

    // Log connection attempt (without showing full credentials)
    const uriForLogging = mongoUri.replace(
      /\/\/([^:]+):([^@]+)@/,
      "//***:***@"
    );
    console.log(`🔌 Attempting to connect to MongoDB...`);
    console.log(`📍 Connection string: ${uriForLogging}`);

    // Connection options for better reliability
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000, // Timeout after 10s
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
      maxPoolSize: 10, // Maintain up to 10 socket connections
      minPoolSize: 5, // Maintain at least 5 socket connections
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);

    // Connection event handlers
    mongoose.connection.on("error", (err) => {
      console.error(`❌ MongoDB connection error: ${err.message}`);
    });

    mongoose.connection.on("disconnected", () => {
      console.log("⚠️  MongoDB disconnected");
    });

    mongoose.connection.on("reconnected", () => {
      console.log("✅ MongoDB reconnected");
    });

    // Graceful shutdown
    process.on("SIGINT", async () => {
      await mongoose.connection.close();
      console.log("MongoDB connection closed through app termination");
      process.exit(0);
    });
  } catch (error) {
    console.error(`\n❌ Error connecting to MongoDB: ${error.message}`);
    console.error("\n📋 Troubleshooting steps:");
    console.error("1. Check if MongoDB Atlas cluster is running (not paused)");
    console.error("2. Verify the connection string format is correct");
    console.error("3. Check network connectivity and firewall settings");
    console.error("4. Verify MongoDB credentials are correct");
    console.error("5. Ensure IP address is whitelisted in MongoDB Atlas");
    console.error("\n💡 Tip: For local development, you can use:");
    console.error("   mongodb://localhost:27017/appointify");
    console.error(
      "\n⚠️  Server will continue but database operations will fail.\n"
    );

    // In development, don't crash the server - allow it to start
    // This helps with development when DB might not be available
    if (process.env.NODE_ENV === "production") {
      process.exit(1);
    } else {
      console.log("🔄 Will retry connection on next request...\n");
    }
  }
};

export default connectDatabase;
