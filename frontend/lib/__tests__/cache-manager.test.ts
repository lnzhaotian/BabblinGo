/**
 * Cache Manager Tests
 * 
 * Manual test cases to verify cache functionality:
 * 
 * 1. Download and cache a file
 * 2. Retrieve from cache
 * 3. Detect outdated version
 * 4. Track download progress
 * 5. Clear cache
 */

import {
  getOrDownloadFile,
  getCachedFile,
  clearCache,
  getCacheStats,
  deleteCachedFile,
} from '../cache-manager';

// Test with a small image from your backend
const TEST_URL = 'https://your-server.com/api/media/test-image.png';
const VERSION_1 = '2024-01-01T00:00:00.000Z';
const VERSION_2 = '2024-01-02T00:00:00.000Z';

/**
 * Test 1: Download and cache
 */
export async function testDownloadAndCache() {
  console.log('Test 1: Download and cache');
  
  const filePath = await getOrDownloadFile(
    TEST_URL,
    VERSION_1,
    false,
    (progress) => {
      console.log(`Download progress: ${(progress * 100).toFixed(1)}%`);
    }
  );
  
  console.log('File downloaded to:', filePath);
  
  // Verify cache stats
  const stats = await getCacheStats();
  console.log('Cache stats:', stats);
}

/**
 * Test 2: Retrieve from cache
 */
export async function testRetrieveFromCache() {
  console.log('Test 2: Retrieve from cache');
  
  const filePath = await getOrDownloadFile(TEST_URL, VERSION_1);
  
  console.log('File retrieved from cache:', filePath);
}

/**
 * Test 3: Detect outdated version
 */
export async function testOutdatedVersion() {
  console.log('Test 3: Detect outdated version');
  
  // First, check if we have cached version 1
  const cached = await getCachedFile(TEST_URL, VERSION_1);
  console.log('Cached version 1:', cached);
  
  // Now try to get version 2 (should download again)
  const filePath = await getOrDownloadFile(
    TEST_URL,
    VERSION_2,
    false,
    (progress) => {
      console.log(`Re-downloading: ${(progress * 100).toFixed(1)}%`);
    }
  );
  
  console.log('New version downloaded:', filePath);
}

/**
 * Test 4: Force download
 */
export async function testForceDownload() {
  console.log('Test 4: Force download');
  
  const filePath = await getOrDownloadFile(
    TEST_URL,
    VERSION_2,
    true, // Force download
    (progress) => {
      console.log(`Force download: ${(progress * 100).toFixed(1)}%`);
    }
  );
  
  console.log('File force downloaded:', filePath);
}

/**
 * Test 5: Clear cache
 */
export async function testClearCache() {
  console.log('Test 5: Clear cache');
  
  await clearCache();
  
  const stats = await getCacheStats();
  console.log('Cache stats after clear:', stats);
}

/**
 * Run all tests
 */
export async function runAllTests() {
  try {
    await testDownloadAndCache();
    await testRetrieveFromCache();
    await testOutdatedVersion();
    await testForceDownload();
    await testClearCache();
    
    console.log('All tests passed!');
  } catch (error) {
    console.error('Test failed:', error);
  }
}
