const path = require("node:path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const bcrypt = require("bcryptjs");
const MongoStore = require("connect-mongo");
const express = require("express");
const session = require("express-session");
const { rateLimit } = require("express-rate-limit");
const helmet = require("helmet");
const mongoose = require("mongoose");
const multer = require("multer");

const app = express();
const port = Number(process.env.PORT) || 3000;
const sessionSecret = process.env.SESSION_SECRET;
const mongoUri = process.env.MONGODB_URI;
const adminEmails = new Set((process.env.ADMIN_EMAIL || "").split(",").map(email => email.trim().toLowerCase()).filter(Boolean));
const allowedOrigins = new Set((process.env.FRONTEND_ORIGINS || "").split(",").map(origin => origin.trim()).filter(Boolean));
const isProduction = process.env.NODE_ENV === "production";
const sessionCookieName = "garisafi.sid";
const maximumImageSize = 5 * 1024 * 1024;
const maximumCarPhotoCount = 10;
const minimumCarPhotoCount = 5;
const maximumCarPhotoTotal = 12 * 1024 * 1024;
const maximumPartPhotoCount = 10;
const maximumPartPhotoTotal = 12 * 1024 * 1024;
const adminPageSize = 25;
const adminMessagePageSize = 50;
const allowedCarPriceRanges = ["under-3000000", "3000000-7000000", "7000000-10000000", "over-10000000"];
const allowedBodyStyles = ["SUV", "Sedan", "Hatchback", "Coupe", "Pickup", "Van", "Other"];
const publicFiles = new Set(["/", "/index.html", "/sell.html", "/sell-part.html", "/car.html", "/parts.html", "/part.html", "/inbox.html", "/admin.html", "/login.html", "/register.html", "/styles.css", "/app.js", "/car.js", "/parts.js", "/part-detail.js", "/part-sell.js", "/inbox.js", "/admin.js", "/admin.css", "/auth.js", "/site-menu.js", "/toast.js", "/search-analytics.js"]);
const allowedPartCategories = ["Engine", "Brakes", "Electrical", "Body & Exterior", "Interior", "Wheels & Tyres", "Suspension", "Other"];
const allowedPartConditions = ["New", "Used"];

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  phone: { type: String, required: true, trim: true, maxlength: 16 },
  passwordHash: { type: String, required: true, select: false },
  isBlocked: { type: Boolean, default: false }
}, { timestamps: true });

const carSchema = new mongoose.Schema({
  make: { type: String, required: true, trim: true, maxlength: 40 },
  model: { type: String, required: true, trim: true, maxlength: 50 },
  year: { type: Number, required: true, min: 1950, max: 2100 },
  mileage: { type: Number, required: true, min: 0 },
  body: { type: String, required: true, enum: allowedBodyStyles },
  price: { type: Number, required: true, min: 1000 },
  description: { type: String, trim: true, maxlength: 1000 },
  sellerPhone: { type: String, trim: true, maxlength: 16 },
  photos: [{
    data: { type: Buffer, required: true },
    contentType: { type: String, required: true, enum: ["image/jpeg", "image/png", "image/webp"] }
  }],
  photo: { type: Buffer, select: false },
  photoContentType: { type: String, enum: ["image/jpeg", "image/png", "image/webp"] },
  photoUrl: { type: String },
  seller: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  seedKey: { type: String, unique: true, sparse: true }
}, { timestamps: true });

const sparePartSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 80 },
  category: { type: String, required: true, enum: allowedPartCategories },
  condition: { type: String, required: true, enum: allowedPartConditions },
  compatibleVehicles: { type: String, trim: true, maxlength: 100 },
  description: { type: String, required: true, trim: true, maxlength: 500 },
  price: { type: Number, required: true, min: 1 },
  sellerPhone: { type: String, trim: true, maxlength: 16 },
  photos: [{
    data: { type: Buffer, required: true, select: false },
    contentType: { type: String, required: true, enum: ["image/jpeg", "image/png", "image/webp"] }
  }],
  photo: { type: Buffer, select: false },
  photoContentType: { type: String, enum: ["image/jpeg", "image/png", "image/webp"] },
  seller: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

const conversationSchema = new mongoose.Schema({
  car: { type: mongoose.Schema.Types.ObjectId, ref: "Car" },
  part: { type: mongoose.Schema.Types.ObjectId, ref: "SparePart" },
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  seller: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  lastMessage: { type: String, default: "" },
  lastMessageAt: { type: Date, default: Date.now }
}, { timestamps: true });
conversationSchema.index(
  { car: 1, buyer: 1 },
  { unique: true, partialFilterExpression: { car: { $type: "objectId" }, buyer: { $type: "objectId" } } }
);
conversationSchema.index(
  { part: 1, buyer: 1 },
  { unique: true, partialFilterExpression: { part: { $type: "objectId" }, buyer: { $type: "objectId" } } }
);
conversationSchema.index({ buyer: 1, lastMessageAt: -1 });
conversationSchema.index({ seller: 1, lastMessageAt: -1 });

const messageSchema = new mongoose.Schema({
  conversation: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  body: { type: String, required: true, trim: true, maxlength: 2000 }
}, { timestamps: true });

const searchEventSchema = new mongoose.Schema({
  market: { type: String, required: true, enum: ["cars", "parts"] },
  query: { type: String, required: true, trim: true, maxlength: 80 },
  category: { type: String, trim: true, maxlength: 40, default: "" },
  priceRange: { type: String, trim: true, maxlength: 30, default: "" }
}, { timestamps: true });
searchEventSchema.index({ market: 1, createdAt: -1 });

const User = mongoose.model("User", userSchema);
const Car = mongoose.model("Car", carSchema);
const SparePart = mongoose.model("SparePart", sparePartSchema);
const Conversation = mongoose.model("Conversation", conversationSchema);
const Message = mongoose.model("Message", messageSchema);
const SearchEvent = mongoose.model("SearchEvent", searchEventSchema);
let sessionMiddleware;

const starterCars = [
  {
    seedKey: "starter-porsche-911",
    make: "Porsche",
    model: "911 Carrera",
    year: 2022,
    mileage: 8240,
    body: "Coupe",
    price: 14650000,
    photoUrl: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=900&q=85"
  },
  {
    seedKey: "starter-bmw-x5",
    make: "BMW",
    model: "X5 xDrive40i",
    year: 2023,
    mileage: 12600,
    body: "SUV",
    price: 8750000,
    photoUrl: "https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=900&q=85"
  },
  {
    seedKey: "starter-mercedes-c300",
    make: "Mercedes-Benz",
    model: "C 300",
    year: 2022,
    mileage: 18300,
    body: "Sedan",
    price: 6325000,
    photoUrl: "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?auto=format&fit=crop&w=900&q=85"
  }
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maximumImageSize, files: maximumCarPhotoCount, fields: 10, fieldSize: 2048 },
  fileFilter: (request, file, callback) => {
    const acceptedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!acceptedTypes.includes(file.mimetype)) {
      callback(new Error("Upload a JPG, PNG, or WebP listing photo."));
      return;
    }
    callback(null, true);
  }
});

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many sign-in attempts. Please try again in 15 minutes." }
});

const messageRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "You are sending messages too quickly. Please try again later." }
});

const searchRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Search tracking is temporarily limited. Please try again later." }
});

function asyncHandler(handler) {
  return (request, response, next) => Promise.resolve(handler(request, response, next)).catch(next);
}

function checkSameOrigin(request, response, next) {
  const origin = request.get("origin");
  if (origin && origin !== `${request.protocol}://${request.get("host")}` && !allowedOrigins.has(origin)) {
    response.status(403).json({ error: "Request origin is not allowed." });
    return;
  }
  next();
}

function requireAuth(request, response, next) {
  if (!request.session.userId) {
    response.status(401).json({ error: "Sign in to continue." });
    return;
  }
  next();
}

async function requireAdmin(request, response, next) {
  if (!request.session.userId) {
    response.status(401).json({ error: "Sign in to continue." });
    return;
  }
  if (!adminEmails.size) {
    response.status(503).json({ error: "Admin access has not been configured." });
    return;
  }
  try {
    const user = await User.findById(request.session.userId).select("name email").lean();
    if (!user || !adminEmails.has(user.email)) {
      response.status(403).json({ error: "You do not have permission to access the admin site." });
      return;
    }
    request.adminUser = user;
    next();
  } catch (error) {
    next(error);
  }
}

function isConversationParticipant(conversation, userId) {
  return String(conversation.buyer) === userId || String(conversation.seller) === userId;
}

function serializeMessage(message) {
  const sender = message.sender && typeof message.sender === "object" ? message.sender : null;
  return {
    id: String(message._id || message.id),
    senderId: String(sender?._id || message.sender || ""),
    senderName: sender?.name || "",
    body: message.body,
    createdAt: message.createdAt
  };
}

function serializeConversation(conversation, userId) {
  const car = conversation.car;
  const part = conversation.part;
  const buyer = conversation.buyer;
  const seller = conversation.seller;
  const counterpart = String(buyer?._id || buyer) === userId ? seller : buyer;
  const listing = car
    ? { type: "car", id: String(car._id), title: `${car.year} ${car.make} ${car.model}`, photoUrl: serializeCar(car).photoUrl }
    : part
      ? { type: "part", id: String(part._id), title: part.title, photoUrl: serializeSparePart(part).photoUrl }
      : null;
  return {
    id: String(conversation._id),
    car: listing?.type === "car" ? listing : null,
    part: listing?.type === "part" ? listing : null,
    listing,
    counterpart: { id: String(counterpart?._id || counterpart || ""), name: counterpart?.name || "Former member" },
    lastMessage: conversation.lastMessage,
    lastMessageAt: conversation.lastMessageAt
  };
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function detectImageType(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

function serializeCar(car) {
  const id = String(car._id || car.id);
  const photoUrls = Array.isArray(car.photos) && car.photos.length
    ? car.photos.map((_, index) => `/api/cars/${id}/photos/${index}`)
    : car.photoContentType ? [`/api/cars/${id}/photo`] : car.photoUrl ? [car.photoUrl] : [];
  return {
    id,
    make: car.make,
    model: car.model,
    year: car.year,
    mileage: car.mileage,
    body: car.body,
    price: car.price,
    description: car.description || "",
    photoUrl: photoUrls[0] || "",
    photoUrls,
    photoCount: photoUrls.length,
    createdAt: car.createdAt
  };
}

function serializeCarDetails(car) {
  const seller = car.seller && typeof car.seller === "object" ? car.seller : null;
  return {
    ...serializeCar(car),
    seller: {
      id: seller?._id ? String(seller._id) : "",
      name: seller?.name || "GariSafi seller",
      email: seller?.email || "",
      phone: car.sellerPhone || ""
    }
  };
}

function serializeSparePart(part) {
  const id = String(part._id || part.id);
  const photoUrls = Array.isArray(part.photos) && part.photos.length
    ? part.photos.map((_, index) => `/api/parts/${id}/photos/${index}`)
    : part.photoContentType ? [`/api/parts/${id}/photo`] : [];
  return {
    id,
    title: part.title,
    category: part.category,
    condition: part.condition,
    compatibleVehicles: part.compatibleVehicles,
    description: part.description,
    price: part.price,
    sellerId: part.seller?._id ? String(part.seller._id) : part.seller ? String(part.seller) : "",
    photoUrl: photoUrls[0] || "",
    photoUrls,
    photoCount: photoUrls.length,
    sellerName: part.seller?.name || "Former member",
    sellerEmail: part.seller?.email || "",
    createdAt: part.createdAt
  };
}

app.set("trust proxy", isProduction ? 1 : false);
app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      imgSrc: ["'self'", "data:", "blob:", "https://images.unsplash.com"],
      styleSrc: ["'self'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
      formAction: ["'self'"]
    }
  }
}));

app.use(express.json({ limit: "16kb" }));
app.use((request, response, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return checkSameOrigin(request, response, next);
  next();
});

app.use((request, response, next) => {
  if (!sessionMiddleware) {
    next(new Error("Session storage is not ready."));
    return;
  }
  sessionMiddleware(request, response, next);
});

app.use(asyncHandler(async (request, response, next) => {
  if (!request.session.userId || request.path === "/api/auth/logout") {
    next();
    return;
  }
  const user = await User.findById(request.session.userId).select("isBlocked").lean();
  if (user && !user.isBlocked) {
    next();
    return;
  }
  if (request.path.startsWith("/api/")) {
    response.status(user ? 403 : 401).json({
      error: user ? "This account is blocked from accessing GariSafi." : "Your account is no longer available. Sign in again."
    });
    return;
  }
  response.sendStatus(user ? 403 : 401);
}));

app.get("/api/health", (request, response) => {
  response.json({ status: mongoose.connection.readyState === 1 ? "ok" : "unavailable" });
});

app.post("/api/searches", searchRateLimit, asyncHandler(async (request, response) => {
  const body = request.body || {};
  const market = body.market;
  const query = normalizeText(body.query).replace(/\s+/g, " ").slice(0, 80).toLowerCase();
  const category = normalizeText(body.category);
  const priceRange = normalizeText(body.priceRange);
  const validCategory = market === "cars" ? !category || allowedBodyStyles.includes(category)
    : market === "parts" ? !category || allowedPartCategories.includes(category)
      : false;
  if (!["cars", "parts"].includes(market) || !validCategory
    || (market === "cars" && priceRange && !allowedCarPriceRanges.includes(priceRange))
    || (market === "parts" && priceRange)) {
    response.status(400).json({ error: "The search details are invalid." });
    return;
  }
  if (!query && !category && !priceRange) {
    response.status(204).end();
    return;
  }
  await SearchEvent.create({ market, query, category, priceRange });
  response.status(204).end();
}));

app.post("/api/auth/register", authRateLimit, asyncHandler(async (request, response) => {
  const body = request.body || {};
  const name = normalizeText(body.name);
  const email = normalizeText(body.email).toLowerCase();
  const phone = normalizeText(body.phone).replace(/[\s()-]/g, "");
  const password = body.password;
  if (!name || name.length > 80 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    || !/^\+[1-9]\d{7,14}$/.test(phone) || typeof password !== "string" || password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
    response.status(400).json({ error: "Enter your name, a valid email, an international phone number, and a password of 8 to 72 characters." });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  let user;
  try {
    user = await User.create({ name, email, phone, passwordHash });
  } catch (error) {
    if (error.code === 11000) {
      response.status(409).json({ error: "An account with this email already exists. Sign in instead." });
      return;
    }
    throw error;
  }

  await new Promise((resolve, reject) => {
    request.session.regenerate(error => error ? reject(error) : resolve());
  });
  request.session.userId = user.id;
  response.status(201).json({ user: { id: user.id, name: user.name, email: user.email } });
}));

app.post("/api/auth/login", authRateLimit, asyncHandler(async (request, response) => {
  const body = request.body || {};
  const email = normalizeText(body.email).toLowerCase();
  const password = body.password;
  if (!email || email.length > 254 || typeof password !== "string" || Buffer.byteLength(password, "utf8") > 72) {
    response.status(400).json({ error: "Enter your email and password." });
    return;
  }

  const user = await User.findOne({ email }).select("+passwordHash");
  if (!user || !await bcrypt.compare(password, user.passwordHash)) {
    response.status(401).json({ error: "Email or password is incorrect." });
    return;
  }
  if (user.isBlocked) {
    response.status(403).json({ error: "This account is blocked from accessing GariSafi. Contact the site administrator for help." });
    return;
  }

  await new Promise((resolve, reject) => {
    request.session.regenerate(error => error ? reject(error) : resolve());
  });
  request.session.userId = user.id;
  response.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      isAdmin: adminEmails.has(user.email)
    }
  });
}));

app.get("/api/auth/me", asyncHandler(async (request, response) => {
  if (!request.session.userId) {
    response.status(401).json({ error: "You are not signed in." });
    return;
  }
  const user = await User.findById(request.session.userId).select("name email");
  if (!user) {
    request.session.destroy(() => {});
    response.status(401).json({ error: "Your session has expired. Sign in again." });
    return;
  }
  response.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      isAdmin: adminEmails.has(user.email)
    }
  });
}));

app.post("/api/auth/logout", asyncHandler(async (request, response) => {
  if (!request.session.userId) {
    response.status(204).end();
    return;
  }
  await new Promise((resolve, reject) => {
    request.session.destroy(error => error ? reject(error) : resolve());
  });
  response.clearCookie(sessionCookieName, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/"
  });
  response.status(204).end();
}));

app.get("/api/conversations", requireAuth, asyncHandler(async (request, response) => {
  const userId = request.session.userId;
  const conversations = await Conversation.find({ $or: [{ buyer: userId }, { seller: userId }] })
    .sort({ lastMessageAt: -1 })
    .populate("car", "make model year photos.contentType photoContentType photoUrl")
    .populate("part", "title photos.contentType photoContentType")
    .populate("buyer", "name")
    .populate("seller", "name")
    .lean();
  response.json({ conversations: conversations.map(conversation => serializeConversation(conversation, userId)) });
}));

app.get("/api/conversations/:id/messages", requireAuth, asyncHandler(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    response.status(404).json({ error: "Conversation not found." });
    return;
  }
  const conversation = await Conversation.findById(request.params.id).select("buyer seller");
  if (!conversation || !isConversationParticipant(conversation, request.session.userId)) {
    response.status(404).json({ error: "Conversation not found." });
    return;
  }
  const messages = await Message.find({ conversation: conversation.id })
    .sort({ createdAt: -1 })
    .limit(100)
    .populate("sender", "name")
    .lean();
  response.json({ messages: messages.reverse().map(serializeMessage) });
}));

app.post("/api/conversations/:id/messages", requireAuth, messageRateLimit, asyncHandler(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    response.status(404).json({ error: "Conversation not found." });
    return;
  }
  const body = normalizeText(request.body?.body);
  if (!body || body.length > 2000) {
    response.status(400).json({ error: "Enter a message of 1 to 2,000 characters." });
    return;
  }
  const conversation = await Conversation.findById(request.params.id);
  if (!conversation || !isConversationParticipant(conversation, request.session.userId)) {
    response.status(404).json({ error: "Conversation not found." });
    return;
  }
  const message = await Message.create({
    conversation: conversation.id,
    sender: request.session.userId,
    body
  });
  conversation.lastMessage = body.slice(0, 160);
  conversation.lastMessageAt = message.createdAt;
  await conversation.save();
  await message.populate("sender", "name");
  response.status(201).json({ message: serializeMessage(message) });
}));

app.post("/api/cars/:id/conversations", requireAuth, asyncHandler(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    response.status(404).json({ error: "Car listing not found." });
    return;
  }
  const car = await Car.findById(request.params.id).select("seller make model year");
  if (!car || !car.seller) {
    response.status(404).json({ error: "This seller is not available for in-site messaging." });
    return;
  }
  const buyerId = request.session.userId;
  if (String(car.seller) === buyerId) {
    response.status(400).json({ error: "You cannot start a conversation with yourself." });
    return;
  }
  let conversation;
  try {
    conversation = await Conversation.findOneAndUpdate(
      { car: car.id, buyer: buyerId },
      { $setOnInsert: { seller: car.seller, lastMessage: "", lastMessageAt: new Date() } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
    conversation = await Conversation.findOne({ car: car.id, buyer: buyerId });
    if (!conversation) throw error;
  }
  response.status(200).json({ conversationId: conversation.id });
}));

app.post("/api/parts/:id/conversations", requireAuth, asyncHandler(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    response.status(404).json({ error: "Spare part listing not found." });
    return;
  }
  const part = await SparePart.findById(request.params.id).select("seller title");
  if (!part || !part.seller) {
    response.status(404).json({ error: "This seller is not available for in-site messaging." });
    return;
  }
  const buyerId = request.session.userId;
  if (String(part.seller) === buyerId) {
    response.status(400).json({ error: "You cannot start a conversation with yourself." });
    return;
  }
  let conversation;
  try {
    conversation = await Conversation.findOneAndUpdate(
      { part: part.id, buyer: buyerId },
      { $setOnInsert: { seller: part.seller, lastMessage: "", lastMessageAt: new Date() } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
    conversation = await Conversation.findOne({ part: part.id, buyer: buyerId });
    if (!conversation) throw error;
  }
  response.status(200).json({ conversationId: conversation.id });
}));

app.get("/api/cars", asyncHandler(async (request, response) => {
  const cars = await Car.find().select("-photos.data").sort({ createdAt: -1 }).lean();
  response.json({ cars: cars.map(serializeCar) });
}));

app.get("/api/admin/dashboard", requireAdmin, asyncHandler(async (request, response) => {
  const [userCount, carCount, partCount, conversationCount, messageCount, cars] = await Promise.all([
    User.countDocuments(),
    Car.countDocuments(),
    SparePart.countDocuments(),
    Conversation.countDocuments(),
    Message.countDocuments(),
    Car.find().select("-photos.data").populate("seller", "name email").sort({ createdAt: -1 }).limit(5).lean()
  ]);
  response.json({
    admin: { name: request.adminUser.name, email: request.adminUser.email },
    stats: { users: userCount, cars: carCount, parts: partCount, conversations: conversationCount, messages: messageCount },
    cars: cars.map(car => ({
      ...serializeCar(car),
      seller: car.seller ? { name: car.seller.name, email: car.seller.email } : null
    }))
  });
}));

app.get("/api/admin/analytics", requireAdmin, asyncHandler(async (request, response) => {
  const days = Number(request.query.days || 30);
  if (![7, 30, 90, 365, 0].includes(days)) {
    response.status(400).json({ error: "Choose a supported analytics period." });
    return;
  }
  const match = days ? { createdAt: { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) } } : {};
  const [total, carSearches, partSearches] = await Promise.all([
    SearchEvent.countDocuments(match),
    SearchEvent.aggregate([
      { $match: { ...match, market: "cars" } },
      { $group: { _id: { query: "$query", category: "$category", priceRange: "$priceRange" }, count: { $sum: 1 } } },
      { $sort: { count: -1, "_id.query": 1, "_id.category": 1 } },
      { $limit: 10 }
    ]),
    SearchEvent.aggregate([
      { $match: { ...match, market: "parts" } },
      { $group: { _id: { query: "$query", category: "$category" }, count: { $sum: 1 } } },
      { $sort: { count: -1, "_id.query": 1, "_id.category": 1 } },
      { $limit: 10 }
    ])
  ]);
  const serializeSearch = item => ({
    query: item._id.query,
    category: item._id.category,
    priceRange: item._id.priceRange || "",
    count: item.count
  });
  response.json({
    days,
    total,
    searches: {
      cars: carSearches.map(serializeSearch),
      parts: partSearches.map(serializeSearch)
    }
  });
}));

app.get("/api/admin/data/:collection", requireAdmin, asyncHandler(async (request, response) => {
  const { collection } = request.params;
  if (!["cars", "parts", "users", "conversations"].includes(collection)) {
    response.status(404).json({ error: "Admin data collection not found." });
    return;
  }
  const page = Number(request.query.page || 1);
  const search = normalizeText(request.query.search);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000 || search.length > 100) {
    response.status(400).json({ error: "Enter a valid page and search query." });
    return;
  }

  const filter = {};
  if (search) {
    const pattern = new RegExp(escapeRegex(search), "i");
    if (collection === "users") {
      filter.$or = [{ name: pattern }, { email: pattern }];
    } else if (collection === "cars") {
      const sellers = await User.find({ $or: [{ name: pattern }, { email: pattern }] }).select("_id").lean();
      filter.$or = [
        { make: pattern },
        { model: pattern },
        { body: pattern },
        { description: pattern },
        { seller: { $in: sellers.map(user => user._id) } }
      ];
    } else if (collection === "parts") {
      const sellers = await User.find({ $or: [{ name: pattern }, { email: pattern }] }).select("_id").lean();
      filter.$or = [
        { title: pattern },
        { category: pattern },
        { condition: pattern },
        { compatibleVehicles: pattern },
        { description: pattern },
        { seller: { $in: sellers.map(user => user._id) } }
      ];
    } else {
      const [users, cars, parts, matchingMessages] = await Promise.all([
        User.find({ $or: [{ name: pattern }, { email: pattern }] }).select("_id").lean(),
        Car.find({ $or: [{ make: pattern }, { model: pattern }] }).select("_id").lean(),
        SparePart.find({ title: pattern }).select("_id").lean(),
        Message.find({ body: pattern }).distinct("conversation")
      ]);
      filter.$or = [
        { lastMessage: pattern },
        { buyer: { $in: users.map(user => user._id) } },
        { seller: { $in: users.map(user => user._id) } },
        { car: { $in: cars.map(car => car._id) } },
        { part: { $in: parts.map(part => part._id) } },
        { _id: { $in: matchingMessages } }
      ];
    }
  }

  let [items, total] = await Promise.all([
    collection === "cars"
      ? Car.find(filter).select("-photos.data").populate("seller", "name email").sort({ createdAt: -1 }).skip((page - 1) * adminPageSize).limit(adminPageSize).lean()
      : collection === "parts"
        ? SparePart.find(filter).populate("seller", "name email").sort({ createdAt: -1 }).skip((page - 1) * adminPageSize).limit(adminPageSize).lean()
        : collection === "users"
          ? User.find(filter).select("name email isBlocked createdAt").sort({ createdAt: -1 }).skip((page - 1) * adminPageSize).limit(adminPageSize).lean()
          : Conversation.find(filter)
            .populate("car", "make model year photos.contentType photoContentType photoUrl")
              .populate("part", "title photos.contentType photoContentType")
              .populate("buyer", "name email")
            .populate("seller", "name email")
            .sort({ lastMessageAt: -1 })
            .skip((page - 1) * adminPageSize)
            .limit(adminPageSize)
            .lean(),
    collection === "cars" ? Car.countDocuments(filter)
      : collection === "parts" ? SparePart.countDocuments(filter)
        : collection === "users" ? User.countDocuments(filter)
          : Conversation.countDocuments(filter)
  ]);

  if (collection === "cars") {
    items = items.map(car => ({
      ...serializeCar(car),
      seller: car.seller ? { name: car.seller.name, email: car.seller.email } : null
    }));
  } else if (collection === "parts") {
    items = items.map(serializeSparePart);
  } else if (collection === "users") {
    items = items.map(user => ({
      id: String(user._id),
      name: user.name,
      email: user.email,
      isBlocked: Boolean(user.isBlocked),
      createdAt: user.createdAt
    }));
  } else {
    const conversationIds = items.map(conversation => conversation._id);
    const messageCounts = await Message.aggregate([
      { $match: { conversation: { $in: conversationIds } } },
      { $group: { _id: "$conversation", count: { $sum: 1 } } }
    ]);
    const countsByConversation = new Map(messageCounts.map(item => [String(item._id), item.count]));
    items = items.map(conversation => ({
      id: String(conversation._id),
      car: conversation.car
        ? `${conversation.car.year} ${conversation.car.make} ${conversation.car.model}`
        : conversation.part?.title || "Listing unavailable",
      buyer: conversation.buyer ? { name: conversation.buyer.name, email: conversation.buyer.email } : null,
      seller: conversation.seller ? { name: conversation.seller.name, email: conversation.seller.email } : null,
      lastMessage: conversation.lastMessage || "",
      lastMessageAt: conversation.lastMessageAt,
      messageCount: countsByConversation.get(String(conversation._id)) || 0
    }));
  }

  response.json({
    items,
    pagination: {
      page,
      pageSize: adminPageSize,
      total,
      pages: Math.ceil(total / adminPageSize)
    }
  });
}));

app.patch("/api/admin/users/:id", requireAdmin, asyncHandler(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    response.status(404).json({ error: "Member account not found." });
    return;
  }
  if (String(request.params.id) === String(request.session.userId)) {
    response.status(400).json({ error: "You cannot change your own admin account." });
    return;
  }
  if (typeof request.body?.isBlocked !== "boolean") {
    response.status(400).json({ error: "Choose whether this member account should be blocked." });
    return;
  }
  const user = await User.findByIdAndUpdate(
    request.params.id,
    { $set: { isBlocked: request.body.isBlocked } },
    { new: true, runValidators: true }
  ).select("name email isBlocked createdAt").lean();
  if (!user) {
    response.status(404).json({ error: "Member account not found." });
    return;
  }
  response.json({
    user: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      isBlocked: user.isBlocked,
      createdAt: user.createdAt
    }
  });
}));

app.delete("/api/admin/users/:id", requireAdmin, asyncHandler(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    response.status(404).json({ error: "Member account not found." });
    return;
  }
  const userId = String(request.params.id);
  if (userId === String(request.session.userId)) {
    response.status(400).json({ error: "You cannot remove your own admin account." });
    return;
  }
  const user = await User.findById(userId).select("_id");
  if (!user) {
    response.status(404).json({ error: "Member account not found." });
    return;
  }

  await Promise.all([
    Car.updateMany({ seller: user._id }, { $unset: { seller: 1 } }),
    SparePart.updateMany({ seller: user._id }, { $unset: { seller: 1 } }),
    Conversation.updateMany({ $or: [{ buyer: user._id }, { seller: user._id }] }, {
      $unset: { buyer: 1, seller: 1 }
    }),
    Message.updateMany({ sender: user._id }, { $unset: { sender: 1 } }),
    mongoose.connection.collection("sessions").deleteMany({ "session.userId": userId })
  ]);
  await User.deleteOne({ _id: user._id });
  response.status(204).end();
}));

app.get("/api/admin/conversations/:id/messages", requireAdmin, asyncHandler(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    response.status(404).json({ error: "Conversation not found." });
    return;
  }
  const page = Number(request.query.page || 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000) {
    response.status(400).json({ error: "Enter a valid message page." });
    return;
  }
  const conversation = await Conversation.exists({ _id: request.params.id });
  if (!conversation) {
    response.status(404).json({ error: "Conversation not found." });
    return;
  }
  const [messages, total] = await Promise.all([
    Message.find({ conversation: request.params.id })
      .sort({ createdAt: 1 })
      .skip((page - 1) * adminMessagePageSize)
      .limit(adminMessagePageSize)
      .populate("sender", "name")
      .lean(),
    Message.countDocuments({ conversation: request.params.id })
  ]);
  response.json({
    messages: messages.map(serializeMessage),
    pagination: {
      page,
      pageSize: adminMessagePageSize,
      total,
      pages: Math.ceil(total / adminMessagePageSize)
    }
  });
}));

app.delete("/api/admin/cars/:id", requireAdmin, asyncHandler(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    response.status(404).json({ error: "Car listing not found." });
    return;
  }
  const car = await Car.findByIdAndDelete(request.params.id);
  if (!car) {
    response.status(404).json({ error: "Car listing not found." });
    return;
  }
  response.status(204).end();
}));

app.delete("/api/admin/parts/:id", requireAdmin, asyncHandler(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    response.status(404).json({ error: "Spare-part listing not found." });
    return;
  }
  const part = await SparePart.findByIdAndDelete(request.params.id);
  if (!part) {
    response.status(404).json({ error: "Spare-part listing not found." });
    return;
  }
  response.status(204).end();
}));

app.get("/api/cars/:id", asyncHandler(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    response.status(404).json({ error: "Car listing not found." });
    return;
  }
  const car = await Car.findById(request.params.id).select("-photos.data").populate("seller", "name email").lean();
  if (!car) {
    response.status(404).json({ error: "Car listing not found." });
    return;
  }
  response.json({ car: serializeCarDetails(car) });
}));

app.get("/api/cars/:id/photo", asyncHandler(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    response.status(404).end();
    return;
  }
  const car = await Car.findById(request.params.id).select("+photo");
  if (!car) {
    response.status(404).end();
    return;
  }
  const photo = car.photos?.[0];
  if (photo) {
    response.set("Cache-Control", "public, max-age=86400");
    response.type(photo.contentType).send(photo.data);
    return;
  }
  if (!car.photo || !car.photoContentType) {
    response.status(404).end();
    return;
  }
  response.set("Cache-Control", "public, max-age=86400");
  response.type(car.photoContentType).send(car.photo);
}));

app.get("/api/cars/:id/photos/:index", asyncHandler(async (request, response) => {
  const index = Number(request.params.index);
  if (!mongoose.isValidObjectId(request.params.id) || !Number.isInteger(index) || index < 0 || index >= maximumCarPhotoCount) {
    response.status(404).end();
    return;
  }
  const car = await Car.findById(request.params.id).select("photos");
  const photo = car?.photos?.[index];
  if (!photo) {
    response.status(404).end();
    return;
  }
  response.set("Cache-Control", "public, max-age=86400");
  response.type(photo.contentType).send(photo.data);
}));

app.post("/api/cars", requireAuth, upload.array("photos", maximumCarPhotoCount), asyncHandler(async (request, response) => {
  const files = request.files || [];
  if (files.length < minimumCarPhotoCount) {
    response.status(400).json({ error: `Upload at least ${minimumCarPhotoCount} car photos.` });
    return;
  }
  if (files.reduce((total, file) => total + file.size, 0) > maximumCarPhotoTotal) {
    response.status(400).json({ error: "All car photos combined must be 12 MB or smaller." });
    return;
  }
  const photos = [];
  for (const file of files) {
    const imageType = detectImageType(file.buffer);
    if (!imageType || imageType !== file.mimetype) {
      response.status(400).json({ error: "One of the uploaded files is not a valid JPG, PNG, or WebP image." });
      return;
    }
    photos.push({ data: file.buffer, contentType: imageType });
  }

  const make = normalizeText(request.body.make);
  const model = normalizeText(request.body.model);
  const year = Number(request.body.year);
  const mileage = Number(request.body.mileage);
  const price = Number(request.body.price);
  const body = request.body.body;
  const description = normalizeText(request.body.description);
  const sellerPhone = normalizeText(request.body.sellerPhone).replace(/[\s()-]/g, "");
  if (!make || make.length > 40 || !model || model.length > 50 || !Number.isInteger(year) || year < 1950 || year > new Date().getFullYear()
    || !Number.isInteger(mileage) || mileage < 0 || !Number.isSafeInteger(price) || price < 1000
    || !allowedBodyStyles.includes(body) || !description || description.length > 1000
    || !/^\+[1-9]\d{7,14}$/.test(sellerPhone)) {
    response.status(400).json({ error: "Check the car details and price, add a description, and enter a valid international seller phone number." });
    return;
  }

  const car = await Car.create({
    make,
    model,
    year,
    mileage,
    body,
    price,
    description,
    sellerPhone,
    photos,
    seller: request.session.userId
  });
  response.status(201).json({ car: serializeCar(car) });
}));

app.get("/api/parts", asyncHandler(async (request, response) => {
  const parts = await SparePart.find().select("-photos.data -photo").sort({ createdAt: -1 }).populate("seller", "name email").lean();
  response.json({ parts: parts.map(serializeSparePart) });
}));

app.get("/api/parts/:id", asyncHandler(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    response.status(404).json({ error: "Spare part listing not found." });
    return;
  }
  const part = await SparePart.findById(request.params.id).select("-photos.data -photo").populate("seller", "name email").lean();
  if (!part) {
    response.status(404).json({ error: "Spare part listing not found." });
    return;
  }
  response.json({ part: serializeSparePart(part) });
}));

app.get("/api/parts/:id/contact", asyncHandler(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    response.status(404).json({ error: "Spare part listing not found." });
    return;
  }
  const part = await SparePart.findById(request.params.id).select("sellerPhone");
  if (!part) {
    response.status(404).json({ error: "Spare part listing not found." });
    return;
  }
  response.json({ sellerPhone: part.sellerPhone || "" });
}));

app.get("/api/parts/:id/photos/:index", asyncHandler(async (request, response) => {
  const index = Number(request.params.index);
  if (!mongoose.isValidObjectId(request.params.id) || !Number.isInteger(index) || index < 0 || index >= maximumPartPhotoCount) {
    response.status(404).end();
    return;
  }
  const part = await SparePart.findById(request.params.id).select("+photos.data");
  const photo = part?.photos?.[index];
  if (!photo?.data || !photo.contentType) {
    response.status(404).end();
    return;
  }
  response.set("Cache-Control", "public, max-age=86400");
  response.type(photo.contentType).send(photo.data);
}));

app.get("/api/parts/:id/photo", asyncHandler(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    response.status(404).end();
    return;
  }
  const part = await SparePart.findById(request.params.id).select("+photo");
  if (!part || !part.photo || !part.photoContentType) {
    response.status(404).end();
    return;
  }
  response.set("Cache-Control", "public, max-age=86400");
  response.type(part.photoContentType).send(part.photo);
}));

app.post("/api/parts", requireAuth, upload.array("photos", maximumPartPhotoCount), asyncHandler(async (request, response) => {
  const files = request.files;
  if (!Array.isArray(files) || !files.length) {
    response.status(400).json({ error: "Choose at least one spare part photo to upload." });
    return;
  }
  if (files.reduce((total, file) => total + file.size, 0) > maximumPartPhotoTotal) {
    response.status(400).json({ error: "All spare part photos combined must be 12 MB or smaller." });
    return;
  }
  const photos = [];
  for (const file of files) {
    const imageType = detectImageType(file.buffer);
    if (!imageType || imageType !== file.mimetype) {
      response.status(400).json({ error: "One of the uploaded files is not a valid JPG, PNG, or WebP image." });
      return;
    }
    photos.push({ data: file.buffer, contentType: imageType });
  }

  const title = normalizeText(request.body.title);
  const category = normalizeText(request.body.category);
  const condition = normalizeText(request.body.condition);
  const compatibleVehicles = normalizeText(request.body.compatibleVehicles);
  const description = normalizeText(request.body.description);
  const price = Number(request.body.price);
  const sellerPhone = normalizeText(request.body.sellerPhone).replace(/[\s()-]/g, "");
  if (!title || title.length > 80 || !allowedPartCategories.includes(category)
    || !allowedPartConditions.includes(condition) || compatibleVehicles.length > 100
    || !description || description.length > 500 || !Number.isSafeInteger(price) || price < 1
    || !/^\+[1-9]\d{7,14}$/.test(sellerPhone)) {
    response.status(400).json({ error: "Check the part details and price, and enter a valid international seller phone number." });
    return;
  }

  const part = await SparePart.create({
    title,
    category,
    condition,
    compatibleVehicles,
    description,
    price,
    sellerPhone,
    photos,
    seller: request.session.userId
  });
  await part.populate("seller", "name email");
  response.status(201).json({ part: serializeSparePart(part) });
}));

app.use("/api", (request, response) => {
  response.status(404).json({ error: "API endpoint not found." });
});

app.use((request, response, next) => {
  if (!publicFiles.has(request.path)) {
    response.sendStatus(404);
    return;
  }
  next();
});
app.use(express.static(path.resolve(__dirname, ".."), { extensions: ["html"], dotfiles: "deny" }));

app.use((error, request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }
  if (error instanceof multer.MulterError) {
    const message = error.code === "LIMIT_FILE_SIZE"
      ? "Listing photos must be 5 MB or smaller."
      : error.code === "LIMIT_FILE_COUNT"
        ? `Upload no more than ${maximumCarPhotoCount} photos.`
        : "The uploaded photo could not be accepted.";
    response.status(400).json({ error: message });
    return;
  }
  if (error.message === "Upload a JPG, PNG, or WebP listing photo.") {
    response.status(400).json({ error: error.message });
    return;
  }
  console.error("Request failed:", error);
  response.status(500).json({ error: "The request could not be completed. Please try again." });
});

async function seedStarterCars() {
  for (const car of starterCars) {
    await Car.updateOne({ seedKey: car.seedKey }, { $setOnInsert: car }, { upsert: true });
  }
}

async function migrateConversationBuyerIndex() {
  let indexes;
  try {
    indexes = await Conversation.collection.indexes();
  } catch (error) {
    if (error.code === 26) return;
    throw error;
  }
  const buyerIndex = indexes.find(index => index.name === "car_1_buyer_1");
  const expectedPartialFilter = { car: { $type: "objectId" }, buyer: { $type: "objectId" } };
  if (buyerIndex && JSON.stringify(buyerIndex.partialFilterExpression) !== JSON.stringify(expectedPartialFilter)) {
    await Conversation.collection.dropIndex(buyerIndex.name);
  }
  const partIndex = indexes.find(index => index.name === "part_1_buyer_1");
  const expectedPartPartialFilter = { part: { $type: "objectId" }, buyer: { $type: "objectId" } };
  if (partIndex && JSON.stringify(partIndex.partialFilterExpression) !== JSON.stringify(expectedPartPartialFilter)) {
    await Conversation.collection.dropIndex(partIndex.name);
  }
}

async function start() {
  if (!mongoUri) throw new Error("MONGODB_URI is required. Copy .env.example to .env and configure MongoDB.");
  if (!sessionSecret || sessionSecret.length < 32 || sessionSecret.startsWith("replace-this")) {
    throw new Error("Set SESSION_SECRET to a unique random value of at least 32 characters in .env.");
  }
  await mongoose.connect(mongoUri, { autoIndex: false });
  await migrateConversationBuyerIndex();
  const models = [User, Car, SparePart, Conversation, Message, SearchEvent];
  await Promise.all(models.map(model => model.init()));
  await Promise.all(models.map(model => model.createIndexes()));
  await seedStarterCars();
  sessionMiddleware = session({
    name: sessionCookieName,
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      client: mongoose.connection.getClient(),
      collectionName: "sessions",
      ttl: 7 * 24 * 60 * 60,
      autoRemove: "native"
    }),
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      maxAge: 7 * 24 * 60 * 60 * 1000
    }
  });
  app.listen(port, () => {
    console.log(`GariSafi.com is running at http://localhost:${port}`);
  });
}

start().catch(error => {
  console.error("GariSafi.com could not start:", error.message);
  process.exitCode = 1;
});
