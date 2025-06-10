/**
 * Medical Medium Archive Explorer - Main Application
 * Coordinates all components and manages application state
 */
class ArchiveExplorer {
    constructor() {
        this.dataManager = new DataManager();
        this.exportService = new ExportService();
        this.directoryManager = new DirectoryManager();
        this.videoPlayer = null;
        
        // Application state
        this.currentView = 'videos'; // 'videos' or 'video-detail'
        this.currentVideo = null;
        this.currentFilters = {};
        this.currentPagination = { page: 1, limit: 24 };
        this.currentCommentPagination = { page: 1, limit: 50 };
        this.isHostedMode = false; // True when using File System Access API
        
        // UI elements
        this.elements = {};
        
        this.initializeApp();
    }

    /**
     * Initialize the application
     */
    async initializeApp() {
        try {
            // Cache DOM elements first
            this.cacheElements();
            
            // Validate critical elements exist
            if (!this.elements.loadingStatus || !this.elements.loadingProgress) {
                throw new Error('Loading screen elements not found. Please check HTML structure.');
            }
            
            // Hide loading screen initially and show directory selection
            this.elements.loadingScreen.style.display = 'none';
            this.showDirectorySelection();
            
        } catch (error) {
            console.error('❌ Failed to initialize app:', error);
            this.showError('Failed to load the archive. Please refresh the page.');
        }
    }

    /**
     * Show directory selection modal
     */
    showDirectorySelection() {
        const modal = document.getElementById('directorySelectionModal');
        const apiSupported = document.getElementById('directoryApiSupported');
        const apiNotSupported = document.getElementById('directoryApiNotSupported');
        
        // Show modal
        modal.style.display = 'flex';
        
        // Check File System Access API support
        if (this.directoryManager.isSupported) {
            apiSupported.style.display = 'block';
            apiNotSupported.style.display = 'none';
            this.isHostedMode = true;
        } else {
            apiSupported.style.display = 'none';
            apiNotSupported.style.display = 'block';
            this.isHostedMode = false;
        }
        
        // Set up directory selection event listeners
        this.setupDirectoryEventListeners();
    }

    /**
     * Set up directory selection event listeners
     */
    setupDirectoryEventListeners() {
        const selectDirectoryBtn = document.getElementById('selectDirectoryBtn');
        const useLocalServerBtn = document.getElementById('useLocalServerBtn');
        const continueToAppBtn = document.getElementById('continueToAppBtn');
        const retryDirectoryBtn = document.getElementById('retryDirectoryBtn');
        
        // File System Access API approach
        if (selectDirectoryBtn) {
            selectDirectoryBtn.addEventListener('click', async () => {
                await this.handleDirectorySelection();
            });
        }
        
        // Local server fallback approach
        if (useLocalServerBtn) {
            useLocalServerBtn.addEventListener('click', () => {
                this.handleLocalServerMode();
            });
        }
        
        // Continue to app after successful directory selection
        if (continueToAppBtn) {
            continueToAppBtn.addEventListener('click', () => {
                this.hideDirectorySelection();
                this.startApp();
            });
        }
        
        // Retry directory selection
        if (retryDirectoryBtn) {
            retryDirectoryBtn.addEventListener('click', () => {
                this.hideDirectoryError();
                this.showDirectorySelection();
            });
        }
    }

    /**
     * Handle directory selection using File System Access API
     */
    async handleDirectorySelection() {
        try {
            this.showDirectoryStatus('Requesting directory access...');
            
            // Request directory access
            await this.directoryManager.requestDirectory();
            
            this.showDirectoryStatus('Scanning directory for videos...');
            
            // Scan directory for files (only video files, not metadata)
            const scanResult = await this.directoryManager.scanDirectory();
            
            this.showDirectoryStatus('Loading video metadata from server...');
            
            // Load video mapping from hosted data folder (not from user's directory)
            const response = await fetch('data/video-mapping.json');
            if (!response.ok) {
                throw new Error('video-mapping.json not found on server. Please ensure it\'s deployed with the app.');
            }
            const videoMapping = await response.json();
            
            // Update UI with success
            console.log(`📊 Directory scan results: ${scanResult.videoFiles.size} video files found`);
            
            this.showDirectorySuccess(
                this.directoryManager.getDirectoryName()
            );
            
            // Store the video mapping for later use
            this.videoMapping = videoMapping;
            
        } catch (error) {
            console.error('Directory selection failed:', error);
            this.showDirectoryError(error.message);
        }
    }

    /**
     * Handle local server mode (fallback)
     */
    handleLocalServerMode() {
        // Set hosted mode to false
        this.isHostedMode = false;
        
        // Hide directory selection and start app normally
        this.hideDirectorySelection();
        this.startApp();
    }

    /**
     * Start the main application after directory setup
     */
    async startApp() {
        try {
            // Show loading screen
            this.elements.loadingScreen.style.display = 'flex';
            
            this.updateLoadingProgress('Initializing application...', 10);
            
            // Set up event listeners
            this.setupEventListeners();
            
            this.updateLoadingProgress('Loading video data...', 30);
            
            // Initialize data manager with appropriate mode
            if (this.isHostedMode && this.videoMapping) {
                // Use File System Access API data with server metadata
                await this.dataManager.initializeFromHostedMapping(this.videoMapping);
            } else {
                // Use traditional local server approach
                await this.dataManager.initialize();
            }
            
            this.updateLoadingProgress('Optimizing search indexes...', 70);
            await new Promise(resolve => setTimeout(resolve, 500)); // Brief pause for user feedback
            
            this.updateLoadingProgress('Setting up export services...', 90);
            
            // Initialize export service
            this.exportService = new ExportService();
            
            // Initialize video player with directory manager if in hosted mode
            this.videoPlayer = new VideoPlayer(
                document.getElementById('videoPlayer'),
                document.getElementById('videoFallback'),
                this.isHostedMode ? this.directoryManager : null
            );
            
            this.updateLoadingProgress('Ready!', 100);
            
            // Load initial video grid
            await this.loadVideoGrid();
            
            // Update stats
            this.updateStats();
            
            // Hide loading screen and show app
            this.hideLoadingScreen();
            
            // Check for enhanced ZIP capabilities
            setTimeout(() => {
                this.checkZipCapabilities();
            }, 1000);
            
            console.log('🎉 Archive Explorer initialized successfully!');
            
        } catch (error) {
            console.error('❌ Failed to initialize app:', error);
            
            // Try to hide loading screen even if initialization fails
            this.elements.loadingScreen.style.display = 'none';
            this.elements.app.style.display = 'block';
            
            this.showError('Failed to load the archive. Please refresh the page.');
        }
    }

    /**
     * UI helper methods for directory selection
     */
    showDirectoryStatus(message) {
        const statusDiv = document.getElementById('directoryStatus');
        const errorDiv = document.getElementById('directoryError');
        const apiMethods = document.querySelectorAll('.api-method');
        
        // Hide other sections
        apiMethods.forEach(el => el.style.display = 'none');
        if (errorDiv) errorDiv.style.display = 'none';
        
        // Show status with loading message
        if (statusDiv) {
            statusDiv.innerHTML = `
                <div class="text-center">
                    <div class="spinner-border text-primary mb-3" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p>${message}</p>
                </div>
            `;
            statusDiv.style.display = 'block';
        }
    }

    showDirectorySuccess(directoryName) {
        const statusDiv = document.getElementById('directoryStatus');
        
        if (statusDiv) {
            statusDiv.innerHTML = `
                <div class="alert alert-success">
                    <i class="bi bi-check-circle"></i>
                    <strong>Directory loaded:</strong> ${directoryName}
                    <br>
                    <small>Video files successfully loaded</small>
                </div>
                <button id="continueToAppBtn" class="btn btn-success btn-lg">
                    <i class="bi bi-play-circle"></i> Continue to App
                </button>
            `;
            statusDiv.style.display = 'block';
            
            // Re-attach event listener
            const continueBtn = document.getElementById('continueToAppBtn');
            if (continueBtn) {
                continueBtn.addEventListener('click', () => {
                    this.hideDirectorySelection();
                    this.startApp();
                });
            }
        }
    }

    showDirectoryError(message) {
        const errorDiv = document.getElementById('directoryError');
        const errorMessage = document.getElementById('errorMessage');
        const statusDiv = document.getElementById('directoryStatus');
        
        if (statusDiv) statusDiv.style.display = 'none';
        if (errorMessage) errorMessage.textContent = message;
        if (errorDiv) errorDiv.style.display = 'block';
    }

    hideDirectoryError() {
        const errorDiv = document.getElementById('directoryError');
        if (errorDiv) errorDiv.style.display = 'none';
    }

    hideDirectorySelection() {
        const modal = document.getElementById('directorySelectionModal');
        if (modal) modal.style.display = 'none';
    }

    /**
     * Cache DOM elements
     */
    cacheElements() {
        // Critical elements that must exist
        const criticalElements = {
            loadingScreen: 'loadingScreen',
            loadingStatus: 'loadingStatus', 
            loadingProgress: 'loadingProgress',
            app: 'app'
        };
        
        // Optional elements that may not exist in all views
        const optionalElements = {
            searchInput: 'search-input',
            sortSelect: 'sort-select',
            statsBar: 'statsBar',
            resultCount: 'resultCount',
            totalComments: 'totalComments',
            videoGridView: 'videoGridView',
            videoDetailView: 'videoDetailView',
            videoGrid: 'videoGrid',
            videoPagination: 'videoPagination',
            videoTitle: 'videoTitle',
            videoDate: 'videoDate',
            videoViews: 'videoViews',
            videoCommentCount: 'videoCommentCount',
            videoDescription: 'videoDescription',
            commentsList: 'commentsList',
            commentSearch: 'commentSearch',
            commentSort: 'commentSort',
            loadMoreComments: 'loadMoreComments',
            exportVideoComments: 'exportVideoComments',
            exportProgress: 'exportProgress',
            exportProgressBar: 'exportProgressBar',
            exportProgressText: 'exportProgressText',
            exportProgressTitle: 'exportProgressTitle',
            currentVideoProgress: 'currentVideoProgress',
            currentVideoProgressBar: 'currentVideoProgressBar',
            currentVideoStats: 'currentVideoStats',
            overallProgressLabel: 'overallProgressLabel',
            overallProgressStats: 'overallProgressStats',
            exportAllVideos: 'exportAllVideos',
            commentInsights: 'commentInsights',
            wordCloud: 'wordCloud',
            likedWords: 'likedWords',
            breadcrumb: 'breadcrumb'
        };

        this.elements = {};
        
        // Cache critical elements and validate they exist
        for (const [key, id] of Object.entries(criticalElements)) {
            const element = document.getElementById(id);
            if (!element) {
                console.error(`❌ Critical element not found: ${id}`);
                throw new Error(`Critical element not found: ${id}`);
            }
            this.elements[key] = element;
        }
        
        // Cache optional elements (don't fail if missing)
        for (const [key, id] of Object.entries(optionalElements)) {
            const element = document.getElementById(id);
            if (element) {
                this.elements[key] = element;
            } else {
                console.warn(`⚠️ Optional element not found: ${id}`);
                this.elements[key] = null;
            }
        }
        
        console.log('✅ DOM elements cached successfully');
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        try {
            // Header search (if elements exist)
            if (this.elements.searchInput) {
                this.elements.searchInput.addEventListener('input', this.debounce(() => {
                    this.handleSearch();
                }, 300));

                // Enter key in search
                this.elements.searchInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        this.handleSearch();
                    }
                });
            }

            // Search button
            const searchBtn = document.getElementById('search-btn');
            if (searchBtn) {
                searchBtn.addEventListener('click', () => {
                    this.handleSearch();
                });
            }

            // Header sort
            if (this.elements.sortSelect) {
                this.elements.sortSelect.addEventListener('change', () => {
                    this.handleSort(this.elements.sortSelect.value);
                });
            }

            // Video detail navigation
            if (this.elements.breadcrumb) {
                this.elements.breadcrumb.addEventListener('click', (e) => {
                    if (e.target.textContent === 'Videos') {
                        this.showVideoGrid();
                    }
                });
            }

            // Comment search and sort
            if (this.elements.commentSearch) {
                this.elements.commentSearch.addEventListener('input', this.debounce(() => {
                    this.loadComments();
                }, 300));
            }
            
            if (this.elements.commentSort) {
                this.elements.commentSort.addEventListener('change', () => {
                    this.loadComments();
                });
            }

            // Load more comments
            if (this.elements.loadMoreComments) {
                this.elements.loadMoreComments.addEventListener('click', () => {
                    this.loadMoreComments();
                });
            }

            // Export comments
            if (this.elements.exportVideoComments) {
                this.elements.exportVideoComments.addEventListener('click', () => {
                    this.exportVideoComments();
                });
            }

            // Export all videos
            if (this.elements.exportAllVideos) {
                this.elements.exportAllVideos.addEventListener('click', () => {
                    this.exportAllVideosComments();
                });
            }

            // Export progress close
            document.addEventListener('click', (e) => {
                if (e.target.matches('.close-progress')) {
                    this.hideExportProgress();
                }
            });

            // Home link navigation
            const homeLink = document.getElementById('home-link');
            if (homeLink) {
                homeLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.showVideoGrid();
                });
            }

            // Export single comment button (event delegation)
            document.addEventListener('click', (e) => {
                if (e.target.matches('.export-btn') || e.target.closest('.export-btn')) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const btn = e.target.closest('.export-btn');
                    const commentId = btn?.dataset?.commentId;
                    
                    if (commentId) {
                        const comment = this.findCommentById(commentId);
                        if (comment) {
                            this.exportSingleComment(comment);
                        } else {
                            console.error('Comment not found:', commentId);
                            this.showError('Comment not found');
                        }
                    }
                }
            });

            // Insights tab switching
            document.addEventListener('click', (e) => {
                if (e.target.matches('[data-tab]')) {
                    e.preventDefault();
                    this.switchInsightTab(e.target.dataset.tab);
                }
            });
            
            console.log('✅ Event listeners set up successfully');
            
        } catch (error) {
            console.error('❌ Error setting up event listeners:', error);
        }
    }

    /**
     * Update loading progress
     */
    updateLoadingProgress(status, progress) {
        try {
            if (this.elements && this.elements.loadingStatus && this.elements.loadingProgress) {
                this.elements.loadingStatus.textContent = status;
                this.elements.loadingProgress.style.width = `${progress}%`;
                this.elements.loadingProgress.setAttribute('aria-valuenow', progress);
                
                // Add some visual feedback for long operations
                if (progress >= 30 && progress < 80) {
                    this.elements.loadingStatus.innerHTML = `${status}<br><small class="text-muted">Processing large dataset (82K comments)...</small>`;
                }
            } else {
                console.warn('⚠️ Loading progress elements not available:', status, progress);
            }
        } catch (error) {
            console.error('❌ Error updating loading progress:', error);
        }
    }

    /**
     * Hide loading screen and show app
     */
    hideLoadingScreen() {
        this.elements.loadingScreen.style.display = 'none';
        this.elements.app.style.display = 'block';
    }

    /**
     * Load and display video grid
     */
    async loadVideoGrid() {
        try {
            const filters = {
                ...this.currentFilters,
                search: this.elements.searchInput.value
            };
            
            const result = await this.dataManager.getVideos(filters, this.currentPagination);
            this.renderVideoGrid(result.videos);
            this.renderPagination(result);
            this.updateResultCount(result.total);
            
        } catch (error) {
            console.error('❌ Failed to load videos:', error);
            this.showError('Failed to load videos');
        }
    }

    /**
     * Render video grid
     */
    renderVideoGrid(videos) {
        const html = videos.map(video => this.createVideoCard(video)).join('');
        this.elements.videoGrid.innerHTML = html;
        
        // Add click handlers
        this.elements.videoGrid.addEventListener('click', (e) => {
            const videoCard = e.target.closest('.video-card');
            if (videoCard) {
                const videoId = videoCard.dataset.videoId;
                this.showVideoDetail(videoId);
            }
        });
    }

    /**
     * Create video card HTML
     */
    createVideoCard(video) {
        const thumbnail = `https://img.youtube.com/vi/${video.video_id}/maxresdefault.jpg`;
        const date = new Date(video.published_at).toLocaleDateString();
        const views = this.formatNumber(video.view_count);
        const comments = this.formatNumber(video.comment_count);
        
        return `
            <div class="col-md-6 col-lg-4 col-xl-3">
                <div class="card video-card" data-video-id="${video.video_id}">
                    <div class="video-thumbnail">
                        <img src="${thumbnail}" class="card-img-top" alt="${video.title}" loading="lazy">
                    </div>
                    <div class="video-card-body card-body">
                        <h6 class="video-title">${this.escapeHTML(video.title)}</h6>
                        <div class="video-stats">
                            <small class="text-muted">${views} views • ${comments} comments</small>
                        </div>
                        <div class="video-date">
                            <small class="text-muted">${date}</small>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Show video detail view
     */
    async showVideoDetail(videoId) {
        try {
            const video = this.dataManager.getVideo(videoId);
            if (!video) {
                this.showError('Video not found');
                return;
            }

            this.currentVideo = video;
            this.currentView = 'video-detail';
            
            // Update UI
            this.elements.videoGridView.style.display = 'none';
            this.elements.videoDetailView.style.display = 'block';
            
            // Hide channel navigation tools and stats bar
            document.getElementById('channel-navigation').style.display = 'none';
            this.elements.statsBar.style.display = 'none';
            
            // Update breadcrumb
            this.updateBreadcrumb(['Videos', video.title]);
            
            // Load video
            await this.videoPlayer.loadVideo(video, this.dataManager);
            
            // Update video info
            this.updateVideoInfo(video);
            
            // Load comments
            this.currentCommentPagination = { page: 1, limit: 50 };
            await this.loadComments();
            
            // Generate and show insights
            await this.generateCommentInsights();
            
        } catch (error) {
            console.error('❌ Failed to show video detail:', error);
            this.showError('Failed to load video');
        }
    }

    /**
     * Show video grid view
     */
    showVideoGrid() {
        this.currentView = 'videos';
        this.currentVideo = null;
        
        this.elements.videoDetailView.style.display = 'none';
        this.elements.videoGridView.style.display = 'block';
        
        // Show channel navigation tools and stats bar
        document.getElementById('channel-navigation').style.display = 'flex';
        this.elements.statsBar.style.display = 'block';
        
        this.updateBreadcrumb(['Videos']);
        
        // Clean up video player
        if (this.videoPlayer) {
            this.videoPlayer.destroy();
        }
    }

    /**
     * Update video info display
     */
    updateVideoInfo(video) {
        this.elements.videoTitle.textContent = video.title;
        
        // Format date as MM/DD/YYYY
        const date = new Date(video.published_at);
        const formattedDate = (date.getMonth() + 1) + '/' + date.getDate() + '/' + date.getFullYear();
        
        this.elements.videoDate.textContent = formattedDate;
        this.elements.videoViews.textContent = `${this.formatNumber(video.view_count)} views`;
        this.elements.videoCommentCount.textContent = `${this.formatNumber(video.comment_count)} comments`;
        // Preserve line breaks in description
        const description = video.description || 'No description available.';
        this.elements.videoDescription.innerHTML = this.escapeHTML(description).replace(/\n/g, '<br>');
    }

    /**
     * Load comments for current video
     */
    async loadComments() {
        if (!this.currentVideo) return;

        try {
            const filters = {
                search: this.elements.commentSearch.value,
                sortBy: this.elements.commentSort.value
            };
            
            // Load all comments at once for better UX
            const allComments = await this.dataManager.getAllComments(this.currentVideo.video_id, filters);
            
            this.renderComments(allComments);
            // Hide load more button since we're loading all comments
            this.elements.loadMoreComments.style.display = 'none';
            
        } catch (error) {
            console.error('❌ Failed to load comments:', error);
            this.showError('Failed to load comments');
        }
    }

    /**
     * Render comments list
     */
    renderComments(comments) {
        const html = comments.map(comment => this.createCommentCard(comment)).join('');
        this.elements.commentsList.innerHTML = html;
        
        // Event handlers are set up once in setupEventListeners() using event delegation
        // No need to add them here repeatedly
    }

    /**
     * Create comment card HTML
     */
    createCommentCard(comment) {
        const avatarColor = this.exportService.generateAvatarColor(comment.author);
        const firstLetter = comment.author[1]?.toUpperCase() || comment.author[0]?.toUpperCase() || 'U';
        const date = new Date(comment.published_at).toLocaleDateString();
        const likes = this.formatNumber(comment.like_count);
        const heartIcon = comment.channel_owner_liked ? '❤️' : '';
        
        let html = `
            <div class="comment-card">
                <div class="comment-header">
                    <div class="d-flex align-items-center">
                        <div class="avatar me-3" style="background-color: ${avatarColor}; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 500;">
                            ${firstLetter}
                        </div>
                        <div>
                            <div class="comment-author">${this.escapeHTML(comment.author)}</div>
                            <div class="comment-date">${date}</div>
                        </div>
                    </div>
                    <button class="btn btn-outline-primary btn-sm export-btn" data-comment-id="${comment.comment_id}">
                        <i class="bi bi-download"></i>
                    </button>
                </div>
                <div class="comment-text">${this.escapeHTML(comment.text)}</div>
                <div class="comment-actions">
                    <div class="comment-likes">
                        <i class="bi bi-hand-thumbs-up"></i> ${likes}
                        ${heartIcon ? `<span class="channel-owner-liked ms-2">${heartIcon}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
        
        // Add replies if any
        if (comment.replies && comment.replies.length > 0) {
            const repliesHtml = comment.replies.map(reply => `
                <div class="reply-card comment-card">
                    <div class="comment-header">
                        <div class="d-flex align-items-center">
                            <div class="avatar me-3" style="background-color: ${this.exportService.generateAvatarColor(reply.author)}; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 500; font-size: 0.8rem;">
                                ${reply.author[1]?.toUpperCase() || reply.author[0]?.toUpperCase() || 'U'}
                            </div>
                            <div>
                                <div class="comment-author">${this.escapeHTML(reply.author)}</div>
                                <div class="comment-date">${new Date(reply.published_at).toLocaleDateString()}</div>
                            </div>
                        </div>
                        <button class="btn btn-outline-primary btn-sm export-btn" data-comment-id="${reply.comment_id}">
                            <i class="bi bi-download"></i>
                        </button>
                    </div>
                    <div class="comment-text">${this.escapeHTML(reply.text)}</div>
                    <div class="comment-actions">
                        <div class="comment-likes">
                            <i class="bi bi-hand-thumbs-up"></i> ${this.formatNumber(reply.like_count)}
                            ${reply.channel_owner_liked ? `<span class="channel-owner-liked ms-2">❤️</span>` : ''}
                        </div>
                    </div>
                </div>
            `).join('');
            
            html += repliesHtml;
        }
        
        return html;
    }

    /**
     * Find comment by ID in current data
     */
    findCommentById(commentId) {
        // Search in all comments for this video
        const allComments = this.dataManager.comments.filter(c => c.video_id === this.currentVideo?.video_id);
        return allComments.find(c => c.comment_id === commentId);
    }

    /**
     * Export single comment
     */
    async exportSingleComment(comment) {
        try {
            console.log('💬 Starting single comment export for:', comment.comment_id);
            
            this.showExportProgress('single');
            
            // Update progress to show it's starting
            console.log('📊 Setting initial progress...');
            this.updateExportProgress({ current: 0, total: 1, status: 'Starting export...' }, 'single');
            
            // Small delay to see progress
            await new Promise(resolve => setTimeout(resolve, 500));
            
            console.log('📊 Updating progress to 50%...');
            this.updateExportProgress({ current: 0.5, total: 1, status: 'Generating image...' }, 'single');
            
            await this.exportService.exportSingleComment(comment, this.currentVideo?.title || '');
            
            // Update progress to show completion
            console.log('📊 Setting completion progress...');
            this.updateExportProgress({ current: 1, total: 1, status: 'Export complete!' }, 'single');
            
            // Close overlay after showing completion
            setTimeout(() => {
                console.log('🔚 Hiding export progress...');
                this.hideExportProgress();
            }, 1500);
            
            this.showSuccess('Comment exported successfully!');
        } catch (error) {
            console.error('❌ Export failed:', error);
            this.showError('Failed to export comment');
            this.hideExportProgress();
        }
    }

    /**
     * Export all video comments
     */
    async exportVideoComments() {
        if (!this.currentVideo) return;
        
        try {
            this.showExportProgress('single');
            
            await this.exportService.exportVideoComments(
                this.currentVideo.video_id,
                this.dataManager,
                (progress) => {
                    this.updateExportProgress(progress, 'single');
                }
            );
            
            // Close overlay after successful export
            this.hideExportProgress();
            
        } catch (error) {
            console.error('❌ Export failed:', error);
            this.showError('Failed to export comments');
            this.hideExportProgress();
        }
    }

    /**
     * Export comments for all videos
     */
    async exportAllVideosComments() {
        try {
            this.showExportProgress('all');
            
            await this.exportService.exportAllVideos(
                this.dataManager,
                (progress) => {
                    this.updateExportProgress(progress, 'all');
                }
            );
            
            // Close overlay after successful export
            this.hideExportProgress();
            
        } catch (error) {
            console.error('❌ Export failed:', error);
            this.showError('Failed to export all videos');
            this.hideExportProgress();
        }
    }

    /**
     * Show export progress
     */
    showExportProgress(mode = 'single') {
        console.log('🚀 Starting export with mode:', mode);
        
        this.elements.exportProgress.style.display = 'block';
        
        if (mode === 'all') {
            this.elements.exportProgressTitle.textContent = 'Exporting All Videos';
            this.elements.currentVideoProgress.style.display = 'block';
            this.elements.overallProgressLabel.textContent = 'Overall:';
        } else {
            this.elements.exportProgressTitle.textContent = 'Exporting Comments';
            this.elements.currentVideoProgress.style.display = 'none';
            this.elements.overallProgressLabel.textContent = 'Progress:';
        }
    }

    /**
     * Hide export progress
     */
    hideExportProgress() {
        this.elements.exportProgress.style.display = 'none';
    }

    /**
     * Update export progress
     */
    updateExportProgress(progress, mode = 'single') {
        // Debug logging
        console.log('🔄 Progress update:', { progress, mode });

        if (mode === 'all') {
            // Multi-video export progress
            if (progress.totalVideos > 0) {
                const videoPercentage = progress.currentVideo > 0 ? 
                    ((progress.currentVideo - 1) / progress.totalVideos) * 100 + 
                    (progress.currentVideoComments / progress.totalVideoComments) * (100 / progress.totalVideos) : 0;
                
                this.elements.exportProgressBar.style.width = `${Math.min(videoPercentage, 100)}%`;
                this.elements.overallProgressStats.textContent = `${progress.currentVideo}/${progress.totalVideos} videos`;
            }

            // Current video progress
            if (progress.totalVideoComments > 0) {
                const currentVideoPercentage = (progress.currentVideoComments / progress.totalVideoComments) * 100;
                this.elements.currentVideoProgressBar.style.width = `${currentVideoPercentage}%`;
                this.elements.currentVideoStats.textContent = `${progress.currentVideoComments}/${progress.totalVideoComments} comments`;
            }
        } else {
            // Single video export progress
            const percentage = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;
            this.elements.exportProgressBar.style.width = `${percentage}%`;
            this.elements.overallProgressStats.textContent = `${progress.current || 0}/${progress.total || 0} comments`;
        }
        
        this.elements.exportProgressText.textContent = progress.status;
    }

    /**
     * Handle search input
     */
    async handleSearch() {
        this.currentPagination.page = 1;
        await this.loadVideoGrid();
    }

    /**
     * Handle sort selection
     */
    async handleSort(sortBy) {
        this.currentFilters.sortBy = sortBy;
        this.currentPagination.page = 1;
        await this.loadVideoGrid();
    }

    /**
     * Update breadcrumb navigation
     */
    updateBreadcrumb(items) {
        const html = items.map((item, index) => {
            const isLast = index === items.length - 1;
            const classes = isLast ? 'breadcrumb-item active' : 'breadcrumb-item';
            
            // Add home icon to "Videos" item
            const itemText = item === 'Videos' ? 
                `<i class="fas fa-home"></i>${this.escapeHTML(item)}` : 
                this.escapeHTML(item);
                
            return `<li class="${classes}">${itemText}</li>`;
        }).join('');
        
        this.elements.breadcrumb.innerHTML = html;
    }

    /**
     * Update stats display
     */
    updateStats() {
        const stats = this.dataManager.getStats();
        this.elements.totalComments.textContent = `${this.formatNumber(stats.totalComments)} comments`;
    }

    /**
     * Update result count
     */
    updateResultCount(count) {
        this.elements.resultCount.textContent = `${this.formatNumber(count)} videos`;
    }

    /**
     * Render pagination
     */
    renderPagination(result) {
        let html = '';
        const currentPage = result.page;
        const totalPages = result.totalPages;
        
        // Previous button
        if (result.hasPrev) {
            html += `<li class="page-item"><a class="page-link" href="#" data-page="${currentPage - 1}">Previous</a></li>`;
        } else {
            html += `<li class="page-item disabled"><span class="page-link">Previous</span></li>`;
        }
        
        // Page numbers
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, currentPage + 2);
        
        if (startPage > 1) {
            html += `<li class="page-item"><a class="page-link" href="#" data-page="1">1</a></li>`;
            if (startPage > 2) {
                html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
            }
        }
        
        for (let i = startPage; i <= endPage; i++) {
            if (i === currentPage) {
                html += `<li class="page-item active"><span class="page-link">${i}</span></li>`;
            } else {
                html += `<li class="page-item"><a class="page-link" href="#" data-page="${i}">${i}</a></li>`;
            }
        }
        
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
            }
            html += `<li class="page-item"><a class="page-link" href="#" data-page="${totalPages}">${totalPages}</a></li>`;
        }
        
        // Next button
        if (result.hasNext) {
            html += `<li class="page-item"><a class="page-link" href="#" data-page="${currentPage + 1}">Next</a></li>`;
        } else {
            html += `<li class="page-item disabled"><span class="page-link">Next</span></li>`;
        }
        
        this.elements.videoPagination.innerHTML = html;
        
        // Add click handlers
        this.elements.videoPagination.addEventListener('click', (e) => {
            if (e.target.matches('[data-page]')) {
                e.preventDefault();
                this.currentPagination.page = parseInt(e.target.dataset.page);
                this.loadVideoGrid();
            }
        });
    }

    /**
     * Load more comments
     */
    async loadMoreComments() {
        this.currentCommentPagination.page++;
        await this.loadComments();
    }

    /**
     * Update load more button
     */
    updateLoadMoreButton(result) {
        if (result.hasNext) {
            this.elements.loadMoreComments.style.display = 'block';
        } else {
            this.elements.loadMoreComments.style.display = 'none';
        }
    }

    /**
     * Utility: Format numbers (1000 -> 1K)
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
     * Utility: Escape HTML
     */
    escapeHTML(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Utility: Debounce function
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Show error message
     */
    showError(message) {
        console.error('💥', message);
        // You could implement a toast notification system here
        alert(`Error: ${message}`);
    }

    /**
     * Show success message
     */
    showSuccess(message, duration = 3000) {
        console.log('✅', message);
        // You could implement a toast notification system here
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.remove();
        }, duration);
    }

    /**
     * Generate comment insights for current video
     */
    async generateCommentInsights() {
        if (!this.currentVideo) return;

        try {
            // Try to use pre-computed insights first for faster loading
            const preComputed = this.dataManager.getWordFrequencies(this.currentVideo.video_id);
            
            if (preComputed.word_cloud.length > 0) {
                // Use pre-computed data for instant loading
                this.renderWordCloud(preComputed.word_cloud);
                this.renderLikedWords(preComputed.liked_words);
                this.elements.commentInsights.style.display = 'block';
                return;
            }

            // Fallback to real-time analysis if pre-computed data not available
            const allComments = await this.dataManager.getAllComments(this.currentVideo.video_id, {});
            const flatComments = this.flattenComments(allComments);

            if (flatComments.length === 0) {
                this.elements.commentInsights.style.display = 'none';
                return;
            }

            // Generate word frequency analysis
            const wordFreq = this.analyzeWordFrequency(flatComments);
            const likedWords = this.analyzeLikedCommentWords(flatComments);

            // Update UI
            this.renderWordCloud(wordFreq);
            this.renderLikedWords(likedWords);
            this.elements.commentInsights.style.display = 'block';

        } catch (error) {
            console.error('❌ Failed to generate insights:', error);
            this.elements.commentInsights.style.display = 'none';
        }
    }

    /**
     * Analyze word frequency in comments
     */
    analyzeWordFrequency(comments) {
        const stopWords = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
            'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
            'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'cannot', 'cant',
            'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
            'this', 'that', 'these', 'those', 'my', 'your', 'his', 'her', 'its', 'our', 'their',
            'what', 'which', 'who', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each',
            'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
            'same', 'so', 'than', 'too', 'very', 's', 't', 're', 've', 'll', 'd', 'just', 'now',
            'also', 'back', 'still', 'well', 'get', 'go', 'know', 'like', 'see', 'think', 'want',
            'really', 'way', 'right', 'good', 'great', 'much', 'many', 'new', 'first', 'last',
            'long', 'little', 'own', 'other', 'old', 'right', 'big', 'high', 'different', 'small',
            'large', 'next', 'early', 'young', 'important', 'few', 'public', 'bad', 'same', 'able'
        ]);

        const wordCounts = {};

        comments.forEach(comment => {
            const words = comment.text.toLowerCase()
                .replace(/[^\w\s]/g, '') // Remove punctuation
                .split(/\s+/)
                .filter(word => word.length > 2 && !stopWords.has(word));

            words.forEach(word => {
                wordCounts[word] = (wordCounts[word] || 0) + 1;
            });
        });

        // Return top 20 words
        return Object.entries(wordCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 20)
            .map(([word, count]) => ({ word, count }));
    }

    /**
     * Analyze words in most-liked comments
     */
    analyzeLikedCommentWords(comments) {
        // Sort by likes and take top 20%
        const sortedByLikes = comments.sort((a, b) => b.like_count - a.like_count);
        const topPercentage = Math.max(1, Math.floor(sortedByLikes.length * 0.2));
        const topComments = sortedByLikes.slice(0, topPercentage);

        const wordLikeScores = {};

        topComments.forEach(comment => {
            const words = comment.text.toLowerCase()
                .replace(/[^\w\s]/g, '')
                .split(/\s+/)
                .filter(word => word.length > 3);

            words.forEach(word => {
                if (!wordLikeScores[word]) {
                    wordLikeScores[word] = { totalLikes: 0, count: 0 };
                }
                wordLikeScores[word].totalLikes += comment.like_count;
                wordLikeScores[word].count += 1;
            });
        });

        // Calculate average likes per word and return top 15
        return Object.entries(wordLikeScores)
            .map(([word, data]) => ({
                word,
                avgLikes: Math.round(data.totalLikes / data.count),
                count: data.count
            }))
            .filter(item => item.count >= 2) // Must appear in at least 2 comments
            .sort((a, b) => b.avgLikes - a.avgLikes)
            .slice(0, 15);
    }

    /**
     * Render word cloud
     */
    renderWordCloud(wordFreq) {
        if (wordFreq.length === 0) {
            this.elements.wordCloud.innerHTML = '<p class="text-muted text-center">No word data available</p>';
            return;
        }

        const maxCount = wordFreq[0].count;
        const html = wordFreq.map(({ word, count }) => {
            const size = Math.min(5, Math.max(1, Math.ceil((count / maxCount) * 5)));
            return `<span class="word-item size-${size}" title="${count} occurrences">
                ${word} <span class="word-count">${count}</span>
            </span>`;
        }).join('');

        this.elements.wordCloud.innerHTML = html;
    }

    /**
     * Render liked words analysis
     */
    renderLikedWords(likedWords) {
        if (likedWords.length === 0) {
            this.elements.likedWords.innerHTML = '<p class="text-muted text-center">No liked comment data available</p>';
            return;
        }

        const html = likedWords.map(({ word, avgLikes, count }) => {
            const roundedAvgLikes = Math.round(avgLikes);
            return `<span class="liked-word" title="Average ${roundedAvgLikes} likes in ${count} comments">
                ${word} <span class="count">${roundedAvgLikes}</span>
            </span>`;
        }).join('');

        this.elements.likedWords.innerHTML = html;
    }

    /**
     * Switch between insight tabs
     */
    switchInsightTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('[data-tab]').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Show/hide tab content
        document.querySelectorAll('.insight-tab').forEach(tab => {
            tab.style.display = 'none';
        });

        if (tabName === 'wordcloud') {
            document.getElementById('wordCloudTab').style.display = 'block';
        } else if (tabName === 'liked') {
            document.getElementById('likedWordsTab').style.display = 'block';
        }
    }

    /**
     * Flatten comments with replies
     */
    flattenComments(commentsWithReplies) {
        const flattened = [];
        commentsWithReplies.forEach(comment => {
            flattened.push(comment);
            if (comment.replies && comment.replies.length > 0) {
                flattened.push(...comment.replies);
            }
        });
        return flattened;
    }

    /**
     * Check and notify about ZIP capabilities
     */
    checkZipCapabilities() {
        if (window.ZipWriter) {
            this.showSuccess('Enhanced export enabled! You can now export up to 200 comments per ZIP file.', 5000);
        } else {
            console.log('ℹ️ Using standard export mode with 49 comments per ZIP file for compatibility.');
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ArchiveExplorer();
});

// Export for use in other modules
window.ArchiveExplorer = ArchiveExplorer; 