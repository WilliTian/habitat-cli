import { Command } from "commander";
import { collectResource } from "../api/collect";
export function registerCollectionCommands(program: Command): void {
  program.command("collect").description("Collect material at the EVA position.").argument("<quantity-kg>").action(async value => {
    if (!/^\d+$/.test(value) || Number(value) <= 0 || !Number.isSafeInteger(Number(value))) throw new Error("quantity-kg must be a positive whole number.");
    const { eva } = await collectResource(Number(value));
    console.log(`Collected material. Carried: ${JSON.stringify(eva.carriedResources)}`);
  });
}
