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
            
            // Hide loading screen initially
            this.elements.loadingScreen.style.display = 'none';
            
            // Grey out navbar initially
            const navbar = document.querySelector('.navbar');
            if (navbar) {
                navbar.classList.add('hidden');
            }
            
            // Check if we should bypass login screen
            if (sessionStorage.getItem('bypassLogin') === 'true') {
                // Clear the flag
                sessionStorage.removeItem('bypassLogin');
                
                // Show navbar
                if (navbar) {
                    navbar.classList.remove('hidden');
                }
                
                // Go directly to mode selection
                this.showModeSelection();
                
                // Set up interactive gradient backgrounds for the welcome screen
                this.setupInteractiveGradients();
                
                return;
            }
            
            // Check if we should bypass both login and welcome screens (from sidebar navigation)
            if (sessionStorage.getItem('bypassWelcome') === 'true') {
                // Clear the flag
                sessionStorage.removeItem('bypassWelcome');
                
                // Show navbar
                if (navbar) {
                    navbar.classList.remove('hidden');
                }
                
                // Go directly to main YouTube app (bypass welcome screen)
                this.setupEventListeners();
                this.loadData();
                
                return;
            }
            
            // Set up password verification
            this.setupPasswordVerification();
            
            // Set up interactive gradient backgrounds
            this.setupInteractiveGradients();
            
        } catch (error) {
            console.error('❌ Failed to initialize app:', error);
            this.showError('Failed to load the archive. Please refresh the page.');
        }
    }

    /**
     * Check if user is already logged in via cookie
     */
    checkExistingLogin() {
        const loginCookie = this.getCookie('mmarchive_logged_in');
        return loginCookie === 'true';
    }

    /**
     * Set login cookie
     */
    setLoginCookie() {
        const expiryDate = new Date();
        expiryDate.setTime(expiryDate.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days
        document.cookie = `mmarchive_logged_in=true; expires=${expiryDate.toUTCString()}; path=/`;
    }

    /**
     * Remove login cookie
     */
    removeLoginCookie() {
        document.cookie = 'mmarchive_logged_in=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/';
    }

    /**
     * Get cookie value
     */
    getCookie(name) {
        const nameEQ = name + "=";
        const ca = document.cookie.split(';');
        for(let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) == ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
        }
        return null;
    }

    /**
     * Handle successful login
     */
    handleSuccessfulLogin() {
        // Set login cookie
        this.setLoginCookie();
        
        // Show navbar
        const navbar = document.querySelector('.navbar');
        if (navbar) {
            navbar.classList.remove('hidden');
        }
        
        // Fade out only the password modal content, keeping background
        const passwordModal = document.getElementById('passwordModal');
        const passwordContent = passwordModal.querySelector('.password-modal-content');
        if (passwordContent) {
            passwordContent.style.transition = 'opacity 0.5s ease-out';
            passwordContent.style.opacity = '0';
        }
        
        setTimeout(() => {
            // Show mode selection after fade completes
            this.showModeSelection();
        }, 500);
    }

    /**
     * Set up password verification
     */
    setupPasswordVerification() {
        const passwordForm = document.getElementById('passwordForm');
        const passwordInput = document.getElementById('passwordInput');
        const passwordError = document.getElementById('passwordError');
        const passwordModal = document.getElementById('passwordModal');

        // Check if already logged in and not bypassing welcome
        if (this.checkExistingLogin() && sessionStorage.getItem('bypassWelcome') !== 'true') {
            this.handleSuccessfulLogin();
            return;
        }
        
        // Handle password form submission
        passwordForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const password = passwordInput.value;
            const correctPassword = 'mmwelcome';
            const submitBtn = document.getElementById('passwordSubmitBtn');
            const submitContent = submitBtn.querySelector('.submit-content');
            const loadingContent = submitBtn.querySelector('.loading-content');
            
            // Show loading state
            submitBtn.disabled = true;
            submitContent.style.display = 'none';
            loadingContent.style.display = 'flex';
            loadingContent.style.alignItems = 'center';
            loadingContent.style.justifyContent = 'center';
            
            // Simulate brief loading period
            setTimeout(() => {
                if (password === correctPassword) {
                    this.handleSuccessfulLogin();
                } else {
                    // Reset button state
                    submitBtn.disabled = false;
                    submitContent.style.display = 'block';
                    loadingContent.style.display = 'none';
                    
                    // Show error message
                    passwordError.style.display = 'block';
                    passwordInput.value = '';
                    passwordInput.focus();
                    
                    // Hide error after 3 seconds
                    setTimeout(() => {
                        passwordError.style.display = 'none';
                    }, 3000);
                }
            }, 800); // Brief loading delay
        });
        
        // Focus on password input
        passwordInput.focus();
    }

    /**
     * Set up interactive gradient backgrounds
     */
    setupInteractiveGradients() {
        const passwordModal = document.getElementById('passwordModal');
        const directoryModal = document.getElementById('directorySelectionModal');
        
        // Add mouse movement listeners to both modals
        [passwordModal, directoryModal].forEach(modal => {
            if (modal) {
                modal.addEventListener('mousemove', (e) => {
                    // Subtle movement of gradient spheres
                    const spheres = modal.querySelectorAll('.gradient-sphere');
                    const moveX = (e.clientX / window.innerWidth - 0.5) * 5;
                    const moveY = (e.clientY / window.innerHeight - 0.5) * 5;
                    
                    spheres.forEach((sphere, index) => {
                        const multiplier = (index + 1) * 0.3; // Different movement for each sphere
                        sphere.style.transform = `translate(${moveX * multiplier}px, ${moveY * multiplier}px)`;
                    });
                });
            }
        });
    }

    /**
     * Show mode selection modal
     */
    showModeSelection() {
        const passwordModal = document.getElementById('passwordModal');
        const modal = document.getElementById('directorySelectionModal');
        const modeSelection = document.getElementById('modeSelection');
        const localArchiveSetup = document.getElementById('localArchiveSetup');
        
        // Hide password modal completely
        if (passwordModal) {
            passwordModal.style.display = 'none';
        }
        
        // Show modal and mode selection
        modal.style.display = 'flex';
        modeSelection.style.display = 'block';
        localArchiveSetup.style.display = 'none';
        
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
        
        // Reset any loading buttons to normal state
        const buttons = ['selectLocalArchiveBtn', 'selectYouTubeBtn', 'selectInstagramBtn', 'selectFacebookBtn'];
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
        const selectInstagramBtn = document.getElementById('selectInstagramBtn');
        const selectFacebookBtn = document.getElementById('selectFacebookBtn');
        const backToModeSelection = document.getElementById('backToModeSelection');
        const selectDirectoryBtn = document.getElementById('selectDirectoryBtn');
        const useLocalServerBtn = document.getElementById('useLocalServerBtn');
        const continueToAppBtn = document.getElementById('continueToAppBtn');
        const retryDirectoryBtn = document.getElementById('retryDirectoryBtn');
        
        // Make entire cards clickable
        const localArchiveCard = document.getElementById('localArchiveCard');
        const youtubeCard = document.getElementById('youtubeCard');
        const instagramCard = document.getElementById('instagramCard');
        const facebookCard = document.getElementById('facebookCard');
        
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
        
        // Instagram Mode Selection (entire card clickable)
        if (instagramCard) {
            instagramCard.addEventListener('click', (e) => {
                // Prevent double-click if clicking on button
                if (e.target.tagName === 'BUTTON') return;
                this.handleInstagramModeSelection();
            });
        }
        
        if (selectInstagramBtn) {
            selectInstagramBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent card click
                this.handleInstagramModeSelection();
            });
        }
        
        // Facebook Mode Selection (entire card clickable)
        if (facebookCard) {
            facebookCard.addEventListener('click', (e) => {
                // Prevent double-click if clicking on button
                if (e.target.tagName === 'BUTTON') return;
                this.handleFacebookModeSelection();
            });
        }
        
        if (selectFacebookBtn) {
            selectFacebookBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent card click
                this.handleFacebookModeSelection();
            });
        }
        
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