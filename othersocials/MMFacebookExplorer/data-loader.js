// Data loader for Facebook_Posts_Archive
// This script generates a manifest of all available posts

const fs = require('fs');
const path = require('path');

function generateDataManifest() {
    const archiveDir = './Facebook_Posts_Archive';
    const manifestPath = './posts-manifest.json';
    
    try {
        const directories = fs.readdirSync(archiveDir)
            .filter(dir => {
                const fullPath = path.join(archiveDir, dir);
                return fs.statSync(fullPath).isDirectory() && 
                       dir.match(/^\d{4}_\d{2}_\d{2}__\d{2}_\d{2}_\d{2}$/);
            })
            .sort((a, b) => b.localeCompare(a)); // Sort newest first

        const manifest = {
            directories: directories,
            totalPosts: directories.length,
            lastUpdated: new Date().toISOString()
        };

        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        console.log(`✅ Generated manifest with ${directories.length} posts`);
        console.log('📁 Available directories:', directories.slice(0, 5), '...');
        
        return manifest;
    } catch (error) {
        console.error('❌ Error generating manifest:', error);
        return null;
    }
}

// Run if called directly
if (require.main === module) {
    generateDataManifest();
}

module.exports = { generateDataManifest };