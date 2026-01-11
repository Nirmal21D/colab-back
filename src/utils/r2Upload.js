import { 
  PutObjectCommand, 
  GetObjectCommand, 
  DeleteObjectCommand,
  HeadObjectCommand 
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import r2Client from '../config/r2.js';
import crypto from 'crypto';
import path from 'path';

/**
 * Upload file to Cloudflare R2
 */
export const uploadToR2 = async (file, folder = 'uploads') => {
  try {
    const fileExtension = path.extname(file.originalname);
    const fileName = `${folder}/${crypto.randomUUID()}${fileExtension}`;

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileName,
      Body: file.buffer,
      ContentType: file.mimetype,
    });

    await r2Client.send(command);

    // Return public URL
    const fileUrl = `${process.env.R2_PUBLIC_URL}/${fileName}`;
    
    return {
      success: true,
      url: fileUrl,
      key: fileName,
    };
  } catch (error) {
    console.error('R2 upload error:', error);
    throw new Error('Failed to upload file to R2');
  }
};

/**
 * Get presigned URL for private file access
 */
export const getPresignedUrl = async (key, expiresIn = 3600) => {
  try {
    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
    });

    const url = await getSignedUrl(r2Client, command, { expiresIn });
    return url;
  } catch (error) {
    console.error('R2 presigned URL error:', error);
    throw new Error('Failed to generate presigned URL');
  }
};

/**
 * Delete file from R2
 */
export const deleteFromR2 = async (key) => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
    });

    await r2Client.send(command);
    
    return {
      success: true,
      message: 'File deleted successfully',
    };
  } catch (error) {
    console.error('R2 delete error:', error);
    throw new Error('Failed to delete file from R2');
  }
};

/**
 * Check if file exists in R2
 */
export const fileExistsInR2 = async (key) => {
  try {
    const command = new HeadObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
    });

    await r2Client.send(command);
    return true;
  } catch (error) {
    if (error.name === 'NotFound') {
      return false;
    }
    throw error;
  }
};
