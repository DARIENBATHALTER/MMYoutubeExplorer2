#!/usr/bin/env node

/**
 * Aggressive File Matcher Script
 * 
 * This script uses multiple matching strategies to achieve maximum file association:
 * 1. Extract shortcodes from filenames and match to video IDs
 * 2. Fuzzy title matching with similarity scoring
 * 3. Partial string matching for edge cases
 * 4. Manual review suggestions for ambiguous cases
 * 
 * Run with: node aggressive_file_matcher.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');

// Configuration
const DATA_DIR = './data';
const VIDEOS_FILE = path.join(DATA_DIR, 'videos.json');
const KEYWORDS_FILE = path.join(DATA_DIR, 'keywords.json');
const SUBTITLES_DIR = path.join(DATA_DIR, 'subtitles');
const SUMMARIES_DIR = path.join(DATA_DIR, 'summaries');
const BACKUP_DIR = path.join(DATA_DIR, 'backup_aggressive_' + Date.now());

// Results tracking
const results = {
    matches_found: [],
    potential_matches: [],
    unmatched_files: [],
    unmatched_videos: [],
    errors: [],
    stats: {
        total_files_processed: 0,
        successful_matches: 0,
        fuzzy_matches: 0,
        shortcode_matches: 0,
        title_matches: 0
    }
};

let dryRun = process.argv.includes('--dry-run');

/**
 * Extract all possible video IDs/shortcodes from a filename
 */
function extractShortcodes(filename) {
    const shortcodes = [];
    
    // Pattern 1: Standard YouTube IDs (11 characters, alphanumeric + - _)
    const youtubePattern = /[A-Za-z0-9_-]{11}/g;
    const matches = filename.match(youtubePattern);
    if (matches) {
        shortcodes.push(...matches);
    }
    
    // Pattern 2: Shorter codes that might be truncated
    const shortPattern = /[A-Za-z0-9_-]{8,15}/g;
    const shortMatches = filename.match(shortPattern);
    if (shortMatches) {
        shortcodes.push(...shortMatches.filter(code => 
            code.length >= 8 && !shortcodes.includes(code)
        ));
    }
    
    // Pattern 3: Codes at the beginning of filename
    const prefixPattern = /^([A-Za-z0-9_-]+)\s/;
    const prefixMatch = filename.match(prefixPattern);
    if (prefixMatch) {
        shortcodes.push(prefixMatch[1]);
    }
    
    return [...new Set(shortcodes)];
}

/**
 * Calculate string similarity using Levenshtein distance
 */
function stringSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
}

/**
 * Levenshtein distance implementation
 */
function levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    
    return matrix[str2.length][str1.length];
}

/**
 * Clean title for comparison
 */
function cleanTitle(title) {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Extract meaningful title words (excluding common words)
 */
function extractTitleKeywords(title) {
    const commonWords = new Set([
        'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
        'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
        'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can',
        'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
        'medical', 'medium', 'anthony', 'william', 'radio', 'show', 'archive', 'episode'
    ]);
    
    return cleanTitle(title)
        .split(' ')
        .filter(word => word.length > 2 && !commonWords.has(word));
}

/**
 * Find best video match for a file using multiple strategies
 */
function findBestMatch(filename, videos) {
    const baseName = filename.replace(/\.(txt|json|srt)$/, '').replace(/_summary$/, '');
    const extractedShortcodes = extractShortcodes(baseName);
    
    console.log(`🔍 Analyzing: ${filename}`);
    console.log(`   Extracted codes: ${extractedShortcodes.join(', ')}`);
    
    // Strategy 1: Direct shortcode matching
    for (const shortcode of extractedShortcodes) {
        const directMatch = videos.find(video => video.video_id === shortcode);
        if (directMatch) {
            console.log(`   ✅ Direct shortcode match: ${shortcode} → ${directMatch.title}`);
            return {
                video: directMatch,
                confidence: 1.0,
                method: 'shortcode_exact',
                matchedCode: shortcode
            };
        }
    }
    
    // Strategy 2: Partial shortcode matching
    for (const shortcode of extractedShortcodes) {
        const partialMatches = videos.filter(video => 
            video.video_id.includes(shortcode) || shortcode.includes(video.video_id)
        );
        if (partialMatches.length === 1) {
            console.log(`   ✅ Partial shortcode match: ${shortcode} → ${partialMatches[0].title}`);
            return {
                video: partialMatches[0],
                confidence: 0.9,
                method: 'shortcode_partial',
                matchedCode: shortcode
            };
        }
    }
    
    // Strategy 3: Title-based fuzzy matching
    const fileTitle = cleanTitle(baseName.replace(/[A-Za-z0-9_-]{8,15}/g, '').trim());
    const fileTitleKeywords = extractTitleKeywords(fileTitle);
    
    let bestTitleMatch = null;
    let bestTitleScore = 0;
    
    for (const video of videos) {
        const videoTitle = cleanTitle(video.title);
        const videoKeywords = extractTitleKeywords(video.title);
        
        // Calculate similarity scores
        const directSimilarity = stringSimilarity(fileTitle, videoTitle);
        
        // Keyword overlap score
        const commonKeywords = fileTitleKeywords.filter(word => videoKeywords.includes(word));
        const keywordScore = commonKeywords.length / Math.max(fileTitleKeywords.length, 1);
        
        // Combined score
        const combinedScore = (directSimilarity * 0.7) + (keywordScore * 0.3);
        
        if (combinedScore > bestTitleScore && combinedScore > 0.6) {
            bestTitleScore = combinedScore;
            bestTitleMatch = {
                video: video,
                confidence: combinedScore,
                method: 'title_fuzzy',
                titleSimilarity: directSimilarity,
                keywordScore: keywordScore,
                commonKeywords: commonKeywords
            };
        }
    }
    
    if (bestTitleMatch) {
        console.log(`   ✅ Title fuzzy match: ${bestTitleMatch.confidence.toFixed(3)} → ${bestTitleMatch.video.title}`);
        console.log(`      Keywords: ${bestTitleMatch.commonKeywords.join(', ')}`);
        return bestTitleMatch;
    }
    
    // Strategy 4: Relaxed title matching for edge cases
    for (const video of videos) {
        const videoWords = extractTitleKeywords(video.title);
        const fileWords = extractTitleKeywords(baseName);
        
        // Check if filename contains significant portion of video title
        const matchedWords = videoWords.filter(word => 
            fileWords.some(fileWord => fileWord.includes(word) || word.includes(fileWord))
        );
        
        if (matchedWords.length >= 2 && matchedWords.length >= videoWords.length * 0.5) {
            console.log(`   ✅ Relaxed title match: ${video.title}`);
            console.log(`      Matched words: ${matchedWords.join(', ')}`);
            return {
                video: video,
                confidence: 0.7,
                method: 'title_relaxed',
                matchedWords: matchedWords
            };
        }
    }
    
    console.log(`   ❌ No match found`);
    return null;
}

/**
 * Process all unmatched files in a directory
 */
function processUnmatchedFiles(directory, videos, fileType) {
    if (!fs.existsSync(directory)) {
        console.log(`📁 ${fileType} directory not found: ${directory}`);
        return;
    }
    
    console.log(`\n🔄 Processing unmatched ${fileType} files...`);
    const files = fs.readdirSync(directory);
    const txtFiles = files.filter(f => f.endsWith('.txt') && !f.startsWith('.'));
    
    for (const file of txtFiles) {
        results.stats.total_files_processed++;
        
        // Check if this file already has a proper match by trying current naming convention
        const hasExistingMatch = videos.some(video => {
            const cleanTitle = video.title.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, ' ').trim();
            const suffix = fileType === 'summaries' ? '_summary' : '';
            const expectedName = `${cleanTitle}_${video.video_id}_en_auto${suffix}.txt`;
            return file === expectedName;
        });
        
        if (hasExistingMatch) {
            console.log(`✅ ${file} - Already properly matched`);
            continue;
        }
        
        // Try to find a match
        const match = findBestMatch(file, videos);
        
        if (match) {
            const targetName = generateStandardFilename(match.video, fileType === 'summaries' ? 'summary' : '', 'txt');
            
            results.matches_found.push({
                originalFile: file,
                targetFile: targetName,
                video: match.video,
                confidence: match.confidence,
                method: match.method,
                directory: fileType,
                details: match
            });
            
            // Update stats
            results.stats.successful_matches++;
            if (match.method.startsWith('shortcode')) {
                results.stats.shortcode_matches++;
            } else if (match.method.startsWith('title')) {
                results.stats.title_matches++;
            }
            if (match.confidence < 1.0) {
                results.stats.fuzzy_matches++;
            }
            
        } else {
            results.unmatched_files.push({
                file: file,
                directory: fileType,
                extractedCodes: extractShortcodes(file),
                cleanedTitle: cleanTitle(file)
            });
        }
    }
}

/**
 * Generate standard filename
 */
function generateStandardFilename(video, type = '', extension = 'txt') {
    const cleanTitle = video.title.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, ' ').trim();
    const videoId = video.video_id;
    const suffix = type ? `_${type}` : '';
    return `${cleanTitle}_${videoId}_en_auto${suffix}.${extension}`;
}

/**
 * Apply the matches found
 */
function applyMatches() {
    if (dryRun) {
        console.log('\n📝 DRY RUN - No files will be renamed');
        return;
    }
    
    // Create backup directory
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
        console.log(`📁 Created backup directory: ${BACKUP_DIR}`);
    }
    
    console.log('\n🔄 Applying matches...');
    
    for (const match of results.matches_found) {
        const sourceDir = match.directory === 'summaries' ? SUMMARIES_DIR : SUBTITLES_DIR;
        const sourcePath = path.join(sourceDir, match.originalFile);
        const targetPath = path.join(sourceDir, match.targetFile);
        
        // Check if target already exists
        if (fs.existsSync(targetPath)) {
            console.log(`⚠️  Target exists, skipping: ${match.targetFile}`);
            continue;
        }
        
        try {
            // Backup original
            const backupPath = path.join(BACKUP_DIR, match.originalFile);
            fs.copyFileSync(sourcePath, backupPath);
            
            // Rename file
            fs.renameSync(sourcePath, targetPath);
            console.log(`✅ Renamed: ${match.originalFile} → ${match.targetFile}`);
            console.log(`   Method: ${match.method}, Confidence: ${match.confidence.toFixed(3)}`);
            
        } catch (error) {
            console.error(`❌ Failed to rename ${match.originalFile}:`, error.message);
            results.errors.push(`Failed to rename ${match.originalFile}: ${error.message}`);
        }
    }
}

/**
 * Generate comprehensive report
 */
function generateReport() {
    console.log('\n🎯 AGGRESSIVE FILE MATCHING REPORT');
    console.log('=' .repeat(60));
    
    console.log('\n📊 MATCHING STATISTICS:');
    console.log(`Files processed: ${results.stats.total_files_processed}`);
    console.log(`Successful matches: ${results.stats.successful_matches}`);
    console.log(`Shortcode matches: ${results.stats.shortcode_matches}`);
    console.log(`Title matches: ${results.stats.title_matches}`);
    console.log(`Fuzzy matches: ${results.stats.fuzzy_matches}`);
    
    if (results.matches_found.length > 0) {
        console.log('\n✅ NEW MATCHES FOUND:');
        results.matches_found.forEach((match, i) => {
            console.log(`${i + 1}. ${match.originalFile}`);
            console.log(`   → ${match.targetFile}`);
            console.log(`   Video: ${match.video.title}`);
            console.log(`   Method: ${match.method}, Confidence: ${match.confidence.toFixed(3)}`);
            if (match.details.matchedCode) {
                console.log(`   Matched code: ${match.details.matchedCode}`);
            }
            console.log('');
        });
    }
    
    if (results.unmatched_files.length > 0) {
        console.log(`\n❌ STILL UNMATCHED (${results.unmatched_files.length} files):`);
        results.unmatched_files.slice(0, 10).forEach((item, i) => {
            console.log(`${i + 1}. ${item.file}`);
            console.log(`   Codes: ${item.extractedCodes.join(', ')}`);
            console.log(`   Title: ${item.cleanedTitle}`);
        });
        if (results.unmatched_files.length > 10) {
            console.log(`   ... and ${results.unmatched_files.length - 10} more`);
        }
    }
    
    // Find videos without files
    console.log('\n🔍 ANALYZING MISSING CONTENT...');
    const allVideoIds = new Set();
    videos.forEach(video => allVideoIds.add(video.video_id));
    
    const matchedVideoIds = new Set();
    results.matches_found.forEach(match => matchedVideoIds.add(match.video.video_id));
    
    // Check existing files
    if (fs.existsSync(SUBTITLES_DIR)) {
        const existingFiles = fs.readdirSync(SUBTITLES_DIR);
        existingFiles.forEach(file => {
            const match = file.match(/_([A-Za-z0-9_-]{11})_en_auto\.txt$/);
            if (match) {
                matchedVideoIds.add(match[1]);
            }
        });
    }
    
    const videosWithoutFiles = videos.filter(video => !matchedVideoIds.has(video.video_id));
    
    console.log(`\nVideos still without subtitle files: ${videosWithoutFiles.length}`);
    if (videosWithoutFiles.length > 0 && videosWithoutFiles.length <= 20) {
        videosWithoutFiles.forEach((video, i) => {
            console.log(`${i + 1}. ${video.video_id} - ${video.title}`);
        });
    }
    
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('1. Run verification script to see final improvement');
    console.log('2. Check unmatched files manually for any obvious patterns');
    console.log('3. Consider if remaining unmatched files are actually missing content');
    
    if (!dryRun) {
        console.log(`\n💾 Backup created at: ${BACKUP_DIR}`);
    }
    
    console.log('\n✅ AGGRESSIVE MATCHING COMPLETE!');
    console.log('=' .repeat(60));
    
    // Save detailed report
    const reportFile = `aggressive_match_report_${dryRun ? 'dry_run_' : ''}${Date.now()}.json`;
    fs.writeFileSync(reportFile, JSON.stringify(results, null, 2));
    console.log(`\n📋 Detailed report saved: ${reportFile}`);
}

/**
 * Main execution
 */
async function main() {
    console.log('🚀 Starting aggressive file matching...');
    
    if (dryRun) {
        console.log('📝 DRY RUN MODE - No files will be modified');
    }
    
    try {
        // Load videos
        if (!fs.existsSync(VIDEOS_FILE)) {
            throw new Error(`Videos file not found: ${VIDEOS_FILE}`);
        }
        
        global.videos = JSON.parse(fs.readFileSync(VIDEOS_FILE, 'utf8'));
        console.log(`✅ Loaded ${videos.length} videos`);
        
        // Process subtitle and summary files
        processUnmatchedFiles(SUBTITLES_DIR, videos, 'subtitles');
        processUnmatchedFiles(SUMMARIES_DIR, videos, 'summaries');
        
        // Apply matches if not dry run
        if (!dryRun && results.matches_found.length > 0) {
            applyMatches();
        }
        
        // Generate report
        generateReport();
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

// Show usage if help requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`
Aggressive File Matcher

Usage:
  node aggressive_file_matcher.js [options]

Options:
  --dry-run    Show what would be matched without making changes
  --help, -h   Show this help message

This script uses multiple strategies to match files to videos:
1. Direct and partial shortcode matching
2. Fuzzy title similarity matching
3. Keyword-based matching
4. Relaxed pattern matching for edge cases
`);
    process.exit(0);
}

// Run the script
if (require.main === module) {
    main();
}

module.exports = { main, findBestMatch, extractShortcodes, stringSimilarity };