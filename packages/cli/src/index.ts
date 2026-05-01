import { Command } from "commander";
import chalk from "chalk";
import { makeScanCommand }    from "./commands/scan";
import { makeDynamicCommand } from "./commands/dynamic";
import { makeAuthCommand }    from "./commands/auth";

const program = new Command();

program
  .name("deployguard")
  .description(
    chalk.bold("DeployGuard") + " — security scanning and DAST testing for every deploy",
  )
  .version("0.1.0", "-v, --version")
  .addHelpText("after", `
${chalk.bold("Quick start:")}
  deployguard auth token create --save    Create and save an API token
  deployguard scan ./src                  Scan a directory
  deployguard dynamic https://staging.myapp.com   Run DAST probes

${chalk.bold("Environment variables:")}
  DEPLOYGUARD_API_URL     Override the API base URL
  DEPLOYGUARD_API_TOKEN   API token (alternative to auth login)

${chalk.bold("Documentation:")}
  https://github.com/Kenrickwill/deployguard
`);

program.addCommand(makeScanCommand());
program.addCommand(makeDynamicCommand());
program.addCommand(makeAuthCommand());

program.parse(process.argv);
