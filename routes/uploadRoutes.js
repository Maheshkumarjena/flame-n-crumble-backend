import { Router } from 'express';
import multer from 'multer';
import  { storage } from '../utils/Cloudinary.js';
const upload = multer({ storage });


const router = Router();

// Single file upload route
router.post('/', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'No file uploaded' 
      });
    }

    res.json({
      success: true,
      file: {
        path: req.file.path,
        filename: req.file.filename,
        url: req.file.path,
        public_id: req.file.filename
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

export default router;