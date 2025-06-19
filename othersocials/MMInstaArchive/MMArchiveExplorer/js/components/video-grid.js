/**
 * VideoGrid Component - Handles video/post grid rendering and interactions
 * This component supports both YouTube videos and Instagram posts
 */
class VideoGridComponent {
    constructor(container, dataManager) {
        this.container = container;
        this.dataManager = dataManager;
        this.videos = [];
        this.isLoading = false;
        
        this.setupEventHandlers();
    }

    /**
     * Setup event handlers for video grid
     */
    setupEventHandlers() {
        this.container.addEventListener('click', (e) => {
            const videoCard = e.target.closest('.video-card');
            const instagramGridItem = e.target.closest('.instagram-grid-item');
            
            if (!this.isLoading) {
                if (videoCard) {
                    const videoId = videoCard.dataset.videoId;
                    this.onVideoClick?.(videoId);
                } else if (instagramGridItem) {
                    const videoId = instagramGridItem.dataset.videoId;
                    this.onVideoClick?.(videoId);
                }
            }
        });

        // Lazy loading for images
        this.setupLazyLoading();
    }

    /**
     * Setup lazy loading for video thumbnails
     */
    setupLazyLoading() {
        if ('IntersectionObserver' in window) {
            this.imageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.src = img.dataset.src;
                        img.classList.remove('lazy');
                        observer.unobserve(img);
                    }
                });
            });
        }
    }

    /**
     * Render videos in the grid
     */
    render(videos) {
        this.videos = videos;
        this.isLoading = true;

        const html = videos.map(video => this.createVideoCard(video)).join('');
        this.container.innerHTML = html;

        // Images are now loaded directly, no lazy loading setup needed

        this.isLoading = false;
    }

    /**
     * Create Instagram-style grid item HTML
     */
    createVideoCard(video) {
        let thumbnail;
        let mediaType = 'image';
        let hasMultipleMedia = false;
        
        // Handle Instagram posts
        if (video.media_files && video.media_files.length > 0) {
            const firstMedia = video.media_files[0];
            hasMultipleMedia = video.media_files.length > 1;
            
            if (firstMedia.type === 'video' && firstMedia.thumbnail) {
                thumbnail = `instadata/posts/${firstMedia.thumbnail}`;
                mediaType = 'video';
            } else {
                thumbnail = `instadata/posts/${firstMedia.filename}`;
            }
            
            console.log(`Creating card for ${video.video_id}: ${thumbnail}, media type: ${mediaType}`);
            
            // Test if we can load the image
            const testImg = new Image();
            testImg.onload = () => console.log(`✅ Successfully loaded: ${thumbnail}`);
            testImg.onerror = () => console.error(`❌ Failed to load: ${thumbnail}`);
            testImg.src = thumbnail;
        } else {
            // Fallback to YouTube thumbnail
            thumbnail = `https://img.youtube.com/vi/${video.video_id}/maxresdefault.jpg`;
            console.log(`Fallback thumbnail for ${video.video_id}: ${thumbnail}`);
        }
        
        const likes = this.formatNumber(video.like_count || video.view_count);
        const comments = this.formatNumber(video.comment_count);
        
        // Format date for overlay
        const date = new Date(video.published_at);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        let dateText;
        if (diffDays < 1) {
            dateText = 'Today';
        } else if (diffDays < 7) {
            dateText = `${diffDays}d`;
        } else if (diffDays < 30) {
            dateText = `${Math.floor(diffDays / 7)}w`;
        } else if (diffDays < 365) {
            dateText = `${Math.floor(diffDays / 30)}mo`;
        } else {
            dateText = `${Math.floor(diffDays / 365)}y`;
        }
        
        return `
            <div class="col-3 p-1">
                <div class="instagram-grid-item position-relative" data-video-id="${video.video_id}">
                    <div class="instagram-thumbnail">
                        <img class="w-100 h-100" 
                             src="${thumbnail}" 
                             alt="${this.escapeHTML(video.title)}" 
                             loading="lazy"
                             style="object-fit: cover;"
                             onerror="this.style.background='#f0f0f0'; this.style.display='block'; console.error('Failed to load image:', this.src); this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDMwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIiBmaWxsPSIjRjBGMEYwIi8+CjxwYXRoIGQ9Ik0xNTAgMTIwQzEzNi4xOTMgMTIwIDEyNSAxMzEuMTkzIDEyNSAxNDVDMTI1IDE1OC44MDcgMTM2LjE5MyAxNzAgMTUwIDE3MEMxNjMuODA3IDE3MCAxNzUgMTU4LjgwNyAxNzUgMTQ1QzE3NSAxMzEuMTkzIDE2My44MDcgMTIwIDE1MCAxMjBaIiBmaWxsPSIjQzBDMEMwIi8+CjxwYXRoIGQ9Ik0xMDAgMjAwSDE4MFYxODBIMTAwVjIwMFoiIGZpbGw9IiNDMEMwQzAiLz4KPC9zdmc+'">
                    </div>
                    
                    <!-- Multiple media indicator (top-right) -->
                    <div class="media-indicators position-absolute" style="top: 8px; right: 8px;">
                        ${hasMultipleMedia ? '<i class="fas fa-clone text-white"></i>' : ''}
                    </div>
                    
                    <!-- Hover overlay with stats -->
                    <div class="hover-overlay position-absolute w-100 h-100 d-flex align-items-center justify-content-center">
                        <div class="text-white text-center">
                            <div class="mb-3">
                                <i class="${mediaType === 'video' ? 'fas fa-play' : 'fas fa-eye'}" style="font-size: 28px;"></i>
                            </div>
                            <div class="mb-2">
                                <i class="fas fa-calendar-alt me-1"></i>
                                <span>${dateText}</span>
                            </div>
                            <div class="d-flex align-items-center justify-content-center gap-3">
                                <div>
                                    <i class="fas fa-heart me-1"></i>
                                    <span>${likes}</span>
                                </div>
                                <div>
                                    <i class="fas fa-comment me-1"></i>
                                    <span>${comments}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Add skeleton loading cards
     */
    renderSkeleton(count = 12) {
        const skeletonCards = Array(count).fill(0).map(() => `
            <div class="col-3 p-1">
                <div class="instagram-grid-item skeleton">
                    <div class="instagram-thumbnail" style="background: #f0f0f0;">
                        <div class="w-100 h-100"></div>
                    </div>
                </div>
            </div>
        `).join('');

        this.container.innerHTML = skeletonCards;
    }

    /**
     * Format numbers (1000 -> 1K)
     */
    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1).replace('.0', '') + 'M';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(1).replace('.0', '') + 'K';
        }
        return num.toString();
    }

    /**
     * Escape HTML
     */
    escapeHTML(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Set video click handler
     */
    setVideoClickHandler(handler) {
        this.onVideoClick = handler;
    }
}

// Export for use in other modules
window.VideoGridComponent = VideoGridComponent; 