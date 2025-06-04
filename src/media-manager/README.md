# Media Manager Module 📁

A comprehensive file upload and media management system for the NestJS application with Google Cloud Storage integration, automatic image processing, and full organization/branch scoping.

## Features ✨

### File Upload & Storage
- **Google Cloud Storage Integration**: Direct upload to GCS with automatic URL generation
- **Multiple File Types Support**: Images, documents, videos, and audio files
- **File Size Validation**: Configurable limits (default 50MB per file)
- **Secure Upload**: Authentication required with org/branch scoping

### Image Processing 🖼️
- **Automatic Thumbnail Generation**: 150x150px thumbnails for all images
- **Multiple Variants**: Medium (500x500px) and Large (1200x1200px) options
- **Format Optimization**: JPEG compression with quality optimization
- **Metadata Extraction**: Width, height, and EXIF data extraction

### Organization & Security 🔒
- **JWT Authentication**: All endpoints require valid authentication
- **Organization/Branch Scoping**: Files are scoped to user's org/branch
- **Owner-based Access Control**: Users can only delete their own files
- **Soft Deletion**: Files are marked inactive rather than permanently deleted

### File Management 📋
- **Advanced Filtering**: Filter by type, variant, uploader, filename
- **Pagination Support**: Efficient handling of large file collections
- **Search Capabilities**: Search in filenames and original names
- **Statistics & Analytics**: File usage and storage statistics

## Configuration 🔧

### Environment Variables

Add these variables to your `.env` file:

```bash
# Required GCS Configuration
GOOGLE_CLOUD_PROJECT_ID=your-gcp-project-id
GOOGLE_CLOUD_KEY_FILE=path/to/your/service-account-key.json
GOOGLE_CLOUD_STORAGE_BUCKET=your-storage-bucket-name

# Optional Configuration
MEDIA_MAX_FILE_SIZE=52428800  # 50MB in bytes
```

### Google Cloud Storage Setup

1. **Create a GCS Bucket**:
   ```bash
   gsutil mb gs://your-bucket-name
   ```

2. **Set Bucket Permissions**:
   ```bash
   gsutil iam ch allUsers:objectViewer gs://your-bucket-name
   ```

3. **Create Service Account**:
   - Go to Google Cloud Console → IAM & Admin → Service Accounts
   - Create new service account with Storage Admin role
   - Download JSON key file
   - Set `GOOGLE_CLOUD_KEY_FILE` to the path of this file

## Supported File Types 📄

### Images
- JPEG/JPG (`image/jpeg`)
- PNG (`image/png`)
- WebP (`image/webp`)
- GIF (`image/gif`)
- SVG (`image/svg+xml`)

### Documents
- PDF (`application/pdf`)
- Word (`application/msword`, `.docx`)
- Excel (`application/vnd.ms-excel`, `.xlsx`)
- PowerPoint (`application/vnd.ms-powerpoint`, `.pptx`)
- Text (`text/plain`)

### Videos
- MP4 (`video/mp4`)
- MPEG (`video/mpeg`)
- QuickTime (`video/quicktime`)
- AVI (`video/x-msvideo`)
- WebM (`video/webm`)

### Audio
- MP3 (`audio/mpeg`)
- WAV (`audio/wav`)
- OGG (`audio/ogg`)
- M4A (`audio/x-m4a`)

## API Endpoints 🚀

### Upload Single File
```http
POST /media/upload
Content-Type: multipart/form-data

{
  "file": [binary data],
  "altText": "Image description",
  "description": "File description",
  "generateThumbnails": true,
  "variants": ["thumbnail", "medium"]
}
```

### Upload Multiple Files
```http
POST /media/upload/bulk
Content-Type: multipart/form-data

{
  "files": [multiple binary files],
  "commonAltText": "Common description",
  "generateThumbnails": true
}
```

### List Files
```http
GET /media?type=image&page=1&limit=20&sortBy=createdAt&sortOrder=DESC
```

### Get File Details
```http
GET /media/:id
```

### Get My Files
```http
GET /media/my-files
```

### Get Statistics
```http
GET /media/stats
```

### Delete File
```http
DELETE /media/:id
```

## Image Variants 🖼️

When uploading images, the system automatically generates variants:

- **Original**: Full-resolution image as uploaded
- **Thumbnail**: 150x150px optimized for lists and previews
- **Medium**: 500x500px suitable for content display
- **Large**: 1200x1200px for detailed viewing

Each variant is stored separately in GCS with optimized JPEG compression.

## File Designation System 🏷️

The media manager includes a comprehensive file designation system to categorize and organize uploaded files:

### Available Designations

- **`USER_AVATAR`**: Profile pictures and user avatars
- **`COURSE_THUMBNAIL`**: Course cover images and thumbnails
- **`COURSE_MATERIAL`**: Learning materials, documents, and resources
- **`QUESTION_IMAGE`**: Images used in quiz questions and assessments
- **`ANSWER_ATTACHMENT`**: Files attached to quiz answers
- **`ORGANIZATION_LOGO`**: Organization branding and logos
- **`TEST_ATTACHMENT`**: Files attached to tests and assessments
- **`GENERAL_UPLOAD`**: General purpose uploads (default)
- **`OTHER`**: Miscellaneous files that don't fit other categories

### File Status Management

Files are managed with a robust status system:

- **`ACTIVE`**: File is available and accessible (default)
- **`INACTIVE`**: File is temporarily disabled
- **`DELETED`**: File is soft-deleted but preserved for audit
- **`PROCESSING`**: File is currently being processed (thumbnails, etc.)

### Designation Usage

When uploading files, specify the appropriate designation:

```typescript
// User avatar upload
const uploadResponse = await mediaService.uploadFile(file, {
  designation: FileDesignation.USER_AVATAR,
  generateThumbnails: true,
  variants: [ImageVariant.THUMBNAIL, ImageVariant.MEDIUM],
  altText: "User profile picture"
});

// Course material upload
const uploadResponse = await mediaService.uploadFile(file, {
  designation: FileDesignation.COURSE_MATERIAL,
  description: "Course lecture notes PDF",
  generateThumbnails: false
});
```

## Database Schema 🗄️

The `MediaFile` entity includes:

```typescript
{
  id: number;                    // Primary key
  originalName: string;          // Original filename
  filename: string;              // GCS filename
  url: string;                   // Public GCS URL
  mimeType: string;              // File MIME type
  size: number;                  // File size in bytes
  type: MediaType;               // image, document, video, audio, other
  variant?: ImageVariant;        // original, thumbnail, medium, large
  originalFileId?: number;       // Reference to original (for variants)
  width?: number;                // Image width (pixels)
  height?: number;               // Image height (pixels)
  isActive: boolean;             // Soft delete flag (legacy)
  status: MediaFileStatus;       // active, inactive, deleted, processing
  designation: FileDesignation;  // File purpose/category
  altText?: string;              // Accessibility text
  description?: string;          // File description
  metadata?: object;             // Additional metadata
  uploadedBy: string;            // User ID who uploaded
  createdAt: Date;               // Upload timestamp
  updatedAt: Date;               // Last modification
  orgId?: Organization;          // Organization scope
  branchId?: Branch;             // Branch scope
}
```

## Usage Examples 💡

### Frontend Upload Component (React)

```tsx
const FileUpload = () => {
  const [file, setFile] = useState<File | null>(null);
  
  const handleUpload = async () => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('altText', 'Course material');
    formData.append('designation', 'course_material'); // Specify file purpose
    formData.append('generateThumbnails', 'true');
    
    const response = await fetch('/api/media/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });
    
    const result = await response.json();
    console.log('Uploaded:', result);
  };
  
  return (
    <div>
      <input 
        type="file" 
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        accept="image/*,.pdf,.doc,.docx"
      />
      <button onClick={handleUpload}>Upload</button>
    </div>
  );
};
```

### Avatar Upload Component

```tsx
const AvatarUpload = ({ userId, onAvatarUploaded }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const handleAvatarUpload = async () => {
    if (!selectedFile) return;
    
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('designation', 'user_avatar'); // User avatar designation
    formData.append('generateThumbnails', 'true');
    formData.append('variants', JSON.stringify(['thumbnail', 'medium']));
    formData.append('altText', `${userName} profile picture`);
    
    const response = await fetch('/api/media/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });
    
    const result = await response.json();
    onAvatarUploaded(result.file);
  };
  
  return (
    <div>
      <input 
        type="file" 
        accept="image/*"
        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
      />
      <button onClick={handleAvatarUpload}>Upload Avatar</button>
    </div>
  );
};
```

### Bulk Upload

```typescript
const uploadMultipleFiles = async (files: FileList) => {
  const formData = new FormData();
  
  Array.from(files).forEach(file => {
    formData.append('files', file);
  });
  
  formData.append('commonDescription', 'Course materials batch upload');
  formData.append('commonDesignation', 'course_material'); // Common designation
  formData.append('generateThumbnails', 'true');
  
  const response = await fetch('/api/media/upload/bulk', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });
  
  return response.json();
};
```

### Filtering by Designation

```typescript
// Get all user avatars
const avatars = await fetch('/api/media?designation=user_avatar', {
  headers: { 'Authorization': `Bearer ${token}` }
});

// Get course materials
const courseMaterials = await fetch('/api/media?designation=course_material&type=document', {
  headers: { 'Authorization': `Bearer ${token}` }
});

// Get organization logos
const logos = await fetch('/api/media?designation=organization_logo&type=image', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

## Performance Considerations ⚡

### File Processing
- Image processing happens asynchronously
- Variants are generated in parallel
- Failed variant generation doesn't affect main upload

### Storage Optimization
- JPEG compression reduces file sizes
- Thumbnails significantly reduce bandwidth
- CDN-ready URLs from GCS

### Database Efficiency
- Indexed queries on common fields
- Pagination prevents large result sets
- Soft deletes preserve referential integrity

## Security Best Practices 🔐

### File Validation
- MIME type checking
- File size limits
- Extension validation

### Access Control
- JWT authentication required
- Organization/branch scoping
- Owner-based permissions

### Upload Security
- Virus scanning (recommended external service)
- Content type validation
- Rate limiting (implement at API gateway level)

## Monitoring & Logging 📊

The module includes comprehensive logging:

- Upload events with file details
- Processing status and timing
- Error handling with context
- User activity tracking

Monitor these metrics:
- Upload success/failure rates
- Processing times
- Storage usage
- User activity patterns

## Troubleshooting 🔧

### Common Issues

1. **GCS Authentication Errors**
   - Verify service account key file path
   - Check service account permissions
   - Ensure bucket exists and is accessible

2. **File Upload Failures**
   - Check file size limits
   - Verify MIME types are supported
   - Ensure sufficient GCS quota

3. **Image Processing Issues**
   - Verify Sharp installation
   - Check memory limits for large images
   - Monitor processing timeouts

### Debug Mode

Enable debug logging by setting:
```bash
LOG_LEVEL=debug
```

## Future Enhancements 🚀

Planned features:
- Video thumbnail generation
- Document preview generation
- Advanced metadata extraction
- Content moderation integration
- CDN integration
- Automated backups
- Analytics dashboard

---

For more information, see the API documentation at `/api/docs` when the server is running. 