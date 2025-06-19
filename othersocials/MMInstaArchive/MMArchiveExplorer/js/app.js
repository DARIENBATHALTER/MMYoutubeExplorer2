/**
 * Medical Medium Archive Explorer - Main Application
 * Coordinates all components and manages application state
 */
class ArchiveExplorer {
    constructor() {
        this.dataManager = new DataManager();
        this.exportService = new ExportService();
        this.modeManager = new ModeManager();
        this.videoPlayer = null;
        
        // Application state
        this.currentView = 'videos'; // 'videos' or 'video-detail'
        this.currentVideo = null;
        this.currentFilters = {};
        this.currentPagination = { page: 1, limit: 24 };
        this.currentCommentPagination = { page: 1, limit: 50 };
        
        // UI elements
        this.elements = {};
        
        // Components
        this.videoGridComponent = null;
        this.commentListComponent = null;
        
        // View mode
        this.currentViewMode = 'grid';
        
        // List view sorting state
        this.currentListSort = { field: 'date', direction: 'desc' };
        
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
            
            // Bypass welcome screen and load archive directly
            this.elements.loadingScreen.style.display = 'none';
            this.loadArchiveDirectly();
            
        } catch (error) {
            console.error('❌ Failed to initialize app:', error);
            this.showError('Failed to load the archive. Please refresh the page.');
        }
    }

    /**
     * Load archive directly without welcome screen
     */
    async loadArchiveDirectly() {
        try {
            console.log('🚀 Loading archive directly...');
            
            // Hide the modal in case it's visible
            this.hideModeSelection();
            
            // Show minimal progress wheel
            this.showMinimalLoading();
            
            // Set Instagram mode (default)
            this.modeManager.setMode('instagram');
            this.dataManager.dataSource = 'instagram';
            
            // Start the app (bypass old loading screen)
            this.bypassOldLoading = true;
            await this.startApp();
            
            // Hide loading and show app
            this.hideLoading();
            this.elements.app.style.display = 'block';
            
        } catch (error) {
            console.error('❌ Failed to load archive directly:', error);
            this.hideLoading();
            this.elements.app.style.display = 'block';
            this.showError('Failed to load the archive. Please try refreshing the page.');
        }
    }

    /**
     * Show minimal loading indicator (just progress wheel)
     */
    showMinimalLoading() {
        // Create a simple spinner if it doesn't exist
        let spinner = document.getElementById('minimalSpinner');
        if (!spinner) {
            spinner = document.createElement('div');
            spinner.id = 'minimalSpinner';
            spinner.innerHTML = `
                <div class="d-flex flex-column justify-content-center align-items-center" style="
                    position: fixed; 
                    top: 0; 
                    left: 0; 
                    width: 100vw; 
                    height: 100vh; 
                    background: rgba(255, 255, 255, 0.9); 
                    z-index: 9999;
                ">
                    <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p class="mt-3 text-muted" style="font-size: 14px;">Loading Instagram Archive</p>
                </div>
            `;
            document.body.appendChild(spinner);
        }
        spinner.style.display = 'block';
    }

    /**
     * Hide loading indicators
     */
    hideLoading() {
        // Hide the minimal spinner
        const spinner = document.getElementById('minimalSpinner');
        if (spinner) {
            spinner.style.display = 'none';
        }
        
        // Ensure loading screen is hidden
        this.elements.loadingScreen.style.display = 'none';
    }

    /**
     * Show mode selection modal
     */
    showModeSelection() {
        const modal = document.getElementById('directorySelectionModal');
        const modeSelection = document.getElementById('modeSelection');
        const localArchiveSetup = document.getElementById('localArchiveSetup');
        
        // Show modal and mode selection
        modal.style.display = 'flex';
        modeSelection.style.display = 'block';
        localArchiveSetup.style.display = 'none';
        
        // Set up mode selection event listeners
        this.setupModeEventListeners();
    }

    /**
     * Set up event listeners for mode selection
     */
    setupModeEventListeners() {
        const selectInstagramBtn = document.getElementById('selectInstagramBtn');
        
        // Make entire card clickable
        const instagramCard = document.getElementById('instagramCard');
        
        // Instagram Mode Selection (entire card clickable)
        if (instagramCard) {
            instagramCard.addEventListener('click', async (e) => {
                // Prevent double-click if clicking on button
                if (e.target.tagName === 'BUTTON') return;
                await this.handleInstagramModeSelection();
            });
        }
        
        if (selectInstagramBtn) {
            selectInstagramBtn.addEventListener('click', async (e) => {
                e.stopPropagation(); // Prevent card click
                await this.handleInstagramModeSelection();
            });
        }
    }

    /**
     * Handle mode selection using File System Access API
     */
    async handleModeSelection() {
        try {
            this.showModeStatus('Requesting mode access...');
            
            // Request mode access
            await this.modeManager.requestMode();
            
            this.showModeStatus('Scanning mode for videos...');
            
            // Scan mode for files (only video files, not metadata)
            const scanResult = await this.modeManager.scanMode();
            
            this.showModeStatus('Loading video metadata from server...');
            
            // Load video mapping from hosted data folder (not from user's directory)
            const response = await fetch('data/video-mapping.json');
            if (!response.ok) {
                throw new Error('video-mapping.json not found on server. Please ensure it\'s deployed with the app.');
            }
            const videoMapping = await response.json();
            
            // Update UI with success
            console.log(`📊 Mode scan results: ${scanResult.videoFiles.size} video files found`);
            
            this.showModeSuccess(
                this.modeManager.getModeName()
            );
            
            // Store the video mapping for later use
            this.videoMapping = videoMapping;
            
        } catch (error) {
            console.error('Mode selection failed:', error);
            this.showModeError(error.message);
        }
    }

    /**
     * Handle Instagram mode selection
     */
    async handleInstagramModeSelection() {
        try {
            console.log('🎛️ User selected Instagram mode');
            
            this.showModeStatus('Loading Instagram archive...');
            
            // Set mode and configure data manager
            this.modeManager.setMode('instagram');
            this.dataManager.dataSource = 'instagram';
            
            // Auto-close modal and start app
            setTimeout(() => {
                this.hideModeSelection();
                this.startApp();
            }, 1000);
            
        } catch (error) {
            console.error('Instagram mode initialization failed:', error);
            this.showModeError(error.message);
        }
    }

    /**
     * Show local archive setup screen
     */
    showLocalArchiveSetup() {
        const modeSelection = document.getElementById('modeSelection');
        const localArchiveSetup = document.getElementById('localArchiveSetup');
        const apiSupported = document.getElementById('directoryApiSupported');
        const apiNotSupported = document.getElementById('directoryApiNotSupported');
        
        // Hide mode selection, show local archive setup
        modeSelection.style.display = 'none';
        localArchiveSetup.style.display = 'block';
        
        // Check File System Access API support
        if (this.modeManager.directoryManager.isSupported) {
            apiSupported.style.display = 'block';
            apiNotSupported.style.display = 'none';
        } else {
            apiSupported.style.display = 'none';
            apiNotSupported.style.display = 'block';
        }
    }

    /**
     * Handle directory selection using File System Access API
     */
    async handleDirectorySelection() {
        try {
            this.showModeStatus('Requesting directory access...');
            
            // Initialize local mode
            const result = await this.modeManager.initializeLocalMode();
            
            // Show success toast and auto-close modal
            this.showSuccessToast('Videos loaded successfully!');
            
            // Auto-close modal after brief delay
            setTimeout(() => {
                this.hideModeSelection();
                this.startApp();
            }, 1500);
            
        } catch (error) {
            console.error('Directory selection failed:', error);
            this.showModeError(error.message);
        }
    }

    /**
     * Handle local server mode (fallback)
     */
    handleLocalServerMode() {
        // Set mode to local (non-File System Access API)
        this.modeManager.setMode('local');
        
        // Hide directory selection and start app normally
        this.hideModeSelection();
        this.startApp();
    }

    /**
     * Start the main application after mode setup
     */
    async startApp() {
        try {
            // Show loading screen only if not bypassing
            if (!this.bypassOldLoading) {
                this.elements.loadingScreen.style.display = 'flex';
                this.updateLoadingProgress('Initializing application...', 10);
            }
            
            // Set up event listeners
            this.setupEventListeners();
            
            if (!this.bypassOldLoading) {
                this.updateLoadingProgress('Loading video data...', 30);
            }
            
            // Initialize data manager based on current mode
            if (this.modeManager.isLocalMode() && this.modeManager.directoryManager.isDirectorySelected()) {
                // Use File System Access API data with server metadata
                await this.dataManager.initializeFromHostedMapping(this.modeManager.videoMapping);
            } else {
                // Use traditional local server approach or YouTube mode (both use same metadata)
                await this.dataManager.initialize();
            }
            
            if (!this.bypassOldLoading) {
                this.updateLoadingProgress('Optimizing search indexes...', 70);
                await new Promise(resolve => setTimeout(resolve, 500)); // Brief pause for user feedback
                this.updateLoadingProgress('Setting up export services...', 90);
            }
            
            // Initialize export service
            this.exportService = new ExportService();
            
            // Initialize video player with mode manager
            this.videoPlayer = new VideoPlayer(
                document.getElementById('videoPlayer'),
                document.getElementById('videoFallback'),
                this.modeManager
            );
            
            if (!this.bypassOldLoading) {
                this.updateLoadingProgress('Ready!', 100);
            }
            
            // Load initial video grid
            await this.loadVideoGrid();
            
            // Update stats
            this.updateStats();
            
            // Hide loading screen and show app (only if using old loading)
            if (!this.bypassOldLoading) {
                this.hideLoadingScreen();
            }
            
            // Check for enhanced ZIP capabilities
            setTimeout(() => {
                this.checkZipCapabilities();
            }, 1000);
            
            console.log(`🎉 Archive Explorer initialized successfully in ${this.modeManager.getCurrentMode()} mode!`);
            
        } catch (error) {
            console.error('❌ Failed to initialize app:', error);
            
            // Try to hide loading screen even if initialization fails
            this.elements.loadingScreen.style.display = 'none';
            this.elements.app.style.display = 'block';
            
            this.showError('Failed to load the archive. Please refresh the page.');
        }
    }

    /**
     * UI helper methods for mode selection
     */
    showModeStatus(message) {
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

    showModeSuccess(modeName) {
        const statusDiv = document.getElementById('directoryStatus');
        
        if (statusDiv) {
            statusDiv.innerHTML = `
                <div class="alert alert-success">
                    <i class="bi bi-check-circle"></i>
                    <strong>Mode loaded:</strong> ${modeName}
                    <br>
                    <small>Ready to explore videos</small>
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
                    this.hideModeSelection();
                    this.startApp();
                });
            }
        }
    }

    showModeError(message) {
        const errorDiv = document.getElementById('directoryError');
        const errorMessage = document.getElementById('errorMessage');
        const statusDiv = document.getElementById('directoryStatus');
        
        if (statusDiv) statusDiv.style.display = 'none';
        if (errorMessage) errorMessage.textContent = message;
        if (errorDiv) errorDiv.style.display = 'block';
    }

    hideModeError() {
        const errorDiv = document.getElementById('directoryError');
        if (errorDiv) errorDiv.style.display = 'none';
    }

    hideModeSelection() {
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
            videoListView: 'videoListView',
            videoDetailView: 'videoDetailView',
            videoGrid: 'videoGrid',
            videoListBody: 'videoListBody',
            videoPagination: 'videoPagination',
            videoListPagination: 'videoListPagination',
            gridViewToggle: 'gridViewToggle',
            listViewToggle: 'listViewToggle',
            videoTitle: 'videoTitle',
            videoDate: 'videoDate',
            videoViews: 'videoViews',
            videoCommentCount: 'videoCommentCount',
            videoDescription: 'videoDescription',
            captionComment: 'captionComment',
            captionTime: 'captionTime',
            commentsList: 'commentsList',
            commentSearch: 'commentSearch',
            commentSort: 'commentSort',
            loadMoreComments: 'loadMoreComments',
            exportSinglePostComments: 'exportSinglePostComments',
            exportProgress: 'exportProgress',
            exportProgressBar: 'exportProgressBar',
            exportProgressText: 'exportProgressText',
            exportProgressTitle: 'exportProgressTitle',
            currentVideoProgress: 'currentVideoProgress',
            currentVideoProgressBar: 'currentVideoProgressBar',
            currentVideoStats: 'currentVideoStats',
            overallProgressLabel: 'overallProgressLabel',
            overallProgressStats: 'overallProgressStats',
            exportAllPostsComments: 'exportAllPostsComments',
            commentInsights: 'commentInsights',
            wordCloud: 'wordCloud',
            likedWords: 'likedWords',
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
                if (key === 'exportSinglePostComments' || key === 'exportAllPostsComments') {
                    console.log(`✅ Found export button: ${id}`, element);
                }
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
            // View toggle listeners
            if (this.elements.gridViewToggle) {
                this.elements.gridViewToggle.addEventListener('change', () => {
                    if (this.elements.gridViewToggle.checked) {
                        this.switchToGridView();
                    }
                });
            }
            
            if (this.elements.listViewToggle) {
                this.elements.listViewToggle.addEventListener('change', () => {
                    if (this.elements.listViewToggle.checked) {
                        this.switchToListView();
                    }
                });
            }
            
            // Initialize VideoGridComponent
            if (this.elements.videoGrid) {
                this.videoGridComponent = new VideoGridComponent(this.elements.videoGrid, this.dataManager);
                this.videoGridComponent.setVideoClickHandler((videoId) => {
                    this.showVideoDetail(videoId);
                });
            }
            
            // Initialize CommentListComponent
            if (this.elements.commentsList) {
                this.commentListComponent = new CommentListComponent(this.elements.commentsList, this.exportService);
                // Set the export callback to handle format selection
                this.commentListComponent.onCommentExport = (commentId, format = 'comment-only') => {
                    console.log(`🎯 Export callback triggered: commentId=${commentId}, format=${format}`);
                    const comment = this.findCommentById(commentId);
                    console.log(`🔍 Found comment:`, !!comment, comment?.author);
                    if (comment) {
                        const video = this.currentVideo;
                        const videoTitle = video ? video.title : '';
                        console.log(`📹 Video title: ${videoTitle}`);
                        console.log(`🚀 Calling exportSingleCommentWithFormat...`);
                        try {
                            this.exportService.exportSingleCommentWithFormat(comment, format, videoTitle);
                        } catch (error) {
                            console.error(`❌ Export error:`, error);
                        }
                    } else {
                        console.error(`❌ Comment not found for ID: ${commentId}`);
                    }
                };
            }
            
            // Add back button handler for Instagram post view
            const backToGridBtn = document.getElementById('backToGrid');
            if (backToGridBtn) {
                backToGridBtn.addEventListener('click', () => {
                    this.hideVideoDetail();
                });
            }
            
            // Header search (if elements exist)
            if (this.elements.searchInput) {
                this.elements.searchInput.addEventListener('input', this.debounce(() => {
                    // Only trigger live search when NOT in video detail view
                    if (this.currentView !== 'video-detail') {
                        this.handleSearch();
                    }
                }, 300));

                // Enter key in search (works from any view)
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

            // Export single post comments with menu (using delegation)
            document.addEventListener('click', (e) => {
                if (e.target.matches('#exportSinglePostComments') || e.target.closest('#exportSinglePostComments')) {
                    e.preventDefault();
                    console.log('🔥 Export single post comments clicked via delegation!');
                    const button = e.target.closest('#exportSinglePostComments') || e.target;
                    this.showExportAllMenu(button, 'single-video');
                }
            });
            
            // Post Analytics toggle is set up in setupAnalyticsToggle() method
            this.setupAnalyticsToggle();
            
            // Analytics tab switching
            this.setupAnalyticsTabs();

            // Export all posts comments with menu (using delegation)
            document.addEventListener('click', (e) => {
                if (e.target.matches('#exportAllPostsComments') || e.target.closest('#exportAllPostsComments')) {
                    e.preventDefault();
                    console.log('🔥 Export all posts comments clicked via delegation!');
                    const button = e.target.closest('#exportAllPostsComments') || e.target;
                    this.showExportAllMenu(button, 'all-videos');
                }
            });
            
            // List view export buttons (delegated event listener)
            document.addEventListener('click', (e) => {
                if (e.target.matches('.export-post-btn') || e.target.closest('.export-post-btn')) {
                    e.preventDefault();
                    const button = e.target.closest('.export-post-btn');
                    const videoId = button.dataset.videoId;
                    if (videoId) {
                        this.showExportAllMenu(button, 'single-video', videoId);
                    }
                }
            });

            // List view post clicks (delegated event listener)
            document.addEventListener('click', (e) => {
                const listRow = e.target.closest('#videoListTable tbody tr[data-video-id]');
                if (listRow) {
                    // Only handle clicks on thumbnail or title, not export button
                    if (e.target.classList.contains('post-thumbnail') || 
                        e.target.classList.contains('post-title') ||
                        e.target.closest('.post-thumbnail') ||
                        e.target.closest('.post-title')) {
                        const videoId = listRow.dataset.videoId;
                        if (videoId) {
                            this.showVideoDetail(videoId);
                        }
                    }
                }
            });

            // Export progress close - cancel export
            document.addEventListener('click', (e) => {
                if (e.target.matches('.close-progress')) {
                    console.log('🛑 User clicked close - cancelling export');
                    this.cancelExport();
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

            // Export single comment button is now handled by CommentListComponent
            // This handler has been moved to prevent conflicts with the export menu

            // Insights tab switching
            document.addEventListener('click', (e) => {
                if (e.target.matches('[data-tab]')) {
                    e.preventDefault();
                    this.switchInsightTab(e.target.dataset.tab);
                }
            });

            // List view sortable headers
            document.addEventListener('click', (e) => {
                if (e.target.matches('.sortable-header') || e.target.closest('.sortable-header')) {
                    e.preventDefault();
                    const header = e.target.closest('.sortable-header');
                    const sortField = header.dataset.sort;
                    this.handleListSort(sortField);
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
            
            if (this.currentViewMode === 'grid') {
                this.renderVideoGrid(result.videos);
                this.renderPagination(result);
            } else {
                this.renderVideoList(result.videos);
                this.renderListPagination(result);
            }
            
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
        if (this.videoGridComponent) {
            // Use the VideoGridComponent for Instagram-style grid
            this.videoGridComponent.render(videos);
        } else {
            // Fallback to old method if component not initialized
            const html = videos.map(video => this.createVideoCard(video)).join('');
            this.elements.videoGrid.innerHTML = html;
        }
    }

    /**
     * Switch to grid view
     */
    switchToGridView() {
        this.currentViewMode = 'grid';
        this.elements.videoGridView.style.display = 'block';
        this.elements.videoListView.style.display = 'none';
    }

    /**
     * Switch to list view
     */
    switchToListView() {
        this.currentViewMode = 'list';
        this.elements.videoGridView.style.display = 'none';
        this.elements.videoListView.style.display = 'block';
        this.updateSortHeaders(); // Initialize sort header indicators
        this.loadVideoList();
    }

    /**
     * Load and display video list
     */
    async loadVideoList() {
        try {
            const filters = {
                ...this.currentFilters,
                search: this.elements.searchInput.value
            };
            
            const result = await this.dataManager.getVideos(filters, this.currentPagination);
            
            // Apply custom list sorting
            const sortedVideos = this.sortVideosByListCriteria(result.videos);
            
            this.renderVideoList(sortedVideos);
            this.renderListPagination(result);
            this.updateResultCount(result.total);
            
        } catch (error) {
            console.error('❌ Failed to load video list:', error);
            this.showError('Failed to load video list');
        }
    }

    /**
     * Sort videos based on list view criteria
     */
    sortVideosByListCriteria(videos) {
        const { field, direction } = this.currentListSort;
        
        return [...videos].sort((a, b) => {
            let valueA, valueB;
            
            switch (field) {
                case 'date':
                    valueA = new Date(a.published_at).getTime();
                    valueB = new Date(b.published_at).getTime();
                    break;
                case 'likes':
                    valueA = a.like_count || 0;
                    valueB = b.like_count || 0;
                    break;
                case 'comments':
                    valueA = a.comment_count || 0;
                    valueB = b.comment_count || 0;
                    break;
                case 'views':
                    valueA = a.view_count || 0;
                    valueB = b.view_count || 0;
                    break;
                default:
                    return 0;
            }
            
            if (direction === 'asc') {
                return valueA > valueB ? 1 : valueA < valueB ? -1 : 0;
            } else {
                return valueA < valueB ? 1 : valueA > valueB ? -1 : 0;
            }
        });
    }

    /**
     * Render video list table
     */
    renderVideoList(videos) {
        if (!this.elements.videoListBody) return;
        
        const html = videos.map(video => this.createVideoListRow(video)).join('');
        this.elements.videoListBody.innerHTML = html;
        
        // Note: Click handlers are set up via event delegation in setupEventListeners
    }

    /**
     * Create video list row HTML
     */
    createVideoListRow(video) {
        const date = new Date(video.published_at).toLocaleDateString();
        const likes = this.formatNumber(video.like_count || 0);
        const comments = this.formatNumber(video.comment_count || 0);
        const views = this.formatNumber(video.view_count || 0);
        
        // Get thumbnail from media files
        let thumbnailSrc = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIGZpbGw9IiNGOEY5RkEiLz48dGV4dCB4PSIzMCIgeT0iMzAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuMzVlbSIgZm9udC1zaXplPSIxMiIgZmlsbD0iIzZDNzU3RCI+TG9hZGluZy4uLjwvdGV4dD48L3N2Zz4=';
        
        if (video.media_files && video.media_files.length > 0) {
            const firstMedia = video.media_files[0];
            if (firstMedia.type === 'video' && firstMedia.thumbnail) {
                thumbnailSrc = `instadata/posts/${firstMedia.thumbnail}`;
            } else if (firstMedia.type === 'image') {
                thumbnailSrc = `instadata/posts/${firstMedia.filename}`;
            }
        }
        
        return `
            <tr data-video-id="${video.video_id}">
                <td class="post-thumbnail-col">
                    <img src="${thumbnailSrc}" 
                         alt="${this.escapeHTML(video.title)}" 
                         class="post-thumbnail"
                         onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIGZpbGw9IiNFOUVDRUYiLz48dGV4dCB4PSIzMCIgeT0iMzAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuMzVlbSIgZm9udC1zaXplPSIxMCIgZmlsbD0iIzZDNzU3RCI+Tm8gSW1hZ2U8L3RleHQ+PC9zdmc+'">
                </td>
                <td class="post-title-col">
                    <div class="post-title" title="${this.escapeHTML(video.title)}">
                        ${this.escapeHTML(video.title)}
                    </div>
                </td>
                <td class="text-center">
                    <div class="post-date">${date}</div>
                </td>
                <td class="text-center">
                    <div class="post-stats">${likes}</div>
                </td>
                <td class="text-center">
                    <div class="post-stats">${comments}</div>
                </td>
                <td class="text-center">
                    <div class="post-stats">${views}</div>
                </td>
                <td class="text-center">
                    <button class="btn btn-outline-primary btn-sm export-post-btn" data-video-id="${video.video_id}">
                        <i class="bi bi-download"></i> Export
                    </button>
                </td>
            </tr>
        `;
    }

    /**
     * Render list view pagination
     */
    renderListPagination(result) {
        if (!this.elements.videoListPagination) return;
        
        let html = '';
        const currentPage = result.page;
        const totalPages = result.totalPages;
        
        // Previous button
        if (result.hasPrev) {
            html += `<li class="page-item"><a class="page-link" href="#" data-page="${currentPage - 1}">Previous</a></li>`;
        } else {
            html += `<li class="page-item disabled"><span class="page-link">Previous</span></li>`;
        }
        
        // Page numbers (simplified for list view)
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, currentPage + 2);
        
        for (let i = startPage; i <= endPage; i++) {
            if (i === currentPage) {
                html += `<li class="page-item active"><span class="page-link">${i}</span></li>`;
            } else {
                html += `<li class="page-item"><a class="page-link" href="#" data-page="${i}">${i}</a></li>`;
            }
        }
        
        // Next button
        if (result.hasNext) {
            html += `<li class="page-item"><a class="page-link" href="#" data-page="${currentPage + 1}">Next</a></li>`;
        } else {
            html += `<li class="page-item disabled"><span class="page-link">Next</span></li>`;
        }
        
        this.elements.videoListPagination.innerHTML = html;
        
        // Add click handlers
        this.elements.videoListPagination.addEventListener('click', (e) => {
            if (e.target.matches('[data-page]')) {
                e.preventDefault();
                this.currentPagination.page = parseInt(e.target.dataset.page);
                this.loadVideoList();
            }
        });
    }

    /**
     * Get reliable YouTube thumbnail with fallback logic
     */
    getYouTubeThumbnail(videoId) {
        // Create img element to test thumbnail availability
        const img = document.createElement('img');
        
        // Try maxresdefault first, fallback to hqdefault if it fails
        const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        
        // Return a promise that resolves to a working thumbnail URL
        return new Promise((resolve) => {
            img.onload = () => {
                // Check if it's a real thumbnail (maxresdefault has min dimensions)
                if (img.naturalWidth > 120) {
                    resolve(thumbnailUrl);
                } else {
                    // Fallback to hqdefault
                    resolve(`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`);
                }
            };
            
            img.onerror = () => {
                // Fallback to hqdefault
                resolve(`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`);
            };
            
            img.src = thumbnailUrl;
        });
    }

    /**
     * Create video card HTML with reliable thumbnails
     */
    createVideoCard(video) {
        const date = new Date(video.published_at).toLocaleDateString();
        const views = this.formatNumber(video.view_count);
        const comments = this.formatNumber(video.comment_count);
        
        // Use data attributes to handle thumbnail loading
        const cardId = `video-card-${video.video_id}`;
        
        const cardHtml = `
            <div class="col-md-6 col-lg-4 col-xl-3">
                <div class="card video-card" data-video-id="${video.video_id}" id="${cardId}">
                    <div class="video-thumbnail">
                        <img class="card-img-top thumbnail-img" alt="${video.title}" loading="lazy" 
                             data-video-id="${video.video_id}"
                             src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjE4MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjhmOWZhIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzZjNzU3ZCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkxvYWRpbmcuLi48L3RleHQ+PC9zdmc+"
                             style="min-height: 180px; background-color: #f8f9fa;">
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
        
        // Load thumbnail asynchronously after DOM insertion
        setTimeout(() => this.loadVideoThumbnail(video.video_id), 0);
        
        return cardHtml;
    }

    /**
     * Load thumbnail for a specific video with fallback logic
     */
    async loadVideoThumbnail(videoId) {
        const img = document.querySelector(`[data-video-id="${videoId}"].thumbnail-img`);
        if (!img) return;
        
        // List of thumbnail URLs to try in order of preference
        const thumbnailUrls = [
            `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
            `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
            `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
            `https://img.youtube.com/vi/${videoId}/default.jpg`
        ];
        
        for (const url of thumbnailUrls) {
            try {
                const success = await this.testThumbnailUrl(url);
                if (success) {
                    img.src = url;
                    img.style.minHeight = 'auto';
                    return;
                }
            } catch (error) {
                continue;
            }
        }
        
        // If all fail, show a placeholder
        img.src = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjE4MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZTllY2VmIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzZjNzU3ZCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIFRodW1ibmFpbDwvdGV4dD48L3N2Zz4=";
        img.style.minHeight = '180px';
    }

    /**
     * Test if a thumbnail URL is valid and available
     */
    testThumbnailUrl(url) {
        return new Promise((resolve) => {
            const img = new Image();
            
            img.onload = () => {
                // Check if it's a valid thumbnail (not a placeholder)
                // YouTube placeholder images are typically 120x90
                if (img.naturalWidth > 120 && img.naturalHeight > 90) {
                    resolve(true);
                } else {
                    resolve(false);
                }
            };
            
            img.onerror = () => resolve(false);
            
            // Set a timeout to avoid hanging
            setTimeout(() => resolve(false), 3000);
            
            img.src = url;
        });
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
            
            // Scroll to top when showing video detail
            window.scrollTo({ top: 0, behavior: 'smooth' });
            
            // Update UI - hide both grid and list views
            this.elements.videoGridView.style.display = 'none';
            this.elements.videoListView.style.display = 'none';
            this.elements.videoDetailView.style.display = 'block';
            
            // Add single post mode class to remove app padding
            document.getElementById('app').classList.add('single-post-mode');
            
            // Hide channel navigation tools and stats bar
            document.getElementById('channel-navigation').style.display = 'none';
            document.getElementById('statsBarContainer').style.display = 'none';
            
            
            // Load video
            await this.videoPlayer.loadVideo(video, this.dataManager);
            
            // Update video info
            this.updateVideoInfo(video);
            
            // Load comments
            this.currentCommentPagination = { page: 1, limit: 50 };
            await this.loadComments();
            
            // Generate and show insights
            await this.generateCommentInsights();
            
            // Set up post analytics toggle (in case it wasn't set up during initial load)
            this.setupAnalyticsToggle();
            
        } catch (error) {
            console.error('❌ Failed to show video detail:', error);
            this.showError('Failed to load video');
        }
    }
    
    /**
     * Set up analytics toggle event listener
     */
    setupAnalyticsToggle() {
        const postAnalyticsToggle = document.getElementById('postAnalyticsToggle');
        if (postAnalyticsToggle && !postAnalyticsToggle.hasAttribute('data-listener-added')) {
            console.log('🔧 Setting up analytics toggle event listener');
            postAnalyticsToggle.addEventListener('click', (e) => {
                console.log('🔥 Analytics toggle clicked!');
                e.preventDefault();
                e.stopPropagation();
                this.toggleAnalyticsPanel();
            });
            postAnalyticsToggle.setAttribute('data-listener-added', 'true');
        } else if (!postAnalyticsToggle) {
            console.warn('⚠️ Analytics toggle not found');
        } else {
            console.log('ℹ️ Analytics toggle listener already exists');
        }
    }
    
    /**
     * Toggle analytics panel visibility
     */
    async toggleAnalyticsPanel() {
        console.log('🔥 toggleAnalyticsPanel called');
        
        // Prevent multiple rapid calls
        if (this.isTogglingAnalytics) {
            console.log('🚫 Analytics toggle already in progress');
            return;
        }
        this.isTogglingAnalytics = true;
        
        if (!this.currentVideo) {
            console.log('❌ No current video');
            this.isTogglingAnalytics = false;
            return;
        }
        
        const toggle = document.getElementById('postAnalyticsToggle');
        const panel = document.getElementById('analyticsPanel');
        
        if (!toggle) {
            console.error('❌ Analytics toggle not found');
            this.isTogglingAnalytics = false;
            return;
        }
        if (!panel) {
            console.error('❌ Analytics panel not found');
            this.isTogglingAnalytics = false;
            return;
        }
        
        const icon = toggle.querySelector('.toggle-icon');
        
        const isExpanded = toggle.getAttribute('data-expanded') === 'true';
        console.log('📊 Current expanded state:', isExpanded);
        
        if (isExpanded) {
            // Hide panel
            console.log('🔽 Hiding analytics panel');
            panel.style.display = 'none';
            toggle.setAttribute('data-expanded', 'false');
            if (icon) icon.classList.remove('rotated');
        } else {
            // Show panel and load analytics
            console.log('🔼 Showing analytics panel');
            panel.style.display = 'block';
            toggle.setAttribute('data-expanded', 'true');
            if (icon) icon.classList.add('rotated');
            
            // Load analytics data
            try {
                await this.loadAnalyticsData();
                console.log('✅ Analytics data loaded successfully');
            } catch (error) {
                console.error('❌ Failed to load analytics data:', error);
            }
        }
        
        // Reset the toggle flag
        this.isTogglingAnalytics = false;
    }
    
    /**
     * Set up analytics tab switching
     */
    setupAnalyticsTabs() {
        document.addEventListener('click', (e) => {
            if (e.target.closest('.analytics-tab')) {
                const tab = e.target.closest('.analytics-tab');
                const tabName = tab.getAttribute('data-tab');
                this.switchAnalyticsTab(tabName);
            }
        });
    }
    
    /**
     * Switch between analytics tabs
     */
    switchAnalyticsTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.analytics-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        
        // Show/hide tab content
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('active');
        });
        document.getElementById(`${tabName}Tab`).classList.add('active');
    }
    
    /**
     * Load all analytics data
     */
    async loadAnalyticsData() {
        try {
            console.log('📊 Loading analytics data for:', this.currentVideo.video_id);
            
            const comments = await this.dataManager.getAllComments(this.currentVideo.video_id, {});
            const flatComments = this.flattenComments(comments);
            
            if (flatComments.length === 0) {
                console.warn('No comments found for analytics');
                return;
            }
            
            // Load frequent words
            const wordFreq = this.analyzeWordFrequency(flatComments);
            this.renderAnalyticsWordCloud(wordFreq);
            
            // Load liked words
            const likedWords = this.analyzeLikedCommentWords(flatComments);
            this.renderAnalyticsLikedWords(likedWords);
            
            // Load sentiment analysis
            const sentimentData = this.analyzeSentiment(flatComments);
            this.renderSentimentAnalysis(sentimentData);
            
            // Load themes analysis
            const themesData = this.analyzeThemes(flatComments);
            this.renderThemesAnalysis(themesData);
            
        } catch (error) {
            console.error('❌ Error loading analytics data:', error);
        }
    }
    
    /**
     * Render word cloud in analytics panel
     */
    renderAnalyticsWordCloud(wordFreq) {
        const container = document.getElementById('analyticsWordCloud');
        if (!container) return;
        
        if (wordFreq.length === 0) {
            container.innerHTML = '<div class="text-muted">No word data available</div>';
            return;
        }
        
        // Calculate sizes based on frequency
        const maxCount = Math.max(...wordFreq.map(w => w.count));
        const minCount = Math.min(...wordFreq.map(w => w.count));
        
        const html = wordFreq.slice(0, 15).map(({ word, count }) => {
            const relativeSize = minCount === maxCount ? 2 : 
                Math.round(1 + (count - minCount) / (maxCount - minCount) * 3);
                
            return `<span class="analytics-word-item size-${relativeSize}" title="${count} mentions">
                ${word} <span style="opacity: 0.7;">${count}</span>
            </span>`;
        }).join('');
        
        container.innerHTML = html;
    }
    
    /**
     * Render liked words in analytics panel
     */
    renderAnalyticsLikedWords(likedWords) {
        const container = document.getElementById('analyticsLikedWords');
        if (!container) return;
        
        if (likedWords.length === 0) {
            container.innerHTML = '<div class="text-muted">No liked word data available</div>';
            return;
        }
        
        const html = likedWords.slice(0, 12).map(({ word, avgLikes, count }, index) => {
            // Determine size based on position (like word cloud)
            let sizeClass = 'size-3'; // default
            if (index === 0) sizeClass = 'size-5';
            else if (index === 1) sizeClass = 'size-4';
            else if (index < 4) sizeClass = 'size-3';
            else if (index < 8) sizeClass = 'size-2';
            else sizeClass = 'size-1';
            
            return `<span class="analytics-word-item ${sizeClass}" title="Average ${Math.round(avgLikes)} likes in ${count} comments">
                ${word}<span class="word-count">${Math.round(avgLikes)}</span>
            </span>`;
        }).join('');
        
        container.innerHTML = html;
    }
    
    /**
     * Analyze comment sentiment (improved)
     */
    analyzeSentiment(comments) {
        const sentiments = {
            positive: { count: 0, words: ['amazing', 'love', 'thank', 'great', 'wonderful', 'fantastic', 'incredible', 'awesome', 'perfect', 'blessed'] },
            grateful: { count: 0, words: ['grateful', 'thankful', 'bless', 'appreciate', 'thank you', 'thanks'] },
            healing: { count: 0, words: ['healing', 'better', 'improved', 'recovery', 'healed', 'relief', 'helped'] },
            questioning: { count: 0, words: ['?', 'how', 'what', 'when', 'where', 'why', 'can you', 'could you'] }
        };
        
        comments.forEach(comment => {
            const text = (comment.content || comment.text || '').toLowerCase();
            
            Object.keys(sentiments).forEach(sentiment => {
                sentiments[sentiment].words.forEach(word => {
                    if (text.includes(word)) {
                        sentiments[sentiment].count++;
                    }
                });
            });
        });
        
        const total = comments.length;
        return {
            positive: Math.round((sentiments.positive.count / total) * 100),
            grateful: Math.round((sentiments.grateful.count / total) * 100),
            healing: Math.round((sentiments.healing.count / total) * 100),
            questioning: Math.round((sentiments.questioning.count / total) * 100)
        };
    }
    
    /**
     * Render sentiment analysis
     */
    renderSentimentAnalysis(sentimentData) {
        const container = document.getElementById('sentimentAnalysis');
        if (!container) return;
        
        const html = `
            <div class="sentiment-grid">
                <div class="sentiment-item">
                    <span class="sentiment-emoji">😍</span>
                    <div class="sentiment-label">Positive</div>
                    <div class="sentiment-percentage">${sentimentData.positive}%</div>
                </div>
                <div class="sentiment-item">
                    <span class="sentiment-emoji">🙏</span>
                    <div class="sentiment-label">Grateful</div>
                    <div class="sentiment-percentage">${sentimentData.grateful}%</div>
                </div>
                <div class="sentiment-item">
                    <span class="sentiment-emoji">💚</span>
                    <div class="sentiment-label">Healing</div>
                    <div class="sentiment-percentage">${sentimentData.healing}%</div>
                </div>
                <div class="sentiment-item">
                    <span class="sentiment-emoji">❓</span>
                    <div class="sentiment-label">Questions</div>
                    <div class="sentiment-percentage">${sentimentData.questioning}%</div>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
    }
    
    /**
     * Analyze themes (improved)
     */
    analyzeThemes(comments) {
        const themes = {
            'Recipe Requests': { count: 0, keywords: ['recipe', 'how to make', 'ingredients', 'link'] },
            'Health Questions': { count: 0, keywords: ['how long', 'dosage', 'how much', 'safe', 'pregnancy'] },
            'Success Stories': { count: 0, keywords: ['helped', 'better', 'improved', 'healed', 'working', 'results'] },
            'Protocol Questions': { count: 0, keywords: ['celery juice', 'heavy metal', 'detox', 'protocol', 'supplements'] },
            'Gratitude': { count: 0, keywords: ['thank you', 'grateful', 'bless', 'saved my life', 'appreciate'] }
        };
        
        comments.forEach(comment => {
            const text = (comment.content || comment.text || '').toLowerCase();
            
            Object.keys(themes).forEach(theme => {
                themes[theme].keywords.forEach(keyword => {
                    if (text.includes(keyword)) {
                        themes[theme].count++;
                    }
                });
            });
        });
        
        // Convert to array and sort by count
        return Object.entries(themes)
            .map(([name, data]) => ({ name, count: data.count }))
            .sort((a, b) => b.count - a.count)
            .filter(theme => theme.count > 0);
    }
    
    /**
     * Render themes analysis
     */
    renderThemesAnalysis(themesData) {
        const container = document.getElementById('themesAnalysis');
        if (!container) return;
        
        if (themesData.length === 0) {
            container.innerHTML = '<div class="text-muted">No themes identified</div>';
            return;
        }
        
        const html = themesData.slice(0, 6).map(theme => {
            const descriptions = {
                'Recipe Requests': 'People asking for recipes and preparation instructions',
                'Health Questions': 'Questions about dosages, safety, and usage',
                'Success Stories': 'Positive healing experiences and results',
                'Protocol Questions': 'Questions about MM protocols and methods',
                'Gratitude': 'Expressions of thanks and appreciation'
            };
            
            return `
                <div class="theme-item">
                    <span class="theme-count">${theme.count}</span>
                    <div class="theme-title">${theme.name}</div>
                    <div class="theme-description">${descriptions[theme.name] || 'Related discussion topics'}</div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = html;
    }

    /**
     * Hide video detail view and return to grid
     */
    hideVideoDetail() {
        this.showVideoGrid();
    }

    /**
     * Show video grid view
     */
    showVideoGrid() {
        this.currentView = 'videos';
        this.currentVideo = null;
        
        this.elements.videoDetailView.style.display = 'none';
        
        // Restore the correct view mode (grid or list)
        if (this.currentViewMode === 'grid') {
            this.elements.videoGridView.style.display = 'block';
            this.elements.videoListView.style.display = 'none';
        } else {
            this.elements.videoGridView.style.display = 'none';
            this.elements.videoListView.style.display = 'block';
        }
        
        // Remove single post mode class to restore app padding
        document.getElementById('app').classList.remove('single-post-mode');
        
        // Show channel navigation tools and stats bar
        document.getElementById('channel-navigation').style.display = 'flex';
        document.getElementById('statsBarContainer').style.display = 'flex';
        
        
        // Clean up video player
        if (this.videoPlayer) {
            this.videoPlayer.destroy();
        }
    }

    /**
     * Update video info display
     */
    updateVideoInfo(video) {
        // Update date (Instagram style - relative time)
        if (this.elements.videoDate) {
            const date = new Date(video.published_at);
            const now = new Date();
            const diffTime = Math.abs(now - date);
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            
            let timeText;
            if (diffDays < 1) {
                timeText = 'Today';
            } else if (diffDays < 7) {
                timeText = `${diffDays}d`;
            } else if (diffDays < 30) {
                timeText = `${Math.floor(diffDays / 7)}w`;
            } else {
                const formattedDate = (date.getMonth() + 1) + '/' + date.getDate() + '/' + date.getFullYear();
                timeText = formattedDate;
            }
            
            this.elements.videoDate.textContent = timeText;
        }
        
        // Update likes count (Instagram shows likes, not views)
        if (this.elements.videoViews) {
            this.elements.videoViews.textContent = this.formatNumber(video.like_count || video.view_count);
        }
        
        // Update description/caption in the sidebar
        if (this.elements.videoDescription) {
            const description = video.description || '';
            this.elements.videoDescription.innerHTML = this.escapeHTML(description).replace(/\n/g, '<br>');
        }
        
        // Update caption as first comment (Instagram style)
        const captionDescElement = document.querySelector('#captionComment #videoDescription');
        if (captionDescElement) {
            const caption = video.caption || video.description || '';
            captionDescElement.innerHTML = this.escapeHTML(caption).replace(/\n/g, '<br>');
        }
        
        // Update profile pictures - use the local avatar image
        const avatarPath = 'MMCommentExplorer.webp';
        
        // Update caption profile picture
        const captionProfileImg = document.querySelector('#captionComment .profile-avatar img');
        if (captionProfileImg) {
            captionProfileImg.src = avatarPath;
        }
        
        // Update post header profile picture
        const headerProfileImg = document.querySelector('.post-meta-header .profile-avatar img');
        if (headerProfileImg) {
            headerProfileImg.src = avatarPath;
        }
        
        // Update caption time
        if (this.elements.captionTime) {
            const date = new Date(video.published_at);
            const now = new Date();
            const diffTime = Math.abs(now - date);
            const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            
            let timeText;
            if (diffHours < 1) {
                timeText = 'now';
            } else if (diffHours < 24) {
                timeText = `${diffHours}h`;
            } else if (diffDays < 7) {
                timeText = `${diffDays}d`;
            } else if (diffDays < 30) {
                timeText = `${Math.floor(diffDays / 7)}w`;
            } else {
                timeText = `${Math.floor(diffDays / 30)}mo`;
            }
            
            this.elements.captionTime.textContent = timeText;
        }
    }

    /**
     * Load comments for current video
     */
    async loadComments() {
        if (!this.currentVideo) return;

        try {
            const filters = {
                search: this.elements.commentSearch?.value || '',
                sortBy: this.elements.commentSort?.value || 'likes-desc'
            };
            
            console.log(`Loading comments for ${this.currentVideo.video_id}...`);
            
            // Load all comments at once for better UX
            const allComments = await this.dataManager.getAllComments(this.currentVideo.video_id, filters);
            
            console.log(`Loaded ${allComments.length} comments for ${this.currentVideo.video_id}`);
            
            this.renderComments(allComments);
            
            // Update comments title with total count
            const commentsTitle = document.getElementById('commentsTitle');
            if (commentsTitle) {
                const totalCount = allComments.length;
                commentsTitle.textContent = `Comments (${totalCount})`;
            }
            
            // Hide load more button since we're loading all comments
            if (this.elements.loadMoreComments) {
                this.elements.loadMoreComments.style.display = 'none';
            }
            
        } catch (error) {
            console.error('❌ Failed to load comments:', error);
            this.showError('Failed to load comments');
        }
    }

    /**
     * Render comments list
     */
    renderComments(comments) {
        if (this.commentListComponent) {
            // Use the CommentListComponent for proper Instagram-style comments
            this.commentListComponent.render(comments);
        } else {
            // Fallback to manual rendering
            const html = comments.map(comment => this.createCommentCard(comment)).join('');
            this.elements.commentsList.innerHTML = html;
        }
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
    async exportVideoComments(format = 'comment-only', videoId = null) {
        // Use provided videoId or fallback to current video
        const targetVideoId = videoId || (this.currentVideo ? this.currentVideo.video_id : null);
        if (!targetVideoId) {
            this.showError('No video selected for export');
            return;
        }
        
        try {
            this.showExportProgress('single');
            
            await this.exportService.exportVideoComments(
                targetVideoId,
                this.dataManager,
                (progress) => {
                    this.updateExportProgress(progress, 'single');
                },
                format
            );
            
            // Close overlay after successful export
            this.hideExportProgress();
            
        } catch (error) {
            console.error('❌ Export failed:', error);
            if (error.message && error.message.includes('cancelled')) {
                // Don't show error for user-cancelled exports
                console.log('Export cancelled by user');
            } else {
                this.showError('Failed to export comments');
            }
            this.hideExportProgress();
        }
    }

    /**
     * Export comments for all videos
     */
    async exportAllVideosComments(format = 'comment-only') {
        try {
            this.showExportProgress('all');
            
            await this.exportService.exportAllVideos(
                this.dataManager,
                (progress) => {
                    this.updateExportProgress(progress, 'all');
                },
                format
            );
            
            // Close overlay after successful export
            this.hideExportProgress();
            
        } catch (error) {
            console.error('❌ Export failed:', error);
            if (error.message && error.message.includes('cancelled')) {
                // Don't show error for user-cancelled exports
                console.log('Export cancelled by user');
            } else {
                this.showError('Failed to export all videos');
            }
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
     * Cancel the current export operation
     */
    cancelExport() {
        if (this.exportService) {
            this.exportService.cancelExport();
        }
        this.hideExportProgress();
        this.showError('Export cancelled by user', 2000);
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
        // If we're in video detail view, return to video grid first
        if (this.currentView === 'video-detail') {
            this.showVideoGrid();
        }
        
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
     * Handle list view sorting
     */
    handleListSort(field) {
        // Toggle direction if clicking the same field
        if (this.currentListSort.field === field) {
            this.currentListSort.direction = this.currentListSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            // New field - default to descending for most fields, ascending for date
            this.currentListSort.field = field;
            this.currentListSort.direction = field === 'date' ? 'desc' : 'desc';
        }

        // Update header visual indicators
        this.updateSortHeaders();

        // Re-load the list view with new sorting
        this.loadVideoList();
    }

    /**
     * Update sort header visual indicators
     */
    updateSortHeaders() {
        const headers = document.querySelectorAll('.sortable-header');
        headers.forEach(header => {
            header.classList.remove('sort-asc', 'sort-desc');
            if (header.dataset.sort === this.currentListSort.field) {
                header.classList.add(`sort-${this.currentListSort.direction}`);
            }
        });
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
        this.elements.resultCount.textContent = `${this.formatNumber(count)} posts`;
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
     * Show export format menu for bulk export buttons
     */
    showExportAllMenu(button, exportType, videoId = null) {
        // Hide any existing menu
        this.hideExportAllMenu();
        
        // Store video ID for list view exports
        this.currentExportVideoId = videoId;

        // Create menu
        const menu = document.createElement('div');
        menu.className = 'export-menu';
        menu.innerHTML = `
            <div class="export-menu-option" data-format="comment-only" data-export-type="${exportType}">
                <span>Export comment only</span>
            </div>
            <div class="export-menu-option" data-format="iphone-dark" data-export-type="${exportType}">
                <span>Export iPhone dark</span>
            </div>
            <div class="export-menu-option" data-format="iphone-light" data-export-type="${exportType}">
                <span>Export iPhone light</span>
            </div>
        `;

        // Position menu relative to button
        const buttonRect = button.getBoundingClientRect();
        menu.style.position = 'fixed';
        menu.style.top = (buttonRect.bottom + 5) + 'px';
        menu.style.left = (buttonRect.left - 50) + 'px';
        menu.style.zIndex = '1000';

        // Add menu to body
        document.body.appendChild(menu);

        // Add click handlers for menu options
        menu.addEventListener('click', (e) => {
            const option = e.target.closest('.export-menu-option');
            if (option) {
                const format = option.dataset.format;
                const exportType = option.dataset.exportType;
                this.handleExportAllFormat(exportType, format);
                this.hideExportAllMenu();
            }
        });

        // Close menu when clicking outside
        document.addEventListener('click', this.handleExportMenuClickOutside);
    }

    /**
     * Hide export all menu
     */
    hideExportAllMenu() {
        const existingMenu = document.querySelector('.export-menu');
        if (existingMenu) {
            existingMenu.remove();
        }
        document.removeEventListener('click', this.handleExportMenuClickOutside);
    }

    /**
     * Handle clicking outside export menu
     */
    handleExportMenuClickOutside = (e) => {
        if (!e.target.closest('.export-menu') && !e.target.closest('button[id*="export"]')) {
            this.hideExportAllMenu();
        }
    }

    /**
     * Handle export format selection for bulk exports
     */
    handleExportAllFormat(exportType, format) {
        console.log(`Bulk export type: ${exportType}, format: ${format}, videoId: ${this.currentExportVideoId}`);
        
        // Store the selected format for use in the export process
        this.bulkExportFormat = format;
        
        if (exportType === 'single-video') {
            // Use stored video ID for list view exports, or current video for detail view
            const videoId = this.currentExportVideoId || (this.currentVideo ? this.currentVideo.video_id : null);
            if (videoId) {
                this.exportVideoComments(format, videoId);
            } else {
                this.showError('No video selected for export');
            }
        } else if (exportType === 'all-videos') {
            this.exportAllVideosComments(format);
        }
    }

    /**
     * Show success message
     */
    showSuccess(message, duration = 3000) {
        // Remove any existing toasts
        const existingToasts = document.querySelectorAll('.toast');
        existingToasts.forEach(toast => toast.remove());
        
        // Create toast element
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        
        // Add to page
        document.body.appendChild(toast);
        
        // Remove after duration
        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease-out forwards';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    /**
     * Show success toast notification
     */
    showSuccessToast(message, duration = 3000) {
        // Remove any existing toasts
        const existingToasts = document.querySelectorAll('.toast');
        existingToasts.forEach(toast => toast.remove());
        
        // Create toast element
        const toast = document.createElement('div');
        toast.className = 'toast success';
        toast.innerHTML = `
            <i class="bi bi-check-circle-fill"></i>
            <span>${message}</span>
        `;
        
        // Add to page
        document.body.appendChild(toast);
        
        // Remove after duration
        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease-out forwards';
            setTimeout(() => toast.remove(), 300);
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
                this.renderMiniWordCloud(preComputed.word_cloud.slice(0, 7)); // Show top 7 words in mini cloud
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
            this.renderMiniWordCloud(wordFreq.slice(0, 7)); // Show top 7 words in mini cloud
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
            const text = comment.text || comment.content || '';
            const words = text.toLowerCase()
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
            const text = comment.text || comment.content || '';
            const words = text.toLowerCase()
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
     * Render mini word cloud above analytics button
     */
    renderMiniWordCloud(wordFreq) {
        const miniWordCloudElement = document.getElementById('miniWordCloud');
        if (!miniWordCloudElement) return;
        
        if (wordFreq.length === 0) {
            miniWordCloudElement.innerHTML = '<div class="text-muted text-center small">No data</div>';
            return;
        }

        // Start with initial render to measure
        this.renderMiniWordCloudContent(miniWordCloudElement, wordFreq, 7);
        
        // Check if content overflows and adjust if needed
        this.adjustMiniWordCloudSize(miniWordCloudElement, wordFreq);
        
        // Add click handlers to word items
        miniWordCloudElement.querySelectorAll('.mini-word-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const word = e.target.closest('.mini-word-item').dataset.word;
                if (word) {
                    // Set the search term in the comment search box
                    const searchInput = document.getElementById('commentSearch');
                    if (searchInput) {
                        searchInput.value = word;
                        // Trigger the search
                        const event = new Event('input', { bubbles: true });
                        searchInput.dispatchEvent(event);
                    }
                }
            });
        });
    }

    /**
     * Render mini word cloud content with specified number of words
     */
    renderMiniWordCloudContent(container, wordFreq, maxWords) {
        const words = wordFreq.slice(0, maxWords);
        
        const html = words.map(({ word, count }) => {
            // Truncate long words to prevent overflow
            const displayWord = word.length > 12 ? word.substring(0, 12) + '...' : word;
            const title = word.length > 12 ? `"${word}" - ${count} mentions` : `${count} mentions`;
            
            return `<span class="mini-word-item" title="${title}" data-word="${word}" style="cursor: pointer;">
                ${this.escapeHTML(displayWord)} <span class="count">${count}</span>
            </span>`;
        }).join('');

        container.innerHTML = html;
    }

    /**
     * Adjust mini word cloud size to fit container
     */
    adjustMiniWordCloudSize(container, wordFreq) {
        const maxAttempts = 3;
        let attempts = 0;
        let currentWordCount = 7;
        
        while (attempts < maxAttempts && currentWordCount > 3) {
            // Check if content overflows
            if (container.scrollWidth > container.clientWidth) {
                // Reduce number of words
                currentWordCount--;
                this.renderMiniWordCloudContent(container, wordFreq, currentWordCount);
                attempts++;
            } else {
                // Content fits, we're done
                break;
            }
        }
        
        // If still overflowing after reducing words, make font smaller
        if (container.scrollWidth > container.clientWidth) {
            container.style.fontSize = '0.75rem';
            
            // One more check - if still overflowing, make even smaller
            if (container.scrollWidth > container.clientWidth) {
                container.style.fontSize = '0.7rem';
            }
        }
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
    
    /**
     * Extract question from comment
     */
    extractQuestion(content) {
        const sentences = content.split(/[.!?]+/);
        const question = sentences.find(s => s.includes('?')) || sentences[0];
        return question.trim() + (question.includes('?') ? '' : '?');
    }
    
    /**
     * Extract main topic from caption
     */
    extractTopic(caption) {
        // Look for Medical Medium specific topics
        const topics = ['Heavy Metal Detox', 'Celery Juice', 'Liver Rescue', 'Brain Saver', 'Aloe Vera', 'Wild Blueberries'];
        for (const topic of topics) {
            if (caption.toLowerCase().includes(topic.toLowerCase())) {
                return topic;
            }
        }
        // Return first few words as fallback
        return caption.split(' ').slice(0, 3).join(' ');
    }
    
    /**
     * Truncate text helper
     */
    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substr(0, maxLength) + '...';
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ArchiveExplorer();
});

// Export for use in other modules
window.ArchiveExplorer = ArchiveExplorer; 