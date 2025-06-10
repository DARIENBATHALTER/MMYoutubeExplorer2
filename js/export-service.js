/**
 * ExportService - Handles comment export functionality
 * Uses fflate for reliable ZIP generation and iframe isolation for zero screen flashing
 */
class ExportService {
    constructor() {
        this.isExporting = false;
        this.exportProgress = {
            current: 0,
            total: 0,
            status: 'Ready'
        };
        this.maxCommentsPerZip = 500; // Much larger with fflate
        
        // Create iframe-based rendering to completely eliminate screen flashing
        this.createIframeRenderer();
        
        // Load fflate library
        this.initializeZipLibrary();
    }

    /**
     * Initialize fflate ZIP library
     */
    async initializeZipLibrary() {
        try {
            // Import fflate dynamically
            const fflate = await import('fflate');
            this.fflate = fflate;
            console.log('✅ fflate ZIP library loaded - large batch sizes available');
        } catch (error) {
            console.error('❌ Failed to load fflate library:', error);
            throw new Error('ZIP library unavailable - cannot export');
        }
    }

    /**
     * Create iframe-based renderer for ZERO screen interference
     */
    createIframeRenderer() {
        // Remove any existing iframe
        const existing = document.getElementById('export-iframe');
        if (existing) {
            existing.remove();
        }

        // Create completely isolated iframe
        this.iframe = document.createElement('iframe');
        this.iframe.id = 'export-iframe';
        this.iframe.style.cssText = `
            position: absolute;
            left: -9999px;
            top: -9999px;
            width: 800px;
            height: 600px;
            border: none;
            visibility: hidden;
            pointer-events: none;
            z-index: -9999;
        `;
        
        document.body.appendChild(this.iframe);
        
        // Initialize iframe document
        const doc = this.iframe.contentDocument;
        doc.open();
        doc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.3/font/bootstrap-icons.css">
                <style>
                    body { margin: 0; padding: 20px; background: white; font-family: 'Roboto', Arial, sans-serif; }
                </style>
            </head>
            <body></body>
            </html>
        `);
        doc.close();
        
        console.log('🖼️ Created iframe-based renderer - ZERO screen interference guaranteed');
    }

    /**
     * Export a single comment as PNG
     */
    async exportSingleComment(comment, videoTitle = '') {
        try {
            const html = this.generateCommentHTML(comment, videoTitle);
            const filename = this.generateFileName(videoTitle, comment.author, comment.text);
            
            await this.generatePNG(html, filename);
            console.log(`✅ Exported comment: ${filename}`);
            
        } catch (error) {
            console.error('❌ Export failed:', error);
            throw error;
        }
    }

    /**
     * Export comments for a specific video using fflate
     */
    async exportVideoComments(videoId, dataManager, progressCallback) {
        if (this.isExporting) {
            throw new Error('Export already in progress');
        }

        this.isExporting = true;
        
        try {
            // Get video info and comments
            const video = await dataManager.getVideo(videoId);
            if (!video) {
                throw new Error('Video not found');
            }

            const commentsData = await dataManager.getAllComments(videoId, {});
            const comments = this.flattenComments(commentsData);

            if (comments.length === 0) {
                throw new Error('No comments found for this video');
            }

            // Initialize progress
            this.exportProgress = {
                current: 0,
                total: comments.length,
                status: 'Starting export...'
            };

            progressCallback?.(this.exportProgress);

            // Use fflate for reliable ZIP generation
            const zipFiles = await this.generateFflateZIPs(
                comments, 
                video.title, 
                this.maxCommentsPerZip,
                (progress) => {
                    this.exportProgress.current = progress.completed || 0;
                    this.exportProgress.status = progress.status;
                    progressCallback?.(this.exportProgress);
                }
            );

            this.exportProgress.current = this.exportProgress.total;
            this.exportProgress.status = `✅ Export complete! Downloaded ${zipFiles.length} ZIP file(s)`;
            progressCallback?.(this.exportProgress);

            return zipFiles;

        } finally {
            this.isExporting = false;
        }
    }

    /**
     * Export comments for all videos using fflate
     */
    async exportAllVideos(dataManager, progressCallback) {
        if (this.isExporting) {
            throw new Error('Export already in progress');
        }

        this.isExporting = true;
        
        try {
            // Get all videos
            const allVideosResult = await dataManager.getVideos({}, { page: 1, limit: 10000 });
            const videos = allVideosResult.videos;

            if (videos.length === 0) {
                throw new Error('No videos found');
            }

            // Initialize progress for all videos
            this.exportProgress = {
                currentVideo: 0,
                totalVideos: videos.length,
                currentVideoComments: 0,
                totalVideoComments: 0,
                status: 'Starting export...'
            };

            progressCallback?.(this.exportProgress);

            const zipFiles = [];

            for (let videoIndex = 0; videoIndex < videos.length; videoIndex++) {
                const video = videos[videoIndex];
                
                // Update progress for current video
                this.exportProgress.currentVideo = videoIndex + 1;
                this.exportProgress.currentVideoComments = 0;
                this.exportProgress.status = `Processing video ${videoIndex + 1}/${videos.length}: ${video.title}`;
                progressCallback?.(this.exportProgress);

                try {
                    // Get all comments for this video
                    const commentsData = await dataManager.getAllComments(video.video_id, {});
                    const comments = this.flattenComments(commentsData);

                    if (comments.length === 0) {
                        console.log(`⚠️ Skipping video "${video.title}" - no comments`);
                        continue;
                    }

                    this.exportProgress.totalVideoComments = comments.length;
                    
                    // Use fflate for reliable ZIP generation
                    const videoZipFiles = await this.generateFflateZIPs(
                        comments, 
                        video.title, 
                        this.maxCommentsPerZip,
                        (batchProgress) => {
                            this.exportProgress.currentVideoComments = batchProgress.completed || 0;
                            this.exportProgress.status = `Video ${videoIndex + 1}/${videos.length}: ${batchProgress.status}`;
                            progressCallback?.(this.exportProgress);
                        }
                    );

                    zipFiles.push(...videoZipFiles);
                    console.log(`✅ Successfully exported ${comments.length} comments from "${video.title}" in ${videoZipFiles.length} ZIP file(s)`);

                } catch (error) {
                    console.error(`❌ Failed to export video "${video.title}":`, error);
                }

                // Small delay between videos
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            this.exportProgress.status = `✅ Export complete! Downloaded ${zipFiles.length} video archive(s)`;
            progressCallback?.(this.exportProgress);

            return zipFiles;

        } finally {
            this.isExporting = false;
        }
    }

    /**
     * Generate ZIP files using fflate - MUCH more reliable than JSZip
     */
    async generateFflateZIPs(comments, videoTitle, batchSize = 500, progressCallback) {
        const zipFiles = [];
        const totalBatches = Math.ceil(comments.length / batchSize);
        
        console.log(`🚀 Generating ${totalBatches} fflate ZIP batches of ${batchSize} comments each`);

        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
            const startIndex = batchIndex * batchSize;
            const endIndex = Math.min(startIndex + batchSize, comments.length);
            const batchComments = comments.slice(startIndex, endIndex);
            
            const zipSuffix = totalBatches > 1 ? `_part${batchIndex + 1}` : '';
            const zipName = `${this.sanitizeFilename(videoTitle)}${zipSuffix}_comments.zip`;
            
            console.log(`⚡ Processing fflate batch ${batchIndex + 1}/${totalBatches}: ${batchComments.length} comments`);
            
            try {
                // Step 1: Generate all images for this batch
                const imageFiles = {};
                
                for (let i = 0; i < batchComments.length; i++) {
                    const comment = batchComments[i];
                    const globalIndex = startIndex + i;
                    
                    // Update progress
                    this.exportProgress.completed = globalIndex;
                    this.exportProgress.status = `Batch ${batchIndex + 1}/${totalBatches}: Generating image ${i + 1}/${batchComments.length}`;
                    progressCallback?.(this.exportProgress);

                    try {
                        const html = this.generateCommentHTML(comment, videoTitle);
                        const filename = this.generateFileName(videoTitle, comment.author, comment.text);
                        
                        // Generate PNG using iframe (no screen interference)
                        const pngBlob = await this.generatePNGBlobIframe(html);
                        
                        if (pngBlob && pngBlob.size > 0) {
                            // Convert blob to Uint8Array for fflate
                            const arrayBuffer = await pngBlob.arrayBuffer();
                            imageFiles[`${filename}.png`] = new Uint8Array(arrayBuffer);
                            console.log(`✅ Generated image ${i + 1}/${batchComments.length}: ${filename}.png (${(pngBlob.size / 1024).toFixed(1)}KB)`);
                        } else {
                            console.warn(`⚠️ Invalid PNG blob for comment ${comment.comment_id}, skipping`);
                        }
                        
                        // Yield control periodically
                        if (i % 5 === 0) {
                            await new Promise(resolve => setTimeout(resolve, 10));
                        }
                        
                    } catch (error) {
                        console.warn(`⚠️ Failed to generate PNG for comment ${comment.comment_id}:`, error);
                    }
                }

                // Step 2: Create ZIP using fflate
                if (Object.keys(imageFiles).length > 0) {
                    this.exportProgress.status = `Batch ${batchIndex + 1}/${totalBatches}: Creating ZIP with ${Object.keys(imageFiles).length} images...`;
                    progressCallback?.(this.exportProgress);

                    await this.createFflateZIP(zipName, imageFiles);
                    zipFiles.push(zipName);
                    
                    console.log(`✅ fflate ZIP generated successfully: ${zipName} with ${Object.keys(imageFiles).length} files`);
                    
                    // Update progress
                    this.exportProgress.status = `✅ Completed batch ${batchIndex + 1}/${totalBatches}`;
                    progressCallback?.(this.exportProgress);
                } else {
                    console.warn(`⚠️ No valid images generated for batch ${batchIndex + 1}, skipping ZIP creation`);
                }

                // Clear memory
                Object.keys(imageFiles).forEach(key => delete imageFiles[key]);
                
                // Small delay between batches
                if (batchIndex < totalBatches - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }

            } catch (error) {
                console.error(`❌ Failed to process batch ${batchIndex + 1}:`, error);
            }
        }

        console.log(`🎉 fflate export complete! Generated ${zipFiles.length} ZIP files`);
        return zipFiles;
    }

    /**
     * Create ZIP file using fflate - much more reliable than JSZip
     */
    async createFflateZIP(zipName, imageFiles) {
        return new Promise((resolve, reject) => {
            try {
                // Use fflate's zip function for reliable compression
                this.fflate.zip(imageFiles, {
                    level: 1, // Fast compression
                    mem: 8    // Memory level
                }, (err, data) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    // Create blob and download
                    const blob = new Blob([data], { type: 'application/zip' });
                    this.downloadBlob(blob, zipName);
                    resolve();
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Generate PNG using iframe rendering - ZERO screen interference
     */
    async generatePNGBlobIframe(html) {
        return new Promise(async (resolve, reject) => {
            try {
                // Get iframe document
                const doc = this.iframe.contentDocument;
                doc.body.innerHTML = html;

                // Find the comment element
                const commentElement = doc.querySelector('.comment-container') || doc.body.firstElementChild;
                if (!commentElement) {
                    throw new Error('No renderable element found');
                }

                // Wait for any images to load
                const images = commentElement.getElementsByTagName('img');
                const imagePromises = [];
                for (let img of images) {
                    if (!img.complete) {
                        imagePromises.push(new Promise(resolve => { 
                            img.onload = resolve; 
                            img.onerror = resolve; 
                        }));
                    }
                }
                await Promise.all(imagePromises);

                // Short delay for rendering
                await new Promise(resolve => setTimeout(resolve, 100));

                // Generate canvas using iframe content (isolated from main window)
                const canvas = await html2canvas(commentElement, {
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: '#ffffff',
                    scale: 2,
                    logging: false,
                    width: 600,
                    height: commentElement.offsetHeight
                });

                // Convert to blob
                canvas.toBlob(blob => {
                    if (blob && blob.size > 0) {
                        resolve(blob);
                    } else {
                        reject(new Error('Failed to generate PNG - invalid blob'));
                    }
                }, 'image/png');

            } catch (error) {
                console.error('PNG generation error:', error);
                reject(error);
            } finally {
                // Clear iframe content
                if (this.iframe.contentDocument) {
                    this.iframe.contentDocument.body.innerHTML = '';
                }
            }
        });
    }

    /**
     * Generate PNG from HTML and download it
     */
    async generatePNG(html, filename) {
        const blob = await this.generatePNGBlobIframe(html);
        this.downloadBlob(blob, `${filename}.png`);
    }

    /**
     * Generate HTML for a comment in YouTube style
     */
    generateCommentHTML(comment, videoTitle = '') {
        const avatarColor = this.generateAvatarColor(comment.author);
        const firstLetter = comment.author[1]?.toUpperCase() || comment.author[0]?.toUpperCase() || 'U';
        const formattedDate = this.formatDate(comment.published_at);
        const likeDisplay = this.formatLikes(comment.like_count);
        const heartIcon = comment.channel_owner_liked ? '❤️' : '';
        
        // Escape HTML
        const commentText = this.escapeHTML(comment.text);
        const authorName = this.escapeHTML(comment.author);
        const videoTitleEscaped = this.escapeHTML(videoTitle);

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: 'Roboto', Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #ffffff;
            width: 600px;
        }
        .comment-container {
            display: flex;
            align-items: flex-start;
            gap: 12px;
            padding: 16px;
            background-color: #ffffff;
        }
        .avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background-color: ${avatarColor};
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 18px;
            font-weight: 500;
            flex-shrink: 0;
        }
        .comment-content {
            flex: 1;
            min-width: 0;
        }
        .comment-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 4px;
        }
        .author-name {
            font-size: 13px;
            font-weight: 500;
            color: #030303;
        }
        .comment-date {
            font-size: 12px;
            color: #606060;
        }
        .comment-text {
            font-size: 14px;
            line-height: 1.4;
            color: #030303;
            margin-bottom: 8px;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        .comment-actions {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .like-button {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 8px 12px;
            border-radius: 18px;
            background-color: #f2f2f2;
            color: #030303;
            font-size: 12px;
            font-weight: 500;
        }
        .like-icon {
            width: 16px;
            height: 16px;
        }
        .heart-icon {
            margin-left: 8px;
            font-size: 14px;
        }
        .video-title {
            font-size: 11px;
            color: #606060;
            margin-bottom: 8px;
            font-style: italic;
        }
    </style>
</head>
<body>
    <div class="comment-container">
        <div class="avatar">${firstLetter}</div>
        <div class="comment-content">
            ${videoTitle ? `<div class="video-title">From: ${videoTitleEscaped}</div>` : ''}
            <div class="comment-header">
                <span class="author-name">${authorName}</span>
                <span class="comment-date">${formattedDate}</span>
            </div>
            <div class="comment-text">${commentText}</div>
            <div class="comment-actions">
                <div class="like-button">
                    <i class="bi bi-hand-thumbs-up like-icon"></i>
                    ${likeDisplay}
                </div>
                ${heartIcon ? `<span class="heart-icon">${heartIcon}</span>` : ''}
            </div>
        </div>
    </div>
</body>
</html>`;
    }

    /**
     * Flatten comments with replies into a single array
     */
    flattenComments(commentsWithReplies) {
        const flattened = [];
        
        for (const comment of commentsWithReplies) {
            flattened.push(comment);
            if (comment.replies && comment.replies.length > 0) {
                flattened.push(...comment.replies);
            }
        }
        
        return flattened;
    }

    /**
     * Split array into chunks
     */
    chunkArray(array, chunkSize) {
        const chunks = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }

    /**
     * Generate consistent avatar color for username
     */
    generateAvatarColor(username) {
        const colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
            '#FFEAA7', '#DDA0DD', '#98D8C8', '#F39C12',
            '#E74C3C', '#9B59B6', '#3498DB', '#2ECC71'
        ];
        const hash = this.hashString(username);
        return colors[hash % colors.length];
    }

    /**
     * Simple string hash function
     */
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }

    /**
     * Format date for display
     */
    formatDate(date) {
        const d = new Date(date);
        return d.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    /**
     * Format like count (1000 -> 1K)
     */
    formatLikes(count) {
        if (count >= 1000) {
            return `${(count / 1000).toFixed(1).replace('.0', '')}K`;
        }
        return count.toString();
    }

    /**
     * Escape HTML characters
     */
    escapeHTML(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Generate filename for export
     */
    generateFileName(videoTitle, username, commentText) {
        const cleanTitle = this.sanitizeFilename(videoTitle, 30);
        const cleanUsername = this.sanitizeFilename(username, 20);
        const cleanComment = this.sanitizeFilename(commentText, 40);
        const timestamp = new Date().toISOString().slice(0, 16).replace(/[:-]/g, '');
        
        return `${cleanTitle}_${cleanUsername}_${cleanComment}_${timestamp}`;
    }

    /**
     * Sanitize filename by removing invalid characters
     */
    sanitizeFilename(text, maxLength = 50) {
        return text
            .replace(/[<>:"/\\|?*]/g, '') // Remove invalid characters
            .replace(/\s+/g, '_') // Replace spaces with underscores
            .substring(0, maxLength) // Limit length
            .replace(/_+$/, ''); // Remove trailing underscores
    }

    /**
     * Download blob as file
     */
    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Get export progress
     */
    getProgress() {
        return { ...this.exportProgress };
    }

    /**
     * Check if export is in progress
     */
    isExportInProgress() {
        return this.isExporting;
    }

    /**
     * Cancel current export
     */
    cancelExport() {
        this.isExporting = false;
        this.exportProgress = {
            current: 0,
            total: 0,
            status: 'Export cancelled'
        };
    }
}

// Export for use in other modules
window.ExportService = ExportService; 