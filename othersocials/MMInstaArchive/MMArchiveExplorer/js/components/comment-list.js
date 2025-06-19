/**
 * CommentList Component - Handles comment rendering and interactions
 * This component can be extended for more advanced comment features
 */
class CommentListComponent {
    constructor(container, exportService) {
        this.container = container;
        this.exportService = exportService;
        this.comments = [];
        this.isLoading = false;
        
        this.setupEventHandlers();
    }

    /**
     * Setup event handlers for comment list
     */
    setupEventHandlers() {
        this.container.addEventListener('click', (e) => {
            if (e.target.matches('.export-btn') || e.target.closest('.export-btn')) {
                e.preventDefault();
                const btn = e.target.closest('.export-btn');
                const commentId = btn.dataset.commentId;
                this.showExportMenu(btn, commentId);
            }
        });

        // Close export menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.export-menu') && !e.target.closest('.export-btn')) {
                this.hideExportMenu();
            }
        });

        // Setup virtual scrolling if container gets large
        this.setupVirtualScrolling();
    }

    /**
     * Setup virtual scrolling for performance with large comment lists
     */
    setupVirtualScrolling() {
        // Basic implementation - can be enhanced for better performance
        let isScrolling = false;
        
        this.container.addEventListener('scroll', () => {
            if (!isScrolling) {
                window.requestAnimationFrame(() => {
                    this.onScroll?.();
                    isScrolling = false;
                });
                isScrolling = true;
            }
        });
    }

    /**
     * Render comments list
     */
    render(comments, append = false) {
        this.isLoading = true;
        
        const html = comments.map(comment => this.createCommentCard(comment)).join('');
        
        if (append) {
            this.container.insertAdjacentHTML('beforeend', html);
            this.comments.push(...comments);
        } else {
            this.container.innerHTML = html;
            this.comments = [...comments];
        }
        
        this.isLoading = false;
        this.updateInteractiveElements();
    }

    /**
     * Create comment card HTML with replies
     */
    createCommentCard(comment) {
        let html = this.createSingleComment(comment, false);
        
        // Add replies if any
        if (comment.replies && comment.replies.length > 0) {
            const repliesHtml = comment.replies.map(reply => 
                this.createSingleComment(reply, true)
            ).join('');
            html += repliesHtml;
        }
        
        return html;
    }

    /**
     * Create single comment HTML
     */
    createSingleComment(comment, isReply = false) {
        const avatarColor = this.generateAvatarColor(comment.author);
        const firstLetter = comment.author[1]?.toUpperCase() || comment.author[0]?.toUpperCase() || 'U';
        
        // Format date to show time ago (e.g., "2d", "1w", "3mo")
        const formatTimeAgo = (dateStr) => {
            const date = dateStr instanceof Date ? dateStr : new Date(dateStr);
            
            // Check if date is valid
            if (isNaN(date.getTime())) {
                console.warn('Invalid date:', dateStr);
                return '1d'; // Default fallback
            }
            
            const now = new Date();
            const diffMs = now - date;
            const diffSecs = Math.floor(diffMs / 1000);
            const diffMins = Math.floor(diffSecs / 60);
            const diffHours = Math.floor(diffMins / 60);
            const diffDays = Math.floor(diffHours / 24);
            const diffWeeks = Math.floor(diffDays / 7);
            const diffMonths = Math.floor(diffDays / 30);
            const diffYears = Math.floor(diffDays / 365);
            
            if (diffYears > 0) return diffYears + 'y';
            if (diffMonths > 0) return diffMonths + 'mo';
            if (diffWeeks > 0) return diffWeeks + 'w';
            if (diffDays > 0) return diffDays + 'd';
            if (diffHours > 0) return diffHours + 'h';
            if (diffMins > 0) return diffMins + 'm';
            if (diffSecs > 0) return 'just now';
            return '1d'; // For any future dates or edge cases
        };
        
        const timeAgo = formatTimeAgo(comment.published_at || comment.commentAt);
        const likes = comment.like_count || comment.reactionsCount || 0;
        const likesText = likes > 0 ? `${this.formatNumber(likes)} ${likes === 1 ? 'like' : 'likes'}` : '';
        const heartIcon = comment.channel_owner_liked ? '❤️' : '';
        
        const cardClass = isReply ? 'reply-card comment-card' : 'comment-card';
        const marginLeft = isReply ? 'margin-left: 44px;' : '';
        
        // Use local avatar for medicalmedium, Instagram profile picture for others, otherwise fallback to colored initial
        const avatarUrl = comment.author === 'medicalmedium' ? 'MMCommentExplorer.webp' : comment.avatar;
        const avatarElement = avatarUrl ? `
            <img src="${avatarUrl}" 
                 alt="${this.escapeHTML(comment.author)}" 
                 class="comment-avatar-img"
                 onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
            <div class="comment-avatar-initial" style="
                background-color: ${avatarColor}; 
                display: none;
            ">
                ${firstLetter}
            </div>
        ` : `
            <div class="comment-avatar-initial" style="
                background-color: ${avatarColor}; 
                display: flex;
            ">
                ${firstLetter}
            </div>
        `;
        
        return `
            <div class="${cardClass}" style="${marginLeft}">
                <div class="profile-avatar">
                    ${avatarElement}
                </div>
                <div class="comment-content">
                    <div class="comment-text">
                        <span class="comment-author">${this.escapeHTML(comment.author)}</span>
                        ${this.highlightText(this.escapeHTML(comment.text || comment.content))}
                    </div>
                    <div class="comment-actions">
                        <span class="comment-date">${timeAgo}</span>
                        ${likesText ? `<span class="comment-likes">${likesText}</span>` : ''}
                        ${heartIcon ? `<span class="channel-owner-liked">${heartIcon}</span>` : ''}
                    </div>
                </div>
                <div class="comment-export">
                    <button class="export-btn" 
                            data-comment-id="${comment.comment_id}"
                            title="Export this comment as PNG">
                        <i class="bi bi-download"></i>
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Render loading skeleton
     */
    renderSkeleton(count = 5) {
        const skeletonComments = Array(count).fill(0).map(() => `
            <div class="comment-card skeleton">
                <div class="comment-header">
                    <div class="d-flex align-items-center">
                        <div class="skeleton" style="width: 32px; height: 32px; border-radius: 50%; margin-right: 12px;"></div>
                        <div>
                            <div class="skeleton" style="width: 120px; height: 14px; margin-bottom: 4px;"></div>
                            <div class="skeleton" style="width: 80px; height: 12px;"></div>
                        </div>
                    </div>
                </div>
                <div class="skeleton" style="width: 100%; height: 16px; margin-bottom: 8px;"></div>
                <div class="skeleton" style="width: 80%; height: 16px; margin-bottom: 8px;"></div>
                <div class="skeleton" style="width: 60px; height: 14px;"></div>
            </div>
        `).join('');

        this.container.innerHTML = skeletonComments;
    }

    /**
     * Update interactive elements after rendering
     */
    updateInteractiveElements() {
        // Add tooltips to export buttons
        this.container.querySelectorAll('.export-btn').forEach(btn => {
            btn.title = 'Export this comment as PNG';
        });

        // Remove problematic hover animations that interfere with export buttons
        // this.container.querySelectorAll('.comment-card').forEach(card => {
        //     card.addEventListener('mouseenter', () => {
        //         card.style.transform = 'translateY(-1px)';
        //     });
        //     
        //     card.addEventListener('mouseleave', () => {
        //         card.style.transform = 'translateY(0)';
        //     });
        // });
    }

    /**
     * Highlight search terms in text
     */
    highlightText(text, searchTerm = '') {
        if (!searchTerm) return text;
        
        const regex = new RegExp(`(${this.escapeRegex(searchTerm)})`, 'gi');
        return text.replace(regex, '<mark class="search-highlight">$1</mark>');
    }

    /**
     * Escape regex special characters
     */
    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
            hash = hash & hash;
        }
        return Math.abs(hash);
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
     * Set search term for highlighting
     */
    setSearchTerm(term) {
        this.searchTerm = term;
        // Re-render with highlighting
        this.render(this.comments);
    }

    /**
     * Set comment export handler
     */
    setCommentExportHandler(handler) {
        this.onCommentExport = handler;
    }

    /**
     * Set scroll handler
     */
    setScrollHandler(handler) {
        this.onScroll = handler;
    }

    /**
     * Get current comments
     */
    getComments() {
        return [...this.comments];
    }

    /**
     * Clear comments
     */
    clear() {
        this.container.innerHTML = '';
        this.comments = [];
    }

    /**
     * Show empty state
     */
    showEmptyState(message = 'No comments found') {
        this.container.innerHTML = `
            <div class="text-center py-5 text-muted">
                <i class="bi bi-chat-square-text" style="font-size: 3rem; opacity: 0.5;"></i>
                <p class="mt-3">${message}</p>
            </div>
        `;
    }

    /**
     * Show export format menu
     */
    showExportMenu(button, commentId) {
        // Hide any existing menu
        this.hideExportMenu();

        // Create menu
        const menu = document.createElement('div');
        menu.className = 'export-menu';
        menu.innerHTML = `
            <div class="export-menu-option" data-format="comment-only" data-comment-id="${commentId}">
                <span>Export comment only</span>
            </div>
            <div class="export-menu-option" data-format="iphone-dark" data-comment-id="${commentId}">
                <span>Export iPhone dark</span>
            </div>
            <div class="export-menu-option" data-format="iphone-light" data-comment-id="${commentId}">
                <span>Export iPhone light</span>
            </div>
        `;

        // Position menu relative to button
        const buttonRect = button.getBoundingClientRect();
        menu.style.position = 'fixed';
        menu.style.top = (buttonRect.bottom + 5) + 'px';
        menu.style.left = (buttonRect.left - 100) + 'px'; // Offset to the left
        menu.style.zIndex = '1000';

        // Add menu to body
        document.body.appendChild(menu);

        // Add click handlers for menu options
        menu.addEventListener('click', (e) => {
            const option = e.target.closest('.export-menu-option');
            if (option) {
                const format = option.dataset.format;
                const commentId = option.dataset.commentId;
                this.handleExportFormat(commentId, format);
                this.hideExportMenu();
            }
        });
    }

    /**
     * Hide export menu
     */
    hideExportMenu() {
        const existingMenu = document.querySelector('.export-menu');
        if (existingMenu) {
            existingMenu.remove();
        }
    }

    /**
     * Handle export format selection
     */
    handleExportFormat(commentId, format) {
        console.log(`🔄 handleExportFormat called: commentId=${commentId}, format=${format}`);
        console.log(`🔗 onCommentExport callback exists:`, !!this.onCommentExport);
        this.onCommentExport?.(commentId, format);
    }
}

// Export for use in other modules
window.CommentListComponent = CommentListComponent; 