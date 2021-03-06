import fs from 'fs-extra';
import { Command, flags } from '@oclif/command';
import Listr = require('listr');
import * as path from 'path';
import { Helpers } from '../actions/helpers';
import { AWSActions } from '../actions/aws-actions';
import chalk from 'chalk';
import cli from 'cli-ux';

export class UpdateStackCommand extends Command {
  static description = 'describe the command here';

  static flags = {
    help: flags.help({ char: 'h' }),
    // flag with no value (-f, --force)
    readonly: flags.boolean({
      char: 'r', // shorter flag version
      description: 'set api to readonly (true) or writeable (false)', // help description for flag
      hidden: false, // hide from help
      default: false, // default value if flag not passed (can be a function that returns a string or undefined)
      required: false, // default value if flag not passed (can be a function that returns a string or undefined)
    }),
    swagger: flags.boolean({
      char: 's', // shorter flag version
      description: 'activate swagger ui support', // help description for flag
      hidden: false, // hide from help
      default: true, // default value if flag not passed (can be a function that returns a string or undefined)
      required: false, // make flag required (this is not common and you should probably use an argument instead)
    }),
    apikeyauth: flags.boolean({
      char: 'a', // shorter flag version
      description: 'require api key authentication to access api', // help description for flag
      hidden: false, // hide from help
      default: false, // default value if flag not passed (can be a function that returns a string or undefined)
      required: false, // make flag required (this is not common and you should probably use an argument instead)
    }),
  };

  async run() {
    await Helpers.generateLogo('json-serverless');
    this.log();
    const { args, flags } = this.parse(UpdateStackCommand);
    cli.action.start(
      `${chalk.blueBright('Check AWS Identity')}`,
      `${chalk.blueBright('initializing')}`,
      { stdout: true }
    );
    try {
      const identity = await AWSActions.checkValidAWSIdentity();
      this.log(`${chalk.green('AWS Account: ' + identity.Account)}`);
    } catch (error) {
      this.error(`${chalk.red(error.message)}`);
    }
    cli.action.stop();
    this.log();
    const templateFolder = path.normalize(this.config.root + '/template');
    const stackFolder = process.cwd();
    const tasks = new Listr([
      {
        title: 'Validate JSON Serverless Directory',
        task: (task) => {
          Helpers.isJSONServerlessDirectory(stackFolder);
        },
      },
      {
        title: 'Copy Template Files',
        task: async (task) => {
          await fs.copy(templateFolder + '/src', stackFolder + '/src');
          await fs.copy(
            templateFolder + '/package.json',
            stackFolder + '/package.json'
          );
          await fs.copy(
            templateFolder + '/package-lock.json',
            stackFolder + '/package-lock.json'
          );
          await fs.copy(
            templateFolder + '/serverless.yml',
            stackFolder + '/serverless.yml'
          );
          await fs.copy(
            templateFolder + '/tsconfig.json',
            stackFolder + '/tsconfig.json'
          );
          await fs.copy(
            templateFolder + '/webpack.config.prod.js',
            stackFolder + '/webpack.config.prod.js'
          );
        },
      },
      {
        title: 'Update Appconfig',
        task: (ctx, task) => {
          const appConfig = JSON.parse(
            fs.readFileSync(stackFolder + '/config/appconfig.json', 'UTF-8')
          );
          appConfig.enableApiKeyAuth = flags.apikeyauth;
          appConfig.readOnly = flags.readonly;
          appConfig.enableSwagger = flags.swagger;
          fs.writeFileSync(
            path.normalize(stackFolder + '/config/appconfig.json'),
            JSON.stringify(appConfig, null, 2),
            'utf-8'
          );
        },
      },
      {
        title: 'Update Dependencies',
        task: async (task) => {
          task.output = 'INSTALL DEPENDENCIES';
          Helpers.removeDir(stackFolder + '/node_modules');
          await Helpers.executeChildProcess(
            'npm i',
            {
              cwd: stackFolder,
            },
            false
          );
        },
      },
      {
        title: 'Deploy Stack on AWS',
        task: async () => {
          await Helpers.executeChildProcess(
            'node_modules/serverless/bin/serverless deploy',
            {
              cwd: stackFolder,
            },
            false
          );
        },
      },
    ]);
    try {
      await tasks.run();
      await Helpers.executeChildProcess(
        'node_modules/serverless/bin/serverless info',
        { cwd: stackFolder }
      );
    } catch (error) {
      this.error(`${chalk.red(error.message)}`);
    }
  }
}
