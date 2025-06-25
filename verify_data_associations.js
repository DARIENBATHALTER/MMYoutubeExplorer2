#!/usr/bin/env node

/**
 * Video Data Association Verification Script
 * 
 * This script verifies that subtitle, summary, and keyword files
 * are properly associated with their corresponding videos.
 * 
 * Run with: node verify_data_associations.js
 */

const fs = require('fs');
const path = require('path');

// Configuration
const DATA_DIR = './data';
const VIDEOS_FILE = path.join(DATA_DIR, 'videos.json');
const KEYWORDS_FILE = path.join(DATA_DIR, 'keywords.json');
const SUBTITLES_DIR = path.join(DATA_DIR, 'subtitles');
const SUMMARIES_DIR = path.join(DATA_DIR, 'summaries');

// Results tracking
const results = {
    videos: [],
    subtitle_matches: 0,
    summary_matches: 0,
    keyword_matches: 0,
    subtitle_mismatches: [],
    summary_mismatches: [],
    keyword_mismatches: [],
    orphaned_subtitles: [],
    orphaned_summaries: [],
    orphaned_keywords: []
};

/**
 * Clean filename for matching
 */
function cleanFilename(name) {
    return name.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Generate possible filename patterns for a video
 */
function generateFilenamePatterns(video) {
    const cleanTitle = cleanFilename(video.title);
    const videoId = video.video_id;
    
    return [
        // Standard patterns: Title_VideoId_lang_type
        `${cleanTitle}_${videoId}_en_auto`,
        `${cleanTitle}_${videoId}_en_manual`,
        // Alternative patterns: VideoId Title_VideoId_lang_type  
        `${videoId} ${cleanTitle}_${videoId}_en_auto`,
        `${videoId} ${cleanTitle}_${videoId}_en_manual`,
        // Pattern with double underscore
        `${cleanTitle}__${videoId}_en_auto`,
        `${cleanTitle}__${videoId}_en_manual`,
        // Reverse pattern: VideoId_Title_lang_type
        `${videoId}_${cleanTitle}_en_auto`,
        `${videoId}_${cleanTitle}_en_manual`,
        // Pattern starting with VideoId
        `${videoId} ${cleanTitle}__${videoId}_en_auto`,
        `${videoId} ${cleanTitle}__${videoId}_en_manual`
    ];
}

/**
 * Find matching files in a directory
 */
function findMatchingFiles(patterns, directory, extension) {
    if (!fs.existsSync(directory)) {
        return [];
    }
    
    const files = fs.readdirSync(directory);
    const matches = [];
    
    for (const pattern of patterns) {
        const matchingFiles = files.filter(file => {
            const baseName = file.replace(/\.(txt|json|srt)$/, '');
            return baseName === pattern || baseName === pattern + extension;
        });
        matches.push(...matchingFiles);
    }
    
    return [...new Set(matches)]; // Remove duplicates
}

/**
 * Check if a video has associated files
 */
function checkVideoAssociations(video) {
    const patterns = generateFilenamePatterns(video);
    
    // Check subtitles
    const subtitleFiles = findMatchingFiles(patterns, SUBTITLES_DIR, '');
    const hasSubtitles = subtitleFiles.length > 0;
    
    // Check summaries  
    const summaryPatterns = patterns.map(p => p + '_summary');
    const summaryFiles = findMatchingFiles(summaryPatterns, SUMMARIES_DIR, '');
    const hasSummaries = summaryFiles.length > 0;
    
    // Check keywords
    const keywordMatches = patterns.filter(pattern => 
        keywords.hasOwnProperty(pattern)
    );
    const hasKeywords = keywordMatches.length > 0;
    
    return {
        video_id: video.video_id,
        title: video.title,
        subtitles: {
            found: hasSubtitles,
            files: subtitleFiles,
            patterns_checked: patterns
        },
        summaries: {
            found: hasSummaries,
            files: summaryFiles,
            patterns_checked: summaryPatterns
        },
        keywords: {
            found: hasKeywords,
            matches: keywordMatches
        }
    };
}

/**
 * Find orphaned files (files not associated with any video)
 */
function findOrphanedFiles() {
    const allVideoIds = new Set(videos.map(v => v.video_id));
    const allTitles = new Set(videos.map(v => cleanFilename(v.title)));
    
    // Check subtitle files
    if (fs.existsSync(SUBTITLES_DIR)) {
        const subtitleFiles = fs.readdirSync(SUBTITLES_DIR);
        for (const file of subtitleFiles) {
            if (file.startsWith('.') || !file.match(/\.(txt|json|srt)$/)) continue;
            
            const baseName = file.replace(/\.(txt|json|srt)$/, '');
            const hasMatch = videos.some(video => {
                const patterns = generateFilenamePatterns(video);
                return patterns.some(pattern => baseName === pattern);
            });
            
            if (!hasMatch) {
                results.orphaned_subtitles.push(file);
            }
        }
    }
    
    // Check summary files
    if (fs.existsSync(SUMMARIES_DIR)) {
        const summaryFiles = fs.readdirSync(SUMMARIES_DIR);
        for (const file of summaryFiles) {
            if (file.startsWith('.') || !file.match(/\.(txt|json)$/)) continue;
            
            const baseName = file.replace(/\.(txt|json)$/, '').replace(/_summary$/, '');
            const hasMatch = videos.some(video => {
                const patterns = generateFilenamePatterns(video);
                return patterns.some(pattern => baseName === pattern);
            });
            
            if (!hasMatch) {
                results.orphaned_summaries.push(file);
            }
        }
    }
    
    // Check keyword entries
    for (const keywordKey of Object.keys(keywords)) {
        const hasMatch = videos.some(video => {
            const patterns = generateFilenamePatterns(video);
            return patterns.includes(keywordKey);
        });
        
        if (!hasMatch) {
            results.orphaned_keywords.push(keywordKey);
        }
    }
}

/**
 * Generate detailed report
 */
function generateReport() {
    console.log('\n🔍 VIDEO DATA ASSOCIATION VERIFICATION REPORT');
    console.log('=' .repeat(60));
    
    // Summary statistics
    console.log('\n📊 SUMMARY STATISTICS:');
    console.log(`Total videos: ${videos.length}`);
    console.log(`Videos with subtitles: ${results.subtitle_matches}/${videos.length} (${(results.subtitle_matches/videos.length*100).toFixed(1)}%)`);
    console.log(`Videos with summaries: ${results.summary_matches}/${videos.length} (${(results.summary_matches/videos.length*100).toFixed(1)}%)`);
    console.log(`Videos with keywords: ${results.keyword_matches}/${videos.length} (${(results.keyword_matches/videos.length*100).toFixed(1)}%)`);
    
    // Missing associations
    console.log('\n❌ VIDEOS MISSING DATA:');
    console.log('\nMissing Subtitles:');
    if (results.subtitle_mismatches.length === 0) {
        console.log('  ✅ All videos have subtitles!');
    } else {
        results.subtitle_mismatches.forEach((video, i) => {
            console.log(`  ${i+1}. ${video.video_id} - "${video.title}"`);
        });
    }
    
    console.log('\nMissing Summaries:');
    if (results.summary_mismatches.length === 0) {
        console.log('  ✅ All videos have summaries!');
    } else {
        results.summary_mismatches.forEach((video, i) => {
            console.log(`  ${i+1}. ${video.video_id} - "${video.title}"`);
        });
    }
    
    console.log('\nMissing Keywords:');
    if (results.keyword_mismatches.length === 0) {
        console.log('  ✅ All videos have keywords!');
    } else {
        results.keyword_mismatches.forEach((video, i) => {
            console.log(`  ${i+1}. ${video.video_id} - "${video.title}"`);
        });
    }
    
    // Orphaned files
    console.log('\n🏝️ ORPHANED FILES (no matching video):');
    console.log(`\nOrphaned Subtitle Files (${results.orphaned_subtitles.length}):`);
    if (results.orphaned_subtitles.length === 0) {
        console.log('  ✅ No orphaned subtitle files!');
    } else {
        results.orphaned_subtitles.slice(0, 10).forEach((file, i) => {
            console.log(`  ${i+1}. ${file}`);
        });
        if (results.orphaned_subtitles.length > 10) {
            console.log(`  ... and ${results.orphaned_subtitles.length - 10} more`);
        }
    }
    
    console.log(`\nOrphaned Summary Files (${results.orphaned_summaries.length}):`);
    if (results.orphaned_summaries.length === 0) {
        console.log('  ✅ No orphaned summary files!');
    } else {
        results.orphaned_summaries.slice(0, 10).forEach((file, i) => {
            console.log(`  ${i+1}. ${file}`);
        });
        if (results.orphaned_summaries.length > 10) {
            console.log(`  ... and ${results.orphaned_summaries.length - 10} more`);
        }
    }
    
    console.log(`\nOrphaned Keyword Entries (${results.orphaned_keywords.length}):`);
    if (results.orphaned_keywords.length === 0) {
        console.log('  ✅ No orphaned keyword entries!');
    } else {
        results.orphaned_keywords.slice(0, 10).forEach((key, i) => {
            console.log(`  ${i+1}. ${key}`);
        });
        if (results.orphaned_keywords.length > 10) {
            console.log(`  ... and ${results.orphaned_keywords.length - 10} more`);
        }
    }
    
    // File naming pattern analysis
    console.log('\n📋 FILENAME PATTERN ANALYSIS:');
    const patternAnalysis = analyzeNamingPatterns();
    console.log(`Most common subtitle pattern: ${patternAnalysis.subtitle_pattern}`);
    console.log(`Most common summary pattern: ${patternAnalysis.summary_pattern}`);
    
    console.log('\n✅ VERIFICATION COMPLETE!');
    console.log('=' .repeat(60));
}

/**
 * Analyze naming patterns to help identify issues
 */
function analyzeNamingPatterns() {
    const subtitlePatterns = {};
    const summaryPatterns = {};
    
    // Analyze subtitle files
    if (fs.existsSync(SUBTITLES_DIR)) {
        const files = fs.readdirSync(SUBTITLES_DIR);
        files.forEach(file => {
            if (file.match(/\.txt$/)) {
                if (file.includes('__')) {
                    subtitlePatterns['double_underscore'] = (subtitlePatterns['double_underscore'] || 0) + 1;
                } else if (file.match(/^[A-Za-z0-9_-]+ /)) {
                    subtitlePatterns['videoid_first'] = (subtitlePatterns['videoid_first'] || 0) + 1;
                } else {
                    subtitlePatterns['title_first'] = (subtitlePatterns['title_first'] || 0) + 1;
                }
            }
        });
    }
    
    // Analyze summary files
    if (fs.existsSync(SUMMARIES_DIR)) {
        const files = fs.readdirSync(SUMMARIES_DIR);
        files.forEach(file => {
            if (file.match(/\.txt$/)) {
                if (file.includes('__')) {
                    summaryPatterns['double_underscore'] = (summaryPatterns['double_underscore'] || 0) + 1;
                } else if (file.match(/^[A-Za-z0-9_-]+ /)) {
                    summaryPatterns['videoid_first'] = (summaryPatterns['videoid_first'] || 0) + 1;
                } else {
                    summaryPatterns['title_first'] = (summaryPatterns['title_first'] || 0) + 1;
                }
            }
        });
    }
    
    return {
        subtitle_pattern: Object.keys(subtitlePatterns).reduce((a, b) => subtitlePatterns[a] > subtitlePatterns[b] ? a : b, 'unknown'),
        summary_pattern: Object.keys(summaryPatterns).reduce((a, b) => summaryPatterns[a] > summaryPatterns[b] ? a : b, 'unknown')
    };
}

// Main execution
async function main() {
    console.log('🚀 Starting video data association verification...');
    
    try {
        // Load data files
        console.log('📁 Loading data files...');
        
        if (!fs.existsSync(VIDEOS_FILE)) {
            throw new Error(`Videos file not found: ${VIDEOS_FILE}`);
        }
        
        if (!fs.existsSync(KEYWORDS_FILE)) {
            throw new Error(`Keywords file not found: ${KEYWORDS_FILE}`);
        }
        
        global.videos = JSON.parse(fs.readFileSync(VIDEOS_FILE, 'utf8'));
        global.keywords = JSON.parse(fs.readFileSync(KEYWORDS_FILE, 'utf8'));
        
        console.log(`✅ Loaded ${videos.length} videos and ${Object.keys(keywords).length} keyword entries`);
        
        // Check each video
        console.log('🔍 Checking video associations...');
        
        for (const video of videos) {
            const associations = checkVideoAssociations(video);
            results.videos.push(associations);
            
            // Count matches and mismatches
            if (associations.subtitles.found) {
                results.subtitle_matches++;
            } else {
                results.subtitle_mismatches.push(video);
            }
            
            if (associations.summaries.found) {
                results.summary_matches++;
            } else {
                results.summary_mismatches.push(video);
            }
            
            if (associations.keywords.found) {
                results.keyword_matches++;
            } else {
                results.keyword_mismatches.push(video);
            }
        }
        
        // Find orphaned files
        console.log('🏝️ Checking for orphaned files...');
        findOrphanedFiles();
        
        // Generate report
        generateReport();
        
        // Save detailed results to file
        const resultsFile = 'verification_results.json';
        fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
        console.log(`\n💾 Detailed results saved to: ${resultsFile}`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    main();
}

module.exports = { main, checkVideoAssociations, generateFilenamePatterns };