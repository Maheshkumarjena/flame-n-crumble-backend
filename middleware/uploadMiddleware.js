// middleware/uploadMiddleware.js
import multer from 'multer';
import path from 'path';
import fs from 'fs'; // Node.js file system module
import { fileURLToPath } from 'url'; // For ES Modules path resolution

// Get __dirname equivalent in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define the directory for storing uploaded images
const uploadDir = path.join(__dirname, '../public/images'); // Adjusted to point to public/images

// Ensure the upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage for Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir); // Destination folder for uploads
  },
  filename: (req, file, cb) => {
    // Generate a unique filename with the original extension
    cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
  },
});

// Filter files to allow only images
const fileFilter = (req, file, cb) => {
  const filetypes = /jpeg|jpg|png|gif/;
  const mimetype = filetypes.test(file.mimetype);
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only images (JPEG, JPG, PNG, GIF) are allowed!'), false);
  }
};

// Initialize multer upload middleware
// 'image' should match the field name in your FormData on the frontend
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5MB
});

export default upload;
