#!/usr/bin/env node

/**
 * File Association Fixer Script
 * 
 * This script standardizes file naming conventions to ensure proper
 * association between videos and their subtitle/summary/keyword files.
 * 
 * Standard naming format: {title}_{videoId}_en_auto[_summary]
 * 
 * Run with: node fix_file_associations.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');

// Configuration
const DATA_DIR = './data';
const VIDEOS_FILE = path.join(DATA_DIR, 'videos.json');
const KEYWORDS_FILE = path.join(DATA_DIR, 'keywords.json');
const SUBTITLES_DIR = path.join(DATA_DIR, 'subtitles');
const SUMMARIES_DIR = path.join(DATA_DIR, 'summaries');
const BACKUP_DIR = path.join(DATA_DIR, 'backup_' + Date.now());

// Track changes
const changes = {
    subtitles_renamed: [],
    summaries_renamed: [],
    keywords_updated: [],
    errors: [],
    stats: {
        subtitle_files_processed: 0,
        summary_files_processed: 0,
        keyword_entries_updated: 0,
        videos_matched: 0
    }
};

let dryRun = process.argv.includes('--dry-run');

/**
 * Clean filename for matching - same as verification script
 */
function cleanFilename(name) {
    return name.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Generate standard filename for a video
 */
function generateStandardFilename(video, type = '', extension = 'txt') {
    const cleanTitle = cleanFilename(video.title);
    const videoId = video.video_id;
    const suffix = type ? `_${type}` : '';
    return `${cleanTitle}_${videoId}_en_auto${suffix}.${extension}`;
}

/**
 * Try to match a file to a video using various patterns
 */
function matchFileToVideo(filename, videos) {
    const baseName = filename.replace(/\.(txt|json|srt)$/, '').replace(/_summary$/, '');
    
    for (const video of videos) {
        const videoId = video.video_id;
        const cleanTitle = cleanFilename(video.title);
        
        // Pattern matching logic
        const patterns = [
            `${cleanTitle}_${videoId}_en_auto`,
            `${cleanTitle}_${videoId}_en_manual`,
            `${cleanTitle}__${videoId}_en_auto`,
            `${cleanTitle}__${videoId}_en_manual`,
            `${videoId} ${cleanTitle}_${videoId}_en_auto`,
            `${videoId} ${cleanTitle}_${videoId}_en_manual`,
            `${videoId} ${cleanTitle}__${videoId}_en_auto`,
            `${videoId} ${cleanTitle}__${videoId}_en_manual`,
            `${videoId}_${cleanTitle}_en_auto`,
            `${videoId}_${cleanTitle}_en_manual`
        ];
        
        if (patterns.includes(baseName)) {
            return video;
        }
        
        // Additional fuzzy matching for edge cases
        if (baseName.includes(videoId) && baseName.includes(cleanTitle.substring(0, 20))) {
            return video;
        }
    }
    
    return null;
}

/**
 * Create backup directory
 */
function createBackup() {
    if (!dryRun && !fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
        console.log(`📁 Created backup directory: ${BACKUP_DIR}`);
    }
}

/**
 * Backup original file before renaming
 */
function backupFile(filePath) {
    if (dryRun) return;
    
    const fileName = path.basename(filePath);
    const backupPath = path.join(BACKUP_DIR, fileName);
    
    try {
        fs.copyFileSync(filePath, backupPath);
    } catch (error) {
        console.warn(`⚠️ Could not backup ${fileName}: ${error.message}`);
    }
}

/**
 * Safely rename a file
 */
function renameFile(oldPath, newPath) {
    if (dryRun) {
        console.log(`📝 DRY RUN: Would rename:\n  ${oldPath}\n  → ${newPath}`);
        return true;
    }
    
    try {
        // Check if target already exists
        if (fs.existsSync(newPath)) {
            console.warn(`⚠️ Target file already exists: ${newPath}`);
            return false;
        }
        
        // Backup original
        backupFile(oldPath);
        
        // Rename
        fs.renameSync(oldPath, newPath);
        console.log(`✅ Renamed: ${path.basename(oldPath)} → ${path.basename(newPath)}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to rename ${oldPath}: ${error.message}`);
        changes.errors.push(`Failed to rename ${oldPath}: ${error.message}`);
        return false;
    }
}

/**
 * Process subtitle files
 */
function processSubtitleFiles(videos) {
    if (!fs.existsSync(SUBTITLES_DIR)) {
        console.log('📁 Subtitles directory not found, skipping...');
        return;
    }
    
    console.log('\n🔄 Processing subtitle files...');
    const files = fs.readdirSync(SUBTITLES_DIR);
    
    for (const file of files) {
        if (file.startsWith('.') || !file.match(/\.(txt|json|srt)$/)) continue;
        
        changes.stats.subtitle_files_processed++;
        const filePath = path.join(SUBTITLES_DIR, file);
        const matchedVideo = matchFileToVideo(file, videos);
        
        if (matchedVideo) {
            const extension = path.extname(file).slice(1);
            const standardName = generateStandardFilename(matchedVideo, '', extension);
            const newPath = path.join(SUBTITLES_DIR, standardName);
            
            if (file !== standardName) {
                if (renameFile(filePath, newPath)) {
                    changes.subtitles_renamed.push({
                        old: file,
                        new: standardName,
                        video_id: matchedVideo.video_id,
                        title: matchedVideo.title
                    });
                    changes.stats.videos_matched++;
                }
            }
        } else {
            console.log(`🔍 No match found for subtitle: ${file}`);
        }
    }
}

/**
 * Process summary files
 */
function processSummaryFiles(videos) {
    if (!fs.existsSync(SUMMARIES_DIR)) {
        console.log('📁 Summaries directory not found, skipping...');
        return;
    }
    
    console.log('\n🔄 Processing summary files...');
    const files = fs.readdirSync(SUMMARIES_DIR);
    
    for (const file of files) {
        if (file.startsWith('.') || !file.match(/\.(txt|json)$/)) continue;
        
        changes.stats.summary_files_processed++;
        const filePath = path.join(SUMMARIES_DIR, file);
        const matchedVideo = matchFileToVideo(file, videos);
        
        if (matchedVideo) {
            const extension = path.extname(file).slice(1);
            const standardName = generateStandardFilename(matchedVideo, 'summary', extension);
            const newPath = path.join(SUMMARIES_DIR, standardName);
            
            if (file !== standardName) {
                if (renameFile(filePath, newPath)) {
                    changes.summaries_renamed.push({
                        old: file,
                        new: standardName,
                        video_id: matchedVideo.video_id,
                        title: matchedVideo.title
                    });
                }
            }
        } else {
            console.log(`🔍 No match found for summary: ${file}`);
        }
    }
}

/**
 * Process keywords file
 */
function processKeywordsFile(videos) {
    if (!fs.existsSync(KEYWORDS_FILE)) {
        console.log('📁 Keywords file not found, skipping...');
        return;
    }
    
    console.log('\n🔄 Processing keywords file...');
    
    try {
        const keywords = JSON.parse(fs.readFileSync(KEYWORDS_FILE, 'utf8'));
        const newKeywords = {};
        
        // First, try to match existing keys to videos and standardize them
        for (const [oldKey, keywordArray] of Object.entries(keywords)) {
            changes.stats.keyword_entries_updated++;
            
            // Find matching video
            const matchedVideo = matchFileToVideo(oldKey + '.txt', videos);
            
            if (matchedVideo) {
                const standardKey = generateStandardFilename(matchedVideo, '', '').replace('.txt', '');
                newKeywords[standardKey] = keywordArray;
                
                if (oldKey !== standardKey) {
                    changes.keywords_updated.push({
                        old: oldKey,
                        new: standardKey,
                        video_id: matchedVideo.video_id,
                        title: matchedVideo.title
                    });
                }
            } else {
                // Keep orphaned entries for now
                newKeywords[oldKey] = keywordArray;
                console.log(`🔍 No match found for keyword entry: ${oldKey}`);
            }
        }
        
        // Write updated keywords file
        if (!dryRun) {
            // Backup original
            const backupKeywordsPath = path.join(BACKUP_DIR, 'keywords.json');
            fs.copyFileSync(KEYWORDS_FILE, backupKeywordsPath);
            
            // Write new file
            fs.writeFileSync(KEYWORDS_FILE, JSON.stringify(newKeywords, null, 2));
            console.log('✅ Updated keywords.json with standardized keys');
        } else {
            console.log('📝 DRY RUN: Would update keywords.json with standardized keys');
        }
        
    } catch (error) {
        console.error(`❌ Failed to process keywords file: ${error.message}`);
        changes.errors.push(`Failed to process keywords: ${error.message}`);
    }
}

/**
 * Generate final report
 */
function generateReport() {
    console.log('\n🎯 FILE ASSOCIATION FIX REPORT');
    console.log('=' .repeat(60));
    
    console.log('\n📊 STATISTICS:');
    console.log(`Subtitle files processed: ${changes.stats.subtitle_files_processed}`);
    console.log(`Summary files processed: ${changes.stats.summary_files_processed}`);
    console.log(`Keyword entries processed: ${changes.stats.keyword_entries_updated}`);
    console.log(`Videos matched: ${changes.stats.videos_matched}`);
    
    console.log('\n✅ SUCCESSFUL CHANGES:');
    console.log(`Subtitles renamed: ${changes.subtitles_renamed.length}`);
    console.log(`Summaries renamed: ${changes.summaries_renamed.length}`);
    console.log(`Keywords updated: ${changes.keywords_updated.length}`);
    
    if (changes.subtitles_renamed.length > 0) {
        console.log('\n📝 Sample Subtitle Renames:');
        changes.subtitles_renamed.slice(0, 5).forEach((change, i) => {
            console.log(`  ${i+1}. ${change.old} → ${change.new}`);
            console.log(`     Video: ${change.title}`);
        });
        if (changes.subtitles_renamed.length > 5) {
            console.log(`     ... and ${changes.subtitles_renamed.length - 5} more`);
        }
    }
    
    if (changes.summaries_renamed.length > 0) {
        console.log('\n📝 Sample Summary Renames:');
        changes.summaries_renamed.slice(0, 5).forEach((change, i) => {
            console.log(`  ${i+1}. ${change.old} → ${change.new}`);
            console.log(`     Video: ${change.title}`);
        });
        if (changes.summaries_renamed.length > 5) {
            console.log(`     ... and ${changes.summaries_renamed.length - 5} more`);
        }
    }
    
    if (changes.keywords_updated.length > 0) {
        console.log('\n🏷️ Sample Keyword Updates:');
        changes.keywords_updated.slice(0, 5).forEach((change, i) => {
            console.log(`  ${i+1}. ${change.old} → ${change.new}`);
        });
        if (changes.keywords_updated.length > 5) {
            console.log(`     ... and ${changes.keywords_updated.length - 5} more`);
        }
    }
    
    if (changes.errors.length > 0) {
        console.log('\n❌ ERRORS:');
        changes.errors.forEach((error, i) => {
            console.log(`  ${i+1}. ${error}`);
        });
    }
    
    if (!dryRun) {
        console.log(`\n💾 Backup created at: ${BACKUP_DIR}`);
        console.log('\n🔄 NEXT STEPS:');
        console.log('1. Refresh your browser to see the updated data');
        console.log('2. Run the verification script again to confirm fixes');
        console.log('3. If issues persist, check the backup directory');
    } else {
        console.log('\n🚀 TO APPLY CHANGES:');
        console.log('Run: node fix_file_associations.js');
        console.log('(Remove --dry-run flag)');
    }
    
    console.log('\n✅ FILE ASSOCIATION FIX COMPLETE!');
    console.log('=' .repeat(60));
    
    // Save detailed report
    const reportFile = `fix_report_${dryRun ? 'dry_run_' : ''}${Date.now()}.json`;
    fs.writeFileSync(reportFile, JSON.stringify(changes, null, 2));
    console.log(`\n📋 Detailed report saved: ${reportFile}`);
}

/**
 * Main execution
 */
async function main() {
    console.log('🚀 Starting file association fix...');
    
    if (dryRun) {
        console.log('📝 DRY RUN MODE - No files will be modified');
    }
    
    try {
        // Load videos
        if (!fs.existsSync(VIDEOS_FILE)) {
            throw new Error(`Videos file not found: ${VIDEOS_FILE}`);
        }
        
        const videos = JSON.parse(fs.readFileSync(VIDEOS_FILE, 'utf8'));
        console.log(`✅ Loaded ${videos.length} videos`);
        
        // Create backup directory
        createBackup();
        
        // Process each file type
        processSubtitleFiles(videos);
        processSummaryFiles(videos);
        processKeywordsFile(videos);
        
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
File Association Fixer

Usage:
  node fix_file_associations.js [options]

Options:
  --dry-run    Show what would be changed without making changes
  --help, -h   Show this help message

Examples:
  node fix_file_associations.js --dry-run    # Preview changes
  node fix_file_associations.js              # Apply changes

This script standardizes file naming to: {title}_{videoId}_en_auto[_summary].{ext}
`);
    process.exit(0);
}

// Run the script
if (require.main === module) {
    main();
}

module.exports = { main, matchFileToVideo, generateStandardFilename };