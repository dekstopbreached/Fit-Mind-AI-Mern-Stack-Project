import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Habit from "../models/Habit.js";

const router = express.Router();

const defaultFitnessHabits = (userId) => [
  {
    userId,
    name: "Chest & Triceps",
    description: "Push day: bench press, incline press, tricep dips.",
    category: "Fitness",
    frequency: "weekly",
    targetDays: 1,
    scheduledDays: [1],
    color: "#f97316",
    icon: "🏋️",
  },
  {
    userId,
    name: "Back & Biceps",
    description: "Pull day: deadlifts, rows, bicep curls.",
    category: "Fitness",
    frequency: "weekly",
    targetDays: 1,
    scheduledDays: [2],
    color: "#22c55e",
    icon: "💪",
  },
  {
    userId,
    name: "Legs",
    description: "Leg day: squats, lunges, hamstring curls.",
    category: "Fitness",
    frequency: "weekly",
    targetDays: 1,
    scheduledDays: [3],
    color: "#fb7185",
    icon: "🦵",
  },
  {
    userId,
    name: "Shoulders & Arms",
    description: "Upper body day: shoulder press, lateral raises, arm work.",
    category: "Fitness",
    frequency: "weekly",
    targetDays: 1,
    scheduledDays: [4],
    color: "#818cf8",
    icon: "🔥",
  },
  {
    userId,
    name: "Full Body / Cardio",
    description: "Full-body circuit or cardio conditioning.",
    category: "Fitness",
    frequency: "weekly",
    targetDays: 1,
    scheduledDays: [5],
    color: "#facc15",
    icon: "🚴",
  },
];

router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: "Name, email and password are required" });
  }

  const normalizedEmail = email.toLowerCase();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) return res.status(400).json({ message: "User already exists" });

  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email: normalizedEmail, password: hashed, avatar: name.charAt(0).toUpperCase() });
  await Habit.insertMany(defaultFitnessHabits(user._id));

  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "30d" });
  res.json({ user: { id: user._id, name: user.name, email: user.email, avatar: user.avatar }, token });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: "Email and password are required" });

  const normalizedEmail = email.toLowerCase();
  const user = await User.findOne({ email: normalizedEmail });
  if (!user) return res.status(401).json({ message: "Invalid credentials" });

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) return res.status(401).json({ message: "Invalid credentials" });

  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "30d" });
  res.json({ user: { id: user._id, name: user.name, email: user.email, avatar: user.avatar }, token });
});

router.get("/me", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Unauthorized" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.userId).lean();
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    res.json({ user: { id: user._id, name: user.name, email: user.email, avatar: user.avatar, morningMotivation: user.morningMotivation } });
  } catch (error) {
    res.status(401).json({ message: "Invalid token" });
  }
});

router.put("/profile", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Unauthorized" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const { name, morningMotivation } = req.body;
    if (name) user.name = name;
    if (typeof morningMotivation === "boolean") user.morningMotivation = morningMotivation;
    if (name) user.avatar = name.charAt(0).toUpperCase();
    await user.save();
    res.json({ user: { id: user._id, name: user.name, email: user.email, avatar: user.avatar, morningMotivation: user.morningMotivation } });
  } catch (error) {
    res.status(401).json({ message: "Invalid token" });
  }
});

export default router;
