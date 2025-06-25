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
        this.isListView = false;
        this.listViewSort = { field: 'date', direction: 'desc' };
        
        // Cached data
        this.keywordsCache = null;
        
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
            
            // YouTube Explorer: Skip login but show mode selection (YouTube vs Local Archive)
            this.showModeSelection();
            
            // Set up interactive gradient backgrounds
            this.setupInteractiveGradients();
            
        } catch (error) {
            console.error('❌ Failed to initialize app:', error);
            this.showError('Failed to load the archive. Please refresh the page.');
            // Prevent infinite loop by not calling showModeSelection again
            return;
        }
    }

    // YouTube-only version: Login/password methods removed
    /**
     * Set up interactive gradient backgrounds
     */
    setupInteractiveGradients() {
        const directoryModal = document.getElementById('directorySelectionModal');
        
        // Add mouse movement listeners to the modal
        if (directoryModal) {
            directoryModal.addEventListener('mousemove', (e) => {
                // Subtle movement of gradient spheres
                const spheres = directoryModal.querySelectorAll('.gradient-sphere');
                const moveX = (e.clientX / window.innerWidth - 0.5) * 5;
                const moveY = (e.clientY / window.innerHeight - 0.5) * 5;
                
                spheres.forEach((sphere, index) => {
                    const multiplier = (index + 1) * 0.3; // Different movement for each sphere
                    sphere.style.transform = `translate(${moveX * multiplier}px, ${moveY * multiplier}px)`;
                });
            });
        }
    }

    /**
     * Show mode selection modal
     */
    showModeSelection() {
        const modal = document.getElementById('directorySelectionModal');
        const modeSelection = document.getElementById('modeSelection');
        const localArchiveSetup = document.getElementById('localArchiveSetup');
        
        // Show modal and mode selection
        if (modal) {
            modal.style.display = 'flex';
        }
        if (modeSelection) {
            modeSelection.style.display = 'block';
        }
        if (localArchiveSetup) {
            localArchiveSetup.style.display = 'none';
        }
        
        // Reset any progress indicators
        this.hideAllProgressIndicators();
        
        // Set up mode selection event listeners
        this.setupModeEventListeners();
    }

    /**
     * Hide all progress indicators and error messages
     */
    hideAllProgressIndicators() {
        // Hide loading screen
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
        
        // Hide directory status indicators
        const directoryStatus = document.getElementById('directoryStatus');
        const directoryError = document.getElementById('directoryError');
        
        if (directoryStatus) {
            directoryStatus.style.display = 'none';
        }
        
        if (directoryError) {
            directoryError.style.display = 'none';
        }
        
        // Reset any loading buttons to normal state (only YouTube and Local Archive)
        const buttons = ['selectLocalArchiveBtn', 'selectYouTubeBtn'];
        buttons.forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = btn.innerHTML.replace(/Loading.*/, btn.dataset.originalText || 'Begin');
            }
        });
    }

    /**
     * Set up event listeners for mode selection
     */
    setupModeEventListeners() {
        const selectLocalArchiveBtn = document.getElementById('selectLocalArchiveBtn');
        const selectYouTubeBtn = document.getElementById('selectYouTubeBtn');
        // Instagram and Facebook buttons removed
        const backToModeSelection = document.getElementById('backToModeSelection');
        const selectDirectoryBtn = document.getElementById('selectDirectoryBtn');
        const useLocalServerBtn = document.getElementById('useLocalServerBtn');
        const continueToAppBtn = document.getElementById('continueToAppBtn');
        const retryDirectoryBtn = document.getElementById('retryDirectoryBtn');
        
        // Make entire cards clickable
        const localArchiveCard = document.getElementById('localArchiveCard');
        const youtubeCard = document.getElementById('youtubeCard');
        // Instagram and Facebook cards removed
        
        // Local Archive Mode Selection (entire card clickable)
        if (localArchiveCard) {
            localArchiveCard.addEventListener('click', async (e) => {
                // Prevent double-click if clicking on button
                if (e.target.tagName === 'BUTTON') return;
                await this.handleLocalArchiveModeSelection();
            });
        }
        
        if (selectLocalArchiveBtn) {
            selectLocalArchiveBtn.addEventListener('click', async (e) => {
                e.stopPropagation(); // Prevent card click
                await this.handleLocalArchiveModeSelection();
            });
        }
        
        // YouTube Mode Selection (entire card clickable)
        if (youtubeCard) {
            youtubeCard.addEventListener('click', async (e) => {
                // Prevent double-click if clicking on button
                if (e.target.tagName === 'BUTTON') return;
                await this.handleYouTubeModeSelection();
            });
        }
        
        if (selectYouTubeBtn) {
            selectYouTubeBtn.addEventListener('click', async (e) => {
                e.stopPropagation(); // Prevent card click
                await this.handleYouTubeModeSelection();
            });
        }
        
        // Instagram and Facebook mode selection removed - YouTube Explorer only
        
        // Back to mode selection
        if (backToModeSelection) {
            backToModeSelection.addEventListener('click', () => {
                this.showModeSelection();
            });
        }
        
        // Directory selection (for local archive mode)
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
        
        // Continue to app after successful setup
        if (continueToAppBtn) {
            continueToAppBtn.addEventListener('click', () => {
                this.hideModeSelection();
                this.startApp();
            });
        }
        
        // Retry setup
        if (retryDirectoryBtn) {
            retryDirectoryBtn.addEventListener('click', () => {
                this.hideDirectoryError();
                this.showLocalArchiveSetup();
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
     * Handle Local Archive mode selection
     */
    async handleLocalArchiveModeSelection() {
        console.log('🎛️ User selected Local Archive mode');
        this.modeManager.setMode('local');
        
        // Check if File System Access API is supported
        if (this.modeManager.directoryManager.isSupported) {
            // Immediately open directory selection dialog
            await this.handleDirectorySelection();
        } else {
            // Show setup screen for local server fallback
            this.showLocalArchiveSetup();
        }
    }

    /**
     * Handle YouTube mode selection
     */
    async handleYouTubeModeSelection() {
        try {
            console.log('🎛️ User selected YouTube mode');
            
            this.showModeStatus('Initializing YouTube mode...');
            
            // Initialize YouTube mode
            const result = await this.modeManager.initializeYouTubeMode();
            this.modeManager.setMode('youtube');
            
            // Show success toast and auto-close modal
            this.showSuccessToast('YouTube mode activated successfully!');
            
            // Auto-close modal after brief delay
            setTimeout(() => {
                this.hideModeSelection();
                this.startApp();
            }, 1500);
            
        } catch (error) {
            console.error('YouTube mode initialization failed:', error);
            this.showModeError(error.message);
        }
    }

    /**
     * Handle Instagram mode selection
     */
    handleInstagramModeSelection() {
        console.log('🎛️ User selected Instagram mode');
        window.location.href = './othersocials/MMInstaArchive/MMArchiveExplorer/index.html';
    }

    /**
     * Handle Facebook mode selection
     */
    handleFacebookModeSelection() {
        console.log('🎛️ User selected Facebook mode');
        window.location.href = './othersocials/MMFacebookExplorer/index.html';
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
            // Show loading screen
            this.elements.loadingScreen.style.display = 'flex';
            
            this.updateLoadingProgress('Initializing application...', 10);
            
            // Set up event listeners
            this.setupEventListeners();
            
            this.updateLoadingProgress('Loading video data...', 30);
            
            // Initialize data manager based on current mode
            if (this.modeManager.isLocalMode() && this.modeManager.directoryManager.isDirectorySelected()) {
                // Use File System Access API data with server metadata
                await this.dataManager.initializeFromHostedMapping(this.modeManager.videoMapping);
            } else {
                // Use traditional local server approach or YouTube mode (both use same metadata)
                await this.dataManager.initialize();
            }
            
            this.updateLoadingProgress('Optimizing search indexes...', 70);
            await new Promise(resolve => setTimeout(resolve, 500)); // Brief pause for user feedback
            
            this.updateLoadingProgress('Setting up export services...', 90);
            
            // Initialize export service
            this.exportService = new ExportService();
            
            // Initialize video player with mode manager
            this.videoPlayer = new VideoPlayer(
                document.getElementById('videoPlayer'),
                document.getElementById('videoFallback'),
                this.modeManager
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
            // resultCount: 'resultCount', // Removed - badge no longer exists in HTML
            // totalComments: 'totalComments', // Removed - badge no longer exists in HTML
            videoGridView: 'videoGridView',
            videoDetailView: 'videoDetailView',
            videoGrid: 'videoGrid',
            videoPagination: 'videoPagination',
            videoListView: 'videoListView',
            videoListBody: 'videoListBody',
            videoListPagination: 'videoListPagination',
            videoTitle: 'videoTitle',
            videoDate: 'videoDate',
            videoViews: 'videoViews',
            videoCommentCount: 'videoCommentCount',
            videoDescription: 'videoDescription',
            videoTranscript: 'videoTranscript',
            videoSummary: 'videoSummary',
            videoKeywords: 'videoKeywords',
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
            // Globe icon to return to welcome screen
            const homeGlobe = document.getElementById('home-globe');
            if (homeGlobe) {
                homeGlobe.addEventListener('click', (e) => {
                    e.preventDefault();
                    // Hide password modal if it's showing and go directly to welcome screen
                    const passwordModal = document.getElementById('passwordModal');
                    if (passwordModal) {
                        passwordModal.style.display = 'none';
                    }
                    
                    // Show navbar
                    const navbar = document.querySelector('.navbar');
                    if (navbar) {
                        navbar.classList.remove('hidden');
                    }
                    
                    // Go directly to mode selection
                    this.showModeSelection();
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
            // Export All Videos button is now handled by the dropdown in HTML with onclick="window.app.exportAllVideos('comment')" or 'thumbnail'

            // Comment Analytics button
            const commentAnalyticsBtn = document.getElementById('commentAnalyticsBtn');
            if (commentAnalyticsBtn) {
                commentAnalyticsBtn.addEventListener('click', () => {
                    this.showCommentAnalytics();
                });
            }

            // Keyword Analytics button
            const keywordAnalyticsBtn = document.getElementById('keywordAnalyticsBtn');
            if (keywordAnalyticsBtn) {
                keywordAnalyticsBtn.addEventListener('click', () => {
                    this.showKeywordAnalytics();
                });
            }

            // List View Toggle button
            const listViewToggle = document.getElementById('listViewToggle');
            if (listViewToggle) {
                listViewToggle.addEventListener('click', () => {
                    this.toggleListView();
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
                    const format = btn?.dataset?.format || 'comment';
                    
                    if (commentId) {
                        const comment = this.findCommentById(commentId);
                        if (comment) {
                            this.exportSingleComment(comment, format);
                        } else {
                            console.error('Comment not found:', commentId);
                            this.showError('Comment not found');
                        }
                    }
                }
            });

            // Export comment button from analytics modal (event delegation)
            document.addEventListener('click', (e) => {
                if (e.target.matches('.export-comment-btn') || e.target.closest('.export-comment-btn')) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const btn = e.target.closest('.export-comment-btn');
                    const commentId = btn?.dataset?.commentId;
                    const format = btn?.dataset?.format || 'comment';
                    
                    if (commentId) {
                        const comment = this.findCommentById(commentId);
                        if (comment) {
                            this.exportSingleComment(comment, format);
                        } else {
                            console.error('Comment not found:', commentId);
                            this.showError('Comment not found');
                        }
                    }
                }
            });
            
            // Tab switching for both insights and content tabs
            document.addEventListener('click', (e) => {
                if (e.target.matches('.analytics-tab[data-tab]')) {
                    e.preventDefault();
                    this.switchInsightTab(e.target.dataset.tab);
                } else if (e.target.matches('.content-tab[data-tab]')) {
                    e.preventDefault();
                    this.switchContentTab(e.target.dataset.tab);
                }
            });

            // About modal handling
            const aboutBtn = document.getElementById('about-btn');
            const aboutModal = document.getElementById('aboutModal');
            const closeAboutModal = document.getElementById('closeAboutModal');

            if (aboutBtn && aboutModal && closeAboutModal) {
                aboutBtn.addEventListener('click', () => {
                    aboutModal.classList.add('show');
                });

                closeAboutModal.addEventListener('click', () => {
                    aboutModal.classList.remove('show');
                });

                // Close modal when clicking outside
                aboutModal.addEventListener('click', (e) => {
                    if (e.target === aboutModal) {
                        aboutModal.classList.remove('show');
                    }
                });
            }

            // App drawer handling
            const drawerToggle = document.getElementById('drawerToggle');
            const appDrawer = document.getElementById('appDrawer');

            if (drawerToggle && appDrawer) {
                drawerToggle.addEventListener('click', () => {
                    const isOpen = appDrawer.classList.contains('open');
                    if (isOpen) {
                        appDrawer.classList.remove('open');
                        document.body.classList.remove('drawer-open');
                        drawerToggle.innerHTML = '<i class="fas fa-chevron-right"></i>';
                    } else {
                        appDrawer.classList.add('open');
                        document.body.classList.add('drawer-open');
                        drawerToggle.innerHTML = '<i class="fas fa-chevron-left"></i>';
                    }
                });
            }
            
            // Pagination event handlers (for both grid and list views)
            if (this.elements.videoPagination) {
                this.elements.videoPagination.addEventListener('click', (e) => {
                    if (e.target.matches('[data-page]')) {
                        e.preventDefault();
                        this.currentPagination.page = parseInt(e.target.dataset.page);
                        this.loadVideoGrid();
                    }
                });
            }
            
            if (this.elements.videoListPagination) {
                this.elements.videoListPagination.addEventListener('click', (e) => {
                    if (e.target.matches('[data-page]')) {
                        e.preventDefault();
                        this.currentPagination.page = parseInt(e.target.dataset.page);
                        this.loadVideoGrid();
                    }
                });
            }
            
            // List view row click handlers
            if (this.elements.videoListBody) {
                this.elements.videoListBody.addEventListener('click', (e) => {
                    const videoRow = e.target.closest('tr[data-video-id]');
                    if (videoRow) {
                        const videoId = videoRow.dataset.videoId;
                        this.showVideoDetail(videoId);
                    }
                });
            }
            
            // List view sorting event handlers
            document.addEventListener('click', (e) => {
                if (e.target.matches('#videoListView .sortable') || e.target.closest('#videoListView .sortable')) {
                    e.preventDefault();
                    
                    const header = e.target.closest('.sortable');
                    const sortField = header.dataset.sort;
                    
                    // Toggle direction if same field, otherwise default to desc
                    if (this.listViewSort.field === sortField) {
                        this.listViewSort.direction = this.listViewSort.direction === 'desc' ? 'asc' : 'desc';
                    } else {
                        this.listViewSort.field = sortField;
                        this.listViewSort.direction = 'desc';
                    }
                    
                    // Update visual indicators
                    this.updateSortIndicators();
                    
                    // Reload data with new sort
                    this.loadVideoGrid();
                }
            });
            
            console.log('✅ Event listeners set up successfully');
            
        } catch (error) {
            console.error('❌ Error setting up event listeners:', error);
        }
    }

    /**
     * Navigate to main view when logo/title is clicked
     */
    goToMainView() {
        if (this.currentView === 'video-detail') {
            this.showVideoGrid();
        }
        // If already on main view, scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
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
            
            // Add list view sorting to filters
            if (this.isListView) {
                // Map list view sort fields to DataManager format
                const sortFieldMap = {
                    'date': 'date',
                    'views': 'views',
                    'likes': 'views', // No likes field, use views as fallback
                    'comments': 'comments',
                    'title': 'title',
                    'thumbnail': 'date' // No thumbnail sort, use date as fallback
                };
                
                const mappedField = sortFieldMap[this.listViewSort.field] || 'date';
                filters.sortBy = `${mappedField}-${this.listViewSort.direction}`;
            }
            
            const result = await this.dataManager.getVideos(filters, this.currentPagination);
            
            // Render appropriate view
            if (this.isListView) {
                this.renderVideoList(result.videos);
                this.renderPagination(result, 'list');
            } else {
                this.renderVideoGrid(result.videos);
                this.renderPagination(result, 'grid');
            }
            
            // this.updateResultCount(result.total); // Removed - badge no longer exists in HTML
            this.updateChannelStats();
            
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
            
            // Update UI
            this.elements.videoGridView.style.display = 'none';
            this.elements.videoDetailView.style.display = 'block';
            
            // Hide channel navigation tools, stats bar, and channel statistics
            document.getElementById('channel-navigation').style.display = 'none';
            this.elements.statsBar.style.display = 'none';
            const channelStats = document.getElementById('channelStats');
            if (channelStats) {
                channelStats.style.display = 'none';
            }
            
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
        
        // Show the correct view based on current state
        if (this.isListView) {
            this.elements.videoGridView.style.display = 'none';
            this.elements.videoListView.style.display = 'block';
        } else {
            this.elements.videoListView.style.display = 'none';
            this.elements.videoGridView.style.display = 'block';
        }
        
        // Show channel navigation tools, stats bar, and channel statistics
        document.getElementById('channel-navigation').style.display = 'flex';
        this.elements.statsBar.style.display = 'flex';
        const channelStats = document.getElementById('channelStats');
        if (channelStats) {
            channelStats.style.display = 'block';
        }
        
        this.updateBreadcrumb(['Videos']);
        
        // Clean up video player
        if (this.videoPlayer) {
            this.videoPlayer.destroy();
        }
    }

    /**
     * Toggle between grid and list view
     */
    toggleListView() {
        this.isListView = !this.isListView;
        
        // Update button text and icon
        const toggleBtn = document.getElementById('listViewToggle');
        if (toggleBtn) {
            if (this.isListView) {
                toggleBtn.innerHTML = '<i class="bi bi-grid-3x3-gap"></i> Grid View';
                toggleBtn.title = 'Toggle Grid View';
            } else {
                toggleBtn.innerHTML = '<i class="bi bi-list-ul"></i> List View';
                toggleBtn.title = 'Toggle List View';
            }
        }
        
        // Show/hide appropriate view
        if (this.isListView) {
            this.elements.videoGridView.style.display = 'none';
            this.elements.videoListView.style.display = 'block';
        } else {
            this.elements.videoListView.style.display = 'none';
            this.elements.videoGridView.style.display = 'block';
        }
        
        // Reload data for current view
        this.loadVideoGrid();
    }


    /**
     * Update visual sort indicators
     */
    updateSortIndicators() {
        const sortableHeaders = this.elements.videoListView.querySelectorAll('.sortable');
        sortableHeaders.forEach(header => {
            header.classList.remove('sorted-asc', 'sorted-desc');
            if (header.dataset.sort === this.listViewSort.field) {
                header.classList.add(`sorted-${this.listViewSort.direction}`);
            }
        });
    }

    /**
     * Render video list view
     */
    renderVideoList(videos) {
        const html = videos.map(video => this.createVideoListRow(video)).join('');
        this.elements.videoListBody.innerHTML = html;
    }

    /**
     * Create video list row
     */
    createVideoListRow(video) {
        const date = new Date(video.published_at).toLocaleDateString();
        const views = this.formatNumber(video.view_count);
        const likes = this.formatNumber(video.like_count || 0);
        const comments = this.formatNumber(video.comment_count);
        
        return `
            <tr data-video-id="${video.video_id}">
                <td>
                    <img class="list-video-thumbnail" 
                         src="https://img.youtube.com/vi/${video.video_id}/hqdefault.jpg" 
                         alt="${this.escapeHTML(video.title)}"
                         onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iNDUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2Y4ZjlmYSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iOCIgZmlsbD0iIzZjNzU3ZCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIFRodW1ibmFpbDwvdGV4dD48L3N2Zz4='">
                </td>
                <td>
                    <div class="list-video-title" title="${this.escapeHTML(video.title)}">
                        ${this.escapeHTML(video.title)}
                    </div>
                </td>
                <td>
                    <div class="list-video-date">${date}</div>
                </td>
                <td>
                    <div class="list-video-stats">${views}</div>
                </td>
                <td>
                    <div class="list-video-stats">${likes}</div>
                </td>
                <td>
                    <div class="list-video-stats">${comments}</div>
                </td>
            </tr>
        `;
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
        
        // Load additional content (transcript, summary, keywords)
        this.loadVideoContent(video);
    }

    /**
     * Load additional video content (transcript, summary, keywords)
     */
    async loadVideoContent(video) {
        // Load transcript
        this.loadTranscript(video);
        
        // Load summary
        this.loadSummary(video);
        
        // Load keywords
        this.loadKeywords(video);
    }

    /**
     * Load video transcript
     */
    async loadTranscript(video) {
        try {
            // Find matching transcript file based on video_id
            const transcriptFiles = [
                `data/subtitles/${video.title}_${video.video_id}_en_auto.txt`,
                `data/subtitles/${video.title}_${video.video_id}_en_manual.txt`
            ];
            
            let transcriptContent = null;
            for (const file of transcriptFiles) {
                try {
                    const response = await fetch(file);
                    if (response.ok) {
                        transcriptContent = await response.text();
                        break;
                    }
                } catch (error) {
                    // Continue to next file
                }
            }
            
            if (transcriptContent) {
                this.elements.videoTranscript.innerHTML = this.escapeHTML(transcriptContent);
            } else {
                this.elements.videoTranscript.innerHTML = '<div class="text-muted">Transcript not available for this video.</div>';
            }
        } catch (error) {
            console.error('Failed to load transcript:', error);
            this.elements.videoTranscript.innerHTML = '<div class="text-muted">Error loading transcript.</div>';
        }
    }

    /**
     * Load video summary
     */
    async loadSummary(video) {
        try {
            // Find matching summary file based on video_id
            const summaryFiles = [
                `data/summaries/${video.title}_${video.video_id}_en_auto_summary.txt`,
                `data/summaries/${video.title}_${video.video_id}_en_manual_summary.txt`
            ];
            
            let summaryContent = null;
            for (const file of summaryFiles) {
                try {
                    const response = await fetch(file);
                    if (response.ok) {
                        summaryContent = await response.text();
                        break;
                    }
                } catch (error) {
                    // Continue to next file
                }
            }
            
            if (summaryContent) {
                // Remove the header line if it exists
                const cleanContent = summaryContent.replace(/^Video:.*\n={40,}\n\n?/m, '');
                this.elements.videoSummary.innerHTML = this.escapeHTML(cleanContent).replace(/\n/g, '<br>');
            } else {
                this.elements.videoSummary.innerHTML = '<div class="text-muted">Summary not available for this video.</div>';
            }
        } catch (error) {
            console.error('Failed to load summary:', error);
            this.elements.videoSummary.innerHTML = '<div class="text-muted">Error loading summary.</div>';
        }
    }

    /**
     * Load video keywords
     */
    async loadKeywords(video) {
        try {
            // Load keywords from cache or fetch from data/keywords.json
            if (!this.keywordsCache) {
                const response = await fetch('data/keywords.json');
                if (!response.ok) {
                    throw new Error('Keywords file not found');
                }
                this.keywordsCache = await response.json();
            }
            
            // Find matching keywords based on video title and video_id
            // Try multiple possible key patterns
            const possibleKeys = [
                `${video.title}_${video.video_id}_en_auto`,
                `${video.title}_${video.video_id}_en_manual`
            ];
            
            let keywords = null;
            for (const key of possibleKeys) {
                if (this.keywordsCache[key]) {
                    keywords = this.keywordsCache[key];
                    break;
                }
            }
            
            if (keywords && keywords.length > 0) {
                const keywordTags = keywords.map(keyword => 
                    `<span class="badge bg-primary me-1 mb-1" style="font-size: 0.8em;">${this.escapeHTML(keyword)}</span>`
                ).join('');
                this.elements.videoKeywords.innerHTML = keywordTags;
            } else {
                this.elements.videoKeywords.innerHTML = '<div class="text-muted">No keywords available for this video.</div>';
            }
        } catch (error) {
            console.error('Failed to load keywords:', error);
            this.elements.videoKeywords.innerHTML = '<div class="text-muted">Error loading keywords.</div>';
        }
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
                    <div class="dropdown">
                        <button class="btn btn-outline-primary btn-sm dropdown-toggle export-dropdown" type="button" data-bs-toggle="dropdown" aria-expanded="false" data-comment-id="${comment.comment_id}">
                            <i class="bi bi-download"></i>
                        </button>
                        <ul class="dropdown-menu">
                            <li><a class="dropdown-item export-btn" href="#" data-comment-id="${comment.comment_id}" data-format="comment">
                                <i class="bi bi-chat-text"></i> Comment Only
                            </a></li>
                            <li><a class="dropdown-item export-btn" href="#" data-comment-id="${comment.comment_id}" data-format="thumbnail">
                                <i class="bi bi-image"></i> iPhone Screenshot
                            </a></li>
                        </ul>
                    </div>
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
                        <div class="dropdown">
                            <button class="btn btn-outline-primary btn-sm dropdown-toggle export-dropdown" type="button" data-bs-toggle="dropdown" aria-expanded="false" data-comment-id="${reply.comment_id}">
                                <i class="bi bi-download"></i>
                            </button>
                            <ul class="dropdown-menu">
                                <li><a class="dropdown-item export-btn" href="#" data-comment-id="${reply.comment_id}" data-format="comment">
                                    <i class="bi bi-chat-text"></i> Comment Only
                                </a></li>
                                <li><a class="dropdown-item export-btn" href="#" data-comment-id="${reply.comment_id}" data-format="thumbnail">
                                    <i class="bi bi-image"></i> iPhone Screenshot
                                </a></li>
                            </ul>
                        </div>
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
        // Search in current video comments if in video view, otherwise search all comments
        if (this.currentVideo?.video_id) {
            const allComments = this.dataManager.comments.filter(c => c.video_id === this.currentVideo.video_id);
            return allComments.find(c => c.comment_id === commentId);
        } else {
            // Search in all comments (for analytics modal context)
            return this.dataManager.comments.find(c => c.comment_id === commentId);
        }
    }

    /**
     * Export single comment
     */
    async exportSingleComment(comment, format = 'comment') {
        try {
            console.log(`💬 Starting single comment export for: ${comment.comment_id} (format: ${format})`);
            
            this.showExportProgress('single');
            
            // Update progress to show it's starting
            console.log('📊 Setting initial progress...');
            this.updateExportProgress({ current: 0, total: 1, status: 'Starting export...' }, 'single');
            
            // Small delay to see progress
            await new Promise(resolve => setTimeout(resolve, 500));
            
            console.log('📊 Updating progress to 50%...');
            this.updateExportProgress({ current: 0.5, total: 1, status: 'Generating image...' }, 'single');
            
            // Choose export method based on format
            if (format === 'thumbnail') {
                // Generate YouTube thumbnail URL from video_id since thumbnail_url doesn't exist in videos.json
                const videoThumbnail = this.currentVideo ? `https://img.youtube.com/vi/${this.currentVideo.video_id}/maxresdefault.jpg` : '';
                await this.exportService.exportSingleCommentWithThumbnail(comment, this.currentVideo?.title || '', videoThumbnail);
            } else {
                await this.exportService.exportSingleComment(comment, this.currentVideo?.title || '');
            }
            
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
    async exportVideoComments(format = 'comment') {
        if (!this.currentVideo) return;
        
        try {
            this.showExportProgress('single');
            
            await this.exportService.exportVideoComments(
                this.currentVideo.video_id,
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
            this.showError('Failed to export comments');
            this.hideExportProgress();
        }
    }

    /**
     * Export comments for all videos
     */
    async exportAllVideos(format = 'comment') {
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
        // Update comprehensive channel statistics
        this.updateChannelStats();
        
        // Also update legacy comment count for compatibility
        // const stats = this.dataManager.getStats();
        // this.elements.totalComments.textContent = `${this.formatNumber(stats.totalComments)} comments`; // Removed - badge no longer exists in HTML
    }

    /**
     * Update result count - DISABLED (badge removed from HTML)
     */
    // updateResultCount(count) {
    //     this.elements.resultCount.textContent = `${this.formatNumber(count)} videos`;
    // }

    /**
     * Render pagination
     */
    renderPagination(result, viewType = 'grid') {
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
        
        // Select appropriate pagination container
        const paginationContainer = viewType === 'list' ? 
            this.elements.videoListPagination : 
            this.elements.videoPagination;
            
        paginationContainer.innerHTML = html;
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
                this.renderAnalyticsWordCloud(preComputed.word_cloud);
                this.renderAnalyticsLikedWords(preComputed.liked_words);
                
                // Generate sentiment and themes analysis even for precomputed data
                const allComments = await this.dataManager.getAllComments(this.currentVideo.video_id, {});
                const flatComments = this.flattenComments(allComments);
                const sentimentData = this.analyzeSentiment(flatComments);
                const themesData = this.analyzeThemes(flatComments);
                this.renderSentimentAnalysis(sentimentData);
                this.renderThemesAnalysis(themesData);
                
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

            // Generate all analytics
            const wordFreq = this.analyzeWordFrequency(flatComments);
            const likedWords = this.analyzeLikedCommentWords(flatComments);
            const sentimentData = this.analyzeSentiment(flatComments);
            const themesData = this.analyzeThemes(flatComments);

            // Update UI
            this.renderAnalyticsWordCloud(wordFreq);
            this.renderAnalyticsLikedWords(likedWords);
            this.renderSentimentAnalysis(sentimentData);
            this.renderThemesAnalysis(themesData);
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
            return `<span class="word-item size-${size} clickable-word" 
                          title="${count} occurrences - Click to filter comments"
                          data-word="${this.escapeHTML(word)}"
                          onclick="window.app.filterCommentsByWord('${this.escapeHTML(word)}')">
                ${word} <span class="word-count">${count}</span>
            </span>`;
        }).join('');

        this.elements.wordCloud.innerHTML = html;
    }

    /**
     * Filter comments by clicked word and scroll to comments section
     */
    filterCommentsByWord(word) {
        try {
            // Set the search input to the clicked word
            const commentSearch = document.getElementById('commentSearch');
            if (commentSearch) {
                commentSearch.value = word;
                
                // Trigger the search
                const searchEvent = new Event('input', { bubbles: true });
                commentSearch.dispatchEvent(searchEvent);
            }
            
            // Scroll to comments section
            const commentsSection = document.querySelector('.comments-section');
            if (commentsSection) {
                commentsSection.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'start' 
                });
            }
            
            console.log(`🔍 Filtering comments by word: "${word}"`);
            
        } catch (error) {
            console.error('Failed to filter comments by word:', error);
        }
    }

    /**
     * Filter channel comments by clicked word in analytics modal
     */
    filterChannelCommentsByWord(word) {
        try {
            // Set the channel search input to the clicked word
            const channelCommentSearch = document.getElementById('channelCommentSearch');
            if (channelCommentSearch) {
                channelCommentSearch.value = word;
                
                // Trigger the search
                const searchEvent = new Event('input', { bubbles: true });
                channelCommentSearch.dispatchEvent(searchEvent);
            }
            
            console.log(`🔍 Filtering channel comments by word: "${word}"`);
            
        } catch (error) {
            console.error('Failed to filter channel comments by word:', error);
        }
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
        document.querySelectorAll('.analytics-tab').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Show/hide tab content
        document.querySelectorAll('.tab-pane').forEach(tab => {
            tab.classList.remove('active');
            tab.style.display = 'none';
        });

        const targetTab = document.getElementById(`${tabName}Tab`);
        if (targetTab) {
            targetTab.classList.add('active');
            targetTab.style.display = 'block';
        }
    }

    /**
     * Switch between content tabs (description, transcript, summary, keywords)
     */
    switchContentTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.content-tab').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`.content-tab[data-tab="${tabName}"]`).classList.add('active');

        // Show/hide tab content
        document.querySelectorAll('.content-tab-pane').forEach(tab => {
            tab.classList.remove('active');
            tab.style.display = 'none';
        });

        const targetTab = document.getElementById(`${tabName}Tab`);
        if (targetTab) {
            targetTab.classList.add('active');
            targetTab.style.display = 'block';
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
            
            return `<span class="analytics-liked-word ${sizeClass}" title="Average ${Math.round(avgLikes)} likes in ${count} comments">
                ${word}<span class="count">${Math.round(avgLikes)}</span>
            </span>`;
        }).join('');
        
        container.innerHTML = html;
    }

    /**
     * Analyze comment sentiment
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
     * Analyze themes and topics
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
        
        // Sort themes by count and return top ones
        return Object.keys(themes)
            .map(theme => ({ theme, count: themes[theme].count }))
            .filter(({ count }) => count > 0)
            .sort((a, b) => b.count - a.count)
            .slice(0, 8);
    }

    /**
     * Render themes analysis
     */
    renderThemesAnalysis(themesData) {
        const container = document.getElementById('themesAnalysis');
        if (!container) return;
        
        if (themesData.length === 0) {
            container.innerHTML = '<div class="text-muted">No theme data available</div>';
            return;
        }
        
        const html = themesData.map(({ theme, count }) => {
            return `<span class="theme-item" title="${count} mentions">${theme} (${count})</span>`;
        }).join(' ');
        
        container.innerHTML = html;
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
     * Update channel statistics
     */
    updateChannelStats() {
        try {
            const videos = this.dataManager.videos || [];
            const allComments = this.dataManager.comments || [];
            
            // Calculate stats
            const totalVideos = videos.length;
            const totalComments = allComments.length;
            const totalLikes = allComments.reduce((sum, comment) => sum + (parseInt(comment.like_count) || 0), 0);
            const totalViews = videos.reduce((sum, video) => sum + (parseInt(video.view_count) || 0), 0);
            
            // Calculate unique commenters
            const uniqueCommenters = new Set(allComments.map(comment => comment.author)).size;
            
            // Calculate average engagement (comments per video)
            const avgEngagement = totalVideos > 0 ? Math.round(totalComments / totalVideos) : 0;
            
            // Update DOM elements
            document.getElementById('totalVideos').textContent = this.formatNumber(totalVideos);
            document.getElementById('totalChannelComments').textContent = this.formatNumber(totalComments);
            document.getElementById('totalLikes').textContent = this.formatNumber(totalLikes);
            document.getElementById('totalViews').textContent = this.formatNumber(totalViews);
            document.getElementById('avgEngagement').textContent = this.formatNumber(avgEngagement);
            document.getElementById('uniqueCommenters').textContent = this.formatNumber(uniqueCommenters);
            
            // Show the channel stats section
            const channelStats = document.getElementById('channelStats');
            if (channelStats) {
                channelStats.style.display = 'block';
            }
            
        } catch (error) {
            console.error('Failed to update channel stats:', error);
        }
    }

    /**
     * Show comment analytics modal
     */
    async showCommentAnalytics() {
        const modal = new bootstrap.Modal(document.getElementById('commentAnalyticsModal'));
        const loadingDiv = document.getElementById('commentAnalyticsLoading');
        const contentDiv = document.getElementById('commentAnalyticsContent');
        const progressBar = document.getElementById('commentAnalyticsProgress');

        // Show modal and loading state
        modal.show();
        loadingDiv.style.display = 'block';
        contentDiv.style.display = 'none';

        try {
            // Simulate progress updates
            this.updateProgress(progressBar, 20);
            
            // Generate analytics data
            const analytics = await this.generateChannelAnalytics();
            this.updateProgress(progressBar, 60);
            
            // Generate sentiment and theme analytics
            const sentimentData = await this.analyzeSentiment(analytics.allComments);
            this.updateProgress(progressBar, 80);
            
            const themeData = await this.analyzeThemes(analytics.allComments);
            this.updateProgress(progressBar, 100);
            
            // Update analytics tiles
            document.getElementById('analyticsCommentsCount').textContent = this.formatNumber(analytics.totalComments);
            document.getElementById('analyticsLikesCount').textContent = this.formatNumber(analytics.totalLikes);
            document.getElementById('analyticsUniqueCommenters').textContent = this.formatNumber(analytics.uniqueCommenters);
            document.getElementById('analyticsAvgLikes').textContent = this.formatNumber(analytics.avgLikes);
            
            // Update word clouds
            this.renderWordCloud('mostLikedWords', analytics.mostLikedWords);
            this.renderWordCloud('mostFrequentWords', analytics.mostFrequentWords);
            
            // Render sentiment and theme analytics
            this.renderSentimentAnalysis(sentimentData);
            this.renderThemeAnalysis(themeData);
            
            // Load all comments
            this.currentChannelCommentPagination = { page: 1, limit: 50 };
            this.channelCommentsFiltered = analytics.allComments;
            this.renderChannelComments();
            
            // Initialize search results count to show total comments
            const searchResultsElement = document.getElementById('commentSearchResults');
            if (searchResultsElement) {
                const totalComments = analytics.allComments.length;
                searchResultsElement.textContent = `${totalComments.toLocaleString()} comment${totalComments !== 1 ? 's' : ''} found`;
            }
            
            // Hide loading and show content
            setTimeout(() => {
                loadingDiv.style.display = 'none';
                contentDiv.style.display = 'block';
            }, 500);
            
            // Set up modal event listeners
            this.setupAnalyticsEventListeners();
            
        } catch (error) {
            console.error('Failed to show analytics:', error);
            loadingDiv.innerHTML = `
                <div class="text-center py-5">
                    <i class="bi bi-exclamation-triangle text-warning" style="font-size: 3rem;"></i>
                    <h5 class="mt-3">Unable to Generate Analytics</h5>
                    <p class="text-muted">Failed to analyze comment data. Please try again.</p>
                </div>
            `;
        }
    }

    /**
     * Update progress bar
     */
    updateProgress(progressBar, percentage) {
        if (progressBar) {
            progressBar.style.width = `${percentage}%`;
            progressBar.setAttribute('aria-valuenow', percentage);
        }
    }

    /**
     * Analyze sentiment of comments
     */
    async analyzeSentiment(comments) {
        const sentiments = {
            positive: { count: 0, keywords: ['thank', 'grateful', 'amazing', 'love', 'perfect', 'wonderful', 'helped', 'better', 'healed', 'blessing'] },
            negative: { count: 0, keywords: ['hate', 'bad', 'terrible', 'awful', 'horrible', 'disappointed', 'frustrated', 'angry', 'useless'] },
            neutral: { count: 0, keywords: ['okay', 'fine', 'normal', 'average', 'standard'] },
            grateful: { count: 0, keywords: ['thank you', 'grateful', 'blessed', 'appreciate', 'thankful', 'saved my life'] },
            questioning: { count: 0, keywords: ['?', 'how', 'what', 'when', 'where', 'why', 'which', 'can you', 'please help'] }
        };

        const total = comments.length;
        
        comments.forEach(comment => {
            const text = (comment.content || comment.text || '').toLowerCase();
            let categorized = false;

            // Check each sentiment category
            Object.keys(sentiments).forEach(sentiment => {
                if (!categorized) {
                    const hasKeyword = sentiments[sentiment].keywords.some(keyword => 
                        text.includes(keyword)
                    );
                    if (hasKeyword) {
                        sentiments[sentiment].count++;
                        categorized = true;
                    }
                }
            });

            // Default to neutral if not categorized
            if (!categorized) {
                sentiments.neutral.count++;
            }
        });

        // Calculate percentages
        Object.keys(sentiments).forEach(key => {
            sentiments[key].percentage = total > 0 ? Math.round((sentiments[key].count / total) * 100) : 0;
        });

        return sentiments;
    }

    /**
     * Enhanced theme analysis with Medical Medium specific categories
     */
    async analyzeThemes(comments) {
        const themes = {
            'Recipe Requests': { count: 0, keywords: ['recipe', 'how to make', 'ingredients', 'cook'], color: '#28a745' },
            'Health Questions': { count: 0, keywords: ['dosage', 'how much', 'how long', 'safe', 'pregnancy'], color: '#17a2b8' },
            'Success Stories': { count: 0, keywords: ['helped', 'better', 'improved', 'healed', 'working', 'results', 'cured'], color: '#ffc107' },
            'Protocol Questions': { count: 0, keywords: ['celery juice', 'heavy metal', 'detox', 'protocol', 'supplements'], color: '#fd7e14' },
            'Gratitude': { count: 0, keywords: ['thank you', 'grateful', 'bless', 'saved my life', 'appreciate'], color: '#e83e8c' },
            'Symptoms': { count: 0, keywords: ['pain', 'fatigue', 'brain fog', 'anxiety', 'depression', 'symptoms'], color: '#dc3545' },
            'Food & Nutrition': { count: 0, keywords: ['food', 'eat', 'diet', 'nutrition', 'meal', 'fruit', 'vegetable'], color: '#20c997' },
            'Liver Health': { count: 0, keywords: ['liver', 'detox', 'cleanse', 'morning cleanse'], color: '#6f42c1' }
        };

        const total = comments.length;

        comments.forEach(comment => {
            const text = (comment.content || comment.text || '').toLowerCase();
            
            Object.keys(themes).forEach(theme => {
                const hasKeyword = themes[theme].keywords.some(keyword => 
                    text.includes(keyword)
                );
                if (hasKeyword) {
                    themes[theme].count++;
                }
            });
        });

        // Calculate percentages and sort by count
        const themeArray = Object.keys(themes).map(name => ({
            name,
            count: themes[name].count,
            color: themes[name].color,
            percentage: total > 0 ? Math.round((themes[name].count / total) * 100) : 0
        })).sort((a, b) => b.count - a.count);

        return themeArray;
    }

    /**
     * Render sentiment analysis visualization
     */
    renderSentimentAnalysis(sentimentData) {
        const chartContainer = document.getElementById('sentimentChart');
        const breakdownContainer = document.getElementById('sentimentBreakdown');

        if (!chartContainer || !breakdownContainer) return;

        // Create sentiment circle chart
        const total = Object.values(sentimentData).reduce((sum, item) => sum + item.count, 0);
        let cumulativeDegrees = 0;
        const gradientStops = [];

        const sentimentColors = {
            positive: '#28a745',
            grateful: '#ffc107', 
            neutral: '#6c757d',
            questioning: '#17a2b8',
            negative: '#dc3545'
        };

        Object.keys(sentimentData).forEach(sentiment => {
            const percentage = sentimentData[sentiment].percentage;
            const degrees = (percentage / 100) * 360;
            
            gradientStops.push(`${sentimentColors[sentiment]} ${cumulativeDegrees}deg ${cumulativeDegrees + degrees}deg`);
            cumulativeDegrees += degrees;
        });

        chartContainer.innerHTML = `
            <div class="sentiment-circle" style="background: conic-gradient(${gradientStops.join(', ')});">
                <div class="sentiment-center">
                    <div style="font-size: 1.5rem;">${total.toLocaleString()}</div>
                    <div style="font-size: 0.8rem; color: #666;">Comments</div>
                </div>
            </div>
        `;

        // Create sentiment breakdown
        const sentimentEmojis = {
            positive: '😊',
            grateful: '🙏',
            neutral: '😐',
            questioning: '❓',
            negative: '😞'
        };

        const sentimentLabels = {
            positive: 'Positive',
            grateful: 'Grateful',
            neutral: 'Neutral', 
            questioning: 'Questioning',
            negative: 'Negative'
        };

        breakdownContainer.innerHTML = Object.keys(sentimentData)
            .sort((a, b) => sentimentData[b].count - sentimentData[a].count)
            .map(sentiment => `
                <div class="sentiment-item">
                    <div class="sentiment-label">
                        <span class="sentiment-emoji">${sentimentEmojis[sentiment]}</span>
                        <span>${sentimentLabels[sentiment]}</span>
                    </div>
                    <div class="sentiment-stats">
                        <span class="sentiment-count">${sentimentData[sentiment].count}</span>
                        <span class="sentiment-percentage">${sentimentData[sentiment].percentage}%</span>
                    </div>
                </div>
            `).join('');
    }

    /**
     * Render theme analysis visualization
     */
    renderThemeAnalysis(themeData) {
        const chartContainer = document.getElementById('themeChart');
        const themesContainer = document.getElementById('topThemes');

        if (!chartContainer || !themesContainer) return;

        // Create simple bar chart representation
        const maxCount = themeData[0]?.count || 1;
        
        chartContainer.innerHTML = `
            <div style="text-align: center; padding: 2rem;">
                <div style="font-size: 1.5rem; color: #333; margin-bottom: 0.5rem;">${themeData.length}</div>
                <div style="color: #666;">Themes Detected</div>
                <div style="margin-top: 1rem; font-size: 0.9rem; color: #999;">
                    Top: ${themeData[0]?.name || 'None'} (${themeData[0]?.count || 0})
                </div>
            </div>
        `;

        // Create theme breakdown
        themesContainer.innerHTML = themeData
            .slice(0, 8) // Show top 8 themes
            .map((theme, index) => {
                const barWidth = (theme.count / maxCount) * 100;
                return `
                    <div class="theme-item">
                        <div class="theme-label">
                            <span style="color: ${theme.color};">●</span>
                            <span>${theme.name}</span>
                        </div>
                        <div class="theme-stats">
                            <span class="theme-count">${theme.count}</span>
                            <span class="theme-percentage">${theme.percentage}%</span>
                        </div>
                    </div>
                    <div class="progress mb-2" style="height: 4px;">
                        <div class="progress-bar" style="width: ${barWidth}%; background-color: ${theme.color};"></div>
                    </div>
                `;
            }).join('');
    }

    /**
     * Generate channel analytics data
     */
    async generateChannelAnalytics() {
        const allComments = this.dataManager.comments || [];
        
        const analytics = {
            totalComments: allComments.length,
            totalLikes: allComments.reduce((sum, comment) => sum + (parseInt(comment.like_count) || 0), 0),
            uniqueCommenters: new Set(allComments.map(comment => comment.author)).size,
            avgLikes: allComments.length > 0 ? Math.round(allComments.reduce((sum, comment) => sum + (parseInt(comment.like_count) || 0), 0) / allComments.length) : 0,
            allComments: allComments.map(comment => ({
                ...comment,
                video_title: this.dataManager.getVideo(comment.video_id)?.title || 'Unknown Video'
            }))
        };
        
        // Calculate most liked words
        analytics.mostLikedWords = this.calculateMostLikedWords(allComments);
        
        // Calculate most frequent words
        analytics.mostFrequentWords = this.calculateMostFrequentWords(allComments);
        
        return analytics;
    }

    /**
     * Calculate most liked words from comments
     */
    calculateMostLikedWords(comments) {
        const wordLikes = {};
        
        comments.forEach(comment => {
            const likes = parseInt(comment.like_count) || 0;
            if (likes > 0) {
                const words = this.extractWords(comment.text);
                words.forEach(word => {
                    if (!wordLikes[word]) wordLikes[word] = 0;
                    wordLikes[word] += likes;
                });
            }
        });
        
        return Object.entries(wordLikes)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 20)
            .map(([word, likes]) => ({ word, count: likes }));
    }

    /**
     * Calculate most frequent words from comments
     */
    calculateMostFrequentWords(comments) {
        const wordCount = {};
        
        comments.forEach(comment => {
            const words = this.extractWords(comment.text);
            words.forEach(word => {
                if (!wordCount[word]) wordCount[word] = 0;
                wordCount[word]++;
            });
        });
        
        return Object.entries(wordCount)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 20)
            .map(([word, count]) => ({ word, count }));
    }

    /**
     * Extract meaningful words from text
     */
    extractWords(text) {
        const stopWords = new Set(['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'can', 'may', 'might', 'must', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'her', 'its', 'our', 'their', 'a', 'an', 'so', 'just', 'get', 'got', 'like', 'go', 'going', 'went', 'come', 'came', 'see', 'saw', 'know', 'knew', 'think', 'thought', 'say', 'said', 'tell', 'told', 'take', 'took', 'make', 'made', 'give', 'gave', 'want', 'wanted', 'need', 'needed', 'try', 'tried', 'use', 'used', 'work', 'worked', 'look', 'looked', 'feel', 'felt', 'seem', 'seemed', 'leave', 'left', 'put', 'keep', 'kept', 'let', 'help', 'helped', 'show', 'showed', 'hear', 'heard', 'ask', 'asked', 'turn', 'turned', 'move', 'moved', 'live', 'lived', 'play', 'played', 'run', 'ran', 'bring', 'brought', 'sit', 'sat', 'stand', 'stood', 'lose', 'lost', 'pay', 'paid', 'meet', 'met', 'include', 'including', 'continue', 'continued', 'set', 'follow', 'followed', 'stop', 'stopped', 'create', 'created', 'speak', 'spoke', 'read', 'write', 'wrote', 'provide', 'provided', 'allow', 'allowed', 'add', 'added', 'spend', 'spent', 'grow', 'grew', 'open', 'opened', 'walk', 'walked', 'win', 'won', 'carry', 'carried', 'talk', 'talked', 'appear', 'appeared', 'produce', 'produced', 'offer', 'offered', 'consider', 'considered', 'suggest', 'suggested', 'require', 'required', 'expect', 'expected', 'build', 'built', 'stay', 'stayed', 'fall', 'fell', 'cut', 'send', 'sent', 'receive', 'received', 'remain', 'remained', 'serve', 'served', 'die', 'died', 'decide', 'decided', 'reach', 'reached', 'kill', 'killed', 'raise', 'raised', 'pass', 'passed', 'sell', 'sold', 'buy', 'bought', 'break', 'broke', 'wear', 'wore', 'choose', 'chose', 'treat', 'treated', 'watch', 'watched', 'return', 'returned', 'develop', 'developed', 'carry', 'carried', 'lead', 'led', 'understand', 'understood', 'face', 'faced', 'deal', 'dealt', 'pull', 'pulled', 'pick', 'picked', 'rise', 'rose', 'drop', 'dropped', 'plan', 'planned', 'save', 'saved', 'push', 'pushed', 'eat', 'ate', 'avoid', 'avoided', 'support', 'supported', 'change', 'changed', 'enter', 'entered', 'share', 'shared', 'manage', 'managed', 'improve', 'improved', 'maintain', 'maintained', 'remember', 'remembered', 'explain', 'explained', 'describe', 'described', 'join', 'joined', 'discuss', 'discussed', 'introduce', 'introduced', 'enjoy', 'enjoyed', 'agree', 'agreed', 'compare', 'compared', 'control', 'controlled', 'visit', 'visited', 'attend', 'attended', 'achieve', 'achieved', 'check', 'checked', 'protect', 'protected', 'complete', 'completed', 'apply', 'applied', 'accept', 'accepted', 'reduce', 'reduced', 'increase', 'increased', 'assume', 'assumed', 'prepare', 'prepared', 'relate', 'related', 'identify', 'identified', 'recognize', 'recognized', 'ensure', 'ensured', 'focus', 'focused', 'handle', 'handled', 'contain', 'contained', 'invest', 'invested', 'design', 'designed', 'express', 'expressed', 'wish', 'wished', 'thank', 'thanked', 'hope', 'hoped', 'love', 'loved', 'hate', 'hated', 'care', 'cared', 'worry', 'worried', 'believe', 'believed', 'realize', 'realized', 'learn', 'learned', 'teach', 'taught', 'study', 'studied', 'practice', 'practiced', 'discover', 'discovered', 'explore', 'explored', 'test', 'tested', 'prove', 'proved', 'solve', 'solved', 'answer', 'answered', 'question', 'questioned', 'wonder', 'wondered', 'doubt', 'doubted', 'guess', 'guessed', 'suppose', 'supposed', 'imagine', 'imagined', 'dream', 'dreamed', 'forget', 'forgot', 'ignore', 'ignored', 'notice', 'noticed', 'observe', 'observed', 'find', 'found', 'search', 'searched', 'seek', 'sought', 'wait', 'waited', 'call', 'called', 'text', 'texted', 'email', 'emailed', 'contact', 'contacted', 'connect', 'connected', 'communicate', 'communicated', 'respond', 'responded', 'reply', 'replied', 'react', 'reacted', 'listen', 'listened', 'mind', 'minded', 'matter', 'mattered', 'mean', 'meant', 'sound', 'sounded', 'sort', 'sorted', 'type', 'typed', 'kind', 'way', 'ways', 'time', 'times', 'day', 'days', 'year', 'years', 'week', 'weeks', 'month', 'months', 'hour', 'hours', 'minute', 'minutes', 'second', 'seconds', 'moment', 'moments', 'place', 'places', 'part', 'parts', 'side', 'sides', 'end', 'ends', 'point', 'points', 'line', 'lines', 'area', 'areas', 'back', 'front', 'top', 'bottom', 'left', 'right', 'here', 'there', 'where', 'when', 'how', 'why', 'what', 'who', 'which', 'whose', 'whom', 'now', 'then', 'today', 'tomorrow', 'yesterday', 'always', 'never', 'sometimes', 'often', 'usually', 'rarely', 'hardly', 'almost', 'quite', 'very', 'too', 'also', 'only', 'even', 'still', 'yet', 'already', 'again', 'once', 'twice', 'more', 'most', 'less', 'least', 'much', 'many', 'few', 'little', 'big', 'small', 'large', 'great', 'good', 'better', 'best', 'bad', 'worse', 'worst', 'new', 'old', 'young', 'long', 'short', 'high', 'low', 'early', 'late', 'fast', 'slow', 'quick', 'easy', 'hard', 'difficult', 'simple', 'complex', 'clear', 'dark', 'light', 'bright', 'heavy', 'light', 'strong', 'weak', 'hot', 'cold', 'warm', 'cool', 'wet', 'dry', 'clean', 'dirty', 'fresh', 'old', 'new', 'nice', 'beautiful', 'ugly', 'pretty', 'handsome', 'cute', 'smart', 'stupid', 'funny', 'serious', 'happy', 'sad', 'angry', 'mad', 'excited', 'bored', 'tired', 'sick', 'healthy', 'fine', 'okay', 'alright', 'sure', 'maybe', 'probably', 'definitely', 'certainly', 'possibly', 'likely', 'unlikely', 'true', 'false', 'right', 'wrong', 'correct', 'incorrect', 'yes', 'no', 'yeah', 'yep', 'nope', 'ok', 'well', 'oh', 'ah', 'um', 'uh', 'hmm', 'wow', 'hey', 'hi', 'hello', 'goodbye', 'bye', 'thanks', 'please', 'sorry', 'excuse', 'pardon']);
        
        return text
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2 && !stopWords.has(word))
            .slice(0, 100); // Limit processing for performance
    }

    /**
     * Render word cloud
     */
    renderWordCloud(containerId, words) {
        const container = document.getElementById(containerId);
        if (!container || !words.length) return;
        
        const html = words.map(({word, count}, index) => {
            const size = Math.max(0.65, 0.95 - (index / words.length) * 0.3); // Smaller size range
            return `<span class="word-tag word-tag-small clickable-word" 
                          style="font-size: ${size}rem; cursor: pointer;" 
                          title="Click to filter comments containing '${this.escapeHTML(word)}'"
                          onclick="window.app.filterChannelCommentsByWord('${this.escapeHTML(word)}')">
                ${this.escapeHTML(word)} <span class="count">${this.formatNumber(count)}</span>
            </span>`;
        }).join('');
        
        container.innerHTML = html;
    }

    /**
     * Render channel comments
     */
    renderChannelComments() {
        const container = document.getElementById('channelCommentsList');
        if (!container || !this.channelCommentsFiltered) return;
        
        const startIndex = (this.currentChannelCommentPagination.page - 1) * this.currentChannelCommentPagination.limit;
        const endIndex = startIndex + this.currentChannelCommentPagination.limit;
        const pageComments = this.channelCommentsFiltered.slice(startIndex, endIndex);
        
        const html = pageComments.map(comment => {
            const avatarColor = this.exportService.generateAvatarColor(comment.author);
            const firstLetter = comment.author[1]?.toUpperCase() || comment.author[0]?.toUpperCase() || 'U';
            const date = new Date(comment.published_at).toLocaleDateString();
            const likes = this.formatNumber(comment.like_count);
            
            return `
                <div class="comment-card">
                    <div class="comment-video-context" onclick="window.app.showVideoFromComment('${comment.video_id}')">
                        <i class="bi bi-play-btn-fill text-danger me-1"></i> ${this.escapeHTML(comment.video_title)}
                    </div>
                    <div class="comment-header">
                        <div class="comment-author-section">
                            <div class="comment-avatar" style="background-color: ${avatarColor};">
                                ${firstLetter}
                            </div>
                            <div class="comment-meta">
                                <div class="comment-author">${this.escapeHTML(comment.author)}</div>
                                <div class="comment-date">${date}</div>
                            </div>
                        </div>
                        <div class="dropdown">
                            <button class="btn btn-outline-primary btn-sm dropdown-toggle export-comment-dropdown" type="button" data-bs-toggle="dropdown" aria-expanded="false" 
                                    data-comment-id="${comment.comment_id}" 
                                    data-video-title="${this.escapeHTML(comment.video_title)}">
                                <i class="bi bi-download"></i>
                            </button>
                            <ul class="dropdown-menu">
                                <li><a class="dropdown-item export-comment-btn" href="#" data-comment-id="${comment.comment_id}" data-video-title="${this.escapeHTML(comment.video_title)}" data-format="comment">
                                    <i class="bi bi-chat-text"></i> Comment Only
                                </a></li>
                                <li><a class="dropdown-item export-comment-btn" href="#" data-comment-id="${comment.comment_id}" data-video-title="${this.escapeHTML(comment.video_title)}" data-format="thumbnail">
                                    <i class="bi bi-image"></i> iPhone Screenshot
                                </a></li>
                            </ul>
                        </div>
                    </div>
                    <div class="comment-text">${this.escapeHTML(comment.text)}</div>
                    <div class="comment-actions">
                        <div class="comment-likes">
                            <i class="bi bi-hand-thumbs-up"></i> ${likes}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        if (this.currentChannelCommentPagination.page === 1) {
            container.innerHTML = html;
        } else {
            container.innerHTML += html;
        }
        
        // Show/hide load more button
        const loadMoreBtn = document.getElementById('loadMoreChannelComments');
        if (loadMoreBtn) {
            const hasMore = endIndex < this.channelCommentsFiltered.length;
            loadMoreBtn.style.display = hasMore ? 'block' : 'none';
        }
    }

    /**
     * Setup analytics event listeners
     */
    setupAnalyticsEventListeners() {
        // Channel comment search
        const searchInput = document.getElementById('channelCommentSearch');
        if (searchInput) {
            searchInput.addEventListener('input', this.debounce(() => {
                this.filterChannelComments();
            }, 300));
        }
        
        // Channel comment sort
        const sortSelect = document.getElementById('channelCommentSort');
        if (sortSelect) {
            sortSelect.addEventListener('change', () => {
                this.filterChannelComments();
            });
        }
        
        // Load more comments
        const loadMoreBtn = document.getElementById('loadMoreChannelComments');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => {
                this.currentChannelCommentPagination.page++;
                this.renderChannelComments();
            });
        }
    }

    /**
     * Filter channel comments based on search and sort
     */
    filterChannelComments() {
        const allComments = this.dataManager.comments || [];
        const search = document.getElementById('channelCommentSearch')?.value.toLowerCase() || '';
        const sort = document.getElementById('channelCommentSort')?.value || 'likes-desc';
        
        // Add video titles to comments
        let filtered = allComments.map(comment => ({
            ...comment,
            video_title: this.dataManager.getVideo(comment.video_id)?.title || 'Unknown Video'
        }));
        
        // Apply search filter
        if (search) {
            filtered = filtered.filter(comment => 
                comment.text.toLowerCase().includes(search) ||
                comment.author.toLowerCase().includes(search) ||
                comment.video_title.toLowerCase().includes(search)
            );
        }
        
        // Apply sort
        switch (sort) {
            case 'likes-desc':
                filtered.sort((a, b) => (parseInt(b.like_count) || 0) - (parseInt(a.like_count) || 0));
                break;
            case 'likes-asc':
                filtered.sort((a, b) => (parseInt(a.like_count) || 0) - (parseInt(b.like_count) || 0));
                break;
            case 'date-desc':
                filtered.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
                break;
            case 'date-asc':
                filtered.sort((a, b) => new Date(a.published_at) - new Date(b.published_at));
                break;
            case 'video':
                filtered.sort((a, b) => a.video_title.localeCompare(b.video_title));
                break;
        }
        
        this.channelCommentsFiltered = filtered;
        
        // Update search results count
        const resultsElement = document.getElementById('commentSearchResults');
        if (resultsElement) {
            const count = this.channelCommentsFiltered.length;
            resultsElement.textContent = `${count.toLocaleString()} comment${count !== 1 ? 's' : ''} found`;
        }
        
        this.currentChannelCommentPagination = { page: 1, limit: 50 };
        this.renderChannelComments();
    }

    /**
     * Show video from comment click
     */
    showVideoFromComment(videoId) {
        // Close the analytics modal first
        const modal = bootstrap.Modal.getInstance(document.getElementById('commentAnalyticsModal'));
        if (modal) {
            modal.hide();
        }
        
        // Show the video
        setTimeout(() => {
            this.showVideoDetail(videoId);
        }, 300);
    }

    /**
     * Get keywords for a specific video
     */
    getVideoKeywords(videoId) {
        try {
            if (!this.keywordsCache) {
                return null;
            }

            // Find the video first to get its title
            const videos = this.dataManager.videos || [];
            const video = videos.find(v => v.video_id === videoId);
            if (!video) {
                return null;
            }

            // Try multiple possible key patterns to match keywords
            const possibleKeys = [
                `${video.title}_${video.video_id}_en_auto`,
                `${video.title}_${video.video_id}_en_manual`,
                // Also try patterns without title cleanup
                `${video.title.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, ' ').trim()}_${video.video_id}_en_auto`,
                `${video.title.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, ' ').trim()}_${video.video_id}_en_manual`
            ];

            // Try to find keywords with any of these patterns
            for (const key of possibleKeys) {
                if (this.keywordsCache[key]) {
                    return this.keywordsCache[key];
                }
            }

            return null;
        } catch (error) {
            console.error('Error getting video keywords:', error);
            return null;
        }
    }

    /**
     * Show keyword analytics modal
     */
    async showKeywordAnalytics() {
        const modal = new bootstrap.Modal(document.getElementById('keywordAnalyticsModal'));
        const loadingDiv = document.getElementById('keywordAnalyticsLoading');
        const contentDiv = document.getElementById('keywordAnalyticsContent');

        // Show modal and loading state
        modal.show();
        loadingDiv.style.display = 'block';
        contentDiv.style.display = 'none';

        try {
            // Load keywords cache if not already loaded
            if (!this.keywordsCache) {
                const response = await fetch('data/keywords.json');
                if (!response.ok) {
                    throw new Error('Keywords file not found');
                }
                this.keywordsCache = await response.json();
            }

            // Analyze keyword data
            const analyticsData = await this.analyzeKeywordData();
            
            // Populate the analytics
            this.populateKeywordAnalytics(analyticsData);
            
            // Show content
            loadingDiv.style.display = 'none';
            contentDiv.style.display = 'block';
        } catch (error) {
            console.error('Error generating keyword analytics:', error);
            loadingDiv.innerHTML = `
                <div class="text-center py-5">
                    <i class="bi bi-exclamation-triangle text-warning" style="font-size: 3rem;"></i>
                    <h5 class="mt-3">Unable to Generate Analytics</h5>
                    <p class="text-muted">Failed to analyze keyword data. Please try again.</p>
                </div>
            `;
        }
    }

    /**
     * Analyze keyword data and generate analytics
     */
    async analyzeKeywordData() {
        const keywordStats = new Map();
        const categoryStats = new Map();
        const performanceData = [];
        let totalKeywords = 0;
        let videosWithKeywords = 0;

        // Process each video's keywords
        const videos = this.dataManager.videos || [];
        for (const video of videos) {
            const videoKeywords = this.getVideoKeywords(video.video_id);
            if (videoKeywords && videoKeywords.length > 0) {
                videosWithKeywords++;
                totalKeywords += videoKeywords.length;

                // Analyze each keyword
                for (const keyword of videoKeywords) {
                    const cleanKeyword = keyword.toLowerCase().trim();
                    
                    // Filter out "medical medium" as it's the channel name
                    if (cleanKeyword === 'medical medium') {
                        continue;
                    }
                    
                    if (!keywordStats.has(cleanKeyword)) {
                        keywordStats.set(cleanKeyword, {
                            name: keyword,
                            count: 0,
                            totalViews: 0,
                            totalComments: 0,
                            videos: []
                        });
                    }

                    const stats = keywordStats.get(cleanKeyword);
                    stats.count++;
                    stats.totalViews += parseInt(video.view_count) || 0;
                    stats.totalComments += parseInt(video.comment_count) || 0;
                    stats.videos.push(video);

                    // Categorize keywords
                    const category = this.categorizeKeyword(keyword);
                    if (!categoryStats.has(category)) {
                        categoryStats.set(category, { count: 0, keywords: new Set() });
                    }
                    categoryStats.get(category).count++;
                    categoryStats.get(category).keywords.add(cleanKeyword);
                }
            }
        }

        // Calculate performance metrics
        for (const [keyword, stats] of keywordStats) {
            performanceData.push({
                keyword: keyword,
                name: stats.name,
                count: stats.count,
                avgViews: Math.round(stats.totalViews / stats.count),
                avgComments: Math.round(stats.totalComments / stats.count),
                totalViews: stats.totalViews,
                totalComments: stats.totalComments,
                videos: stats.videos
            });
        }

        // Sort by frequency and performance
        const topByFrequency = [...performanceData].sort((a, b) => b.count - a.count);
        const topByPerformance = [...performanceData].sort((a, b) => b.avgViews - a.avgViews);
        
        // High-Impact Keywords: Frequent keywords (3+ videos) with high average performance
        const highImpactKeywords = performanceData
            .filter(keyword => keyword.count >= 3) // Only keywords appearing in 3+ videos
            .sort((a, b) => {
                // Primary sort: average views
                const viewsDiff = b.avgViews - a.avgViews;
                if (Math.abs(viewsDiff) > 1000) return viewsDiff;
                
                // Secondary sort: frequency (for ties)
                return b.count - a.count;
            });

        return {
            summary: {
                totalUniqueKeywords: keywordStats.size,
                videosWithKeywords: videosWithKeywords,
                avgKeywordsPerVideo: videosWithKeywords > 0 ? Math.round(totalKeywords / videosWithKeywords * 10) / 10 : 0,
                topKeywordFreq: topByFrequency.length > 0 ? topByFrequency[0].count : 0,
                highImpactCount: highImpactKeywords.length
            },
            topByFrequency: topByFrequency.slice(0, 40),
            topByPerformance: topByPerformance.slice(0, 40),
            highImpactKeywords: highImpactKeywords.slice(0, 40),
            categories: Array.from(categoryStats.entries()).map(([name, data]) => ({
                name,
                count: data.count,
                uniqueKeywords: data.keywords.size
            })),
            insights: this.generateKeywordInsights(performanceData, categoryStats)
        };
    }

    /**
     * Categorize a keyword into health/topic categories
     */
    categorizeKeyword(keyword) {
        const k = keyword.toLowerCase();
        
        if (k.includes('virus') || k.includes('bacteria') || k.includes('infection') || k.includes('pathogen')) {
            return 'Pathogens & Infections';
        } else if (k.includes('liver') || k.includes('kidney') || k.includes('brain') || k.includes('heart') || k.includes('thyroid')) {
            return 'Organs & Body Systems';
        } else if (k.includes('anxiety') || k.includes('depression') || k.includes('mood') || k.includes('emotional')) {
            return 'Mental & Emotional Health';
        } else if (k.includes('diet') || k.includes('nutrition') || k.includes('food') || k.includes('eating')) {
            return 'Diet & Nutrition';
        } else if (k.includes('supplement') || k.includes('vitamin') || k.includes('mineral') || k.includes('herb')) {
            return 'Supplements & Herbs';
        } else if (k.includes('detox') || k.includes('cleanse') || k.includes('healing') || k.includes('recovery')) {
            return 'Healing & Detox';
        } else if (k.includes('symptom') || k.includes('pain') || k.includes('fatigue') || k.includes('chronic illness')) {
            return 'Symptoms & Conditions';
        } else if (k.includes('spiritual') || k.includes('meditation') || k.includes('soul') || k.includes('angel')) {
            return 'Spiritual & Mindfulness';
        } else {
            return 'General Health';
        }
    }

    /**
     * Generate insights based on keyword analysis
     */
    generateKeywordInsights(performanceData, categoryStats) {
        const insights = [];

        // Most engaging keyword
        const topPerformer = performanceData.sort((a, b) => b.avgViews - a.avgViews)[0];
        if (topPerformer) {
            insights.push({
                title: "Top Performing Keyword",
                text: `"${topPerformer.name}" generates the highest average views (${topPerformer.avgViews.toLocaleString()}) across ${topPerformer.count} videos.`
            });
        }

        // Most popular category
        const topCategory = Array.from(categoryStats.entries()).sort((a, b) => b[1].count - a[1].count)[0];
        if (topCategory) {
            insights.push({
                title: "Most Popular Category",
                text: `${topCategory[0]} is the most discussed topic with ${topCategory[1].count} keyword mentions across ${topCategory[1].uniqueKeywords} unique terms.`
            });
        }

        // Frequency insights
        const highFreqKeywords = performanceData.filter(k => k.count >= 10);
        if (highFreqKeywords.length > 0) {
            insights.push({
                title: "Consistent Themes",
                text: `${highFreqKeywords.length} keywords appear in 10+ videos, indicating core topics that resonate with the audience.`
            });
        }

        return insights;
    }

    /**
     * Populate the keyword analytics modal with data
     */
    populateKeywordAnalytics(data) {
        // Summary statistics
        document.getElementById('totalUniqueKeywords').textContent = data.summary.totalUniqueKeywords;
        document.getElementById('videosWithKeywords').textContent = data.summary.videosWithKeywords;
        document.getElementById('avgKeywordsPerVideo').textContent = data.summary.avgKeywordsPerVideo;
        document.getElementById('topKeywordFreq').textContent = data.summary.topKeywordFreq;

        // Word cloud
        this.generateWordCloud(data.topByFrequency);

        // Top keywords list
        this.populateKeywordList('topKeywordsList', data.topByFrequency.slice(0, 40), 'frequency');

        // Performance keywords list
        this.populateKeywordList('performingKeywordsList', data.topByPerformance.slice(0, 40), 'performance');

        // High-Impact keywords list
        this.populateKeywordList('highImpactKeywordsList', data.highImpactKeywords.slice(0, 40), 'impact');

        // Categories
        this.populateCategories(data.categories);

        // Insights
        this.populateInsights(data.insights);
    }

    /**
     * Generate word cloud visualization
     */
    generateWordCloud(keywords) {
        const container = document.getElementById('keywordWordCloud');
        container.innerHTML = '';

        // Get top 30 keywords for word cloud
        const cloudKeywords = keywords.slice(0, 30);
        const maxCount = cloudKeywords[0]?.count || 1;

        cloudKeywords.forEach(item => {
            const size = this.getWordCloudSize(item.count, maxCount);
            const element = document.createElement('span');
            element.className = `keyword-cloud-item size-${size}`;
            element.textContent = item.name;
            element.onclick = () => this.filterByKeyword(item.keyword);
            container.appendChild(element);
        });
    }

    /**
     * Get word cloud size class based on frequency
     */
    getWordCloudSize(count, maxCount) {
        const ratio = count / maxCount;
        if (ratio >= 0.8) return 'xl';
        if (ratio >= 0.6) return 'lg';
        if (ratio >= 0.4) return 'md';
        if (ratio >= 0.2) return 'sm';
        return 'xs';
    }

    /**
     * Populate keyword list
     */
    populateKeywordList(containerId, keywords, type) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';

        keywords.forEach((item, index) => {
            const listItem = document.createElement('div');
            listItem.className = 'keyword-item';
            listItem.onclick = () => this.filterByKeyword(item.keyword);

            let metric;
            if (type === 'frequency') {
                metric = `${item.count} videos`;
            } else if (type === 'performance') {
                metric = `${item.avgViews.toLocaleString()} avg views`;
            } else if (type === 'impact') {
                metric = `${item.count} videos • ${item.avgViews.toLocaleString()} avg views`;
            }

            listItem.innerHTML = `
                <div class="keyword-name">${index + 1}. ${item.name}</div>
                <div class="keyword-stats">
                    <span class="keyword-count">${metric}</span>
                </div>
            `;
            container.appendChild(listItem);
        });
    }

    /**
     * Populate categories grid
     */
    populateCategories(categories) {
        const container = document.getElementById('keywordCategories');
        container.innerHTML = '';

        const categoryIcons = {
            'Pathogens & Infections': 'bi-bug',
            'Organs & Body Systems': 'bi-heart-pulse',
            'Mental & Emotional Health': 'fas fa-brain',
            'Diet & Nutrition': 'bi-egg-fried',
            'Supplements & Herbs': 'bi-capsule',
            'Healing & Detox': 'bi-arrow-repeat',
            'Symptoms & Conditions': 'bi-thermometer-half',
            'Spiritual & Mindfulness': 'bi-peace',
            'General Health': 'bi-shield-plus'
        };

        categories.sort((a, b) => b.count - a.count).forEach(category => {
            const card = document.createElement('div');
            card.className = 'category-card';
            card.onclick = () => this.filterByCategory(category.name);

            const icon = categoryIcons[category.name] || 'bi-tag';
            const iconClass = icon.startsWith('fas') ? icon : `bi ${icon}`;
            card.innerHTML = `
                <div class="category-icon">
                    <i class="${iconClass}"></i>
                </div>
                <div class="category-name">${category.name}</div>
                <div class="category-count">${category.count} mentions</div>
            `;
            container.appendChild(card);
        });
    }

    /**
     * Populate insights
     */
    populateInsights(insights) {
        const container = document.getElementById('keywordInsights');
        container.innerHTML = '';

        insights.forEach(insight => {
            const card = document.createElement('div');
            card.className = 'insight-card';
            card.innerHTML = `
                <div class="insight-title">${insight.title}</div>
                <div class="insight-text">${insight.text}</div>
            `;
            container.appendChild(card);
        });
    }

    /**
     * Filter videos by keyword
     */
    filterByKeyword(keyword) {
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('keywordAnalyticsModal'));
        if (modal) modal.hide();

        // Filter videos that have this keyword
        const videos = this.dataManager.videos || [];
        const filteredVideos = videos.filter(video => {
            const keywords = this.getVideoKeywords(video.video_id);
            return keywords && keywords.some(k => k.toLowerCase().includes(keyword.toLowerCase()));
        });

        // Update search input to show the filter
        const searchInput = this.elements.searchInput;
        if (searchInput) {
            searchInput.value = `keyword:"${keyword}"`;
        }

        // Apply filter
        this.currentFilteredVideos = filteredVideos;
        this.renderVideoGrid(filteredVideos);
        
        // Update channel stats
        this.updateChannelStats();
    }

    /**
     * Filter videos by category (placeholder for future enhancement)
     */
    filterByCategory(categoryName) {
        console.log(`Filtering by category: ${categoryName}`);
        // Could implement category-based filtering in the future
    }

}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ArchiveExplorer();
});

// Global function for logo/title clicks
function goToMainView() {
    if (window.app) {
        window.app.goToMainView();
    }
}

// Global function for local archive setup
function showLocalArchiveSetup() {
    if (window.app) {
        window.app.showModeSelection();
        setTimeout(() => {
            document.getElementById('selectLocalArchiveBtn')?.click();
        }, 100);
    }
}

// Global function for logout
function logoutUser() {
    if (window.app) {
        window.app.removeLoginCookie();
        sessionStorage.clear();
        // Show login modal instead of reloading
        const passwordModal = document.getElementById('passwordModal');
        const navbar = document.querySelector('.navbar');
        const app = document.getElementById('app');
        
        if (passwordModal) passwordModal.style.display = 'flex';
        if (navbar) navbar.classList.add('hidden');
        if (app) app.style.display = 'none';
        
        // Reset password input
        const passwordInput = document.getElementById('passwordInput');
        if (passwordInput) passwordInput.value = '';
    }
}

// Export for use in other modules
window.ArchiveExplorer = ArchiveExplorer; 