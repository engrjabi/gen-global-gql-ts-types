const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const concat = require('concat');
const writeFile = require('write-file');
const deleteDirectory = require('delete-directory');
const _debounce = require('lodash/debounce');
const _defaultTo = require('lodash/defaultTo');

/**
 * Meant to be used for rapid repetitive calls of console log so
 * user will not see duplicated messages
 */
const debouncedLogging = _debounce(message => console.log(message));

(async () => {
  console.log('STARTING');
  const normalizedArgs = process.argv.slice(2);
  const tempDirName = 'gen-global-gql-types-tmp';
  const workingDirectory = process.env.PWD;
  const tempDirNameFullPath = path.join(workingDirectory, tempDirName);
  const outputFileName = normalizedArgs.pop();
  const otherCodegenArgs = _defaultTo(normalizedArgs, []);
  const outputFileFullPath = path.join(
    workingDirectory,
    `${outputFileName}.ts`,
  );

  if (normalizedArgs.length !== 1) {
    throw Error('Please provide the output file name as the first argument');
  }

  console.log('EXECUTING APOLLO CODE GEN');
  await new Promise(resolve => {
    const child = spawn('./node_modules/apollo/bin/run', [
      'codegen:generate',
      '--target=typescript',
      '--outputFlat',
      ...otherCodegenArgs,
      tempDirName,
    ]);

    // This will not be triggered if an error occurred while executing codegen
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      debouncedLogging(chunk);
    });

    // This one is able to console.log the output with or without error from codegen
    child.stdio[2].setEncoding('utf8');
    child.stdio[2].on('data', chunk => {
      debouncedLogging(chunk);
    });

    child.on('close', code => {
      resolve(code);
    });
  });

  console.log('READING GENERATED GQL TYPES');
  const fileList: string[] = await new Promise((resolve, reject) => {
    fs.readdir(tempDirNameFullPath, (err, files) => {
      if (err) {
        console.log('Unable to scan directory: ' + err);
        return reject(err);
      }
      files.filter(file => file.includes('.ts'));
      resolve(files);
    });
  });

  console.log('COMBINING GENERATED GQL TYPES');
  const fileListWithFullPath = fileList.map(
    fileName => `${tempDirNameFullPath}/${fileName}`,
  );
  const concatResult = await concat(fileListWithFullPath);

  console.log('REMOVING IMPORT AND EXPORT FROM FINAL RESULT');
  const finalResult = concatResult
    .replace(/import.+/gi, '')
    .replace(/export /gi, '');

  console.log('SAVING TO FILE');
  await new Promise((resolve, reject) => {
    writeFile(outputFileFullPath, finalResult, err => {
      if (err) {
        console.log(err);
        return reject();
      }
      resolve();
    });
  });

  console.log('DONE! CLEANING UP TEMPORARY DIRECTORY');
  await deleteDirectory(tempDirNameFullPath);
})();
