import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';


// Optional: You can remove this if you no longer want to log the keys
console.log("cloudinary config:", process.env.CLOUDINARY_API_KEY, process.env.CLOUDINARY_API_SECRET);

cloudinary.config({ 
  cloud_name: 'diiopqo1y', 
  api_key: '556316231398198',
  api_secret: "tFVVkEkNjKlic2gKQCRU6PsMROk"
});




// Set up Multer storage engine for Cloudinary
export const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'ecommerce-products',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [{ width: 800, height: 800, crop: 'limit' }]
  },
});


