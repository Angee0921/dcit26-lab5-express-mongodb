require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const Student = require('./models/Student');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware: parse JSON request bodies
app.use(express.json());

// Only allow these fields from the request body
const pickFields = (body = {}) => {
  const allowed = ['fullName', 'course', 'yearLevel', 'section'];
  const data = {};
  for (const key of allowed) {
    if (body[key] !== undefined) data[key] = body[key];
  }
  return data;
};

// Wrapper so async errors reach the error handler (Express 4)
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Validate :id before querying
const checkId = (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid student ID' });
  }
  next();
};

// ---------- Health route ----------
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Student API is running' });
});

// ---------- CRUD routes ----------
// GET all
app.get('/api/students', wrap(async (req, res) => {
  const students = await Student.find();
  res.json(students);
}));

// GET one
app.get('/api/students/:id', checkId, wrap(async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  res.json(student);
}));

// POST create
app.post('/api/students', wrap(async (req, res) => {
  const student = await Student.create(pickFields(req.body));
  res.status(201).json(student);
}));

// PUT update
app.put('/api/students/:id', checkId, wrap(async (req, res) => {
  const student = await Student.findByIdAndUpdate(
    req.params.id,
    pickFields(req.body),
    { new: true, runValidators: true }
  );
  if (!student) return res.status(404).json({ error: 'Student not found' });
  res.json(student);
}));

// DELETE
app.delete('/api/students/:id', checkId, wrap(async (req, res) => {
  const student = await Student.findByIdAndDelete(req.params.id);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  res.json({ message: 'Student deleted successfully', id: req.params.id });
}));

// ---------- 404 for unknown routes ----------
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ---------- Error handler (no stack traces to clients) ----------
app.use((err, req, res, next) => {
  // Malformed JSON body
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON in request body' });
  }
  // Schema validation errors
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ error: 'Validation failed', details: messages });
  }
  // Bad cast (e.g., yearLevel: "abc")
  if (err.name === 'CastError') {
    return res.status(400).json({ error: `Invalid value for ${err.path}` });
  }
  console.error(err.message); // log server-side only
  res.status(500).json({ error: 'Internal server error' });
});

// ---------- Connect to MongoDB, then start listening ----------
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
