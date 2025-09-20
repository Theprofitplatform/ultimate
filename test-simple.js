#!/usr/bin/env node

// Simple test script for ultimate project
console.log("🧪 Running basic tests for Ultimate SEO Platform...");

const tests = [
  { name: "Check Node.js version", 
    test: () => process.version.startsWith('v') },
  
  { name: "Check package.json exists", 
    test: () => require('fs').existsSync('./package.json') },
  
  { name: "Check dependencies installed", 
    test: () => require('fs').existsSync('./node_modules') },
  
  { name: "Validate package.json", 
    test: () => {
      try {
        const pkg = require('./package.json');
        return pkg.name === 'ultimate-seo-platform';
      } catch {
        return false;
      }
    }
  }
];

let passed = 0;
let failed = 0;

tests.forEach(({name, test}) => {
  try {
    if (test()) {
      console.log(`✅ ${name}`);
      passed++;
    } else {
      console.log(`❌ ${name}`);
      failed++;
    }
  } catch (e) {
    console.log(`❌ ${name}: ${e.message}`);
    failed++;
  }
});

console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);