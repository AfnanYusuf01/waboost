const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting Waboost Multi-Platform Build...');

// Check if build resources exist
function checkBuildResources() {
  const requiredFiles = [
    'build/icons/icon.icns',
    'build/icons/icon.ico', 
    'build/icons/icon.png',
    'build/entitlements.mac.plist'
  ];

  for (const file of requiredFiles) {
    if (!fs.existsSync(file)) {
      console.warn(`⚠️ Warning: ${file} not found`);
    }
  }
}

// Build function
function buildPlatform(platform) {
  console.log(`\n📦 Building for ${platform}...`);
  
  try {
    const cmd = `npm run build:${platform}`;
    console.log(`Executing: ${cmd}`);
    
    execSync(cmd, { stdio: 'inherit' });
    console.log(`✅ ${platform} build completed successfully!`);
    
  } catch (error) {
    console.error(`❌ ${platform} build failed:`, error.message);
  }
}

// Main build process
async function main() {
  console.log('🔍 Checking build resources...');
  checkBuildResources();
  
  console.log('\n🛠️ Starting build process...');
  
  // Get target platform from command line or build all
  const targetPlatform = process.argv[2];
  
  if (targetPlatform) {
    switch(targetPlatform) {
      case 'win':
        buildPlatform('win');
        break;
      case 'mac':
        buildPlatform('mac');
        break;
      case 'linux':
        buildPlatform('linux');
        break;
      default:
        console.log('Invalid platform. Use: win, mac, or linux');
    }
  } else {
    // Build for all platforms
    buildPlatform('win');
    buildPlatform('mac'); 
    buildPlatform('linux');
  }
  
  console.log('\n🎉 Build process completed!');
  console.log('\n📁 Output files are in the "dist" folder:');
  
  if (fs.existsSync('dist')) {
    const files = fs.readdirSync('dist');
    files.forEach(file => {
      console.log(`   📄 ${file}`);
    });
  }
}

main().catch(console.error);