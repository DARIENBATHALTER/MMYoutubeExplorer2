#!/usr/bin/env node

/**
 * Keywords Association Fixer Script
 * 
 * This script fixes keyword associations by:
 * 1. Matching existing keyword keys to videos using multiple strategies
 * 2. Standardizing keyword keys to match current file naming convention
 * 3. Removing orphaned keyword entries
 * 4. Adding missing keyword entries where possible
 * 
 * Run with: node fix_keywords_associations.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');

// Configuration
const DATA_DIR = './data';
const VIDEOS_FILE = path.join(DATA_DIR, 'videos.json');
const KEYWORDS_FILE = path.join(DATA_DIR, 'keywords.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backup_keywords_' + Date.now());

// Results tracking
const results = {
    matched_keywords: {},
    fixed_keywords: [],
    orphaned_keywords: [],
    unmatched_videos: [],
    errors: [],
    stats: {
        total_keyword_entries: 0,
        successful_matches: 0,
        fixed_entries: 0,
        orphaned_entries: 0
    }
};

let dryRun = process.argv.includes('--dry-run');

/**
 * Clean and standardize text for matching
 */
function cleanText(text) {
    return text
        .replace(/&amp;/g, '&')
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/You39re/g, "You're")
        .replace(/won39t/g, "won't")
        .replace(/don39t/g, "don't")
        .replace(/can39t/g, "can't")
        .replace(/isn39t/g, "isn't")
        .replace(/aren39t/g, "aren't")
        .replace(/hasn39t/g, "hasn't")
        .replace(/haven39t/g, "haven't")
        .replace(/wouldn39t/g, "wouldn't")
        .replace(/shouldn39t/g, "shouldn't")
        .replace(/doesn39t/g, "doesn't")
        .replace(/I39m/g, "I'm")
        .replace(/I39ve/g, "I've")
        .replace(/I39ll/g, "I'll")
        .replace(/It39s/g, "It's")
        .replace(/That39s/g, "That's")
        .replace(/What39s/g, "What's")
        .replace(/Who39s/g, "Who's")
        .replace(/Where39s/g, "Where's")
        .replace(/There39s/g, "There's")
        .replace(/amp /g, '& ')
        .replace(/ amp /g, ' & ')
        .replace(/amp$/g, '&')
        .trim();
}

/**
 * Generate standard filename for a video (same as other scripts)
 */
function generateStandardFilename(video, type = '', extension = '') {
    const cleanTitle = video.title.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, ' ').trim();
    const videoId = video.video_id;
    const suffix = type ? `_${type}` : '';
    const ext = extension ? `.${extension}` : '';
    return `${cleanTitle}_${videoId}_en_auto${suffix}${ext}`;
}

/**
 * Extract video ID from keyword key
 */
function extractVideoIdFromKey(keywordKey) {
    // Look for 11-character YouTube ID pattern
    const match = keywordKey.match(/([A-Za-z0-9_-]{11})_en_auto/);
    return match ? match[1] : null;
}

/**
 * Calculate string similarity (reuse from aggressive matcher)
 */
function stringSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
}

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
 * Find best video match for a keyword key
 */
function findVideoForKeywordKey(keywordKey, videos) {
    // Strategy 1: Extract video ID directly
    const extractedId = extractVideoIdFromKey(keywordKey);
    if (extractedId) {
        const directMatch = videos.find(video => video.video_id === extractedId);
        if (directMatch) {
            return {
                video: directMatch,
                method: 'video_id_direct',
                confidence: 1.0
            };
        }
    }
    
    // Strategy 2: Clean the keyword key and try to match titles
    const cleanedKey = cleanText(keywordKey)
        .replace(/_en_auto\.?$/, '')
        .replace(/_[A-Za-z0-9_-]{11}_en_auto\.?$/, '');
    
    let bestMatch = null;
    let bestScore = 0;
    
    for (const video of videos) {
        const cleanVideoTitle = cleanText(video.title);
        const standardKey = generateStandardFilename(video).replace('.txt', '');
        
        // Direct title match after cleaning
        if (cleanedKey === cleanVideoTitle) {
            return {
                video: video,
                method: 'title_exact',
                confidence: 1.0
            };
        }
        
        // Standard filename match
        const keywordStandardized = cleanText(keywordKey.replace(/\.?$/, ''));
        if (keywordStandardized === standardKey) {
            return {
                video: video,
                method: 'filename_exact',
                confidence: 1.0
            };
        }
        
        // Fuzzy title matching
        const similarity = stringSimilarity(cleanedKey, cleanVideoTitle);
        if (similarity > bestScore && similarity > 0.8) {
            bestScore = similarity;
            bestMatch = {
                video: video,
                method: 'title_fuzzy',
                confidence: similarity
            };
        }
    }
    
    return bestMatch;
}

/**
 * Process keywords file
 */
function processKeywords(videos) {
    console.log('\n🔄 Processing keywords file...');
    
    try {
        const keywords = JSON.parse(fs.readFileSync(KEYWORDS_FILE, 'utf8'));
        results.stats.total_keyword_entries = Object.keys(keywords).length;
        
        console.log(`✅ Loaded ${results.stats.total_keyword_entries} keyword entries`);
        
        for (const [keywordKey, keywordArray] of Object.entries(keywords)) {
            const match = findVideoForKeywordKey(keywordKey, videos);
            
            if (match) {
                const standardKey = generateStandardFilename(match.video);
                
                // Remove .txt extension for keywords
                const finalKey = standardKey.replace('.txt', '');
                
                results.matched_keywords[finalKey] = keywordArray;
                results.stats.successful_matches++;
                
                if (keywordKey !== finalKey) {
                    results.fixed_keywords.push({
                        old: keywordKey,
                        new: finalKey,
                        video: match.video,
                        method: match.method,
                        confidence: match.confidence
                    });
                    results.stats.fixed_entries++;
                }
                
                console.log(`✅ ${match.method} (${match.confidence.toFixed(3)}): ${keywordKey} → ${match.video.title}`);
                
            } else {
                results.orphaned_keywords.push({
                    key: keywordKey,
                    keywords: keywordArray
                });
                results.stats.orphaned_entries++;
                console.log(`❌ No match found: ${keywordKey}`);
            }
        }
        
        // Find videos without keywords
        const videosWithKeywords = new Set();
        Object.keys(results.matched_keywords).forEach(key => {
            const match = key.match(/([A-Za-z0-9_-]{11})_en_auto$/);
            if (match) {
                videosWithKeywords.add(match[1]);
            }
        });
        
        results.unmatched_videos = videos.filter(video => 
            !videosWithKeywords.has(video.video_id)
        );
        
    } catch (error) {
        console.error(`❌ Failed to process keywords: ${error.message}`);
        results.errors.push(`Failed to process keywords: ${error.message}`);
    }
}

/**
 * Write updated keywords file
 */
function writeUpdatedKeywords() {
    if (dryRun) {
        console.log('\n📝 DRY RUN - Keywords file would be updated');
        return;
    }
    
    try {
        // Create backup
        if (!fs.existsSync(BACKUP_DIR)) {
            fs.mkdirSync(BACKUP_DIR, { recursive: true });
        }
        
        const backupPath = path.join(BACKUP_DIR, 'keywords.json');
        fs.copyFileSync(KEYWORDS_FILE, backupPath);
        console.log(`💾 Backup created: ${backupPath}`);
        
        // Write updated keywords
        fs.writeFileSync(KEYWORDS_FILE, JSON.stringify(results.matched_keywords, null, 2));
        console.log('✅ Updated keywords.json with standardized keys');
        
    } catch (error) {
        console.error(`❌ Failed to write keywords file: ${error.message}`);
        results.errors.push(`Failed to write keywords: ${error.message}`);
    }
}

/**
 * Generate comprehensive report
 */
function generateReport() {
    console.log('\n🎯 KEYWORDS ASSOCIATION FIX REPORT');
    console.log('=' .repeat(60));
    
    console.log('\n📊 KEYWORDS STATISTICS:');
    console.log(`Total keyword entries processed: ${results.stats.total_keyword_entries}`);
    console.log(`Successful matches: ${results.stats.successful_matches}`);
    console.log(`Fixed entries: ${results.stats.fixed_entries}`);
    console.log(`Orphaned entries: ${results.stats.orphaned_entries}`);
    console.log(`Videos without keywords: ${results.unmatched_videos.length}`);
    
    const matchPercentage = (results.stats.successful_matches / results.stats.total_keyword_entries * 100).toFixed(1);
    console.log(`\n✅ Success rate: ${matchPercentage}%`);
    
    if (results.fixed_keywords.length > 0) {
        console.log('\n🔧 SAMPLE KEYWORD FIXES:');
        results.fixed_keywords.slice(0, 10).forEach((fix, i) => {
            console.log(`${i + 1}. ${fix.old}`);
            console.log(`   → ${fix.new}`);
            console.log(`   Video: ${fix.video.title}`);
            console.log(`   Method: ${fix.method} (${fix.confidence.toFixed(3)})`);
            console.log('');
        });
        if (results.fixed_keywords.length > 10) {
            console.log(`   ... and ${results.fixed_keywords.length - 10} more fixes`);
        }
    }
    
    if (results.orphaned_keywords.length > 0) {
        console.log(`\n🏝️ ORPHANED KEYWORD ENTRIES (${results.orphaned_keywords.length}):`);
        results.orphaned_keywords.slice(0, 10).forEach((orphan, i) => {
            console.log(`${i + 1}. ${orphan.key}`);
            console.log(`   Keywords: ${orphan.keywords.slice(0, 3).join(', ')}${orphan.keywords.length > 3 ? '...' : ''}`);
        });
        if (results.orphaned_keywords.length > 10) {
            console.log(`   ... and ${results.orphaned_keywords.length - 10} more`);
        }
    }
    
    if (results.unmatched_videos.length > 0) {
        console.log(`\n📋 VIDEOS WITHOUT KEYWORDS (${results.unmatched_videos.length}):`);
        results.unmatched_videos.slice(0, 15).forEach((video, i) => {
            console.log(`${i + 1}. ${video.video_id} - ${video.title}`);
        });
        if (results.unmatched_videos.length > 15) {
            console.log(`   ... and ${results.unmatched_videos.length - 15} more`);
        }
    }
    
    console.log('\n💡 NEXT STEPS:');
    console.log('1. Refresh your browser to see updated keyword associations');
    console.log('2. Run verification script to confirm keyword improvements');
    if (results.unmatched_videos.length > 0) {
        console.log('3. Consider generating keywords for remaining videos');
    }
    
    if (!dryRun) {
        console.log(`\n💾 Backup created at: ${BACKUP_DIR}`);
    }
    
    console.log('\n✅ KEYWORDS ASSOCIATION FIX COMPLETE!');
    console.log('=' .repeat(60));
    
    // Save detailed report
    const reportFile = `keywords_fix_report_${dryRun ? 'dry_run_' : ''}${Date.now()}.json`;
    fs.writeFileSync(reportFile, JSON.stringify(results, null, 2));
    console.log(`\n📋 Detailed report saved: ${reportFile}`);
}

/**
 * Main execution
 */
async function main() {
    console.log('🚀 Starting keywords association fix...');
    
    if (dryRun) {
        console.log('📝 DRY RUN MODE - No files will be modified');
    }
    
    try {
        // Load videos
        if (!fs.existsSync(VIDEOS_FILE)) {
            throw new Error(`Videos file not found: ${VIDEOS_FILE}`);
        }
        
        if (!fs.existsSync(KEYWORDS_FILE)) {
            throw new Error(`Keywords file not found: ${KEYWORDS_FILE}`);
        }
        
        const videos = JSON.parse(fs.readFileSync(VIDEOS_FILE, 'utf8'));
        console.log(`✅ Loaded ${videos.length} videos`);
        
        // Process keywords
        processKeywords(videos);
        
        // Write updated keywords file
        if (results.stats.successful_matches > 0) {
            writeUpdatedKeywords();
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
Keywords Association Fixer

Usage:
  node fix_keywords_associations.js [options]

Options:
  --dry-run    Show what would be changed without making changes
  --help, -h   Show this help message

This script fixes keyword associations by:
1. Matching keyword keys to videos using multiple strategies
2. Standardizing keyword keys to current naming convention
3. Cleaning HTML encoding issues
4. Removing orphaned entries
`);
    process.exit(0);
}

// Run the script
if (require.main === module) {
    main();
}

module.exports = { main, findVideoForKeywordKey, cleanText };