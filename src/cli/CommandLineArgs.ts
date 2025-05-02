type ArgOptions = {
  [key: string]: {
    shortHand: string;
    description: string;
    default: string | number | boolean | null;
    parameter: string | null;
    type: 'string' | 'number' | null;
  };
};

type ParsedArgs<T> = {
  [key in keyof T]: string | number | boolean | null;
};
class CommandLineArgs {

  private argOptions: ArgOptions;
  private args: ParsedArgs<ArgOptions>;

  constructor(argOptions: ArgOptions) {
    this.argOptions = argOptions;

    let activeArg: string = '';
    this.args = process.argv.slice(2).reduce((acc, arg) => {
      const argKey = this.findArgKey(arg);
      if (argKey) {
        if (activeArg) {
          process.stderr.write(`Error: Argument -${this.argOptions[activeArg].shortHand}, --${activeArg} requires a value\n\n`);
          this.displayHelp();
          process.exit(1);
        }
        if (this.argOptions[argKey].parameter) {
          activeArg = argKey;
          acc[argKey] = this.argOptions[argKey].default;
        } else {
          acc[argKey] = true;
        }
      } else if (activeArg) {
        if (this.argOptions[activeArg].type === 'number') {
          const value = parseInt(arg, 10);
          if (isNaN(value)) {
            process.stderr.write(`Error: Argument -${this.argOptions[activeArg].shortHand}, --${activeArg} requires a number\n\n`);
            this.displayHelp();
            process.exit(1);
          }
          acc[activeArg] = value;
          activeArg = '';
        } else if (this.argOptions[activeArg].type === 'string') {
          acc[activeArg] = arg;
          activeArg = '';
        }
      } else {
        process.stderr.write(`Error: Unknown argument ${arg}\n\n`);
        this.displayHelp();
        process.exit(1);
      }
      return acc;
    }, {} as ParsedArgs<ArgOptions>);
  }

  findArgKey(arg: string): string | undefined {
    return Object.keys(this.argOptions).find(key => arg === `--${key}` || arg === `-${this.argOptions[key].shortHand}`);
  };

  displayHelp(): void {
    process.stdout.write('Usage: node update_game.js [options]\n');
    process.stdout.write('Options:\n');
    for (const [arg, options] of Object.entries(this.argOptions)) {
      if (!options.parameter) {
        process.stdout.write(`  -${options.shortHand}, --${arg}: ${options.description}`);
      } else {
        process.stdout.write(`  -${options.shortHand}, --${arg} <${options.parameter}>: ${options.description}`);
        if (options.default) {
          process.stdout.write(` (default: ${options.default})`);
        }
      }
      process.stdout.write('\n');
    }
  };

  get(name: string): string | number | boolean | null {
    return this.args[name] || this.argOptions[name].default;
  }
};

export default CommandLineArgs;