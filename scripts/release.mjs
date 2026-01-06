
import { readFileSync, writeFileSync } from 'fs';
import { resolve, join } from 'path';
import { execSync } from 'child_process';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const packagePath = join(process.cwd(), 'package.json');
const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'));
const currentVersion = pkg.version;

console.log(`\x1b[36mCurrent version: ${currentVersion}\x1b[0m`);

rl.question('Enter new version (or press enter to skip update): ', (newVersion) => {
  if (newVersion && newVersion !== currentVersion) {
    // Validate version format roughly
    if (!/^\d+\.\d+\.\d+/.test(newVersion)) {
      console.error('\x1b[31mInvalid version format. Expected x.y.z\x1b[0m');
      rl.close();
      process.exit(1);
    }

    // Update package.json
    pkg.version = newVersion;
    writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
    console.log(`\x1b[32mUpdated package.json to version ${newVersion}\x1b[0m`);

    try {
      // Stage package.json
      console.log('Staging package.json...');
      execSync('git add package.json', { stdio: 'inherit' });

      // Commit
      console.log('Committing change...');
      execSync(`git commit -m "chore: release v${newVersion}"`, { stdio: 'inherit' });
      
      // Tag
      console.log(`Creating tag v${newVersion}...`);
      execSync(`git tag v${newVersion}`, { stdio: 'inherit' });

      console.log(`\x1b[32mSuccessfully tagged v${newVersion}!\x1b[0m`);
      console.log('\x1b[33mTo push the release, run:\x1b[0m');
      console.log(`git push && git push origin v${newVersion}`);
      
      // Optional: Ask to push?
      // For safety, let's leave it to the user or adding a confirm step here could be nice, 
      // but the plan said "git push && git push --tags" as part of the automation.
      // Let's ask.
      
      askToPush(newVersion);
      
    } catch (error) {
      console.error('\x1b[31mFailed to execute git commands:\x1b[0m', error.message);
      rl.close();
      process.exit(1);
    }
  } else {
    console.log('No version change provided. Checking if we should just tag the current version...');
    // Ask if they want to tag the current version if it's not tagged?
    // checking if tag exists
    try {
        const tagExists = execSync(`git tag -l v${currentVersion}`).toString().trim();
        if (tagExists) {
            console.log(`Tag v${currentVersion} already exists.`);
            rl.close();
        } else {
             askToTagCurrent(currentVersion);
        }
    } catch (e) {
        rl.close();
    }
  }
});

function askToTagCurrent(version) {
    rl.question(`Tag current version v${version}? (y/N) `, (answer) => {
        if (answer.toLowerCase() === 'y') {
             try {
                console.log(`Creating tag v${version}...`);
                execSync(`git tag v${version}`, { stdio: 'inherit' });
                console.log(`\x1b[32mSuccessfully tagged v${version}!\x1b[0m`);
                askToPush(version);
             } catch (e) {
                 console.error(e.message);
                 rl.close();
             }
        } else {
            rl.close();
        }
    });
}

function askToPush(version) {
    rl.question(`Push changes and tag v${version} to remote? (y/N) `, (answer) => {
        if (answer.toLowerCase() === 'y') {
            try {
                console.log('Pushing...');
                execSync('git push', { stdio: 'inherit' });
                execSync(`git push origin v${version}`, { stdio: 'inherit' });
                console.log('\x1b[32m🚀 Release pushed to GitHub! The workflow should start shortly.\x1b[0m');
            } catch (e) {
                console.error('\x1b[31mFailed to push:\x1b[0m', e.message);
            }
        } else {
            console.log('Aborted push.');
        }
        rl.close();
    });
}
